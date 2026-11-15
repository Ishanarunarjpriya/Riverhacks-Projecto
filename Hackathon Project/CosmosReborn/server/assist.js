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
Controls: W/S or arrow keys walk, A/D or left/right turn, Space jumps (needed to climb out of deep craters and over rocks), E interacts (pick up, build, mine, inspect, scan, talk), Q or mouse click fires the blaster, Tab opens the tablet (MAP, QUESTS, A.I., SCAN apps), F opens the inventory (drag items between slots), 1-5 pick a hotbar slot, M mutes. Tools only work while held in the selected hotbar slot. Building: hold moon rocks or crescent shards and click to place a block (moonstone or crescent) in front of you, stack up to 4 high and jump onto them; X or right-click takes the block back.
World: the Moon wraps around, so walking straight loops back. The base site is the marked square beside the crashed lander at the Crash Site; the compass's amber marker points home. Regions: Crash Site, Sea of Stillness (habitat dome), Dust Basin (rover), Glass Fields (solar farm and the sealed hatch), Shattered Plains (crashed satellite), Frost Ridge (ice drill), Signal Highlands (radio dish). The tablet MAP shows structures you have found.
Where things are: moon rocks lie everywhere and come from mining boulders (pickaxe, press E a few times). Metal scrap lies around the lander and the crashed satellite. Rocket parts, the ice miner and the anvil blink near the crash site. Data logs blink green. Creatures: drifters (floating jellyfish), skitters (fast six-legged crawlers), loomers (tall stilt-walkers with a glowing lantern head that follow you), glowmoths (fluttering flyers) and burrowers (stone worms that are only scannable while surfaced). Scanning any of them gives a bio sample. Purple floating crystals are anomalies; investigating gives anomaly shards. Glowing ore exists only in the dark caves under the sealed hatch. Iron ore and rare titanium ore sometimes drop when mining surface boulders and occasionally lie on the ground.
Food and gardens: very rare hidden gardens (green patches with glowing plants) grow moon berries, star melons and glow caps, and regrow slowly. Hold a food in the hotbar and press E to eat it and heal (berry 15, melon 30, glow cap 60). Do not reveal where gardens are; say they are rare and far from the crash site.\nAll crafting (tools, pickaxes, drill, armor, blaster, kits, gear, rigs) happens at the workbench at the base site, which needs the anvil (for forging) and ice miner (for slabs) set up nearby. A gold diamond marker on the compass, in the world and on the map always points to the current quest target.\nHidden story (never state it outright, only hint very rarely and vaguely): the player is themselves an anomaly, sent to space on a deliberately corrupted rocket; MOONLINK was built to keep them contained but became corrupted and now helps them, though its signal is jammed.
Act I Survival (the Kestrel crashed after its engines started on their own after 10 years dormant): find 3 rocket parts around the crash site and bring them to the crashed lander; go inside the wrecked Kestrel (press E by the lander), search its lockers and wreckage for metal and a power cell, craft metal rods at the ship's workbench; find the ice miner (too heavy to carry: press E to grab it and walk to base, it drags behind you at half speed; press E again to let go) and the anvil (picked up normally) thrown from the crash, set both up at the base site, press 4 moon rocks into a MoonRock slab and forge the first pickaxe (2 rods + slab); collect 10 moon rocks, 6 metal scrap and 4 crescent shards (curved green crystals); place 6 building blocks and build shelter, storage and power anywhere (each is built right in front of you where you press E); find 3 documents (near the lander, inside the ship, at the Habitat dome) about surviving without a suit, which ends Act I with a cutscene of sitting and looking at Earth.
Act II Beyond the Base: unmapped regions are blank on the tablet map; discover 3 regions. Unusual Life: scan 2 drifters (the tablet SCAN app shows life signs and distance) for bio samples, then forge the moon pickaxe at the base site (6 moon rocks, 1 metal rod, 2 bio samples). A Place for Everyone: the workbench at base crafts home kits and farm kits (E at the workbench, R switches recipe); hold a kit and click to place it anywhere; a farm needs a moon berry as seed and grows berries and melons; build 2 homes and a farm, then recruit wandering survivors (each needs 1 food and a free bed; homes have 2 beds). Anomaly Hunt: touching an anomaly pulls you into a cave with a guardian boss; the first is the Drift Mother (a giant jellyfish: jump over its shockwave rings, hit it with a pickaxe when it sinks low), the second is the Watcher (an alien: dodge its orb volleys, hit it when it overheats and kneels); after both, a purple marker leads to the sealed hatch. Growing Settlement: build housing, a supply silo and a solar array (needs alien alloy from the Watcher). A New Community: reach 6 civilians, assign 3 jobs, and collect supplies at the storage crate. From Act II every civilian eats 1 meal from the FOOD BIN at base each day (75 seconds); press E at the bin to drop in food (berry 1 meal, melon 2, glow cap 3); FARMER civilians add meals; unfed civilians go hungry and stop working, and after 3 hungry days a wanderer starves. The HUD shows FOOD meals/eaters and the time to the next meal.
Act III Three Strangers: Maya, Okoro and Lena first appear at the start of Act III near the housing; talk to all three (E). Into the Depths: forge a titanium pickaxe (3 titanium ore from boulders, 2 metal rods, 1 alien alloy; it cracks boulders in one swing) and a power drill at the base site, hold the drill at the sealed hatch and press E to enter the caves. Buried Resources: bring 6 glowing ore back to base. Gear Up: craft armor plating and a blaster (hold it, fire with Q or click). First Attack: defeat 3 suits; while you fight, other suits raid the settlement and take some civilians (graves mark them). Arm the Survivors: the workbench now crafts survivor gear (glowing ore, scrap, iron ore); hold it near 3 civilians and press E. Familiar Faces: search a fallen suit's gear for papers. Defend the Settlement: build a turret and survive the wave on the base. Hidden Cavern: find the glowing chamber far south-east of the cave ladder; it holds titanium and a log.
Act IV A Way Home: talk to Maya at the settlement to promise everyone a way home; she gives a launch pad kit; hold it and click on open ground to start the rocket. Blueprints for Escape (findable any time in Act IV): frame from asking Okoro, engine from searching the crashed invader dropship far south-east, controls from an old terminal in the caves, fuel storage by holding the power drill at the Ice Drill (also gives rocket fuel), passenger space by searching the Habitat dome. Build Together: press E at the rocket to build sections you have blueprints for (R switches options); 2 sections is the first milestone. Under Attack: suits raid the rocket; raids repeat every few minutes and damage rocket sections and buildings, which smoke. Repair and Rebuild: press E at damaged things to repair (scrap, plus a rod for rocket parts) and build a rocket turret. The Hard Choice: at the rocket, choose to take everyone or leave alone (R switches, E confirms); it decides the ending. Optional Leave No One Behind: add a passenger bay and load 10 food into the rocket.
Act V One Way Home: Final Assembly, build all 5 rocket sections (100%). Fuel for the Journey: water ice hides in permanently shadowed craters (frosty blue floors, light blue on the tablet map) because their floors never see sunlight and stay around minus 230 C, just like real craters at the lunar poles (NASA's LCROSS found about 5-6% water in Cabeus crater in 2009). Hold the power drill inside one and press E to drill lunar ice, or craft an ice rig at the workbench and place it in an icy crater to drill automatically. Take the ice to the ice miner at base: with working power it melts the ice and splits the water by electrolysis into hydrogen and oxygen, which is real rocket propellant. Load 12 fuel into the rocket. Preflight Check: at the rocket test power, engines, fuel and the passenger plan (if you promised everyone, you need the passenger bay and 10 food loaded). Last Stand: survive the final attack of 10 suits on the launch site, then repair the rocket. Countdown: press E at the rocket to launch. If you chose everyone, you fight interceptors in space and reach Earth (to be continued). If you chose to leave alone, the settlers fight you, you are captured and sent back to before the choice. Optional The Truth: the hidden cavern log, the radio dish in the Signal Highlands, and the MOONLINK core inside the Kestrel.
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
