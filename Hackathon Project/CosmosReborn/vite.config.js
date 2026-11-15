import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const CACHE_TTL = 10 * 60 * 1000

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }

function clean(value) {
  if (!value) return ''
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|quot|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

const REFERENCE_LIMIT = 6

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
          return cells.map((cell) => (typeof cell === 'string' ? clean(cell) : clean(cell?.snippet ?? cell?.text ?? cell?.title))).filter(Boolean)
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
    .map((item) => (typeof item === 'string' ? item : item?.question ?? item?.snippet ?? item?.text))
    .map((text) => clean(text))
    .filter(Boolean)
    .slice(0, 3)
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

/**
 * Serves GET /api/assist?q=...&token=... by calling SerpApi's Google Gemini engine
 * from the Node side. The key lives in .env (SERPAPI_KEY) and never reaches the browser.
 * Passing the previous subsequent_request_token keeps the conversation going.
 */
function serpAssistant(env) {
  const key = env.SERPAPI_KEY
  const cache = new Map()

  const askGemini = async (query, token) => {
    const target = new URL('https://serpapi.com/search.json')
    target.searchParams.set('engine', 'google_gemini')
    target.searchParams.set('q', query)
    target.searchParams.set('api_key', key)
    // Gemini only keeps a conversation briefly; a stale token restarts the thread.
    if (token) target.searchParams.set('subsequent_request_token', token)
    const response = await fetch(target, { signal: AbortSignal.timeout(30000) })
    return response.json()
  }

  const middleware = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/assist') return next()

    const send = (status, body) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(body))
    }

    if (req.method !== 'GET') return send(405, { error: 'USE GET' })
    const query = (url.searchParams.get('q') ?? '').trim().slice(0, 400)
    if (!query) return send(400, { error: 'ASK SOMETHING FIRST' })
    if (!key) return send(503, { error: 'SERPAPI_KEY IS MISSING FROM .env' })

    const token = (url.searchParams.get('token') ?? '').trim().slice(0, 4096) || null
    const cacheKey = `${token ?? ''}|${query.toLowerCase()}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.at < CACHE_TTL) return send(200, cached.body)

    try {
      let data = await askGemini(query, token)
      // An expired or rejected token must not kill the chat: retry as a fresh question.
      if (data?.error && token) data = await askGemini(query, null)
      if (data?.error) return send(502, { error: String(data.error).toUpperCase().slice(0, 160) })

      const blocks = toBlocks(data.text_blocks)
      const body = {
        query,
        blocks,
        answer: blocks.length ? null : markdownToText(data.reconstructed_markdown) || null,
        results: toReferences(data),
        followUps: toFollowUps(data),
        token: typeof data.subsequent_request_token === 'string' ? data.subsequent_request_token : null,
      }
      cache.set(cacheKey, { at: Date.now(), body })
      send(200, body)
    } catch (error) {
      send(502, { error: `LINK FAILED: ${error?.message ?? 'UNKNOWN'}`.toUpperCase().slice(0, 120) })
    }
  }

  return {
    name: 'gemini-assistant',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), serpAssistant(env)],
  }
})
