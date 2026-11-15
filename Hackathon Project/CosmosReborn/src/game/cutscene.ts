import type { GameAudio } from './audio'
import { SCREEN_CX, SCREEN_H, SCREEN_W } from './constants'
import { clamp, createRng } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import type { TextLayer } from './text'

const DRIFT_END = 4
const ALARM_END = 7
const FALL_END = 9.6
const BLACK_END = 13.5
const TOTAL = 14.5

interface Star {
  x: number
  y: number
  speed: number
  color: string
}

export class Cutscene {
  done = false
  private t = 0
  private stars: Star[] = []
  private cues = new Set<string>()

  constructor() {
    const rng = createRng(3)
    for (let i = 0; i < 160; i++) {
      this.stars.push({
        x: rng() * SCREEN_W,
        y: rng() * SCREEN_H,
        speed: 2 + rng() * 10,
        color: rng() < 0.7 ? '#6b66a8' : '#d9d6ff',
      })
    }
  }

  skip(): void {
    this.done = true
  }

  update(dt: number, audio: GameAudio): void {
    if (this.done) return
    this.t += dt
    const cue = (name: string, at: number, run: () => void) => {
      if (this.t >= at && !this.cues.has(name)) {
        this.cues.add(name)
        run()
      }
    }
    cue('alarm1', DRIFT_END, () => audio.play('alarm'))
    cue('alarm2', DRIFT_END + 1, () => audio.play('alarm'))
    cue('rumble', ALARM_END - 0.5, () => audio.play('rumble'))
    cue('rumble2', ALARM_END + 1, () => audio.play('rumble'))
    cue('crash', FALL_END, () => audio.play('crash'))
    if (this.t >= TOTAL) this.done = true
  }

  draw(ctx: Ctx, text: TextLayer): void {
    const t = this.t
    rect(ctx, '#05040f', 0, 0, SCREEN_W, SCREEN_H)

    if (t < FALL_END) {
      const falling = clamp((t - DRIFT_END) / (FALL_END - DRIFT_END), 0, 1)
      const shake = t > DRIFT_END ? (Math.random() - 0.5) * (1 + falling * 5) : 0
      for (const s of this.stars) {
        const x = (((s.x - t * s.speed) % SCREEN_W) + SCREEN_W) % SCREEN_W
        const y = (((s.y - t * falling * s.speed * 6) % SCREEN_H) + SCREEN_H) % SCREEN_H
        rect(ctx, s.color, x + shake, y, 1, 1 + Math.round(falling * 3))
      }

      const moonTop = SCREEN_H + 40 - falling * falling * 150
      if (t > DRIFT_END - 1) {
        ellipse(ctx, '#7f88b4', SCREEN_CX, moonTop + 260, 300, 260)
        ellipse(ctx, '#9aa2c8', SCREEN_CX + 10, moonTop + 262, 292, 255)
        for (const [dx, dy, r] of [[-70, 18, 10], [40, 30, 14], [110, 12, 7], [-130, 40, 12], [5, 60, 18]]) {
          ellipse(ctx, '#7f88b4', SCREEN_CX + dx, moonTop + dy, r, r * 0.45)
        }
      }

      const shipY = 70 + Math.sin(t * 1.5) * 3 + falling * falling * 90
      const shipX = SCREEN_CX + Math.sin(t * 0.7) * 4 + shake
      if (falling > 0) {
        for (let i = 0; i < 14; i++) {
          const fy = shipY - 10 - i * 2 - Math.random() * 3
          const spread = (Math.random() - 0.5) * (4 + i)
          rect(ctx, i < 4 ? '#fff6d8' : i < 9 ? '#fac775' : '#e0884a', shipX + spread, fy, 2, 2)
        }
      }
      this.drawShip(ctx, shipX, shipY, t > DRIFT_END && Math.floor(t * 4) % 2 === 0)

      if (t > DRIFT_END && t < FALL_END) {
        const pulse = (Math.sin(t * 10) + 1) / 2
        ctx.fillStyle = `rgba(226,75,74,${0.12 + pulse * 0.12})`
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
      }

      const type = (line: string, start: number, y: number, color: string) => {
        const n = Math.floor(clamp((t - start) * 26, 0, line.length))
        if (n > 0) text.text(line.slice(0, n), 10, y, color, { size: 6 })
      }
      type('TRANSIT LOG 0291', 0.4, 10, '#5dcaa5')
      type('ALL SYSTEMS NOMINAL. DESTINATION: HOME.', 1.2, 18, '#9aa2cf')
      if (t > DRIFT_END) {
        type('WARNING: HULL BREACH', DRIFT_END, 30, '#ff8a7a')
        type('LOSING ALTITUDE', DRIFT_END + 1, 38, '#ff8a7a')
      }
      if (t > ALARM_END) type('BRACE FOR IMPACT', ALARM_END, 50, '#fac775')
    } else {
      const flash = clamp(1 - (t - FALL_END) / 0.7, 0, 1)
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash})`
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
      }
      const show = (line: string, start: number, y: number, size: number, color: string) => {
        if (t < start) return
        const n = Math.floor(clamp((t - start) * 14, 0, line.length))
        const fade = clamp((BLACK_END - t) / 0.6, 0, 1)
        text.alpha = fade
        text.text(line.slice(0, n), SCREEN_CX, y, color, { size, align: 'center' })
        text.alpha = 1
      }
      show('...', FALL_END + 1, 80, 8, '#5b6496')
      show('WAKE UP.', FALL_END + 2.2, 90, 8, '#d9dcef')
    }

    if (t > BLACK_END) {
      ctx.fillStyle = `rgba(5,4,15,${clamp(1 - (t - BLACK_END) / (TOTAL - BLACK_END), 0, 1)})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
    if (t < BLACK_END) text.text('PRESS ANY KEY TO SKIP', SCREEN_W - 6, SCREEN_H - 9, '#3f4878', { size: 4.5, align: 'right' })
  }

  get finishedFading(): boolean {
    return this.t > BLACK_END
  }

  private drawShip(ctx: Ctx, x: number, y: number, warning: boolean): void {
    const s = 2
    const box = (c: string, ux: number, uy: number, w: number, h: number) => rect(ctx, c, x + ux * s, y + uy * s, w * s, h * s)
    box('#c9cbe0', -5, 2, 1, 4)
    box('#c9cbe0', 4, 2, 1, 4)
    box('#d4a43c', -4, -2, 8, 5)
    box('#f2c85e', -4, -2, 8, 1)
    box('#e6e6ee', -3, -6, 6, 4)
    box('#3b7dd8', -1, -5, 2, 2)
    box(warning ? '#e24b4a' : '#5dcaa5', 2, -6, 1, 1)
  }
}
