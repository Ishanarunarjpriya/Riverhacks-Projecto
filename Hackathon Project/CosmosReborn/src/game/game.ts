import { Camera, horizonY, ring, type CamPos, type ScreenPoint } from './camera'
import { HORIZON_D, SCREEN_H, SCREEN_W } from './constants'
import { drawCrater } from './crater'
import { drawHud } from './hud'
import { Input } from './input'
import { fillPolygon, rect, type Ctx } from './pixel'
import { NO_CONTROLS, Player } from './player'
import { Sky } from './sky'
import { drawStructure, type Structure } from './structures'
import { Tablet } from './tablet'
import { TextLayer } from './text'
import { createWorld, groundHeightAt, pitAt, type Boulder, type Crater } from './world'

type Decal =
  | { kind: 'crater'; crater: Crater; pos: CamPos; depth: number }
  | { kind: 'pebble'; p: ScreenPoint; depth: number }
  | { kind: 'shadow'; pos: CamPos; radius: number; depth: number }

type Upright =
  | { kind: 'boulder'; boulder: Boulder; p: ScreenPoint }
  | { kind: 'structure'; structure: Structure; p: ScreenPoint }
  | { kind: 'player'; p: ScreenPoint; pos: CamPos }

export class Game {
  private ctx: Ctx
  private text: TextLayer
  private world = createWorld()
  private sky = new Sky()
  private camera = new Camera()
  private player = new Player()
  private tablet = new Tablet()
  private input = new Input()
  private time = 0
  private last = 0
  private raf = 0

  constructor(canvas: HTMLCanvasElement, textCanvas: HTMLCanvasElement) {
    canvas.width = SCREEN_W
    canvas.height = SCREEN_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas is not supported')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.text = new TextLayer(textCanvas)
    this.input.onTablet = () => this.tablet.toggle()
    this.input.onEscape = () => this.tablet.close()
    this.camera.follow(this.player.x, this.player.z, this.player.heading, 1)
  }

  start(): void {
    this.input.attach()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.input.detach()
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.time += dt
    this.update(dt)
    this.render()
    this.raf = requestAnimationFrame(this.frame)
  }

  private update(dt: number): void {
    this.tablet.update(dt)
    this.sky.update(dt)
    const controls = this.tablet.visible ? NO_CONTROLS : this.input.controls()
    this.player.update(dt, controls, this.world)
    this.camera.follow(this.player.x, this.player.z, this.player.heading, dt)
  }

  private render(): void {
    const { ctx, camera: cam, world, player } = this

    this.sky.draw(ctx, cam, player.x, player.z, this.time)
    this.drawSurface()

    const decals: Decal[] = []
    for (const crater of world.craters) {
      const pos = cam.toCamera(crater.x, crater.z)
      const margin = crater.r * 1.3
      if (pos.rz + margin < 1) continue
      if (Math.hypot(pos.rx, pos.rz) - margin > HORIZON_D) continue
      if (Math.abs(pos.rx) > pos.rz * 1.3 + margin + 4) continue
      decals.push({ kind: 'crater', crater, pos, depth: pos.rz })
    }
    for (const pebble of world.pebbles) {
      const pos = cam.toCamera(pebble.x, pebble.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx >= 0 && p.sx < SCREEN_W) decals.push({ kind: 'pebble', p, depth: pos.rz })
    }
    const addShadow = (x: number, z: number, radius: number) => {
      const pos = cam.toCamera(x, z)
      if (pos.rz + radius > 1 && Math.hypot(pos.rx, pos.rz) - radius < HORIZON_D) {
        decals.push({ kind: 'shadow', pos, radius, depth: pos.rz })
      }
    }
    for (const s of world.structures) addShadow(s.x, s.z, s.radius * 1.25)
    for (const b of world.boulders) addShadow(b.x, b.z, b.r * 1.3)

    decals.sort((a, b) => b.depth - a.depth)
    for (const d of decals) {
      if (d.kind === 'crater') drawCrater(ctx, cam, d.crater, d.pos)
      else if (d.kind === 'pebble') rect(ctx, d.p.scale > 4 ? '#6f78a8' : '#848dbb', d.p.sx, d.p.sy, d.p.scale > 5 ? 2 : 1, 1)
      else {
        const [ox, oz] = cam.rotate(-0.25 * d.radius, -0.25 * d.radius)
        fillPolygon(ctx, '#5b6496', cam.projectPolygon(ring(d.pos.rx + ox, d.pos.rz + oz, d.radius, 0, 14)))
      }
    }

    const uprights: Upright[] = []
    for (const boulder of world.boulders) {
      const pos = cam.toCamera(boulder.x, boulder.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'boulder', boulder, p })
    }
    for (const structure of world.structures) {
      const pos = cam.toCamera(structure.x, structure.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -80 && p.sx < SCREEN_W + 80) uprights.push({ kind: 'structure', structure, p })
    }
    const playerPos = cam.toCamera(player.x, player.z)
    const playerP = cam.projectPoint(playerPos.rx, playerPos.rz)
    if (playerP) uprights.push({ kind: 'player', p: playerP, pos: playerPos })

