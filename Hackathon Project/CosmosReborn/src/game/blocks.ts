import type { ItemId } from './items'
import { box, glowBox, type Part } from './model3d'

export type BlockType = 'moonstone' | 'crescent'

export const BLOCK = 2
export const MAX_STACK = 4
export const BLOCK_REACH = 3

export const BLOCK_INFO: Record<BlockType, { name: string; item: ItemId; side: string; top: string }> = {
  moonstone: { name: 'MOONSTONE BLOCK', item: 'moon-rock', side: '#8a8fae', top: '#c9cbe0' },
  crescent: { name: 'CRESCENT BLOCK', item: 'crescent-shard', side: '#2f8f86', top: '#9fe1cb' },
}

export const BLOCK_FOR_ITEM: Partial<Record<ItemId, BlockType>> = {
  'moon-rock': 'moonstone',
  'crescent-shard': 'crescent',
}

export interface BlockColumn {
  gx: number
  gz: number
  stack: BlockType[]
}

export function cellOf(x: number, z: number): [number, number] {
  return [Math.floor(x / BLOCK), Math.floor(z / BLOCK)]
}

export function cellCenter(gx: number, gz: number): [number, number] {
  return [(gx + 0.5) * BLOCK, (gz + 0.5) * BLOCK]
}

export class BlockGrid {
  private cols = new Map<string, BlockColumn>()

  get size(): number {
    return this.cols.size
  }

  columns(): IterableIterator<BlockColumn> {
    return this.cols.values()
  }

  column(gx: number, gz: number): BlockColumn | undefined {
    return this.cols.get(`${gx},${gz}`)
  }

  height(gx: number, gz: number): number {
    return (this.column(gx, gz)?.stack.length ?? 0) * BLOCK
  }

  heightAt(x: number, z: number, pad = 0): number {
    if (this.cols.size === 0) return 0
    let top = 0
    const [x0, z0] = cellOf(x - pad, z - pad)
    const [x1, z1] = cellOf(x + pad, z + pad)
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) top = Math.max(top, this.height(gx, gz))
    return top
  }

  place(gx: number, gz: number, type: BlockType): boolean {
    const key = `${gx},${gz}`
    const col = this.cols.get(key) ?? { gx, gz, stack: [] }
    if (col.stack.length >= MAX_STACK) return false
    col.stack.push(type)
    this.cols.set(key, col)
    return true
  }

  remove(gx: number, gz: number): BlockType | null {
    const key = `${gx},${gz}`
    const col = this.cols.get(key)
    if (!col) return null
    const type = col.stack.pop() ?? null
    if (col.stack.length === 0) this.cols.delete(key)
    return type
  }
}

export function columnModel(col: BlockColumn): Part[] {
  const h = BLOCK / 2
  return col.stack.map((type, i) => {
    const info = BLOCK_INFO[type]
    return box(-h, h, i * BLOCK, (i + 1) * BLOCK, -h, h, info.side, info.top)
  })
}

export function ghostModel(level: number, ok: boolean): Part[] {
  const h = BLOCK / 2
  return [glowBox(-h, h, level * BLOCK, (level + 1) * BLOCK, -h, h, ok ? '#fac775' : '#ff8a7a')]
}
