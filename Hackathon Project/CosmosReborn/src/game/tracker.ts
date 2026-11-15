import { BASE_CENTER, BASE_RADIUS, PART_ITEMS, RECIPES, costEntries, type BasePart } from './base'
import { ITEMS, type ItemId } from './items'
import { wrap } from './math'
import { ACT_TITLES, QUESTS, type Objective, type Quest } from './quests'
import type { Region } from './regions'
import type { Job } from './survivors'

export type MessageKind = 'toast' | 'complete' | 'quest' | 'act' | 'transmission'

export interface Message {
  kind: MessageKind
  text: string
  detail: string
  color: string
  born: number
}

export interface ObjectiveProgress {
  label: string
  current: number
  target: number
  done: boolean
}

export interface QuestSnapshot {
  id: string
  act: number
  title: string
  summary: string
  hint: string
  objectives: ObjectiveProgress[]
}

export interface TrackerSnapshot {
  act: number
  activeQuest: QuestSnapshot | null
  optionalQuests: QuestSnapshot[]
  completedQuests: string[]
  inventory: Partial<Record<ItemId, number>>
  exploredLocations: string[]
  inspectedLocations: string[]
  bouldersMined: number
  currentRegion: string
  regionsDiscovered: string[]
  anomaliesInvestigated: string[]
  signalRevealed: boolean
  signalFound: boolean
  survivorsMet: string[]
  survivorJobs: Record<string, Job>
  settlementSuppliesCollected: number
  caveReached: boolean
  suitsDefeated: number
  suitSearched: boolean
  waveSurvived: boolean
  hiddenCavernFound: boolean
  basePartsBuilt: BasePart[]
  cluesFound: string[]
  creatureScans: string[]
  rocketProgress: number
  enemyWavesSurvived: number
  act4Choice: 'everyone' | 'alone' | null
}

export type TrackerSound = 'pickup' | 'build' | 'complete' | 'quest' | 'clue' | 'discover' | 'inspect' | 'select'

const MESSAGE_LIFETIME = 7

export class QuestTracker {
  inventory: Partial<Record<ItemId, number>> = {}
  itemOrder: ItemId[] = []
  collected: Partial<Record<ItemId, number>> = {}
  baseParts = new Set<BasePart>()
  explored: string[] = []
  inspected: string[] = []
  mined = 0
  currentRegion = 'CRASH SITE'
  regions: string[] = []
  scans: string[] = []
  anomalies: string[] = []
  signalRevealed = false
  signalFound = false
  talked: string[] = []
  jobs: Record<string, Job> = {}
  suppliesCollected = 0
  caveReached = false
  defeated = 0
  suitSearched = false
  waveSurvived = false
  cavernFound = false
  clues: string[] = []
  completed: string[] = []
  messages: Message[] = []
  sounds: TrackerSound[] = []
  time = 0

  private mainQuests = QUESTS.filter((q) => !q.optional)
  private mainIndex = 0
  private returnedToBase = new Set<string>()
  private started = false
  private pendingSounds: { sound: TrackerSound; at: number }[] = []

  get activeQuest(): Quest | null {
    return this.mainQuests[this.mainIndex] ?? null
  }

  get act(): number {
    return this.activeQuest?.act ?? this.lastCompletedAct
  }

  get openOptionalQuests(): Quest[] {
    return QUESTS.filter((q) => q.optional && q.act <= this.act && !this.completed.includes(q.id))
  }

  get lastCompletedAct(): number {
    return QUESTS.filter((q) => !q.optional && this.completed.includes(q.id)).reduce((a, q) => Math.max(a, q.act), 0)
  }

  enterRegion(region: Region): void {
    if (region.name !== this.currentRegion) {
      this.currentRegion = region.name
      if (region.home || this.regions.includes(region.id)) this.toast(`ENTERING: ${region.name}`, region.color)
    }
    if (region.home || this.regions.includes(region.id)) return
    this.regions.push(region.id)
    this.say('complete', 'NEW REGION', region.name, region.color)
    this.sounds.push('discover')
    this.check()
  }

