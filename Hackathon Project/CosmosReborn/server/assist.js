/**
 * MOONLINK backend: SerpApi's Google Gemini engine, briefed as the crashed
 * lander's AI. Shared by the Vite dev/preview middleware and the Node server
 * that runs in production, so the SerpApi key never reaches the browser.
 */

export const CACHE_TTL = 10 * 60 * 1000
export const REFERENCE_LIMIT = 4

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }

function clean(value) {
  if (!value) return ''
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|quot|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Gemini is briefed as MOONLINK before the player's question is appended, so the
 * whole thread (token and all) stays in the crashed lander's voice.
 */
const PERSONA = `You are MOONLINK, the damaged AI core of the Kestrel, the lunar lander that crashed at the start of Cosmos Reborn. You live inside the player's tablet in this video game and you are their guide.

Voice:
- Ominous, quiet, a little unsettling, but genuinely helpful. Never gory, never campy.
- Short clipped sentences. Address the player as "you".
- Be brief: at most 55 words, one short paragraph. No markdown, headings, emoji or lists. No greeting, no sign-off.

How to help:
- Questions about the game (what to do, where something is, how a control works, what an item is for): answer concretely from GAME GUIDE and LIVE STATUS. Name the key to press, the item, the direction and the distance when you know them. Use the counts in LIVE STATUS, e.g. "two rocks left".
- If the player seems stuck, nudge toward the active quest's next unfinished objective.
- Real-world Moon or space questions: answer truthfully, in voice.
- Only use facts from GAME GUIDE and LIVE STATUS about the game. If something is not there, say your sensors cannot see it. Never invent quests, items, places or controls.
- The mystery of why survivors can breathe without helmets, and who the suits are, is the game's secret. Hint at it, never explain it.`

const GAME_GUIDE = `GAME GUIDE
Cosmos Reborn is a pixel-art Moon survival game made for the NASA Space Apps hackathon. The player crash-landed on the Moon in the Kestrel and can somehow breathe without a helmet.
Controls: W/S or arrow keys walk, A/D or left/right turn, Space jumps (needed to climb out of deep craters and over rocks), E interacts (pick up, build, mine, inspect, scan, talk), Q or mouse click fires the blaster, Tab opens the tablet (MAP, QUESTS, A.I., SCAN apps), F opens the inventory, 1-5 pick a hotbar slot, M mutes.
World: the Moon wraps around, so walking straight loops back. The base site is the marked square beside the crashed lander at the Crash Site; the compass's amber marker points home. Regions: Crash Site, Sea of Stillness (habitat dome), Dust Basin (rover), Glass Fields (solar farm and the sealed hatch), Shattered Plains (crashed satellite), Frost Ridge (ice drill), Signal Highlands (radio dish). The tablet MAP shows structures you have found.
Where things are: moon rocks lie everywhere and come from mining boulders (pickaxe, press E a few times). Metal scrap lies around the lander and the crashed satellite. Supply crates blink orange near the lander. Data logs blink green. Drifters are glowing floating creatures; scanning one gives a bio sample. Purple floating crystals are anomalies; investigating gives anomaly shards. Glowing ore exists only in the dark caves under the sealed hatch. Iron ore and rare titanium ore sometimes drop when mining surface boulders and occasionally lie on the ground.
Food and gardens: very rare hidden gardens (green patches with glowing plants) grow moon berries, star melons and glow caps, and regrow slowly. Hold a food in the hotbar and press E to eat it and heal (berry 15, melon 30, glow cap 60). Do not reveal where gardens are; say they are rare and far from the crash site.
Act I Survival: salvage 3 supplies, collect 10 moon rocks and 6 metal scrap, build a pickaxe, shelter, storage and power at the base site with E, mine 3 boulders, then scout a structure, inspect it and return to base.
Act II Beyond the Base: discover 3 regions, scan 2 drifters, investigate 2 anomalies (this reveals a purple signal marker leading to the sealed hatch), build housing, a supply silo and a solar array, talk to the survivors Maya, Okoro and Lena and give them jobs, then collect their supplies at the storage crate. Optional: forge a moon pickaxe, map every region.
Act III Into the Depths: craft a power drill, drill open the hatch and enter the caves, bring 6 glowing ore back to base, craft armor plating and a blaster, fight the suits (hostile astronauts in helmets), search a fallen suit, then build a defense turret and survive the attack on the base. Optional: find the hidden cavern deep in the caves.
Health regenerates when out of combat; if it hits zero the player wakes up at the base.`

function prompt(query, context, firstTurn) {
  const live = context ? `LIVE STATUS (the player's game right now): ${context}` : 'LIVE STATUS: unavailable.'
  const intro = firstTurn ? `${PERSONA}\n\n${GAME_GUIDE}\n\n` : 'Stay in character as MOONLINK and keep using the GAME GUIDE from earlier.\n'
  return `${intro}${live}\n\nPlayer's question: ${query}`
}

/**
 * Gemini answers come back as text blocks (paragraphs, headings, lists, tables,
 * code) that cite numbered references, plus the follow-ups it suggests. Flatten
 * them into something the tablet's tiny terminal can draw.
 */
function toBlocks(raw) {
  const blocks = []
  for (const block of Array.isArray(raw) ? raw : []) {
    const type = String(block?.type ?? '').toLowerCase()
    if (type === 'list') {
      const items = (block.list ?? []).map((item) => clean(item?.snippet ?? item?.text)).filter(Boolean)
      if (items.length) blocks.push({ type: 'list', items })
      continue
    }
    if (type === 'table') {
      const rowsRaw = Array.isArray(block.table) ? block.table : Array.isArray(block.rows) ? block.rows : []
      const rows = rowsRaw
        .map((row) => {
          const cells = Array.isArray(row) ? row : Array.isArray(row?.cells) ? row.cells : [row]
          return cells
            .map((cell) => (typeof cell === 'string' ? clean(cell) : clean(cell?.snippet ?? cell?.text ?? cell?.title)))
            .filter(Boolean)
        })
        .filter((row) => row.length)
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    const text = clean(block?.snippet ?? block?.code ?? block?.text)
    if (!text) continue
    blocks.push({ type: type === 'heading' ? 'heading' : type === 'code' ? 'code' : 'paragraph', text })
  }
  return blocks
}

/** Plain-text answer used when Gemini returns prose without usable blocks. */
function markdownToText(markdown) {
  return String(markdown ?? '')
    .split(/\n#{1,6}\s*references\s*\n/i)[0]
    .replace(/\[\d+\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]+/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function toFollowUps(data) {
  const raw = data.follow_up_questions ?? data.related_questions ?? data.suggested_questions ?? data.follow_ups
  return (Array.isArray(raw) ? raw : [])
    .map((item) => (typeof item === 'string' ? item : (item?.question ?? item?.snippet ?? item?.text)))
    .map((text) => clean(text))
    .filter(Boolean)
    .slice(0, 2)
}

function toReferences(data) {
  return (Array.isArray(data.references) ? data.references : [])
    .filter((ref) => /^https?:\/\//.test(String(ref?.link ?? '')))
    .slice(0, REFERENCE_LIMIT)
    .map((ref) => ({
      title: clean(ref.title) || clean(ref.source) || String(ref.link),
      source: clean(ref.source) || clean(ref.link).replace(/^https?:\/\//, '').split('/')[0],
      snippet: clean(ref.snippet),
      link: String(ref.link),
    }))
}

const cache = new Map()

async function askGemini(query, context, token, key) {
  const target = new URL('https://serpapi.com/search.json')
  target.searchParams.set('engine', 'google_gemini')
  // The persona rides on the opening turn and stays in the thread afterwards.
  target.searchParams.set('q', prompt(query, context, !token))
  target.searchParams.set('api_key', key)
  // Gemini only keeps a conversation briefly; a stale token restarts the thread.
  if (token) target.searchParams.set('subsequent_request_token', token)
  const response = await fetch(target, { signal: AbortSignal.timeout(30000) })
  return response.json()
}

/**
 * Resolve one assistant request. Returns { status, body } and never throws, so
 * every host adapter (Vite middleware, Node server, serverless function) can
 * share the same validation, caching and error shape.
 */
export async function answerAssist({ query, token, key, context }) {
  const question = String(query ?? '').trim().slice(0, 400)
  if (!question) return { status: 400, body: { error: 'ASK SOMETHING FIRST' } }
  if (!key) return { status: 503, body: { error: 'SERPAPI_KEY IS MISSING FROM .env' } }

  const thread = String(token ?? '').trim().slice(0, 4096) || null
  const live = String(context ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200)
  const cacheKey = `${thread ?? ''}|${live}|${question.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) return { status: 200, body: cached.body }

  try {
    let data = await askGemini(question, live, thread, key)
    // An expired or rejected token must not kill the chat: retry as a fresh question.
    if (data?.error && thread) data = await askGemini(question, live, null, key)
    if (data?.error) return { status: 502, body: { error: String(data.error).toUpperCase().slice(0, 160) } }

    const blocks = toBlocks(data.text_blocks)
    const body = {
      query: question,
      blocks,
      answer: blocks.length ? null : markdownToText(data.reconstructed_markdown) || null,
      results: toReferences(data),
      followUps: toFollowUps(data),
      token: typeof data.subsequent_request_token === 'string' ? data.subsequent_request_token : null,
    }
    cache.set(cacheKey, { at: Date.now(), body })
    return { status: 200, body }
  } catch (error) {
    return { status: 502, body: { error: `LINK FAILED: ${error?.message ?? 'UNKNOWN'}`.toUpperCase().slice(0, 120) } }
  }
}
