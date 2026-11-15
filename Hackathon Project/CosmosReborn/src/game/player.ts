import {
  CLIMB_SLOWDOWN,
  GRAVITY,
  JUMP_COOLDOWN,
  JUMP_VELOCITY,
  MAX_PIT_SLOPE,
  STEP_HEIGHT,
  TURN_SPEED,
  WALK_ACCEL,
  WALK_SPEED,
} from './constants'
import { rect, type Ctx } from './pixel'
import { boulderAt, craterAt, groundHeightAt, isSolidAt, type World } from './world'

export interface Controls {
  forward: number
  turn: number
  jump: boolean
  fire: boolean
}

export interface Gear {
  armor: boolean
  blaster: boolean
}

export const NO_CONTROLS: Controls = { forward: 0, turn: 0, jump: false, fire: false }

export type PlayerEvent = 'jump' | 'land' | 'step'

const SKIN = '#c98a5a'
const HAIR = '#3a2a22'
const HAIR_LIGHT = '#5a4334'
const SUIT = '#f2f2f8'
const SUIT_SHADE = '#d8d9e6'
const BOOT = '#5b6496'

export class Player {
  x = 0
  z = 0
  y = 0
  vy = 0
  heading = 0
  speed = 0
  grounded = true
  moving = false
  walkTime = 0
  turn = 0
  jumpCooldown = 0
  actionTime = 0
  speedMult = 1
  events: PlayerEvent[] = []

  private stepTimer = 0

  update(dt: number, controls: Controls, world: World): void {
    this.events = []
    this.turn = controls.turn
    this.heading += controls.turn * TURN_SPEED * dt
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt)
    this.actionTime = Math.max(0, this.actionTime - dt)

    const target = controls.forward * WALK_SPEED * this.speedMult
    const accel = WALK_ACCEL * this.speedMult * dt
    this.speed += Math.max(-accel, Math.min(accel, target - this.speed))
    if (controls.forward === 0 && Math.abs(this.speed) < 0.5) this.speed = 0

    this.moving = false
    const step = this.speed * dt
    if (step !== 0) {
      const dx = Math.sin(this.heading) * step
      const dz = Math.cos(this.heading) * step
      this.moving =
        this.tryMove(world, this.x + dx, this.z + dz) ||
        this.tryMove(world, this.x + dx, this.z) ||
        this.tryMove(world, this.x, this.z + dz)
      if (!this.moving && this.grounded) this.speed *= 0.5
    }

    if (this.moving && this.grounded) {
      this.walkTime += dt
      this.stepTimer -= dt
      if (this.stepTimer <= 0) {
        this.events.push('step')
        this.stepTimer = 0.34
      }
    }

