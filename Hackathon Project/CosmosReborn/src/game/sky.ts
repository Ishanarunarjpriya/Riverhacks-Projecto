import type { Camera } from './camera'
import { EYE_Y, FOCAL, SCREEN_CX, SCREEN_H, SCREEN_W, SKY_SPIN, WORLD_SIZE } from './constants'
import { createRng } from './math'
import { ellipse, makeSprite, rect, type Ctx } from './pixel'

type Vec3 = [number, number, number]

interface SkyObject {
  frames: HTMLCanvasElement[]
  fps: number
  phase: number
  dir: Vec3
}

interface Star {
  dir: Vec3
  color: string
  twinkleSpeed: number
  phase: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
}

const SKY_COLOR = '#0d0b2a'
const TRAIL = ['#ffffff', '#d9d6ff', '#a9a4e0', '#7b76b8', '#57528f', '#3d3a6e']

function directionOf(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]
}

function flipbook(count: number, w: number, h: number, draw: (g: Ctx, frame: number) => void): HTMLCanvasElement[] {
  return Array.from({ length: count }, (_, i) => makeSprite(w, h, (g) => draw(g, i)))
}

function circleCut(size: number, r: number, draw: (g: Ctx) => void): HTMLCanvasElement {
  return makeSprite(size, size, (g) => {
    draw(g)
    g.beginPath()
    const c = size / 2
    for (let dy = -r; dy <= r; dy++) {
      const halfW = r * Math.sqrt(Math.max(0, 1 - (dy / r) ** 2))
      g.rect(Math.round(c - halfW), Math.round(c + dy), Math.max(1, Math.round(halfW * 2)), 1)
    }
    g.globalCompositeOperation = 'destination-in'
    g.fill()
    g.globalCompositeOperation = 'source-over'
  })
}

function sparkle(core: string, arm: string, n: number): HTMLCanvasElement[] {
  const size = 2 * (n + 1) + 3
  const c = n + 2
  return [n - 1, n, n + 1, n].map((len) =>
    makeSprite(size, size, (g) => {
      for (let k = 1; k <= Math.max(1, len); k++) {
        rect(g, arm, c + k, c, 1, 1)
        rect(g, arm, c - k, c, 1, 1)
        rect(g, arm, c, c + k, 1, 1)
        rect(g, arm, c, c - k, 1, 1)
      }
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) rect(g, core, c + dx, c + dy, 1, 1)
      if (len > n) rect(g, '#ffffff', c, c, 1, 1)
    }),
  )
}

function orb(r: number, color: string, highlight: string): HTMLCanvasElement[] {
  const size = 2 * r + 4
  return [0, 1, 2, 1].map((f) =>
    makeSprite(size, size, (g) => {
      ellipse(g, color, r + 2, r + 2, r, r)
      ellipse(g, highlight, r + 2 - r * 0.35, r + 2 - r * 0.35, r * 0.35, r * 0.35)
      if (f === 2) rect(g, '#ffffff', r + 2 - r * 0.45, r + 2 - r * 0.45, 1, 1)
    }),
  )
}

function galaxy(): HTMLCanvasElement[] {
  const FRAMES = 24
  return flipbook(FRAMES, 64, 36, (g, f) => {
    const spin = (f / FRAMES) * Math.PI * 2
    for (let arm = 0; arm < 2; arm++) {
      for (let t = 0; t < 11; t += 0.05) {
        const r = 2 + t * 2.6
        const a = t + arm * Math.PI + spin
        rect(g, t < 3 ? '#c9c3ff' : '#7b6fe0', 32 + Math.cos(a) * r * 1.1, 18 + Math.sin(a) * r * 0.6, t < 6 ? 2 : 1, 1)
      }
    }
    ellipse(g, f % 6 < 3 ? '#e6e0ff' : '#f4f1ff', 32, 18, 3, 2)
  })
}

