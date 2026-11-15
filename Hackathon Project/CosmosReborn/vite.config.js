import { attachRooms } from './server/rooms.js'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { answerAssist } from './server/assist.js'
import { getEarthRotation } from './server/earth.js'
import { transcribe } from './server/stt.js'
import { speak } from './server/tts.js'

const MAX_AUDIO = 2.5 * 1024 * 1024

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        tooLarge = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => (tooLarge ? reject(new Error('AUDIO TOO LARGE')) : resolve(Buffer.concat(chunks))))
    req.on('error', reject)
  })
}

/**
 * Dev/preview only. In production the same handler is served by server.js, so the
 * SerpApi key is read from the environment on whichever host runs the server.
 */
function geminiAssistant(env) {
  const key = env.SERPAPI_KEY || process.env.SERPAPI_KEY

  const middleware = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/api/earth') {
      const body = await getEarthRotation()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=1800')
      return res.end(JSON.stringify(body))
    }
    if (url.pathname === '/api/stt') {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'USE POST' }))
      }
      let audio
      try {
        audio = await readBody(req, MAX_AUDIO)
      } catch {
        res.statusCode = 413
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'AUDIO TOO LARGE' }))
      }
      const result = await transcribe({
        audio,
        type: req.headers['content-type'],
        key: env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY,
        ip: req.socket.remoteAddress ?? 'unknown',
      })
      res.statusCode = result.status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(JSON.stringify(result.json))
    }

    if (url.pathname === '/api/tts') {
      const result = await speak({ text: url.searchParams.get('text'), voice: url.searchParams.get('voice'), key: env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY })
      if (result.audio) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'audio/mpeg')
        return res.end(result.audio)
      }
      res.statusCode = result.status
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(result.json))
    }
    if (url.pathname !== '/api/assist') return next()

    const send = (status, body) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(body))
    }

    if (req.method !== 'GET') return send(405, { error: 'USE GET' })
    const { status, body } = await answerAssist({
      query: url.searchParams.get('q'),
      token: url.searchParams.get('token'),
      context: url.searchParams.get('ctx'),
      key,
    })
    send(status, body)
  }

  return {
    name: 'gemini-assistant',
    configureServer(server) {
      server.middlewares.use(middleware)
      if (server.httpServer) attachRooms(server.httpServer)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
      if (server.httpServer) attachRooms(server.httpServer)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), geminiAssistant(env)],
  }
})
