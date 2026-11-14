import { EYE_Y, FOCAL } from './constants'
import { ellipse, rect, type Ctx } from './pixel'

export type StructureKind = 'lander' | 'dome' | 'dish' | 'solar' | 'rover' | 'drill' | 'satellite'

export interface Structure {
  kind: StructureKind
  name: string
  x: number
  z: number
  radius: number
  mapColor: string
}

export const STRUCTURES: readonly Structure[] = [
  { kind: 'lander', name: 'LANDER', x: 0, z: 60, radius: 5, mapColor: '#fac775' },
  { kind: 'dome', name: 'HABITAT', x: 230, z: 180, radius: 11, mapColor: '#ffffff' },
  { kind: 'dish', name: 'RADIO DISH', x: 720, z: 300, radius: 3, mapColor: '#e24b4a' },
  { kind: 'solar', name: 'SOLAR FARM', x: 420, z: 610, radius: 10, mapColor: '#378add' },
  { kind: 'rover', name: 'ROVER', x: 140, z: 500, radius: 5, mapColor: '#d8d9e6' },
  { kind: 'drill', name: 'ICE DRILL', x: 640, z: 90, radius: 4, mapColor: '#5dcaa5' },
  { kind: 'satellite', name: 'CRASHED SAT', x: 540, z: 350, radius: 5, mapColor: '#e0884a' },
]

export function drawStructure(ctx: Ctx, s: Structure, sx: number, sy: number, scale: number, time: number): void {
  const box = (c: string, ux: number, top: number, uw: number, uh: number) =>
    rect(ctx, c, sx + ux * scale, sy - top * scale, uw * scale, uh * scale)
  const blink = Math.floor(time * 2) % 2 === 1
  const tilt = Math.max(0.08, (sy - EYE_Y) / FOCAL)

  switch (s.kind) {
    case 'lander':
      box('#c9cbe0', -4.5, 3, 0.5, 3)
      box('#c9cbe0', 4, 3, 0.5, 3)
      box('#d4a43c', -3.5, 7, 7, 4)
      box('#f2c85e', -3.5, 7, 7, 1)
      box('#e6e6ee', -2.3, 9.6, 4.6, 2.6)
      box('#3b7dd8', -0.8, 9, 1.6, 1)
      box('#e6e6ee', 5.5, 11, 0.35, 11)
      box('#e24b4a', 5.85, 11, 3.5, 1.2)
      box('#ffffff', 5.85, 9.8, 3.5, 1.1)
      break
    case 'dome':
      box('#d8d9e6', 8, 3, 6, 3)
      box('#3f4878', 12.6, 2.4, 1, 2.4)
      ellipse(ctx, '#a9adc6', sx, sy, 10 * scale, 8 * scale, true)
      ellipse(ctx, '#eef0f8', sx - scale, sy - 0.5 * scale, 8.6 * scale, 7.3 * scale, true)
      box('#2c5fa8', -7.5, 4.6, 15, 1.1)
      for (const u of [-5.5, -2, 1.5, 5]) box('#fac775', u, 4.4, 1, 0.7)
      box('#d8d9e6', -0.2, 10.5, 0.4, 2.6)
      if (blink) box('#e24b4a', -0.4, 11, 0.8, 0.8)
      break
    case 'dish':
      box('#9aa0b8', -0.4, 9, 0.8, 9)
      box('#9aa0b8', -1.5, 1, 3, 1)
      ellipse(ctx, '#e6e6ee', sx, sy - 11 * scale, 5.5 * scale, 2.8 * scale)
      ellipse(ctx, '#b9bdd4', sx, sy - 11 * scale + 0.4 * scale, 4 * scale, 1.9 * scale)
      box('#e6e6ee', -0.15, 14, 0.3, 3)
      if (blink) box('#e24b4a', -0.5, 14.6, 1, 1)
      break
    case 'solar':
      for (let i = -1; i <= 1; i++) {
        box('#9aa0b8', i * 7 - 0.2, 2.5, 0.4, 2.5)
        box('#1d3f86', i * 7 - 3, 4.6, 6, 2.4)
        box('#3b7dd8', i * 7 - 3, 4.6, 6, 0.5)
        box('#5c8fe0', i * 7 - 0.1, 4.6, 0.25, 2.4)
      }
      break
    case 'rover':
      for (const u of [-4, 0, 4]) ellipse(ctx, '#2e3352', sx + u * scale, sy - 0.9 * scale, 1.1 * scale, 1.1 * scale)
      box('#e6e6ee', -5, 3.6, 10, 2)
      box('#d4a43c', -5, 2.2, 10, 0.6)
      box('#1d3f86', -5, 4.2, 7, 0.6)
      box('#c9cbe0', 3, 7.2, 0.5, 3.4)
      box('#e6e6ee', 2.3, 8, 1.8, 1.1)
      box('#3b7dd8', 3.3, 7.7, 0.6, 0.5)
      break
    case 'drill': {
      const pulse = Math.sin(time * 4) > 0
      ellipse(ctx, pulse ? '#9fe1cb' : '#5dcaa5', sx, sy - 0.3 * scale, 3.4 * scale, 3.4 * scale * tilt)
      box('#9aa0b8', -2.6, 12, 0.6, 12)
      box('#9aa0b8', 2, 12, 0.6, 12)
      for (let h = 2; h < 12; h += 2.5) box('#9aa0b8', -2.6, h, 5.2, 0.35)
      box('#f2c85e', -3.2, 13.2, 6.4, 1.3)
      box('#3f4878', -0.3, 11, 0.6, 10)
      break
    }
    case 'satellite':
      box('#d4a43c', -2, 3.4, 4, 3.4)
      box('#f2c85e', -2, 3.4, 4, 0.7)
      box('#1d3f86', 2, 2.6, 6, 1.3)
      box('#3b7dd8', 2, 2.6, 6, 0.35)
      box('#1d3f86', -8, 1.6, 5, 1.1)
      box('#c9cbe0', -0.2, 6, 0.35, 2.6)
      if (Math.sin(time * 13) > 0.3) {
        box('#fac775', 2.3, 3.6, 0.5, 0.5)
        box('#ffffff', 1.6, 4.2, 0.4, 0.4)
      }
      break
  }
}
