import type { ItemId } from './items'
import { box, disc, glowBox, type Part } from './model3d'

export type Blueprint = 'frame' | 'engine' | 'controls' | 'fuel' | 'cabin'

export const BLUEPRINTS: Record<Blueprint, { name: string; source: string }> = {
  frame: { name: 'FRAME', source: 'Ask Okoro at the settlement' },
  engine: { name: 'ENGINE', source: 'Search the crashed invader dropship' },
  controls: { name: 'CONTROLS', source: 'A terminal deep in the caves' },
  fuel: { name: 'FUEL STORAGE', source: 'Drill for fuel at the Ice Drill' },
  cabin: { name: 'PASSENGER SPACE', source: 'Search the Habitat dome' },
}

export const SECTION_ORDER: readonly Blueprint[] = ['frame', 'engine', 'fuel', 'controls', 'cabin']

export const SECTION_COST: Record<Blueprint, Partial<Record<ItemId, number>>> = {
  frame: { 'metal-rod': 4, 'titanium-ore': 2, 'metal-scrap': 4 },
  engine: { 'rare-ore': 3, 'metal-scrap': 4, 'alien-alloy': 1 },
  fuel: { 'metal-scrap': 5, 'iron-ore': 3 },
  controls: { 'power-cell': 1, 'anomaly-shard': 3, 'metal-scrap': 2 },
  cabin: { 'moon-rock': 8, 'crescent-shard': 4, 'metal-scrap': 3 },
}

export const PASSENGER_BAY_COST: Partial<Record<ItemId, number>> = { 'metal-rod': 2, 'crescent-shard': 4, 'moon-rock': 6 }
export const FOOD_STOCK_GOAL = 10
export const ROCKET_RANGE = 7
export const RAID_INTERVAL = 240

export interface RocketState {
  placed: boolean
  x: number
  z: number
  built: Set<Blueprint>
  damaged: Set<Blueprint>
  bay: boolean
  food: number
  fuel: number
}

export const rocket: RocketState = { placed: false, x: 0, z: 0, built: new Set(), damaged: new Set(), bay: false, food: 0, fuel: 0 }
export const FUEL_GOAL = 12
export const RIG_INTERVAL = 25
export const RIG_CAPACITY = 6

export function resetRocket(): void {
  rocket.placed = false
  rocket.built.clear()
  rocket.damaged.clear()
  rocket.bay = false
  rocket.food = 0
  rocket.fuel = 0
}

export function rocketProgress(): number {
  return Math.round((rocket.built.size / SECTION_ORDER.length) * 100)
}

export function launchPadModel(time: number): Part[] {
  const blink = Math.floor(time * 2) % 2 === 1
  const parts: Part[] = [
    box(-5, 5, 0, 0.4, -5, 5, '#5b6496', '#7c85b4'),
    box(-5.05, 5.05, 0.38, 0.42, -0.2, 0.2, '#fac775'),
    box(-0.2, 0.2, 0.38, 0.42, -5.05, 5.05, '#fac775'),
  ]
  for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) {
    parts.push(glowBox(x - 0.25, x + 0.25, 0.4, 0.8, z - 0.25, z + 0.25, blink ? '#e24b4a' : '#5a2a2a'))
  }
  return parts
}

