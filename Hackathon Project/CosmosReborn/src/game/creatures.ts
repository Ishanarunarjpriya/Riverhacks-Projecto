import { wrap } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import { walkBlocked, type World } from './world'

export type Species = 'drifter' | 'skitter' | 'loomer' | 'glowmoth' | 'burrower'

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
  species?: Species
}

export const SCAN_RANGE = 7

export const SPECIES: Record<Species, { name: string; color: string; scanned: string; detail: string; notes: string[] }> = {
  drifter: {
    name: 'DRIFTER',
    color: '#9fe1cb',
    scanned: '#c9a6ff',
    detail: 'IT SEEMS TO BE WATCHING YOU',
    notes: [
      'DRIFTER: NO MOUTH. NO LUNGS. IT HUMS AT THE SAME FREQUENCY AS YOUR HEARTBEAT.',
      'DRIFTER: CELLS ARE MADE OF SOMETHING LIKE MOON DUST. IT TURNED TO FACE YOU BEFORE YOU MOVED.',
      'DRIFTER: IT LEAVES NO TRACKS. THE SAMPLE IS WARM.',
      'DRIFTER: THE SCANNER LISTS IT AS "CREW MEMBER". THAT HAS TO BE A GLITCH.',
    ],
  },
  skitter: {
    name: 'SKITTER',
    color: '#fac775',
    scanned: '#c9a6ff',
    detail: 'SIX LEGS. IT KEEPS CIRCLING YOUR BOOTS',
    notes: [
      'SKITTER: SIX LEGS, NO EYES. IT FINDS YOU BY THE VIBRATION OF YOUR FOOTSTEPS.',
      'SKITTER: SHELL IS BASALT. IT EATS THE DUST AND SPITS OUT GLASS BEADS.',
      'SKITTER: IT FOLLOWED YOUR OLD FOOTPRINTS FOR 3 KM. THE PRINTS WERE NOT YOURS.',
    ],
  },
  loomer: {
    name: 'LOOMER',
    color: '#ff9f5a',
    scanned: '#c9a6ff',
    detail: 'TALL AS A HOUSE. IT IS HOLDING ITS LANTERN OUT TO YOU',
    notes: [
      'LOOMER: FOUR METRES TALL, LEGS LIKE ANTENNA MASTS. THE LANTERN IS A SECOND HEART.',
      'LOOMER: IT STANDS STILL FOR DAYS AND WATCHES THE EARTH. TODAY IT WATCHES YOU.',
      'LOOMER: SCAN DATA MATCHES THE KESTREL NAVIGATION LIGHT. EXACTLY.',
    ],
  },
  glowmoth: {
    name: 'GLOWMOTH',
    color: '#9fd4ff',
    scanned: '#c9a6ff',
    detail: 'IT FLUTTERS WITH NO AIR TO FLY IN',
    notes: [
      'GLOWMOTH: WINGS ARE THIN AS FOIL. THERE IS NO AIR, YET IT FLIES.',
      'GLOWMOTH: IT PULSES IN MORSE. THE MESSAGE IS ONE WORD, OVER AND OVER: HOME.',
      'GLOWMOTH: THE DUST IT SHEDS GLOWS FOR HOURS. IT LANDED ON YOUR VISOR AND STAYED.',
    ],
  },
  burrower: {
    name: 'BURROWER',
    color: '#c9a6ff',
    scanned: '#7c85b4',
    detail: 'IT ONLY SURFACES FOR A FEW SECONDS',
    notes: [
      'BURROWER: A WORM OF PLATED STONE. IT TUNNELS IN STRAIGHT LINES TOWARD THE CRASH SITE.',
      'BURROWER: ITS TEETH ARE TITANIUM. THE SCANNER SAYS IT IS VERY OLD AND VERY HUNGRY.',
      'BURROWER: IT SURFACED RIGHT WHERE YOU WERE STANDING A SECOND AGO.',
    ],
  },
}

export function speciesOf(c: Creature): Species {
  return c.species ?? 'drifter'
}

export function speciesNote(c: Creature): string {
  const notes = SPECIES[speciesOf(c)].notes
  return notes[c.id % notes.length]
}

const HOMES: [number, number, Species][] = [
  [-70, 90, 'drifter'],
  [90, -60, 'drifter'],
  [230, 150, 'drifter'],
  [150, 540, 'drifter'],
  [430, 600, 'drifter'],
  [520, 330, 'drifter'],
  [650, 120, 'drifter'],
  [760, 260, 'drifter'],
  [60, 140, 'skitter'],
  [-120, 40, 'skitter'],
  [300, 420, 'skitter'],
  [610, 520, 'skitter'],
  [180, 260, 'loomer'],
  [470, 180, 'loomer'],
  [700, 650, 'loomer'],
  [-40, -90, 'glowmoth'],
  [340, 80, 'glowmoth'],
  [560, 760, 'glowmoth'],
  [120, 360, 'burrower'],
  [400, 300, 'burrower'],
  [800, 480, 'burrower'],
]

