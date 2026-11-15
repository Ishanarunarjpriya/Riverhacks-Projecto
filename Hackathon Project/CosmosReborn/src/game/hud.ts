import { HATCH } from './anomalies'
import { BASE_CENTER } from './base'
import { SCREEN_CX, SCREEN_W, WORLD_SIZE } from './constants'
import { HOTBAR_X, HOTBAR_Y, Hotbar, type HotbarItem } from './hotbar'
import { clamp, wrap, wrapPositive } from './math'
import { rect, type Ctx } from './pixel'
import type { Player } from './player'
import { roman } from './tracker'
import type { TextLayer, TextStyle } from './text'
import type { Message, QuestTracker } from './tracker'
import type { World } from './world'

export interface Prompt {
  title: string
  detail: string
  ok: boolean
}

export interface CombatHud {
  hp: number
  maxHp: number
  armor: boolean
  blaster: boolean
  integrity: number | null
  dead: boolean
  underground: boolean
}

export interface HudState {
  world: World
  player: Player
  tracker: QuestTracker
  hotbar: Hotbar
  hotbarItems: (HotbarItem | undefined)[]
  time: number
  showPitWarning: boolean
  prompt: Prompt | null
  muted: boolean
  combat: CombatHud
  showMinimap: boolean
}

const PANEL = 'rgba(6,5,24,.75)'
const LINE = 8

export function drawHud(ctx: Ctx, text: TextLayer, hud: HudState): void {
  drawQuestPanel(ctx, text, hud.tracker)
  drawCompass(ctx, text, hud.world, hud.player, hud.tracker)
  if (hud.showMinimap) drawMinimap(ctx, hud.world, hud.player)
  drawToasts(ctx, text, hud.tracker)
  if (hud.prompt) drawPrompt(ctx, text, hud.prompt)
  if (hud.showPitWarning && Math.floor(hud.time * 3) % 2) {
    ctx.fillStyle = 'rgba(6,5,24,.8)'
    ctx.fillRect(SCREEN_CX - 50, 104, 100, 11)
    text.text('IN A CRATER - JUMP!', SCREEN_CX, 106, '#ff8a7a', { align: 'center', size: 6 })
  }
  hud.hotbar.draw(text, hud.hotbarItems, hud.time)
  drawCombat(ctx, text, hud.combat, hud.time)
  if (hud.muted) text.text('MUTED', SCREEN_W - 6, 172, '#5b6496', { size: 4.5, align: 'right' })
  drawCards(ctx, text, hud.tracker)
  drawTransmission(ctx, text, hud.tracker)
}

function drawQuestPanel(ctx: Ctx, text: TextLayer, tracker: QuestTracker): void {
  const quest = tracker.activeQuest
  const rows: { text: string; right?: string; color: string; style?: TextStyle }[] = []
  if (quest) {
    rows.push({ text: `ACT ${roman(quest.act)} · ${quest.title.toUpperCase()}`, color: '#fac775', style: { size: 6.5 } })
    for (const o of tracker.progress(quest)) {
      rows.push({
        text: `${o.done ? '✓' : '·'} ${o.label}`,
        right: o.target > 1 ? `${o.current}/${o.target}` : undefined,
        color: o.done ? '#5dcaa5' : '#d9dcef',
        style: { size: 6, weight: 500 },
      })
    }
  } else {
    rows.push({ text: `ACT ${roman(tracker.lastCompletedAct)} COMPLETE`, color: '#fac775', style: { size: 6.5 } })
    rows.push({ text: 'More acts coming soon', color: '#9aa2cf', style: { size: 6, weight: 500 } })
  }
  for (const q of tracker.openOptionalQuests) {
    const p = tracker.progress(q)[0]
    rows.push({ text: `◇ ${q.title}`, right: `${p.current}/${p.target}`, color: '#8e96c4', style: { size: 6, weight: 500 } })
  }

  const width = 138
  ctx.fillStyle = PANEL
  ctx.fillRect(4, 4, width, 6 + rows.length * LINE)
  rows.forEach((row, i) => {
    const y = 7 + i * LINE
    text.text(row.text, 8, y, row.color, row.style)
    if (row.right) text.text(row.right, width, y, row.color, { ...row.style, align: 'right' })
  })
}

