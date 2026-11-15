import { PART_ITEMS } from './base'
import type { Objective } from './quests'

/** One short, plain line telling the player exactly what to press for the current step. */
export function howTo(o: Objective): string {
  switch (o.kind) {
    case 'collect':
      if (o.item === 'ice-miner') return 'Walk up to it and press E to grab it. Walk to base; it drags behind you.'
      if (o.item === 'rare-ore') return 'Glowing orange ore in the caves. Walk up to it and press E.'
      return 'Follow the ◆ marker. Walk up to it and press E to pick it up.'
    case 'collect-any':
      return 'Follow the ◆ marker. Walk up to it and press E to pick it up.'
    case 'build':
      if (o.part === 'minerset' || o.part === 'anvilset') return 'Stand inside the base site and press E to set it up.'
      if (PART_ITEMS[o.part] || o.part === 'slab') return 'Go to the WORKBENCH at base and press E. R switches recipe.'
      return 'Stand inside the base site and press E to build it.'
    case 'place':
      return 'Craft it at the workbench, pick it in your hotbar (1-5), then click to place.'
    case 'blocks':
      return 'Hold crescent shards and click to place a block. Right-click takes one back.'
    case 'mine':
      return 'Hold a pickaxe, walk up to a boulder and click to mine it.'
    case 'region':
      return 'Walk far in any direction. The compass names each new region.'
    case 'scan':
      return 'Walk up to a creature and press E. TAB › SCAN shows where they are.'
    case 'civilians':
      return 'Press E on a wanderer to give 1 food. Needs a free bed. Keep the FOOD BIN full.'
    case 'talk':
      return 'Walk up to each of them and press E.'
    case 'assign':
      return 'Press E next to a civilian to cycle their job.'
    case 'supplies':
      return 'Press E at the storage crate at base to collect.'
    case 'boss':
      return 'Finish SOMETHING TO SHOOT WITH for a blaster, then press E on a purple crystal and shoot the guardian when it is low.'
    case 'signal':
      return 'Follow the purple ◆ marker.'
    case 'cave':
      return 'Hold the power drill at the sealed hatch and press E.'
    case 'cavern':
      return 'In the caves, head far south-east of the ladder.'
    case 'defeat':
    case 'wave':
    case 'raid':
    case 'laststand':
      return 'Hold the blaster. Click or press Q to fire. Keep moving to dodge.'
    case 'equip':
      return 'Hold survivor gear, walk up to a civilian and press E.'
    case 'search-suit':
      return "Walk up to a fallen suit's gear and press E."
    case 'return-to-base':
      return 'Walk back to the base site (follow the ◆ marker).'
    case 'return-to-ship':
    case 'ship':
      return 'Walk to the Kestrel and press E at the open airlock.'
    case 'stock':
    case 'fuel':
    case 'bay':
    case 'sections':
    case 'repair':
    case 'intact':
    case 'preflight':
    case 'launch':
      return 'Go to the rocket and press E. R cycles what the rocket menu does.'
    default:
      return 'Follow the ◆ marker and press E when you get close. TAB › QUESTS has more help.'
  }
}