export function rocketModel(time: number): Part[] {
  const parts = launchPadModel(time)
  const b = rocket.built
  const dmg = (s: Blueprint, color: string) => (rocket.damaged.has(s) ? '#3a3040' : color)
  const has = (s: Blueprint) => b.has(s)
  parts.push(box(3.6, 4, 0.4, 18, 3.6, 4, '#9aa0b8'))
  parts.push(box(3.6, 4, 0.4, 18, -4, -3.6, '#9aa0b8'))
  for (const y of [4, 8, 12, 16]) parts.push(box(3.6, 4, y, y + 0.3, -4, 4, '#7c85b4'))
  if (has('frame')) {
    for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) parts.push(box(x - 0.2, x + 0.2, 0.4, 16, z - 0.2, z + 0.2, dmg('frame', '#c9cbe0')))
    for (const y of [3, 7, 11, 15]) parts.push(box(-2, 2, y, y + 0.3, -2, 2, dmg('frame', '#9aa0b8')))
  }
  if (has('engine')) {
    parts.push(box(-2.2, 2.2, 1.2, 4, -2.2, 2.2, dmg('engine', '#5b6496'), dmg('engine', '#7c85b4')))
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(x - 0.6, x + 0.6, 0.4, 1.2, z - 0.6, z + 0.6, dmg('engine', '#3f4878')))
  }
  if (has('fuel')) parts.push(box(-2, 2, 4, 9, -2, 2, dmg('fuel', '#e6e6ee'), dmg('fuel', '#ffffff')), box(-2.05, 2.05, 6, 6.6, -2.05, 2.05, dmg('fuel', '#e0884a')))
  if (has('cabin')) {
    parts.push(box(-1.9, 1.9, 9, 12.5, -1.9, 1.9, dmg('cabin', '#d8d9e6'), dmg('cabin', '#eef0f8')))
    for (const z of [-0.8, 0.8]) parts.push(glowBox(1.9, 1.95, 10.4, 11.2, z - 0.4, z + 0.4, rocket.damaged.has('cabin') ? '#16182c' : '#9fe1ff'))
    if (rocket.bay) parts.push(box(-1.95, 1.95, 12.5, 13.5, -1.95, 1.95, '#c9cbe0'))
  }
  if (has('controls')) {
    const top = rocket.bay ? 13.5 : 12.5
    parts.push(box(-1.5, 1.5, top, top + 1.5, -1.5, 1.5, dmg('controls', '#e6e6ee')), box(-0.8, 0.8, top + 1.5, top + 3, -0.8, 0.8, dmg('controls', '#e24b4a')))
    parts.push(disc([0, top + 3.1, 0], 0.4, [0, 1, 0], '#fac775', '#fac775', 8))
  }
  return parts
}

export function dropshipModel(time: number): Part[] {
  const blink = Math.floor(time * 3) % 2 === 1
  return [
    box(-5, 5, 0, 2.2, -2.5, 2.5, '#2a2f4c', '#3a4062'),
    box(-2.5, 3, 2.2, 3.6, -1.6, 1.6, '#3a4062', '#4b5276'),
    box(5, 7.5, 0, 1.4, -1.2, 1.2, '#2a2f4c', '#3a4062'),
    box(-4.5, 1, 0, 0.5, -6, -2.5, '#1d2238', '#2a2f4c'),
    box(-4.5, 1, 0, 0.5, 2.5, 4.5, '#1d2238', '#2a2f4c'),
    glowBox(3, 3.1, 2.4, 3.2, -1, 1, '#ff5a5a'),
    glowBox(-5.1, -5, 0.6, 1.6, -1.5, 1.5, blink ? '#e24b4a' : '#4a1f2a'),
  ]
}

export function rigModel(time: number): Part[] {
  const spin = Math.floor(time * 6) % 2 === 0
  return [
    box(-1.4, 1.4, 0, 0.4, -1.4, 1.4, '#5b6496', '#7c85b4'),
    box(-0.2, 0.2, 0.4, 4.5, -0.2, 0.2, '#9aa0b8'),
    box(-1.2, -1, 0.4, 4.2, -0.1, 0.1, '#7c85b4'),
    box(1, 1.2, 0.4, 4.2, -0.1, 0.1, '#7c85b4'),
    box(-1.2, 1.2, 4.2, 4.5, -0.15, 0.15, '#7c85b4'),
    glowBox(-0.3, 0.3, spin ? 1 : 1.4, spin ? 1.4 : 1.8, -0.3, 0.3, '#9fd4ff'),
  ]
}

export function coreModel(time: number): Part[] {
  const pulse = Math.sin(time * 2) > 0
  return [
    box(-1, 1, 0, 1.6, -1, 1, '#3a4062', '#4b5276'),
    glowBox(-0.6, 0.6, 1.6, 3, -0.6, 0.6, pulse ? '#5dcaa5' : '#2f6f5f'),
    box(-1, 1, 3, 3.3, -1, 1, '#3a4062'),
  ]
}

export function terminalModel(time: number): Part[] {
  const on = Math.sin(time * 4) > -0.6
  return [
    box(-1.2, 1.2, 0, 2.6, -0.7, 0.7, '#3a4062', '#4b5276'),
    glowBox(-0.9, 0.9, 1.4, 2.4, 0.7, 0.75, on ? '#5dcaa5' : '#1d5c4a'),
    box(-0.1, 0.1, 2.6, 4, -0.1, 0.1, '#9aa0b8'),
    glowBox(-0.25, 0.25, 4, 4.4, -0.25, 0.25, '#c9a6ff'),
  ]
}
