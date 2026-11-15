/** Browser side of the multiplayer room relay (server/rooms.js). */

export interface NetPlayer {
  id: number
  name: string
  color: string
}

export type NetStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'closed'

type ServerMessage =
  | { t: 'joined'; code: string; you: number; host: number; players: NetPlayer[]; started: boolean }
  | { t: 'players'; players: NetPlayer[]; host: number; started: boolean }
  | { t: 'msg'; from: number; d: unknown }
  | { t: 'started' }
  | { t: 'error'; error: string }
  | { t: 'closed'; reason: string }

const NAME_KEY = 'cosmos-reborn-name'

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export class Net {
  status: NetStatus = 'idle'
  code = ''
  you = 0
  hostId = 0
  players: NetPlayer[] = []
  error = ''
  /** Set when the room was already running when we joined. */
  lateJoin = false
  onMessage: ((from: number, data: unknown) => void) | null = null
  onStarted: (() => void) | null = null
  onPlayers: ((joined: NetPlayer[], left: NetPlayer[]) => void) | null = null
  onClosed: ((reason: string) => void) | null = null

  private ws: WebSocket | null = null
  private listeners = new Set<() => void>()
  private pending: Record<string, unknown> | null = null

  get isHost(): boolean {
    return this.status !== 'idle' && this.you === this.hostId
  }

  get active(): boolean {
    return this.status === 'lobby' || this.status === 'playing'
  }

  /** True while connected to a room as a guest (the host's world is the source of truth). */
  get isGuest(): boolean {
    return this.active && !this.isHost
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    for (const fn of this.listeners) fn()
  }

  private connect(first: Record<string, unknown>): void {
    this.leave(false)
    this.error = ''
    this.status = 'connecting'
    this.pending = first
    this.changed()
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/api/rooms`)
    this.ws = ws
    ws.onopen = () => {
      if (this.pending) ws.send(JSON.stringify(this.pending))
      this.pending = null
    }
    ws.onmessage = (e) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(String(e.data)) as ServerMessage
      } catch {
        return
      }
      this.receive(msg)
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.status === 'connecting') this.error = 'COULD NOT REACH THE GAME SERVER'
      const wasActive = this.active
      this.status = 'closed'
      this.changed()
      if (wasActive) this.onClosed?.('LOST CONNECTION TO THE GAME')
    }
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case 'joined':
        this.code = msg.code
        this.you = msg.you
        this.hostId = msg.host
        this.players = msg.players
        this.lateJoin = msg.started
        this.status = msg.started ? 'playing' : 'lobby'
        this.changed()
        if (msg.started && msg.you !== msg.host) this.onStarted?.()
        break
      case 'players': {
        const before = new Map(this.players.map((p) => [p.id, p]))
        const after = new Map(msg.players.map((p) => [p.id, p]))
        const joined = msg.players.filter((p) => !before.has(p.id))
        const left = this.players.filter((p) => !after.has(p.id))
        this.players = msg.players
        this.hostId = msg.host
        this.changed()
        if (joined.length || left.length) this.onPlayers?.(joined, left)
        break
      }
      case 'started':
        this.status = 'playing'
        this.changed()
        this.onStarted?.()
        break
      case 'msg':
        this.onMessage?.(msg.from, msg.d)
        break
      case 'error':
        this.error = msg.error
        if (!this.code) this.status = 'idle'
        this.changed()
        break
      case 'closed':
        this.status = 'closed'
        this.error = msg.reason
        this.code = ''
        this.changed()
        this.onClosed?.(msg.reason)
        break
    }
  }

  private remember(name: string): void {
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      /* optional */
    }
  }

  host(name: string): void {
    this.remember(name)
    this.connect({ t: 'host', name })
  }

  join(code: string, name: string): void {
    this.remember(name)
    this.connect({ t: 'join', code: code.toUpperCase().trim(), name })
  }

  start(): void {
    if (this.isHost) this.ws?.send(JSON.stringify({ t: 'start' }))
  }

  /** Sends to everyone else in the room, to the host ('host'), or to one player id. */
  send(data: unknown, to?: number | 'host'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ t: 'send', d: data, ...(to !== undefined ? { to } : {}) }))
  }

  leave(notify = true): void {
    const ws = this.ws
    this.ws = null
    if (ws) ws.close()
    this.status = 'idle'
    this.code = ''
    this.players = []
    this.you = 0
    this.hostId = 0
    this.lateJoin = false
    if (notify) this.changed()
  }

  nameOf(id: number): string {
    return this.players.find((p) => p.id === id)?.name ?? 'PLAYER'
  }

  colorOf(id: number): string {
    return this.players.find((p) => p.id === id)?.color ?? '#e6e6ee'
  }
}
