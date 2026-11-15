import { ring, type Camera, type CamPos } from './camera'
import { FOCAL, SUN_DIR } from './constants'
import { clamp } from './math'
import { fillPolygon, rect, spansOf, type Ctx } from './pixel'
import { CRATER_FLOOR_RATIO, type Crater } from './world'

const WALL = ['#262c52', '#353d6c', '#4b5488', '#6c76ad', '#9aa2cf']
const BANDS = 3

export function drawCrater(ctx: Ctx, cam: Camera, crater: Crater, pos: CamPos): void {
  const screenRadius = (crater.r * FOCAL) / Math.max(pos.rz, 3)
  if (screenRadius < 1.3) {
    const p = cam.projectPoint(pos.rx, pos.rz)
    if (p) rect(ctx, '#5b6496', p.sx, p.sy, 1, 1)
    return
  }

  const segments = clamp(Math.round(screenRadius * 1.3), 12, 30)
  const [sunX, sunZ] = cam.rotate(SUN_DIR[0], SUN_DIR[1])
  const { rx: cx, rz: cz } = pos
  const r = crater.r

  fillPolygon(ctx, '#b9c0dc', cam.projectPolygon(ring(cx, cz, r * 1.28, 0, segments)))
  fillPolygon(ctx, '#e2e5f2', cam.projectPolygon(ring(cx - sunX * r * 0.06, cz - sunZ * r * 0.06, r * 1.1, 0, segments)))

  const opening = cam.projectPolygon(ring(cx, cz, r, 0, segments))
  const clip = spansOf(opening)
  fillPolygon(ctx, WALL[0], opening)

  const rings = []
  for (let k = 0; k <= BANDS; k++) {
    const t = k / BANDS
    rings.push(ring(cx, cz, r * (1 - (1 - CRATER_FLOOR_RATIO) * t), -crater.depth * (1 - (1 - t) ** 2), segments))
  }

  for (let j = 0; j < segments; j++) {
    const j2 = (j + 1) % segments
    const angle = ((j + 0.5) / segments) * Math.PI * 2
    const nx = Math.cos(angle)
    const nz = Math.sin(angle)
    if (nx * (cx + nx * r) + nz * (cz + nz * r) <= 0) continue
    const facingSun = -(nx * sunX + nz * sunZ)
    for (let k = 0; k < BANDS; k++) {
      let shade = facingSun > 0.55 ? 4 : facingSun > 0.1 ? 3 : facingSun > -0.35 ? 2 : 1
      if (k === BANDS - 1) shade = Math.max(1, shade - 1)
      fillPolygon(ctx, WALL[shade], cam.projectPolygon([rings[k][j], rings[k][j2], rings[k + 1][j2], rings[k + 1][j]]), clip)
    }
  }

  const floorR = r * CRATER_FLOOR_RATIO
  fillPolygon(ctx, '#3f4878', cam.projectPolygon(rings[BANDS]), clip)
  fillPolygon(ctx, '#5a63a0', cam.projectPolygon(ring(cx - sunX * floorR * 0.22, cz - sunZ * floorR * 0.22, floorR * 0.82, -crater.depth, segments)), clip)
  if (crater.ice) {
    fillPolygon(ctx, '#7fa8d8', cam.projectPolygon(ring(cx, cz, floorR * 0.95, -crater.depth, segments)), clip)
    fillPolygon(ctx, (crater.iceLeft ?? 0) > 0 ? '#bfe4ff' : '#8fb0d0', cam.projectPolygon(ring(cx + sunX * floorR * 0.15, cz + sunZ * floorR * 0.15, floorR * 0.6, -crater.depth, segments)), clip)
    return
  }
  if (crater.isPit) {
    fillPolygon(ctx, '#6f79b3', cam.projectPolygon(ring(cx - sunX * floorR * 0.4, cz - sunZ * floorR * 0.4, floorR * 0.35, -crater.depth, segments)), clip)
  }
}
