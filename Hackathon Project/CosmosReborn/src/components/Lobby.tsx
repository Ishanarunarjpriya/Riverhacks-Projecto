import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Game } from '../game/game'
import { savedName } from '../game/net'

interface Props {
  game: Game
}

/** Multiplayer lobby over the title screen: host a room or join one with a 4-letter code. */
export default function Lobby({ game }: Props) {
  const net = game.net
  const version = useSyncExternalStore(
    (fn) => net.subscribe(fn),
    () => `${net.status}|${net.code}|${net.players.map((p) => p.id).join(',')}|${net.error}|${net.hostId}`,
  )
  const [name, setName] = useState(savedName())
  const [code, setCode] = useState('')
  const [fresh, setFresh] = useState(!game.hasSave())
  void version

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') game.closeLobby()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game])

  const inRoom = net.status === 'lobby' || net.status === 'playing'
  const connecting = net.status === 'connecting'
  const cleanName = name.trim() || 'ASTRONAUT'

  return (
    <div className="lobby" role="dialog" aria-label="Multiplayer">
      <div className="lobby-panel">
        <header className="lobby-head">
          <span className="lobby-title">MULTIPLAYER</span>
          <button className="lobby-x" onClick={() => game.closeLobby()} aria-label="Back to title">
            ESC
          </button>
        </header>

        {!inRoom && (
          <div className="lobby-body">
            <label className="lobby-field">
              <span>YOUR NAME</span>
              <input value={name} maxLength={12} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="ASTRONAUT" autoFocus />
            </label>
            <div className="lobby-row">
              <button className="lobby-btn primary" disabled={connecting} onClick={() => net.host(cleanName)}>
                HOST A GAME
              </button>
            </div>
            <div className="lobby-or">OR JOIN A FRIEND</div>
            <form
              className="lobby-row"
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim().length === 4) net.join(code, cleanName)
              }}
            >
              <input
                className="lobby-code"
                value={code}
                maxLength={4}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                placeholder="CODE"
                aria-label="Room code"
              />
              <button className="lobby-btn" type="submit" disabled={connecting || code.length !== 4}>
                JOIN
              </button>
            </form>
            {connecting && <p className="lobby-note">CONNECTING...</p>}
            {net.error && <p className="lobby-error">{net.error}</p>}
          </div>
        )}

        {inRoom && (
          <div className="lobby-body">
            <div className="lobby-code-show">
              <span>ROOM CODE</span>
              <strong>{net.code}</strong>
            </div>
            <ul className="lobby-players">
              {net.players.map((p) => (
                <li key={p.id}>
                  <i style={{ background: p.color }} />
                  {p.name}
                  {p.id === net.hostId && <em>HOST</em>}
                  {p.id === net.you && <em>YOU</em>}
                </li>
              ))}
              {Array.from({ length: Math.max(0, 4 - net.players.length) }, (_, i) => (
                <li key={`empty-${i}`} className="empty">
                  <i />
                  OPEN SEAT
                </li>
              ))}
            </ul>
            {net.isHost ? (
              <>
                {game.hasSave() && (
                  <div className="lobby-choice" role="radiogroup" aria-label="Which game">
                    <button className={!fresh ? 'on' : ''} role="radio" aria-checked={!fresh} onClick={() => setFresh(false)}>
                      CONTINUE MY SAVE
                    </button>
                    <button className={fresh ? 'on' : ''} role="radio" aria-checked={fresh} onClick={() => setFresh(true)}>
                      NEW GAME
                    </button>
                  </div>
                )}
                {fresh && game.hasSave() && <p className="lobby-error">A NEW GAME ERASES YOUR SAVE.</p>}
                <div className="lobby-row">
                  <button className="lobby-btn primary" onClick={() => game.hostStart(fresh)}>
                    START {fresh ? '(EVERYONE CRASH-LANDS TOGETHER)' : ''}
                  </button>
                </div>
                <p className="lobby-note">SHARE THE CODE. UP TO 4 PLAYERS. FRIENDS CAN ALSO JOIN LATER.</p>
              </>
            ) : (
              <p className="lobby-note">WAITING FOR {net.nameOf(net.hostId)} TO START...</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
