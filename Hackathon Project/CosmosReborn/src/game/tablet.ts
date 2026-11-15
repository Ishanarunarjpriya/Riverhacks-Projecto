import { ANOMALIES, HATCH } from './anomalies'
import { BASE_CENTER } from './base'
import { SCREEN_H, SCREEN_W, WORLD_SIZE } from './constants'
import { clamp, easeOutBack, wrap, wrapPositive } from './math'
import { ellipse, makeSprite, rect, type Ctx } from './pixel'
import type { TextLayer } from './text'
import type { QuestTracker } from './tracker'
import type { World } from './world'

const SLIDE_TIME = 0.45
const TW = 228
const TH = 136
const TILE_W = 40
const TILE_H = 36
const MAP_PX_PER_UNIT = 1 / 6
const MAP_SIZE = 96
const MAP_TEX = Math.round(WORLD_SIZE * MAP_PX_PER_UNIT)

type App = 'map' | 'quests' | 'ai' | 'scan'
type Screen = 'home' | App

const TILES: { app: App; label: string; color: string }[] = [
  { app: 'map', label: 'MAP', color: '#378add' },
  { app: 'quests', label: 'QUESTS', color: '#fac775' },
  { app: 'ai', label: 'A.I.', color: '#5dcaa5' },
  { app: 'scan', label: 'SCAN', color: '#e0884a' },
]

interface Layout {
  TX: number
  TY: number
  SX: number
  SY: number
  SW: number
  SH: number
}

export interface TabletView {
  world: World
  playerX: number
  playerZ: number
  heading: number
  tracker: QuestTracker
  underground: boolean
}

export class Tablet {
  open = false
  private t = 0
  private boot = 0
  private screen: Screen = 'home'
  private selected = 0
  private appTime = 0
  private mapTexture: HTMLCanvasElement | null = null
  private tileRects: { x: number; y: number; w: number; h: number }[] = []

  get visible(): boolean {
    return this.open || this.t > 0
  }

  get progress(): number {
    return this.t
  }

  get ready(): boolean {
    return this.open && this.boot > 1.9
  }

  toggle(): void {
    this.open = !this.open
    if (this.open) this.screen = 'home'
  }

  close(): void {
    this.open = false
  }

  handleKey(code: string): boolean {
    if (!this.open) return false
    if (this.screen !== 'home') {
      if (code === 'Escape' || code === 'Backspace') {
        this.screen = 'home'
        return true
      }
      return false
    }
    if (!this.ready) return false
    if (code === 'ArrowLeft' || code === 'KeyA') this.selected = (this.selected + TILES.length - 1) % TILES.length
    else if (code === 'ArrowRight' || code === 'KeyD') this.selected = (this.selected + 1) % TILES.length
    else if (code === 'Enter' || code === 'KeyE' || code === 'Space') this.launch(TILES[this.selected].app)
    else return false
    return true
  }

  click(x: number, y: number): boolean {
    if (!this.ready || this.screen !== 'home') return false
    const i = this.tileRects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
    if (i < 0) return false
    this.selected = i
    this.launch(TILES[i].app)
    return true
  }

  update(dt: number): void {
    this.t = clamp(this.t + ((this.open ? 1 : -1) * dt) / SLIDE_TIME, 0, 1)
    this.boot = this.open && this.t >= 1 ? this.boot + dt : 0
    this.appTime += dt
  }

