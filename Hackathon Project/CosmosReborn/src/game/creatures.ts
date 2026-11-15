import { wrap } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import { isSolidAt, type World } from './world'

export interface Creature {
  id: number
  x: number
  z: number
  homeX: number
  homeZ: number
  heading: number
  phase: number
  scanned: boolean
  fleeing: number
}

export const SCAN_RANGE = 7

const SPECIES_NOTES = [
  'DRIFTER: NO MOUTH. NO LUNGS. IT HUMS AT THE SAME FREQUENCY AS YOUR HEARTBEAT.',
  'DRIFTER: CELLS ARE MADE OF SOMETHING LIKE MOON DUST. IT TURNED TO FACE YOU BEFORE YOU MOVED.',
  'DRIFTER: IT LEAVES NO TRACKS. THE SAMPLE IS WARM.',
  'DRIFTER: THE SCANNER LISTS IT AS "CREW MEMBER". THAT HAS TO BE A GLITCH.',
]

export function speciesNote(c: Creature): string {
  return SPECIES_NOTES[c.id % SPECIES_NOTES.length]
}

export function createCreatures(rng: () => number): Creature[] {
  const homes: [number, number][] = [
    [-70, 90],
    [90, -60],
    [230, 150],
    [150, 540],
    [430, 600],
    [520, 330],
    [650, 120],
    [760, 260],
  ]
  return homes.map(([x, z], id) => ({
    id,
    x,
    z,
    homeX: x,
    homeZ: z,
    heading: rng() * Math.PI * 2,
    phase: rng() * 10,
    scanned: false,
    fleeing: 0,
  }))
}

export function updateCreatures(creatures: Creature[], dt: number, playerX: number, playerZ: number, world: World): void {
  for (const c of creatures) {
    const toPlayer = Math.hypot(wrap(playerX - c.x), wrap(playerZ - c.z))
    const fromHome = Math.hypot(wrap(c.x - c.homeX), wrap(c.z - c.homeZ))
    c.fleeing = Math.max(0, c.fleeing - dt)
    let speed = 2.6
    if (c.fleeing > 0 && toPlayer < 14) {
      c.heading = Math.atan2(wrap(c.x - playerX), wrap(c.z - playerZ))
      speed = 7
    } else if (fromHome > 30) {
      c.heading = Math.atan2(wrap(c.homeX - c.x), wrap(c.homeZ - c.z))
    } else {
      c.heading += (Math.sin(c.phase + performance.now() / 2300) * 0.9 + (Math.random() - 0.5) * 2) * dt
    }
    const nx = c.x + Math.sin(c.heading) * speed * dt
    const nz = c.z + Math.cos(c.heading) * speed * dt
    if (isSolidAt(world, nx, nz)) {
      c.heading += Math.PI / 2
      continue
    }
    c.x = nx
    c.z = nz
  }
}

export function creatureHeight(c: Creature, time: number): number {
  return 2.4 + Math.sin(time * 1.8 + c.phase) * 0.45
}

export function drawCreature(ctx: Ctx, c: Creature, sx: number, groundY: number, s: number, time: number): void {
  const y = groundY - creatureHeight(c, time) * s
  const body = c.scanned ? '#c9a6ff' : '#9fe1cb'
  const core = c.scanned ? '#efe3ff' : '#e9fff6'
  const glow = c.scanned ? '#5b4a8a' : '#2f6f5f'
  const pulse = 1 + Math.sin(time * 3 + c.phase) * 0.08
  ellipse(ctx, glow, sx, y, 1.9 * s * pulse, 1.25 * s * pulse)
  for (let k = 0; k < 4; k++) {
    const ox = (k - 1.5) * 0.55 * s
    const len = Math.max(2, 1.6 * s)
    for (let j = 0; j < len; j += Math.max(1, s * 0.25)) {
      const sway = Math.sin(time * 4 + c.phase + k + j * 0.3) * 0.25 * s
      rect(ctx, body, sx + ox + sway, y + 0.6 * s + j, 1, 1)
    }
  }
  ellipse(ctx, body, sx, y, 1.3 * s, 0.85 * s, true)
  rect(ctx, body, sx - 1.3 * s, y, 2.6 * s, Math.max(1, 0.25 * s))
  ellipse(ctx, core, sx - 0.3 * s, y - 0.35 * s, 0.45 * s, 0.3 * s)
}
