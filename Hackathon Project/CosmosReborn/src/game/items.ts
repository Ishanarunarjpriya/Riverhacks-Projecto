export type ItemId =
  | 'moon-rock'
  | 'metal-scrap'
  | 'power-cell'
  | 'ration-pack'
  | 'repair-kit'
  | 'pickaxe'
  | 'moon-pickaxe'
  | 'data-log'
  | 'anomaly-shard'
  | 'bio-sample'
  | 'rare-ore'
  | 'power-drill'
  | 'armor-plating'
  | 'blaster'
  | 'moon-berry'
  | 'star-melon'
  | 'glow-cap'
  | 'iron-ore'
  | 'titanium-ore'

export interface ItemInfo {
  name: string
  short: string
  color: string
  description: string
}

export const ITEMS: Record<ItemId, ItemInfo> = {
  'moon-rock': { name: 'MOON ROCK', short: 'ROCK', color: '#c9cbe0', description: 'Grey regolith rock. Basic building material.' },
  'metal-scrap': { name: 'METAL SCRAP', short: 'SCRAP', color: '#9aa2cf', description: 'Twisted hull plating from the crash.' },
  'power-cell': { name: 'POWER CELL', short: 'CELL', color: '#9fe1cb', description: 'Still charged. Nobody knows who charged it.' },
  'ration-pack': { name: 'RATION PACK', short: 'RATIONS', color: '#fac775', description: 'Sealed food. You haven\'t felt hungry yet.' },
  'repair-kit': { name: 'REPAIR KIT', short: 'REPAIR KIT', color: '#ff8a7a', description: 'Patches, sealant and a tiny wrench.' },
  'pickaxe': { name: 'PICKAXE', short: 'PICKAXE', color: '#e6e6ee', description: 'Scrap steel on a striped shaft. Three swings per boulder.' },
  'moon-pickaxe': { name: 'MOON PICKAXE', short: 'MOON PICK', color: '#c9a6ff', description: 'Forged from night sky. Two swings per boulder, extra rock.' },
  'data-log': { name: 'DATA LOG', short: 'LOG', color: '#5dcaa5', description: 'Recovered recordings. Some of them use your voice.' },
  'anomaly-shard': { name: 'ANOMALY SHARD', short: 'SHARD', color: '#c9a6ff', description: 'Hums when you hold it. Stores power. Maybe memories.' },
  'bio-sample': { name: 'BIO SAMPLE', short: 'SAMPLE', color: '#9fe1cb', description: 'Glowing tissue from a drifter. Still warm.' },
  'rare-ore': { name: 'GLOWING ORE', short: 'ORE', color: '#ff9f5a', description: 'Found only underground. It pulses like it has a heartbeat.' },
  'power-drill': { name: 'POWER DRILL', short: 'DRILL', color: '#fac775', description: 'Cuts through hatches, rock and probably bone.' },
  'armor-plating': { name: 'ARMOR PLATING', short: 'ARMOR', color: '#9aa2cf', description: 'Reduces damage taken by 40%.' },
  'blaster': { name: 'BLASTER', short: 'BLASTER', color: '#ff8a7a', description: 'Press Q or click to fire. Aims at the nearest threat ahead.' },
  'moon-berry': { name: 'MOON BERRY', short: 'BERRY', color: '#ff6b7a', description: 'Hold it and press E to eat. Heals 15.' },
  'star-melon': { name: 'STAR MELON', short: 'MELON', color: '#ffb35a', description: 'Sweet and cold. Hold it and press E to eat. Heals 30.' },
  'glow-cap': { name: 'GLOW CAP', short: 'GLOW CAP', color: '#5fe0c8', description: 'A shining mushroom. Hold it and press E to eat. Heals 60.' },
  'iron-ore': { name: 'IRON ORE', short: 'IRON', color: '#c08a64', description: 'Rusty lunar iron. Sometimes drops from boulders.' },
  'titanium-ore': { name: 'TITANIUM ORE', short: 'TITANIUM', color: '#a9c3d6', description: 'Rare, light and strong. Sometimes drops from boulders.' },
}

export const FOOD: Partial<Record<ItemId, number>> = { 'moon-berry': 15, 'star-melon': 30, 'glow-cap': 60 }

export const SUPPLY_ITEMS: readonly ItemId[] = ['power-cell', 'ration-pack', 'repair-kit']
