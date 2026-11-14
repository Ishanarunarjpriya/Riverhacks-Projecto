import {
  CAM_BACK,
  CAM_HEIGHT,
  CAM_LAG,
  EYE_Y,
  FOCAL,
  HORIZON_D2,
  PLANET_RADIUS,
  SCREEN_CX,
} from './constants'
import { wrap, type CamPt, type Pt } from './math'

export interface CamPos {
  rx: number
  rz: number
}

export interface ScreenPoint {
  sx: number
  sy: number
  scale: number
  depth: number
}

export class Camera {
  heading = 0
  x = 0
  z = 0
  cos = 1
  sin = 0

  follow(targetX: number, targetZ: number, targetHeading: number, dt: number): void {
    this.heading += (targetHeading - this.heading) * Math.min(1, CAM_LAG * dt)
    this.cos = Math.cos(this.heading)
    this.sin = Math.sin(this.heading)
    this.x = targetX - this.sin * CAM_BACK
    this.z = targetZ - this.cos * CAM_BACK
  }

  toCamera(wx: number, wz: number): CamPos {
    const dx = wrap(wx - this.x)
    const dz = wrap(wz - this.z)
    return { rx: dx * this.cos - dz * this.sin, rz: dx * this.sin + dz * this.cos }
  }

  rotate(vx: number, vz: number): Pt {
    return [vx * this.cos - vz * this.sin, vx * this.sin + vz * this.cos]
  }

  projectPoint(rx: number, rz: number): ScreenPoint | null {
    if (rz < 2) return null
    const d2 = rx * rx + rz * rz
    if (d2 > HORIZON_D2) return null
    const scale = FOCAL / rz
    return {
      sx: SCREEN_CX + rx * scale,
      sy: EYE_Y + (CAM_HEIGHT + d2 / (2 * PLANET_RADIUS)) * scale,
      scale,
      depth: rz,
    }
  }

  projectPolygon(poly: CamPt[]): Pt[] {
    const clipped: CamPt[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const aIn = a[1] >= 1
      const bIn = b[1] >= 1
      if (aIn) clipped.push(a)
      if (aIn !== bIn) {
        const t = (1 - a[1]) / (b[1] - a[1])
        clipped.push([a[0] + (b[0] - a[0]) * t, 1, a[2] + (b[2] - a[2]) * t])
      }
    }
    return clipped.map(([x, z, h]) => {
      let rx = x
      let rz = z
      let d2 = rx * rx + rz * rz
      if (d2 > HORIZON_D2) {
        const k = Math.sqrt(HORIZON_D2 / d2) * 0.999
        rx *= k
        rz *= k
        d2 = rx * rx + rz * rz
      }
      rz = Math.max(rz, 1)
      return [SCREEN_CX + (rx * FOCAL) / rz, EYE_Y + ((CAM_HEIGHT + d2 / (2 * PLANET_RADIUS) - h) * FOCAL) / rz]
    })
  }
}

export function ring(cx: number, cz: number, radius: number, height: number, segments: number): CamPt[] {
  const pts: CamPt[] = []
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    pts.push([cx + Math.cos(t) * radius, cz + Math.sin(t) * radius, height])
  }
  return pts
}

export function horizonY(sx: number): number {
  const u = (sx - SCREEN_CX) / FOCAL
  return EYE_Y + FOCAL * Math.sqrt((2 * CAM_HEIGHT * (1 + u * u)) / PLANET_RADIUS)
}