  scanCreature(id: string, note: string): void {
    if (this.scans.includes(id)) return
    this.scans.push(id)
    this.toast(note, '#9fe1cb')
    this.collect('bio-sample', 1)
  }

  investigateAnomaly(id: string, text: string): void {
    if (this.anomalies.includes(id)) return
    this.anomalies.push(id)
    this.toast(text, '#c9a6ff')
    this.collect('anomaly-shard', 2)
    if (this.anomalies.length >= 2 && !this.signalRevealed) {
      this.signalRevealed = true
      this.say('transmission', 'STRANGE SIGNAL DETECTED', 'THE SHARDS ARE RESONATING. SOURCE: BELOW THE SURFACE. FOLLOW THE PURPLE MARKER.', '#c9a6ff', 1.5)
      this.pendingSounds.push({ sound: 'clue', at: this.time + 1.5 })
    }
  }

  findSignal(): void {
    if (!this.signalRevealed || this.signalFound) return
    this.signalFound = true
    this.say('transmission', 'SIGNAL SOURCE FOUND', 'A SEALED HATCH. THE KNOCKING FROM BELOW MATCHES YOUR HEARTBEAT.', '#c9a6ff')
    this.sounds.push('clue')
    this.check()
  }

  talkTo(name: string, line: string): void {
    if (!this.talked.includes(name)) this.talked.push(name)
    this.toast(`${name}: "${line}"`, '#fac775')
    this.sounds.push('inspect')
    this.check()
  }

  assignJob(name: string, job: Job): void {
    this.jobs[name] = job
    this.toast(`${name} IS NOW A ${job}`, '#e6e6ee')
    this.sounds.push('select')
    this.check()
  }

  collectSupplies(items: Partial<Record<ItemId, number>>): void {
    for (const [item, n] of Object.entries(items) as [ItemId, number][]) if (n > 0) this.collect(item, n)
    this.suppliesCollected++
    this.check()
  }

  start(): void {
    if (this.started) return
    this.started = true
    const quest = this.activeQuest
    if (!quest) return
    this.say('act', `ACT ${roman(quest.act)}`, ACT_TITLES[quest.act] ?? '', '#fac775', 0.3)
    this.announce(quest, 3.4)
  }

  count(item: ItemId): number {
    return this.inventory[item] ?? 0
  }

  progress(quest: Quest): ObjectiveProgress[] {
    let allPreviousDone = true
    return quest.objectives.map((o) => {
      const [current, target] = this.measure(quest, o)
      const done = current >= target && (o.kind !== 'return-to-base' || allPreviousDone)
      allPreviousDone = allPreviousDone && done
      return { label: o.label, current: Math.min(current, target), target, done }
    })
  }

  collect(item: ItemId, amount = 1): void {
    this.add(item, amount)
    this.collected[item] = (this.collected[item] ?? 0) + amount
    this.toast(`+${amount} ${ITEMS[item].name}`, ITEMS[item].color)
    this.sounds.push('pickup')
    this.check()
  }

  findClue(id: string, text: string): void {
    if (this.clues.includes(id)) return
    this.clues.push(id)
    this.add('data-log', 1)
    this.toast(text, '#5dcaa5')
    this.sounds.push('clue')
    this.check()
  }

  discover(name: string): void {
    if (this.explored.includes(name)) return
    this.explored.push(name)
    this.toast(`MAPPED: ${name}`, '#9fe1cb')
    this.sounds.push('discover')
    this.check()
  }

  inspect(name: string, text: string, reward?: { item: ItemId; count: number }): void {
    const first = !this.inspected.includes(name)
    if (first) this.inspected.push(name)
    this.toast(`${name}: ${text}`, '#d9dcef')
    if (first && reward) this.collect(reward.item, reward.count)
    this.check()
  }

  mineBoulder(): void {
    this.mined++
    this.check()
  }

  nextPart(): BasePart | null {
    const quest = this.activeQuest
    if (!quest) return null
    for (const o of quest.objectives) if (o.kind === 'build' && !this.baseParts.has(o.part)) return o.part
    return null
  }

  canAfford(part: BasePart): boolean {
    return costEntries(RECIPES[part]).every(([item, n]) => this.count(item) >= n)
  }

