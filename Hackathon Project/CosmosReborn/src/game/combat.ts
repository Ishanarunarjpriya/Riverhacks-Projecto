import { wrap } from './math'
import { rect, type Ctx } from './pixel'
import { boulderAt, isSolidAt, walkBlocked, type World } from './world'

export interface Enemy {
  id: number
  x: number
  z: number
  hp: number
  maxHp: number
  heading: number
  fireTimer: number
  hitFlash: number
  strafe: number
  walkTime: number
  waveMember: boolean
}

export interface Projectile {
  x: number
  z: number
  y: number
  vx: number
  vz: number
  life: number
  friendly: boolean
  pierce?: boolean
}

export interface Wreck {
  id: number
  x: number
  z: number
  searched: boolean
}

export const PLAYER_MAX_HP = 100
export const ENEMY_HP = 3
export const ENEMY_DAMAGE = 12
export const ARMOR_REDUCTION = 0.4
export const BLASTER_COOLDOWN = 0.32
export const TURRET_RANGE = 40
export const TURRET_COOLDOWN = 0.7
export const SEARCH_RANGE = 3.5

const AGGRO_RANGE = 45
const KEEP_DISTANCE = 11
const ENEMY_SPEED = 7
const PLAYER_SHOT_SPEED = 60
const ENEMY_SHOT_SPEED = 24
const HIT_RADIUS = 1.3

let nextId = 1

export function spawnEnemy(x: number, z: number, waveMember = false): Enemy {
  return {
    id: nextId++,
    x,
    z,
    hp: ENEMY_HP,
    maxHp: ENEMY_HP,
    heading: 0,
    fireTimer: 1 + Math.random() * 1.5,
    hitFlash: 0,
    strafe: Math.random() < 0.5 ? -1 : 1,
    walkTime: 0,
    waveMember,
  }
}

export function shoot(fromX: number, fromZ: number, toX: number, toZ: number, friendly: boolean, spread = 0, muzzle = 1): Projectile {
  const angle = Math.atan2(wrap(toX - fromX), wrap(toZ - fromZ)) + (Math.random() - 0.5) * spread
  const speed = friendly ? PLAYER_SHOT_SPEED : ENEMY_SHOT_SPEED
  const dx = Math.sin(angle)
  const dz = Math.cos(angle)
  return { x: fromX + dx * muzzle, z: fromZ + dz * muzzle, y: 1.6, vx: dx * speed, vz: dz * speed, life: friendly ? 1.2 : 2.6, friendly }
}

export interface EnemyContext {
  playerX: number
  playerZ: number
  playerAlive: boolean
  baseX: number
  baseZ: number
  world: World
}

export function updateEnemies(enemies: Enemy[], dt: number, ctx: EnemyContext, onFire: (p: Projectile) => void): number {
  let atBase = 0
  for (const e of enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt)
    const toPlayer = Math.hypot(wrap(ctx.playerX - e.x), wrap(ctx.playerZ - e.z))
    const chasing = ctx.playerAlive && (toPlayer < AGGRO_RANGE || !e.waveMember)
    let tx = ctx.baseX
    let tz = ctx.baseZ
    if (chasing) {
      tx = ctx.playerX
      tz = ctx.playerZ
    }
    const dx = wrap(tx - e.x)
    const dz = wrap(tz - e.z)
    const d = Math.hypot(dx, dz) || 1
    e.heading = Math.atan2(dx, dz)
    let mx = 0
    let mz = 0
    if (chasing && d < KEEP_DISTANCE) {
      mx = (dz / d) * e.strafe * 0.6
      mz = (-dx / d) * e.strafe * 0.6
    } else if (!chasing && d < 6) {
      atBase++
    } else {
      mx = dx / d
      mz = dz / d
    }
    if (Math.random() < dt * 0.3) e.strafe *= -1
    if (mx || mz) {
      const step = ENEMY_SPEED * dt
      const options: [number, number][] = [
        [mx, mz],
        [mx * 0.7 - mz * 0.7 * e.strafe, mz * 0.7 + mx * 0.7 * e.strafe],
        [-mz * e.strafe, mx * e.strafe],
        [mz * e.strafe, -mx * e.strafe],
      ]
      const free = options.find(([ox, oz]) => !walkBlocked(ctx.world, e.x + ox * step, e.z + oz * step))
      if (free) {
        e.x += free[0] * step
        e.z += free[1] * step
        e.walkTime += dt
      } else {
        e.strafe *= -1
      }
    }
    e.fireTimer -= dt
    if (chasing && toPlayer < AGGRO_RANGE && e.fireTimer <= 0) {
      e.fireTimer = 1.4 + Math.random() * 0.8
      onFire(shoot(e.x, e.z, ctx.playerX, ctx.playerZ, false, 0.12))
    }
  }
  return atBase
}

