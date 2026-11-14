import { SCREEN_CX, SCREEN_W, SHOW_MINIMAP, WORLD_SIZE } from './constants'
import { wrap, wrapPositive } from './math'
import { rect, type Ctx } from './pixel'
import type { Player } from './player'
import type { TextLayer } from './text'
import type { World } from './world'

const PANEL = 'rgba(6,5,24,.75)'

export function drawHud(ctx: Ctx, text: TextLayer, world: World, player: Player, time: number, showPitWarning: boolean): void {
  let nearest = world.structures[0]
  let nearestDist = Infinity
  for (const s of world.structures) {
    const d = Math.hypot(wrap(s.x - player.x), wrap(s.z - player.z))
    if (d < nearestDist) {
      nearestDist = d
      nearest = s
    }
  }
  const deg = Math.round((((player.heading * 180) / Math.PI) % 360 + 360) % 360)
  ctx.fillStyle = PANEL
  ctx.fillRect(4, 4, 92, 24)
  text.text(`HEADING ${deg}°`, 8, 7.5, '#5dcaa5')
  text.text(`${nearest.name} ${Math.max(0, Math.round(nearestDist - nearest.radius))}m`, 8, 17, '#fac775')

  if (SHOW_MINIMAP) drawMinimap(ctx, world, player)

  if (showPitWarning && Math.floor(time * 3) % 2) {
    ctx.fillStyle = 'rgba(6,5,24,.8)'
    ctx.fillRect(SCREEN_CX - 64, 160, 128, 13)
    text.text('IN A CRATER - JUMP!', SCREEN_CX, 163, '#ff8a7a', { align: 'center' })
  }
}

function drawMinimap(ctx: Ctx, world: World, player: Player): void {
  const MS = 46
  const MX = SCREEN_W - MS - 4
  const MY = 4
  ctx.fillStyle = PANEL
  ctx.fillRect(MX, MY, MS, MS)
  for (const [x, y, w, h] of [[MX, MY, MS, 1], [MX, MY + MS - 1, MS, 1], [MX, MY, 1, MS], [MX + MS - 1, MY, 1, MS]]) {
    rect(ctx, '#3a3f68', x, y, w, h)
  }
  const toMap = (x: number, z: number): [number, number] => [
    MX + (wrapPositive(x) / WORLD_SIZE) * MS,
    MY + MS - (wrapPositive(z) / WORLD_SIZE) * MS,
  ]
  for (const s of world.structures) {
    const [a, b] = toMap(s.x, s.z)
    rect(ctx, s.mapColor, a - 1, b - 1, 2, 2)
  }
  const [pa, pb] = toMap(player.x, player.z)
  rect(ctx, '#ffffff', pa, pb, 1, 1)
  rect(ctx, '#ffffff', pa + Math.sin(player.heading) * 3, pb - Math.cos(player.heading) * 3, 1, 1)
}
