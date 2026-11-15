import { SCREEN_CX, SCREEN_H, SCREEN_W } from './constants'
import { HOTBAR_SLOTS, ICONS, type HotbarItem } from './hotbar'
import { ITEMS } from './items'
import { clamp } from './math'
import type { Ctx } from './pixel'
import type { TextLayer } from './text'

const IMG_W = 224
const IMG_H = 280
const DRAW_SCALE = 0.5
const PANEL_W = IMG_W * DRAW_SCALE
const PANEL_H = IMG_H * DRAW_SCALE
const PANEL_X = SCREEN_CX - PANEL_W / 2
const PANEL_Y = (SCREEN_H - PANEL_H) / 2

const SLOT_COLUMNS = [27, 63, 99, 135, 171]
const GRID_ROWS = [71, 114, 150, 186]
const HOTBAR_ROW = 239
const SLOT_INNER = 27
const ANIM_TIME = 0.22

export const INVENTORY_SLOTS = SLOT_COLUMNS.length * GRID_ROWS.length

interface SlotRect {
  x: number
  y: number
  size: number
}

function slotRect(col: number, rowY: number): SlotRect {
  return {
    x: PANEL_X + SLOT_COLUMNS[col] * DRAW_SCALE,
    y: PANEL_Y + rowY * DRAW_SCALE,
    size: SLOT_INNER * DRAW_SCALE,
  }
}

export class InventoryScreen {
  open = false
  private t = 0
  private img: HTMLImageElement | null = null
  private mouse: { x: number; y: number } | null = null

  constructor() {
    const img = new Image()
    img.onload = () => {
      this.img = img
    }
    img.src = `${import.meta.env.BASE_URL}ui/inventory.png`
  }

  get visible(): boolean {
    return this.open || this.t > 0
  }

  get progress(): number {
    return this.t
  }

  toggle(): void {
    this.open = !this.open
  }

  close(): void {
    this.open = false
  }

  pointer(x: number, y: number): void {
    this.mouse = { x, y }
  }

  update(dt: number): void {
    this.t = clamp(this.t + ((this.open ? 1 : -1) * dt) / ANIM_TIME, 0, 1)
  }

  drawBackdrop(ctx: Ctx): void {
    if (this.t <= 0) return
    ctx.fillStyle = `rgba(4,3,16,${0.6 * this.t})`
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  }

  draw(text: TextLayer, items: HotbarItem[], selected: number): void {
    if (this.t <= 0 || !this.img) return
    const ease = 1 - (1 - this.t) ** 3
    const offset = (1 - ease) * 18
    const saved = text.alpha
    text.alpha = ease
    text.image(this.img, 0, 0, IMG_W, IMG_H, PANEL_X, PANEL_Y + offset, PANEL_W, PANEL_H)

    let hovered: HotbarItem | null = null
    const drawSlot = (rect: SlotRect, entry: HotbarItem | undefined, highlight: boolean) => {
      const y = rect.y + offset
      if (highlight) {
        text.rect('#fac775', rect.x - 0.5, y - 0.5, rect.size + 1, 0.5)
        text.rect('#fac775', rect.x - 0.5, y + rect.size, rect.size + 1, 0.5)
        text.rect('#fac775', rect.x - 0.5, y - 0.5, 0.5, rect.size + 1)
        text.rect('#fac775', rect.x + rect.size, y - 0.5, 0.5, rect.size + 1)
      }
      const m = this.mouse
      const over = m && m.x >= rect.x && m.x < rect.x + rect.size && m.y >= y && m.y < y + rect.size
      if (over) text.rect('rgba(255,255,255,0.12)', rect.x, y, rect.size, rect.size)
      if (!entry) return
      if (over) hovered = entry
      const c = rect.x + rect.size / 2
      text.image(ICONS[entry.item], 0, 0, 12, 12, c - 5, y + rect.size / 2 - 5, 10, 10)
      if (entry.count > 1) text.text(String(entry.count), rect.x + rect.size - 0.5, y + rect.size - 5, '#ffffff', { size: 4.5, align: 'right', weight: 700 })
    }

    GRID_ROWS.forEach((rowY, r) => {
      SLOT_COLUMNS.forEach((_, c) => drawSlot(slotRect(c, rowY), items[r * SLOT_COLUMNS.length + c], false))
    })
    for (let c = 0; c < HOTBAR_SLOTS; c++) drawSlot(slotRect(c, HOTBAR_ROW), items[c], c === selected)

    const tip = hovered as HotbarItem | null
    if (tip) {
      const info = ITEMS[tip.item]
      const x = PANEL_X + PANEL_W + 4
      const y = clamp((this.mouse?.y ?? PANEL_Y) - 6, 4, SCREEN_H - 30)
      const w = Math.max(text.measure(info.name, { size: 6 }), text.measure(info.description, { size: 4.8, weight: 500 })) + 8
      const tipX = Math.min(x, SCREEN_W - w - 2)
      text.rect('rgba(6,5,24,0.92)', tipX, y, w, 20)
      text.rect(info.color, tipX, y, 1, 20)
      text.text(info.name, tipX + 4, y + 2.5, info.color, { size: 6 })
      text.text(info.description, tipX + 4, y + 10.5, '#d9dcef', { size: 4.8, weight: 500 })
      text.text(`x${tip.count}`, tipX + w - 3, y + 2.5, '#9aa2cf', { size: 5, align: 'right' })
    }

    text.text('F TO CLOSE', SCREEN_CX, PANEL_Y + PANEL_H + offset + 2, '#5b6496', { size: 4.5, align: 'center' })
    text.alpha = saved
  }
}