function drawCompass(ctx: Ctx, text: TextLayer, world: World, player: Player, tracker: QuestTracker): void {
  const W = 116
  const X = SCREEN_W - 4 - W
  const Y = 4
  const H = 14
  const cx = X + W / 2
  const span = 70
  const headingDeg = (player.heading * 180) / Math.PI
  const toX = (bearing: number): number | null => {
    const rel = ((((bearing - headingDeg) % 360) + 540) % 360) - 180
    return Math.abs(rel) > span ? null : cx + (rel / span) * (W / 2 - 4)
  }

  ctx.fillStyle = PANEL
  ctx.fillRect(X, Y, W, H)
  for (let b = 0; b < 360; b += 15) {
    const x = toX(b)
    if (x === null) continue
    const major = b % 90 === 0
    if (major) text.text(['N', 'E', 'S', 'W'][b / 90], x, Y + 3.5, b === 0 ? '#ff8a7a' : '#d9dcef', { size: 6, align: 'center' })
    else rect(ctx, b % 45 === 0 ? '#9aa2cf' : '#5b6496', x, Y + (b % 45 === 0 ? 5 : 7), 1, b % 45 === 0 ? 4 : 2)
  }
  const baseBearing = (Math.atan2(wrap(BASE_CENTER.x - player.x), wrap(BASE_CENTER.z - player.z)) * 180) / Math.PI
  const bx = toX(baseBearing)
  if (bx !== null) {
    rect(ctx, '#fac775', bx - 1, Y + H - 3, 3, 1)
    rect(ctx, '#fac775', bx, Y + H - 2, 1, 1)
  }
  if (tracker.signalRevealed && !tracker.signalFound) {
    const sb = (Math.atan2(wrap(HATCH.x - player.x), wrap(HATCH.z - player.z)) * 180) / Math.PI
    const sxm = toX(sb)
    if (sxm !== null) {
      rect(ctx, '#c9a6ff', sxm - 1, Y + 1, 3, 3)
      rect(ctx, '#efe3ff', sxm, Y + 2, 1, 1)
    }
  }
  rect(ctx, '#ffffff', cx, Y, 1, 2)
  rect(ctx, '#ffffff', cx, Y + H - 2, 1, 2)

  let nearest = world.structures[0]
  let nearestDist = Infinity
  for (const s of world.structures) {
    const d = Math.hypot(wrap(s.x - player.x), wrap(s.z - player.z))
    if (d < nearestDist) {
      nearestDist = d
      nearest = s
    }
  }
  const label = `${nearest.name} ${Math.max(0, Math.round(nearestDist - nearest.radius))}m`
  const lw = text.measure(label, { size: 5.5 }) + 8
  ctx.fillStyle = PANEL
  ctx.fillRect(SCREEN_W - 4 - lw, Y + H + 2, lw, 9)
  text.text(label, SCREEN_W - 8, Y + H + 3.5, '#fac775', { size: 5.5, align: 'right' })
  const region = tracker.currentRegion
  const rw = text.measure(region, { size: 5 }) + 8
  ctx.fillStyle = PANEL
  ctx.fillRect(SCREEN_W - 4 - rw, Y + H + 12, rw, 8)
  text.text(region, SCREEN_W - 8, Y + H + 13.2, '#9aa2cf', { size: 5, align: 'right' })
}

