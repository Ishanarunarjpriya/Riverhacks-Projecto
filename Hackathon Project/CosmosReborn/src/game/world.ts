import { ANOMALIES } from './anomalies'
import { BASE_CENTER, BASE_RADIUS } from './base'
import { BlockGrid } from './blocks'
import { WORLD_SIZE } from './constants'
import { GARDEN_FOOD, createGardens, growCrop, type Garden } from './garden'
import { createRng, wrap } from './math'
import { createPickups, type Pickup } from './pickups'
import { STRUCTURES, type Structure } from './structures'

export interface Crater {
  x: number
  z: number
  r: number
  isPit: boolean
  depth: number
  ice?: boolean
  iceLeft?: number
}

export interface Boulder {
  x: number
  z: number
  r: number
  height: number
  yaw: number
  hp: number
  broken: boolean
  shake: number
}

export interface Pebble {
  x: number
  z: number
}

export interface World {
  craters: Crater[]
  pits: Crater[]
  pebbles: Pebble[]
  boulders: Boulder[]
  structures: Structure[]
  pickups: Pickup[]
  gardens: Garden[]
  blocks: BlockGrid
}

export const CRATER_FLOOR_RATIO = 0.7
export const BOULDER_HITS = 3
const MIN_PIT_RADIUS = 3.5
const MAX_PIT_DEPTH = 3.5
const MAX_BOULDER_HEIGHT = 3.6
const SPAWN_CLEAR_RADIUS = 18

export function createWorld(seed = 11): World {
  const rng = createRng(seed)
  const structures = [...STRUCTURES]
  const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(wrap(ax - bx), wrap(az - bz))
  const tooClose = (x: number, z: number, margin: number) =>
    structures.some((s) => dist(x, z, s.x, s.z) < s.radius + margin) ||
    ANOMALIES.some((a) => dist(x, z, a.x, a.z) < 6 + margin) ||
    dist(x, z, 0, 0) < SPAWN_CLEAR_RADIUS ||
    dist(x, z, BASE_CENTER.x, BASE_CENTER.z) < BASE_RADIUS + margin

  const craters: Crater[] = []
  for (let i = 0; i < 420; i++) {
    const x = rng() * WORLD_SIZE
    const z = rng() * WORLD_SIZE
    const r = 2 + rng() * rng() * 12
    if (tooClose(x, z, r + 6)) continue
    if (craters.some((c) => dist(x, z, c.x, c.z) < (c.r + r) * 1.25 + 2)) continue
    const isPit = r >= MIN_PIT_RADIUS
    craters.push({ x, z, r, isPit, depth: isPit ? Math.min(MAX_PIT_DEPTH, 1.2 + r * 0.3) : r * 0.3 })
  }

  const icy = craters
    .filter((c) => c.isPit && c.r >= 5 && Math.hypot(wrap(c.x), wrap(c.z)) > 110)
    .sort((a, b) => b.r - a.r)
  const chosen: Crater[] = []
  for (const c of icy) {
    if (chosen.length >= 8) break
    if (chosen.some((o) => dist(o.x, o.z, c.x, c.z) < 120)) continue
    c.ice = true
    c.iceLeft = 8
    chosen.push(c)
  }

  const pebbles: Pebble[] = []
  for (let i = 0; i < 1400; i++) pebbles.push({ x: rng() * WORLD_SIZE, z: rng() * WORLD_SIZE })

  const boulders: Boulder[] = []
  const addBoulder = (x: number, z: number) => {
    const r = 0.8 + rng() * rng() * 2.4
    if (tooClose(x, z, r + 3)) return
    if (craters.some((c) => dist(x, z, c.x, c.z) < c.r * 1.35 + r)) return
    if (boulders.some((b) => dist(x, z, b.x, b.z) < b.r + r + 1)) return
    boulders.push({ x, z, r, height: Math.min(MAX_BOULDER_HEIGHT, r * 1.3), yaw: rng() * Math.PI, hp: BOULDER_HITS, broken: false, shake: 0 })
  }
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2
    const r = 24 + rng() * 80
    addBoulder(Math.cos(a) * r, Math.sin(a) * r)
  }
  for (let i = 0; i < 260; i++) addBoulder(rng() * WORLD_SIZE, rng() * WORLD_SIZE)

  const gardens = createGardens(rng, (x, z, margin) =>
    tooClose(x, z, margin) ||
    craters.some((c) => dist(x, z, c.x, c.z) < c.r + margin) ||
    boulders.some((b) => dist(x, z, b.x, b.z) < b.r + margin),
  )

  const pickups = createPickups(rng, craters, (x, z, margin) =>
    structures.some((s) => dist(x, z, s.x, s.z) < s.radius + margin) ||
    dist(x, z, BASE_CENTER.x, BASE_CENTER.z) < BASE_RADIUS + margin ||
    boulders.some((b) => dist(x, z, b.x, b.z) < b.r + margin),
  )

  for (const g of gardens) for (let i = 0; i < GARDEN_FOOD; i++) pickups.push(growCrop(g, rng))

  return { craters, pits: craters.filter((c) => c.isPit), pebbles, boulders, structures, pickups, gardens, blocks: new BlockGrid() }
}

export function craterAt(world: World, x: number, z: number): Crater | null {
  for (const c of world.craters) {
    if (Math.abs(wrap(x - c.x)) > c.r || Math.abs(wrap(z - c.z)) > c.r) continue
    if (Math.hypot(wrap(x - c.x), wrap(z - c.z)) < c.r) return c
  }
  return null
}

export function pitAt(world: World, x: number, z: number): Crater | null {
  const c = craterAt(world, x, z)
  return c && c.isPit ? c : null
}

export function craterHeight(c: Crater, x: number, z: number): number {
  const d = Math.hypot(wrap(x - c.x), wrap(z - c.z))
  if (d >= c.r) return 0
  if (d <= c.r * CRATER_FLOOR_RATIO) return -c.depth
  const t = (c.r - d) / (c.r * (1 - CRATER_FLOOR_RATIO))
  return -c.depth * (1 - (1 - t) ** 2)
}

export function boulderAt(world: World, x: number, z: number, pad = 0): Boulder | null {
  for (const b of world.boulders) {
    if (b.broken) continue
    if (Math.hypot(wrap(x - b.x), wrap(z - b.z)) < b.r + pad) return b
  }
  return null
}

export function groundHeightAt(world: World, x: number, z: number): number {
  const crater = craterAt(world, x, z)
  const base = crater ? craterHeight(crater, x, z) : 0
  const boulder = boulderAt(world, x, z, 0.5)
  const ground = boulder ? Math.max(base, boulder.height) : base
  const blocks = world.blocks.heightAt(x, z, 0.4)
  return blocks > 0 ? Math.max(ground, blocks) : ground
}

export function walkBlocked(world: World, x: number, z: number): boolean {
  return isSolidAt(world, x, z) || world.blocks.heightAt(x, z, 0.4) > 0
}

export function isSolidAt(world: World, x: number, z: number): boolean {
  return world.structures.some((s) => Math.hypot(wrap(x - s.x), wrap(z - s.z)) < s.radius)
}
