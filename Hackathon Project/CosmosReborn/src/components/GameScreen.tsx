import { useEffect, useRef } from 'react'
import { Game } from '../game/game'

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const textCanvas = textRef.current
    if (!canvas || !textCanvas) return
    const game = new Game(canvas, textCanvas)
    game.start()
    return () => game.destroy()
  }, [])

  return (
    <div className="game-frame">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Cosmos Reborn game" />
      <canvas ref={textRef} className="game-text" aria-hidden="true" />
    </div>
  )
}