    uprights.sort((a, b) => b.p.depth - a.p.depth)
    for (const u of uprights) {
      if (u.kind === 'boulder') this.drawBoulder(u.boulder, u.p)
      else if (u.kind === 'structure') drawStructure(ctx, u.structure, u.p.sx, u.p.sy, u.p.scale, this.time)
      else this.drawPlayer(u.p, u.pos)
    }

    const pit = pitAt(world, player.x, player.z)
    this.text.begin()
    this.text.alpha = 1 - 0.55 * this.tablet.progress
    drawHud(ctx, this.text, world, player, this.time, !!pit && player.grounded && player.y < -0.5 && !this.tablet.open)
    this.text.alpha = 1
    this.tablet.draw(ctx, this.time)
    this.tablet.drawText(this.text, this.time)
  }

  private drawSurface(): void {
    const { ctx } = this
    for (let sx = 0; sx < SCREEN_W; sx++) {
      const y0 = Math.round(horizonY(sx))
      ctx.fillStyle = '#e9e5cc'
      ctx.fillRect(sx, y0, 1, 1)
      ctx.fillStyle = '#c3c9e3'
      ctx.fillRect(sx, y0 + 1, 1, 1)
      ctx.fillStyle = '#7f88b4'
      ctx.fillRect(sx, y0 + 2, 1, 4)
      ctx.fillStyle = '#9aa2c8'
      ctx.fillRect(sx, y0 + 6, 1, SCREEN_H - y0)
    }
  }

  private drawBoulder(b: Boulder, p: ScreenPoint): void {
    const w = b.r * p.scale
    const h = b.r * 1.3 * p.scale
    rect(this.ctx, '#7c85b4', p.sx - w, p.sy - h, w * 2, h)
    rect(this.ctx, '#5b6496', p.sx + w * 0.3, p.sy - h, w * 0.7, h)
    rect(this.ctx, '#dfe1f0', p.sx - w, p.sy - h, w * 1.3, Math.max(1, h * 0.22))
  }

  private drawPlayer(p: ScreenPoint, pos: CamPos): void {
    const { ctx, camera: cam, world, player } = this
    const pit = pitAt(world, player.x, player.z)
    const inPit = pit !== null && player.y < -0.2

    if (inPit) {
      const c = cam.toCamera(pit.x, pit.z)
      let rimBottom = 0
      for (const q of cam.projectPolygon(ring(c.rx, c.rz, pit.r, 0, 24))) rimBottom = Math.max(rimBottom, q[1])
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, SCREEN_W, rimBottom)
      ctx.clip()
    }

    const ground = groundHeightAt(world, player.x, player.z)
    const lift = Math.max(0, player.y - ground)
    const [ox, oz] = cam.rotate(-0.5, -0.5)
    fillPolygon(ctx, '#2e3560', cam.projectPolygon(ring(pos.rx + ox, pos.rz + oz, 1.2 - Math.min(0.6, lift * 0.12), ground, 14)))

    player.draw(ctx, p.sx, p.sy, p.scale, this.tablet.visible)
    if (inPit) ctx.restore()
  }
}
