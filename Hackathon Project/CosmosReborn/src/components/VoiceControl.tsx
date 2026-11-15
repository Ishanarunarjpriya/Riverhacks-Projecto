import { useEffect, useRef, useState } from 'react'
import type { Game } from '../game/game'
import { submitVoiceQuery } from '../game/voiceAsk'
import { VoiceInput, type VoiceStatus } from '../game/voiceInput'

const LABELS: Record<VoiceStatus, string> = {
  off: 'VOICE OFF',
  starting: 'MIC...',
  listening: 'VOICE ON',
  hearing: 'HEARING',
  transcribing: 'THINKING',
  error: 'MIC BLOCKED',
}

/** Persistent mic toggle: enable once, then say "Hey AI ..." anywhere in the game. */
export default function VoiceControl({ game }: { game: Game }) {
  const [status, setStatus] = useState<VoiceStatus>('off')
  const [note, setNote] = useState('ENABLE THE MIC, THEN SAY "HEY AI ..."')
  const voice = useRef<VoiceInput | null>(null)

  useEffect(() => {
    const input = new VoiceInput({
      onStatus: (next, detail) => {
        setStatus(next)
        if (detail) setNote(detail)
      },
      onQuery: (query) => {
        if (!game.openAssistant()) {
          setNote('THE LANDER IS NOT READY YET')
          return false
        }
        submitVoiceQuery(query)
        return true
      },
    })
    voice.current = input
    return () => {
      input.disable()
      voice.current = null
    }
  }, [game])

  const toggle = () => {
    const input = voice.current
    if (!input) return
    if (input.active) input.disable()
    else void input.enable()
  }

  const on = status !== 'off' && status !== 'error'
  const warn = status === 'error' || /KEY|FAIL|BLOCK|NOT READY|ERROR|UNAVAILABLE/.test(note)
  return (
    <div className="voice-wrap">
      <button
        type="button"
        className={`voice-control${on ? ' on' : ''}${status === 'error' ? ' error' : ''}`}
        onClick={toggle}
        title={note || 'Enable the microphone, then say "Hey AI ..."'}
        aria-pressed={on}
        aria-label={on ? 'Disable voice assistant' : 'Enable voice assistant'}
      >
        <span className="voice-dot" aria-hidden="true" />
        {LABELS[status]}
      </button>
      {status !== 'off' && note && <span className={`voice-note${warn ? '' : ' hint'}`}>{note}</span>}
    </div>
  )
}
