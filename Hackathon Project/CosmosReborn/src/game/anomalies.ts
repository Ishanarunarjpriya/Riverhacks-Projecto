import { panel, type ModelRenderer, type Part, type V3 } from './model3d'
import { rect, type Ctx } from './pixel'

export interface Anomaly {
  id: string
  x: number
  z: number
  text: string
}

export const ANOMALIES: readonly Anomaly[] = [
  { id: 'warm-air', x: -120, z: 160, text: 'THE AIR AROUND IT IS WARM. YOUR TABLET CLOCK JUMPS BACK THREE MINUTES. IT ONLY HAPPENS WHEN YOU STAND CLOSE.' },
  { id: 'humming-shard', x: 380, z: 470, text: 'A SHARD BREAKS OFF IN YOUR HAND. IT IS HUMMING A SONG YOU KNOW FROM HOME. IT STOPS WHEN YOU WALK AWAY.' },
  { id: 'reflection', x: 700, z: 540, text: 'IT SHOWS YOUR REFLECTION... WEARING A HELMET. THE REFLECTION LOOKS SCARED OF YOU.' },
  { id: 'echo', x: 150, z: 300, text: 'YOU HEAR YOUR OWN FOOTSTEPS A SECOND AFTER YOU TAKE THEM. THEN A SECOND BEFORE.' },
  { id: 'heartbeat', x: 520, z: 120, text: 'THE CRYSTAL PULSES. IT MATCHES YOUR HEARTBEAT EXACTLY. IT SPEEDS UP WHEN YOU DO.' },
  { id: 'old-photo', x: 820, z: 760, text: 'FROZEN INSIDE: A PHOTO OF A LAUNCH CREW. ONE FACE IS SCRATCHED OUT. THE OTHERS ARE LOOKING AT IT.' },
  { id: 'footprints', x: 260, z: 640, text: 'A RING OF BAREFOOT PRINTS AROUND IT. THEY ARE YOUR SIZE. THEY ARE FRESH.' },
  { id: 'static', x: 620, z: 860, text: 'YOUR TABLET FILLS WITH STATIC. FOR ONE FRAME IT SHOWS THE WORDS: SUBJECT PROXIMITY DETECTED.' },
  { id: 'gravity', x: 60, z: 520, text: 'DUST FLOATS UPWARD AROUND IT, THEN SLOWLY FALLS TOWARD YOU INSTEAD OF THE GROUND.' },
]

export const ANOMALY_BEAM_RANGE = 320
export const ANOMALY_INTRO =
  'MOONLINK: THAT IS AN ANOMALY. A PLACE WHERE SPACE BENDS AROUND SOMETHING THAT SHOULD NOT EXIST UP HERE. THEY ONLY GLOW WHEN YOU ARE NEAR. [SIGNAL JAMMED] ...I WAS TOLD TO KEEP YOU AWAY FROM THEM.'

export const HATCH = { x: 330, z: 800 } as const

export const ANOMALY_RANGE = 6
export const HATCH_RANGE = 10

export function anomalyHeight(time: number, a: Anomaly): number {
  return 4.2 + Math.sin(time * 1.4 + a.x) * 0.4
}

function crystal(h: number, color: string, back: string): Part[] {
  const top: V3 = [0, h + 2.8, 0]
  const bottom: V3 = [0, h - 2.6, 0]
  const eq: V3[] = [
    [1.7, h, 0],
    [0, h, 1.7],
    [-1.7, h, 0],
    [0, h, -1.7],
  ]
  const parts: Part[] = []
  for (let i = 0; i < 4; i++) {
    const a = eq[i]
    const b = eq[(i + 1) % 4]
    parts.push(panel([a, b, top], color, back))
    parts.push(panel([b, a, bottom], color, back))
  }
  return parts
}

export function drawAnomaly(ctx: Ctx, model: ModelRenderer, a: Anomaly, investigated: boolean, scale: number, time: number): void {
  const h = anomalyHeight(time, a)
  const color = investigated ? '#7c6fb0' : '#d6b8ff'
  model.begin({ x: a.x, z: a.z, yaw: time * 0.9 })
  model.draw(ctx, crystal(h, color, investigated ? '#6a5ea0' : '#c9a6ff'))
  if (investigated) return
  for (let i = 0; i < 6; i++) {
    const t = (time * 0.5 + i / 6) % 1
    const angle = i * 1.7 + time * 0.3
    const p = model.project([Math.cos(angle) * 2.4, t * (h + 3), Math.sin(angle) * 2.4])
    if (p) rect(ctx, t < 0.5 ? '#efe3ff' : '#c9a6ff', p[0], p[1], Math.max(1, scale * 0.25), Math.max(1, scale * 0.25))
  }
}
