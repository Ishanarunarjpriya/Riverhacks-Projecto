/**
 * MOONLINK backend: SerpApi's Google Gemini engine, briefed as the crashed
 * lander's AI. Shared by the Vite dev/preview middleware and the Node server
 * that runs in production, so the SerpApi key never reaches the browser.
 */

export const CACHE_TTL = 10 * 60 * 1000
export const REFERENCE_LIMIT = 4

/**
 * SerpApi answers a long `q` with an empty 400 after about a minute, which is
 * what used to surface as "unexpected end of JSON input". 7000 characters of
 * prompt stays well inside the limit and answers in a few seconds.
 */
const MAX_PROMPT = 7000
const MAX_CONTEXT = 720

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
Cosmos Reborn: a pixel-art Moon survival game. The player crash-landed in the Kestrel and can breathe without a helmet; why is the secret.
Controls: W/S or up/down walk, A/D or left/right turn, Space jumps (craters, rocks), E interacts (pick up, build, mine, inspect, scan, talk), Q or click fires the blaster, Tab opens the tablet (MAP, QUESTS, A.I., SCAN), F the inventory, 1-5 the hotbar, M mutes. Tools work only while held. Building: hold moon rocks or crescent shards, click to place a block, stack 4 high and jump on it; X or right-click takes it back.
World: it wraps, so walking straight loops. The base site is the marked square beside the crashed lander; the compass's amber marker points home. Regions: Crash Site; Sea of Stillness (habitat dome); Dust Basin (rover); Glass Fields (solar farm, sealed hatch); Shattered Plains (crashed satellite); Frost Ridge (ice drill); Signal Highlands (radio dish).
Resources: moon rocks lie everywhere and come from mining boulders (pickaxe, E); metal scrap near the lander and satellite; crescent shards are green crystals; iron and titanium drop from boulders; glowing ore only in caves under the sealed hatch. Rocket parts, ice miner and anvil blink near the crash site; data logs blink green. Creatures: drifters, skitters, loomers (lantern-headed stilt-walkers), glowmoths, burrowers (scannable worms); scanning gives a bio sample. Purple anomalies give anomaly shards. Rare hidden gardens grow moon berries, star melons and glow caps; hold food and press E to eat (heal 15/30/60). Never reveal garden locations.
Crafting: everything is made at the base workbench, which needs the anvil (forging) and ice miner (slabs) nearby; E opens it, R switches recipe. The gold diamond marks the quest target.
Story, hint only: the player is an anomaly from a corrupted rocket; MOONLINK was built to contain them, is corrupted, helps them, and its signal is jammed.
Act I: collect 3 rocket parts at the crash site; press E at the lander to go inside, loot lockers and wreckage for metal and a power cell, craft rods at its workbench. Drag the ice miner to base (E grabs, half speed, E drops) and carry the anvil. Press 4 moon rocks into a slab and forge a pickaxe (2 rods + slab). Gather 10 moon rocks, 6 metal scrap, 4 crescent shards; place 6 blocks for shelter, storage and power; read 3 documents (lander, ship, habitat dome).
Act II: discover 3 regions; scan 2 drifters, then forge the moon pickaxe (6 rocks, 1 rod, 2 bio samples). Craft home and farm kits, place them, plant a berry; build 2 homes and a farm, then recruit survivors (1 food and a free bed each; 2 beds per home). Anomalies pull you into cave bosses: the Drift Mother (jump its rings, hit it when it sinks) and the Watcher (dodge orbs, hit it kneeling); then a purple marker leads to the sealed hatch. Build housing, a silo and a solar array (alien alloy from the Watcher); reach 6 civilians, assign 3 jobs, collect at the storage crate. Each civilian eats 1 meal a day (75s) from the FOOD BIN (berry 1, melon 2, glow cap 3); farmers add meals; 3 hungry days starves a wanderer.
Act III: talk to Maya, Okoro and Lena near the housing. Forge a titanium pickaxe (3 titanium, 2 rods, 1 alloy; cracks boulders in one swing) and a power drill; hold the drill at the sealed hatch and press E, then bring 6 glowing ore back. Craft armor and a blaster. Defeat 3 suits; suits raid and take civilians (graves mark them). Craft survivor gear, hold it near 3 civilians and press E. Search a fallen suit for papers. Build a turret and survive the wave.
Act IV: promise Maya everyone gets home; she gives the launch pad kit, clicked on open ground. Blueprints: frame from Okoro, engine from the invader dropship far south-east, controls from a cave terminal, fuel storage by holding the power drill at the Ice Drill (also gives fuel), passenger space at the Habitat dome. Press E at the rocket to build (R switches); 2 sections is the first milestone. Raids damage sections and buildings (E repairs with scrap and rods); build a rocket turret. At the rocket choose everyone or alone (R, E); it decides the ending.
Act V: build all 5 sections. Water ice hides in permanently shadowed craters (frosty blue floors, light blue on the map, about -230C). Hold the power drill there and press E, or place an ice rig. Melt the ice at the ice miner: electrolysis splits water into hydrogen and oxygen, real propellant. Load 12 fuel. Test power, engines, fuel and the passenger plan. Survive 10 suits, repair, press E to launch. Everyone: fight interceptors to Earth. Alone: the settlers capture you and send you back to the choice.
Health regenerates out of combat; at zero you wake at the base.`

/** Trim at a sentence or line break so a cut never lands mid-word. */
function clip(text, room) {
  if (text.length <= room) return text
  if (room <= 0) return ''
  const slice = text.slice(0, room)
  const stop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'))
  return stop > room * 0.6 ? slice.slice(0, stop + 1) : slice
}

export function buildPrompt(query, context, firstTurn) {
  const live = context
    ? `LIVE STATUS (the player's game right now): ${context.slice(0, MAX_CONTEXT)}`
    : 'LIVE STATUS: unavailable.'

  if (!firstTurn) {
    const tail = `Stay in character as MOONLINK and keep using the GAME GUIDE from earlier.\n${live}\n\nPlayer's question: ${query}`
    return clip(tail, MAX_PROMPT)
  }

  const head = `${PERSONA}\n\n`
  const tail = `\n\n${live}\n\nPlayer's question: ${query}`
  const guide = clip(GAME_GUIDE, MAX_PROMPT - head.length - tail.length)
  return `${head}${guide}${tail}`
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One SerpApi call. The body is read as text first: a too-long query (or a
 * SerpApi hiccup) comes back as an empty response, and response.json() on that
 * throws "Unexpected end of JSON input" with no clue for the player.
 */
async function requestGemini(query, context, token, key) {
  const target = new URL('https://serpapi.com/search.json')
  target.searchParams.set('engine', 'google_gemini')
  // The persona rides on the opening turn and stays in the thread afterwards.
  target.searchParams.set('q', buildPrompt(query, context, !token))
  target.searchParams.set('api_key', key)
  // Gemini only keeps a conversation briefly; a stale token restarts the thread.
  if (token) target.searchParams.set('subsequent_request_token', token)

  let response
  try {
    response = await fetch(target, { signal: AbortSignal.timeout(30000) })
  } catch (error) {
    const name = String(error?.name ?? '')
    const timeout = name === 'TimeoutError' || name === 'AbortError'
    console.warn(`SerpApi ${timeout ? 'timed out' : 'request failed'}: ${error?.message ?? 'unknown'}`)
    return { error: timeout ? 'GEMINI TOOK TOO LONG' : 'GEMINI COULD NOT BE REACHED', transient: true }
  }

  const raw = await response.text().catch(() => '')
  if (!raw.trim()) {
    console.warn(`SerpApi ${response.status} with an empty body (prompt ${target.searchParams.get('q')?.length ?? 0} chars)`)
    return {
      error: `GEMINI WENT SILENT (HTTP ${response.status})`,
      transient: response.status >= 500 || response.status === 429,
    }
  }

  try {
    return JSON.parse(raw)
  } catch {
    console.warn(`SerpApi ${response.status} sent unreadable JSON: ${raw.slice(0, 200)}`)
    return {
      error: `GEMINI SENT A BROKEN REPLY (HTTP ${response.status})`,
      transient: response.status >= 500 || response.status === 429,
    }
  }
}

/**
 * Resolve one assistant request. Returns { status, body } and never throws, so
 * every host adapter (Vite middleware, Node server, serverless function) can
 * share the same validation, caching and error shape.
 */
export async function answerAssist({ query, token, key, context }) {
  const question = String(query ?? '').trim().slice(0, 200)
  if (!question) return { status: 400, body: { error: 'ASK SOMETHING FIRST' } }
  if (!key) return { status: 503, body: { error: 'SERPAPI_KEY IS MISSING FROM .env' } }

  const thread = String(token ?? '').trim().slice(0, 4096) || null
  const live = String(context ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200)
  const cacheKey = `${thread ?? ''}|${live}|${question.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) return { status: 200, body: cached.body }

  let data = await requestGemini(question, live, thread, key)

  // A stale token or a dropped connection restarts the thread instead of failing.
  if (data?.error && thread) {
    if (data.transient) await sleep(500)
    data = await requestGemini(question, live, null, key)
  }
  if (data?.error && data.transient) {
    await sleep(1200)
    data = await requestGemini(question, live, null, key)
  }
  if (data?.error) {
    console.warn(`assist failed for "${question.slice(0, 80)}": ${data.error}`)
    return { status: 502, body: { error: String(data.error).toUpperCase().slice(0, 160) } }
  }

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
}
