import type { BasePart } from './base'
import type { ItemId } from './items'

export type Objective =
  | { kind: 'collect'; label: string; item: ItemId; count: number }
  | { kind: 'collect-any'; label: string; items: readonly ItemId[]; count: number }
  | { kind: 'build'; label: string; part: BasePart }
  | { kind: 'mine'; label: string; count: number }
  | { kind: 'discover'; label: string; count: number }
  | { kind: 'inspect'; label: string; count: number }
  | { kind: 'return-to-base'; label: string }
  | { kind: 'clue'; label: string; count: number }
  | { kind: 'region'; label: string; count: number }
  | { kind: 'scan'; label: string; count: number }
  | { kind: 'anomaly'; label: string; count: number }
  | { kind: 'signal'; label: string }
  | { kind: 'talk'; label: string; count: number }
  | { kind: 'assign'; label: string; count: number }
  | { kind: 'supplies'; label: string; count: number }
  | { kind: 'cave'; label: string }
  | { kind: 'defeat'; label: string; count: number }
  | { kind: 'search-suit'; label: string }
  | { kind: 'wave'; label: string }
  | { kind: 'cavern'; label: string }
  | { kind: 'return-to-ship'; label: string }
  | { kind: 'ship'; label: string }
  | { kind: 'search'; label: string; count: number }
  | { kind: 'blocks'; label: string; count: number }

export interface Quest {
  id: string
  act: number
  title: string
  summary: string
  hint: string
  objectives: readonly Objective[]
  optional?: boolean
  transmission?: string
}

export interface Clue {
  id: string
  x: number
  z: number
  text: string
}

export const ACT_TITLES: Record<number, string> = {
  1: 'SURVIVAL',
  2: 'BEYOND THE BASE',
  3: 'INTO THE DEPTHS',
  4: 'A WAY HOME',
  5: 'ONE WAY HOME',
}

