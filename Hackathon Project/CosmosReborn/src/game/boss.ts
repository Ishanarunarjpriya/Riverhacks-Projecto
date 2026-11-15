import { BlockGrid } from './blocks'
import { createRng } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import type { Boulder, World } from './world'

export type BossKind = 'jelly' | 'alien'

export const ARENA_RADIUS = 30
export const ARENA_SPAWN = { x: 0, z: -12 } as const
export const MELEE_RANGE = 5

export interface ShockRing {
  r: number
  hit: boolean
}

export interface Orb {
  x: number
  z: number
  y: number
  vx: number
  vz: number
  life: number
}

export interface Boss {
  kind: BossKind
  name: string
  x: number
  z: number
  y: number
  hp: number
  maxHp: number
  state: 'move' | 'attack' | 'stunned' | 'dead'
  timer: number
  volleys: number
  rings: ShockRing[]
  orbs: Orb[]
  hitFlash: number
  anomalyId: string
}

export const BOSS_INFO: Record<BossKind, { name: string; hp: number; intro: string; outro: string }> = {
  jelly: {
    name: 'THE DRIFT MOTHER',
    hp: 6,
    intro: 'SOMETHING ENORMOUS UNFOLDS ABOVE YOU. JUMP OVER ITS SHOCKWAVES. HIT IT WHEN IT SINKS LOW.',
    outro: 'THE DRIFT MOTHER COLLAPSES INTO LIGHT. THE SHARDS IT LEAVES ARE STILL WARM.',
  },
  alien: {
    name: 'THE WATCHER',
    hp: 8,
    intro: 'A TALL FIGURE STEPS OUT OF THE CRYSTAL. DODGE ITS ORBS. WHEN IT OVERHEATS AND KNEELS, STRIKE.',
    outro: 'THE WATCHER KNEELS ONE LAST TIME. IT TOUCHES YOUR FACE, WHERE A HELMET SHOULD BE, AND FADES.',
  },
}

export function createBoss(kind: BossKind, anomalyId: string): Boss {
  const info = BOSS_INFO[kind]
  return {
    kind,
    name: info.name,
    x: 0,
    z: 12,
    y: kind === 'jelly' ? 7 : 0,
    hp: info.hp,
    maxHp: info.hp,
    state: 'move',
    timer: 2.5,
    volleys: 0,
    rings: [],
    orbs: [],
    hitFlash: 0,
    anomalyId,
  }
}

export function createArenaWorld(): World {
  const rng = createRng(61)
  const boulders: Boulder[] = []
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    const r = ARENA_RADIUS + 3 + rng() * 3
    boulders.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 1.4 + rng(), height: 7 + rng() * 9, yaw: rng() * Math.PI, hp: 999, broken: false, shake: 0 })
  }
  const pebbles = Array.from({ length: 300 }, () => {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * ARENA_RADIUS
    return { x: Math.cos(a) * r, z: Math.sin(a) * r }
  })
  return { craters: [], pits: [], pebbles, boulders, structures: [], pickups: [], gardens: [], blocks: new BlockGrid() }
}

export function clampToArena(x: number, z: number): [number, number] {
  const d = Math.hypot(x, z)
  if (d <= ARENA_RADIUS) return [x, z]
  return [(x / d) * ARENA_RADIUS, (z / d) * ARENA_RADIUS]
}

export interface BossEvents {
  hurtPlayer: number
  sound: 'rumble' | 'enemyShoot' | 'warning' | null
}

