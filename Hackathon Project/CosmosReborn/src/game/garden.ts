import { WORLD_SIZE } from './constants'
import type { ItemId } from './items'
import { wrap } from './math'
import { rect, type Ctx } from './pixel'
import type { Pickup } from './pickups'

export interface Plant {
  x: number
  z: number
  phase: number
  kind: number
}

export interface Garden {
  id: number
  x: number
  z: number
  radius: number
  plants: Plant[]
  found: boolean
  regrow: number
}

export const GARDEN_COUNT = 2
export const GARDEN_RADIUS = 6
export const GARDEN_FOOD = 4
export const GARDEN_REGROW = 90
export const GARDEN_FIND_RANGE = 16
const MIN_SPAWN_DISTANCE = 160

const CROPS: readonly ItemId[] = ['moon-berry', 'moon-berry', 'star-melon', 'star-melon', 'glow-cap']

export function createGardens(rng: () => number, blocked: (x: number, z: number, margin: number) => boolean): Garden[] {
  const gardens: Garden[] = []
  for (let tries = 0; gardens.length < GARDEN_COUNT && tries < 400; tries++) {
    const x = rng() * WORLD_SIZE
    const z = rng() * WORLD_SIZE
    if (Math.hypot(wrap(x), wrap(z)) < MIN_SPAWN_DISTANCE) continue
    if (blocked(x, z, GARDEN_RADIUS + 4)) continue
    if (gardens.some((g) => Math.hypot(wrap(x - g.x), wrap(z - g.z)) < WORLD_SIZE / 3)) continue
    gardens.push(makeGarden(gardens.length, x, z, rng))
  }
  return gardens
}

export function makeGarden(id: number, x: number, z: number, rng: () => number = Math.random): Garden {
  const plants: Plant[] = []
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * GARDEN_RADIUS
    plants.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, phase: rng() * 10, kind: Math.floor(rng() * 3) })
  }
  return { id, x, z, radius: GARDEN_RADIUS, plants, found: false, regrow: GARDEN_REGROW }
}

export function growCrop(garden: Garden, rng: () => number = Math.random): Pickup {
  const a = rng() * Math.PI * 2
  const r = 1 + Math.sqrt(rng()) * (garden.radius - 1.5)
  return {
    item: CROPS[Math.floor(rng() * CROPS.length)],
    x: garden.x + Math.cos(a) * r,
    z: garden.z + Math.sin(a) * r,
    phase: rng() * 10,
    collected: false,
    garden: garden.id,
  }
}

const LEAF = ['#3fae7c', '#5fe0c8', '#7fcf6a']
const STEM = ['#2c6e58', '#2f8f86', '#4a8a3c']
const BLOOM = ['#ff6b7a', '#c9a6ff', '#ffd28a']

export function drawPlant(ctx: Ctx, plant: Plant, sx: number, sy: number, s: number, time: number): void {
  const sway = Math.sin(time * 1.4 + plant.phase) * 0.12 * s
  const h = (1.1 + (plant.phase % 1) * 0.7) * s
  const w = Math.max(1, Math.round(0.18 * s))
  rect(ctx, STEM[plant.kind], sx - w / 2, sy - h, w, h)
  const lw = Math.max(1, Math.round(0.55 * s))
  const lh = Math.max(1, Math.round(0.25 * s))
  rect(ctx, LEAF[plant.kind], sx - lw + sway * 0.5, sy - h * 0.55, lw, lh)
  rect(ctx, LEAF[plant.kind], sx + sway * 0.5, sy - h * 0.8, lw, lh)
  const bw = Math.max(1, Math.round(0.4 * s))
  const glow = Math.sin(time * 2 + plant.phase * 2) > 0.6
  rect(ctx, glow ? '#ffffff' : BLOOM[plant.kind], sx - bw / 2 + sway, sy - h - bw, bw, bw)
}