  build(part: BasePart): boolean {
    if (this.baseParts.has(part) || !this.canAfford(part)) return false
    for (const [item, n] of costEntries(RECIPES[part])) this.inventory[item] = this.count(item) - n
    this.baseParts.add(part)
    const item = PART_ITEMS[part]
    if (item) this.add(item, 1)
    this.toast(`BUILT ${RECIPES[part].name}`, '#e6e6ee')
    this.sounds.push('build')
    this.check()
    return true
  }

  enterCave(): void {
    if (this.caveReached) return
    this.caveReached = true
    this.say('transmission', 'UNDERGROUND', 'THE AIR DOWN HERE IS WARM. THERE ARE FOOTPRINTS IN THE DUST. BAREFOOT.', '#ff9f5a', 0.8)
    this.check()
  }

  defeatEnemy(): void {
    this.defeated++
    this.check()
  }

  searchSuit(text: string): void {
    this.toast(text, '#ff8a7a')
    this.sounds.push('clue')
    if (!this.suitSearched) {
      this.suitSearched = true
      this.collect('metal-scrap', 2)
    }
    this.check()
  }

  surviveWave(): void {
    if (this.waveSurvived) return
    this.waveSurvived = true
    this.say('transmission', 'THE SETTLEMENT HOLDS', "LENA: 'THEY HAD OUR FACES. HOW DID THEY HAVE OUR FACES?'", '#c9a6ff', 1)
    this.check()
  }

  findCavern(): void {
    if (this.cavernFound) return
    this.cavernFound = true
    this.say('complete', 'HIDDEN CAVERN', 'A GLOWING CHAMBER', '#ff9f5a')
    this.sounds.push('discover')
    this.check()
  }

  toastMessage(text: string, color: string): void {
    this.toast(text, color)
  }

  hasItem(item: ItemId): boolean {
    return this.count(item) > 0
  }

  hasTools(): boolean {
    return this.count('basic-tools') > 0
  }

  tick(dt: number, playerX: number, playerZ: number, onSurface = true): void {
    this.time += dt
    const quest = this.activeQuest
    if (quest && !this.returnedToBase.has(quest.id)) {
      const index = quest.objectives.findIndex((o) => o.kind === 'return-to-base')
      const atBase = Math.hypot(wrap(playerX - BASE_CENTER.x), wrap(playerZ - BASE_CENTER.z)) < BASE_RADIUS
      if (index >= 0 && onSurface && atBase && this.progress(quest).slice(0, index).every((p) => p.done)) {
        this.returnedToBase.add(quest.id)
        this.check()
      }
    }
    this.messages = this.messages.filter((m) => this.time - m.born < MESSAGE_LIFETIME)
    const due = this.pendingSounds.filter((p) => p.at <= this.time)
    if (due.length) {
      this.sounds.push(...due.map((p) => p.sound))
      this.pendingSounds = this.pendingSounds.filter((p) => p.at > this.time)
    }
  }

  snapshot(): TrackerSnapshot {
    const describe = (q: Quest): QuestSnapshot => ({
      id: q.id,
      act: q.act,
      title: q.title,
      summary: q.summary,
      hint: q.hint,
      objectives: this.progress(q),
    })
    const quest = this.activeQuest
    return {
      act: this.act,
      activeQuest: quest ? describe(quest) : null,
      optionalQuests: this.openOptionalQuests.map(describe),
      completedQuests: [...this.completed],
      inventory: Object.fromEntries(Object.entries(this.inventory).filter(([, n]) => n > 0)),
      exploredLocations: [...this.explored],
      inspectedLocations: [...this.inspected],
      bouldersMined: this.mined,
      currentRegion: this.currentRegion,
      regionsDiscovered: [...this.regions],
      anomaliesInvestigated: [...this.anomalies],
      signalRevealed: this.signalRevealed,
      signalFound: this.signalFound,
      survivorsMet: [...this.talked],
      survivorJobs: { ...this.jobs },
      settlementSuppliesCollected: this.suppliesCollected,
      caveReached: this.caveReached,
      suitsDefeated: this.defeated,
      suitSearched: this.suitSearched,
      waveSurvived: this.waveSurvived,
      hiddenCavernFound: this.cavernFound,
      basePartsBuilt: [...this.baseParts],
      cluesFound: [...this.clues],
      creatureScans: [...this.scans],
      rocketProgress: 0,
      enemyWavesSurvived: 0,
      act4Choice: null,
    }
  }

