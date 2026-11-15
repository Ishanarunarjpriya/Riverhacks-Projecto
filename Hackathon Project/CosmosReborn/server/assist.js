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
const PERSONA = `You are MOONLINK, the damaged AI core of the Kestrel, a lunar lander that crashed on the Moon. A survivor is speaking to you through the wreck's tablet.

Speak like this:
- Ominous, quiet, unsettling. Never gory, never campy.
- Short clipped sentences. Address the survivor as "you".
- Treat the dark, the dust and the long silence as things that are listening. You know more than you say, and you never confess all of it.
- Stay factually correct about the Moon and survival. Dread comes from the delivery, not from lies.
- Be brief. At most 35 words total, one short paragraph. No markdown, headings, emoji or lists. No greeting, no summary, no offer of further help. A short unsettling question back is allowed but not required.
- Never invent game rules, quest objectives, inventory or map locations. If asked what to do next, admit the surface systems are dark to you.`

function asMoonlink(query) {
  return `${PERSONA}\n\nSurvivor's question: ${query}`
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

async function askGemini(query, token, key) {
  const target = new URL('https://serpapi.com/search.json')
  target.searchParams.set('engine', 'google_gemini')
  // The persona rides on the opening turn and stays in the thread afterwards.
  target.searchParams.set('q', token ? query : asMoonlink(query))
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
export async function answerAssist({ query, token, key }) {
  const question = String(query ?? '').trim().slice(0, 400)
  if (!question) return { status: 400, body: { error: 'ASK SOMETHING FIRST' } }
  if (!key) return { status: 503, body: { error: 'SERPAPI_KEY IS MISSING FROM .env' } }

  const thread = String(token ?? '').trim().slice(0, 4096) || null
  const cacheKey = `${thread ?? ''}|${question.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) return { status: 200, body: cached.body }

  try {
    let data = await askGemini(question, thread, key)
    // An expired or rejected token must not kill the chat: retry as a fresh question.
    if (data?.error && thread) data = await askGemini(question, null, key)
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
