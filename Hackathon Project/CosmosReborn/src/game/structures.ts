import type { ItemId } from './items'
import { box, disc, dome, glowBox, panel, type ModelRenderer, type Part, type V3 } from './model3d'
import { rect, type Ctx } from './pixel'

export type StructureKind =
  | 'lander'
  | 'dome'
  | 'dish'
  | 'solar'
  | 'rover'
  | 'drill'
  | 'satellite'
  | 'shelter'
  | 'storage'
  | 'power'
  | 'housing'
  | 'silo'
  | 'array'
  | 'hatch'
  | 'turret'
  | 'ladder'
  | 'cavern'

export interface Structure {
  kind: StructureKind
  name: string
  x: number
  z: number
  radius: number
  mapColor: string
  yaw?: number
  discoverable?: boolean
}

export interface Inspection {
  text: string
  reward?: { item: ItemId; count: number }
}

export const STRUCTURES: readonly Structure[] = [
  { kind: 'lander', name: 'CRASHED LANDER', x: 0, z: 60, radius: 5, mapColor: '#fac775', yaw: 0.5 },
  { kind: 'dome', name: 'HABITAT', x: 230, z: 180, radius: 11, mapColor: '#ffffff', yaw: 2.2, discoverable: true },
  { kind: 'dish', name: 'RADIO DISH', x: 720, z: 300, radius: 3, mapColor: '#e24b4a', yaw: 3.6, discoverable: true },
  { kind: 'solar', name: 'SOLAR FARM', x: 420, z: 610, radius: 10, mapColor: '#378add', yaw: 0.3, discoverable: true },
  { kind: 'rover', name: 'ROVER', x: 140, z: 500, radius: 5, mapColor: '#d8d9e6', yaw: 1.1, discoverable: true },
  { kind: 'drill', name: 'ICE DRILL', x: 640, z: 90, radius: 4, mapColor: '#5dcaa5', yaw: 0.4, discoverable: true },
  { kind: 'satellite', name: 'CRASHED SAT', x: 540, z: 350, radius: 5, mapColor: '#e0884a', yaw: 4.1, discoverable: true },
  { kind: 'hatch', name: 'SEALED HATCH', x: 330, z: 800, radius: 2.6, mapColor: '#c9a6ff', yaw: 0.7 },
]

export const INSPECTIONS: Partial<Record<StructureKind, Inspection>> = {
  lander: {
    text: 'HULL BREACHED. FLIGHT COMPUTER DEAD. THE AIRLOCK WAS OPENED FROM THE OUTSIDE.',
    reward: { item: 'metal-scrap', count: 2 },
  },
  dome: { text: 'THE DOOR IS SEALED. SOMEONE SCRATCHED TALLY MARKS INTO THE GLASS. HUNDREDS OF THEM.' },
  dish: { text: "STATIC... THEN A VOICE THAT SOUNDS LIKE YOURS: 'DON'T TRUST THE SUITS.'" },
  solar: {
    text: 'THE PANELS ARE CRACKED BUT STILL PRODUCING POWER. THE CABLES RUN STRAIGHT DOWN INTO THE GROUND.',
    reward: { item: 'metal-scrap', count: 2 },
  },
  rover: {
    text: 'THE WHEEL TRACKS LEAD AWAY FROM IT, NOT TOWARD IT. THE SEAT IS STILL WARM.',
    reward: { item: 'repair-kit', count: 1 },
  },
  drill: {
    text: 'THE ICE CORE IS FROZEN AROUND SOMETHING THAT PULSES. THE DRILL KEEPS TURNING ON ITS OWN.',
    reward: { item: 'moon-rock', count: 3 },
  },
  satellite: {
    text: 'THE MARKINGS LOOK FAMILIAR. THE LAUNCH DATE PRINTED ON IT IS 40 YEARS IN THE FUTURE.',
    reward: { item: 'metal-scrap', count: 3 },
  },
  hatch: { text: 'A SEALED HATCH, HALF BURIED IN DUST. YOU KNOCK. SOMETHING BELOW KNOCKS BACK. THREE TIMES.' },
  cavern: {
    text: 'THE WALLS ARE COVERED IN HANDPRINTS. HUNDREDS OF THEM. EVERY ONE IS EXACTLY THE SIZE OF YOURS.',
    reward: { item: 'rare-ore', count: 3 },
  },
}

