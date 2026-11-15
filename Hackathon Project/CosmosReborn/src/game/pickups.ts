import { WORLD_SIZE } from './constants'
import { HAS_ITEM_PNG, ICONS } from './hotbar'
import { ITEMS, SUPPLY_ITEMS, type ItemId } from './items'
import { wrap } from './math'
import { rect, type Ctx } from './pixel'
import { CLUES, type Clue } from './quests'
import type { Crater } from './world'

export interface Pickup {
  item: ItemId
  x: number
  z: number
  phase: number
  collected: boolean
  clue?: Clue
  garden?: number
}

export const PICKUP_RADIUS = 3.2

export function createPickups(
  rng: () => number,
  craters: readonly Crater[],
  blocked: (x: number, z: number, margin: number) => boolean,
): Pickup[] {
  const pickups: Pickup[] = []
  const free = (x: number, z: number) =>
    !blocked(x, z, 2) && !craters.some((c) => Math.hypot(wrap(x - c.x), wrap(z - c.z)) < c.r * 1.3)

  const place = (item: ItemId, x: number, z: number, clue?: Clue) => {
    let px = x
    let pz = z
    for (let tries = 0; tries < 12 && !free(px, pz); tries++) {
      px = x + (rng() - 0.5) * 10
      pz = z + (rng() - 0.5) * 10
    }
    if (free(px, pz) || clue) pickups.push({ item, x: px, z: pz, phase: rng() * 10, collected: false, clue })
  }

  const scatter = (item: ItemId, count: number, cx: number, cz: number, minR: number, maxR: number) => {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2
      const r = minR + rng() * (maxR - minR)
      place(item, cx + Math.cos(a) * r, cz + Math.sin(a) * r)
    }
  }

  const anywhere = (item: ItemId, count: number) => {
    for (let i = 0; i < count; i++) place(item, rng() * WORLD_SIZE, rng() * WORLD_SIZE)
  }

  place('power-cell', -12, 20)
  place('ration-pack', -5, 42)
  place('repair-kit', 12, 9)

  scatter('moon-rock', 18, 0, 0, 22, 110)
  anywhere('moon-rock', 40)

  scatter('metal-scrap', 8, 0, 60, 10, 45)
  scatter('metal-scrap', 10, 540, 350, 8, 30)
  anywhere('metal-scrap', 8)

  anywhere('iron-ore', 10)
  anywhere('titanium-ore', 4)

  for (const clue of CLUES) place('data-log', clue.x, clue.z, clue)

  return pickups
}

export function drawPickup(ctx: Ctx, pickup: Pickup, sx: number, sy: number, s: number, time: number): void {
  const box = (c: string, ux: number, top: number, uw: number, uh: number) =>
    rect(ctx, c, sx + ux * s, sy - top * s, uw * s, uh * s)
  const blink = Math.floor(time * 3 + pickup.phase) % 2 === 0
  const glint = Math.sin(time * 1.7 + pickup.phase * 3) > 0.93

  if (HAS_ITEM_PNG.has(pickup.item)) {
    const icon = ICONS[pickup.item]
    const size = Math.max(4, Math.round(2.2 * s))
    const bob = Math.sin(time * 2 + pickup.phase) * 0.15 * s
    const prev = ctx.imageSmoothingEnabled
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(icon, Math.round(sx - size / 2), Math.round(sy - size - 0.2 * s + bob), size, size)
    ctx.imageSmoothingEnabled = prev
    if (SUPPLY_ITEMS.includes(pickup.item) && blink) rect(ctx, '#fac775', sx - 1, sy - size - 0.2 * s - 3, 2, 2)
    else if (glint) rect(ctx, '#ffffff', sx + size * 0.25, sy - size * 0.8, 1, 1)
    return
  }

  switch (pickup.item) {
    case 'power-cell':
    case 'ration-pack':
    case 'repair-kit':
      box('#d8d9e6', -1.2, 1.8, 2.4, 1.8)
      box('#eef0f8', -1.2, 1.8, 2.4, 0.4)
      box(ITEMS[pickup.item].color, -1.2, 1.1, 2.4, 0.45)
      box('#9aa0b8', 0.5, 1.8, 0.7, 1.8)
      if (blink) rect(ctx, '#fac775', sx - 1, sy - 1.8 * s - 3, 2, 2)
      break
    case 'moon-rock':
      box('#8a8fae', -0.8, 1, 1.6, 1)
      box('#c9cbe0', -0.8, 1, 1.1, 0.35)
      box('#6c719a', 0.3, 1, 0.5, 1)
      if (glint) rect(ctx, '#ffffff', sx, sy - s - 2, 1, 1)
      break
    case 'metal-scrap':
      box('#7d8aa8', -1.1, 0.5, 2.2, 0.5)
      box('#b9c3dc', -0.7, 1, 1.2, 0.5)
      box('#c8692f', 0.2, 0.95, 0.4, 0.3)
      if (glint) rect(ctx, '#ffffff', sx - 1, sy - s - 2, 1, 1)
      break
    case 'data-log':
      box('#2e3352', -0.8, 0.5, 1.6, 0.5)
      box(blink ? '#9fe1cb' : '#5dcaa5', -0.6, 0.45, 1.2, 0.25)
      if (blink) rect(ctx, '#5dcaa5', sx, sy - 0.5 * s - 3, 1, 2)
      break
    case 'rare-ore': {
      const glow = Math.sin(time * 3 + pickup.phase) > 0
      box('#5a3a26', -0.9, 0.9, 1.8, 0.9)
      box(glow ? '#ffd28a' : '#ff9f5a', -0.6, 1.1, 0.6, 0.6)
      box('#ff9f5a', 0.2, 1.3, 0.5, 0.8)
      if (glint) rect(ctx, '#ffffff', sx, sy - 1.4 * s - 2, 1, 1)
      break
    }
    default:
      break
  }
}