function drawCombat(ctx: Ctx, text: TextLayer, c: CombatHud, time: number): void {
  const x = HOTBAR_X - 58
  const y = HOTBAR_Y + 6
  ctx.fillStyle = PANEL
  ctx.fillRect(x, y, 54, 14)
  const frac = Math.max(0, c.hp / c.maxHp)
  const low = frac < 0.3 && Math.floor(time * 4) % 2 === 0
  rect(ctx, '#2a1a2a', x + 3, y + 8, 48, 3)
  rect(ctx, low ? '#ffffff' : frac < 0.3 ? '#e24b4a' : '#5dcaa5', x + 3, y + 8, 48 * frac, 3)
  text.text(`HP ${Math.ceil(c.hp)}`, x + 3, y + 1.5, low ? '#ff8a7a' : '#d9dcef', { size: 4.8 })
  if (c.armor) text.text('ARMOR', x + 51, y + 1.5, '#9aa2cf', { size: 4.2, align: 'right' })
  if (c.blaster) {
    ctx.fillStyle = PANEL
    ctx.fillRect(HOTBAR_X + 100, y + 2, 40, 10)
    text.text('[Q] FIRE', HOTBAR_X + 120, y + 4.2, '#ff8a7a', { size: 4.8, align: 'center' })
  }
  if (c.integrity !== null) {
    const w = 116
    const bx = SCREEN_W - 4 - w
    const by = 42
    ctx.fillStyle = 'rgba(30,8,12,.85)'
    ctx.fillRect(bx, by, w, 15)
    rect(ctx, '#2a1a2a', bx + 4, by + 9, w - 8, 3)
    rect(ctx, c.integrity < 30 ? '#e24b4a' : '#fac775', bx + 4, by + 9, ((w - 8) * Math.max(0, c.integrity)) / 100, 3)
    text.text('SETTLEMENT UNDER ATTACK', bx + w / 2, by + 1.5, '#ff8a7a', { size: 5, align: 'center' })
  }
  if (c.dead) text.text('YOU BLACKED OUT', SCREEN_CX, 80, '#ff8a7a', { size: 10, align: 'center' })
}

function drawToasts(ctx: Ctx, text: TextLayer, tracker: QuestTracker): void {
  const now = tracker.time
  const life = 4.5
  const toasts = tracker.messages.filter((m) => m.kind === 'toast' && now >= m.born && now - m.born < life).slice(-4)
  const style: TextStyle = { size: 5.5, weight: 500 }
  let y = 152
  for (let i = toasts.length - 1; i >= 0; i--) {
    const m = toasts[i]
    const age = now - m.born
    const fade = Math.min(1, (life - age) / 0.8)
    const slide = (1 - clamp(age / 0.2, 0, 1)) * -20
    const lines = wrapText(text, m.text, 104, style)
    y -= lines.length * 6.5 + 3
    const w = Math.max(...lines.map((l) => text.measure(l, style))) + 8
    ctx.fillStyle = `rgba(6,5,24,${0.75 * fade})`
    ctx.fillRect(4 + slide, y - 2, w, lines.length * 6.5 + 2)
    const saved = text.alpha
    text.alpha = saved * fade
    lines.forEach((l, k) => text.text(l, 8 + slide, y + k * 6.5 - 0.5, m.color, style))
    text.alpha = saved
  }
}

function drawCards(ctx: Ctx, text: TextLayer, tracker: QuestTracker): void {
  const now = tracker.time
  const visible = (m: Message, life: number) => now >= m.born && now - m.born < life
  const act = tracker.messages.find((m) => m.kind === 'act' && visible(m, 3))
  if (act) {
    drawActCard(ctx, text, act, now - act.born)
    return
  }
  const complete = tracker.messages.find((m) => m.kind === 'complete' && visible(m, 2.4))
  if (complete) {
    drawCompleteBanner(ctx, text, complete, now - complete.born)
    return
  }
  const quest = tracker.messages.find((m) => m.kind === 'quest' && visible(m, 4.5))
  if (quest) drawQuestCard(ctx, text, quest, now - quest.born)
}

