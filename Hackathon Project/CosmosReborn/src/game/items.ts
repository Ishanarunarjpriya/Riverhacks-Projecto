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
  | 'rocket-part'
  | 'metal-rod'
  | 'moonrock-slab'
  | 'crescent-shard'
  | 'ice-miner'
  | 'anvil'
  | 'home-kit'
  | 'farm-kit'
  | 'alien-alloy'
  | 'titan-pickaxe'
  | 'launch-kit'
  | 'lunar-ice'
  | 'rig-kit'
  | 'rocket-fuel'
  | 'survivor-gear'

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
  'moon-berry': { name: 'MOON BERRY', short: 'BERRY', color: '#ff6b7a', description: 'Eat (hold + E): heals 15 and makes you QUICK (+35% speed) for 60s.' },
  'star-melon': { name: 'STAR MELON', short: 'MELON', color: '#ffb35a', description: 'Eat (hold + E): heals 30 and STEADY (fast healing, less damage) for 60s.' },
  'glow-cap': { name: 'GLOW CAP', short: 'GLOW CAP', color: '#5fe0c8', description: 'Eat (hold + E): heals 60 and GLOWING (light in caves) for 90s.' },
  'iron-ore': { name: 'IRON ORE', short: 'IRON', color: '#c08a64', description: 'Rusty lunar iron. Sometimes drops from boulders.' },
  'rocket-part': { name: 'ROCKET PART', short: 'PART', color: '#fac775', description: 'A piece of the Kestrel, thrown clear in the crash.' },
  'metal-rod': { name: 'METAL ROD', short: 'ROD', color: '#c9cbe0', description: 'Straightened hull strut. Good for handles.' },
  'moonrock-slab': { name: 'MOONROCK SLAB', short: 'SLAB', color: '#9aa2c8', description: 'Moon stone pressed flat by the ice miner. Hard enough to be a pick head.' },
  'crescent-shard': { name: 'CRESCENT SHARD', short: 'CRESCENT', color: '#9fe1cb', description: 'A curved crystal that grows in the dust. Used for building.' },
  'ice-miner': { name: 'ICE MINER', short: 'MINER', color: '#5dcaa5', description: 'A mineral press from the Kestrel. Set it up at the base site.' },
  'anvil': { name: 'ANVIL', short: 'ANVIL', color: '#7c85b4', description: 'Heavy. Very heavy. Set it up at the base site to forge tools.' },
  'home-kit': { name: 'HOME KIT', short: 'HOME', color: '#e6e6ee', description: 'Hold it and click to place a home. Each home has 2 beds.' },
  'farm-kit': { name: 'FARM KIT', short: 'FARM', color: '#7fcf6a', description: 'Hold it and click to plant a farm. It grows moon food.' },
  'lunar-ice': { name: 'LUNAR ICE', short: 'ICE', color: '#9fd4ff', description: 'Frozen water from a crater that has not seen sunlight in billions of years.' },
  'rig-kit': { name: 'ICE RIG KIT', short: 'RIG', color: '#9fd4ff', description: 'Place it inside an icy crater. It slowly drills out ice for you.' },
  'launch-kit': { name: 'LAUNCH PAD KIT', short: 'PAD', color: '#fac775', description: 'Hold it and click where the rocket should be built. Pick somewhere open.' },
  'rocket-fuel': { name: 'ROCKET FUEL', short: 'FUEL', color: '#ff9f5a', description: 'Drilled out of frozen ground. Smells like a storm.' },
  'titan-pickaxe': { name: 'TITANIUM PICKAXE', short: 'TI PICK', color: '#a9c3d6', description: 'Lunar titanium and alien alloy. Cracks a boulder in one swing.' },
  'survivor-gear': { name: 'SURVIVOR GEAR', short: 'GEAR', color: '#ff9f5a', description: 'Armor and a helmet for a civilian. Hold it near one and press E.' },
  'alien-alloy': { name: 'ALIEN ALLOY', short: 'ALLOY', color: '#b8f0ff', description: 'Torn from the alien. Light, cold and impossibly strong.' },
  'titanium-ore': { name: 'TITANIUM ORE', short: 'TITANIUM', color: '#a9c3d6', description: 'Rare, light and strong. Sometimes drops from boulders.' },
}

export const FOOD: Partial<Record<ItemId, number>> = { 'moon-berry': 15, 'star-melon': 30, 'glow-cap': 60 }

export const SUPPLY_ITEMS: readonly ItemId[] = ['power-cell', 'ration-pack', 'repair-kit']
