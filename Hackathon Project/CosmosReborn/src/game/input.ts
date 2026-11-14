import type { Controls } from './player'

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'])

export class Input {
  onTablet: () => void = () => {}
  onEscape: () => void = () => {}

  private held = new Set<string>()

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault()
      if (!e.repeat) this.onTablet()
      return
    }
    if (e.code === 'Escape') {
      this.onEscape()
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

  private handleBlur = () => {
    this.held.clear()
  }

  attach(): void {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    this.held.clear()
  }

  controls(): Controls {
    const down = (...codes: string[]) => codes.some((c) => this.held.has(c))
    return {
      forward: (down('ArrowUp', 'KeyW') ? 1 : 0) - (down('ArrowDown', 'KeyS') ? 1 : 0),
      turn: (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0),
      jump: down('Space'),
    }
  }
}