  draw(ctx: Ctx, time: number, view: TabletView): void {
    if (this.t <= 0) return
    const { TX, TY, SX, SY, SW, SH } = this.layout(time)

    ctx.fillStyle = `rgba(4,3,16,${0.55 * this.t})`
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

    rect(ctx, '#0b0c1a', TX - 2, TY - 1, TW + 4, TH + 2)
    rect(ctx, '#0b0c1a', TX - 1, TY - 2, TW + 2, TH + 4)
    rect(ctx, '#3a3f68', TX, TY, TW, TH)
    rect(ctx, '#565d92', TX, TY, TW, 2)
    rect(ctx, '#2a2e50', TX, TY + TH - 3, TW, 3)
    rect(ctx, '#1a1c33', TX + TW / 2 - 2, TY + 4, 4, 2)
    rect(ctx, '#565d92', TX + TW, TY + 30, 2, 14)
    rect(ctx, '#fac775', TX + 8, TY + TH - 7, 3, 2)
    rect(ctx, '#05070f', SX, SY, SW, SH)

    const b = this.boot
    if (b <= 0) return
    if (b < 0.22) {
      const w = SW * (b / 0.22)
      rect(ctx, '#e9fff6', SX + SW / 2 - w / 2, SY + SH / 2, w, 1)
      return
    }
    if (b < 0.42) {
      const h = SH * ((b - 0.22) / 0.2)
      rect(ctx, '#9fe1cb', SX, SY + SH / 2 - h / 2, SW, Math.max(1, h))
      return
    }

    rect(ctx, '#0b1830', SX, SY, SW, SH)
    ctx.fillStyle = 'rgba(93,202,165,.06)'
    for (let y = SY; y < SY + SH; y += 2) ctx.fillRect(SX, y, SW, 1)

    if (this.screen === 'home') {
      this.tileRects = []
      this.forEachTile(SX, SY, (i, color, gx, gy) => {
        this.tileRects.push({ x: gx, y: gy, w: TILE_W, h: TILE_H })
        const sel = this.ready && i === this.selected
        rect(ctx, sel ? '#1d3358' : '#14223e', gx, gy, TILE_W, TILE_H)
        const border = sel && Math.floor(time * 3) % 2 ? '#ffffff' : color
        rect(ctx, border, gx, gy, TILE_W, 1)
        rect(ctx, border, gx, gy + TILE_H - 1, TILE_W, 1)
        rect(ctx, border, gx, gy, 1, TILE_H)
        rect(ctx, border, gx + TILE_W - 1, gy, 1, TILE_H)
        drawIcon(ctx, i, color, gx + TILE_W / 2, gy + 14, time)
      })
    } else if (this.screen === 'map') {
      this.drawMap(ctx, time, SX, SY, view)
    } else if (this.screen === 'scan') {
      const cx = SX + SW / 2
      const cy = SY + 62
      ellipse(ctx, '#1d3358', cx, cy, 40, 40)
      ellipse(ctx, '#0b1830', cx, cy, 39, 39)
      ellipse(ctx, '#1d3358', cx, cy, 27, 27)
      ellipse(ctx, '#0b1830', cx, cy, 26, 26)
      ellipse(ctx, '#1d3358', cx, cy, 14, 14)
      ellipse(ctx, '#0b1830', cx, cy, 13, 13)
      const a = time * 2
      for (let r = 0; r < 40; r++) rect(ctx, '#e0884a', cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1)
      if (Math.sin(time * 2.3) > 0.4) rect(ctx, '#ff8a7a', cx + 18, cy - 22, 2, 2)
    }
  }

  drawText(text: TextLayer, time: number, view: TabletView): void {
    if (this.t <= 0) return
    const { TX, TY, SX, SY, SW, SH } = this.layout(time)
    text.clear(TX - 2, TY - 2, TW + 4, TH + 4)
    const b = this.boot
    if (b < 0.42) return

    if (this.screen === 'home') {
      const type = (line: string, start: number, y: number, color: string): boolean => {
        const n = clamp(Math.floor((b - start) * 28), 0, line.length)
        if (n > 0) text.text(line.slice(0, n), SX + 8, y, color)
        return n === line.length
      }
      type('MOON-OS 1.0', 0.45, SY + 6, '#5dcaa5')
      const linkLine = 'LANDER LINK....... OK'
      const linked = type(linkLine, 0.9, SY + 16, '#9aa2cf')
      if (linked && Math.floor(time * 2) % 2) text.text('_', SX + 9 + text.measure(linkLine), SY + 16, '#5dcaa5')
      this.forEachTile(SX, SY, (i, color, gx, gy) => {
        text.text(TILES[i].label, gx + TILE_W / 2, gy + TILE_H - 10, color, { align: 'center', size: 6.5 })
      })
      if (this.ready) text.text('← → CHOOSE · ENTER OPEN · TAB CLOSE', SX + SW / 2, SY + SH - 10, '#5a63a0', { align: 'center', size: 4.8 })
      return
    }

    const title = TILES.find((t) => t.app === this.screen)
    text.text(title?.label ?? '', SX + 6, SY + 3, title?.color ?? '#ffffff', { size: 6.5 })
    text.text('ESC TO GO BACK', SX + SW - 6, SY + 4, '#5a63a0', { size: 4.5, align: 'right' })

    if (this.screen === 'map') this.drawMapText(text, SX, SY, view)
    else if (this.screen === 'quests') this.drawQuests(text, SX, SY, SW, view.tracker)
    else if (this.screen === 'ai') {
      const lines = [
        '> A.I. CORE ............ DAMAGED',
        '> RUNNING DIAGNOSTIC.......',
        '> HELLO.',
        '> YOU ARE AWAKE. THAT WAS NOT SUPPOSED TO HAPPEN.',
        '> ...',
        '> [ASSISTANT MODULE NOT INSTALLED]',
      ]
      let budget = Math.floor(this.appTime * 22)
      lines.forEach((line, i) => {
        const n = clamp(budget, 0, line.length)
        budget -= line.length + 8
        if (n > 0) text.text(line.slice(0, n), SX + 8, SY + 16 + i * 9, i === 3 ? '#ff8a7a' : '#5dcaa5', { size: 5.5, weight: 500 })
      })
    } else if (this.screen === 'scan') {
      text.text('LIFE SIGNS: 0', SX + 8, SY + 16, '#e0884a', { size: 5.5 })
      if (Math.sin(time * 2.3) > 0.4) text.text('LIFE SIGNS: 1?', SX + 8, SY + 24, '#ff8a7a', { size: 5.5 })
      text.text('SCANNER CALIBRATION REQUIRED', SX + SW / 2, SY + SH - 10, '#5a63a0', { size: 4.8, align: 'center' })
    }
  }

