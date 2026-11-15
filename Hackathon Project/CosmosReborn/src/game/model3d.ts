import type { Camera } from './camera'
import { CAM_HEIGHT, SUN_DIR } from './constants'
import type { CamPt, Pt } from './math'
import { fillPolygon, type Ctx } from './pixel'

export type V3 = [number, number, number]

export interface Face {
  pts: V3[]
  color: string
  normal?: V3
  backColor?: string
  glow?: boolean
  hull?: boolean
}

export interface Part {
  faces: Face[]
  stacked?: boolean
}

export interface Pose {
  x: number
  z: number
  yaw: number
  roll?: number
  lift?: number
}

const SUN: V3 = (() => {
  const v: V3 = [SUN_DIR[0], 1.1, SUN_DIR[1]]
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
})()

const shadeCache = new Map<string, string>()

function shade(hex: string, f: number): string {
  const key = hex + f
  const cached = shadeCache.get(key)
  if (cached) return cached
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  const out = `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`
  shadeCache.set(key, out)
  return out
}

export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string, top?: string): Part {
  return {
    faces: [
      { pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], color: top ?? color, normal: [0, 1, 0] },
      { pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color, normal: [0, 0, 1] },
      { pts: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], color, normal: [0, 0, -1] },
      { pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], color, normal: [1, 0, 0] },
      { pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], color, normal: [-1, 0, 0] },
    ],
  }
}

export function glowBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string): Part {
  const part = box(x0, x1, y0, y1, z0, z1, color)
  for (const f of part.faces) f.glow = true
  return part
}

export function panel(corners: V3[], front: string, back: string): Part {
  const [a, b, c] = corners
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  return { faces: [{ pts: corners, color: front, backColor: back, normal: n }] }
}

export function disc(center: V3, radius: number, normal: V3, color: string, back: string, segments = 14): Part {
  const nl = Math.hypot(...normal)
  const n: V3 = [normal[0] / nl, normal[1] / nl, normal[2] / nl]
  const ref: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  let u: V3 = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]]
  const ul = Math.hypot(...u)
  u = [u[0] / ul, u[1] / ul, u[2] / ul]
  const v: V3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]
  const pts: V3[] = []
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const c = Math.cos(t) * radius
    const s = Math.sin(t) * radius
    pts.push([center[0] + u[0] * c + v[0] * s, center[1] + u[1] * c + v[1] * s, center[2] + u[2] * c + v[2] * s])
  }
  return { faces: [{ pts, color, backColor: back, normal: n }] }
}

export function dome(radius: number, height: number, colors: (k: number, layers: number) => string, layers = 8, segments = 16): Part {
  const faces: Face[] = []
  const ringAt = (k: number): V3[] => {
    const a = (k / layers) * (Math.PI / 2)
    const r = Math.max(0.15, radius * Math.cos(a))
    const h = height * Math.sin(a)
    const pts: V3[] = []
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2
      pts.push([Math.cos(t) * r, h, Math.sin(t) * r])
    }
    return pts
  }
  for (let k = 0; k < layers; k++) {
    faces.push({ pts: [...ringAt(k), ...ringAt(k + 1)], color: colors(k, layers), hull: true })
  }
  faces.push({ pts: ringAt(layers), color: colors(layers, layers) })
  return { faces, stacked: true }
}

interface Transformed {
  cam: CamPt[]
  world: V3[]
}

export class ModelRenderer {
  private cam: Camera
  private pose: Pose = { x: 0, z: 0, yaw: 0 }
  private center = { rx: 0, rz: 0 }
  private cy = 1
  private sy = 0
  private cr = 1
  private sr = 0

  constructor(cam: Camera) {
    this.cam = cam
  }

  begin(pose: Pose): void {
    this.pose = pose
    this.center = this.cam.toCamera(pose.x, pose.z)
    this.cy = Math.cos(pose.yaw)
    this.sy = Math.sin(pose.yaw)
    this.cr = Math.cos(pose.roll ?? 0)
    this.sr = Math.sin(pose.roll ?? 0)
  }

  toWorldOffset([x, y, z]: V3): V3 {
    const xr = x * this.cr - y * this.sr
    const yr = x * this.sr + y * this.cr + (this.pose.lift ?? 0)
    return [xr * this.cy + z * this.sy, yr, -xr * this.sy + z * this.cy]
  }

  toCam(p: V3): CamPt {
    const [wx, wy, wz] = this.toWorldOffset(p)
    const [rx, rz] = this.cam.rotate(wx, wz)
    return [this.center.rx + rx, this.center.rz + rz, wy]
  }

  project(p: V3): Pt | null {
    const c = this.toCam(p)
    if (c[1] < 1) return null
    const pts = this.cam.projectPolygon([c, c, c])
    return pts[0] ?? null
  }

  draw(ctx: Ctx, parts: Part[]): void {
    const items = parts.map((part) => {
      const faces = part.faces.map((f) => this.transform(f))
      let depth = 0
      let n = 0
      for (const t of faces) for (const c of t.cam) {
        depth += c[1]
        n++
      }
      return { part, faces, depth: depth / Math.max(1, n) }
    })
    items.sort((a, b) => b.depth - a.depth)
    for (const item of items) {
      const order = item.part.faces.map((face, i) => ({ face, t: item.faces[i], depth: avgDepth(item.faces[i].cam) }))
      if (!item.part.stacked) order.sort((a, b) => b.depth - a.depth)
      for (const { face, t } of order) this.fill(ctx, face, t)
    }
  }

  private transform(face: Face): Transformed {
    return { cam: face.pts.map((p) => this.toCam(p)), world: face.pts.map((p) => this.toWorldOffset(p)) }
  }

  private fill(ctx: Ctx, face: Face, t: Transformed): void {
    let color = face.color
    if (face.normal) {
      const [nwx, nwy, nwz] = this.rotateNormal(face.normal)
      const [ncx, ncz] = this.cam.rotate(nwx, nwz)
      const p = t.cam[0]
      const facing = ncx * -p[0] + nwy * (CAM_HEIGHT - p[2]) + ncz * -p[1]
      if (facing <= 0) {
        if (!face.backColor) return
        color = face.backColor
        if (!face.glow) color = shade(color, lightLevel(-nwx, -nwy, -nwz))
      } else if (!face.glow) {
        color = shade(color, lightLevel(nwx, nwy, nwz))
      }
    }
    if (face.hull) {
      const pts = t.cam.filter((c) => c[1] >= 1)
      if (pts.length < 3) return
      fillPolygon(ctx, color, convexHull(this.cam.projectPolygon(pts)))
      return
    }
    fillPolygon(ctx, color, this.cam.projectPolygon(t.cam))
  }

  private rotateNormal([x, y, z]: V3): V3 {
    const xr = x * this.cr - y * this.sr
    const yr = x * this.sr + y * this.cr
    const l = Math.hypot(xr, yr, z) || 1
    return [(xr * this.cy + z * this.sy) / l, yr / l, (-xr * this.sy + z * this.cy) / l]
  }
}

function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

function avgDepth(cam: CamPt[]): number {
  let s = 0
  for (const c of cam) s += c[1]
  return s / Math.max(1, cam.length)
}

function lightLevel(nx: number, ny: number, nz: number): number {
  const d = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2])
  return Math.round((0.62 + 0.42 * d) * 12) / 12
}