    const ground = groundHeightAt(world, this.x, this.z)
    if (this.grounded) {
      if (controls.jump && this.jumpCooldown <= 0) {
        this.vy = JUMP_VELOCITY
        this.grounded = false
        this.events.push('jump')
      } else if (ground >= this.y - 0.6) {
        this.y = ground
      } else {
        this.grounded = false
        this.vy = 0
      }
    }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt
      this.y += this.vy * dt
      if (this.y <= ground) {
        this.y = ground
        this.vy = 0
        this.grounded = true
        this.jumpCooldown = JUMP_COOLDOWN
        this.events.push('land')
      }
    }
  }

  private tryMove(world: World, nx: number, nz: number): boolean {
    if (isSolidAt(world, nx, nz)) return false
    const next = groundHeightAt(world, nx, nz)
    const rise = next - this.y
    if (!this.grounded) {
      if (rise > 0.05) return false
      this.x = nx
      this.z = nz
      return true
    }
    if (rise <= 0) {
      this.x = nx
      this.z = nz
      return true
    }
    const run = Math.hypot(nx - this.x, nz - this.z) || 1e-6
    const slope = rise / run
    const boulder = boulderAt(world, nx, nz, 0.5)
    if (boulder && boulder.height > this.y + STEP_HEIGHT) return false
    const crater = craterAt(world, nx, nz)
    if (crater?.isPit && slope > MAX_PIT_SLOPE) return false
    const slow = 1 / (1 + slope * CLIMB_SLOWDOWN)
    const sx = this.x + (nx - this.x) * slow
    const sz = this.z + (nz - this.z) * slow
    this.x = sx
    this.z = sz
    this.y = Math.max(this.y, groundHeightAt(world, sx, sz))
    return true
  }

  draw(ctx: Ctx, sx: number, sy: number, scale: number, holdingTablet: boolean, gear: Gear = { armor: false, blaster: false }): void {
    const fy = Math.round(sy - this.y * scale)
    const air = !this.grounded
    const frame = this.moving && !air ? Math.floor(this.walkTime * 8) % 4 : -1
    const liftL = frame === 2 ? 1 : 0
    const liftR = frame === 0 ? 1 : 0
    const swing = frame === 0 ? 1 : frame === 2 ? -1 : 0

    if (air) {
      rect(ctx, SUIT_SHADE, sx - 3, fy - 5, 2, 3)
      rect(ctx, SUIT_SHADE, sx + 1, fy - 5, 2, 3)
      rect(ctx, BOOT, sx - 3, fy - 2, 2, 1)
      rect(ctx, BOOT, sx + 1, fy - 2, 2, 1)
    } else {
      rect(ctx, SUIT_SHADE, sx - 3, fy - 5 - liftL, 2, 4)
      rect(ctx, SUIT_SHADE, sx + 1, fy - 5 - liftR, 2, 4)
      rect(ctx, BOOT, sx - 3, fy - 1 - liftL, 2, 1)
      rect(ctx, BOOT, sx + 1, fy - 1 - liftR, 2, 1)
    }

    rect(ctx, SUIT, sx - 4, fy - 11, 8, 6)
    rect(ctx, '#c9cbe0', sx - 3, fy - 11, 6, 1)

    const mining = this.actionTime > 0
    if (air) {
      rect(ctx, SUIT_SHADE, sx - 5, fy - 14, 1, 4)
      rect(ctx, SUIT_SHADE, sx + 4, fy - 14, 1, 4)
    } else if (holdingTablet) {
      rect(ctx, SUIT_SHADE, sx - 5, fy - 11, 1, 3)
      rect(ctx, SUIT_SHADE, sx + 4, fy - 11, 1, 3)
      rect(ctx, '#5dcaa5', sx - 4, fy - 12, 8, 1)
    } else {
      rect(ctx, SUIT_SHADE, sx - 5, fy - 10 + swing, 1, 4)
      if (mining) {
        const up = this.actionTime > 0.15
        rect(ctx, SUIT_SHADE, sx + 4, fy - (up ? 14 : 11), 1, 4)
        rect(ctx, '#9aa0b8', sx + 4, fy - (up ? 16 : 9), 1, 3)
        rect(ctx, '#e6e6ee', sx + (up ? 3 : 5), fy - (up ? 17 : 8), 3, 1)
      } else {
        rect(ctx, SUIT_SHADE, sx + 4, fy - 10 - swing, 1, 4)
      }
    }

    rect(ctx, '#9aa0b8', sx - 3, fy - 10, 6, 4)
    rect(ctx, '#5dcaa5', sx - 1, fy - 9, 2, 1)
    if (gear.armor) {
      rect(ctx, '#9aa2cf', sx - 5, fy - 11, 2, 2)
      rect(ctx, '#9aa2cf', sx + 3, fy - 11, 2, 2)
      rect(ctx, '#e0884a', sx - 4, fy - 6, 8, 1)
    }
    if (gear.blaster && !holdingTablet && !mining && !air) {
      rect(ctx, '#3f4878', sx + 4, fy - 8, 3, 2)
      rect(ctx, '#ff8a7a', sx + 6, fy - 8, 1, 1)
    }

    rect(ctx, SKIN, sx - 1, fy - 12, 2, 1)
    rect(ctx, HAIR, sx - 3, fy - 17, 6, 5)
    rect(ctx, HAIR_LIGHT, sx - 2, fy - 17, 3, 1)
    rect(ctx, SKIN, sx - 4, fy - 15, 1, 2)
    rect(ctx, SKIN, sx + 3, fy - 15, 1, 2)
    if (this.turn > 0.2) rect(ctx, SKIN, sx + 2, fy - 15, 1, 3)
    if (this.turn < -0.2) rect(ctx, SKIN, sx - 3, fy - 15, 1, 3)
  }
}
