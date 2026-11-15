import type { GameAudio } from './audio'
import { SCREEN_CX, SCREEN_H, SCREEN_W } from './constants'
import { clamp, createRng } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import type { TextLayer } from './text'
import { preloadVoice, speak } from './voice'
import { SHIP_SPRITE, spriteFrame } from './sprites'

export type Ending = 'together' | 'captured'

interface Craft {
  x: number
  y: number
  vy: number
  hp: number
  phase: number
  fire: number
}

interface Bolt {
  x: number
  y: number
  vx: number
  vy: number
  friendly: boolean
}

export interface FinaleInput {
  up: boolean
  down: boolean
  fire: boolean
  jump: boolean
  act: boolean
}

type Phase = 'launch' | 'fight' | 'reentry' | 'brawl' | 'leap' | 'captured' | 'end'

const KILLS_NEEDED = 10
/** Launch cutscene shots, in seconds from the start of the launch phase. */
const LAUNCH = { board: 0, countdown: 4.5, ignite: 8.6, liftoff: 9.2, climb: 13, total: 17.5 } as const
const FIGHT_TIME = 50

export class Finale {
  readonly ending: Ending
  phase: Phase = 'launch'
  done = false
  rewind = false
  private t = 0
  private phaseT = 0
  private stars: { x: number; y: number; s: number }[] = []
  private shipY = SCREEN_H / 2
  private hp = 5
  private kills = 0
  private crafts: Craft[] = []
  private bolts: Bolt[] = []
  private spawn = 1
  private cooldown = 0
  private pushes = 0
  private leaps = 0
  private qte = 0
  private flash = 0
  private lastAct = false
  private lastJump = false

  constructor(ending: Ending) {
    this.ending = ending
    preloadVoice('Fuel full. Hull sealed. For the first time, nobody is jamming me. Go.', 'moonlink')
    for (const [line, voice] of ending === 'together' ? ([['Signal clear. First time in ten years. Welcome home.', 'moonlink']] as const) : ([['You promised. You promised all of us.', 'maya'], ['Retrieval complete. Helmets on. Do not look it in the eye.', 'stranger'], ['This is not how it ends.', 'narrator']] as const)) preloadVoice(line, voice)
    const rng = createRng(77)
    for (let i = 0; i < 140; i++) this.stars.push({ x: rng() * SCREEN_W, y: rng() * SCREEN_H, s: 0.3 + rng() * 2 })
  }

  private go(phase: Phase): void {
    this.phase = phase
    this.phaseT = 0
    if (phase === 'brawl') speak('You promised. You promised all of us.', 'maya')
    if (phase === 'captured') speak('Retrieval complete. Helmets on. Do not look it in the eye.', 'stranger')
  }

