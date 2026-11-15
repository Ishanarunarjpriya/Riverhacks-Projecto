import { typingFrame } from './typing'
import type { GameAudio } from './audio'
import { SCREEN_CX, SCREEN_H, SCREEN_W } from './constants'
import { clamp, createRng } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import type { TextLayer } from './text'
import { preloadVoice, speak, stopVoice, type VoiceName } from './voice'
import { SHIP_SPRITE, spriteFrame } from './sprites'

export type CutsceneKind = 'intro' | 'earth' | 'act2'

const INTRO = {
  title: 3.2,
  engines: 7,
  planets: 11.5,
  fall: 14.5,
  walkout: 21,
  look: 25.5,
  total: 34,
} as const

const EARTH_TOTAL = 14
const ACT2_TOTAL = 15

interface Star {
  x: number
  y: number
  speed: number
  color: string
}

interface Planet {
  y: number
  r: number
  base: string
  shade: string
  band?: string
  ring?: boolean
  delay: number
}

const PLANETS: Planet[] = [
  { y: 46, r: 14, base: '#c96a4a', shade: '#8a3f2e', delay: 0 },
  { y: 120, r: 26, base: '#d8b27a', shade: '#9a7448', band: '#b88a5a', ring: true, delay: 1.1 },
  { y: 60, r: 9, base: '#6fb7d8', shade: '#3f6f9a', delay: 2.2 },
  { y: 138, r: 34, base: '#8f7fc8', shade: '#5b4a8a', band: '#a99ae0', delay: 2.9 },
]

const ALIVE_CLIP = `${import.meta.env.BASE_URL}voice/how-are-you-alive.mp3`

const GLITCH = '#%&@$/|<>?!01'

const VOICE_LINES: Record<CutsceneKind, [number, string, VoiceName][]> = {
  intro: [
    [INTRO.walkout + 1.2, 'Where is everyone? The ship. Rebuild the rocket.', 'narrator'],
    [INTRO.look + 0.6, "It's far too late. This is your new life.", 'moonlink'],
  ],
  earth: [
    [4.6, 'You sit. You take a deep breath.', 'narrator'],
    [8.2, 'There is no air up here. You breathe anyway.', 'narrator'],
  ],
  act2: [
    [1, 'Eight people. Eight beds. A farm that actually grows.', 'narrator'],
    [4.8, 'For the first time, it feels like a town.', 'narrator'],
    [8, 'On the ridge, something in a helmet is watching.', 'narrator'],
  ],
}

export class Cutscene {
  done = false
  readonly kind: CutsceneKind
  private t = 0
  private stars: Star[] = []
  private cues = new Set<string>()
  private flame = 0

  /** How many astronauts walk out of the crash (multiplayer crews). */
  private crew = 1

  setCrew(count: number): void {
    this.crew = Math.max(1, Math.min(4, count))
  }

  constructor(kind: CutsceneKind = 'intro') {
    this.kind = kind
    for (const [, line, voice] of VOICE_LINES[kind]) preloadVoice(line, voice)
    const rng = createRng(kind === 'intro' ? 3 : 9)
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
    if (!this.done) stopVoice()
    this.done = true
  }

  get finishedFading(): boolean {
    return this.t > (this.kind === 'intro' ? INTRO.total - 1 : this.kind === 'act2' ? ACT2_TOTAL - 1 : EARTH_TOTAL - 1)
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
    VOICE_LINES[this.kind].forEach(([at, line, voice], i) => cue(`voice${i}`, at, () => speak(line, voice)))
    if (this.kind === 'act2') {
      cue('warm', 0.5, () => audio.play('discover'))
      cue('watch', 8, () => audio.play('warning'))
      cue('end', 12, () => audio.play('complete'))
      if (this.t >= ACT2_TOTAL) this.done = true
      return
    }
    if (this.kind === 'earth') {
      cue('breath', 4.6, () => audio.play('discover'))
      cue('end', 11.4, () => audio.play('complete'))
      if (this.t >= EARTH_TOTAL) this.done = true
      return
    }
    cue('lights', INTRO.title + 0.6, () => audio.play('select'))
    cue('sputter1', INTRO.title + 1.6, () => audio.play('rumble'))
    cue('sputter2', INTRO.title + 2.9, () => audio.play('rumble'))
    cue('alarm1', INTRO.planets + 0.2, () => audio.play('alarm'))
    cue('alarm2', INTRO.planets + 1.3, () => audio.play('alarm'))
    cue('rumble', INTRO.fall - 1.2, () => audio.play('rumble'))
    cue('crash', INTRO.fall, () => audio.play('crash'))
    cue('crack', INTRO.fall + 3.4, () => audio.play('helmetCrack'))
    cue('preload', 0.1, () => audio.preloadClip(ALIVE_CLIP))
    cue('voice', INTRO.fall + 4.6, () => {
      audio.play('clue')
      audio.playClip(ALIVE_CLIP)
    })
    cue('wake', INTRO.walkout + 0.6, () => audio.play('land'))
    cue('ai', INTRO.look + 0.5, () => audio.play('warning'))
    if (this.t >= INTRO.total) this.done = true
  }

