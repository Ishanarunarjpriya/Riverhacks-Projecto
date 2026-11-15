import { SCREEN_CX, SCREEN_H } from './constants'
import { ITEMS, type ItemId } from './items'
import { ellipse, makeSprite, rect, type Ctx } from './pixel'
import type { TextLayer } from './text'

export const HOTBAR_SLOTS = 5

const IMG_W = 192
const IMG_H = 48
const SLOT_PITCH = 36
const TILE_X = 42
const TILE_Y = 5
const TILE_W = 36
const TILE_H = 37
const DRAW_SCALE = 0.5

export const HOTBAR_W = IMG_W * DRAW_SCALE
export const HOTBAR_H = IMG_H * DRAW_SCALE
export const HOTBAR_X = SCREEN_CX - HOTBAR_W / 2
export const HOTBAR_Y = SCREEN_H - HOTBAR_H - 3

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Shared pickaxe silhouette: curved steel head over a striped shaft.
// o = outline, S/s/d = head body, h/H = shaft, y = shaft binding
const PICKAXE_ART = [
  '....oooo....',
  '..ooSSSSoo..',
  '.oSSSSSSSSo.',
  'oSSSSooSSSSo',
  'oSSo..oSSSSo',
  '.oo....oSooo',
  '......oyho..',
  '.....oyh....',
  '....oyh.....',
  '...oHh......',
  '..oHh.......',
  '..oo........',
]

const SHAFT_PALETTE: Record<string, string> = {
  h: '#b07f2c',
  H: '#8a5a1e',
  y: '#fac775',
}

const PICKAXE_PALETTE: Record<string, string> = {
  ...SHAFT_PALETTE,
  o: '#2e3352',
  S: '#e6e6ee',
  s: '#e6e6ee',
  d: '#9aa0b8',
}

const MOON_PICKAXE_PALETTE: Record<string, string> = {
  ...SHAFT_PALETTE,
  o: '#141428',
  S: '#232447',
  s: '#2e3352',
  d: '#3f4878',
}

function paint(g: Ctx, rows: readonly string[], palette: Record<string, string>): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]]
      if (color) rect(g, color, x, y, 1, 1)
    }
  })
}

const ICON_DRAWERS: Partial<Record<ItemId, (g: Ctx) => void>> = {
  'moon-rock': (g) => {
    ellipse(g, '#6c719a', 6, 7, 5, 4)
    ellipse(g, '#9aa0c0', 5, 6, 4, 3)
    rect(g, '#d9dcef', 3, 4, 3, 1)
    rect(g, '#4b5488', 7, 8, 2, 1)
  },
  'metal-scrap': (g) => {
    rect(g, '#7d8aa8', 1, 6, 9, 3)
    rect(g, '#b9c3dc', 3, 3, 7, 3)
    rect(g, '#e2e5f2', 3, 3, 7, 1)
    rect(g, '#c8692f', 7, 7, 2, 1)
  },
  'power-cell': (g) => {
    rect(g, '#d8d9e6', 3, 2, 6, 9)
    rect(g, '#9aa0b8', 5, 1, 2, 1)
    rect(g, '#2e3352', 4, 3, 4, 7)
    rect(g, '#5dcaa5', 4, 6, 4, 4)
    rect(g, '#9fe1cb', 4, 6, 4, 1)
  },
  'ration-pack': (g) => {
    rect(g, '#e0884a', 2, 3, 8, 7)
    rect(g, '#fac775', 2, 3, 8, 2)
    rect(g, '#ffffff', 4, 6, 4, 2)
  },
  'repair-kit': (g) => {
    rect(g, '#eef0f8', 1, 3, 10, 7)
    rect(g, '#9aa0b8', 4, 2, 4, 1)
    rect(g, '#e24b4a', 5, 4, 2, 5)
    rect(g, '#e24b4a', 3, 5, 6, 2)
  },
  'pickaxe': (g) => paint(g, PICKAXE_ART, PICKAXE_PALETTE),
  'moon-pickaxe': (g) => {
    paint(g, PICKAXE_ART, MOON_PICKAXE_PALETTE)
    // stars caught in the forged head
    rect(g, '#ffffff', 6, 2, 1, 1)
    rect(g, '#ffffff', 10, 3, 1, 1)
    rect(g, '#c9a6ff', 3, 3, 1, 1)
    rect(g, '#fac775', 8, 4, 1, 1)
  },
  'data-log': (g) => {
    rect(g, '#2e3352', 2, 2, 8, 9)
    rect(g, '#5dcaa5', 3, 3, 6, 5)
    rect(g, '#9fe1cb', 4, 4, 3, 1)
    rect(g, '#9fe1cb', 4, 6, 4, 1)
  },
  'anomaly-shard': (g) => {
    rect(g, '#5b4a8a', 5, 1, 2, 10)
    rect(g, '#c9a6ff', 4, 3, 4, 6)
    rect(g, '#efe3ff', 5, 3, 1, 3)
    rect(g, '#7c6fb0', 3, 5, 1, 2)
    rect(g, '#7c6fb0', 8, 5, 1, 2)
  },
  'bio-sample': (g) => {
    rect(g, '#d8d9e6', 4, 1, 4, 1)
    rect(g, '#9aa0b8', 3, 2, 6, 9)
    rect(g, '#2f6f5f', 4, 4, 4, 6)
    rect(g, '#9fe1cb', 4, 6, 4, 4)
    rect(g, '#e9fff6', 5, 7, 1, 1)
  },
  'rare-ore': (g) => {
    ellipse(g, '#5a3a26', 6, 7, 5, 4)
    rect(g, '#ff9f5a', 3, 5, 2, 2)
    rect(g, '#ffd28a', 6, 4, 2, 2)
    rect(g, '#ff9f5a', 7, 8, 2, 1)
  },
  'power-drill': (g) => {
    rect(g, '#d4a43c', 1, 4, 6, 4)
    rect(g, '#f2c85e', 1, 4, 6, 1)
    rect(g, '#5b6496', 3, 8, 2, 3)
    rect(g, '#c9cbe0', 7, 5, 3, 2)
    rect(g, '#e6e6ee', 10, 5, 1, 2)
  },
  'armor-plating': (g) => {
    rect(g, '#9aa2cf', 2, 2, 8, 8)
    rect(g, '#c9cbe0', 2, 2, 8, 2)
    rect(g, '#5b6496', 5, 4, 2, 6)
    rect(g, '#e0884a', 2, 6, 8, 1)
  },
  'blaster': (g) => {
    rect(g, '#5b6496', 1, 4, 8, 3)
    rect(g, '#9aa0b8', 1, 4, 8, 1)
    rect(g, '#3f4878', 3, 7, 2, 3)
    rect(g, '#ff8a7a', 9, 5, 2, 1)
  },
}