const ROLL: Partial<Record<StructureKind, number>> = { lander: 0.16, satellite: -0.28 }

export function drawStructure(ctx: Ctx, model: ModelRenderer, s: Structure, scale: number, time: number): void {
  model.begin({ x: s.x, z: s.z, yaw: s.yaw ?? 0, roll: ROLL[s.kind] })
  model.draw(ctx, buildModel(s.kind, time))
  drawEffects(ctx, model, s.kind, scale, time)
}

function buildModel(kind: StructureKind, time: number): Part[] {
  const blink = Math.floor(time * 2) % 2 === 1
  switch (kind) {
    case 'lander':
      return [
        box(-4.3, -3.8, 0, 2.8, -4.3, -3.8, '#c9cbe0'),
        box(3.8, 4.3, 0, 1.6, -4.3, -3.8, '#c9cbe0'),
        box(-4.3, -3.8, 0, 2.8, 3.8, 4.3, '#c9cbe0'),
        box(3.8, 4.3, 0, 2.8, 3.8, 4.3, '#c9cbe0'),
        box(-3.6, 3.6, 2.4, 6.4, -3.6, 3.6, '#d4a43c', '#f2c85e'),
        box(1, 3.4, 3, 5.4, 3.6, 3.7, '#3b2f2a'),
        box(-1.2, 1, 3.2, 4.8, -3.7, -3.6, '#2a2238'),
        box(-2.3, 2.3, 6.4, 8.8, -2.3, 2.3, '#e6e6ee'),
        glowBox(-0.9, 0.9, 7.1, 8.1, 2.3, 2.4, '#16182c'),
        box(5.2, 5.5, 0, 8.6, 0, 0.3, '#c9cbe0'),
        panel([[5.5, 8.6, 0.15], [8.1, 8.4, 0.15], [8.1, 7.4, 0.15], [5.5, 7.6, 0.15]], '#e24b4a', '#a83432'),
        panel([[5.5, 7.6, 0.15], [7.4, 7.5, 0.15], [7.4, 6.8, 0.15], [5.5, 6.9, 0.15]], '#ffffff', '#c9cbe0'),
      ]
    case 'dome': {
      const glass = (k: number, n: number) => (k === 2 ? '#2c5fa8' : k < 2 ? '#a9adc6' : k === n ? '#ffffff' : k > n - 3 ? '#eef0f8' : '#d8d9e6')
      return [
        dome(9.5, 8, glass),
        box(8.5, 14, 0, 3.2, -1.6, 1.6, '#d8d9e6', '#eef0f8'),
        box(14, 14.1, 0.2, 2.6, -0.7, 0.7, '#3f4878'),
        box(-0.2, 0.2, 7.5, 10.6, -0.2, 0.2, '#d8d9e6'),
        glowBox(-0.4, 0.4, 10.6, 11.4, -0.4, 0.4, blink ? '#e24b4a' : '#5a2a2a'),
      ]
    }
    case 'dish': {
      const n: V3 = [0, 0.55, 1]
      return [
        box(-1.6, 1.6, 0, 1, -1.6, 1.6, '#9aa0b8', '#c9cbe0'),
        box(-0.4, 0.4, 1, 10, -0.4, 0.4, '#9aa0b8'),
        disc([0, 11, 0.2], 5.5, n, '#e6e6ee', '#7c85b4', 18),
        disc([0, 11.2, 0.6], 3.8, n, '#b9bdd4', '#7c85b4', 14),
        box(-0.15, 0.15, 11, 13.5, 0.9, 1.2, '#e6e6ee'),
        glowBox(-0.5, 0.5, 13.5, 14.3, 0.6, 1.5, blink ? '#e24b4a' : '#5a2a2a'),
      ]
    }
    case 'solar': {
      const parts: Part[] = []
      for (const x of [-7, 0, 7]) {
        parts.push(box(x - 0.2, x + 0.2, 0, 2.6, -0.2, 0.2, '#9aa0b8'))
        parts.push(panel([[x - 3, 2.2, -1.5], [x + 3, 2.2, -1.5], [x + 3, 4, 1.5], [x - 3, 4, 1.5]], '#2c5fa8', '#5b6496'))
      }
      return parts
    }
    case 'rover': {
      const parts: Part[] = []
      for (const x of [-3.4, 0, 3.4]) for (const z of [-2.3, 2.3]) parts.push(box(x - 0.9, x + 0.9, 0, 1.8, z - 0.35, z + 0.35, '#2e3352', '#4b5488'))
      parts.push(box(-4.6, 4.6, 1.5, 3.6, -2, 2, '#e6e6ee', '#ffffff'))
      parts.push(box(-4.65, 4.65, 1.5, 2.1, -2.05, 2.05, '#d4a43c'))
      parts.push(box(-4.6, 1.4, 3.6, 4.1, -1.8, 1.8, '#1d3f86', '#3b7dd8'))
      parts.push(box(3, 3.4, 3.6, 7, -0.2, 0.2, '#c9cbe0'))
      parts.push(box(2.4, 4.2, 7, 8, -0.6, 0.6, '#e6e6ee'))
      parts.push(glowBox(4.2, 4.3, 7.2, 7.8, -0.3, 0.3, '#3b7dd8'))
      return parts
    }
    case 'drill': {
      const parts: Part[] = [box(-3.6, 3.6, 0, 0.8, -3.6, 3.6, '#5b6496', '#7c85b4')]
      for (const x of [-2.6, 2.6]) for (const z of [-2.6, 2.6]) parts.push(box(x - 0.3, x + 0.3, 0.8, 12, z - 0.3, z + 0.3, '#9aa0b8'))
      for (const h of [4, 8]) {
        parts.push(box(-2.6, 2.6, h, h + 0.3, -2.75, -2.45, '#7c85b4'))
        parts.push(box(-2.6, 2.6, h, h + 0.3, 2.45, 2.75, '#7c85b4'))
        parts.push(box(-2.75, -2.45, h, h + 0.3, -2.6, 2.6, '#7c85b4'))
        parts.push(box(2.45, 2.75, h, h + 0.3, -2.6, 2.6, '#7c85b4'))
      }
      parts.push(box(-0.5, 0.5, 0.8, 12, -0.5, 0.5, '#2e3352'))
      for (let k = 0; k < 4; k++) {
        const y = 1.2 + ((time * 6 + k * 2.6) % 10.4)
        parts.push(glowBox(-0.55, 0.55, y, y + 0.4, -0.55, 0.55, '#9aa2cf'))
      }
      parts.push(glowBox(-1.3, 1.3, 0.8, 1.7, -1.3, 1.3, Math.sin(time * 4) > 0 ? '#9fe1cb' : '#5dcaa5'))
      parts.push(box(-3.4, 3.4, 12, 13.8, -3.4, 3.4, '#d4a43c', '#f2c85e'))
      parts.push(glowBox(-2.9, -2.3, 13.2, 13.8, -3.45, -3.4, blink ? '#5dcaa5' : '#1d5c4a'))
      return parts
    }
    case 'satellite':
      return [
        box(-2, 2, 0, 3.4, -2, 2, '#d4a43c', '#f2c85e'),
        box(2, 8, 1.2, 1.5, -1.3, 1.3, '#1d3f86', '#3b7dd8'),
        box(-7.5, -2.5, 0, 0.3, -1, 1.2, '#1d3f86', '#2c5fa8'),
        box(-0.15, 0.15, 3.4, 6.2, -0.15, 0.15, '#c9cbe0'),
        disc([0, 6.2, 0], 1, [0.3, 1, 0.2], '#e6e6ee', '#9aa0b8', 10),
      ]
    case 'shelter': {
      const skin = (k: number, n: number) => (k === 2 ? '#e0884a' : k < 2 ? '#a9adc6' : k === n ? '#ffffff' : '#eef0f8')
      return [
        box(-4.9, 4.9, 0, 0.5, -4.9, 4.9, '#9aa0b8', '#c9cbe0'),
        dome(4.6, 3.8, skin, 7),
        box(-0.9, 0.9, 0.4, 2.6, 4.2, 5.2, '#c9cbe0', '#e6e6ee'),
        box(-0.6, 0.6, 0.5, 2.2, 5.2, 5.25, '#3f4878'),
      ]
    }
    case 'storage':
      return [
        box(-2.2, 2.2, 0, 3, -2.2, 2.2, '#7c85b4', '#9aa2cf'),
        box(-2.25, 2.25, 1.3, 1.75, -2.25, 2.25, '#e0884a'),
        box(-0.3, 0.3, 2, 2.6, 2.25, 2.3, '#3f4878'),
      ]
    case 'housing':
      return [
        box(-3.6, 3.6, 0, 0.4, -2.4, 2.4, '#9aa0b8', '#c9cbe0'),
        box(-3.4, 3.4, 0.4, 3.6, -2.2, 2.2, '#e6e6ee', '#ffffff'),
        box(-3.45, 3.45, 2.2, 2.6, -2.25, 2.25, '#e0884a'),
        box(-3.6, 3.6, 3.6, 4, -2.4, 2.4, '#9aa0b8', '#c9cbe0'),
        box(-0.7, 0.7, 0.4, 2.2, 2.2, 2.3, '#3f4878'),
        glowBox(1.4, 2.6, 1.2, 2, 2.2, 2.25, Math.floor(time * 0.5) % 3 === 0 ? '#5a4a2a' : '#fac775'),
        glowBox(-2.6, -1.4, 1.2, 2, 2.2, 2.25, '#fac775'),
        box(2.6, 2.8, 4, 6, -1.6, -1.4, '#c9cbe0'),
      ]
    case 'silo':
      return [
        box(-2, 2, 0, 0.5, -2, 2, '#5b6496', '#7c85b4'),
        box(-1.6, 1.6, 0.5, 6, -1.6, 1.6, '#c9cbe0', '#e6e6ee'),
        box(-1.65, 1.65, 4.4, 4.9, -1.65, 1.65, '#e0884a'),
        dome(1.6, 1.2, (k) => (k < 2 ? '#d8d9e6' : '#ffffff'), 4, 10),
        box(1.6, 1.7, 0.6, 5.6, -0.2, 0.2, '#9aa0b8'),
      ].map((part, i) => (i === 3 ? lift(part, 6) : part))
    case 'array': {
      const parts: Part[] = []
      for (const x of [-2.8, 2.8]) {
        parts.push(box(x - 0.2, x + 0.2, 0, 2.4, -0.2, 0.2, '#9aa0b8'))
        parts.push(panel([[x - 2.6, 2, -1.8], [x + 2.6, 2, -1.8], [x + 2.6, 4, 1.8], [x - 2.6, 4, 1.8]], '#2c5fa8', '#5b6496'))
      }
      parts.push(box(-1, 1, 0, 1.4, 2.4, 3.6, '#5b6496', '#7c85b4'))
      parts.push(glowBox(-0.5, 0.5, 1.4, 1.5, 2.8, 3.2, blink ? '#c9a6ff' : '#5b4a8a'))
      return parts
    }
    case 'hatch':
      return [
        box(-2.6, 2.6, 0, 0.35, -2.6, 2.6, '#4b5488', '#5b6496'),
        disc([0, 0.4, 0], 1.9, [0, 1, 0], '#7c85b4', '#4b5488', 16),
        box(-1.4, 1.4, 0.4, 0.6, -0.15, 0.15, '#c9cbe0'),
        box(-0.15, 0.15, 0.4, 0.6, -1.4, 1.4, '#c9cbe0'),
        glowBox(-0.3, 0.3, 0.6, 0.7, -0.3, 0.3, blink ? '#c9a6ff' : '#5b4a8a'),
      ]
    case 'turret': {
      const aim = time * 0.8
      const c = Math.cos(aim)
      const s = Math.sin(aim)
      const barrel = (len: number): V3[] => [
        [c * 0.3 - s * 0.25, 3.1, s * 0.3 + c * 0.25],
        [c * len - s * 0.25, 3.1, s * len + c * 0.25],
        [c * len + s * 0.25, 3.1, s * len - c * 0.25],
        [c * 0.3 + s * 0.25, 3.1, s * 0.3 - c * 0.25],
      ]
      return [
        box(-1.6, 1.6, 0, 0.6, -1.6, 1.6, '#5b6496', '#7c85b4'),
        box(-0.5, 0.5, 0.6, 2.4, -0.5, 0.5, '#9aa0b8'),
        box(-1.1, 1.1, 2.4, 3.6, -1.1, 1.1, '#e6e6ee', '#ffffff'),
        panel(barrel(3), '#3f4878', '#3f4878'),
        glowBox(-0.3, 0.3, 3.6, 3.8, -0.3, 0.3, blink ? '#ff8a7a' : '#7a2e2e'),
      ]
    }
    case 'ladder':
      return [
        box(-2.4, 2.4, 0, 0.3, -2.4, 2.4, '#3f4878', '#4b5488'),
        box(-1.1, -0.8, 0, 9, -0.15, 0.15, '#9aa0b8'),
        box(0.8, 1.1, 0, 9, -0.15, 0.15, '#9aa0b8'),
        ...[1.5, 3, 4.5, 6, 7.5].map((y) => box(-0.8, 0.8, y, y + 0.2, -0.1, 0.1, '#c9cbe0')),
        glowBox(-0.3, 0.3, 9, 9.4, -0.3, 0.3, '#fac775'),
      ]
    case 'cavern': {
      const parts: Part[] = []
      const spikes: [number, number, number, string][] = [
        [0, 0, 6, '#ff9f5a'],
        [2.2, 1, 4, '#c9a6ff'],
        [-2, 1.5, 4.5, '#ff9f5a'],
        [0.8, -2.2, 3.5, '#9fe1cb'],
        [-1.4, -1.6, 3, '#c9a6ff'],
      ]
      for (const [x, z, h, col] of spikes) {
        const pulse = Math.sin(time * 2 + x) > 0
        parts.push(glowBox(x - 0.45, x + 0.45, 0, h, z - 0.45, z + 0.45, pulse ? col : '#5a3a26'))
      }
      return parts
    }
    case 'power':
      return [
        box(-0.2, 0.2, 0, 4, -0.2, 0.2, '#9aa0b8'),
        panel([[-2.6, 4, -1], [2.6, 4, -1], [2.6, 5.4, 1], [-2.6, 5.4, 1]], '#2c5fa8', '#5b6496'),
        box(1.2, 3, 0, 1.6, 0.6, 1.9, '#5b6496', '#7c85b4'),
        glowBox(1.8, 2.4, 1.6, 1.75, 1, 1.5, blink ? '#5dcaa5' : '#1d5c4a'),
      ]
  }
}

