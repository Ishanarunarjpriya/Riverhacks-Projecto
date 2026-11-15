import type { ItemId } from './items'
import type { Structure } from './structures'

export type BasePart = 'tools' | 'shelter' | 'storage' | 'power' | 'housing' | 'silo' | 'array' | 'drill' | 'armor' | 'blaster' | 'turret'

export const BASE_CENTER = { x: 16, z: 30 } as const
export const BASE_HALF = 12
export const BASE_RADIUS = 15

export interface Recipe {
  name: string
  cost: Partial<Record<ItemId, number>>
}

export const RECIPES: Record<BasePart, Recipe> = {
  tools: { name: 'BASIC TOOLS', cost: { 'moon-rock': 2, 'metal-scrap': 2 } },
  shelter: { name: 'SHELTER', cost: { 'moon-rock': 4, 'metal-scrap': 2 } },
  storage: { name: 'STORAGE', cost: { 'moon-rock': 3, 'metal-scrap': 1 } },
  power: { name: 'POWER', cost: { 'moon-rock': 1, 'metal-scrap': 1, 'power-cell': 1 } },
  housing: { name: 'HOUSING', cost: { 'moon-rock': 6, 'metal-scrap': 3 } },
  silo: { name: 'SUPPLY SILO', cost: { 'moon-rock': 4, 'metal-scrap': 2, 'bio-sample': 1 } },
  array: { name: 'SOLAR ARRAY', cost: { 'moon-rock': 3, 'metal-scrap': 2, 'anomaly-shard': 2 } },
  drill: { name: 'POWER DRILL', cost: { 'moon-rock': 4, 'metal-scrap': 4, 'anomaly-shard': 2 } },
  armor: { name: 'ARMOR PLATING', cost: { 'rare-ore': 3, 'metal-scrap': 3 } },
  blaster: { name: 'BLASTER', cost: { 'rare-ore': 3, 'metal-scrap': 2, 'anomaly-shard': 1 } },
  turret: { name: 'DEFENSE TURRET', cost: { 'moon-rock': 5, 'metal-scrap': 4, 'rare-ore': 2 } },
}

export const PART_ITEMS: Partial<Record<BasePart, ItemId>> = {
  tools: 'basic-tools',
  drill: 'power-drill',
  armor: 'armor-plating',
  blaster: 'blaster',
}

export const PART_STRUCTURES: Partial<Record<BasePart, Structure>> = {
  shelter: { kind: 'shelter', name: 'SHELTER', x: 22, z: 38, radius: 4.5, mapColor: '#ffffff' },
  storage: { kind: 'storage', name: 'STORAGE', x: 9, z: 37, radius: 2.5, mapColor: '#9aa2cf' },
  power: { kind: 'power', name: 'POWER', x: 24, z: 23, radius: 2.5, mapColor: '#5dcaa5' },
  housing: { kind: 'housing', name: 'HOUSING', x: 7, z: 23, radius: 4.2, mapColor: '#ffffff', yaw: 0.3 },
  silo: { kind: 'silo', name: 'SUPPLY SILO', x: 31, z: 34, radius: 2.4, mapColor: '#9aa2cf' },
  array: { kind: 'array', name: 'SOLAR ARRAY', x: 18, z: 13, radius: 4.5, mapColor: '#378add', yaw: -0.2 },
  turret: { kind: 'turret', name: 'DEFENSE TURRET', x: 2, z: 33, radius: 1.8, mapColor: '#ff8a7a' },
}

export function costEntries(recipe: Recipe): [ItemId, number][] {
  return Object.entries(recipe.cost) as [ItemId, number][]
}