const ITEM_PNGS: readonly ItemId[] = [
  'anomaly-shard',
  'rare-ore',
  'bio-sample',
  'armor-plating',
  'blaster',
  'repair-kit',
  'power-cell',
  'ration-pack',
  'metal-scrap',
  'pickaxe',
  'moon-pickaxe',
  'moon-rock',
  'moon-berry',
  'star-melon',
  'glow-cap',
  'iron-ore',
  'titanium-ore',
]

export const ICONS = Object.fromEntries(
  (Object.keys(ITEMS) as ItemId[]).map((id) => [id, makeSprite(12, 12, ICON_DRAWERS[id] ?? (() => {}))]),
) as Record<ItemId, HTMLCanvasElement>

export const HAS_ITEM_PNG = new Set<ItemId>()

for (const id of ITEM_PNGS) {
  const img = new Image()
  img.onload = () => {
    ICONS[id] = makeSprite(img.width, img.height, (g) => g.drawImage(img, 0, 0))
    HAS_ITEM_PNG.add(id)
  }
  img.src = `${import.meta.env.BASE_URL}ui/items/${id}.png`
}

export function drawItemIcon(text: TextLayer, item: ItemId, x: number, y: number, size: number): void {
  const icon = ICONS[item]
  text.image(icon, 0, 0, icon.width, icon.height, x, y, size, size)
}

export interface HotbarItem {
  item: ItemId
  count: number
}

export class Hotbar {
  selected = 0
  private base: HTMLCanvasElement | null = null
  private tile: HTMLCanvasElement | null = null
  private changedAt = -10

  constructor() {
    const url = (n: number) => `${import.meta.env.BASE_URL}ui/hotbar-selected-${n}.png`
    Promise.all([loadImage(url(2)), loadImage(url(3))])
      .then(([slot2Selected, slot3Selected]) => {
        this.base = makeSprite(IMG_W, IMG_H, (g) => {
          g.drawImage(slot2Selected, 0, 0)
          g.drawImage(slot3Selected, TILE_X, 0, TILE_W, IMG_H, TILE_X, 0, TILE_W, IMG_H)
        })
        this.tile = makeSprite(TILE_W, TILE_H, (g) => {
          g.drawImage(slot2Selected, TILE_X, TILE_Y, TILE_W, TILE_H, 0, 0, TILE_W, TILE_H)
        })
      })
      .catch(() => {
        this.base = null
      })
  }

  select(index: number, time: number): void {
    const next = ((index % HOTBAR_SLOTS) + HOTBAR_SLOTS) % HOTBAR_SLOTS
    if (next !== this.selected) this.changedAt = time
    this.selected = next
  }

  draw(text: TextLayer, items: (HotbarItem | undefined)[], time: number): void {
    if (!this.base || !this.tile) return
    const x0 = HOTBAR_X
    const y0 = HOTBAR_Y
    text.image(this.base, 0, 0, IMG_W, IMG_H, x0, y0, HOTBAR_W, HOTBAR_H)
    const tileX = x0 + (TILE_X - SLOT_PITCH + SLOT_PITCH * this.selected) * DRAW_SCALE
    text.image(this.tile, 0, 0, TILE_W, TILE_H, tileX, y0 + TILE_Y * DRAW_SCALE, TILE_W * DRAW_SCALE, TILE_H * DRAW_SCALE)

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const entry = items[i]
      if (!entry) continue
      const cx = x0 + (24.5 + SLOT_PITCH * i) * DRAW_SCALE
      const cy = y0 + 23.5 * DRAW_SCALE
      drawItemIcon(text, entry.item, cx - 5.5, cy - 5.5, 11)
      if (entry.count > 1) {
        text.text(String(entry.count), cx + 6.5, cy + 2.2, '#ffffff', { size: 4.5, align: 'right', weight: 700 })
      }
    }

    const current = items[this.selected]
    const age = time - this.changedAt
    if (current && age < 2) {
      text.text(ITEMS[current.item].name, SCREEN_CX, y0 - 7, ITEMS[current.item].color, { size: 5.5, align: 'center' })
    }
  }
}
