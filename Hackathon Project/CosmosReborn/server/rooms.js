import { WebSocketServer } from 'ws'

/**
 * Multiplayer rooms for Cosmos Reborn. One player hosts and gets a 4-letter code,
 * up to 3 friends join with it. The server only relays messages between players
 * in the same room; the host's game is the source of truth for the shared world.
 *
 * Client → server: {t:'host', name} | {t:'join', code, name} | {t:'send', to?, d} | {t:'start'}
 * Server → client: {t:'joined', code, you, host, players} | {t:'players', players, host}
 *                  {t:'msg', from, d} | {t:'started'} | {t:'error', error} | {t:'closed', reason}
 */

export const ROOM_PATH = '/api/rooms'
const MAX_PLAYERS = 4
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const COLORS = ['#7fb2ff', '#fac775', '#5dcaa5', '#ff8a7a']

const rooms = new Map()
let nextId = 1

function makeCode() {
  for (let tries = 0; tries < 50; tries++) {
    let code = ''
    for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)]
    if (!rooms.has(code)) return code
  }
  return null
}

function cleanName(name, fallback) {
  const n = String(name ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 12)
  return n || fallback
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
}

function roster(room) {
  return [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color }))
}

function broadcastRoster(room) {
  const players = roster(room)
  for (const p of room.players.values()) send(p.ws, { t: 'players', players, host: room.hostId, started: room.started })
}

function freeColor(room) {
  const used = new Set([...room.players.values()].map((p) => p.color))
  return COLORS.find((c) => !used.has(c)) ?? COLORS[0]
}

function leave(player) {
  const room = player.room
  if (!room) return
  player.room = null
  room.players.delete(player.id)
  if (player.id === room.hostId) {
    for (const p of room.players.values()) {
      p.room = null
      send(p.ws, { t: 'closed', reason: 'THE HOST LEFT THE GAME' })
    }
    rooms.delete(room.code)
    return
  }
  if (room.players.size === 0) rooms.delete(room.code)
  else broadcastRoster(room)
}

function handle(player, msg) {
  if (!msg || typeof msg !== 'object') return
  if (msg.t === 'host') {
    leave(player)
    const code = makeCode()
    if (!code) return send(player.ws, { t: 'error', error: 'NO ROOMS FREE, TRY AGAIN' })
    player.name = cleanName(msg.name, 'HOST')
    player.color = COLORS[0]
    const room = { code, hostId: player.id, players: new Map([[player.id, player]]), started: false }
    rooms.set(code, room)
    player.room = room
    send(player.ws, { t: 'joined', code, you: player.id, host: player.id, players: roster(room), started: false })
    return
  }
  if (msg.t === 'join') {
    leave(player)
    const code = String(msg.code ?? '').toUpperCase().trim()
    const room = rooms.get(code)
    if (!room) return send(player.ws, { t: 'error', error: `NO GAME WITH CODE ${code || '----'}` })
    if (room.players.size >= MAX_PLAYERS) return send(player.ws, { t: 'error', error: 'THAT GAME IS FULL (4 PLAYERS)' })
    player.name = cleanName(msg.name, `PLAYER ${room.players.size + 1}`)
    player.color = freeColor(room)
    room.players.set(player.id, player)
    player.room = room
    send(player.ws, { t: 'joined', code, you: player.id, host: room.hostId, players: roster(room), started: room.started })
    broadcastRoster(room)
    return
  }
  const room = player.room
  if (!room) return
  if (msg.t === 'start' && player.id === room.hostId) {
    room.started = true
    for (const p of room.players.values()) send(p.ws, { t: 'started' })
    return
  }
  if (msg.t === 'send') {
    const out = { t: 'msg', from: player.id, d: msg.d }
    const to = msg.to === 'host' ? room.hostId : msg.to
    if (to !== undefined && to !== null) {
      const target = room.players.get(to)
      if (target) send(target.ws, out)
      return
    }
    for (const p of room.players.values()) if (p.id !== player.id) send(p.ws, out)
  }
}

/** Attaches the room relay to an http server (production server.js or Vite's dev server). */
export function attachRooms(httpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 })
  httpServer.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0]
    if (path !== ROOM_PATH) return
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
  })
  wss.on('connection', (ws) => {
    const player = { id: nextId++, name: '', color: COLORS[0], ws, room: null, alive: true }
    ws.on('pong', () => (player.alive = true))
    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }
      handle(player, msg)
    })
    ws.on('close', () => leave(player))
    ws.on('error', () => leave(player))
    player.ping = setInterval(() => {
      if (!player.alive) return ws.terminate()
      player.alive = false
      ws.ping()
    }, 25_000)
    ws.on('close', () => clearInterval(player.ping))
  })
  return wss
}
