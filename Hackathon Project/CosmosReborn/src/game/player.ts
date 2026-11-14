import { GRAVITY, JUMP_VELOCITY, STEP_HEIGHT, TURN_SPEED, WALK_SPEED } from './constants'
import { rect, type Ctx } from './pixel'
import { groundHeightAt, isSolidAt, type World } from './world'

export interface Controls {
  forward: number
  turn: number
  jump: boolean
}

export const NO_CONTROLS: Controls = { forward: 0, turn: 0, jump: false }

export class Player {
  x = 0
  z = 0
  y = 0
  vy = 0
  heading = 0
  grounded = true
  moving = false
  walkTime = 0
  turn = 0

  update(dt: number, controls: Controls, world: World): void {
    this.turn = controls.turn
    this.heading += controls.turn * TURN_SPEED * dt

    const canMoveTo = (x: number, z: number) =>
      !isSolidAt(world, x, z) && groundHeightAt(world, x, z) <= this.y + STEP_HEIGHT
    const step = controls.forward * WALK_SPEED * dt
    const nx = this.x + Math.sin(this.heading) * step
    const nz = this.z + Math.cos(this.heading) * step
    this.moving = false
    if (controls.forward !== 0) {
      if (canMoveTo(nx, nz)) {
        this.x = nx
        this.z = nz
        this.moving = true
      } else if (canMoveTo(nx, this.z)) {
        this.x = nx
        this.moving = true
      } else if (canMoveTo(this.x, nz)) {
        this.z = nz
        this.moving = true
      }
    }
    if (this.moving) this.walkTime += dt

    const ground = groundHeightAt(world, this.x, this.z)
    if (controls.jump && this.grounded) {
      this.vy = JUMP_VELOCITY
      this.grounded = false
    }
    if (!this.grounded || this.y > ground + 0.01) {
      this.vy -= GRAVITY * dt
      this.y += this.vy * dt
      this.grounded = false
      if (this.y <= ground) {
        this.y = ground
        this.vy = 0
        this.grounded = true
      }
    } else {
      this.y = ground
      this.grounded = true
    }
  }

  draw(ctx: Ctx, sx: number, sy: number, scale: number, holdingTablet: boolean): void {
    const fy = sy - this.y * scale
    const step = this.moving && this.grounded ? Math.floor(this.walkTime * 7) % 2 : 0
    const air = this.grounded ? 0 : 1
    const armY = air ? 13 : holdingTablet ? 12 : 10

    rect(ctx, '#d8d9e6', sx - 3, fy - 5 + step, 2, 5 - step - air)
    rect(ctx, '#d8d9e6', sx + 1, fy - 5 + (1 - step), 2, 5 - (1 - step) - air)
    rect(ctx, '#f2f2f8', sx - 4, fy - 11, 8, 6)
    rect(ctx, '#e0e0ea', sx - 5, fy - armY, 1, 4)
    rect(ctx, '#e0e0ea', sx + 4, fy - armY, 1, 4)
    rect(ctx, '#9aa0b8', sx - 3, fy - 10, 6, 4)
    rect(ctx, '#5dcaa5', sx - 1, fy - 9, 2, 1)
    rect(ctx, '#f2f2f8', sx - 3, fy - 16, 6, 5)
    rect(ctx, '#c9cbe0', sx - 3, fy - 12, 6, 1)
    if (holdingTablet) rect(ctx, '#5dcaa5', sx - 4, fy - 13, 8, 1)
    if (this.turn > 0.2) rect(ctx, '#3b7dd8', sx + 2, fy - 15, 1, 3)
    if (this.turn < -0.2) rect(ctx, '#3b7dd8', sx - 3, fy - 15, 1, 3)
  }
}
