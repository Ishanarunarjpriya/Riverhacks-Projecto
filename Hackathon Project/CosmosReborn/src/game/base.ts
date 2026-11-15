import type { ItemId } from './items'
import type { Structure } from './structures'

export type BasePart =
  | 'rods'
  | 'minerset'
  | 'slab'
  | 'anvilset'
  | 'tools'
  | 'moonpick'
  | 'titanpick'
  | 'rocketturret'
  | 'shelter'
  | 'storage'
  | 'power'
  | 'housing'
  | 'silo'
  | 'array'
  | 'drill'
  | 'armor'
  | 'blaster'
  | 'turret'

export const BASE_CENTER = { x: 16, z: 30 } as const
export const BASE_HALF = 12
export const BASE_RADIUS = 15

export interface Recipe {
  name: string
  cost: Partial<Record<ItemId, number>>
  station?: 'workbench'
  verb?: string
}

export const RECIPES: Record<BasePart, Recipe> = {
  rods: { name: 'METAL RODS', cost: { 'metal-scrap': 4 }, station: 'workbench', verb: 'CRAFT' },
  minerset: { name: 'ICE MINER', cost: { 'ice-miner': 1 }, verb: 'SET UP' },
  slab: { name: 'MOONROCK SLAB', cost: { 'moon-rock': 4 }, verb: 'PRESS' },
  anvilset: { name: 'ANVIL', cost: { anvil: 1 }, verb: 'SET UP' },
  tools: { name: 'PICKAXE', cost: { 'metal-rod': 2, 'moonrock-slab': 1 }, verb: 'FORGE' },
  moonpick: { name: 'MOON PICKAXE', cost: { 'moon-rock': 6, 'metal-rod': 1, 'bio-sample': 2 }, verb: 'FORGE' },
  rocketturret: { name: 'ROCKET TURRET', cost: { 'rare-ore': 2, 'metal-scrap': 4, 'titanium-ore': 1 } },
  titanpick: { name: 'TITANIUM PICKAXE', cost: { 'titanium-ore': 3, 'metal-rod': 2, 'alien-alloy': 1 }, verb: 'FORGE' },
  shelter: { name: 'SHELTER', cost: { 'moon-rock': 4, 'crescent-shard': 2, 'metal-scrap': 1 } },
  storage: { name: 'STORAGE', cost: { 'moon-rock': 3, 'metal-scrap': 1 } },
  power: { name: 'POWER', cost: { 'moon-rock': 1, 'metal-scrap': 1, 'power-cell': 1 } },
  housing: { name: 'HOUSING', cost: { 'moon-rock': 6, 'metal-scrap': 3 } },
  silo: { name: 'SUPPLY SILO', cost: { 'moon-rock': 4, 'metal-scrap': 2, 'bio-sample': 1 } },
  array: { name: 'SOLAR ARRAY', cost: { 'moon-rock': 3, 'metal-scrap': 2, 'alien-alloy': 1 } },
  drill: { name: 'POWER DRILL', cost: { 'moon-rock': 4, 'metal-scrap': 4, 'anomaly-shard': 2 } },
  armor: { name: 'ARMOR PLATING', cost: { 'rare-ore': 3, 'metal-scrap': 3 } },
  blaster: { name: 'BLASTER', cost: { 'rare-ore': 3, 'metal-scrap': 2, 'anomaly-shard': 1 } },
  turret: { name: 'DEFENSE TURRET', cost: { 'moon-rock': 5, 'metal-scrap': 4, 'rare-ore': 2 } },
}

export const PART_ITEMS: Partial<Record<BasePart, ItemId>> = {
  rods: 'metal-rod',
  slab: 'moonrock-slab',
  tools: 'pickaxe',
  moonpick: 'moon-pickaxe',
  titanpick: 'titan-pickaxe',
  drill: 'power-drill',
  armor: 'armor-plating',
  blaster: 'blaster',
}

// Gear you can forge at the base at any time (once you can afford it), not just when a
// quest asks for it. Used by the build prompt as a fallback.
export const UPGRADE_PARTS: readonly BasePart[] = ['moonpick']

export interface KitRecipe {
  item: ItemId
  cost: Partial<Record<ItemId, number>>
}

export const ANVIL_RECIPES: readonly KitRecipe[] = [
  { item: 'home-kit', cost: { 'moon-rock': 6, 'crescent-shard': 2, 'metal-scrap': 2 } },
  { item: 'farm-kit', cost: { 'moon-rock': 3, 'crescent-shard': 1, 'moon-berry': 1 } },
  { item: 'metal-rod', cost: { 'metal-scrap': 2 } },
  { item: 'rig-kit', cost: { 'metal-rod': 2, 'metal-scrap': 3, 'titanium-ore': 1 } },
  { item: 'survivor-gear', cost: { 'rare-ore': 1, 'metal-scrap': 2, 'iron-ore': 1 } },
]

export const KIT_STRUCTURES: Partial<Record<ItemId, { kind: 'home' | 'farm' | 'rocket'; radius: number }>> = {
  'home-kit': { kind: 'home', radius: 2.6 },
  'farm-kit': { kind: 'farm', radius: 3.4 },
  'launch-kit': { kind: 'rocket', radius: 5.5 },
}

export const BEDS_PER_HOME = 2
export const HOUSING_BEDS = 3

export const FREE_PARTS: readonly BasePart[] = ['shelter', 'storage', 'power', 'rocketturret']

export const PART_YIELD: Partial<Record<BasePart, number>> = { rods: 2 }

export const PART_STRUCTURES: Partial<Record<BasePart, Structure>> = {
  minerset: { kind: 'miner', name: 'ICE MINER', x: 29, z: 46, radius: 2.2, mapColor: '#5dcaa5', yaw: -0.4 },
  anvilset: { kind: 'anvil', name: 'ANVIL', x: 15, z: 41, radius: 1.6, mapColor: '#9aa2cf', yaw: 0.2 },
  shelter: { kind: 'shelter', name: 'SHELTER', x: 22, z: 38, radius: 4.5, mapColor: '#ffffff' },
  storage: { kind: 'storage', name: 'STORAGE', x: 9, z: 37, radius: 2.5, mapColor: '#9aa2cf' },
  power: { kind: 'power', name: 'POWER', x: 24, z: 23, radius: 2.5, mapColor: '#5dcaa5' },
  housing: { kind: 'housing', name: 'HOUSING', x: 7, z: 23, radius: 4.2, mapColor: '#ffffff', yaw: 0.3 },
  silo: { kind: 'silo', name: 'SUPPLY SILO', x: 31, z: 34, radius: 2.4, mapColor: '#9aa2cf' },
  array: { kind: 'array', name: 'SOLAR ARRAY', x: 18, z: 13, radius: 4.5, mapColor: '#378add', yaw: -0.2 },
  rocketturret: { kind: 'turret', name: 'ROCKET TURRET', x: 0, z: 0, radius: 1.8, mapColor: '#ff8a7a' },
  turret: { kind: 'turret', name: 'DEFENSE TURRET', x: 2, z: 33, radius: 1.8, mapColor: '#ff8a7a' },
}

export function costEntries(recipe: Recipe): [ItemId, number][] {
  return Object.entries(recipe.cost) as [ItemId, number][]
}