export const QUESTS: readonly Quest[] = [
  {
    id: 'act1.pieces',
    act: 1,
    title: 'Pieces of the Kestrel',
    summary: 'Find 3 rocket parts thrown from the ship and bring them back to it.',
    hint: 'Rocket parts glint orange on the ground around the crash site. Pick them up with E, then walk back to the crashed lander.',
    transmission: 'REBUILD... THE ROCKET. THAT IS ALL YOU REMEMBER.',
    objectives: [
      { kind: 'collect', label: 'Rocket parts', item: 'rocket-part', count: 3 },
      { kind: 'return-to-ship', label: 'Bring them to the Kestrel' },
    ],
  },
  {
    id: 'act1.inside-the-ship',
    act: 1,
    title: 'Inside the Ship',
    summary: 'Go inside the wrecked Kestrel and search it for metal.',
    hint: 'Stand by the crashed lander and press E to climb in. Search the lockers and wreckage with E, then craft metal rods at the workbench at the far end.',
    transmission: "MOONLINK: THE AIRLOCK IS OPEN. IT WAS OPENED FROM OUTSIDE.",
    objectives: [
      { kind: 'ship', label: 'Enter the Kestrel' },
      { kind: 'search', label: 'Search the wreckage', count: 3 },
      { kind: 'build', label: 'Craft metal rods', part: 'rods' },
    ],
  },
  {
    id: 'act1.first-craft',
    act: 1,
    title: 'Start the First Craft',
    summary: 'Bring the ice miner and the anvil to base and forge your first pickaxe.',
    hint: 'The ice miner and the anvil were thrown out in the crash; the A.I. pings their direction. Carry each to the base site and press E to set it up. The miner presses 4 moon rocks into a slab; the anvil forges rods and the slab into a pickaxe.',
    objectives: [
      { kind: 'collect', label: 'Find the ice miner', item: 'ice-miner', count: 1 },
      { kind: 'build', label: 'Set up the ice miner at base', part: 'minerset' },
      { kind: 'build', label: 'Press a MoonRock slab', part: 'slab' },
      { kind: 'collect', label: 'Find the anvil', item: 'anvil', count: 1 },
      { kind: 'build', label: 'Set up the anvil at base', part: 'anvilset' },
      { kind: 'build', label: 'Forge your first pickaxe', part: 'tools' },
    ],
  },
  {
    id: 'act1.first-materials',
    act: 1,
    title: 'First Materials',
    summary: 'Collect 10 moon rocks, 6 metal scraps, and 4 crescent shards.',
    hint: 'Moon rocks lie everywhere and come out of boulders you mine. Metal scrap is scattered around the lander. Crescent shards are curved green crystals in the dust.',
    objectives: [
      { kind: 'collect', label: 'Moon rocks', item: 'moon-rock', count: 10 },
      { kind: 'collect', label: 'Metal scrap', item: 'metal-scrap', count: 6 },
      { kind: 'collect', label: 'Crescent shards', item: 'crescent-shard', count: 4 },
    ],
  },
  {
    id: 'act1.place-to-stay',
    act: 1,
    title: 'A Place to Stay',
    summary: 'Build shelter, storage, and power anywhere you like, and shape your base with blocks.',
    hint: 'Press E where you want each part; it is built right in front of you, wherever you are. Power needs the power cell from the ship lockers. Hold moon rocks or crescent shards in your hotbar and click to place blocks; X or right-click takes one back.',
    objectives: [
      { kind: 'blocks', label: 'Place building blocks', count: 6 },
      { kind: 'build', label: 'Build shelter', part: 'shelter' },
      { kind: 'build', label: 'Build storage', part: 'storage' },
      { kind: 'build', label: 'Build power', part: 'power' },
    ],
  },
  {
    id: 'act1.strange-survival',
    act: 1,
    title: 'Strange Survival',
    summary: 'Find 3 documents about why you can breathe without a suit.',
    hint: 'Data logs blink green. One is near the lander, one is inside the Kestrel, and one is at the Habitat dome to the north-east.',
    transmission: 'MOONLINK: YOUR O2 READS 0%. I HAVE STOPPED ASKING WHY.',
    objectives: [{ kind: 'clue', label: 'Documents found', count: 3 }],
  },
  {
    id: 'act2.beyond-the-base',
    act: 2,
    title: 'Beyond the Base',
    summary: 'Discover 3 new Moon regions.',
    hint: 'The Moon is split into named regions. Walk far from the crash site in any direction; the compass shows the region name when you cross into a new one.',
    transmission: "...IF ANYONE CAN HEAR THIS, STAY AWAY FROM THE SUITS. THEY ARE NOT HERE TO RESCUE YOU...",
    objectives: [{ kind: 'region', label: 'New regions found', count: 3 }],
  },
  {
    id: 'act2.unusual-life',
    act: 2,
    title: 'Unusual Life',
    summary: 'Scan 2 alien creatures and gather samples.',
    hint: 'Glowing drifters float around most regions, and a couple wander near the crash site. Walk close and press E to scan one.',
    transmission: 'TABLET: LIFE SIGNS DETECTED. CLASSIFICATION... UNKNOWN. CLASSIFICATION... FAMILIAR?',
    objectives: [{ kind: 'scan', label: 'Creatures scanned', count: 2 }],
  },
  {
    id: 'act2.anomaly-hunt',
    act: 2,
    title: 'Anomaly Hunt',
    summary: 'Investigate 2 anomalies and trace the strange signal.',
    hint: 'Anomalies are floating purple crystals. After you investigate two, a purple marker on the compass and map points to the signal source.',
    objectives: [
      { kind: 'anomaly', label: 'Anomalies investigated', count: 2 },
      { kind: 'signal', label: 'Find the signal source' },
    ],
  },
  {
    id: 'act2.growing-settlement',
    act: 2,
    title: 'Growing Settlement',
    summary: 'Build housing, a supply silo, and a solar array.',
    hint: 'Go back to the base site and press E to build. The silo needs a bio sample from a scanned drifter; the array needs 2 anomaly shards.',
    transmission: "TABLET: SETTLEMENT PERMITS... APPROVED? NOBODY SHOULD BE APPROVING ANYTHING UP HERE.",
    objectives: [
      { kind: 'build', label: 'Build housing', part: 'housing' },
      { kind: 'build', label: 'Build supply silo', part: 'silo' },
      { kind: 'build', label: 'Build solar array', part: 'array' },
    ],
  },
  {
    id: 'act2.new-community',
    act: 2,
    title: 'A New Community',
    summary: 'Help the survivors and assign them jobs.',
    hint: 'Three survivors walked into your base. Press E near each one to talk, then press E again to pick a job. Supplies appear at your storage crate.',
    transmission: 'THREE FIGURES WALK IN FROM THE DARK. NONE OF THEM ARE WEARING HELMETS EITHER.',
    objectives: [
      { kind: 'talk', label: 'Talk to survivors', count: 3 },
      { kind: 'assign', label: 'Assign jobs', count: 3 },
      { kind: 'supplies', label: 'Collect settlement supplies', count: 1 },
    ],
  },
  {
    id: 'act3.into-the-depths',
    act: 3,
    title: 'Into the Depths',
    summary: 'Craft a power drill, open the hatch, and enter the caves.',
    hint: 'Build the power drill at your base site with E. Then go to the sealed hatch (purple marker on the map) and press E to drill it open.',
    transmission: 'THE KNOCKING STOPPED THE MOMENT YOU FINISHED THE DRILL. LIKE IT WAS WAITING.',
    objectives: [
      { kind: 'build', label: 'Craft a power drill', part: 'drill' },
      { kind: 'cave', label: 'Reach the caves' },
    ],
  },
  {
    id: 'act3.buried-resources',
    act: 3,
    title: 'Buried Resources',
    summary: 'Find 6 glowing ore underground and bring it back to base.',
    hint: 'Glowing orange ore is scattered through the caves; press E to pick it up. Then climb the ladder and head back to your base.',
    transmission: 'TABLET: ORE SIGNATURE MATCHES... YOUR BLOOD SAMPLE?',
    objectives: [
      { kind: 'collect', label: 'Glowing ore', item: 'rare-ore', count: 6 },
      { kind: 'return-to-base', label: 'Deliver it to base' },
    ],
  },
  {
    id: 'act3.gear-up',
    act: 3,
    title: 'Gear Up',
    summary: 'Craft armor plating and a blaster.',
    hint: 'Both are crafted at the base site with E. Armor cuts the damage you take; the blaster fires with Q or a mouse click.',
    transmission: "MAYA: 'SOMEONE WAS WATCHING THE BASE LAST NIGHT. THEY HAD HELMETS ON.'",
    objectives: [
      { kind: 'build', label: 'Craft armor plating', part: 'armor' },
      { kind: 'build', label: 'Craft a blaster', part: 'blaster' },
    ],
  },
  {
    id: 'act3.first-attack',
    act: 3,
    title: 'First Attack',
    summary: 'Survive the suits.',
    hint: 'Three figures in spacesuits are hunting you. Fire with Q or a click, and keep moving to dodge their shots.',
    transmission: 'WARNING: THREE SUITS APPROACHING. THEY ARE ARMED. THEY ARE NOT ANSWERING.',
    objectives: [{ kind: 'defeat', label: 'Suits stopped', count: 3 }],
  },
  {
    id: 'act3.familiar-faces',
    act: 3,
    title: 'Familiar Faces',
    summary: "Search a fallen suit's equipment for clues.",
    hint: 'The suits leave their gear behind when they fall. Walk up to it and press E to search.',
    objectives: [{ kind: 'search-suit', label: 'Search a fallen suit' }],
  },
  {
    id: 'act3.defend-settlement',
    act: 3,
    title: 'Defend the Settlement',
    summary: 'Build a defense turret and survive the attack on your base.',
    hint: 'Build the turret at the base site. A wave of suits will then march on the settlement; stop them before they wreck it.',
    transmission: "OKORO: 'THERE ARE MORE OF THEM. THEY'RE HEADING STRAIGHT FOR US.'",
    objectives: [
      { kind: 'build', label: 'Build a defense turret', part: 'turret' },
      { kind: 'wave', label: 'Survive the attack' },
    ],
  },
  {
    id: 'act2.lunar-tools',
    act: 2,
    optional: true,
    title: 'Lunar Tools',
    summary: 'Forge a moon pickaxe at your base.',
    hint: 'With 8 moon rocks, 4 metal scraps and 2 anomaly shards you can forge a moon pickaxe at the base site. It cracks a boulder in two swings and shakes loose extra rock.',
    transmission: "TABLET: TOOL SCHEMATIC RECOVERED. THE HANDLE IS WRAPPED IN SOMETHING THAT ISN'T CLOTH.",
    objectives: [{ kind: 'build', label: 'Forge the moon pickaxe', part: 'moonpick' }],
  },
  {
    id: 'act2.moon-survey',
    act: 2,
    optional: true,
    title: 'Moon Survey',
    summary: 'Map every region of the Moon.',
    hint: 'There are 6 regions beyond the crash site. The tablet map shows which ones you have found.',
    objectives: [{ kind: 'region', label: 'Regions mapped', count: 6 }],
  },
  {
    id: 'act3.hidden-cavern',
    act: 3,
    optional: true,
    title: 'Hidden Cavern',
    summary: 'Find the secret cavern deep in the caves.',
    hint: 'Somewhere far from the ladder, the caves open into a glowing chamber.',
    objectives: [{ kind: 'cavern', label: 'Find the hidden cavern' }],
  },
]

export const SHIP_SPOT = { x: 0, z: 60, radius: 14 } as const

export const CLUES: readonly Clue[] = [
  { id: 'suit-log', x: 7, z: 52, text: 'SUIT LOG: HELMET SEAL BROKEN ON IMPACT. O2 0%. VITALS... NORMAL?' },
  { id: 'hab-log', x: 243, z: 170, text: "HAB LOG: 'THEY SAID THE NEW ARRIVALS WOULDN'T NEED AIR.'" },
  { id: 'signal', x: 712, z: 290, text: "SIGNAL FRAGMENT: '...SUBJECTS ADAPTING. DO NOT MAKE CONTACT...'" },
]
