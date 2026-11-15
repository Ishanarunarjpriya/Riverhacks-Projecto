import type { GameAudio } from './audio'
import { SCREEN_CX, SCREEN_H, SCREEN_W } from './constants'
import { clamp, createRng } from './math'
import { ellipse, rect, type Ctx } from './pixel'
import type { TextLayer } from './text'

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
    const rng = createRng(77)
    for (let i = 0; i < 140; i++) this.stars.push({ x: rng() * SCREEN_W, y: rng() * SCREEN_H, s: 0.3 + rng() * 2 })
  }

  private go(phase: Phase): void {
    this.phase = phase
    this.phaseT = 0
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
      if (this.phaseT > 0.05 && this.phaseT - dt <= 0.05) audio.play('rumble')
      if (this.phaseT > 3 && this.phaseT - dt <= 3) audio.play('crash')
      if (this.phaseT > 6.5) this.go(this.ending === 'together' ? 'fight' : 'brawl')
      return
    }

    if (this.phase === 'fight') {
      if (input.up) this.shipY -= 70 * dt
      if (input.down) this.shipY += 70 * dt
      this.shipY = clamp(this.shipY, 20, SCREEN_H - 20)
      this.cooldown -= dt
      if (input.fire && this.cooldown <= 0) {
        this.cooldown = 0.22
        this.bolts.push({ x: 74, y: this.shipY, vx: 220, vy: 0, friendly: true })
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
        } else if (Math.abs(b.x - 60) < 9 && Math.abs(b.y - this.shipY) < 6) {
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
      if (this.phaseT > 3 && this.phaseT - dt <= 3) audio.play('rumble')
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
    for (const s of this.stars) rect(ctx, '#6b66a8', s.x, s.y * 0.6, 1, 1)
    rect(ctx, '#9aa2c8', 0, 140, SCREEN_W, 40)
    rect(ctx, '#5b6496', SCREEN_CX - 24, 136, 48, 4)
    const lift = t < 3 ? 0 : (t - 3) ** 2 * 14
    const shake = t < 3 ? (Math.random() - 0.5) * t : 0
    const rx = SCREEN_CX + shake
    const ry = 136 - lift
    rect(ctx, '#e6e6ee', rx - 6, ry - 50, 12, 46)
    rect(ctx, '#e0884a', rx - 6, ry - 30, 12, 3)
    rect(ctx, '#9fe1ff', rx - 2, ry - 42, 4, 3)
    rect(ctx, '#e24b4a', rx - 4, ry - 58, 8, 8)
    rect(ctx, '#5b6496', rx - 9, ry - 10, 4, 10)
    rect(ctx, '#5b6496', rx + 5, ry - 10, 4, 10)
    if (t > 1.5) {
      for (let i = 0; i < 26; i++) {
        const fy = ry + Math.random() * (10 + lift * 0.3)
        rect(ctx, i < 8 ? '#fff6d8' : i < 18 ? '#fac775' : '#e0884a', rx - 5 + Math.random() * 10, fy, 2, 2)
      }
    }
    const count = Math.max(0, 10 - Math.floor(t * 3.4))
    if (t < 3) text.text(count > 0 ? String(count) : 'LIFTOFF', SCREEN_CX, 40, '#fac775', { size: 14, align: 'center' })
    if (t > 4.5) {
      ctx.fillStyle = `rgba(5,4,15,${clamp((t - 4.5) / 2, 0, 1)})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
  }

  private drawShip(ctx: Ctx, x: number, y: number): void {
    rect(ctx, '#e6e6ee', x - 10, y - 3, 18, 6)
    rect(ctx, '#e24b4a', x + 8, y - 2, 4, 4)
    rect(ctx, '#9fe1ff', x + 2, y - 2, 3, 2)
    rect(ctx, '#e0884a', x - 10, y - 1, 18, 1)
    for (let i = 0; i < 5; i++) rect(ctx, i < 2 ? '#fff6d8' : '#fac775', x - 12 - i * 2 - Math.random() * 2, y - 1 + (Math.random() - 0.5) * 2, 2, 2)
  }

  private drawFight(ctx: Ctx, text: TextLayer): void {
    this.starfield(ctx, 120)
    ellipse(ctx, '#9aa2c8', -30, SCREEN_H + 60, 110, 110)
    this.drawShip(ctx, 60, this.shipY)
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
    this.drawShip(ctx, SCREEN_CX + (t > 7 ? (Math.random() - 0.5) * 3 : 0), SCREEN_H / 2)
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