  update(dt: number, input: FinaleInput, audio: GameAudio): void {
    this.t += dt
    this.phaseT += dt
    this.flash = Math.max(0, this.flash - dt)
    const pressedAct = input.act && !this.lastAct
    const pressedJump = input.jump && !this.lastJump
    this.lastAct = input.act
    this.lastJump = input.jump

    if (this.phase === 'launch') {
      const t = this.phaseT
      const at = (mark: number) => t >= mark && t - dt < mark
      if (at(0.6)) speak('Fuel full. Hull sealed. For the first time, nobody is jamming me. Go.', 'moonlink')
      for (let i = 0; i < 4; i++) if (at(LAUNCH.countdown + 0.3 + i)) audio.play('select')
      if (at(LAUNCH.countdown + 0.1)) audio.play('alarm')
      if (at(LAUNCH.ignite)) audio.play('crash')
      if (at(LAUNCH.liftoff)) audio.play('rumble')
      if (at(LAUNCH.liftoff + 1.6)) audio.play('rumble')
      if (at(LAUNCH.climb + 1.2)) audio.play('break')
      if (pressedAct && t > 1) this.phaseT = LAUNCH.total
      if (this.phaseT >= LAUNCH.total) this.go(this.ending === 'together' ? 'fight' : 'brawl')
      return
    }

    if (this.phase === 'fight') {
      if (input.up) this.shipY -= 70 * dt
      if (input.down) this.shipY += 70 * dt
      this.shipY = clamp(this.shipY, 20, SCREEN_H - 20)
      this.cooldown -= dt
      if (input.fire && this.cooldown <= 0) {
        this.cooldown = 0.22
        this.bolts.push({ x: 82, y: this.shipY + 1, vx: 220, vy: 0, friendly: true })
        audio.play('shoot')
      }
      this.spawn -= dt
      if (this.spawn <= 0 && this.phaseT < FIGHT_TIME - 4) {
        this.spawn = Math.max(0.7, 2 - this.phaseT * 0.03)
        this.crafts.push({ x: SCREEN_W + 12, y: 25 + Math.random() * (SCREEN_H - 50), vy: 0, hp: 2, phase: Math.random() * 6, fire: 1 + Math.random() })
      }
      for (const c of this.crafts) {
        c.x -= 38 * dt
        c.y += Math.sin(this.t * 2 + c.phase) * 22 * dt
        c.fire -= dt
        if (c.fire <= 0 && c.x < SCREEN_W - 20) {
          c.fire = 1.6 + Math.random()
          const dy = this.shipY - c.y
          const dx = 60 - c.x
          const len = Math.hypot(dx, dy) || 1
          this.bolts.push({ x: c.x - 8, y: c.y, vx: (dx / len) * 110, vy: (dy / len) * 110, friendly: false })
          audio.play('enemyShoot')
        }
      }
      for (const b of this.bolts) {
        b.x += b.vx * dt
        b.y += b.vy * dt
        if (b.friendly) {
          const hit = this.crafts.find((c) => c.hp > 0 && Math.abs(c.x - b.x) < 9 && Math.abs(c.y - b.y) < 6)
          if (hit) {
            hit.hp--
            b.x = 9999
            audio.play('enemyHit')
            if (hit.hp <= 0) {
              this.kills++
              audio.play('enemyDie')
            }
          }
        } else if (Math.abs(b.x - 60) < 17 && Math.abs(b.y - this.shipY) < 6) {
          b.x = -9999
          this.hp--
          this.flash = 0.25
          audio.play('hurt')
        }
      }
      this.bolts = this.bolts.filter((b) => b.x > -20 && b.x < SCREEN_W + 20 && b.y > -20 && b.y < SCREEN_H + 20)
      this.crafts = this.crafts.filter((c) => c.hp > 0 && c.x > -20)
      if (this.hp <= 0) {
        this.hp = 5
        this.kills = Math.max(0, this.kills - 3)
        this.crafts = []
        this.bolts = []
        this.flash = 0.6
        audio.play('warning')
      }
      if (this.kills >= KILLS_NEEDED || this.phaseT > FIGHT_TIME) {
        this.crafts = []
        this.bolts = []
        audio.play('complete')
        this.go('reentry')
      }
      return
    }

    if (this.phase === 'reentry') {
      if (this.phaseT > 3 && this.phaseT - dt <= 3) {
        audio.play('rumble')
        speak('Signal clear. First time in ten years. Welcome home.', 'moonlink')
      }
      if (this.phaseT > 12) this.go('end')
      return
    }

    if (this.phase === 'brawl') {
      this.qte -= dt
      if (pressedAct && this.qte <= 0) {
        this.pushes++
        this.qte = 0.15
        this.flash = 0.12
        audio.play('hit')
      }
      if (this.pushes >= 6) {
        audio.play('warning')
        this.go('leap')
      }
      return
    }

    if (this.phase === 'leap') {
      if (pressedJump && this.phaseT > 0.6) {
        this.leaps++
        this.phaseT = 0
        audio.play('jump')
        if (this.leaps >= 2) {
          audio.play('crash')
          this.go('captured')
        }
      }
      return
    }

    if (this.phase === 'captured') {
      if (this.phaseT > 5 && this.phaseT - dt <= 5) speak('This is not how it ends.', 'narrator')
      if (this.phaseT > 9) {
        this.rewind = true
        this.done = true
      }
      return
    }

    if (this.phase === 'end' && this.phaseT > 6 && pressedAct) this.done = true
  }