  private launch(app: App): void {
    this.screen = app
    this.appTime = 0
  }

  private ensureMap(world: World): HTMLCanvasElement {
    if (this.mapTexture) return this.mapTexture
    this.mapTexture = makeSprite(MAP_TEX, MAP_TEX, (g) => {
      rect(g, '#6c76a8', 0, 0, MAP_TEX, MAP_TEX)
      for (let i = 0; i < 400; i++) {
        const x = (i * 97) % MAP_TEX
        const y = (i * 61 + Math.floor(i / 7)) % MAP_TEX
        rect(g, i % 3 ? '#7781b2' : '#636da0', x, y, 1, 1)
      }
      for (const c of world.craters) {
        const r = Math.max(0.8, c.r * MAP_PX_PER_UNIT)
        const x = wrapPositive(c.x) * MAP_PX_PER_UNIT
        const y = MAP_TEX - wrapPositive(c.z) * MAP_PX_PER_UNIT
        ellipse(g, '#9aa2cf', x, y - 0.5, r + 0.5, r + 0.5)
        ellipse(g, c.isPit ? '#353d6c' : '#4b5488', x, y, r, r)
      }
      for (const b of world.boulders) {
        rect(g, '#aab1d6', wrapPositive(b.x) * MAP_PX_PER_UNIT, MAP_TEX - wrapPositive(b.z) * MAP_PX_PER_UNIT, 1, 1)
      }
    })
    return this.mapTexture
  }

  private mapOrigin(SX: number, SY: number) {
    return { mx: SX + 6, my: SY + 14 }
  }

  private toMap(view: TabletView, x: number, z: number, SX: number, SY: number): [number, number] {
    const { mx, my } = this.mapOrigin(SX, SY)
    return [
      mx + MAP_SIZE / 2 + wrap(x - view.playerX) * MAP_PX_PER_UNIT,
      my + MAP_SIZE / 2 - wrap(z - view.playerZ) * MAP_PX_PER_UNIT,
    ]
  }

  private isKnown(view: TabletView, name: string, kind: string): boolean {
    return kind === 'lander' || view.tracker.explored.includes(name)
  }

