import type { ItemId } from './items'
import { rect, type Ctx } from './pixel'

export type Job = 'GATHERER' | 'BUILDER' | 'RESEARCHER' | 'FARMER'

export const JOBS: readonly Job[] = ['GATHERER', 'BUILDER', 'RESEARCHER', 'FARMER']

export const JOB_OUTPUT: Record<Job, ItemId> = {
  GATHERER: 'moon-rock',
  BUILDER: 'metal-scrap',
  RESEARCHER: 'anomaly-shard',
  FARMER: 'moon-berry',
}

export interface Survivor {
  name: string
  x: number
  z: number
  homeX: number
  homeZ: number
  hair: string
  suit: string
  line: string
  job: Job | null
  talked: boolean
  phase: number
  walkTime: number
  targetX: number
  targetZ: number
  stray: boolean
  recruited: boolean
  armed?: boolean
  hunger?: number
}

export const TALK_RANGE = 3.6
export const PRODUCTION_INTERVAL = 12
/** Seconds of play per settlement day. Every civilian eats one meal from the food bin each day. */
export const FOOD_DAY = 75
/** Days in a row without a meal before a civilian starves. */
export const STARVE_DAYS = 3
export const FOOD_BIN = { x: 15, z: 21 } as const

const DEFS = [
  { name: 'MAYA', hair: '#d9a066', suit: '#e0884a', x: 1, z: 17, line: "I WOKE UP IN A CRATER. I DON'T REMEMBER LANDING. I DON'T REMEMBER LEAVING." },
  { name: 'OKORO', hair: '#2a1f1a', suit: '#5dcaa5', x: 33, z: 25, line: "MY SUIT WAS EMPTY WHEN I FOUND IT. LIKE I'D ALREADY TAKEN IT OFF." },
  { name: 'LENA', hair: '#e2e5f2', suit: '#7fb2ff', x: 14, z: 47, line: 'DO YOU HEAR THE HUMMING TOO? IT GETS LOUDER WHEN THE EARTH IS UP.' },
]

const STRAYS = [
  { name: 'TOMAS', hair: '#7a4a2a', suit: '#c9a6ff', x: -110, z: 120, line: 'I HAVE BEEN WALKING FOR DAYS. OR YEARS. THE SUN NEVER MOVES RIGHT.' },
  { name: 'ADA', hair: '#e8c070', suit: '#fac775', x: 190, z: 90, line: 'YOU HAVE FOOD? REAL FOOD? I WILL WORK FOR IT. I WILL WORK FOR ANYTHING.' },
  { name: 'RIN', hair: '#1a1a2a', suit: '#ff8a7a', x: 120, z: 420, line: 'THE DRIFTERS FOLLOWED ME. I THINK THEY WERE KEEPING ME SAFE.' },
  { name: 'SOL', hair: '#c96a4a', suit: '#9fe1cb', x: 470, z: 300, line: 'MY NAME TAG SAYS SOL. I AM CHOOSING TO BELIEVE IT.' },
  { name: 'IVY', hair: '#3d2a1f', suit: '#7fcf6a', x: 600, z: 140, line: 'I DUG A HOLE TO SLEEP IN. THE HOLE WAS ALREADY THERE. SO WAS A PILLOW.' },
  { name: 'BRAM', hair: '#9aa0b8', suit: '#e0884a', x: 380, z: 650, line: 'TEN YEARS. THEY SAID SIX MONTHS. IT HAS BEEN TEN YEARS.' },
  { name: 'NOOR', hair: '#2a1f1a', suit: '#7fb2ff', x: 700, z: 420, line: 'IF I COME WITH YOU, DO I GET A BED? I MISS BEDS.' },
]

export const CIVILIANS_NEEDED = 8

export function createStrays(): Survivor[] {
  return STRAYS.map((d, i) => ({
    name: d.name,
    x: d.x,
    z: d.z,
    homeX: d.x,
    homeZ: d.z,
    hair: d.hair,
    suit: d.suit,
    line: d.line,
    job: null,
    talked: false,
    phase: i * 1.3 + 0.5,
    walkTime: 0,
    targetX: d.x,
    targetZ: d.z,
    stray: true,
    recruited: false,
  }))
}

export function createSurvivors(): Survivor[] {
  return DEFS.map((d, i) => ({
    stray: false,
    recruited: true,
    name: d.name,
    x: d.x,
    z: d.z,
    homeX: d.x,
    homeZ: d.z,
    hair: d.hair,
    suit: d.suit,
    line: d.line,
    job: null,
    talked: false,
    phase: i * 2.1,
    walkTime: 0,
    targetX: d.x,
    targetZ: d.z,
  }))
}

export function nextJob(current: Job | null): Job {
  if (!current) return JOBS[0]
  return JOBS[(JOBS.indexOf(current) + 1) % JOBS.length]
}

export function updateSurvivors(survivors: Survivor[], dt: number, time: number): void {
  for (const s of survivors) {
    const dx = s.targetX - s.x
    const dz = s.targetZ - s.z
    const d = Math.hypot(dx, dz)
    if (d < 0.3) {
      if (Math.sin(time * 0.7 + s.phase) > 0.97) {
        s.targetX = s.homeX + (Math.random() - 0.5) * 7
        s.targetZ = s.homeZ + (Math.random() - 0.5) * 7
      }
      continue
    }
    const step = Math.min(d, 2.2 * dt)
    s.x += (dx / d) * step
    s.z += (dz / d) * step
    s.walkTime += dt
  }
}

export function isWalking(s: Survivor): boolean {
  return Math.hypot(s.targetX - s.x, s.targetZ - s.z) >= 0.3
}

export function drawSurvivor(ctx: Ctx, s: Survivor, sx: number, sy: number): void {
  const fy = Math.round(sy)
  const frame = isWalking(s) ? Math.floor(s.walkTime * 8) % 4 : -1
  const liftL = frame === 2 ? 1 : 0
  const liftR = frame === 0 ? 1 : 0
  rect(ctx, '#d8d9e6', sx - 3, fy - 5 - liftL, 2, 4)
  rect(ctx, '#d8d9e6', sx + 1, fy - 5 - liftR, 2, 4)
  rect(ctx, '#5b6496', sx - 3, fy - 1 - liftL, 2, 1)
  rect(ctx, '#5b6496', sx + 1, fy - 1 - liftR, 2, 1)
  rect(ctx, '#f2f2f8', sx - 4, fy - 11, 8, 6)
  rect(ctx, s.suit, sx - 4, fy - 8, 8, 1)
  rect(ctx, '#d8d9e6', sx - 5, fy - 10, 1, 4)
  rect(ctx, '#d8d9e6', sx + 4, fy - 10, 1, 4)
  if (s.armed) {
    rect(ctx, '#9aa2cf', sx - 5, fy - 11, 2, 2)
    rect(ctx, '#9aa2cf', sx + 3, fy - 11, 2, 2)
    rect(ctx, '#e0884a', sx - 4, fy - 6, 8, 1)
  }
  rect(ctx, '#c98a5a', sx - 1, fy - 12, 2, 1)
  rect(ctx, '#c98a5a', sx - 3, fy - 16, 6, 4)
  rect(ctx, s.hair, sx - 3, fy - 17, 6, 2)
  rect(ctx, s.hair, sx - 3, fy - 15, 1, 2)
  rect(ctx, s.hair, sx + 2, fy - 15, 1, 2)
  rect(ctx, '#1a1c33', sx - 2, fy - 14, 1, 1)
  rect(ctx, '#1a1c33', sx + 1, fy - 14, 1, 1)
}
