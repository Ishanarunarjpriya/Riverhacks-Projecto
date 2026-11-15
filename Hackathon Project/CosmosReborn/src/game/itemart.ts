import type { ItemId } from './items'
import { ellipse, rect, type Ctx } from './pixel'

type Draw = (g: Ctx) => void

const px = (g: Ctx, c: string, pts: [number, number][]) => {
  for (const [x, y] of pts) rect(g, c, x, y, 1, 1)
}

const line = (g: Ctx, c: string, x0: number, y0: number, x1: number, y1: number, w = 1) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  for (let i = 0; i <= n; i++) rect(g, c, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w)
}

export const ITEM_ART: Partial<Record<ItemId, Draw>> = {
  'rocket-part': (g) => {
    rect(g, '#2a2f4c', 5, 9, 22, 16)
    rect(g, '#d4a43c', 6, 10, 20, 14)
    rect(g, '#f2c85e', 6, 10, 20, 3)
    rect(g, '#a8742a', 6, 21, 20, 3)
    for (const x of [9, 15, 21]) rect(g, '#7a5420', x, 14, 2, 6)
    rect(g, '#2a2f4c', 24, 5, 5, 22)
    rect(g, '#c9cbe0', 25, 6, 3, 20)
    rect(g, '#ffffff', 25, 6, 1, 20)
    rect(g, '#9aa0b8', 3, 25, 8, 3)
    px(g, '#e24b4a', [[9, 11], [10, 11]])
  },
  'metal-rod': (g) => {
    for (const [o, c] of [[0, '#3f4878'], [1, '#c9cbe0'], [2, '#ffffff']] as const) line(g, c, 5 + o, 26 - o, 24 + o, 7 - o, 2)
    line(g, '#9aa0b8', 6, 27, 25, 8, 1)
    rect(g, '#7d8aa8', 4, 24, 5, 5)
    rect(g, '#7d8aa8', 23, 4, 5, 5)
    px(g, '#ffffff', [[24, 5], [5, 25]])
  },
  'moonrock-slab': (g) => {
    rect(g, '#2a2f4c', 3, 9, 26, 15)
    rect(g, '#5b6496', 4, 15, 24, 8)
    rect(g, '#9aa2c8', 4, 10, 24, 6)
    rect(g, '#c9cbe0', 5, 10, 22, 2)
    for (const [x, y] of [[9, 12], [18, 13], [23, 11], [12, 18], [21, 19]]) rect(g, '#7f88b4', x, y, 2, 1)
    rect(g, '#3f4878', 4, 23, 24, 1)
  },
  'crescent-shard': (g) => {
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * 0.15 + (i / 17) * Math.PI * 0.95
      const x = 16 + Math.cos(a) * 10
      const y = 17 - Math.sin(a) * 11
      rect(g, '#1f6b62', Math.round(x) - 2, Math.round(y) - 2, 5, 5)
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * 0.15 + (i / 17) * Math.PI * 0.95
      rect(g, i % 5 === 0 ? '#9fe1cb' : '#5fe0c8', Math.round(16 + Math.cos(a) * 10) - 1, Math.round(17 - Math.sin(a) * 11) - 1, 3, 3)
    }
    px(g, '#ffffff', [[12, 7], [13, 7], [24, 11]])
    rect(g, '#2f8f86', 13, 24, 6, 3)
  },
  'ice-miner': (g) => {
    rect(g, '#2a2f4c', 4, 24, 24, 5)
    rect(g, '#3f4878', 5, 25, 22, 3)
    rect(g, '#1d5c4a', 6, 11, 20, 14)
    rect(g, '#5dcaa5', 7, 12, 18, 12)
    rect(g, '#9fe1cb', 7, 12, 18, 3)
    rect(g, '#16182c', 10, 17, 12, 4)
    rect(g, '#9fd4ff', 11, 18, 3, 2)
    rect(g, '#9aa0b8', 14, 3, 4, 9)
    rect(g, '#c9cbe0', 10, 3, 12, 2)
    px(g, '#ffffff', [[15, 4], [8, 13]])
    px(g, '#fac775', [[23, 14]])
  },
  anvil: (g) => {
    rect(g, '#16182c', 8, 24, 16, 5)
    rect(g, '#3f4878', 9, 25, 14, 3)
    rect(g, '#2a2f4c', 12, 16, 8, 9)
    rect(g, '#4b5488', 13, 17, 6, 7)
    rect(g, '#2a2f4c', 3, 9, 22, 8)
    rect(g, '#7c85b4', 4, 10, 20, 6)
    rect(g, '#c9cbe0', 4, 10, 20, 2)
    rect(g, '#2a2f4c', 24, 10, 6, 4)
    rect(g, '#9aa2cf', 24, 11, 5, 2)
    px(g, '#ffffff', [[6, 10], [7, 10]])
  },
  'home-kit': (g) => {
    rect(g, '#2a2f4c', 4, 13, 24, 15)
    rect(g, '#e6e6ee', 5, 14, 22, 13)
    rect(g, '#ffffff', 5, 14, 22, 2)
    for (let i = 0; i < 9; i++) rect(g, i < 2 ? '#7a3f1a' : '#e0884a', 3 + i, 13 - i, 26 - i * 2, 1)
    rect(g, '#3f4878', 13, 19, 6, 8)
    rect(g, '#fac775', 21, 17, 4, 4)
    rect(g, '#5b6496', 4, 27, 24, 2)
  },
  'farm-kit': (g) => {
    rect(g, '#3d2a1f', 3, 21, 26, 8)
    rect(g, '#5a3f2a', 4, 22, 24, 6)
    for (const x of [8, 16, 24]) {
      rect(g, '#2c6e58', x, 10, 2, 12)
      rect(g, '#3fae7c', x - 3, 14, 3, 2)
      rect(g, '#7fcf6a', x + 2, 11, 3, 2)
    }
    px(g, '#ff6b7a', [[8, 8], [9, 8], [16, 7], [17, 7]])
    px(g, '#ffb35a', [[24, 8], [25, 8]])
    rect(g, '#8a5a1e', 3, 26, 26, 1)
  },
  'alien-alloy': (g) => {
    rect(g, '#16304a', 4, 11, 24, 13)
    rect(g, '#5b8aa8', 5, 12, 22, 11)
    rect(g, '#b8f0ff', 5, 12, 22, 3)
    for (let i = 0; i < 4; i++) line(g, '#e8fbff', 8 + i * 5, 22, 12 + i * 5, 14)
    rect(g, '#2f5f7a', 5, 21, 22, 2)
    px(g, '#ffffff', [[7, 13], [8, 13], [20, 13]])
  },
  'titan-pickaxe': (g) => {
    line(g, '#3d2a1f', 7, 27, 20, 10, 3)
    line(g, '#b07f2c', 8, 27, 21, 10, 1)
    for (let i = 0; i < 14; i++) {
      const x = 8 + i
      const y = 7 + Math.round(Math.abs(i - 7) * 0.45)
      rect(g, '#16304a', x, y - 1, 2, 4)
      rect(g, i < 7 ? '#a9c3d6' : '#5b8aa8', x, y, 2, 2)
    }
    px(g, '#b8f0ff', [[9, 8], [10, 8], [20, 9]])
    rect(g, '#7c85b4', 18, 8, 4, 4)
  },
  'survivor-gear': (g) => {
    rect(g, '#2a2f4c', 7, 15, 18, 14)
    rect(g, '#9aa2cf', 8, 16, 16, 12)
    rect(g, '#e0884a', 8, 21, 16, 2)
    rect(g, '#5b6496', 5, 16, 3, 7)
    rect(g, '#5b6496', 24, 16, 3, 7)
    ellipse(g, '#2a2f4c', 16, 9, 7, 7)
    ellipse(g, '#e6e6ee', 16, 9, 6, 6)
    rect(g, '#3b7dd8', 12, 7, 8, 4)
    px(g, '#ffffff', [[13, 7], [14, 7]])
  },
  'launch-kit': (g) => {
    rect(g, '#2a2f4c', 2, 22, 28, 7)
    rect(g, '#5b6496', 3, 23, 26, 5)
    rect(g, '#fac775', 3, 25, 26, 1)
    rect(g, '#2a2f4c', 12, 3, 8, 20)
    rect(g, '#e6e6ee', 13, 5, 6, 17)
    rect(g, '#e24b4a', 13, 3, 6, 4)
    rect(g, '#9fe1ff', 15, 10, 2, 2)
    rect(g, '#5b6496', 10, 17, 3, 5)
    rect(g, '#5b6496', 19, 17, 3, 5)
    px(g, '#e24b4a', [[4, 23], [27, 23]])
  },
  'rocket-fuel': (g) => {
    rect(g, '#2a2f4c', 9, 4, 14, 25)
    rect(g, '#c9cbe0', 10, 6, 12, 22)
    rect(g, '#ff9f5a', 10, 12, 12, 12)
    rect(g, '#ffd28a', 11, 12, 2, 12)
    rect(g, '#3f4878', 12, 3, 8, 3)
    rect(g, '#e0884a', 10, 12, 12, 1)
    for (const [x, y] of [[15, 16], [17, 19], [14, 21]]) rect(g, '#fff6d8', x, y, 1, 1)
    px(g, '#ffffff', [[11, 7], [11, 8]])
  },
  'lunar-ice': (g) => {
    rect(g, '#2f5f7a', 5, 11, 22, 16)
    rect(g, '#7fb2ff', 6, 12, 20, 14)
    rect(g, '#9fd4ff', 7, 9, 14, 12)
    rect(g, '#bfe4ff', 8, 9, 10, 6)
    rect(g, '#e8f6ff', 9, 10, 4, 2)
    line(g, '#e8f6ff', 12, 22, 18, 15)
    rect(g, '#5b6496', 6, 24, 20, 3)
    px(g, '#ffffff', [[9, 10], [22, 13]])
  },
  'rig-kit': (g) => {
    rect(g, '#2a2f4c', 5, 25, 22, 4)
    rect(g, '#5b6496', 6, 26, 20, 2)
    rect(g, '#9aa0b8', 9, 5, 2, 21)
    rect(g, '#9aa0b8', 21, 5, 2, 21)
    rect(g, '#7c85b4', 9, 5, 14, 2)
    for (const y of [11, 17]) rect(g, '#7c85b4', 11, y, 10, 1)
    rect(g, '#c9cbe0', 15, 7, 2, 18)
    rect(g, '#9fd4ff', 13, 22, 6, 3)
    px(g, '#fac775', [[22, 4]])
  },
  'data-log': (g) => {
    rect(g, '#16182c', 6, 6, 20, 22)
    rect(g, '#2e3352', 7, 7, 18, 20)
    rect(g, '#5dcaa5', 9, 9, 14, 10)
    for (const y of [11, 13, 15]) rect(g, '#1d5c4a', 10, y, 9 + (y % 3), 1)
    rect(g, '#9fe1cb', 9, 9, 14, 1)
    rect(g, '#3f4878', 9, 21, 6, 4)
    px(g, '#e24b4a', [[21, 23]])
  },
}
