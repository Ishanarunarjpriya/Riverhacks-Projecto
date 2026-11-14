import { SCREEN_H } from './constants'
import type { Pt } from './math'

export type Ctx = CanvasRenderingContext2D

export function rect(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
}

export function ellipse(ctx: Ctx, color: string, cx: number, cy: number, a: number, b: number, topHalfOnly = false): void {
  ctx.fillStyle = color
  const bb = Math.max(1, b)
  const top = -Math.floor(bb)
  const bottom = topHalfOnly ? 0 : Math.floor(bb)
  for (let dy = top; dy <= bottom; dy++) {
    const halfW = a * Math.sqrt(Math.max(0, 1 - (dy / bb) ** 2))
    ctx.fillRect(Math.round(cx - halfW), Math.round(cy + dy), Math.max(1, Math.round(halfW * 2)), 1)
  }
}

export type Spans = Map<number, [number, number]>

export function spansOf(pts: Pt[]): Spans {
  const spans: Spans = new Map()
  if (pts.length < 3) return spans
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minY = Math.min(minY, p[1])
    maxY = Math.max(maxY, p[1])
  }
  const first = Math.max(0, Math.ceil(minY - 0.5))
  const last = Math.min(SCREEN_H - 1, Math.floor(maxY - 0.5))
  for (let y = first; y <= last; y++) {
    const yy = y + 0.5
    let left = Infinity
    let right = -Infinity
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) {
        const x = a[0] + ((yy - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
    }
    if (right > left) spans.set(y, [Math.round(left), Math.round(right)])
  }
  return spans
}

export function fillPolygon(ctx: Ctx, color: string, pts: Pt[], clip?: Spans): void {
  ctx.fillStyle = color
  for (const [y, [l, r]] of spansOf(pts)) {
    let a = l
    let b = r
    if (clip) {
      const c = clip.get(y)
      if (!c) continue
      a = Math.max(a, c[0])
      b = Math.min(b, c[1])
    }
    if (b > a) ctx.fillRect(a, y, b - a, 1)
  }
}

export function makeSprite(w: number, h: number, draw: (g: Ctx) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  if (!g) throw new Error('2D canvas is not supported')
  draw(g)
  return canvas
}
