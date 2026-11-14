import { WORLD_SIZE } from './constants'

export type Pt = [number, number]
export type CamPt = [number, number, number]

export function wrap(v: number): number {
  const half = WORLD_SIZE / 2
  return (((v + half) % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE - half
}

export function wrapPositive(v: number): number {
  return ((v % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE
}

export function createRng(seed: number): () => number {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function easeOutBack(t: number): number {
  const c1 = 1.6
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