function ringedPlanet(rng: () => number): HTMLCanvasElement[] {
  const FRAMES = 24
  const dust = Array.from({ length: 70 }, () => ({ a: rng() * Math.PI * 2, r: 19 + rng() * 5 }))
  return flipbook(FRAMES, 56, 52, (g, f) => {
    dust.forEach((d, i) => {
      const bright = (i + f) % 4 === 0
      rect(g, bright ? '#f2b27a' : '#e0884a', 28 + Math.cos(d.a) * d.r, 26 + Math.sin(d.a) * d.r * 0.9, 1, 1)
    })
    ellipse(g, '#a64f22', 28, 26, 15, 15)
    const body = circleCut(30, 14, (b) => {
      rect(b, '#c8692f', 0, 0, 30, 30)
      for (let y = 1; y < 30; y += 3) rect(b, y % 2 ? '#e08a45' : '#b85a28', 0, y, 30, 1)
      const stormX = -6 + (f / FRAMES) * 42
      ellipse(b, '#8f3f18', stormX, 18, 3, 1.5)
      ellipse(b, '#f2b27a', stormX - 1, 17, 1, 1)
    })
    g.drawImage(body, 13, 11)
  })
}

function gasGiant(): HTMLCanvasElement[] {
  const FRAMES = 18
  const bands = ['#1f5d95', '#2a74b0', '#1a4f80']
  return flipbook(FRAMES, 90, 90, (g, f) => {
    for (let yy = -42; yy <= 42; yy++) {
      for (let xx = -42; xx <= 42; xx++) {
        if (xx * xx + yy * yy > 42 * 42) continue
        rect(g, bands[Math.floor((yy + xx * 0.45 + 60 + f) / 6) % 3], 45 + xx, 45 + yy, 1, 1)
      }
    }
  })
}

function earth(): HTMLCanvasElement[] {
  const FRAMES = 24
  const W = 40
  const land: [number, number, number, number][] = [[2, 6, 6, 4], [5, 10, 5, 6], [8, 15, 3, 2], [18, 5, 7, 5], [20, 10, 4, 4], [30, 8, 6, 7], [33, 15, 4, 2]]
  return flipbook(FRAMES, 22, 22, (g, f) => {
    const spun = circleCut(22, 9, (b) => {
      rect(b, '#2f6fc4', 0, 0, 22, 22)
      const shift = (f / FRAMES) * W
      for (const [x, y, w, h] of land) {
        for (const o of [0, W]) rect(b, '#4f9a3a', x - shift + o, y, w, h)
      }
      rect(b, '#ffffff', 8, 2, 6, 2)
      rect(b, '#ffffff', 9, 19, 4, 1)
      b.fillStyle = 'rgba(5,8,30,.45)'
      b.fillRect(15, 0, 7, 22)
    })
    g.drawImage(spun, 0, 0)
  })
}

function sun(): HTMLCanvasElement[] {
  return [0, 1, 2, 1].map((f) =>
    makeSprite(32, 32, (g) => {
      ellipse(g, '#fac775', 16, 16, 9, 9)
      ellipse(g, f === 2 ? '#ffffff' : '#fff6d8', 16, 16, 6, 6)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        const len = 12 + (i % 2 === f % 2 ? 1 : 0) + (f === 2 ? 1 : 0)
        rect(g, '#fac775', 16 + Math.cos(a) * len, 16 + Math.sin(a) * len, 2, 2)
      }
    }),
  )
}

export class Sky {
  private objects: SkyObject[]
  private stars: Star[] = []
  private shooting: ShootingStar[] = []
  private nextShootingStar = 3
  private rng: () => number

  constructor(seed = 7) {
    this.rng = createRng(seed)
    const rng = this.rng
    const galaxyFrames = galaxy()
    const placed: [HTMLCanvasElement[], number, number, number][] = [
      [galaxyFrames, 3, -50, 16],
      [ringedPlanet(rng), 4, 10, 26],
      [gasGiant(), 3, 55, 7],
      [orb(7, '#2f6fd8', '#7fb2ff'), 1.5, 35, 32],
      [orb(5, '#2f6fd8', '#7fb2ff'), 1.2, -20, 9],
      [orb(5, '#8a4fd8', '#c9a6ff'), 1.4, 47, 20],
      [orb(6, '#d23a2c', '#ff8a7a'), 1.1, 78, 3],
      [earth(), 4, 140, 24],
      [sun(), 3, 215, 30],
      [orb(4, '#8a4fd8', '#c9a6ff'), 1.3, 260, 14],
      [galaxyFrames, 2, 300, 40],
      [sparkle('#fac775', '#e24b4a', 4), 3, -75, 22],
      [sparkle('#ffffff', '#d9d6ff', 2), 4, -35, 40],
      [sparkle('#9fd8ff', '#378add', 3), 3.5, -5, 12],
      [sparkle('#fac775', '#e24b4a', 3), 2.5, 25, 40],
      [sparkle('#e6dcff', '#7f77dd', 2), 4, 42, 48],
      [sparkle('#ffffff', '#ffffff', 3), 3, 68, 30],
      [sparkle('#9fd8ff', '#378add', 4), 2.5, 95, 18],
      [sparkle('#fac775', '#e24b4a', 3), 3.5, 120, 45],
      [sparkle('#e6dcff', '#7f77dd', 2), 3, 170, 12],
      [sparkle('#9fd8ff', '#378add', 3), 4, 240, 50],
      [sparkle('#ffffff', '#d9d6ff', 2), 3, 330, 25],
      [sparkle('#fac775', '#e24b4a', 4), 2.5, 190, 60],
    ]
    this.objects = placed.map(([frames, fps, az, el]) => ({ frames, fps, phase: rng() * frames.length, dir: directionOf(az, el) }))

    for (let i = 0; i < 550; i++) {
      const y = rng() * 2 - 1
      const t = rng() * Math.PI * 2
      const r = Math.sqrt(1 - y * y)
      this.stars.push({
        dir: [Math.cos(t) * r, y, Math.sin(t) * r],
        color: rng() < 0.7 ? '#6b66a8' : '#d9d6ff',
        twinkleSpeed: 1 + rng() * 3,
        phase: rng() * Math.PI * 2,
      })
    }
  }