  draw(ctx: Ctx, text: TextLayer): void {
    rect(ctx, '#05040f', 0, 0, SCREEN_W, SCREEN_H)
    if (this.kind === 'earth') this.drawEarthScene(ctx, text)
    else if (this.kind === 'act2') this.drawAct2(ctx, text)
    else this.drawIntro(ctx, text)
    if (!this.finishedFading) text.text('PRESS ANY KEY TO SKIP', SCREEN_W - 6, SCREEN_H - 9, '#3f4878', { size: 4.5, align: 'right' })
  }

  private drawIntro(ctx: Ctx, text: TextLayer): void {
    const t = this.t
    const typeAt = (line: string, start: number, x: number, y: number, color: string, size = 6, align: 'left' | 'center' = 'left', speed = 26) => {
      const n = Math.floor(clamp((t - start) * speed, 0, line.length))
      if (n > 0) text.text(line.slice(0, n), x, y, color, { size, align })
    }

    if (t < INTRO.title) {
      const fade = clamp(t / 0.5, 0, 1) * clamp((INTRO.title - t) / 0.5, 0, 1)
      text.alpha = fade
      typeAt('10 YEARS LATER...', 0.3, SCREEN_CX, 84, '#d9dcef', 9, 'center', 12)
      text.alpha = 1
      return
    }

    if (t < INTRO.fall) {
      const falling = clamp((t - INTRO.planets) / (INTRO.fall - INTRO.planets), 0, 1)
      const cruising = t > INTRO.engines
      const shake = falling > 0 ? (Math.random() - 0.5) * (1 + falling * 5) : 0
      const drift = cruising ? 1 : 0.15
      for (const s of this.stars) {
        const x = (((s.x - t * s.speed * drift * (cruising ? 4 : 1)) % SCREEN_W) + SCREEN_W) % SCREEN_W
        const y = (((s.y - t * falling * s.speed * 6) % SCREEN_H) + SCREEN_H) % SCREEN_H
        rect(ctx, s.color, x + shake, y, cruising && falling === 0 ? 3 : 1, 1 + Math.round(falling * 3))
      }

      if (cruising && t < INTRO.fall) {
        for (const p of PLANETS) {
          const age = t - INTRO.engines - p.delay
          if (age < 0) continue
          const x = SCREEN_W + p.r * 2 - age * (110 - p.r)
          if (x < -p.r * 3) continue
          this.drawPlanet(ctx, x, p.y - falling * 60, p)
        }
      }

      if (falling > 0) {
        const moonTop = SCREEN_H + 40 - falling * falling * 150
        ellipse(ctx, '#7f88b4', SCREEN_CX, moonTop + 260, 300, 260)
        ellipse(ctx, '#9aa2c8', SCREEN_CX + 10, moonTop + 262, 292, 255)
        for (const [dx, dy, r] of [[-70, 18, 10], [40, 30, 14], [110, 12, 7], [-130, 40, 12], [5, 60, 18]]) {
          ellipse(ctx, '#7f88b4', SCREEN_CX + dx, moonTop + dy, r, r * 0.45)
        }
      }

      const shipX = SCREEN_CX - 20 + Math.sin(t * 0.7) * 4 + shake
      const shipY = 82 + Math.sin(t * 1.5) * 3 + falling * falling * 70
      const sputter = !cruising && Math.random() < 0.18 + (t - INTRO.title) * 0.08
      if (sputter) this.flame = 0.12
      this.flame = Math.max(0, this.flame - 1 / 60)
      const burning = cruising || this.flame > 0
      if (burning && !spriteFrame(SHIP_SPRITE, t)) {
        const n = cruising ? 14 : 7
        for (let i = 0; i < n; i++) {
          const fx = shipX - 12 - i * 2 - Math.random() * 3
          const spread = (Math.random() - 0.5) * (3 + i * 0.6)
          rect(ctx, i < 4 ? '#fff6d8' : i < 9 ? '#fac775' : '#e0884a', fx, shipY + spread, 2, 2)
        }
      }
      const flicker = t - INTRO.title
      const lit = flicker > 1.8 || (flicker > 0.4 && Math.random() < 0.5)
      const shipFrame = spriteFrame(SHIP_SPRITE, t)
      if (shipFrame) {
        const saved = text.alpha
        text.alpha = lit ? 1 : 0.45
        text.image(shipFrame, 0, 0, SHIP_SPRITE.width, SHIP_SPRITE.height, shipX - 24, shipY - 12, 48, 24)
        text.alpha = saved
        if (falling > 0 && Math.floor(t * 4) % 2 === 0) rect(ctx, '#e24b4a', shipX + 2, shipY - 14, 2, 2)
      } else this.drawShipSide(ctx, shipX, shipY, lit, falling > 0 && Math.floor(t * 4) % 2 === 0)

      if (falling > 0) {
        const pulse = (Math.sin(t * 10) + 1) / 2
        ctx.fillStyle = `rgba(226,75,74,${0.12 + pulse * 0.12})`
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
      }

      typeAt('KESTREL // DORMANT 3,652 DAYS', INTRO.title + 0.2, 10, 10, '#5dcaa5')
      typeAt('ENGINE START: UNSCHEDULED', INTRO.title + 1.4, 10, 18, '#fac775')
      if (cruising) typeAt('COURSE: UNKNOWN. AUTOPILOT: NOT RESPONDING.', INTRO.engines + 0.3, 10, 26, '#9aa2cf')
      if (falling > 0) {
        typeAt('WARNING: HULL BREACH', INTRO.planets, 10, 38, '#ff8a7a')
        typeAt('BRACE FOR IMPACT', INTRO.planets + 1.4, 10, 46, '#fac775')
      }
      return
    }

    if (t < INTRO.walkout) {
      this.drawCrashSite(ctx, text, t - INTRO.fall)
      return
    }

    if (t < INTRO.look) {
      this.drawFirstPerson(ctx, text, t - INTRO.walkout)
      return
    }

    const local = t - INTRO.look
    const fadeOut = clamp((INTRO.total - t) / 0.8, 0, 1)
    text.alpha = fadeOut
    text.text('MOONLINK v0.3 // CORE DAMAGED', 10, 10, '#2f6f5f', { size: 5 })
    const line = "IT'S FAR TOO LATE. THIS IS YOUR NEW LIFE."
    const n = Math.floor(clamp((local - 0.6) * 11, 0, line.length))
    let shown = ''
    for (let i = 0; i < n; i++) {
      const corrupt = Math.random() < (i >= n - 2 ? 0.5 : 0.04) && line[i] !== ' '
      shown += corrupt ? GLITCH[Math.floor(Math.random() * GLITCH.length)] : line[i]
    }
    const jitter = Math.random() < 0.08 ? 1 : 0
    if (Math.random() < 0.1) text.text(shown, SCREEN_CX + 1, 86, 'rgba(255,90,120,0.6)', { size: 7, align: 'center' })
    text.text(shown, SCREEN_CX + jitter, 86, '#c8fff0', { size: 7, align: 'center' })
    if (Math.floor(local * 3) % 2 === 0 && n < line.length) rect(ctx, '#5dcaa5', SCREEN_CX + text.measure(shown, { size: 7 }) / 2 + 2, 85, 3, 7)
    text.alpha = 1
  }

