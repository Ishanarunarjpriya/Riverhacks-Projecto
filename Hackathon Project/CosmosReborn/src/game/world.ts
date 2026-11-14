import { WORLD_SIZE } from './constants'
import { createRng, wrap } from './math'
import { STRUCTURES, type Structure } from './structures'

export interface Crater {
  x: number
  z: number
  r: number
  isPit: boolean
  depth: number
}

export interface Boulder {
  x: number
  z: number
  r: number
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
  structures: readonly Structure[]
}

export const CRATER_FLOOR_RATIO = 0.7
const PIT_FALL_RATIO = 0.75
const MIN_PIT_RADIUS = 3.5
const MAX_PIT_DEPTH = 3.5
const SPAWN_CLEAR_RADIUS = 18

export function createWorld(seed = 11): World {
  const rng = createRng(seed)
  const tooClose = (x: number, z: number, margin: number) =>
    STRUCTURES.some((s) => Math.hypot(wrap(x - s.x), wrap(z - s.z)) < s.radius + margin) ||
    Math.hypot(wrap(x), wrap(z)) < SPAWN_CLEAR_RADIUS

  const craters: Crater[] = []
  for (let i = 0; i < 380; i++) {
    const x = rng() * WORLD_SIZE
    const z = rng() * WORLD_SIZE
    const r = 2 + rng() * rng() * 12
    if (tooClose(x, z, r + 6)) continue
    const isPit = r >= MIN_PIT_RADIUS
    craters.push({ x, z, r, isPit, depth: isPit ? Math.min(MAX_PIT_DEPTH, 1.2 + r * 0.3) : r * 0.3 })
  }

  const pebbles: Pebble[] = []
  for (let i = 0; i < 1400; i++) pebbles.push({ x: rng() * WORLD_SIZE, z: rng() * WORLD_SIZE })

  const boulders: Boulder[] = []
  for (let i = 0; i < 70; i++) {
    const x = rng() * WORLD_SIZE
    const z = rng() * WORLD_SIZE
    if (!tooClose(x, z, 4)) boulders.push({ x, z, r: 0.8 + rng() * 1.6 })
  }

  return { craters, pits: craters.filter((c) => c.isPit), pebbles, boulders, structures: STRUCTURES }
}

export function pitAt(world: World, x: number, z: number): Crater | null {
  for (const c of world.pits) {
    const dx = wrap(x - c.x)
    const dz = wrap(z - c.z)
    if (dx * dx + dz * dz < (c.r * PIT_FALL_RATIO) ** 2) return c
  }
  return null
}

export function groundHeightAt(world: World, x: number, z: number): number {
  const pit = pitAt(world, x, z)
  return pit ? -pit.depth : 0
}

export function isSolidAt(world: World, x: number, z: number): boolean {
  return world.structures.some((s) => Math.hypot(wrap(x - s.x), wrap(z - s.z)) < s.radius)
}
