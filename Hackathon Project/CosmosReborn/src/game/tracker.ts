import { BASE_CENTER, BASE_RADIUS, PART_ITEMS, PART_YIELD, RECIPES, UPGRADE_PARTS, costEntries, type BasePart } from './base'
import { ITEMS, type ItemId } from './items'
import { wrap } from './math'
import { ACT_TITLES, QUESTS, SHIP_SPOT, type Objective, type Quest } from './quests'
import { ANOMALIES } from './anomalies'
import { BLUEPRINTS, FOOD_STOCK_GOAL, FUEL_GOAL, rocket, rocketProgress, type Blueprint } from './rocket'
import { REGIONS, type Region } from './regions'
import { STRUCTURES } from './structures'
import type { Job } from './survivors'

export type MessageKind = 'toast' | 'complete' | 'quest' | 'act' | 'transmission'

export interface Message {
  kind: MessageKind
  text: string
  detail: string
  color: string
  born: number
  glitch?: boolean
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
/** How long each popup owns the screen. Popups queue so only one shows at a time. */
export const TOAST_LIFE = 2.6
export const TRANSMISSION_LIFE = 7
const MAX_TOAST_WAIT = 10

const SAVED_FIELDS = [
  'inventory', 'itemOrder', 'collected', 'explored', 'inspected', 'mined', 'currentRegion', 'regions', 'scans', 'anomalies',
  'signalRevealed', 'signalFound', 'talked', 'jobs', 'suppliesCollected', 'caveReached', 'defeated', 'suitSearched',
  'waveSurvived', 'cavernFound', 'shipEntered', 'searched', 'blocksPlaced', 'placed', 'recruited', 'bosses', 'equipped',
  'promised', 'blueprints', 'raids', 'repairs', 'choice', 'preflight', 'finalRaidWon', 'launched', 'truths', 'lost',
  'clues', 'completed', 'dishTuned', 'satelliteOnline', 'roverFixed',
] as const

export type CountField = 'collected' | 'placed' | 'mined' | 'defeated' | 'blocksPlaced' | 'repairs' | 'suppliesCollected'

/** Fields that belong to one player, never shared in multiplayer. */
const PERSONAL_FIELDS = new Set<string>(['inventory', 'itemOrder', 'currentRegion'])

function mergeValue(mine: unknown, theirs: unknown, authoritative: boolean): unknown {
  if (theirs === undefined) return mine
  if (mine === undefined || mine === null) return theirs
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const out = [...mine]
    const seen = new Set(mine.map((v) => JSON.stringify(v)))
    for (const v of theirs) if (!seen.has(JSON.stringify(v))) out.push(v)
    return out
  }
  if (typeof mine === 'number' && typeof theirs === 'number') return Math.max(mine, theirs)
  if (typeof mine === 'boolean' && typeof theirs === 'boolean') return mine || theirs
  if (typeof mine === 'object' && typeof theirs === 'object' && theirs !== null) {
    const out: Record<string, unknown> = { ...(mine as Record<string, unknown>) }
    for (const [k, v] of Object.entries(theirs as Record<string, unknown>)) out[k] = mergeValue(out[k], v, authoritative)
    return out
  }
  return authoritative ? (theirs ?? mine) : mine
}

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
  shipEntered = false
  searched: string[] = []
  blocksPlaced = 0
  placed: Partial<Record<ItemId, number>> = {}
  recruited: string[] = []
  bosses: string[] = []
  equipped: string[] = []
  promised = false
  blueprints: Blueprint[] = []
  raids = 0
  repairs = 0
  choice: 'everyone' | 'alone' | null = null
  preflight: string[] = []
  finalRaidWon = false
  launched = false
  truths: string[] = []
  dishTuned = false
  satelliteOnline = false
  roverFixed = false
  lost: string[] = []
  clues: string[] = []
  completed: string[] = []
  /** Multiplayer: called when a shared counter goes up, so a guest can tell the host. */
  onCount: ((field: CountField, item?: ItemId, amount?: number) => void) | null = null

  /** Host side: add a guest's contribution to a shared counter. */
  addCount(field: CountField, item?: ItemId, amount = 1): void {
    const n = Math.max(0, Math.min(500, amount))
    if (field === 'collected' && item) this.collected[item] = (this.collected[item] ?? 0) + n
    else if (field === 'placed' && item) this.placed[item] = (this.placed[item] ?? 0) + n
    else if (field === 'mined') this.mined += n
    else if (field === 'defeated') this.defeated += n
    else if (field === 'blocksPlaced') this.blocksPlaced += n
    else if (field === 'repairs') this.repairs += n
    else if (field === 'suppliesCollected') this.suppliesCollected += n
    this.check()
  }

  /** Bumped on story rewinds so multiplayer guests replace instead of merge. */
  epoch = 0
  messages: Message[] = []
  sounds: TrackerSound[] = []
  time = 0

  private mainQuests = QUESTS.filter((q) => !q.optional)
  private mainIndex = 0
  private returnedToBase = new Set<string>()
  private started = false
  private pendingSounds: { sound: TrackerSound; at: number }[] = []

  toSave(): Record<string, unknown> {
    const self = this as unknown as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of SAVED_FIELDS) out[key] = self[key]
    out.baseParts = [...this.baseParts]
    out.returnedToBase = [...this.returnedToBase]
    out.mainIndex = this.mainIndex
    return out
  }

  loadSave(data: Record<string, unknown>): void {
    const self = this as unknown as Record<string, unknown>
    for (const key of SAVED_FIELDS) if (key in data) self[key] = data[key]
    this.baseParts = new Set((data.baseParts as BasePart[]) ?? [])
    this.returnedToBase = new Set((data.returnedToBase as string[]) ?? [])
    if (this.completed.includes('act3.into-the-depths') && !this.completed.includes('act3.three-strangers')) this.completed.push('act3.three-strangers')
    const firstOpen = this.mainQuests.findIndex((q) => !this.completed.includes(q.id))
    this.mainIndex = firstOpen === -1 ? this.mainQuests.length : firstOpen
    this.started = true
    this.messages = []
    this.popupFree = 0
    this.pendingSounds = []
    const quest = this.activeQuest
    this.say('act', 'WELCOME BACK', quest ? `ACT ${roman(quest.act)} · ${quest.title.toUpperCase()}` : 'THE MOON REMEMBERS YOU', '#fac775', 0.3)
  }

  /** The story and world progress shared with other players (no inventory). */
  sharedSave(): Record<string, unknown> {
    const out = this.toSave()
    for (const key of PERSONAL_FIELDS) delete out[key]
    out.epoch = this.epoch
    return out
  }

  /**
   * Combines another player's progress with ours. Progress only grows, so lists are
   * unioned and counters take the larger value; the host's copy wins anything else.
   * New completions and quests are announced as if they happened here.
   */
  mergeShared(data: Record<string, unknown>, authoritative: boolean): void {
    const self = this as unknown as Record<string, unknown>
    const theirEpoch = (data.epoch as number) ?? 0
    if (!authoritative && theirEpoch < this.epoch) return
    const replace = authoritative && theirEpoch > this.epoch
    const doneBefore = new Set(this.completed)
    const questBefore = this.activeQuest
    for (const key of SAVED_FIELDS) {
      if (PERSONAL_FIELDS.has(key) || !(key in data)) continue
      self[key] = replace ? data[key] : mergeValue(self[key], data[key], authoritative)
    }
    if (authoritative) {
      // The host decides who is gone and what was chosen.
      this.lost = (data.lost as string[]) ?? this.lost
      this.choice = (data.choice as QuestTracker['choice']) ?? this.choice
    }
    this.recruited = this.recruited.filter((n) => !this.lost.includes(n))
    const parts = (data.baseParts as BasePart[]) ?? []
    const returned = (data.returnedToBase as string[]) ?? []
    if (replace) {
      this.baseParts = new Set(parts)
      this.returnedToBase = new Set(returned)
      this.epoch = theirEpoch
    } else {
      for (const p of parts) this.baseParts.add(p)
      for (const r of returned) this.returnedToBase.add(r)
    }
    const firstOpen = this.mainQuests.findIndex((q) => !this.completed.includes(q.id))
    this.mainIndex = firstOpen === -1 ? this.mainQuests.length : firstOpen
    if (!this.started) return
    let delay = 0
    for (const quest of QUESTS) {
      if (doneBefore.has(quest.id) || !this.completed.includes(quest.id)) continue
      this.say('complete', 'QUEST COMPLETE', quest.title.toUpperCase(), '#fac775', delay)
      this.sounds.push('complete')
      delay += 2.4
    }
    const next = this.activeQuest
    if (next && next.id !== questBefore?.id) {
      if (questBefore && next.act !== questBefore.act) {
        this.say('act', `ACT ${roman(next.act)}`, ACT_TITLES[next.act] ?? '', '#fac775', delay)
        delay += 3.1
      }
      this.announce(next, delay)
    }
    this.check()
  }

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
    if (this.anomalies.length >= 2) this.revealSignal()
  }

  revealSignal(): void {
    if (!this.signalRevealed) {
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
    if (!this.recruited.includes(name)) this.recruited.push(name)
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
    this.onCount?.('suppliesCollected')
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
      const done = current >= target && ((o.kind !== 'return-to-base' && o.kind !== 'return-to-ship') || allPreviousDone)
      allPreviousDone = allPreviousDone && done
      return { label: o.label, current: Math.min(current, target), target, done }
    })
  }

  collect(item: ItemId, amount = 1): void {
    this.add(item, amount)
    this.collected[item] = (this.collected[item] ?? 0) + amount
    this.onCount?.('collected', item, amount)
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
    this.onCount?.('mined')
    this.check()
  }

  nextPart(): BasePart | null {
    const quest = this.activeQuest
    if (!quest) return null
    const progress = this.progress(quest)
    for (let i = 0; i < quest.objectives.length; i++) {
      const o = quest.objectives[i]
      if (o.kind === 'build' && !this.baseParts.has(o.part)) return o.part
      if (o.kind !== 'build' && !progress[i].done) return null
    }
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
    if (item) this.add(item, PART_YIELD[part] ?? 1)
    this.toast(`BUILT ${RECIPES[part].name}`, '#e6e6ee')
    this.sounds.push('build')
    this.check()
    return true
  }

  enterShip(): void {
    if (this.shipEntered) return
    this.shipEntered = true
    this.say('transmission', 'INSIDE THE KESTREL', 'EMERGENCY LIGHTS. EVERY SEAT IS STRAPPED SHUT. NOBODY ELSE IS HERE.', '#ff8a7a', 0.8)
    this.check()
  }

  searchWreck(id: string, text: string, reward: Partial<Record<ItemId, number>>): void {
    if (this.searched.includes(id)) {
      this.toast('ALREADY SEARCHED. NOTHING LEFT.', '#9aa2cf')
      return
    }
    this.searched.push(id)
    this.toast(text, '#d9dcef')
    for (const [item, n] of Object.entries(reward) as [ItemId, number][]) this.collect(item, n)
    this.check()
  }

  placeKit(item: ItemId): void {
    this.placed[item] = (this.placed[item] ?? 0) + 1
    this.onCount?.('placed', item)
    this.sounds.push('build')
    this.check()
  }

  recruit(name: string, line: string): void {
    if (this.recruited.includes(name)) return
    this.recruited.push(name)
    this.toast(`${name}: "${line}"`, '#fac775')
    this.say('complete', 'NEW CIVILIAN', `${name} JOINS THE SETTLEMENT`, '#9fe1cb')
    this.sounds.push('discover')
    this.check()
  }

  bossIntro(name: string, intro: string): void {
    this.say('transmission', name, intro, '#c9a6ff', 0.6)
    this.sounds.push('clue')
  }

  promise(): void {
    if (this.promised) return
    this.promised = true
    this.say('transmission', 'MAYA', "'THEN WE BUILD IT TOGETHER. ALL OF US. YOU PROMISED.' SHE HANDS YOU A LAUNCH PAD KIT.", '#fac775', 0.4)
    this.add('launch-kit', 1)
    this.sounds.push('quest')
    this.check()
  }

  findBlueprint(id: Blueprint): void {
    if (this.blueprints.includes(id)) return
    this.blueprints.push(id)
    this.say('complete', 'BLUEPRINT FOUND', BLUEPRINTS[id].name, '#9fe1ff')
    this.sounds.push('discover')
    this.check()
  }

  sectionBuilt(): void {
    this.sounds.push('build')
    this.check()
  }

  surviveRaid(): void {
    this.raids++
    this.say('complete', 'RAID REPELLED', 'THE ROCKET STILL STANDS', '#fac775')
    this.sounds.push('complete')
    this.check()
  }

  repair(name: string): void {
    this.repairs++
    this.onCount?.('repairs')
    this.toast(`REPAIRED ${name}`, '#9fe1cb')
    this.sounds.push('build')
    this.check()
  }

  makeChoice(choice: 'everyone' | 'alone'): void {
    if (this.choice) return
    this.choice = choice
    if (choice === 'everyone') this.say('transmission', 'THE HARD CHOICE', "YOU TELL THEM: EVERYONE GOES. LENA CRIES. OKORO STARTS MEASURING SEATS. MOONLINK SAYS NOTHING, BUT THE SIGNAL CLEARS FOR A SECOND.", '#9fe1cb', 0.4)
    else this.say('transmission', 'THE HARD CHOICE', "YOU DECIDE TO LEAVE ALONE. YOU DO NOT TELL THEM. MAYA IS WATCHING YOU FROM THE DOORWAY. SHE ALREADY KNOWS.", '#ff8a7a', 0.4)
    this.sounds.push('clue')
    this.check()
  }

  passCheck(id: string, text: string): void {
    if (this.preflight.includes(id)) return
    this.preflight.push(id)
    this.toast(text, '#9fe1cb')
    this.sounds.push('select')
    this.check()
  }

  winLastStand(): void {
    if (this.finalRaidWon) return
    this.finalRaidWon = true
    this.say('complete', 'THE LAST STAND', 'THE LAUNCH SITE HOLDS', '#fac775')
    this.sounds.push('complete')
    this.check()
  }

  launch(): void {
    this.launched = true
    this.check()
  }

  findTruth(id: string, text: string): void {
    if (this.truths.includes(id)) return
    this.truths.push(id)
    this.say('transmission', 'THE TRUTH', text, '#c9a6ff', 0.3)
    this.sounds.push('clue')
    this.check()
  }

  truthCount(): number {
    return this.truths.length + (this.clues.includes('cavern-log') ? 1 : 0)
  }

  rewindToChoice(): void {
    this.epoch++
    const idx = this.mainQuests.findIndex((q) => q.id === 'act4.hard-choice')
    if (idx < 0) return
    const drop = new Set(this.mainQuests.slice(idx).map((q) => q.id))
    this.completed = this.completed.filter((id) => !drop.has(id))
    this.mainIndex = idx
    this.choice = null
    this.preflight = []
    this.finalRaidWon = false
    this.launched = false
    this.messages = []
    this.popupFree = 0
    this.pendingSounds = []
    this.say('act', 'BEFORE THE CHOICE', 'THIS TIME, THINK OF THEM', '#c9a6ff', 0.3)
    const quest = this.activeQuest
    if (quest) this.announce(quest, 3)
  }

  refreshRocket(): void {
    this.check()
  }

  equipCivilian(name: string): void {
    if (this.equipped.includes(name)) return
    this.equipped.push(name)
    this.toast(`${name} SUITS UP`, '#ff9f5a')
    this.sounds.push('build')
    this.check()
  }

  starveCivilians(names: string[]): void {
    if (names.length === 0) return
    this.lost.push(...names)
    this.recruited = this.recruited.filter((n) => !names.includes(n))
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} AND ${names[names.length - 1]}`
    this.say('transmission', 'THE SETTLEMENT', `${list} STARVED. THE FOOD BIN WAS EMPTY FOR THREE DAYS. NOBODY SAYS ANYTHING AT THE GRAVE.`, '#ff8a7a', 0.3)
    this.sounds.push('clue')
  }

  loseCivilians(names: string[]): void {
    if (names.length === 0) return
    this.lost.push(...names)
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} AND ${names[names.length - 1]}`
    this.say('transmission', 'THE SETTLEMENT', `WHILE YOU FOUGHT, MORE SUITS HIT THE HOUSES. ${list} ${names.length === 1 ? 'IS' : 'ARE'} GONE. THEY TOOK THEM, NOT KILLED THEM. THEY ONLY TOOK THE ONES WITHOUT HELMETS.`, '#ff8a7a', 2.6)
    this.pendingSounds.push({ sound: 'clue', at: this.time + 2.6 })
  }

  beatBoss(id: string, name: string, outro: string): void {
    if (this.bosses.includes(id)) return
    this.bosses.push(id)
    this.say('complete', 'GUARDIAN DEFEATED', name, '#c9a6ff')
    this.say('transmission', name, outro, '#c9a6ff', 1.2)
    this.sounds.push('complete')
    this.check()
  }

  placeBlock(): void {
    this.blocksPlaced++
    this.onCount?.('blocksPlaced')
    this.check()
  }

  refund(item: ItemId): void {
    this.add(item, 1)
  }

  aiChatter(text: string): void {
    this.say('transmission', 'MOONLINK', text, '#5dcaa5', 0, true)
  }

  enterCave(): void {
    if (this.caveReached) return
    this.caveReached = true
    this.say('transmission', 'UNDERGROUND', 'THE AIR DOWN HERE IS WARM. THERE ARE FOOTPRINTS IN THE DUST. BAREFOOT.', '#ff9f5a', 0.8)
    this.check()
  }

  defeatEnemy(): void {
    this.defeated++
    this.onCount?.('defeated')
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
    this.say('transmission', 'MOONLINK', 'ROWS OF EMPTY BEDS. EACH ONE HAS A NAME TAG. THE LAST TAG IS BLANK. IT IS THE SAME SIZE AS YOURS. THERE IS A LOG ON THE FLOOR.', '#5dcaa5', 2.5)
    this.sounds.push('discover')
    this.check()
  }

  toastMessage(text: string, color: string): void {
    this.toast(text, color)
  }

  hasItem(item: ItemId): boolean {
    return this.count(item) > 0
  }

  hasPickaxe(): boolean {
    return this.toolTier() > 0
  }

  /** 0 = bare hands, 1 = pickaxe, 2 = moon pickaxe. */
  toolTier(): 0 | 1 | 2 | 3 {
    if (this.count('titan-pickaxe') > 0) return 3
    if (this.count('moon-pickaxe') > 0) return 2
    if (this.count('pickaxe') > 0) return 1
    return 0
  }

  /** A forgeable upgrade that is not built yet, affordable, and unlocked. */
  nextUpgrade(): BasePart | null {
    for (const part of UPGRADE_PARTS) {
      if (this.baseParts.has(part) || !this.canAfford(part)) continue
      if (part === 'moonpick' && this.toolTier() === 0) continue
      return part
    }
    return null
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
      const shipIndex = quest.objectives.findIndex((o) => o.kind === 'return-to-ship')
      const atShip = Math.hypot(wrap(playerX - SHIP_SPOT.x), wrap(playerZ - SHIP_SPOT.z)) < SHIP_SPOT.radius
      if (shipIndex >= 0 && onSurface && atShip && this.progress(quest).slice(0, shipIndex).every((p) => p.done)) {
        this.returnedToBase.add(quest.id)
        this.inventory['rocket-part'] = 0
        this.say('transmission', 'MOONLINK', 'PARTS LOGGED. THE HULL IS TOO DAMAGED TO FLY. GO INSIDE. FIND METAL.', '#5dcaa5', 0.6)
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
      rocketProgress: rocketProgress(),
      enemyWavesSurvived: this.raids + (this.waveSurvived ? 1 : 0),
      act4Choice: this.choice,
    }
  }

  devCompleteActive(onBuild: (part: BasePart) => void): string | null {
    const quest = this.activeQuest
    if (!quest) return null
    for (const o of quest.objectives) this.devSatisfy(quest, o, onBuild)
    this.check()
    return quest.title
  }

  devJumpToAct(act: number, onBuild: (part: BasePart) => void): void {
    for (let guard = 0; guard < 40; guard++) {
      const quest = this.activeQuest
      if (!quest || quest.act >= act) break
      this.devCompleteActive(onBuild)
    }
    this.messages = []
    this.popupFree = 0
    this.pendingSounds = []
    const quest = this.activeQuest
    if (quest) {
      this.say('act', `ACT ${roman(quest.act)}`, ACT_TITLES[quest.act] ?? '', '#fac775', 0.2)
      this.announce(quest, 3.2)
    }
  }

  consume(item: ItemId): boolean {
    if (this.count(item) <= 0) return false
    this.inventory[item] = this.count(item) - 1
    return true
  }

  devGive(items: Partial<Record<ItemId, number>>): void {
    for (const [item, n] of Object.entries(items) as [ItemId, number][]) this.add(item, n)
  }

  devRevealAll(): void {
    for (const s of STRUCTURES) if (s.discoverable && !this.explored.includes(s.name)) this.explored.push(s.name)
    for (const r of REGIONS) if (!r.home && !this.regions.includes(r.id)) this.regions.push(r.id)
    this.signalRevealed = true
    this.check()
  }

  private devSatisfy(quest: Quest, o: Objective, onBuild: (part: BasePart) => void): void {
    const fill = (list: string[], pool: string[], count: number) => {
      for (const id of pool) if (list.length < count && !list.includes(id)) list.push(id)
      for (let i = 0; list.length < count; i++) list.push(`dev-${i}`)
    }
    switch (o.kind) {
      case 'collect': {
        const need = o.count - (this.collected[o.item] ?? 0)
        if (need > 0) {
          this.collected[o.item] = o.count
          this.add(o.item, need)
        }
        break
      }
      case 'collect-any':
        for (const item of o.items.slice(0, o.count)) {
          if ((this.collected[item] ?? 0) < 1) {
            this.collected[item] = 1
            this.add(item, 1)
          }
        }
        break
      case 'build':
        if (!this.baseParts.has(o.part)) {
          this.baseParts.add(o.part)
          const item = PART_ITEMS[o.part]
          if (item) this.add(item, PART_YIELD[o.part] ?? 1)
          onBuild(o.part)
        }
        break
      case 'mine':
        this.mined = Math.max(this.mined, o.count)
        break
      case 'discover':
        fill(this.explored, STRUCTURES.filter((s) => s.discoverable).map((s) => s.name), o.count)
        break
      case 'inspect':
        for (const name of this.explored) if (this.inspected.length < o.count && !this.inspected.includes(name)) this.inspected.push(name)
        break
      case 'return-to-base':
        this.returnedToBase.add(quest.id)
        break
      case 'clue':
        fill(this.clues, ['suit-log', 'ship-log', 'hab-log'], o.count)
        break
      case 'region':
        fill(this.regions, REGIONS.filter((r) => !r.home).map((r) => r.id), o.count)
        break
      case 'scan':
        fill(this.scans, ['0', '1', '2', '3'], o.count)
        break
      case 'anomaly':
        fill(this.anomalies, ANOMALIES.map((a) => a.id), o.count)
        this.signalRevealed = true
        break
      case 'signal':
        this.signalRevealed = true
        this.signalFound = true
        break
      case 'talk':
        fill(this.talked, ['MAYA', 'OKORO', 'LENA'], o.count)
        break
      case 'assign':
        for (const name of ['MAYA', 'OKORO', 'LENA'].slice(0, o.count)) this.jobs[name] = this.jobs[name] ?? 'GATHERER'
        break
      case 'supplies':
        this.suppliesCollected = Math.max(this.suppliesCollected, o.count)
        break
      case 'cave':
        this.caveReached = true
        break
      case 'defeat':
        this.defeated = Math.max(this.defeated, o.count)
        break
      case 'search-suit':
        this.suitSearched = true
        break
      case 'wave':
        this.waveSurvived = true
        break
      case 'cavern':
        this.cavernFound = true
        break
      case 'return-to-ship':
        this.returnedToBase.add(quest.id)
        break
      case 'ship':
        this.shipEntered = true
        break
      case 'place':
        this.placed[o.item] = Math.max(this.placed[o.item] ?? 0, o.count)
        break
      case 'civilians':
        fill(this.recruited, ['TOMAS', 'ADA', 'RIN', 'SOL', 'IVY', 'BRAM', 'NOOR', 'MAYA'], o.count)
        break
      case 'promise':
        if (!this.promised) {
          this.promised = true
          this.add('launch-kit', 1)
        }
        break
      case 'blueprints':
        for (const id of Object.keys(BLUEPRINTS) as Blueprint[]) if (!this.blueprints.includes(id)) this.blueprints.push(id)
        break
      case 'sections':
        for (const id of (o.count >= 5 ? Object.keys(BLUEPRINTS) : ['frame', 'engine']) as Blueprint[]) rocket.built.add(id)
        break
      case 'raid':
        this.raids = Math.max(this.raids, o.count)
        break
      case 'repair':
        this.repairs = Math.max(this.repairs, o.count)
        break
      case 'choice':
        this.choice = this.choice ?? 'everyone'
        break
      case 'bay':
        rocket.bay = true
        break
      case 'stock':
        rocket.food = Math.max(rocket.food, o.count)
        break
      case 'fuel':
        rocket.fuel = Math.max(rocket.fuel, o.count)
        break
      case 'preflight':
        for (const id of ['power', 'engines', 'fuel', 'passengers']) if (!this.preflight.includes(id)) this.preflight.push(id)
        break
      case 'laststand':
        this.finalRaidWon = true
        break
      case 'intact':
        this.finalRaidWon = true
        rocket.damaged.clear()
        break
      case 'launch':
        this.launched = true
        break
      case 'truth':
        for (const id of ['dish', 'core', 'extra']) if (this.truthCount() < o.count && !this.truths.includes(id)) this.truths.push(id)
        break
      case 'equip':
        fill(this.equipped, ['MAYA', 'OKORO', 'LENA'], o.count)
        break
      case 'boss':
        fill(this.bosses, ANOMALIES.map((a) => a.id), o.count)
        this.signalRevealed = this.signalRevealed || this.bosses.length >= 2
        break
      case 'blocks':
        this.blocksPlaced = Math.max(this.blocksPlaced, o.count)
        break
      case 'search':
        fill(this.searched, ['LOCKER A', 'LOCKER B', 'LOCKER C'], o.count)
        break
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
      case 'return-to-ship':
        return [this.returnedToBase.has(quest.id) ? 1 : 0, 1]
      case 'ship':
        return [this.shipEntered ? 1 : 0, 1]
      case 'search':
        return [this.searched.length, o.count]
      case 'blocks':
        return [this.blocksPlaced, o.count]
      case 'place':
        return [this.placed[o.item] ?? 0, o.count]
      case 'civilians':
        return [this.recruited.length, o.count]
      case 'boss':
        return [this.bosses.length, o.count]
      case 'equip':
        return [this.equipped.length, o.count]
      case 'promise':
        return [this.promised ? 1 : 0, 1]
      case 'blueprints':
        return [this.blueprints.length, o.count]
      case 'sections':
        return [rocket.built.size, o.count]
      case 'raid':
        return [this.raids, o.count]
      case 'repair':
        return [this.repairs, o.count]
      case 'choice':
        return [this.choice ? 1 : 0, 1]
      case 'bay':
        return [rocket.bay ? 1 : 0, 1]
      case 'stock':
        return [Math.min(rocket.food, FOOD_STOCK_GOAL), o.count]
      case 'fuel':
        return [Math.min(rocket.fuel, FUEL_GOAL), o.count]
      case 'preflight':
        return [this.preflight.length, o.count]
      case 'laststand':
        return [this.finalRaidWon ? 1 : 0, 1]
      case 'intact':
        return [this.finalRaidWon && rocket.damaged.size === 0 ? 1 : 0, 1]
      case 'launch':
        return [this.launched ? 1 : 0, 1]
      case 'truth':
        return [this.truthCount(), o.count]
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

  private popupFree = 0

  private say(kind: MessageKind, text: string, detail: string, color: string, delay = 0, glitch?: boolean): void {
    let born = this.time + delay
    if (kind === 'toast' || kind === 'transmission') {
      if (kind === 'toast' && this.messages.some((m) => m.kind === 'toast' && m.born > this.time && m.text === text)) return
      born = Math.max(born, this.popupFree)
      if (kind === 'toast' && born - this.time > MAX_TOAST_WAIT) return
      this.popupFree = born + (kind === 'toast' ? TOAST_LIFE : TRANSMISSION_LIFE)
    }
    this.messages.push({ kind, text, detail, color, born, ...(glitch ? { glitch } : {}) })
  }
}

export function roman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n)
}
