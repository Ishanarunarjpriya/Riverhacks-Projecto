import { SCREEN_H, SCREEN_W } from './constants'
import { clamp, easeOutBack } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import type { TextLayer } from './text'

const SLIDE_TIME = 0.45
const TW = 228
const TH = 136
const TILE_W = 40
const TILE_H = 36

interface Layout {
  TX: number
  TY: number
  SX: number
  SY: number
  SW: number
  SH: number
}

const TILES: [label: string, color: string][] = [
  ['MAP', '#378add'],
  ['QUESTS', '#fac775'],
  ['A.I.', '#5dcaa5'],
  ['SCAN', '#e0884a'],
]

export class Tablet {
  open = false
  private t = 0
  private boot = 0

  get visible(): boolean {
    return this.open || this.t > 0
  }

  toggle(): void {
    this.open = !this.open
  }

  close(): void {
    this.open = false
  }

  get progress(): number {
    return this.t
  }

  update(dt: number): void {
    this.t = clamp(this.t + ((this.open ? 1 : -1) * dt) / SLIDE_TIME, 0, 1)
    this.boot = this.open && this.t >= 1 ? this.boot + dt : 0
  }

  draw(ctx: Ctx, time: number): void {
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

    this.forEachTile(SX, SY, (i, color, gx, gy) => {
      rect(ctx, '#14223e', gx, gy, TILE_W, TILE_H)
      rect(ctx, color, gx, gy, TILE_W, 1)
      rect(ctx, color, gx, gy + TILE_H - 1, TILE_W, 1)
      rect(ctx, color, gx, gy, 1, TILE_H)
      rect(ctx, color, gx + TILE_W - 1, gy, 1, TILE_H)
      drawIcon(ctx, i, color, gx + TILE_W / 2, gy + 14, time)
    })
  }

  drawText(text: TextLayer, time: number): void {
    if (this.t <= 0) return
    const { TX, TY, SX, SY, SW, SH } = this.layout(time)
    text.clear(TX - 2, TY - 2, TW + 4, TH + 4)

    const b = this.boot
    if (b < 0.42) return

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
      text.text(TILES[i][0], gx + TILE_W / 2, gy + TILE_H - 10, color, { align: 'center', size: 6.5 })
    })

    if (b > 2.3 && Math.floor(time * 1.5) % 2) {
      text.text('TAB TO CLOSE', SX + SW / 2, SY + SH - 11, '#5a63a0', { align: 'center', size: 6 })
    }
  }

  private layout(time: number): Layout {
    const e = easeOutBack(this.t)
    const TX = (SCREEN_W - TW) / 2
    const TY = Math.round(SCREEN_H + 8 + (22 - (SCREEN_H + 8)) * e + Math.sin(time * 2) * 0.6 * this.t)
    return { TX, TY, SX: TX + 10, SY: TY + 10, SW: TW - 20, SH: TH - 20 }
  }

  private forEachTile(SX: number, SY: number, fn: (i: number, color: string, gx: number, gy: number) => void): void {
    TILES.forEach(([, color], i) => {
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
