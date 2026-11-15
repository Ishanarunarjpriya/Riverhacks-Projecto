import { BlockGrid } from './blocks'
import type { Camera } from './camera'
import { FOCAL, SCREEN_CX, SCREEN_W } from './constants'
import type { ItemId } from './items'
import { createRng } from './math'
import type { Pickup } from './pickups'
import { rect, type Ctx } from './pixel'
import type { Structure } from './structures'
import type { World } from './world'

export const SHIP_ROOM = { x0: -12, x1: 12, z0: -6, z1: 46 } as const
export const SHIP_SPAWN = { x: 0, z: -1 } as const
export const SHIP_AIRLOCK: Structure = { kind: 'airlock', name: 'AIRLOCK', x: 0, z: -5.6, radius: 2, mapColor: '#5dcaa5' }
export const SHIP_WORKBENCH: Structure = { kind: 'workbench', name: 'WORKBENCH', x: 7, z: 41, radius: 2.2, mapColor: '#fac775', yaw: Math.PI / 2 }

export interface Wreckage {
  id: string
  text: string
  reward: Partial<Record<ItemId, number>>
}

export const WRECKAGE: Record<string, Wreckage> = {
  'LOCKER A': { id: 'LOCKER A', text: 'A CREW LOCKER. THE NAME TAG HAS BEEN SCRATCHED OFF. INSIDE: TWISTED HULL PLATING.', reward: { 'metal-scrap': 3 } },
  'LOCKER B': { id: 'LOCKER B', text: 'THE EMERGENCY LOCKER. A POWER CELL, STILL CHARGED, AND SOME SCRAP.', reward: { 'metal-scrap': 2, 'power-cell': 1 } },
  'LOCKER C': { id: 'LOCKER C', text: 'A SUIT LOCKER. THE SUIT IS GONE. THE HELMET IS STILL HERE, GLASS CRACKED FROM THE INSIDE.', reward: { 'metal-scrap': 2 } },
  'WRECKAGE': { id: 'WRECKAGE', text: 'A COLLAPSED CONSOLE. YOU PRY OUT A FEW USEFUL PIECES.', reward: { 'metal-scrap': 2 } },
}

export const SHIP_LOG = {
  id: 'ship-log',
  text: "CAPTAIN'S LOG: 'DAY 3,652. THE CREW STOPPED WEARING HELMETS. NOBODY WILL SAY WHY.'",
}

export function createShipWorld(): World {
  const rng = createRng(41)
  const { x0, x1, z0, z1 } = SHIP_ROOM
  const structures: Structure[] = [SHIP_AIRLOCK, SHIP_WORKBENCH]
  for (let z = z0 + 3; z < z1; z += 6) {
    structures.push({ kind: 'bulkhead', name: 'BULKHEAD', x: x0, z, radius: 0, mapColor: '#3a4062', yaw: Math.PI / 2 })
    structures.push({ kind: 'bulkhead', name: 'BULKHEAD', x: x1, z, radius: 0, mapColor: '#3a4062', yaw: Math.PI / 2 })
  }
  for (let x = x0 + 3; x < x1; x += 6) {
    structures.push({ kind: 'bulkhead', name: 'BULKHEAD', x, z: z1, radius: 0, mapColor: '#3a4062' })
    if (Math.abs(x) > 3) structures.push({ kind: 'bulkhead', name: 'BULKHEAD', x, z: z0, radius: 0, mapColor: '#3a4062' })
  }
  structures.push({ kind: 'locker', name: 'LOCKER A', x: -10, z: 10, radius: 1.2, mapColor: '#7c85b4', yaw: Math.PI / 2 })
  structures.push({ kind: 'locker', name: 'LOCKER B', x: 10, z: 20, radius: 1.2, mapColor: '#7c85b4', yaw: -Math.PI / 2 })
  structures.push({ kind: 'locker', name: 'LOCKER C', x: -10, z: 32, radius: 1.2, mapColor: '#7c85b4', yaw: Math.PI / 2 })
  structures.push({ kind: 'debris', name: 'WRECKAGE', x: 4, z: 30, radius: 1.6, mapColor: '#4b5488', yaw: 0.7 })
  for (const [x, z] of [[-5, 16], [6, 8], [-3, 38], [8, 33]]) {
    structures.push({ kind: 'debris', name: 'DEBRIS', x, z, radius: 1.4, mapColor: '#4b5488', yaw: rng() * Math.PI })
  }

  const pickups: Pickup[] = [
    { item: 'data-log', x: -7, z: 43, phase: 1, collected: false, clue: { id: SHIP_LOG.id, x: -7, z: 43, text: SHIP_LOG.text } },
    { item: 'metal-scrap', x: 2, z: 12, phase: 2, collected: false },
    { item: 'metal-scrap', x: -2, z: 26, phase: 3, collected: false },
  ]

  const pebbles = Array.from({ length: 160 }, () => ({ x: x0 + rng() * (x1 - x0), z: z0 + rng() * (z1 - z0) }))
  return { craters: [], pits: [], pebbles, boulders: [], structures, pickups, gardens: [], blocks: new BlockGrid() }
}

export function clampToShip(x: number, z: number): [number, number] {
  const pad = 1.2
  return [Math.min(SHIP_ROOM.x1 - pad, Math.max(SHIP_ROOM.x0 + pad, x)), Math.min(SHIP_ROOM.z1 - pad, Math.max(SHIP_ROOM.z0 + pad, z))]
}

export const SHIP_GROUND = { rim: '#6c7398', rim2: '#5b6288', band: '#3a4062', base: '#4b5276' }

export function drawShipCeiling(ctx: Ctx, cam: Camera, time: number): void {
  rect(ctx, '#0c0d1c', 0, 0, SCREEN_W, 120)
  for (let y = 0; y < 90; y += 10) rect(ctx, y % 20 ? '#141629' : '#191b33', 0, y, SCREEN_W, 4)
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2
    const rel = Math.atan2(Math.sin(angle - cam.heading), Math.cos(angle - cam.heading))
    if (Math.abs(rel) > 1.2) continue
    const x = SCREEN_CX + Math.tan(rel) * FOCAL
    rect(ctx, '#20233e', x - 2, 0, 4, 92)
    rect(ctx, '#2c3052', x - 2, 0, 1, 92)
    const on = Math.sin(time * 3 + i * 1.7) > 0.2 || (i % 3 === 0 && Math.random() < 0.1)
    rect(ctx, on ? '#e24b4a' : '#4a1f2a', x - 1, 20 + (i % 3) * 14, 2, 2)
  }
}

export function drawShipLight(ctx: Ctx, time: number): void {
  const pulse = (Math.sin(time * 2.4) + 1) / 2
  ctx.fillStyle = `rgba(226,75,74,${0.05 + pulse * 0.07})`
  ctx.fillRect(0, 0, SCREEN_W, 180)
}