  update(dt: number): void {
    this.nextShootingStar -= dt
    if (this.nextShootingStar <= 0) {
      const rng = this.rng
      const dir = rng() < 0.5 ? -1 : 1
      const speed = 170 + rng() * 80
      this.shooting.push({
        x: 40 + rng() * (SCREEN_W - 80),
        y: 4 + rng() * 34,
        vx: dir * speed * 0.85,
        vy: speed * 0.5,
        age: 0,
        life: 0.45 + rng() * 0.3,
      })
      this.nextShootingStar = 3 + rng() * 6
    }
    for (const s of this.shooting) {
      s.age += dt
      s.x += s.vx * dt
      s.y += s.vy * dt
    }
    this.shooting = this.shooting.filter((s) => s.age < s.life)
  }

  draw(ctx: Ctx, cam: Camera, playerX: number, playerZ: number, time: number): void {
    const pitch = (playerZ / WORLD_SIZE) * Math.PI * 2 * SKY_SPIN
    const roll = (playerX / WORLD_SIZE) * Math.PI * 2 * SKY_SPIN
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    const cr = Math.cos(roll)
    const sr = Math.sin(roll)

    const toScreen = ([x0, y0, z0]: Vec3): [number, number] | null => {
      const y1 = y0 * cp + z0 * sp
      const z1 = z0 * cp - y0 * sp
      const x2 = x0 * cr - y1 * sr
      const y2 = y1 * cr + x0 * sr
      const camX = x2 * cam.cos - z1 * cam.sin
      const camZ = x2 * cam.sin + z1 * cam.cos
      if (camZ < 0.08) return null
      return [SCREEN_CX + (FOCAL * camX) / camZ, EYE_Y - (FOCAL * y2) / camZ]
    }

    rect(ctx, SKY_COLOR, 0, 0, SCREEN_W, SCREEN_H)

    for (const star of this.stars) {
      const p = toScreen(star.dir)
      if (!p || p[0] < 0 || p[0] >= SCREEN_W || p[1] < 0 || p[1] >= SCREEN_H) continue
      const tw = Math.sin(time * star.twinkleSpeed + star.phase)
      const color = tw > 0.9 ? '#ffffff' : tw < -0.85 ? '#2f2b5c' : star.color
      rect(ctx, color, p[0], p[1], 1, 1)
    }

    for (const o of this.objects) {
      const p = toScreen(o.dir)
      if (!p || p[0] < -60 || p[0] > SCREEN_W + 60 || p[1] < -60 || p[1] > SCREEN_H + 60) continue
      const frame = o.frames[Math.floor(time * o.fps + o.phase) % o.frames.length]
      ctx.drawImage(frame, Math.round(p[0] - frame.width / 2), Math.round(p[1] - frame.height / 2))
    }

    for (const s of this.shooting) {
      const fade = 1 - s.age / s.life
      const len = Math.round(TRAIL.length * Math.min(1, fade * 2))
      const step = 1 / Math.hypot(s.vx, s.vy)
      for (let i = 0; i < len; i++) {
        rect(ctx, TRAIL[i], s.x - s.vx * step * i * 1.5, s.y - s.vy * step * i * 1.5, 1, 1)
      }
    }
  }
}
