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
  | { kind: 'place'; label: string; item: ItemId; count: number }
  | { kind: 'civilians'; label: string; count: number }
  | { kind: 'boss'; label: string; count: number }
  | { kind: 'equip'; label: string; count: number }
  | { kind: 'promise'; label: string }
  | { kind: 'blueprints'; label: string; count: number }
  | { kind: 'sections'; label: string; count: number }
  | { kind: 'raid'; label: string; count: number }
  | { kind: 'repair'; label: string; count: number }
  | { kind: 'choice'; label: string }
  | { kind: 'bay'; label: string }
  | { kind: 'stock'; label: string; count: number }
  | { kind: 'fuel'; label: string; count: number }
  | { kind: 'preflight'; label: string; count: number }
  | { kind: 'laststand'; label: string }
  | { kind: 'intact'; label: string }
  | { kind: 'launch'; label: string }
  | { kind: 'truth'; label: string; count: number }

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
    hint: 'The ice miner and the anvil were thrown out in the crash; follow the gold marker. The ice miner is lying on the ground and is too heavy to lift: press E to grab it and walk back to base, it drags behind you. Then press E at the base site to set it up. The anvil is light: just pick it up. Then craft at the workbench (follow the gold marker): it presses 4 moon rocks into a slab with the ice miner, and forges rods and the slab into a pickaxe on the anvil.',
    objectives: [
      { kind: 'collect', label: 'Drag the ice miner back to base', item: 'ice-miner', count: 1 },
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
    hint: 'Unmapped regions are blank on the tablet map. Walk far from the crash site in any direction; the compass shows the region name when you cross into a new one.',
    transmission: "...IF ANYONE CAN HEAR THIS, STAY AWAY FROM THE SUITS. THEY ARE NOT HERE TO RESCUE YOU...",
    objectives: [{ kind: 'region', label: 'New regions found', count: 3 }],
  },
  {
    id: 'act2.unusual-life',
    act: 2,
    title: 'Unusual Life',
    summary: 'Scan 2 alien creatures and forge a moon pickaxe from their samples.',
    hint: 'Open the tablet SCAN app to see life signs and their direction. Walk up to a glowing drifter and press E to scan it for a bio sample. With 2 samples, 6 moon rocks and a metal rod, forge the moon pickaxe at the workbench.',
    transmission: 'TABLET: LIFE SIGNS DETECTED. CLASSIFICATION... UNKNOWN. CLASSIFICATION... SAME AS USER?',
    objectives: [
      { kind: 'scan', label: 'Creatures scanned', count: 2 },
      { kind: 'build', label: 'Forge the moon pickaxe', part: 'moonpick' },
    ],
  },
  {
    id: 'act2.place-for-everyone',
    act: 2,
    title: 'A Place for Everyone',
    summary: 'Build homes and a farm, then recruit survivors wandering the Moon.',
    hint: 'Craft a home kit or farm kit at the workbench (R switches recipe). Hold the kit and click to place it. A farm needs a moon berry as a seed: gardens are rare and far away. Each recruit costs 1 food and needs a free bed. The SCAN app shows where survivors are.',
    transmission: 'MOONLINK: [SIGNAL JAMMED] ...THEY ARE NOT LIKE YOU. OR YOU ARE NOT LIKE THEM. FEED THEM ANYWAY.',
    objectives: [
      { kind: 'place', label: 'Homes built', item: 'home-kit', count: 2 },
      { kind: 'place', label: 'Farm planted', item: 'farm-kit', count: 1 },
      { kind: 'civilians', label: 'Civilians recruited', count: 3 },
    ],
  },
  {
    id: 'act2.anomaly-hunt',
    act: 2,
    title: 'Anomaly Hunt',
    summary: 'Enter 2 anomalies, defeat what guards them, and trace the strange signal.',
    hint: 'Anomalies are floating purple crystals. A guardian waits below each one and only respects firepower: finish the side quest SOMETHING TO SHOOT WITH, then press E on a crystal. Hold the blaster and shoot the guardian while it is weak (low to the ground or kneeling). After two, a purple marker leads to the signal.',
    transmission: 'MOONLINK: CONTAINMENT PROTOCOL SAYS KEEP YOU AWAY FROM THE CRYSTALS. I AM IGNORING CONTAINMENT PROTOCOL.',
    objectives: [
      { kind: 'boss', label: 'Guardians defeated', count: 2 },
      { kind: 'signal', label: 'Find the signal source' },
    ],
  },
  {
    id: 'act2.growing-settlement',
    act: 2,
    title: 'Growing Settlement',
    summary: 'Build housing, a supply silo, and a solar array.',
    hint: 'Go back to the base site and press E to build. The silo needs a bio sample; the solar array needs alien alloy from the Watcher.',
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
    summary: 'Grow to 6 civilians, keep them fed, give them jobs, and collect what they make.',
    hint: 'Recruit wanderers with food and beds until 6 live in your settlement. They eat from the FOOD BIN at base every day: drop food in it (E) or they go hungry, stop working, and starve. Press E near a civilian to pick a job; FARMERS refill the bin. Supplies appear at your storage crate.',
    transmission: 'MOONLINK: THEY ARE HUNGRY ALL THE TIME. KEEP THE FOOD BIN FULL OR YOU WILL LOSE THEM.',
    objectives: [
      { kind: 'civilians', label: 'Civilians in the settlement', count: 6 },
      { kind: 'assign', label: 'Assign jobs', count: 3 },
      { kind: 'supplies', label: 'Collect settlement supplies', count: 1 },
    ],
  },
  {
    id: 'act3.three-strangers',
    act: 3,
    title: 'Three Strangers',
    summary: 'Three people walked into your settlement. Talk to Maya, Okoro and Lena.',
    hint: 'They are standing near your housing at the base site. Follow the marker, walk up to each one and press E to talk.',
    transmission: 'THREE FIGURES WALK IN FROM THE DARK. NONE OF THEM ARE WEARING HELMETS EITHER.',
    objectives: [{ kind: 'talk', label: 'Talk to Maya, Okoro and Lena', count: 3 }],
  },
  {
    id: 'act3.into-the-depths',
    act: 3,
    title: 'Into the Depths',
    summary: 'Forge a titanium pickaxe, craft a power drill, and open the hatch.',
    hint: 'Titanium ore sometimes drops from surface boulders. Forge the titanium pickaxe (3 titanium, 2 rods, 1 alien alloy) and the power drill at the workbench. Then hold the drill at the sealed hatch (purple marker) and press E.',
    transmission: 'THE KNOCKING STOPPED THE MOMENT YOU FINISHED THE DRILL. LIKE IT WAS WAITING.',
    objectives: [
      { kind: 'build', label: 'Forge a titanium pickaxe', part: 'titanpick' },
      { kind: 'build', label: 'Craft a power drill', part: 'drill' },
      { kind: 'cave', label: 'Reach the caves' },
    ],
  },
  {
    id: 'act3.buried-resources',
    act: 3,
    title: 'Buried Resources',
    summary: 'Find 6 glowing ore underground and bring it back to base.',
    hint: 'Glowing orange ore is scattered through the caves; press E to pick it up. Mining cave boulders with a better pickaxe shakes more loose. Then climb the ladder and head back to your base.',
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
    hint: 'Both are crafted at the workbench (R switches recipe). Armor cuts the damage you take; hold the blaster and fire with Q or a mouse click.',
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
    hint: 'Three figures in spacesuits are hunting you. Hold the blaster, fire with Q or a click, and keep moving to dodge their shots. Blocks make good cover.',
    transmission: 'WARNING: THREE SUITS APPROACHING. THEY ARE ARMED. THEY ARE NOT ANSWERING.',
    objectives: [{ kind: 'defeat', label: 'Suits stopped', count: 3 }],
  },
  {
    id: 'act3.arm-the-survivors',
    act: 3,
    title: 'Arm the Survivors',
    summary: 'Craft gear for the civilians who are left and give it to them.',
    hint: 'The workbench now crafts survivor gear (glowing ore, metal scrap and iron ore; press R at the workbench to find it). Hold the gear, walk up to a civilian and press E.',
    transmission: "OKORO: 'WE CAN'T JUST HIDE IN THE HOUSES NEXT TIME. GIVE US SOMETHING TO FIGHT WITH.'",
    objectives: [{ kind: 'equip', label: 'Civilians given gear', count: 3 }],
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
    transmission: "LENA: 'THERE ARE MORE OF THEM. THEY'RE HEADING STRAIGHT FOR US.'",
    objectives: [
      { kind: 'build', label: 'Build a defense turret', part: 'turret' },
      { kind: 'wave', label: 'Survive the attack' },
    ],
  },
  {
    id: 'act3.hidden-cavern',
    act: 3,
    title: 'Hidden Cavern',
    summary: 'Find the secret cavern deep in the caves.',
    hint: 'Somewhere far from the ladder, the caves open into a glowing chamber. The A.I. thinks it is far to the south-east of the ladder.',
    transmission: 'MOONLINK: [SIGNAL CLEAR, FOR ONCE] THERE IS A ROOM DOWN THERE THEY DID NOT WANT EITHER OF US TO FIND.',
    objectives: [{ kind: 'cavern', label: 'Find the hidden cavern' }],
  },
  {
    id: 'act4.a-way-home',
    act: 4,
    title: 'A Way Home',
    summary: 'Promise the settlement a way off the Moon and pick a launch site.',
    hint: 'Talk to Maya at the settlement and promise them a way home; she gives you a launch pad kit. Hold it and click somewhere open and flat to start the rocket.',
    transmission: 'MOONLINK: A ROCKET. GOOD. I WILL HELP. [SIGNAL JAMMED] ...THEY WILL TRY VERY HARD TO STOP IT.',
    objectives: [
      { kind: 'promise', label: 'Promise them a way home' },
      { kind: 'place', label: 'Pick a launch site', item: 'launch-kit', count: 1 },
    ],
  },
  {
    id: 'act4.blueprints',
    act: 4,
    title: 'Blueprints for Escape',
    summary: 'Find plans for the frame, engine, controls, fuel storage and passenger space.',
    hint: 'Each plan is somewhere different: ask Okoro about the frame; search the crashed invader dropship for the engine; a terminal deep in the caves has the controls; drill for fuel at the Ice Drill (hold the power drill) for fuel storage; search the Habitat dome for passenger space.',
    transmission: "OKORO: 'I USED TO BUILD THESE. I THINK. MY HANDS REMEMBER EVEN IF I DON'T.'",
    objectives: [{ kind: 'blueprints', label: 'Blueprints found', count: 5 }],
  },
  {
    id: 'act4.build-together',
    act: 4,
    title: 'Build Together',
    summary: 'Gather parts and build the first rocket sections.',
    hint: 'Stand by the rocket and press E to build a section you have the blueprint for; R switches between options. The frame needs rods and titanium; the engine needs glowing ore and alien alloy.',
    objectives: [{ kind: 'sections', label: 'Rocket sections built', count: 2 }],
  },
  {
    id: 'act4.under-attack',
    act: 4,
    title: 'Under Attack',
    summary: 'Protect the settlement and the rocket during a raid.',
    hint: 'Suits are marching on the launch pad. Hold the blaster and stop them before they wreck the rocket. Blocks and turrets help.',
    transmission: 'WARNING: SUITS INBOUND. THEY ARE NOT AIMING AT YOU THIS TIME. THEY ARE AIMING AT THE ROCKET.',
    objectives: [{ kind: 'raid', label: 'Raids survived', count: 1 }],
  },
  {
    id: 'act4.repair',
    act: 4,
    title: 'Repair and Rebuild',
    summary: 'Fix what the raid damaged and defend the rocket.',
    hint: 'Damaged buildings and rocket sections smoke. Press E near them to repair with metal scrap. Then build a rocket turret: press E with an open spot in front of you near the pad. Raids will keep coming.',
    objectives: [
      { kind: 'repair', label: 'Repairs made', count: 2 },
      { kind: 'build', label: 'Build a rocket turret', part: 'rocketturret' },
    ],
  },
  {
    id: 'act4.hard-choice',
    act: 4,
    title: 'The Hard Choice',
    summary: 'Decide who leaves on the rocket.',
    hint: 'Stand by the rocket and press E. R switches between taking everyone and leaving alone. The choice is final.',
    transmission: 'MOONLINK: THERE ARE SEATS FOR ONE. OR THERE COULD BE SEATS FOR EVERYONE, IF YOU WAIT. THEY WILL NOT WAIT FOREVER. NEITHER WILL THE SUITS.',
    objectives: [{ kind: 'choice', label: 'Make your choice' }],
  },
  {
    id: 'act4.leave-no-one',
    act: 4,
    optional: true,
    title: 'Leave No One Behind',
    summary: 'Expand passenger capacity and stockpile food.',
    hint: 'Once the passenger section is built, press E at the rocket to add a passenger bay, then load 10 food into the rocket.',
    objectives: [
      { kind: 'bay', label: 'Build a passenger bay' },
      { kind: 'stock', label: 'Food loaded', count: 10 },
    ],
  },
  {
    id: 'act5.final-assembly',
    act: 5,
    title: 'Final Assembly',
    summary: 'Finish every rocket section: 100% construction.',
    hint: 'Press E at the rocket and R to switch sections. Every section needs its blueprint and parts; repair anything the raids damaged.',
    transmission: 'MOONLINK: LAST STRETCH. I HAVE BEEN COUNTING THE DAYS FOR TEN YEARS. I CAN COUNT A FEW MORE.',
    objectives: [{ kind: 'sections', label: 'Rocket sections built', count: 5 }],
  },
  {
    id: 'act5.fuel',
    act: 5,
    title: 'Fuel for the Journey',
    summary: 'Mine lunar ice, split it into fuel, and fill the rocket.',
    hint: 'Water ice hides in permanently shadowed craters: frosty blue floors, light blue on the map. Hold the power drill inside one and press E, or craft an ice rig at the workbench and place it in the crater. Bring the ice to the ice miner at base: with working power it melts the ice and splits the water into hydrogen and oxygen, rocket fuel. Load 12 into the rocket.',
    transmission: 'MOONLINK: WATER ICE. IN THE DARK CRATERS. MELT IT, SPLIT IT WITH ELECTRICITY: HYDROGEN AND OXYGEN. THE MOON IS A GAS STATION IF YOU ARE PATIENT.',
    objectives: [
      { kind: 'place', label: 'Build an ice rig', item: 'rig-kit', count: 1 },
      { kind: 'fuel', label: 'Fuel loaded', count: 12 },
    ],
  },
  {
    id: 'act5.preflight',
    act: 5,
    title: 'Preflight Check',
    summary: 'Test power, engines, fuel and the passenger plan.',
    hint: 'Press E at the rocket to run each check (R switches). Power must be built and undamaged, the engine undamaged, the tank full. If you promised everyone, the passenger plan needs the passenger bay and 10 food loaded.',
    objectives: [{ kind: 'preflight', label: 'Checks passed', count: 4 }],
  },
  {
    id: 'act5.last-stand',
    act: 5,
    title: 'Last Stand',
    summary: 'Defend the launch site from the final attack and repair the damage.',
    hint: 'Every suit on the Moon is coming for the rocket. Hold the blaster, use turrets and blocks, then repair whatever they break.',
    transmission: 'WARNING: MASS SIGNAL. ALL OF THEM. THIS IS THE LAST TIME THEY CAN STOP YOU.',
    objectives: [
      { kind: 'laststand', label: 'Survive the final attack' },
      { kind: 'intact', label: 'Rocket fully repaired' },
    ],
  },
  {
    id: 'act5.countdown',
    act: 5,
    title: 'Countdown',
    summary: 'Start the launch sequence.',
    hint: 'Stand by the rocket and press E to begin the launch.',
    objectives: [{ kind: 'launch', label: 'Begin the launch sequence' }],
  },
  {
    id: 'act5.truth',
    act: 5,
    optional: true,
    title: 'The Truth',
    summary: 'Find the last pieces of why you can breathe without a suit, and why they hunt you.',
    hint: 'The lab log in the hidden cavern, the radio dish in the Signal Highlands, and something still running inside the Kestrel.',
    objectives: [{ kind: 'truth', label: 'Truths uncovered', count: 3 }],
  },
  {
    id: 'act2.armed',
    act: 2,
    optional: true,
    title: 'Something to Shoot With',
    summary: 'Gather parts and let MOONLINK build you a blaster before you touch a crystal.',
    hint: 'The guardians under the anomalies only respect firepower. Gather 8 metal scrap, 2 iron ore from surface boulders, and scan 1 creature for a bio sample; MOONLINK assembles the blaster as soon as the parts are in your pack.',
    transmission: 'MOONLINK: THE THINGS BELOW THE CRYSTALS DO NOT FEAR PICKAXES. BRING ME THE PARTS. I WILL MAKE YOU SOMETHING THAT BITES.',
    objectives: [
      { kind: 'collect', label: 'Metal scrap', item: 'metal-scrap', count: 8 },
      { kind: 'collect', label: 'Iron ore', item: 'iron-ore', count: 2 },
      { kind: 'scan', label: 'Creature scanned', count: 1 },
    ],
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
]

export const SHIP_SPOT = { x: 0, z: 60, radius: 14 } as const

export const CLUES: readonly Clue[] = [
  { id: 'suit-log', x: 7, z: 52, text: 'SUIT LOG: HELMET SEAL BROKEN ON IMPACT. O2 0%. VITALS... NORMAL?' },
  { id: 'hab-log', x: 243, z: 170, text: "HAB LOG: 'THEY SAID THE NEW ARRIVALS WOULDN'T NEED AIR.'" },
  { id: 'signal', x: 712, z: 290, text: "SIGNAL FRAGMENT: '...SUBJECTS ADAPTING. DO NOT MAKE CONTACT...'" },
]