export interface HitResult {
  enemy: Enemy | null
  player: boolean
  wall?: boolean
}

export function updateProjectiles(projectiles: Projectile[], dt: number, enemies: Enemy[], playerX: number, playerZ: number, world: World, onHit: (p: Projectile, r: HitResult) => void): Projectile[] {
  for (const p of projectiles) {
    p.x += p.vx * dt
    p.z += p.vz * dt
    p.life -= dt
    if (p.life <= 0) continue
    if (!p.pierce && (isSolidAt(world, p.x, p.z) || (boulderAt(world, p.x, p.z)?.height ?? -Infinity) > p.y || (world.blocks.heightAt(p.x, p.z) || -Infinity) > p.y)) {
      p.life = 0
      onHit(p, { enemy: null, player: false, wall: true })
      continue
    }
    if (p.friendly) {
      const target = enemies.find((e) => e.hp > 0 && Math.hypot(wrap(e.x - p.x), wrap(e.z - p.z)) < HIT_RADIUS)
      if (target) {
        p.life = 0
        onHit(p, { enemy: target, player: false })
      }
    } else if (Math.hypot(wrap(playerX - p.x), wrap(playerZ - p.z)) < HIT_RADIUS * 0.8) {
      p.life = 0
      onHit(p, { enemy: null, player: true })
    }
  }
  return projectiles.filter((p) => p.life > 0)
}

export function pickTarget(enemies: Enemy[], x: number, z: number, heading: number, range = 45): Enemy | null {
  let best: Enemy | null = null
  let bestScore = Infinity
  for (const e of enemies) {
    if (e.hp <= 0) continue
    const dx = wrap(e.x - x)
    const dz = wrap(e.z - z)
    const d = Math.hypot(dx, dz)
    if (d > range) continue
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - heading), Math.cos(Math.atan2(dx, dz) - heading)))
    if (off > 0.7) continue
    const score = d * (1 + off * 2)
    if (score < bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}

export function drawEnemy(ctx: Ctx, e: Enemy, sx: number, sy: number, time: number): void {
  const fy = Math.round(sy)
  const flash = e.hitFlash > 0
  const suit = flash ? '#ffffff' : '#e6e6ee'
  const frame = Math.floor(e.walkTime * 8) % 4
  const liftL = frame === 2 ? 1 : 0
  const liftR = frame === 0 ? 1 : 0
  rect(ctx, '#c9cbe0', sx - 3, fy - 5 - liftL, 2, 4)
  rect(ctx, '#c9cbe0', sx + 1, fy - 5 - liftR, 2, 4)
  rect(ctx, '#3f4878', sx - 3, fy - 1 - liftL, 2, 1)
  rect(ctx, '#3f4878', sx + 1, fy - 1 - liftR, 2, 1)
  rect(ctx, suit, sx - 4, fy - 11, 8, 6)
  rect(ctx, '#e24b4a', sx - 4, fy - 9, 8, 1)
  rect(ctx, '#c9cbe0', sx - 5, fy - 10, 1, 4)
  rect(ctx, '#3f4878', sx + 4, fy - 9, 3, 2)
  rect(ctx, suit, sx - 3, fy - 17, 6, 6)
  rect(ctx, '#16182c', sx - 2, fy - 16, 4, 3)
  rect(ctx, '#fac775', sx - 2, fy - 16, 2, 1)
  if (Math.floor(time * 4 + e.id) % 2) rect(ctx, '#e24b4a', sx + 2, fy - 18, 1, 1)
  if (e.hp < e.maxHp) {
    rect(ctx, '#2a1a2a', sx - 4, fy - 21, 8, 1)
    rect(ctx, '#ff8a7a', sx - 4, fy - 21, (8 * e.hp) / e.maxHp, 1)
  }
}

export function drawWreck(ctx: Ctx, w: Wreck, sx: number, sy: number, s: number, time: number): void {
  const box = (c: string, ux: number, top: number, uw: number, uh: number) => rect(ctx, c, sx + ux * s, sy - top * s, uw * s, uh * s)
  box('#c9cbe0', -1.4, 0.6, 2.8, 0.6)
  box('#e6e6ee', -0.6, 0.9, 1.4, 0.5)
  box('#16182c', 0.2, 0.85, 0.5, 0.3)
  box('#e24b4a', -1.2, 0.35, 2.4, 0.15)
  if (!w.searched && Math.floor(time * 2) % 2) rect(ctx, '#fac775', sx, sy - s - 3, 1, 2)
}
