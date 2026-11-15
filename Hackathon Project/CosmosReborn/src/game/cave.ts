import type { Camera } from './camera'
import { FOCAL, SCREEN_CX, SCREEN_H, SCREEN_W, WORLD_SIZE } from './constants'
import { createRng, wrap } from './math'
import type { Pickup } from './pickups'
import { rect, type Ctx } from './pixel'
import type { Structure } from './structures'
import type { Boulder, Crater, World } from './world'

export const CAVE_SPAWN = { x: 0, z: 0 } as const
export const LADDER: Structure = { kind: 'ladder', name: 'LADDER', x: 9, z: 3, radius: 2.4, mapColor: '#fac775' }
export const CAVERN: Structure = { kind: 'cavern', name: 'HIDDEN CAVERN', x: 190, z: -150, radius: 3.5, mapColor: '#ff9f5a' }
export const CAVERN_RANGE = 22

export function createCaveWorld(seed = 23): World {
  const rng = createRng(seed)
  const structures: Structure[] = [LADDER, CAVERN]
  const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(wrap(ax - bx), wrap(az - bz))
  const tooClose = (x: number, z: number, margin: number) =>
    structures.some((s) => dist(x, z, s.x, s.z) < s.radius + margin) || dist(x, z, 0, 0) < 12

  const craters: Crater[] = []
  for (let i = 0; i < 120; i++) {
    const x = rng() * WORLD_SIZE
    const z = rng() * WORLD_SIZE
    const r = 2 + rng() * 6
    if (tooClose(x, z, r + 6) || craters.some((c) => dist(x, z, c.x, c.z) < c.r + r + 4)) continue
    const isPit = r >= 4
    craters.push({ x, z, r, isPit, depth: isPit ? Math.min(3.5, 1.2 + r * 0.3) : r * 0.3 })
  }

  const boulders: Boulder[] = []
  const addSpire = (x: number, z: number, tall: boolean) => {
    const r = 0.9 + rng() * 1.6
    if (tooClose(x, z, r + 3)) return
    if (craters.some((c) => dist(x, z, c.x, c.z) < c.r * 1.3 + r)) return
    if (boulders.some((b) => dist(x, z, b.x, b.z) < b.r + r + 1)) return
    const height = tall ? 6 + rng() * 8 : Math.min(3.6, r * 1.3)
    boulders.push({ x, z, r, height, yaw: rng() * Math.PI, hp: tall ? 999 : 3, broken: false, shake: 0 })
  }
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2
    const r = 18 + rng() * 140
    addSpire(Math.cos(a) * r, Math.sin(a) * r, rng() < 0.55)
  }
  for (let i = 0; i < 260; i++) addSpire(rng() * WORLD_SIZE, rng() * WORLD_SIZE, rng() < 0.6)

  const pickups: Pickup[] = []
  const free = (x: number, z: number) =>
    !tooClose(x, z, 2) &&
    !craters.some((c) => dist(x, z, c.x, c.z) < c.r * 1.3) &&
    !boulders.some((b) => dist(x, z, b.x, b.z) < b.r + 2)
  let tries = 0
  while (pickups.length < 18 && tries++ < 2000) {
    const a = rng() * Math.PI * 2
    const r = 20 + rng() * 150
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (free(x, z)) pickups.push({ item: 'rare-ore', x, z, phase: rng() * 10, collected: false })
  }

  const pebbles = Array.from({ length: 900 }, () => ({ x: rng() * WORLD_SIZE, z: rng() * WORLD_SIZE }))
  return { craters, pits: craters.filter((c) => c.isPit), pebbles, boulders, structures, pickups, gardens: [] }
}

export const CAVE_GROUND = { rim: '#5a4a6e', rim2: '#463a5c', band: '#2c2440', base: '#3a3150' }

interface Speck {
  angle: number
  y: number
  color: string
}

const SPECKS: Speck[] = (() => {
  const rng = createRng(77)
  return Array.from({ length: 140 }, () => ({
    angle: rng() * Math.PI * 2,
    y: rng() * 80,
    color: rng() < 0.5 ? '#3d2f5a' : rng() < 0.7 ? '#ff9f5a' : '#c9a6ff',
  }))
})()

export function drawCaveCeiling(ctx: Ctx, cam: Camera, time: number): void {
  rect(ctx, '#07050e', 0, 0, SCREEN_W, SCREEN_H)
  for (let y = 0; y < 90; y += 6) rect(ctx, y % 12 ? '#0b0816' : '#0d0a1a', 0, y, SCREEN_W, 3)
  for (const s of SPECKS) {
    const rel = Math.atan2(Math.sin(s.angle - cam.heading), Math.cos(s.angle - cam.heading))
    if (Math.abs(rel) > 1.2) continue
    const x = SCREEN_CX + Math.tan(rel) * FOCAL
    if (x < 0 || x >= SCREEN_W) continue
    const twinkle = s.color !== '#3d2f5a' && Math.sin(time * 2 + s.angle * 9) > 0.6
    rect(ctx, twinkle ? '#ffffff' : s.color, x, s.y, 1, 1)
  }
}

export function drawDarkness(ctx: Ctx, px: number, py: number): void {
  const g = ctx.createRadialGradient(px, py, 18, px, py, 150)
  g.addColorStop(0, 'rgba(3,2,10,0)')
  g.addColorStop(0.5, 'rgba(3,2,10,0.55)')
  g.addColorStop(1, 'rgba(3,2,10,0.92)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
}