export function updateBoss(b: Boss, dt: number, px: number, pz: number, playerGrounded: boolean): BossEvents {
  const ev: BossEvents = { hurtPlayer: 0, sound: null }
  b.hitFlash = Math.max(0, b.hitFlash - dt)
  if (b.state === 'dead') {
    b.y = Math.max(0, b.y - dt * 3)
    return ev
  }
  b.timer -= dt
  const dx = px - b.x
  const dz = pz - b.z
  const dist = Math.hypot(dx, dz) || 1

  for (const ring of b.rings) {
    ring.r += 14 * dt
    const pd = Math.hypot(px - b.x, pz - b.z)
    if (!ring.hit && playerGrounded && Math.abs(pd - ring.r) < 1.1) {
      ring.hit = true
      ev.hurtPlayer += 15
    }
  }
  b.rings = b.rings.filter((r) => r.r < ARENA_RADIUS + 4)

  for (const o of b.orbs) {
    o.x += o.vx * dt
    o.z += o.vz * dt
    o.life -= dt
    if (o.life > 0 && Math.hypot(px - o.x, pz - o.z) < 1.3 && o.y > 0) {
      o.life = 0
      ev.hurtPlayer += 12
    }
  }
  b.orbs = b.orbs.filter((o) => o.life > 0 && Math.hypot(o.x, o.z) < ARENA_RADIUS + 6)

  if (b.kind === 'jelly') {
    if (b.state === 'move') {
      b.y += (7 - b.y) * Math.min(1, dt * 2)
      b.x += (dx / dist) * Math.min(dist, 5 * dt)
      b.z += (dz / dist) * Math.min(dist, 5 * dt)
      if (b.timer <= 0) {
        b.state = 'attack'
        b.timer = 0.7
      }
    } else if (b.state === 'attack') {
      b.y = Math.max(0.6, b.y - dt * 12)
      if (b.timer <= 0) {
        b.rings.push({ r: 0.5, hit: false })
        ev.sound = 'rumble'
        b.state = 'stunned'
        b.timer = 2.6
      }
    } else if (b.state === 'stunned' && b.timer <= 0) {
      b.state = 'move'
      b.timer = 3 + Math.random() * 1.5
    }
    return ev
  }

  if (b.state === 'move') {
    if (dist > 11) {
      b.x += (dx / dist) * 6 * dt
      b.z += (dz / dist) * 6 * dt
    } else {
      b.x -= (dz / dist) * 4 * dt
      b.z += (dx / dist) * 4 * dt
    }
    if (b.timer <= 0) {
      const base = Math.atan2(dx, dz)
      for (let i = -2; i <= 2; i++) {
        const a = base + i * 0.22
        b.orbs.push({ x: b.x, z: b.z, y: 1.8, vx: Math.sin(a) * 16, vz: Math.cos(a) * 16, life: 3 })
      }
      ev.sound = 'enemyShoot'
      b.volleys++
      if (b.volleys >= 3) {
        b.volleys = 0
        b.state = 'stunned'
        b.timer = 3.2
        ev.sound = 'warning'
      } else {
        b.timer = 1.3
      }
    }
  } else if (b.state === 'stunned' && b.timer <= 0) {
    b.state = 'move'
    b.timer = 1.6
  }
  return ev
}

export function bossVulnerable(b: Boss): boolean {
  return b.state === 'stunned'
}

export function drawBoss(ctx: Ctx, b: Boss, sx: number, sy: number, scale: number, time: number): void {
  const s = Math.min(1.8, Math.max(0.6, scale / 3))
  const lift = b.y * scale
  const flash = b.hitFlash > 0
  const fade = b.state === 'dead' ? 0.5 : 1
  ctx.globalAlpha = fade
  if (b.kind === 'jelly') {
    const pulse = Math.sin(time * 3) * 0.08
    const w = 16 * s * (1 + pulse)
    const h = 10 * s * (1 - pulse)
    const cy = sy - lift - h
    for (let i = -3; i <= 3; i++) {
      const tx = sx + i * w * 0.25
      const len = (10 + Math.sin(time * 4 + i) * 3) * s
      for (let k = 0; k < len; k += Math.max(1, s)) rect(ctx, k % 3 < 1.5 ? '#c9a6ff' : '#7c6fb0', tx + Math.sin(time * 3 + k * 0.3 + i) * 1.5 * s, cy + h * 0.5 + k, Math.max(1, s * 0.8), Math.max(1, s))
    }
    ellipse(ctx, flash ? '#ffffff' : '#7c6fb0', sx, cy, w, h, true)
    ellipse(ctx, flash ? '#ffffff' : '#d6b8ff', sx, cy - 1, w * 0.85, h * 0.8, true)
    ellipse(ctx, '#efe3ff', sx - w * 0.3, cy - h * 0.5, w * 0.18, h * 0.18)
    rect(ctx, b.state === 'stunned' ? '#fac775' : '#5b4a8a', sx - w * 0.5, cy - h * 0.15, w, Math.max(1, s))
  } else {
    const kneel = b.state === 'stunned'
    const top = sy - (kneel ? 18 : 26) * s
    rect(ctx, '#3f4878', sx - 3 * s, sy - (kneel ? 6 : 10) * s, 2 * s, (kneel ? 6 : 10) * s)
    rect(ctx, '#3f4878', sx + 1 * s, sy - (kneel ? 6 : 10) * s, 2 * s, (kneel ? 6 : 10) * s)
    rect(ctx, flash ? '#ffffff' : '#9fb4c8', sx - 4 * s, top + 8 * s, 8 * s, (kneel ? 6 : 9) * s)
    rect(ctx, flash ? '#ffffff' : '#9fb4c8', sx - 6 * s, top + 9 * s, 2 * s, 8 * s)
    rect(ctx, flash ? '#ffffff' : '#9fb4c8', sx + 4 * s, top + 9 * s, 2 * s, 8 * s)
    ellipse(ctx, flash ? '#ffffff' : '#c8d8e8', sx, top + 4 * s, 5 * s, 5 * s)
    const eye = kneel ? '#fac775' : Math.sin(time * 6) > 0 ? '#5dcaa5' : '#16182c'
    ellipse(ctx, eye, sx - 2 * s, top + 4 * s, 1.6 * s, 2.2 * s)
    ellipse(ctx, eye, sx + 2 * s, top + 4 * s, 1.6 * s, 2.2 * s)
    if (kneel) for (let i = 0; i < 3; i++) rect(ctx, '#ff9f5a', sx - 4 * s + Math.random() * 8 * s, top - Math.random() * 4 * s, 1, 1)
  }
  ctx.globalAlpha = 1
}