  private drawMap(ctx: Ctx, time: number, SX: number, SY: number, view: TabletView): void {
    if (view.underground) {
      const { mx, my } = this.mapOrigin(SX, SY)
      rect(ctx, '#05070f', mx, my, MAP_SIZE, MAP_SIZE)
      for (let i = 0; i < 160; i++) rect(ctx, Math.random() < 0.5 ? '#14223e' : '#1d3358', mx + Math.random() * MAP_SIZE, my + Math.random() * MAP_SIZE, 1, 1)
      return
    }
    const tex = this.ensureMap(view.world)
    const { mx, my } = this.mapOrigin(SX, SY)
    const ox = wrapPositive(view.playerX) * MAP_PX_PER_UNIT - MAP_SIZE / 2
    const oy = MAP_TEX - wrapPositive(view.playerZ) * MAP_PX_PER_UNIT - MAP_SIZE / 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(mx, my, MAP_SIZE, MAP_SIZE)
    ctx.clip()
    for (const dx of [-MAP_TEX, 0, MAP_TEX]) {
      for (const dy of [-MAP_TEX, 0, MAP_TEX]) ctx.drawImage(tex, Math.round(mx - ox + dx), Math.round(my - oy + dy))
    }

    const [bx, by] = this.toMap(view, BASE_CENTER.x, BASE_CENTER.z, SX, SY)
    rect(ctx, '#fac775', bx - 2, by - 2, 5, 5)
    rect(ctx, '#0b1830', bx - 1, by - 1, 3, 3)
    rect(ctx, '#fac775', bx, by, 1, 1)

    for (const s of view.world.structures) {
      if (!s.discoverable && s.kind !== 'lander') continue
      const [x, y] = this.toMap(view, s.x, s.z, SX, SY)
      if (this.isKnown(view, s.name, s.kind)) {
        rect(ctx, '#0b1830', x - 2, y - 2, 5, 5)
        rect(ctx, s.mapColor, x - 1, y - 1, 3, 3)
      }
    }

    for (const a of ANOMALIES) {
      if (!view.tracker.anomalies.includes(a.id)) continue
      const [x, y] = this.toMap(view, a.x, a.z, SX, SY)
      rect(ctx, '#7c6fb0', x - 1, y - 1, 3, 3)
    }
    if (view.tracker.signalRevealed) {
      const [x, y] = this.toMap(view, HATCH.x, HATCH.z, SX, SY)
      const pulse = Math.floor(time * 3) % 2 === 0
      rect(ctx, '#0b1830', x - 3, y - 3, 7, 7)
      rect(ctx, pulse ? '#efe3ff' : '#c9a6ff', x - 2, y - 2, 5, 5)
      rect(ctx, '#5b4a8a', x - 1, y - 1, 3, 3)
    }

    const blink = Math.floor(time * 4) % 2 === 0
    const cx = mx + MAP_SIZE / 2
    const cy = my + MAP_SIZE / 2
    rect(ctx, '#ffffff', cx - 1, cy - 1, 3, 3)
    for (let k = 2; k <= 5; k++) rect(ctx, blink ? '#ffffff' : '#9fe1cb', cx + Math.sin(view.heading) * k, cy - Math.cos(view.heading) * k, 1, 1)
    ctx.restore()

    rect(ctx, '#378add', mx - 1, my - 1, MAP_SIZE + 2, 1)
    rect(ctx, '#378add', mx - 1, my + MAP_SIZE, MAP_SIZE + 2, 1)
    rect(ctx, '#378add', mx - 1, my - 1, 1, MAP_SIZE + 2)
    rect(ctx, '#378add', mx + MAP_SIZE, my - 1, 1, MAP_SIZE + 2)
  }

  private drawMapText(text: TextLayer, SX: number, SY: number, view: TabletView): void {
    const { mx, my } = this.mapOrigin(SX, SY)
    if (view.underground) {
      text.text('NO SIGNAL', mx + MAP_SIZE / 2, my + MAP_SIZE / 2 - 6, '#ff8a7a', { size: 7, align: 'center' })
      text.text('YOU ARE UNDERGROUND', mx + MAP_SIZE / 2, my + MAP_SIZE / 2 + 4, '#5a63a0', { size: 5, align: 'center' })
      return
    }
    text.text('N', mx + MAP_SIZE / 2, my + 1, '#ff8a7a', { size: 5, align: 'center' })
    for (const s of view.world.structures) {
      if (!s.discoverable || this.isKnown(view, s.name, s.kind)) continue
      const [x, y] = this.toMap(view, s.x, s.z, SX, SY)
      if (x > mx + 2 && x < mx + MAP_SIZE - 2 && y > my + 2 && y < my + MAP_SIZE - 2) {
        text.text('?', x, y - 3, '#d9dcef', { size: 6, align: 'center' })
      }
    }

    const lx = mx + MAP_SIZE + 7
    let y = my
    const row = (label: string, color: string, dist?: number) => {
      text.rect(color, lx, y + 1.5, 3, 3)
      text.text(label, lx + 6, y, color, { size: 5 })
      if (dist !== undefined) text.text(`${Math.round(dist)}m`, SX + 202, y, '#9aa2cf', { size: 5, align: 'right' })
      y += 8
    }
    text.text(view.tracker.currentRegion, lx, y, '#9aa2cf', { size: 5 })
    y += 9
    row('YOU', '#ffffff')
    row('BASE', '#fac775', Math.hypot(wrap(BASE_CENTER.x - view.playerX), wrap(BASE_CENTER.z - view.playerZ)))
    let unknown = 0
    for (const s of view.world.structures) {
      if (!s.discoverable && s.kind !== 'lander') continue
      if (!this.isKnown(view, s.name, s.kind)) {
        unknown++
        continue
      }
      row(s.name, s.mapColor, Math.hypot(wrap(s.x - view.playerX), wrap(s.z - view.playerZ)))
    }
    if (view.tracker.signalRevealed) row(view.tracker.signalFound ? 'SEALED HATCH' : 'STRANGE SIGNAL', '#c9a6ff', Math.hypot(wrap(HATCH.x - view.playerX), wrap(HATCH.z - view.playerZ)))
    if (unknown > 0) text.text(`? = ${unknown} UNKNOWN SIGNALS`, lx, y + 2, '#d9dcef', { size: 5 })
    text.text('THE MOON WRAPS AROUND', lx, my + MAP_SIZE - 6, '#3f4878', { size: 4.5 })
  }