function drawTransmission(ctx: Ctx, text: TextLayer, tracker: QuestTracker): void {
  const now = tracker.time
  const life = 7
  const m = tracker.messages.find((msg) => msg.kind === 'transmission' && now >= msg.born && now - msg.born < life)
  if (!m) return
  const age = now - m.born
  const fade = clamp((life - age) / 0.6, 0, 1) * clamp(age / 0.25, 0, 1)
  const W = 200
  const x = SCREEN_CX - W / 2
  const style: TextStyle = { size: 5.5, weight: 500 }
  const reveal = Math.floor(clamp((age - 0.4) * 40, 0, m.detail.length))
  const lines = wrapText(text, m.detail, W - 16, style)
  const H = 14 + lines.length * 7
  const y = 92
  ctx.fillStyle = `rgba(20,10,36,${0.88 * fade})`
  ctx.fillRect(x, y, W, H)
  ctx.globalAlpha = fade
  for (let i = 0; i < W; i += 4) rect(ctx, '#5b4a8a', x + i, y, 2, 1)
  rect(ctx, m.color, x, y + H - 1, W, 1)
  ctx.globalAlpha = 1
  const saved = text.alpha
  text.alpha = saved * fade
  const blink = Math.floor(age * 3) % 2 === 0
  text.text(`${blink ? '◉' : '○'} ${m.text}`, x + 6, y + 3, m.color, { size: 5 })
  let left = reveal
  lines.forEach((line, i) => {
    const n = clamp(left, 0, line.length)
    left -= line.length + 1
    if (n > 0) text.text(line.slice(0, n), x + 6, y + 11 + i * 7, '#efe3ff', style)
  })
  text.alpha = saved
}

function drawActCard(ctx: Ctx, text: TextLayer, m: Message, age: number): void {
  const open = clamp(age / 0.35, 0, 1)
  const fade = clamp((3 - age) / 0.5, 0, 1)
  const h = 34 * open
  ctx.fillStyle = `rgba(4,3,16,${0.85 * fade})`
  ctx.fillRect(0, 70 - h / 2, SCREEN_W, h)
  const lineW = SCREEN_W * 0.6 * clamp((age - 0.2) / 0.5, 0, 1)
  ctx.globalAlpha = fade
  rect(ctx, m.color, SCREEN_CX - lineW / 2, 70 - h / 2, lineW, 1)
  rect(ctx, m.color, SCREEN_CX - lineW / 2, 70 + h / 2 - 1, lineW, 1)
  ctx.globalAlpha = 1
  if (open < 1) return
  const saved = text.alpha
  text.alpha = saved * fade
  text.text(m.text, SCREEN_CX, 57, m.color, { size: 12, align: 'center', weight: 700 })
  const reveal = Math.floor(clamp((age - 0.5) * 24, 0, m.detail.length))
  text.text(m.detail.slice(0, reveal), SCREEN_CX, 73, '#d9dcef', { size: 6.5, align: 'center' })
  text.alpha = saved
}

function drawCompleteBanner(ctx: Ctx, text: TextLayer, m: Message, age: number): void {
  const pop = age < 0.15 ? 1 + (0.15 - age) * 2 : 1
  const fade = clamp((2.4 - age) / 0.4, 0, 1)
  const style: TextStyle = { size: 8 * pop, align: 'center' }
  const w = Math.max(text.measure(m.text, style), text.measure(m.detail, { size: 6 })) + 20
  ctx.fillStyle = `rgba(6,5,24,${0.88 * fade})`
  ctx.fillRect(SCREEN_CX - w / 2, 56, w, 24)
  ctx.globalAlpha = fade
  rect(ctx, m.color, SCREEN_CX - w / 2, 56, w, 1)
  rect(ctx, m.color, SCREEN_CX - w / 2, 79, w, 1)
  ctx.globalAlpha = 1
  const saved = text.alpha
  text.alpha = saved * fade
  text.text(`✓ ${m.text}`, SCREEN_CX, 59, m.color, style)
  text.text(m.detail, SCREEN_CX, 70, '#d9dcef', { size: 6, align: 'center' })
  text.alpha = saved
}