  draw(ctx: Ctx, text: TextLayer): void {
    rect(ctx, '#05040f', 0, 0, SCREEN_W, SCREEN_H)
    const p = this.phase
    if (p === 'launch') this.drawLaunch(ctx, text)
    else if (p === 'fight') this.drawFight(ctx, text)
    else if (p === 'reentry') this.drawReentry(ctx, text)
    else if (p === 'brawl' || p === 'leap') this.drawBrawl(ctx, text)
    else if (p === 'captured') this.drawCaptured(ctx, text)
    else this.drawEnd(text)
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,90,90,${this.flash})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
  }

  private starfield(ctx: Ctx, speed: number): void {
    for (const s of this.stars) {
      const x = (((s.x - this.t * speed * s.s) % SCREEN_W) + SCREEN_W) % SCREEN_W
      rect(ctx, s.s > 1.5 ? '#d9d6ff' : '#6b66a8', x, s.y, Math.max(1, Math.round(speed / 60)), 1)
    }
  }

  private drawLaunch(ctx: Ctx, text: TextLayer): void {
    const t = this.phaseT
    if (t < LAUNCH.countdown) this.drawLaunchPad(ctx, text, t)
    else if (t < LAUNCH.liftoff) this.drawIgnition(ctx, text, t - LAUNCH.countdown)
    else if (t < LAUNCH.climb) this.drawLiftoff(ctx, text, t - LAUNCH.liftoff)
    else this.drawClimb(ctx, text, t - LAUNCH.climb)
    // Cut fades between shots.
    for (const cut of [LAUNCH.countdown, LAUNCH.liftoff, LAUNCH.climb]) {
      const d = Math.abs(t - cut)
      if (d < 0.25) {
        ctx.fillStyle = `rgba(5,4,15,${1 - d / 0.25})`
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
      }
    }
    if (t > LAUNCH.total - 1.5) {
      ctx.fillStyle = `rgba(5,4,15,${clamp((t - (LAUNCH.total - 1.5)) / 1.3, 0, 1)})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
    if (t > 1) text.text('[E] SKIP', SCREEN_W - 6, SCREEN_H - 10, '#5b6496', { size: 4.5, align: 'right' })
  }

  private moonSky(ctx: Ctx, earthX: number, earthY: number, earthR: number): void {
    ctx.fillStyle = '#05040f'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    for (const s of this.stars) rect(ctx, s.s > 1.6 ? '#d9d6ff' : '#4b4880', s.x, s.y * 0.75, 1, 1)
    ellipse(ctx, '#1d3f86', earthX, earthY, earthR, earthR)
    ellipse(ctx, '#3b7dd8', earthX - earthR * 0.15, earthY - earthR * 0.1, earthR * 0.8, earthR * 0.8)
    ellipse(ctx, '#3fae7c', earthX - earthR * 0.35, earthY - earthR * 0.2, earthR * 0.3, earthR * 0.22)
    ellipse(ctx, '#e8f6ff', earthX + earthR * 0.25, earthY + earthR * 0.3, earthR * 0.35, earthR * 0.12)
  }

  /** The rocket, nose up, base at (x, y). Scale 1 is 60px tall. */
  private drawRocket(ctx: Ctx, x: number, y: number, scale: number, lit: boolean): void {
    const k = scale
    const r = (c: string, dx: number, dy: number, w: number, h: number) => rect(ctx, c, Math.round(x + dx * k), Math.round(y + dy * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)))
    r('#5b6496', -12, -14, 5, 14)
    r('#5b6496', 7, -14, 5, 14)
    r('#3f4878', -5, -4, 10, 4)
    r('#c9cbe0', -7, -52, 14, 48)
    r('#ffffff', -7, -52, 4, 48)
    r('#e0884a', -7, -34, 14, 3)
    r('#e0884a', -7, -16, 14, 3)
    r('#16182c', -3, -46, 6, 5)
    r(lit ? '#9fe1ff' : '#3f6f9a', -2, -45, 4, 3)
    r('#e24b4a', -6, -58, 12, 6)
    r('#e24b4a', -4, -62, 8, 4)
    r('#ff8a7a', -2, -64, 4, 2)
    r('#d4a43c', -2, -27, 4, 8)
  }

  private flame(ctx: Ctx, x: number, y: number, len: number, width: number): void {
    for (let i = 0; i < len * 1.6; i++) {
      const f = Math.random()
      const fy = y + f * len
      const spread = (1 - f * 0.6) * width
      rect(ctx, f < 0.25 ? '#fff6d8' : f < 0.6 ? '#fac775' : '#e0884a', x - spread / 2 + Math.random() * spread, fy, 2, 2)
    }
  }

  private dust(ctx: Ctx, x: number, y: number, radius: number, alpha: number, seed: number): void {
    const rng = createRng(seed)
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI
      const d = rng() * radius
      const size = 3 + rng() * 6
      ctx.globalAlpha = alpha * (0.4 + rng() * 0.6)
      rect(ctx, rng() < 0.5 ? '#9aa2c8' : '#c9cbe0', x + Math.cos(a) * d * (rng() < 0.5 ? -1 : 1) - size / 2, y - Math.sin(a) * d * 0.35 - size / 2, size, size)
    }
    ctx.globalAlpha = 1
  }

  private drawLaunchPad(ctx: Ctx, text: TextLayer, t: number): void {
    this.moonSky(ctx, 250, 34, 16)
    rect(ctx, '#7f88b4', 0, 128, SCREEN_W, 52)
    rect(ctx, '#9aa2c8', 0, 128, SCREEN_W, 3)
    for (const [cx, cy, cr] of [[40, 150, 10], [270, 160, 14], [190, 170, 6]] as const) ellipse(ctx, '#6c719a', cx, cy, cr, cr * 0.3)
    const px = 150
    // Pad and gantry.
    rect(ctx, '#3f4878', px - 26, 130, 52, 5)
    rect(ctx, '#5b6496', px - 26, 130, 52, 1)
    for (let gy = 70; gy < 130; gy += 8) {
      rect(ctx, '#9aa0b8', px + 22, gy, 2, 8)
      rect(ctx, '#9aa0b8', px + 30, gy, 2, 8)
      rect(ctx, '#7c85b4', px + 22, gy, 10, 1)
    }
    rect(ctx, '#9aa0b8', px + 8, 86, 16, 2)
    if (Math.floor(t * 2) % 2 === 0) rect(ctx, '#e24b4a', px + 26, 66, 2, 2)
    this.drawRocket(ctx, px, 130, 1, t > 1.5)
    // Settlement lights in the distance.
    for (const [hx, hw] of [[30, 16], [58, 12], [92, 14]] as const) {
      rect(ctx, '#c9cbe0', hx, 118, hw, 10)
      rect(ctx, '#e0884a', hx, 122, hw, 1)
      rect(ctx, '#fac775', hx + 3, 120, 2, 2)
    }
    // People: boarding (together) or watching from the houses (captured).
    const ramp = { x: px - 30, y: 130 }
    rect(ctx, '#9aa0b8', ramp.x, ramp.y - 1, 26, 1)
    const people = ['#e0884a', '#5dcaa5', '#7fb2ff', '#c9a6ff', '#fac775', '#ff8a7a']
    people.forEach((suit, i) => {
      let hx: number
      if (this.ending === 'together') {
        const p = clamp((t - i * 0.45) / 2.6, 0, 1)
        if (p >= 1) return
        hx = 70 + i * 4 + p * (px - 74 - i * 4)
      } else {
        hx = 34 + i * 12
      }
      const hy = 130 - (this.ending === 'together' && hx > ramp.x ? 2 : 0)
      const step = Math.floor((t + i) * 6) % 2
      rect(ctx, '#e6e6ee', hx - 1, hy - 4, 1, 4)
      rect(ctx, '#e6e6ee', hx + 1, hy - 4, 1, 4 - step)
      rect(ctx, suit, hx - 2, hy - 9, 5, 5)
      rect(ctx, '#e2c49a', hx - 1, hy - 12, 3, 3)
      if (this.ending === 'captured' && Math.floor(t * 3 + i) % 4 === 0) rect(ctx, '#e2c49a', hx + 3, hy - 12, 1, 3)
    })
    const caption = this.ending === 'together' ? 'EVERYONE GOES. ONE BY ONE THEY CLIMB ABOARD.' : 'YOU BOARD ALONE. THE SETTLEMENT WATCHES FROM THE DOORWAYS.'
    const a = clamp((t - 0.6) / 0.5, 0, 1)
    text.alpha = a
    text.text(caption, SCREEN_CX, 14, '#d9dcef', { size: 6, align: 'center' })
    text.text('MOONLINK: "FUEL FULL. HULL SEALED. NOBODY IS JAMMING ME. GO."', SCREEN_CX, 24, '#5dcaa5', { size: 5, align: 'center' })
    text.alpha = 1
  }

  private drawIgnition(ctx: Ctx, text: TextLayer, t: number): void {
    const igniting = t > LAUNCH.ignite - LAUNCH.countdown
    const shake = igniting ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * t * 0.3
    ctx.fillStyle = '#05040f'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    for (const s of this.stars) rect(ctx, '#4b4880', s.x, s.y * 0.5, 1, 1)
    const rx = SCREEN_CX + 50 + shake
    rect(ctx, '#7f88b4', 0, 156, SCREEN_W, 24)
    rect(ctx, '#3f4878', rx - 70, 150, 140, 8)
    // Close-up on the engines: rocket drawn large so its lower half fills the frame.
    for (const gx of [-40, 40]) rect(ctx, '#5b6496', rx + gx - 2, 120, 4, 30)
    if (t > 2.2) {
      const power = igniting ? 1 : (t - 2.2) / 1.9
      this.flame(ctx, rx, 124, 10 + power * 22, 8 + power * 14)
    }
    this.drawRocket(ctx, rx, 124, 2.2, true)
    if (t > 2.2) {
      const power = igniting ? 1 : (t - 2.2) / 1.9
      this.dust(ctx, rx, 154, 40 + power * 130, 0.5 + power * 0.4, Math.floor(this.t * 12))
    }
    if (igniting) {
      ctx.fillStyle = `rgba(255,246,216,${0.35 * Math.random()})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
    const n = 4 - Math.floor(t - 0.3)
    const label = t < 0.3 ? 'T-MINUS' : n > 0 ? String(n) : 'IGNITION'
    text.text(label, 70, 60, n > 0 && t >= 0.3 ? '#fac775' : '#ff8a7a', { size: label.length > 2 ? 13 : 24, align: 'center', weight: 700 })
  }

  private drawLiftoff(ctx: Ctx, text: TextLayer, t: number): void {
    this.moonSky(ctx, 250, 34, 16)
    const groundY = 128 + t * t * 4
    rect(ctx, '#7f88b4', 0, groundY, SCREEN_W, SCREEN_H)
    rect(ctx, '#9aa2c8', 0, groundY, SCREEN_W, 3)
    rect(ctx, '#3f4878', 124, groundY + 2, 52, 5)
    const rise = t * t * 9
    const ry = 130 - rise
    const shake = (Math.random() - 0.5) * Math.max(0, 2 - t * 0.5)
    this.flame(ctx, 150 + shake, ry, 26 + t * 10, 12)
    // Exhaust trail left behind.
    for (let i = 0; i < 30; i++) {
      const ty = ry + 20 + Math.random() * (groundY - ry)
      ctx.globalAlpha = 0.35
      rect(ctx, '#c9cbe0', 146 + (Math.random() - 0.5) * 10, ty, 3, 3)
    }
    ctx.globalAlpha = 1
    this.drawRocket(ctx, 150 + shake, ry, 1, true)
    this.dust(ctx, 150, groundY + 4, 30 + t * 70, clamp(1 - t / 4, 0, 1), 9)
    text.text('LIFTOFF', SCREEN_CX, 16, '#fac775', { size: 12, align: 'center', weight: 700 })
  }

  private drawClimb(ctx: Ctx, text: TextLayer, t: number): void {
    // Looking back down: the Moon curves away below, the Earth hangs ahead.
    this.moonSky(ctx, 70 + t * 3, 40 - t * 2, 22 + t * 3)
    const moonR = 420 - t * 30
    ellipse(ctx, '#5b6496', SCREEN_CX, SCREEN_H + moonR - 40 + t * 9, moonR, moonR)
    ellipse(ctx, '#7f88b4', SCREEN_CX, SCREEN_H + moonR - 38 + t * 9, moonR - 3, moonR - 3)
    for (const [cx, cr] of [[60, 10], [190, 16], [260, 8]] as const) ellipse(ctx, '#6c719a', cx, SCREEN_H - 20 + t * 9, cr, cr * 0.3)
    const rx = 170 + t * 6
    const ry = 110 - t * 14
    const sep = t > 1.2
    if (sep) {
      // Spent booster tumbling away after stage separation.
      const d = t - 1.2
      rect(ctx, '#9aa0b8', rx - 6 - d * 4, ry + 4 + d * 14, 5, 9)
      if (d < 0.25) {
        ctx.fillStyle = `rgba(255,246,216,${0.6 * (1 - d / 0.25)})`
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
      }
    }
    this.flame(ctx, rx, ry, sep ? 10 : 16, 5)
    this.drawRocket(ctx, rx, ry, 0.4, true)
    const a = clamp((t - 1.8) / 0.6, 0, 1) * clamp((LAUNCH.total - LAUNCH.climb - 0.3 - t) / 1.1, 0, 1)
    text.alpha = a
    text.text('LEAVING THE MOON', SCREEN_CX, 20, '#d9dcef', { size: 9, align: 'center', weight: 700 })
    text.text(this.ending === 'together' ? 'EVERY SEAT IS FULL.' : 'ONE SEAT IS FULL. THE REST ARE EMPTY.', SCREEN_CX, 34, this.ending === 'together' ? '#9fe1cb' : '#ff8a7a', { size: 6, align: 'center' })
    text.alpha = 1
  }

  private drawShip(ctx: Ctx, x: number, y: number, text?: TextLayer): void {
    const frame = spriteFrame(SHIP_SPRITE, this.t)
    if (frame && text) {
      text.image(frame, 0, 0, SHIP_SPRITE.width, SHIP_SPRITE.height, x - 20, y - 10, 40, 20)
      return
    }
    rect(ctx, '#e6e6ee', x - 10, y - 3, 18, 6)
    rect(ctx, '#e24b4a', x + 8, y - 2, 4, 4)
    rect(ctx, '#9fe1ff', x + 2, y - 2, 3, 2)
    rect(ctx, '#e0884a', x - 10, y - 1, 18, 1)
    for (let i = 0; i < 5; i++) rect(ctx, i < 2 ? '#fff6d8' : '#fac775', x - 12 - i * 2 - Math.random() * 2, y - 1 + (Math.random() - 0.5) * 2, 2, 2)
  }

  private drawFight(ctx: Ctx, text: TextLayer): void {
    this.starfield(ctx, 120)
    ellipse(ctx, '#9aa2c8', -30, SCREEN_H + 60, 110, 110)
    this.drawShip(ctx, 60, this.shipY, text)
    for (const c of this.crafts) {
      rect(ctx, '#2a2f4c', c.x - 8, c.y - 4, 16, 8)
      rect(ctx, '#3a4062', c.x - 4, c.y - 6, 8, 3)
      rect(ctx, '#ff5a5a', c.x - 8, c.y - 1, 2, 2)
    }
    for (const b of this.bolts) rect(ctx, b.friendly ? '#9fe1cb' : '#ff5a5a', b.x - 2, b.y - 1, 4, 2)
    text.text(`SHIELDS ${'■'.repeat(this.hp)}${'□'.repeat(5 - this.hp)}`, 8, 6, '#9fe1cb', { size: 6 })
    text.text(`INTERCEPTORS ${this.kills}/${KILLS_NEEDED}`, SCREEN_W - 8, 6, '#ff8a7a', { size: 6, align: 'right' })
    text.text('W/S MOVE · Q / SPACE / CLICK FIRE', SCREEN_CX, SCREEN_H - 10, '#5b6496', { size: 5, align: 'center' })
    if (this.phaseT < 4) text.text('THEY FOLLOWED YOU UP. GET EVERYONE HOME.', SCREEN_CX, 24, '#fac775', { size: 7, align: 'center' })
  }

  private drawReentry(ctx: Ctx, text: TextLayer): void {
    const t = this.phaseT
    const grow = clamp(t / 7, 0, 1)
    this.starfield(ctx, 30)
    const r = 30 + grow * grow * 260
    const ex = SCREEN_W - 70 + grow * 40
    const ey = SCREEN_H / 2 + grow * 120
    ellipse(ctx, '#1d3f7a', ex, ey, r, r)
    ellipse(ctx, '#2c5fa8', ex - r * 0.05, ey - r * 0.05, r * 0.92, r * 0.92)
    ellipse(ctx, '#3fae7c', ex - r * 0.3, ey - r * 0.25, r * 0.28, r * 0.18)
    ellipse(ctx, '#3fae7c', ex + r * 0.2, ey + r * 0.1, r * 0.22, r * 0.2)
    if (t > 7) {
      const heat = clamp((t - 7) / 2, 0, 1)
      for (let i = 0; i < 40; i++) rect(ctx, i % 3 ? '#ff9f5a' : '#fff6d8', SCREEN_CX - 30 + Math.random() * 60, SCREEN_H / 2 - 20 + Math.random() * 40, 2, 2)
      ctx.fillStyle = `rgba(255,140,60,${heat * 0.35})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
    this.drawShip(ctx, SCREEN_CX + (t > 7 ? (Math.random() - 0.5) * 3 : 0), SCREEN_H / 2, text)
    if (t > 1 && t < 6) text.text('EARTH.', SCREEN_CX, 30, '#d9dcef', { size: 9, align: 'center' })
    if (t > 3 && t < 6.5) text.text('MOONLINK: SIGNAL CLEAR. FIRST TIME IN TEN YEARS. WELCOME HOME.', SCREEN_CX, 44, '#5dcaa5', { size: 5.5, align: 'center' })
    if (t > 9.5) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 9.5) / 2, 0, 1)})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
  }

  private drawBrawl(ctx: Ctx, text: TextLayer): void {
    const leaping = this.phase === 'leap'
    if (!leaping) {
      rect(ctx, '#1d2238', 0, 0, SCREEN_W, SCREEN_H)
      for (let y = 20; y < 140; y += 16) rect(ctx, '#2a2f4c', 0, y, SCREEN_W, 2)
      rect(ctx, '#3a4062', 0, 140, SCREEN_W, 40)
      const alarm = Math.floor(this.t * 3) % 2 === 0
      rect(ctx, alarm ? '#e24b4a' : '#4a1f2a', SCREEN_CX - 4, 10, 8, 4)
      const push = this.pushes * 4
      for (let i = 0; i < 3; i++) {
        const x = 230 - push + i * 22
        rect(ctx, ['#e0884a', '#5dcaa5', '#7fb2ff'][i], x - 4, 115, 8, 12)
        rect(ctx, '#c98a5a', x - 3, 106, 6, 6)
        rect(ctx, ['#d9a066', '#2a1f1a', '#e2e5f2'][i], x - 3, 104, 6, 2)
      }
      rect(ctx, '#e6e6ee', 120, 115, 8, 12)
      rect(ctx, '#3d2a1f', 121, 104, 6, 7)
      text.text("MAYA: 'YOU PROMISED. YOU PROMISED ALL OF US.'", SCREEN_CX, 40, '#fac775', { size: 6, align: 'center' })
      text.text(`MASH E TO PUSH THEM BACK  ${this.pushes}/6`, SCREEN_CX, 150, '#ff8a7a', { size: 7, align: 'center' })
      return
    }
    this.starfield(ctx, 80)
    const gap = this.phaseT
    rect(ctx, '#e6e6ee', 40, 90, 70, 16)
    rect(ctx, '#2a2f4c', 190 - this.leaps * 20, 84 + Math.sin(this.t * 3) * 4, 80, 18)
    rect(ctx, '#ff5a5a', 190 - this.leaps * 20, 92 + Math.sin(this.t * 3) * 4, 3, 3)
    const px = this.leaps === 0 ? 100 : 200
    const jump = gap < 0.6 && this.leaps > 0 ? Math.sin((gap / 0.6) * Math.PI) * 30 : 0
    rect(ctx, '#e6e6ee', px, 74 - jump, 6, 14)
    rect(ctx, '#3d2a1f', px, 68 - jump, 6, 6)
    text.text(this.leaps === 0 ? 'THE HATCH IS OPEN. PRESS SPACE TO JUMP TO THEIR SHIP.' : 'THEY ARE CLOSING IN. PRESS SPACE TO JUMP AGAIN.', SCREEN_CX, 30, '#ff8a7a', { size: 6, align: 'center' })
  }

  private drawCaptured(ctx: Ctx, text: TextLayer): void {
    const t = this.phaseT
    if (t < 2.5) {
      this.starfield(ctx, 20)
      for (let i = 0; i < 4; i++) {
        const x = SCREEN_CX - 40 + i * 26
        rect(ctx, '#e6e6ee', x - 4, 100, 8, 14)
        rect(ctx, '#16182c', x - 3, 92, 6, 6)
        rect(ctx, '#fac775', x - 2, 93, 2, 1)
      }
      text.text("'RETRIEVAL COMPLETE. HELMETS ON. DO NOT LOOK IT IN THE EYE.'", SCREEN_CX, 40, '#ff8a7a', { size: 6, align: 'center' })
      return
    }
    text.alpha = clamp((t - 3) / 1, 0, 1)
    text.text('CAPTURED.', SCREEN_CX, 70, '#ff8a7a', { size: 14, align: 'center' })
    if (t > 5) text.text('...THIS IS NOT HOW IT ENDS.', SCREEN_CX, 96, '#9aa2cf', { size: 6, align: 'center' })
    if (t > 6.5) text.text('RETURNING TO BEFORE THE CHOICE', SCREEN_CX, 108, '#5dcaa5', { size: 6, align: 'center' })
    text.alpha = 1
  }

  private drawEnd(text: TextLayer): void {
    const t = this.phaseT
    text.alpha = clamp(t / 1.5, 0, 1)
    text.text('TO BE CONTINUED', SCREEN_CX, 76, '#fac775', { size: 12, align: 'center' })
    if (t > 2.5) text.text('COSMOS REBORN', SCREEN_CX, 98, '#9aa2cf', { size: 6, align: 'center' })
    if (t > 6) text.text('PRESS E TO RETURN TO THE MOON', SCREEN_CX, 150, '#3f4878', { size: 5, align: 'center' })
    text.alpha = 1
  }
}