  private drawQuests(text: TextLayer, SX: number, SY: number, SW: number, tracker: QuestTracker): void {
    let y = SY + 16
    const quest = tracker.activeQuest
    if (quest) {
      text.text(quest.title.toUpperCase(), SX + 8, y, '#fac775', { size: 6.5 })
      y += 9
      text.text(quest.summary, SX + 8, y, '#9aa2cf', { size: 5, weight: 500 })
      y += 9
      for (const o of tracker.progress(quest)) {
        const count = o.target > 1 ? `${o.current}/${o.target}` : o.done ? 'DONE' : ''
        text.text(`${o.done ? '✓' : '·'} ${o.label}`, SX + 12, y, o.done ? '#5dcaa5' : '#d9dcef', { size: 5.5, weight: 500 })
        text.text(count, SX + SW - 10, y, o.done ? '#5dcaa5' : '#d9dcef', { size: 5.5, align: 'right' })
        y += 8
      }
    } else {
      text.text('ACT I COMPLETE', SX + 8, y, '#fac775', { size: 6.5 })
      y += 9
    }
    y += 4
    text.text(`COMPLETED: ${tracker.completed.length}`, SX + 8, y, '#5a63a0', { size: 5 })
  }

  private layout(time: number): Layout {
    const e = easeOutBack(this.t)
    const TX = (SCREEN_W - TW) / 2
    const TY = Math.round(SCREEN_H + 8 + (22 - (SCREEN_H + 8)) * e + Math.sin(time * 2) * 0.6 * this.t)
    return { TX, TY, SX: TX + 10, SY: TY + 10, SW: TW - 20, SH: TH - 20 }
  }

  private forEachTile(SX: number, SY: number, fn: (i: number, color: string, gx: number, gy: number) => void): void {
    TILES.forEach(({ color }, i) => {
      const appear = this.boot - 1.5 - i * 0.14
      if (appear <= 0) return
      const s = Math.min(1, appear / 0.18)
      fn(i, color, SX + 10 + i * (TILE_W + 6), SY + 34 + Math.round((1 - s) * 8))
    })
  }
}

function drawIcon(ctx: Ctx, index: number, color: string, cx: number, cy: number, time: number): void {
  switch (index) {
    case 0:
      for (let k = -8; k <= 8; k += 4) {
        rect(ctx, '#24467a', cx + k, cy - 8, 1, 16)
        rect(ctx, '#24467a', cx - 8, cy + k, 16, 1)
      }
      rect(ctx, '#ffffff', cx + 2, cy - 2, 2, 2)
      break
    case 1:
      for (let k = 0; k < 3; k++) {
        rect(ctx, color, cx - 9, cy - 7 + k * 6, 3, 3)
        rect(ctx, '#9aa2cf', cx - 4, cy - 6 + k * 6, 12, 1)
      }
      break
    case 2:
      ellipse(ctx, color, cx, cy, 8, 8)
      ellipse(ctx, '#14223e', cx, cy, 6, 6)
      rect(ctx, color, cx - 4, cy - 2, 2, 2)
      rect(ctx, color, cx + 2, cy - 2, 2, 2)
      rect(ctx, color, cx - 3, cy + 3, 6, 1)
      break
    case 3: {
      ellipse(ctx, '#5a3a26', cx, cy, 9, 9)
      ellipse(ctx, '#14223e', cx, cy, 8, 8)
      const a = time * 3
      for (let r = 0; r < 9; r++) rect(ctx, color, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1)
      rect(ctx, color, cx + 4, cy - 3, 1, 1)
      break
    }
  }
}