  private drawCrashSite(ctx: Ctx, text: TextLayer, local: number): void {
    const flash = clamp(1 - local / 0.7, 0, 1)
    for (const s of this.stars) rect(ctx, s.color, s.x, s.y * 0.6, 1, 1)
    ellipse(ctx, '#378add', 268, 34, 10, 10)
    ellipse(ctx, '#5dcaa5', 265, 31, 4, 3)
    rect(ctx, '#7f88b4', 0, 128, SCREEN_W, 52)
    rect(ctx, '#9aa2c8', 0, 126, SCREEN_W, 3)
    for (const [x, w] of [[30, 18], [190, 26], [280, 12]]) ellipse(ctx, '#6c719a', x, 140, w, 3)

    const lx = 92
    const ly = 126
    rect(ctx, '#9aa0b8', lx - 22, ly - 4, 4, 4)
    rect(ctx, '#9aa0b8', lx + 16, ly - 6, 4, 6)
    rect(ctx, '#d4a43c', lx - 20, ly - 22, 38, 16)
    rect(ctx, '#f2c85e', lx - 20, ly - 22, 38, 2)
    rect(ctx, '#e6e6ee', lx - 12, ly - 36, 22, 14)
    rect(ctx, '#16182c', lx - 6, ly - 33, 8, 6)
    rect(ctx, '#3b2f2a', lx + 6, ly - 18, 8, 12)
    for (let i = 0; i < 6; i++) {
      const p = (local * 0.4 + i / 6) % 1
      const size = 2 + p * 5
      rect(ctx, p < 0.4 ? '#6c719a' : '#4b5488', lx - 4 + Math.sin(p * 6 + i) * 3 - size / 2, ly - 38 - p * 40, size, size)
    }

    const walk = clamp((local - 1) / 2.2, 0, 1)
    const ax = lx + 12 + walk * 70
    const ay = ly
    const step = walk > 0 && walk < 1 ? Math.floor(local * 6) % 2 : 0
    // Crewmates follow the first astronaut out of the wreck, a step behind each other.
    for (let i = this.crew - 1; i >= 1; i--) {
      const w = clamp((local - 1 - i * 0.45) / 2.2, 0, 1)
      if (w <= 0) continue
      const cx = lx + 12 + w * (70 - i * 16)
      const cstep = w > 0 && w < 1 ? Math.floor(local * 6 + i) % 2 : 0
      this.drawAstronaut(ctx, cx, ay + (i % 2) * 2, cstep, local > 3.6 + i * 0.15, local)
    }
    this.drawAstronaut(ctx, ax, ay, step, local > 3.4, local)

    if (local > 3.4 && local < 4.6) text.text('*hhkk...*', ax + 10, ay - 30, '#9aa2cf', { size: 5 })
    if (local > 4.6) {
      const a = clamp((local - 4.6) / 0.4, 0, 1) * clamp((6.5 - local) / 0.5, 0, 1)
      text.alpha = a
      text.text('A VOICE, FROM NOWHERE:', SCREEN_CX, 46, '#5b6496', { size: 5, align: 'center' })
      const line = '"HOW ARE YOU ALIVE?"'
      const shown = Math.floor(clamp((local - 4.75) * 22, 0, line.length))
      if (shown > 0 && shown < line.length) typingFrame()
      const full = text.measure(line, { size: 9 })
      text.text(line.slice(0, shown), SCREEN_CX - full / 2 + (Math.random() < 0.06 ? 1 : 0), 56, '#c9a6ff', { size: 9 })
      text.alpha = 1
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
    const out = clamp((local - 5.8) / 0.4, 0, 1)
    if (out > 0) {
      ctx.fillStyle = `rgba(5,4,15,${out})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
  }

  private drawAstronaut(ctx: Ctx, x: number, y: number, step: number, cracked: boolean, local: number): void {
    rect(ctx, '#c9cbe0', x - 3, y - 6 - step, 2, 6)
    rect(ctx, '#c9cbe0', x + 1, y - 6 + step - 1, 2, 6 - step + 1)
    rect(ctx, '#e6e6ee', x - 4, y - 15, 8, 9)
    rect(ctx, '#9aa0b8', x - 6, y - 14, 2, 4)
    rect(ctx, '#e6e6ee', x - 4, y - 24, 9, 9)
    rect(ctx, cracked ? '#2a3050' : '#3b7dd8', x - 1, y - 22, 6, 5)
    rect(ctx, '#ffffff', x + 3, y - 22, 1, 1)
    if (cracked) {
      rect(ctx, '#ffffff', x, y - 21, 1, 1)
      rect(ctx, '#ffffff', x + 1, y - 20, 1, 1)
      rect(ctx, '#ffffff', x + 2, y - 21, 1, 1)
      rect(ctx, '#ffffff', x + 3, y - 19, 1, 1)
      rect(ctx, '#ffffff', x + 1, y - 18, 1, 1)
      if (local < 4) for (let i = 0; i < 4; i++) rect(ctx, '#d9dcef', x + 5 + i * 2 + Math.random() * 2, y - 22 + Math.random() * 6, 1, 1)
    }
  }

  private drawFirstPerson(ctx: Ctx, text: TextLayer, local: number): void {
    const pan = Math.sin(local * 1.3) * 46 + Math.sin(local * 3.1) * 4
    const draw = (dx: number) => {
      for (const s of this.stars) rect(ctx, s.color, ((s.x + dx) % SCREEN_W + SCREEN_W) % SCREEN_W, s.y * 0.55, 1, 1)
      ellipse(ctx, '#378add', 240 + dx, 30, 12, 12)
      ellipse(ctx, '#5dcaa5', 236 + dx, 26, 5, 4)
      ellipse(ctx, '#9aa2c8', SCREEN_CX + dx * 0.4, 300, 420, 200)
      ellipse(ctx, '#7f88b4', 60 + dx, 118, 26, 4)
      ellipse(ctx, '#7f88b4', 250 + dx, 128, 34, 5)
      rect(ctx, '#d4a43c', 120 + dx, 92, 30, 12)
      rect(ctx, '#e6e6ee', 126 + dx, 82, 16, 10)
      rect(ctx, '#3b2f2a', 140 + dx, 96, 6, 8)
    }
    draw(pan)
    ctx.globalAlpha = 0.3
    draw(pan + 4 + Math.sin(local * 5) * 2)
    ctx.globalAlpha = 1

    const blink = local < 0.9 ? 1 - local / 0.9 : local > 1.8 && local < 2.1 ? 1 - Math.abs(local - 1.95) / 0.15 : 0
    const lid = Math.round(blink * (SCREEN_H / 2))
    rect(ctx, '#05040f', 0, 0, SCREEN_W, lid)
    rect(ctx, '#05040f', 0, SCREEN_H - lid, SCREEN_W, lid)
    const vignette = ctx.createRadialGradient(SCREEN_CX, SCREEN_H / 2, 60, SCREEN_CX, SCREEN_H / 2, 200)
    vignette.addColorStop(0, 'rgba(5,4,15,0)')
    vignette.addColorStop(1, 'rgba(5,4,15,0.85)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

    if (local > 1.2) text.text('...where is everyone?', SCREEN_CX, 150, '#9aa2cf', { size: 6, align: 'center' })
    if (local > 2.8) text.text('The ship. Rebuild the rocket.', SCREEN_CX, 160, '#fac775', { size: 6, align: 'center' })
    const out = clamp((local - 4) / 0.5, 0, 1)
    if (out > 0) {
      ctx.fillStyle = `rgba(5,4,15,${out})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
  }

  private drawAct2(ctx: Ctx, text: TextLayer): void {
    const t = this.t
    for (const s of this.stars) rect(ctx, Math.sin(t + s.x) > 0.9 ? '#ffffff' : s.color, s.x, s.y * 0.55, 1, 1)
    ellipse(ctx, '#2c5fa8', 60, 30, 9, 9)
    ellipse(ctx, '#3fae7c', 58, 28, 3, 3)
    rect(ctx, '#5b6496', 0, 118, SCREEN_W, 62)
    rect(ctx, '#7f88b4', 0, 116, SCREEN_W, 3)
    const houses: [number, number][] = [[40, 112], [92, 108], [210, 110], [258, 113]]
    for (const [x, y] of houses) {
      rect(ctx, '#3a4062', x - 12, y - 12, 24, 12)
      rect(ctx, '#a85a2a', x - 14, y - 15, 28, 3)
      rect(ctx, Math.sin(t * 3 + x) > -0.8 ? '#fac775' : '#a8742a', x - 3, y - 9, 6, 4)
    }
    rect(ctx, '#3f4878', 150, 98, 4, 18)
    const flick = 0.75 + Math.sin(t * 9) * 0.1 + Math.random() * 0.1
    ctx.fillStyle = `rgba(250,199,117,${0.18 * flick})`
    ctx.beginPath()
    ctx.arc(152, 112, 46, 0, Math.PI * 2)
    ctx.fill()
    rect(ctx, '#fff6d8', 149, 94, 6, 5)
    const people = ['#e0884a', '#5dcaa5', '#7fb2ff', '#c9a6ff', '#fac775', '#ff8a7a', '#7fcf6a', '#e6e6ee']
    people.forEach((c, i) => {
      const x = 112 + i * 11 + (i > 3 ? 8 : 0)
      const sway = Math.sin(t * 1.5 + i) * 0.6
      rect(ctx, c, x - 2, 112 + sway, 4, 7)
      rect(ctx, '#c98a5a', x - 2, 108 + sway, 4, 4)
    })
    if (t > 7.5) {
      const a = Math.min(1, (t - 7.5) / 1.2)
      ctx.globalAlpha = a
      rect(ctx, '#16182c', 300, 96, 5, 10)
      rect(ctx, '#16182c', 299, 90, 7, 6)
      if (Math.floor(t * 2) % 2) rect(ctx, '#fac775', 301, 92, 3, 1)
      ctx.globalAlpha = 1
    }
    const show = (line: string, start: number, end: number, y: number, color: string, size: number) => {
      if (t < start || t > end) return
      text.alpha = clamp((t - start) / 0.6, 0, 1) * clamp((end - t) / 0.6, 0, 1)
      text.text(line, SCREEN_CX, y, color, { size, align: 'center' })
      text.alpha = 1
    }
    show('Eight people. Eight beds. A farm that actually grows.', 1, 4.6, 140, '#d9dcef', 6)
    show('For the first time, it feels like a town.', 4.8, 7.6, 140, '#fac775', 6)
    show('On the ridge, something in a helmet is watching.', 8, 11.6, 140, '#ff8a7a', 6)
    show('ACT II COMPLETE', 12, 15, 70, '#fac775', 10)
    const fadeIn = clamp(1 - t / 1, 0, 1)
    const fadeOut = clamp((t - (ACT2_TOTAL - 0.8)) / 0.8, 0, 1)
    const black = Math.max(fadeIn, fadeOut)
    if (black > 0) {
      ctx.fillStyle = `rgba(5,4,15,${black})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
  }

  private drawEarthScene(ctx: Ctx, text: TextLayer): void {
    const t = this.t
    for (const s of this.stars) {
      const tw = Math.sin(t * 2 + s.x) > 0.8
      rect(ctx, tw ? '#ffffff' : s.color, s.x, s.y * 0.7, 1, 1)
    }
    const ex = 220
    const ey = 52
    ellipse(ctx, '#1d3f7a', ex, ey, 30, 30)
    ellipse(ctx, '#2c5fa8', ex - 3, ey - 3, 27, 27)
    for (const [dx, dy, w, h] of [[-12, -8, 9, 6], [6, 4, 11, 7], [-4, 14, 7, 4], [14, -14, 5, 4]]) ellipse(ctx, '#3fae7c', ex + dx, ey + dy, w, h)
    for (const [dx, dy, w] of [[-8, -18, 12], [10, -2, 9], [-16, 6, 7]]) rect(ctx, '#eef0f8', ex + dx, ey + dy + Math.sin(t * 0.3) * 1, w, 1)
    ctx.fillStyle = 'rgba(5,4,15,0.45)'
    for (let dy = -30; dy <= 30; dy++) {
      const half = Math.sqrt(Math.max(0, 900 - dy * dy))
      const cut = half * 0.55
      ctx.fillRect(Math.round(ex + cut), ey + dy, Math.max(0, Math.round(half - cut)), 1)
    }

    ellipse(ctx, '#9aa2c8', SCREEN_CX, 330, 380, 200)
    rect(ctx, '#7f88b4', 0, 160, SCREEN_W, 20)
    ellipse(ctx, '#6c719a', 90, 140, 14, 6)

    const breath = Math.sin(t * 1.25) * 1
    const ax = 90
    const ay = 134
    rect(ctx, '#c9cbe0', ax - 6, ay - 2, 10, 3)
    rect(ctx, '#e6e6ee', ax - 5, ay - 12 - breath, 9, 10 + breath)
    rect(ctx, '#9aa0b8', ax - 5, ay - 10 - breath, 9, 3)
    rect(ctx, '#3d2a1f', ax - 4, ay - 19 - breath, 7, 7)
    rect(ctx, '#5a3f2a', ax - 3, ay - 19 - breath, 4, 1)
    rect(ctx, '#e8b98f', ax + 3, ay - 16 - breath, 1, 3)
    if (t > 4.6 && t < 7.5) {
      const p = (t - 4.6) / 2.9
      ctx.globalAlpha = 0.5 * (1 - p)
      ellipse(ctx, '#d9dcef', ax + 6 + p * 8, ay - 16 - p * 6, 1 + p * 3, 1 + p * 2)
      ctx.globalAlpha = 1
    }

    const show = (line: string, start: number, end: number, y: number, color: string, size: number) => {
      if (t < start || t > end) return
      text.alpha = clamp((t - start) / 0.6, 0, 1) * clamp((end - t) / 0.6, 0, 1)
      text.text(line, SCREEN_CX, y, color, { size, align: 'center' })
      text.alpha = 1
    }
    show('...', 1.5, 4.4, 150, '#5b6496', 7)
    show('You sit. You take a deep breath.', 4.6, 8, 150, '#d9dcef', 6)
    show("There is no air up here. You breathe anyway.", 8.2, 11.2, 150, '#c9a6ff', 6)
    show('ACT I COMPLETE', 11.4, 14, 92, '#fac775', 10)

    const fadeIn = clamp(1 - t / 1.2, 0, 1)
    const fadeOut = clamp((t - (EARTH_TOTAL - 0.8)) / 0.8, 0, 1)
    const black = Math.max(fadeIn, fadeOut)
    if (black > 0) {
      ctx.fillStyle = `rgba(5,4,15,${black})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
  }

  private drawPlanet(ctx: Ctx, x: number, y: number, p: Planet): void {
    if (p.ring) ellipse(ctx, '#b8a07a', x, y, p.r * 1.9, p.r * 0.35)
    ellipse(ctx, p.base, x, y, p.r, p.r)
    if (p.band) for (const dy of [-0.4, 0.1, 0.5]) rect(ctx, p.band, x - p.r * Math.sqrt(1 - dy * dy), y + dy * p.r, p.r * 2 * Math.sqrt(1 - dy * dy), Math.max(1, p.r * 0.12))
    ctx.fillStyle = p.shade
    for (let dy = -p.r; dy <= p.r; dy++) {
      const half = Math.sqrt(Math.max(0, p.r * p.r - dy * dy))
      ctx.fillRect(Math.round(x + half * 0.35), Math.round(y + dy), Math.max(0, Math.round(half * 0.65)), 1)
    }
    if (p.ring) {
      ctx.fillStyle = '#d8c49a'
      ctx.fillRect(Math.round(x - p.r * 1.9), Math.round(y), Math.round(p.r * 3.8), 1)
    }
  }

  private drawShipSide(ctx: Ctx, x: number, y: number, lit: boolean, warning: boolean): void {
    const s = 2
    const box = (c: string, ux: number, uy: number, w: number, h: number) => rect(ctx, c, x + ux * s, y + uy * s, w * s, h * s)
    box('#9aa0b8', -6, -3, 2, 6)
    box('#d4a43c', -5, -3, 9, 6)
    box('#f2c85e', -5, -3, 9, 1)
    box('#e6e6ee', 4, -2, 4, 4)
    box('#e6e6ee', 8, -1, 1, 2)
    box(lit ? '#9fe1ff' : '#16182c', 5, -1, 2, 1)
    box(lit ? '#fac775' : '#2a2238', -3, -1, 1, 1)
    box(lit ? '#fac775' : '#2a2238', 0, -1, 1, 1)
    box('#c9cbe0', -3, 3, 1, 2)
    box('#c9cbe0', 2, 3, 1, 2)
    box(warning ? '#e24b4a' : lit ? '#5dcaa5' : '#1d3f3a', 3, -4, 1, 1)
  }
}
