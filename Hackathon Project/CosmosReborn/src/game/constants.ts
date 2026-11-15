export const SCREEN_W = 320
export const SCREEN_H = 180
export const SCREEN_CX = SCREEN_W / 2

export const FOCAL = 160
export const EYE_Y = 46
export const CAM_HEIGHT = 12
export const CAM_BACK = 22
export const CAM_LAG = 3

export const WORLD_SIZE = 900
export const PLANET_RADIUS = 600
export const HORIZON_D2 = 2 * CAM_HEIGHT * PLANET_RADIUS
export const HORIZON_D = Math.sqrt(HORIZON_D2)
export const SKY_SPIN = 2
export const SUN_DIR: readonly [number, number] = [Math.SQRT1_2, Math.SQRT1_2]

export const WALK_SPEED = 15
export const WALK_ACCEL = 45
export const TURN_SPEED = 1.8
export const JUMP_VELOCITY = 10
export const GRAVITY = 12
export const JUMP_COOLDOWN = 0.45
export const STEP_HEIGHT = 0.35
export const MAX_PIT_SLOPE = 1.6
export const CLIMB_SLOWDOWN = 0.9

export const SHOW_MINIMAP = false
