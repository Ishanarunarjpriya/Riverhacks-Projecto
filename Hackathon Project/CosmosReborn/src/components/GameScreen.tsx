import { useEffect, useRef, useState } from 'react'
import { SCREEN_H, SCREEN_W } from '../game/constants'
import { Game } from '../game/game'
import DevMenu from './DevMenu'

function fitFrame(frame: HTMLDivElement): void {
  const vv = window.visualViewport
  const availW = vv?.width ?? window.innerWidth
  const availH = vv?.height ?? window.innerHeight
  const scale = Math.min(availW / SCREEN_W, availH / SCREEN_H)
  frame.style.width = `${Math.floor(SCREEN_W * scale)}px`
  frame.style.height = `${Math.floor(SCREEN_H * scale)}px`
}

export default function GameScreen() {
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [devOpen, setDevOpen] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const resize = () => fitFrame(frame)
    resize()
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const textCanvas = textRef.current
    if (!canvas || !textCanvas) return
    const instance = new Game(canvas, textCanvas)
    instance.start()
    setGame(instance)
    return () => {
      instance.destroy()
      setGame(null)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const toggle = e.code === 'Backquote' || e.key === '`' || e.key === '~'
      if (toggle && !e.repeat) setDevOpen((open) => !open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <div ref={frameRef} className="game-frame">
        <canvas ref={canvasRef} className="game-canvas" aria-label="Cosmos Reborn game" />
        <canvas ref={textRef} className="game-text" aria-hidden="true" />
      </div>
      {devOpen && game && <DevMenu game={game} onClose={() => setDevOpen(false)} />}
    </>
  )
}