function drawQuestCard(ctx: Ctx, text: TextLayer, m: Message, age: number): void {
  const slide = 1 - (1 - clamp(age / 0.35, 0, 1)) ** 3
  const fade = clamp((4.5 - age) / 0.5, 0, 1)
  const W = 168
  const x = SCREEN_CX - W / 2
  const y = 50 - (1 - slide) * 30
  const summary = wrapText(text, m.detail, W - 16, { size: 5.5, weight: 500 })
  const H = 22 + summary.length * 7
  ctx.fillStyle = `rgba(6,5,24,${0.88 * fade})`
  ctx.fillRect(x, y, W, H)
  ctx.globalAlpha = fade
  rect(ctx, m.color, x, y, 2, H)
  ctx.globalAlpha = 1
  const saved = text.alpha
  text.alpha = saved * fade
  text.text('NEW TASK', x + 8, y + 3, '#9aa2cf', { size: 5 })
  const reveal = Math.floor(clamp((age - 0.2) * 30, 0, m.text.length))
  text.text(m.text.slice(0, reveal), x + 8, y + 9.5, m.color, { size: 8 })
  if (age > 0.6) summary.forEach((line, i) => text.text(line, x + 8, y + 20 + i * 7, '#d9dcef', { size: 5.5, weight: 500 }))
  text.alpha = saved
}

function drawPrompt(ctx: Ctx, text: TextLayer, prompt: Prompt): void {
  const titleStyle: TextStyle = { size: 6.5, align: 'center' }
  const detailStyle: TextStyle = { size: 5.5, weight: 500, align: 'center' }
  const hasDetail = prompt.detail.length > 0
  const w = Math.max(text.measure(prompt.title, titleStyle), hasDetail ? text.measure(prompt.detail, detailStyle) : 0) + 14
  const h = hasDetail ? 19 : 11
  const y = 146 - h
  ctx.fillStyle = 'rgba(6,5,24,.85)'
  ctx.fillRect(SCREEN_CX - w / 2, y, w, h)
  rect(ctx, prompt.ok ? '#fac775' : '#5b6496', SCREEN_CX - w / 2, y, w, 1)
  text.text(prompt.title, SCREEN_CX, y + 2.5, prompt.ok ? '#fac775' : '#d9dcef', titleStyle)
  if (hasDetail) text.text(prompt.detail, SCREEN_CX, y + 11, prompt.ok ? '#d9dcef' : '#ff8a7a', detailStyle)
}

function wrapText(text: TextLayer, str: string, maxWidth: number, style: TextStyle): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && text.measure(next, style) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawMinimap(ctx: Ctx, world: World, player: Player): void {
  const MS = 46
  const MX = SCREEN_W - MS - 4
  const MY = 32
  ctx.fillStyle = PANEL
  ctx.fillRect(MX, MY, MS, MS)
  for (const [x, y, w, h] of [[MX, MY, MS, 1], [MX, MY + MS - 1, MS, 1], [MX, MY, 1, MS], [MX + MS - 1, MY, 1, MS]]) {
    rect(ctx, '#3a3f68', x, y, w, h)
  }
  const toMap = (x: number, z: number): [number, number] => [
    MX + (wrapPositive(x) / WORLD_SIZE) * MS,
    MY + MS - (wrapPositive(z) / WORLD_SIZE) * MS,
  ]
  for (const s of world.structures) {
    const [a, b] = toMap(s.x, s.z)
    rect(ctx, s.mapColor, a - 1, b - 1, 2, 2)
  }
  const [pa, pb] = toMap(player.x, player.z)
  rect(ctx, '#ffffff', pa, pb, 1, 1)
  rect(ctx, '#ffffff', pa + Math.sin(player.heading) * 3, pb - Math.cos(player.heading) * 3, 1, 1)
}