export function createCreatures(rng: () => number): Creature[] {
  return HOMES.map(([x, z, species], id) => ({
    id,
    x,
    z,
    homeX: x,
    homeZ: z,
    heading: rng() * Math.PI * 2,
    phase: rng() * 10,
    scanned: false,
    fleeing: 0,
    species,
  }))
}

/** Adds any creatures a save from an older version is missing, and fills in their species. */
export function mergeCreatures(saved: Creature[], fresh: Creature[]): Creature[] {
  const byId = new Map(saved.map((c) => [c.id, c]))
  return fresh.map((f) => {
    const s = byId.get(f.id)
    return s ? { ...s, species: s.species ?? f.species } : f
  })
}

/** Burrowers spend most of their time underground and can only be scanned when up. */
export function surfaced(c: Creature, time: number): boolean {
  return speciesOf(c) !== 'burrower' || Math.sin(time * 0.6 + c.phase) > 0.2
}

export function updateCreatures(creatures: Creature[], dt: number, playerX: number, playerZ: number, world: World): void {
  const now = performance.now() / 1000
  for (const c of creatures) {
    const species = speciesOf(c)
    const toPlayer = Math.hypot(wrap(playerX - c.x), wrap(playerZ - c.z))
    const fromHome = Math.hypot(wrap(c.x - c.homeX), wrap(c.z - c.homeZ))
    c.fleeing = Math.max(0, c.fleeing - dt)
    let speed = species === 'skitter' ? 5 : species === 'loomer' ? 1.4 : species === 'glowmoth' ? 3.6 : species === 'burrower' ? 3 : 2.6
    const towardPlayer = Math.atan2(wrap(playerX - c.x), wrap(playerZ - c.z))
    if (c.fleeing > 0 && toPlayer < 14) {
      c.heading = towardPlayer + Math.PI
      speed = species === 'loomer' ? 4 : 7
    } else if (fromHome > (species === 'loomer' ? 45 : 30)) {
      c.heading = Math.atan2(wrap(c.homeX - c.x), wrap(c.homeZ - c.z))
    } else if (species === 'loomer' && toPlayer < 30 && toPlayer > 9) {
      // Curious: it slowly follows you at a polite distance.
      c.heading = towardPlayer
    } else if (species === 'loomer' && toPlayer <= 9) {
      speed = 0
    } else if (species === 'skitter') {
      // Darts in short zig-zags, circling closer when you are near.
      c.heading += (Math.random() - 0.5) * 9 * dt + (toPlayer < 12 ? 2.4 * dt : 0)
      if (Math.sin(now * 3 + c.phase) > 0.6) speed = 0
    } else if (species === 'glowmoth') {
      c.heading += Math.sin(now * 2.7 + c.phase) * 3 * dt + (Math.random() - 0.5) * 4 * dt
    } else {
      c.heading += (Math.sin(c.phase + now / 2.3) * 0.9 + (Math.random() - 0.5) * 2) * dt
    }
    if (speed === 0) continue
    const nx = c.x + Math.sin(c.heading) * speed * dt
    const nz = c.z + Math.cos(c.heading) * speed * dt
    if (species !== 'glowmoth' && species !== 'burrower' && walkBlocked(world, nx, nz)) {
      c.heading += Math.PI / 2
      continue
    }
    c.x = nx
    c.z = nz
  }
}

export function creatureHeight(c: Creature, time: number): number {
  switch (speciesOf(c)) {
    case 'skitter':
      return 0.5
    case 'loomer':
      return 5.2
    case 'glowmoth':
      return 3.4 + Math.sin(time * 3.1 + c.phase) * 1.1
    case 'burrower':
      return 0.6
    default:
      return 2.4 + Math.sin(time * 1.8 + c.phase) * 0.45
  }
}

export function drawCreature(ctx: Ctx, c: Creature, sx: number, groundY: number, s: number, time: number): void {
  switch (speciesOf(c)) {
    case 'skitter':
      return drawSkitter(ctx, c, sx, groundY, s, time)
    case 'loomer':
      return drawLoomer(ctx, c, sx, groundY, s, time)
    case 'glowmoth':
      return drawGlowmoth(ctx, c, sx, groundY, s, time)
    case 'burrower':
      return drawBurrower(ctx, c, sx, groundY, s, time)
    default:
      return drawDrifter(ctx, c, sx, groundY, s, time)
  }
}

