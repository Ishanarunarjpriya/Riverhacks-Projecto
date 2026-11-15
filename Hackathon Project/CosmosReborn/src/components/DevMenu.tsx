import { useEffect, useState, type ReactNode } from 'react'
import type { DevLocation, DevStatus, Game } from '../game/game'

interface Props {
  game: Game
  onClose: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dev-section">
      <h3>{title}</h3>
      <div className="dev-grid">{children}</div>
    </section>
  )
}

function Button({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button className={active ? 'dev-btn active' : 'dev-btn'} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {label}
    </button>
  )
}

export default function DevMenu({ game, onClose }: Props) {
  const [status, setStatus] = useState<DevStatus>(() => game.devStatus())
  const [locations, setLocations] = useState<DevLocation[]>(() => game.devLocations())
  const [note, setNote] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatus(game.devStatus())
      setLocations(game.devLocations())
    }, 300)
    return () => window.clearInterval(id)
  }, [game])

  const act = (label: string, fn: () => unknown) => () => {
    const result = fn()
    setNote(typeof result === 'string' ? `${label}: ${result}` : label)
    setStatus(game.devStatus())
  }

  const groups = [...new Set(locations.map((l) => l.group))]

  return (
    <div className="dev-menu">
      <header>
        <strong>DEV MENU</strong>
        <span className="dev-hint">` to close</span>
        <button className="dev-close" onMouseDown={(e) => e.preventDefault()} onClick={onClose} aria-label="Close dev menu">
          ×
        </button>
      </header>

      <div className="dev-status">
        <div>
          {status.fps} FPS · {status.scene.toUpperCase()} · ({status.x}, {status.z}) y{status.y} · {status.heading}°
        </div>
        <div>
          {status.region} · Act {status.act}: {status.quest}
        </div>
        <div>
          HP {status.hp} · enemies {status.enemies} {status.god ? '· GOD' : ''}
        </div>
        {note && <div className="dev-note">✓ {note}</div>}
      </div>

      <Section title="Quests">
        <Button label="Complete current quest" onClick={act('Completed', () => game.devCompleteQuest() ?? 'nothing active')} />
        <Button label="Skip cutscene" onClick={act('Cutscene skipped', () => game.devSkipCutscene())} />
        <Button label="Jump to Act II" onClick={act('Jumped to Act II', () => game.devJumpToAct(2))} />
        <Button label="Jump to Act III" onClick={act('Jumped to Act III', () => game.devJumpToAct(3))} />
        <Button label="Finish everything" onClick={act('Jumped to the end', () => game.devJumpToAct(99))} />
        <Button label="Reveal map" onClick={act('Map revealed', () => game.devRevealAll())} />
      </Section>

      {groups.map((group) => (
        <Section key={group} title={`Teleport · ${group}`}>
          {locations
            .filter((l) => l.group === group)
            .map((l) => (
              <Button key={l.id} label={l.label} onClick={act(`Teleported to ${l.label}`, () => game.devTeleport(l.id))} />
            ))}
        </Section>
      ))}

      <Section title="Items">
        <Button label="Give resources" onClick={act('Resources added', () => game.devGiveResources())} />
        <Button label="Give all gear" onClick={act('Gear added', () => game.devGiveGear())} />
        <Button label="Give food & ores" onClick={act('Food & ores added', () => game.devGiveFood())} />
      </Section>

      <Section title="Gardens">
        <Button label="Plant garden ahead" onClick={act('Garden', () => game.devSpawnGarden())} />
        <Button label="Regrow all gardens" onClick={act('Gardens', () => game.devGrowGardens())} />
      </Section>

      <Section title="Combat">
        <Button label={status.god ? 'God mode: ON' : 'God mode: OFF'} active={status.god} onClick={act('God mode toggled', () => game.devToggleGod())} />
        <Button label="Heal" onClick={act('Healed', () => game.devHeal())} />
        <Button label="Spawn 3 suits" onClick={act('Spawn suits', () => game.devSpawnSuits(3))} />
        <Button label="Start base wave" onClick={act('Wave', () => game.devStartWave())} />
        <Button label="Clear enemies" onClick={act('Enemies cleared', () => game.devClearEnemies())} />
        <Button label="Kill player" onClick={act('Player killed', () => game.devKillPlayer())} />
      </Section>

      <Section title="Movement & view">
        {[1, 3, 6].map((m) => (
          <Button key={m} label={`Speed ×${m}`} active={status.speed === m} onClick={act(`Speed ×${m}`, () => game.devSetSpeed(m))} />
        ))}
        <Button label={status.minimap ? 'Minimap: ON' : 'Minimap: OFF'} active={status.minimap} onClick={act('Minimap toggled', () => game.devToggleMinimap())} />
      </Section>
    </div>
  )
}
