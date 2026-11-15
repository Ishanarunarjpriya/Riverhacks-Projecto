import type { Controls } from './player'

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ'])
const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']

export class Input {
  onTablet: () => void = () => {}
  onEscape: () => void = () => {}
  onInteract: () => void = () => {}
  onSlot: (index: number) => void = () => {}
  onScroll: (direction: number) => void = () => {}
  onMute: () => void = () => {}
  onAnyInput: () => void = () => {}
  onKeyPress: (code: string) => boolean = () => false

  private held = new Set<string>()

  private handleKeyDown = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    this.onAnyInput()
    if (!e.repeat && this.onKeyPress(e.code)) {
      e.preventDefault()
      return
    }
    if (e.code === 'Tab') {
      e.preventDefault()
      if (!e.repeat) this.onTablet()
      return
    }
    if (e.code === 'KeyE') {
      if (!e.repeat) this.onInteract()
      return
    }
    if (e.code === 'KeyM') {
      if (!e.repeat) this.onMute()
      return
    }
    if (e.code === 'Escape') {
      this.onEscape()
      return
    }
    const slot = SLOT_KEYS.indexOf(e.code)
    if (slot >= 0) {
      this.onSlot(slot)
      return
    }
    if (GAME_KEYS.has(e.code)) {
      e.preventDefault()
      this.held.add(e.code)
    }
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code)
  }

  private handleWheel = (e: WheelEvent) => {
    if (e.deltaY !== 0) this.onScroll(Math.sign(e.deltaY))
  }

  private handlePointer = () => {
    this.onAnyInput()
  }

  private handleBlur = () => {
    this.held.clear()
  }

  attach(): void {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('wheel', this.handleWheel, { passive: true })
    window.addEventListener('pointerdown', this.handlePointer)
    window.addEventListener('blur', this.handleBlur)
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('wheel', this.handleWheel)
    window.removeEventListener('pointerdown', this.handlePointer)
    window.removeEventListener('blur', this.handleBlur)
    this.held.clear()
  }

  clear(): void {
    this.held.clear()
  }

  controls(): Controls {
    const down = (...codes: string[]) => codes.some((c) => this.held.has(c))
    return {
      forward: (down('ArrowUp', 'KeyW') ? 1 : 0) - (down('ArrowDown', 'KeyS') ? 1 : 0),
      turn: (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0),
      jump: down('Space'),
      fire: down('KeyQ'),
    }
  }
}
