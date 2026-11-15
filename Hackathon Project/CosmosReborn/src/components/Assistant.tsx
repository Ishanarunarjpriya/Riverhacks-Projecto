import { useEffect, useRef, useState } from 'react'
import { askAssistant, type AssistAnswer, type AssistBlock } from '../game/assistant'
import { SCREEN_H, SCREEN_W } from '../game/constants'
import type { ScreenRect } from '../game/tablet'

interface Props {
  rect: ScreenRect
  onBack: () => void
}

interface Entry {
  id: number
  query: string
  status: 'loading' | 'ready' | 'error'
  data?: AssistAnswer
  error?: string
}

const SUGGESTIONS = ['why is the dust so sharp?', 'why am i still breathing?', 'how do we make air out here?']

const WAITING = ['THE CORE IS LISTENING…', 'SOMETHING IN THE DUST IS THINKING…', 'RELAYING THROUGH THE WRECK…']

// Kept outside the component so the conversation survives closing the tablet.
let sessionLog: Entry[] = []
let nextId = 1

const pct = (value: number, total: number) => `${(value / total) * 100}%`

function Block({ block }: { block: AssistBlock }) {
  if (block.type === 'heading') return <p className="ai-head">{block.text}</p>
  if (block.type === 'code')
    return (
      <pre className="ai-code">
        <code>{block.text}</code>
      </pre>
    )
  if (block.type === 'list')
    return (
      <ul className="ai-bullets">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  if (block.type === 'table')
    return (
      <table className="ai-table">
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  return <p className="ai-answer">{block.text}</p>
}

function Answer({ data, onAsk, busy }: { data: AssistAnswer; onAsk: (q: string) => void; busy: boolean }) {
  return (
    <>
      {data.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
      {data.answer && <p className="ai-answer">{data.answer}</p>}

      {data.results.length > 0 && (
        <div className="ai-refs">
          <span className="ai-refs-head">SOURCES</span>
          {data.results.map((r, i) => (
            <div className="ai-result" key={r.link}>
              <a href={r.link} target="_blank" rel="noreferrer noopener">
                [{i + 1}] {r.title}
              </a>
              {r.source && <span className="ai-source">{r.source}</span>}
            </div>
          ))}
        </div>
      )}

      {data.followUps.length > 0 && (
        <div className="ai-suggestions ai-followups">
          {data.followUps.map((q) => (
            <button key={q} onClick={() => onAsk(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default function Assistant({ rect, onBack }: Props) {
  const [entries, setEntries] = useState<Entry[]>(() => sessionLog)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const lastEntryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    sessionLog = entries
  }, [entries])

  // Keep the newest exchange pinned to the top of the log instead of its tail,
  // so the player sees their question and the start of the answer.
  useEffect(() => {
    const log = logRef.current
    const entry = lastEntryRef.current
    if (!log || !entry) return
    const delta = entry.getBoundingClientRect().top - log.getBoundingClientRect().top
    log.scrollTop = Math.max(0, log.scrollTop + delta - 2)
  }, [entries])

  const busy = entries.some((entry) => entry.status === 'loading')
  const offline = entries[entries.length - 1]?.status === 'error'

  const ask = (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    const id = nextId++
    setEntries((prev) => [...prev, { id, query: q, status: 'loading' }])
    setQuery('')
    inputRef.current?.focus()
    askAssistant(q)
      .then((data) => setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: 'ready', data } : entry))))
      .catch((error: unknown) =>
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === id ? { ...entry, status: 'error', error: error instanceof Error ? error.message : 'LINK FAILED' } : entry,
          ),
        ),
      )
  }

  return (
    <div
      className="ai-app"
      style={{
        left: pct(rect.x, SCREEN_W),
        top: pct(rect.y, SCREEN_H),
        width: pct(rect.w, SCREEN_W),
        height: pct(rect.h, SCREEN_H),
      }}
      role="dialog"
      aria-label="Moonlink assistant"
    >
      <div className="ai-shell">
        <div className="ai-status">
          <span className="ai-name">MOONLINK</span>
          <span className={offline ? 'ai-link ai-link-down' : 'ai-link'}>{offline ? 'SIGNAL: LOST' : 'SIGNAL: WEAK'}</span>
          <button className="ai-back" onMouseDown={(e) => e.preventDefault()} onClick={onBack} aria-label="Back to tablet home">
            ◀ HOME
          </button>
        </div>

        <div className="ai-log" ref={logRef}>
          {entries.length === 0 && (
            <>
              <p className="ai-line ai-hello">
                &gt; A.I. CORE ........ DAMAGED
                <br />
                &gt; HELLO. YOU ARE AWAKE. THAT WAS NOT SUPPOSED TO HAPPEN.
                <br />
                &gt; THE OLD NETWORKS STILL ANSWER. SOMETHING OUT THERE ANSWERS WITH THEM.
                <br />
                &gt; ASK. I WILL TELL YOU WHAT I AM ALLOWED TO.
              </p>
              <div className="ai-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {entries.map((entry, index) => (
            <div className="ai-entry" key={entry.id} ref={index === entries.length - 1 ? lastEntryRef : undefined}>
              <p className="ai-query">&gt; {entry.query.toUpperCase()}</p>
              {entry.status === 'loading' && <p className="ai-line">{WAITING[entry.id % WAITING.length]}</p>}
              {entry.status === 'error' && <p className="ai-line ai-error">{entry.error}</p>}
              {entry.status === 'ready' && entry.data && <Answer data={entry.data} onAsk={ask} busy={busy} />}
            </div>
          ))}
        </div>

        <form
          className="ai-ask"
          onSubmit={(e) => {
            e.preventDefault()
            ask(query)
          }}
        >
          <span className="ai-caret">&gt;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Backspace' && query.length === 0)) {
                e.preventDefault()
                e.stopPropagation()
                onBack()
              }
            }}
            placeholder="ask the lander..."
            maxLength={160}
            spellCheck={false}
            aria-label="Ask Moonlink"
          />
          <button type="submit" disabled={busy}>
            ASK
          </button>
        </form>
      </div>
    </div>
  )
}
