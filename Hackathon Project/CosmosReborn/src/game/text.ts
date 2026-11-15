import { SCREEN_H, SCREEN_W } from './constants'

const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export interface TextStyle {
  size?: number
  align?: CanvasTextAlign
  weight?: number
}

export class TextLayer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  alpha = 1

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas is not supported')
    this.canvas = canvas
    this.ctx = ctx
  }

  begin(): void {
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, w, h)
    this.ctx.setTransform(w / SCREEN_W, 0, 0, h / SCREEN_H, 0, 0)
    this.ctx.textBaseline = 'top'
    this.alpha = 1
  }

  text(str: string, x: number, y: number, color: string, style: TextStyle = {}): void {
    const { ctx } = this
    ctx.font = this.font(style)
    ctx.textAlign = style.align ?? 'left'
    ctx.globalAlpha = this.alpha
    ctx.fillStyle = color
    ctx.fillText(str, x, y)
    ctx.globalAlpha = 1
  }

  measure(str: string, style: TextStyle = {}): number {
    this.ctx.font = this.font(style)
    return this.ctx.measureText(str).width
  }

  clear(x: number, y: number, w: number, h: number): void {
    this.ctx.clearRect(x, y, w, h)
  }

  rect(color: string, x: number, y: number, w: number, h: number): void {
    this.ctx.globalAlpha = this.alpha
    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, w, h)
    this.ctx.globalAlpha = 1
  }

  image(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    const { ctx } = this
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = this.alpha
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
    ctx.globalAlpha = 1
  }

  private font({ size = 7, weight = 600 }: TextStyle): string {
    return `${weight} ${size}px ${FONT_FAMILY}`
  }
}