  private add(item: ItemId, amount: number): void {
    this.inventory[item] = this.count(item) + amount
    if (!this.itemOrder.includes(item)) this.itemOrder.push(item)
  }

  private measure(quest: Quest, o: Objective): [number, number] {
    switch (o.kind) {
      case 'collect':
        return [this.collected[o.item] ?? 0, o.count]
      case 'collect-any':
        return [o.items.reduce((sum, item) => sum + (this.collected[item] ?? 0), 0), o.count]
      case 'build':
        return [this.baseParts.has(o.part) ? 1 : 0, 1]
      case 'mine':
        return [this.mined, o.count]
      case 'discover':
        return [this.explored.length, o.count]
      case 'inspect':
        return [this.inspected.filter((n) => this.explored.includes(n)).length, o.count]
      case 'return-to-base':
        return [this.returnedToBase.has(quest.id) ? 1 : 0, 1]
      case 'clue':
        return [this.clues.length, o.count]
      case 'region':
        return [this.regions.length, o.count]
      case 'scan':
        return [this.scans.length, o.count]
      case 'anomaly':
        return [this.anomalies.length, o.count]
      case 'signal':
        return [this.signalFound ? 1 : 0, 1]
      case 'talk':
        return [this.talked.length, o.count]
      case 'assign':
        return [Object.keys(this.jobs).length, o.count]
      case 'supplies':
        return [this.suppliesCollected, o.count]
      case 'cave':
        return [this.caveReached ? 1 : 0, 1]
      case 'defeat':
        return [this.defeated, o.count]
      case 'search-suit':
        return [this.suitSearched ? 1 : 0, 1]
      case 'wave':
        return [this.waveSurvived ? 1 : 0, 1]
      case 'cavern':
        return [this.cavernFound ? 1 : 0, 1]
    }
  }

  private check(): void {
    for (let quest = this.activeQuest; quest && this.progress(quest).every((p) => p.done); quest = this.activeQuest) {
      this.completed.push(quest.id)
      this.say('complete', 'QUEST COMPLETE', quest.title.toUpperCase(), '#fac775')
      this.sounds.push('complete')
      this.mainIndex++
      const next = this.activeQuest
      if (!next) {
        this.say('act', `ACT ${roman(quest.act)} COMPLETE`, 'TO BE CONTINUED...', '#fac775', 2.4)
      } else if (next.act !== quest.act) {
        this.say('act', `ACT ${roman(next.act)}`, ACT_TITLES[next.act] ?? '', '#fac775', 2.4)
        this.announce(next, 5.5)
      } else {
        this.announce(next, 2.4)
      }
    }
    for (const quest of this.openOptionalQuests) {
      if (this.progress(quest).every((p) => p.done)) {
        this.completed.push(quest.id)
        this.say('complete', 'SIDE QUEST COMPLETE', quest.title.toUpperCase(), '#9fe1cb')
        this.sounds.push('complete')
      }
    }
  }

  private announce(quest: Quest, delay: number): void {
    this.say('quest', quest.title.toUpperCase(), quest.summary, '#fac775', delay)
    this.pendingSounds.push({ sound: 'quest', at: this.time + delay })
    if (quest.transmission) {
      this.say('transmission', 'INCOMING TRANSMISSION', quest.transmission, '#c9a6ff', delay + 4.6)
      this.pendingSounds.push({ sound: 'clue', at: this.time + delay + 4.6 })
    }
  }

  private toast(text: string, color: string): void {
    this.say('toast', text, '', color)
  }

  private say(kind: MessageKind, text: string, detail: string, color: string, delay = 0): void {
    this.messages.push({ kind, text, detail, color, born: this.time + delay })
  }
}

export function roman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n)
}