function drawDrifter(ctx: Ctx, c: Creature, sx: number, groundY: number, s: number, time: number): void {
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

function drawSkitter(ctx: Ctx, c: Creature, sx: number, groundY: number, s: number, time: number): void {
  const shell = c.scanned ? '#7c6aa8' : '#5a4a3a'
  const top = c.scanned ? '#c9a6ff' : '#fac775'
  const y = groundY - 0.55 * s
  const u = Math.max(1, Math.round(s * 0.18))
  for (let k = 0; k < 3; k++) {
    const lift = Math.floor(time * 14 + k * 2 + c.phase) % 2 ? 0.15 * s : 0
    for (const side of [-1, 1]) {
      const lx = sx + side * (0.6 + k * 0.35) * s
      rect(ctx, '#3a2f2a', lx, y + 0.1 * s - lift, u, 0.5 * s + lift)
    }
  }
  ellipse(ctx, shell, sx, y, 1.05 * s, 0.5 * s)
  ellipse(ctx, top, sx, y - 0.15 * s, 0.8 * s, 0.3 * s, true)
  rect(ctx, '#ffffff', sx - 0.25 * s, y - 0.35 * s, u, u)
  // Twin feelers.
  const twitch = Math.sin(time * 12 + c.phase) * 0.15 * s
  rect(ctx, top, sx - 0.5 * s + twitch, y - 0.9 * s, u, 0.5 * s)
  rect(ctx, top, sx + 0.4 * s - twitch, y - 0.9 * s, u, 0.5 * s)
}

function drawLoomer(ctx: Ctx, c: Creature, sx: number, groundY: number, s: number, time: number): void {
  const leg = c.scanned ? '#7c85b4' : '#c9cbe0'
  const lantern = c.scanned ? '#c9a6ff' : '#ff9f5a'
  const h = creatureHeight(c, time) * s
  const u = Math.max(1, Math.round(s * 0.14))
  const stride = Math.sin(time * 2 + c.phase) * 0.4 * s
  // Three stilt legs meeting at a small body.
  rect(ctx, leg, sx - 1.1 * s + stride, groundY - h * 0.55, u, h * 0.55)
  rect(ctx, leg, sx + 1.1 * s - stride, groundY - h * 0.55, u, h * 0.55)
  rect(ctx, leg, sx, groundY - h * 0.6, u, h * 0.6)
  rect(ctx, leg, sx - 1.1 * s + stride, groundY - h * 0.6, 2.2 * s - stride * 2 + u, u)
  const by = groundY - h * 0.75
  ellipse(ctx, c.scanned ? '#3f4878' : '#5b6496', sx, by, 0.9 * s, 0.6 * s)
  rect(ctx, leg, sx, groundY - h, u, h * 0.25)
  // Lantern head glows.
  const pulse = 0.5 + Math.sin(time * 2.2 + c.phase) * 0.15
  ellipse(ctx, lantern, sx, groundY - h - 0.3 * s, pulse * s * 1.4, pulse * s * 1.4)
  ellipse(ctx, '#fff6d8', sx, groundY - h - 0.3 * s, pulse * s * 0.6, pulse * s * 0.6)
}

function drawGlowmoth(ctx: Ctx, c: Creature, sx: number, groundY: number, s: number, time: number): void {
  const y = groundY - creatureHeight(c, time) * s
  const wing = c.scanned ? '#c9a6ff' : '#9fd4ff'
  const flap = Math.abs(Math.sin(time * 16 + c.phase))
  const w = (0.4 + flap * 0.9) * s
  ellipse(ctx, wing, sx - w * 0.8, y, w, 0.55 * s)
  ellipse(ctx, wing, sx + w * 0.8, y, w, 0.55 * s)
  ellipse(ctx, '#e8f6ff', sx, y, 0.3 * s, 0.6 * s)
  const glow = Math.sin(time * 5 + c.phase) > 0
  if (glow) rect(ctx, '#ffffff', sx, y + 0.5 * s, 1, 1)
  // Trail of glowing dust.
  for (let k = 1; k < 4; k++) rect(ctx, wing, sx + Math.sin(time * 2 + k + c.phase) * s, y + k * 0.6 * s, 1, 1)
}

function drawBurrower(ctx: Ctx, c: Creature, sx: number, groundY: number, s: number, time: number): void {
  const plate = c.scanned ? '#7c85b4' : '#a98ad8'
  const dark = c.scanned ? '#3f4878' : '#5b4a8a'
  const up = Math.sin(time * 0.6 + c.phase)
  // Dirt mound always shows where it is tunnelling.
  ellipse(ctx, '#6c719a', sx, groundY, 1.4 * s, 0.35 * s)
  if (up <= 0.2) {
    if (Math.random() < 0.3) rect(ctx, '#9aa2c8', sx + (Math.random() - 0.5) * 2 * s, groundY - Math.random() * 0.6 * s, 1, 1)
    return
  }
  const h = Math.min(1, (up - 0.2) / 0.5) * 2.6 * s
  const u = Math.max(1, Math.round(s * 0.2))
  for (let i = 0; i < 5; i++) {
    const seg = (i / 5) * h
    const sway = Math.sin(time * 3 + i * 0.7 + c.phase) * 0.3 * s
    ellipse(ctx, i % 2 ? dark : plate, sx + sway, groundY - seg, 0.7 * s, 0.4 * s)
  }
  const head = groundY - h
  ellipse(ctx, plate, sx, head, 0.8 * s, 0.6 * s)
  for (let k = -1; k <= 1; k++) rect(ctx, '#e6e6ee', sx + k * 0.35 * s, head + 0.2 * s, u, u)
}
