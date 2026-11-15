import { readFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { answerAssist } from './server/assist.js'
import { speak } from './server/tts.js'

/**
 * Production host for Cosmos Reborn: serves the built game from dist/ and the
 * MOONLINK assistant on /api/assist, with SERPAPI_KEY read from the environment.
 * Deployed to Render via render.yaml; `npm start` runs the same thing locally.
 */

// Minimal .env support for local runs; hosted environments inject real env vars.
function loadDotEnv() {
  const file = resolve('.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/.exec(line)
    if (!match) continue
    const [, name, raw = ''] = match
    if (process.env[name]) continue
    process.env[name] = raw.replace(/^(['"])([\s\S]*)\1$/, '$2').trim()
  }
}

loadDotEnv()

const PORT = Number(process.env.PORT) || 3000
const DIST = resolve('dist')
const API_KEY = process.env.SERPAPI_KEY

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function serveFile(res, path, status = 200) {
  try {
    const body = await readFile(path)
    const ext = extname(path)
    const hashed = path.includes(`${sep}assets${sep}`)
    res.writeHead(status, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(body)
    return true
  } catch {
    return false
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (url.pathname === '/api/assist') {
    if (req.method !== 'GET') return json(res, 405, { error: 'USE GET' })
    const { status, body } = await answerAssist({
      query: url.searchParams.get('q'),
      token: url.searchParams.get('token'),
      context: url.searchParams.get('ctx'),
      key: API_KEY,
    })
    return json(res, status, body)
  }

  if (url.pathname === '/api/tts') {
    if (req.method !== 'GET') return json(res, 405, { error: 'USE GET' })
    const result = await speak({
      text: url.searchParams.get('text'),
      voice: url.searchParams.get('voice'),
      key: process.env.ELEVENLABS_API_KEY,
      ip: String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0],
    })
    if (result.audio) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800' })
      return res.end(result.audio)
    }
    return json(res, result.status, result.json)
  }

  if (url.pathname === '/healthz') return json(res, 200, { ok: true })

  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'USE GET' })

  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  const target = join(DIST, requested)
  if (extname(target)) {
    if (target.startsWith(DIST) && (await serveFile(res, target))) return
    // A missing hashed asset must not be answered with the app shell.
    return json(res, 404, { error: 'NOT FOUND' })
  }

  // Single-page app: unknown routes fall back to index.html.
  if (await serveFile(res, join(DIST, 'index.html'))) return
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('dist/ is missing. Run `npm run build` first.')
})

server.listen(PORT, () => {
  const mode = API_KEY ? 'MOONLINK online' : 'MOONLINK offline (SERPAPI_KEY not set)'
  console.log(`Cosmos Reborn on http://localhost:${PORT} — ${mode}`)
})