function lift(part: Part, dy: number): Part {
  return { ...part, faces: part.faces.map((f) => ({ ...f, pts: f.pts.map(([x, y, z]): V3 => [x, y + dy, z]) })) }
}

function drawEffects(ctx: Ctx, model: ModelRenderer, kind: StructureKind, scale: number, time: number): void {
  if (kind === 'lander') {
    for (let i = 0; i < 7; i++) {
      const t = (time * 0.35 + i / 7) % 1
      const p = model.project([1.5 + Math.sin(t * 6 + i) * 0.6 + t * 1.5, 7 + t * 9, 0])
      if (!p) continue
      const size = (0.6 + t * 1.4) * scale
      rect(ctx, t < 0.25 ? '#6c719a' : t < 0.6 ? '#4b5488' : '#353d6c', p[0] - size / 2, p[1] - size / 2, size, size)
    }
    if (Math.sin(time * 9) > 0.6) {
      const p = model.project([2.2, 5, 3.7])
      if (p) {
        rect(ctx, '#fac775', p[0], p[1], 1, 1)
        rect(ctx, '#ffffff', p[0] + 1, p[1] - 1, 1, 1)
      }
    }
  } else if (kind === 'satellite' && Math.sin(time * 13) > 0.3) {
    const p = model.project([2.2, 2.4, 0])
    if (p) {
      rect(ctx, '#fac775', p[0], p[1], 1, 1)
      rect(ctx, '#ffffff', p[0] - 1, p[1] - 1, 1, 1)
    }
  } else if (kind === 'dome') {
    const center = model.toCam([0, 0, 0])
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const r = 9.5 * Math.cos(Math.PI / 8) + 0.1
      const out = model.toCam([Math.cos(a) * 10, 0, Math.sin(a) * 10])
      if (out[1] >= center[1] || i % 2 !== Math.floor(time) % 2) continue
      const p = model.project([Math.cos(a) * r, 8 * Math.sin(Math.PI / 8) + 0.6, Math.sin(a) * r])
      if (p) rect(ctx, '#fac775', p[0], p[1], 1, 1)
    }
  }
}
