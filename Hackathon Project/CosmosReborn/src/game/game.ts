import { ANOMALIES, ANOMALY_RANGE, HATCH, HATCH_RANGE, drawAnomaly, type Anomaly } from './anomalies'
import { setAssistantContext } from './assistant'
import { GameAudio, type SoundName } from './audio'
import { BASE_CENTER, BASE_HALF, BASE_RADIUS, PART_STRUCTURES, RECIPES, costEntries, type BasePart } from './base'
import { Camera, horizonY, ring, type CamPos, type ScreenPoint } from './camera'
import { CAVERN, CAVERN_RANGE, CAVE_GROUND, CAVE_SPAWN, LADDER, createCaveWorld, drawCaveCeiling, drawDarkness } from './cave'
import {
  ARMOR_REDUCTION,
  BLASTER_COOLDOWN,
  ENEMY_DAMAGE,
  PLAYER_MAX_HP,
  SEARCH_RANGE,
  TURRET_COOLDOWN,
  TURRET_RANGE,
  drawEnemy,
  drawWreck,
  pickTarget,
  shoot,
  spawnEnemy,
  updateEnemies,
  updateProjectiles,
  type Enemy,
  type Projectile,
  type Wreck,
} from './combat'
import { HORIZON_D, SCREEN_H, SCREEN_W, SHOW_MINIMAP } from './constants'
import { drawCrater } from './crater'
import { SCAN_RANGE, createCreatures, drawCreature, speciesNote, updateCreatures, type Creature } from './creatures'
import { Cutscene } from './cutscene'
import { Hotbar, HOTBAR_SLOTS, type HotbarItem } from './hotbar'
import { drawHud, type Prompt } from './hud'
import { Input } from './input'
import { InventoryScreen } from './inventory'
import { ITEMS, type ItemId } from './items'
import { createRng, wrap, type CamPt } from './math'
import { box, ModelRenderer } from './model3d'
import { PICKUP_RADIUS, drawPickup, type Pickup } from './pickups'
import { fillPolygon, rect, type Ctx } from './pixel'
import { NO_CONTROLS, Player } from './player'
import { REGIONS, regionAt } from './regions'
import { Sky } from './sky'
import { INSPECTIONS, STRUCTURES, drawStructure, type Structure } from './structures'
import { Tablet, type ScreenRect, type TabletView } from './tablet'
import {
  JOB_OUTPUT,
  PRODUCTION_INTERVAL,
  TALK_RANGE,
  createSurvivors,
  drawSurvivor,
  nextJob,
  updateSurvivors,
  type Survivor,
} from './survivors'
import { TextLayer } from './text'
import { QuestTracker, type TrackerSnapshot } from './tracker'
import { craterAt, createWorld, groundHeightAt, type Boulder, type Crater } from './world'

type Decal =
  | { kind: 'crater'; crater: Crater; pos: CamPos; depth: number }
  | { kind: 'pebble'; p: ScreenPoint; depth: number }
  | { kind: 'shadow'; pos: CamPos; radius: number; depth: number }
  | { kind: 'pad'; depth: number }

type Upright =
  | { kind: 'boulder'; boulder: Boulder; p: ScreenPoint }
  | { kind: 'structure'; structure: Structure; p: ScreenPoint }
  | { kind: 'pickup'; pickup: Pickup; p: ScreenPoint }
  | { kind: 'player'; p: ScreenPoint; pos: CamPos }
  | { kind: 'creature'; creature: Creature; p: ScreenPoint }
  | { kind: 'anomaly'; anomaly: Anomaly; p: ScreenPoint }
  | { kind: 'survivor'; survivor: Survivor; p: ScreenPoint }
  | { kind: 'enemy'; enemy: Enemy; p: ScreenPoint }
  | { kind: 'wreck'; wreck: Wreck; p: ScreenPoint }

interface Interaction extends Prompt {
  run?: () => void
}

interface Particle {
  x: number
  z: number
  y: number
  vx: number
  vz: number
  vy: number
  life: number
  color: string
}

export interface DevLocation {
  id: string
  label: string
  group: string
  scene: 'surface' | 'cave'
  x: number
  z: number
  face: number
}

export interface DevStatus {
  fps: number
  scene: string
  x: number
  z: number
  y: number
  heading: number
  region: string
  quest: string
  act: number
  hp: number
  enemies: number
  god: boolean
  speed: number
  minimap: boolean
}

export interface NearbyResource {
  item: ItemId
  distance: number
  direction: 'ahead' | 'to the right' | 'behind' | 'to the left'
}

interface Bearing {
  distance: number
  direction: NearbyResource['direction']
}

export interface GameStateForAI extends TrackerSnapshot {
  player: { x: number; z: number; headingDegrees: number; inCrater: boolean; atBase: boolean }
  nearestNeededResources: NearbyResource[]
  signalSource: Bearing | null
  nearestUnscannedCreature: Bearing | null
  nearestUninvestigatedAnomaly: Bearing | null
  nearestBoulder: (Bearing & { x: number; z: number }) | null
}

const INSPECT_RANGE = 5
const MINE_RANGE = 2.2
const SUIT_CLUES = [
  "THE NAME TAG IS SCRATCHED OUT. UNDERNEATH, IN YOUR OWN HANDWRITING: 'DON'T LET THEM TAKE YOU BACK.'",
  'THE SUIT IS EMPTY. NO BODY, NO BLOOD. JUST MOON DUST, SHAPED LIKE A PERSON.',
  'A MISSION PATCH WITH YOUR CREW LOGO. THE DATE ON IT IS FROM TOMORROW.',
  "THE HELMET RADIO IS STILL ON. A VOICE REPEATS: 'RETRIEVE THE ADAPTED. RETRIEVE THE ADAPTED.'",
]
const MAX_STORED_SUPPLIES = 20

export class Game {
  private ctx: Ctx
  private text: TextLayer
  private surface = createWorld()
  private caveWorld = createCaveWorld()
  private scene: 'surface' | 'cave' = 'surface'
  private enemies: Enemy[] = []
  private projectiles: Projectile[] = []
  private wrecks: Wreck[] = []
  private hp = PLAYER_MAX_HP
  private fireCooldown = 0
  private turretCooldown = 0
  private hurtFlash = 0
  private sinceHurt = 10
  private deadTimer = 0
  private mouseFire = false
  private firstAttackSpawned = false
  private wave = { started: false, active: false, integrity: 100, restartTimer: 0 }
  private fade = 0
  private glows: { x: number; y: number; color: string }[] = []
  private devGod = false
  private showMinimap = SHOW_MINIMAP
  private aiScreenKey = ''
  private aiListeners = new Set<(rect: ScreenRect | null) => void>()
  private fps = 60
  private sky = new Sky()
  private camera = new Camera()
  private player = new Player()
  private tablet = new Tablet()
  private input = new Input()
  private tracker = new QuestTracker()
  private hotbar = new Hotbar()
  private audio = new GameAudio()
  private cutscene = new Cutscene()
  private inventory = new InventoryScreen()
  private model = new ModelRenderer(this.camera)
  private canvas: HTMLCanvasElement
  private particles: Particle[] = []
  private creatures = createCreatures(createRng(5))
  private survivors: Survivor[] = []
  private productionTimer = 0
  private playStarted = false
  private pendingSupplies: Partial<Record<ItemId, number>> = {}
  private labels: { x: number; y: number; name: string; job: string }[] = []
  private interaction: Interaction | null = null
  private interactQueued = false
  private time = 0
  private last = 0
  private raf = 0

  constructor(canvas: HTMLCanvasElement, textCanvas: HTMLCanvasElement) {
    canvas.width = SCREEN_W
    canvas.height = SCREEN_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas is not supported')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.canvas = canvas
    this.text = new TextLayer(textCanvas)

    this.input.onAnyInput = () => this.audio.unlock()
    this.input.onKeyPress = (code) => this.handleMenuKey(code)
    this.input.onTablet = () => {
      if (!this.playing || this.inventory.open) return
      this.tablet.toggle()
      this.sound(this.tablet.open ? 'tabletOpen' : 'tabletClose')
    }
    this.input.onEscape = () => {
      if (!this.cutscene.done) this.cutscene.skip()
      else if (this.tablet.open) {
        this.tablet.close()
        this.sound('tabletClose')
      }
    }
    this.input.onInteract = () => {
      if (this.cutscene.done) this.interactQueued = true
    }
    this.input.onSlot = (i) => {
      this.hotbar.select(i, this.time)
      this.sound('select')
    }
    this.input.onScroll = (d) => {
      if (!this.playing || this.tablet.visible || this.inventory.visible) return
      this.hotbar.select(this.hotbar.selected + d, this.time)
      this.sound('select')
    }
    this.input.onMute = () => this.audio.toggleMute()
    window.addEventListener('keydown', this.skipCutscene)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerdown', this.handlePointerDown)

    this.camera.follow(this.player.x, this.player.z, this.player.heading, 1)
    if (import.meta.env.DEV) Object.assign(window, { cosmos: { state: () => this.stateForAI() } })
    setAssistantContext(() => this.assistantContext())
  }

  start(): void {
    this.input.attach()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.input.detach()
    this.audio.close()
    setAssistantContext(null)
    window.removeEventListener('keydown', this.skipCutscene)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
  }

  private toGame(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * SCREEN_W, ((e.clientY - r.top) / r.height) * SCREEN_H]
  }

  private handlePointerMove = (e: PointerEvent) => {
    const [x, y] = this.toGame(e)
    this.inventory.pointer(x, y)
  }

  private get world() {
    return this.scene === 'cave' ? this.caveWorld : this.surface
  }

  private get onSurface(): boolean {
    return this.scene === 'surface'
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (this.playing && !this.tablet.visible && !this.inventory.visible) this.mouseFire = true
    const [x, y] = this.toGame(e)
    if (this.tablet.open && this.tablet.click(x, y)) this.sound('select')
  }

  private handleMenuKey(code: string): boolean {
    if (!this.playing) return false
    if (code === 'KeyF' && !this.tablet.open) {
      this.inventory.toggle()
      this.sound(this.inventory.open ? 'tabletOpen' : 'tabletClose')
      return true
    }
    if (this.inventory.open && code === 'Escape') {
      this.inventory.close()
      this.sound('tabletClose')
      return true
    }
    if (this.tablet.open && this.tablet.handleKey(code)) {
      this.sound('select')
      return true
    }
    return false
  }

  private tabletView(): TabletView {
    return { world: this.surface, playerX: this.player.x, playerZ: this.player.z, heading: this.player.heading, tracker: this.tracker, underground: !this.onSurface }
  }

  devLocations(): DevLocation[] {
    const locs: DevLocation[] = [
      { id: 'spawn', label: 'Crash site (spawn)', group: 'Surface', scene: 'surface', x: 0, z: 0, face: 0 },
      { id: 'base', label: 'Base site', group: 'Surface', scene: 'surface', x: BASE_CENTER.x - 4, z: BASE_CENTER.z - 14, face: 0 },
    ]
    for (const st of STRUCTURES) {
      locs.push({ id: `structure-${st.name}`, label: st.name, group: 'Structures', scene: 'surface', x: st.x, z: st.z - st.radius - 8, face: 0 })
    }
    for (const r of REGIONS) {
      locs.push({ id: `region-${r.id}`, label: r.name, group: 'Regions', scene: 'surface', x: r.x + 18, z: r.z + 18, face: Math.PI })
    }
    for (const a of ANOMALIES) {
      locs.push({ id: `anomaly-${a.id}`, label: `Anomaly: ${a.id}`, group: 'Act II', scene: 'surface', x: a.x, z: a.z - 9, face: 0 })
    }
    const drifter = this.creatures.find((c) => !c.scanned) ?? this.creatures[0]
    if (drifter) locs.push({ id: 'drifter', label: 'Nearest unscanned drifter', group: 'Act II', scene: 'surface', x: drifter.x, z: drifter.z - 8, face: 0 })
    locs.push({ id: 'cave-spawn', label: 'Cave entrance', group: 'Cave', scene: 'cave', x: CAVE_SPAWN.x, z: CAVE_SPAWN.z, face: Math.PI })
    locs.push({ id: 'cave-ladder', label: 'Cave ladder', group: 'Cave', scene: 'cave', x: LADDER.x - 6, z: LADDER.z, face: Math.PI / 2 })
    locs.push({ id: 'cave-cavern', label: 'Hidden cavern', group: 'Cave', scene: 'cave', x: CAVERN.x - 12, z: CAVERN.z, face: Math.PI / 2 })
    const ore = this.caveWorld.pickups.find((p) => !p.collected)
    if (ore) locs.push({ id: 'cave-ore', label: 'Nearest glowing ore', group: 'Cave', scene: 'cave', x: ore.x - 3, z: ore.z, face: Math.PI / 2 })
    return locs
  }

  devTeleport(id: string): void {
    const loc = this.devLocations().find((l) => l.id === id)
    if (!loc) return
    this.cutscene.skip()
    this.scene = loc.scene
    if (loc.scene === 'cave') this.tracker.currentRegion = 'UNDERGROUND'
    this.placePlayer(loc.x, loc.z, loc.face)
    this.projectiles = []
    this.fade = 0.6
  }

  devCompleteQuest(): string | null {
    this.cutscene.skip()
    return this.tracker.devCompleteActive((part) => this.devAddPart(part))
  }

  devJumpToAct(act: number): void {
    this.cutscene.skip()
    this.tracker.devJumpToAct(act, (part) => this.devAddPart(part))
  }

  devGiveResources(): void {
    this.tracker.devGive({ 'moon-rock': 30, 'metal-scrap': 30, 'power-cell': 3, 'anomaly-shard': 10, 'bio-sample': 5, 'rare-ore': 15 })
  }

  devGiveGear(): void {
    const missing = (['pickaxe', 'power-drill', 'armor-plating', 'blaster'] as ItemId[]).filter((i) => !this.tracker.hasItem(i))
    this.tracker.devGive(Object.fromEntries(missing.map((i) => [i, 1])))
  }

  devHeal(): void {
    this.hp = PLAYER_MAX_HP
    this.deadTimer = 0
  }

  devToggleGod(): boolean {
    this.devGod = !this.devGod
    return this.devGod
  }

  devSpawnSuits(count = 3): string {
    if (!this.onSurface) return 'surface only, teleport up first'
    const P = this.player
    for (let i = 0; i < count; i++) {
      const a = P.heading + (i - (count - 1) / 2) * 0.5
      this.enemies.push(spawnEnemy(P.x + Math.sin(a) * 35, P.z + Math.cos(a) * 35))
    }
    return `${count} suits ahead of you`
  }

  devStartWave(): string {
    this.startWave()
    return this.onSurface ? 'suits marching on the base' : 'started on the surface (you are underground)'
  }

  devClearEnemies(): void {
    this.enemies = []
    this.projectiles = []
    this.wave.active = false
    this.wave.restartTimer = 0
  }

  devKillPlayer(): void {
    this.devGod = false
    this.damagePlayer(9999)
  }

  devSetSpeed(mult: number): void {
    this.player.speedMult = mult
  }

  devToggleMinimap(): boolean {
    this.showMinimap = !this.showMinimap
    return this.showMinimap
  }

  tabletHome(): void {
    this.tablet.back()
  }

  /** Listens for the tablet's A.I. app opening/closing; emits its screen rect in game pixels. */
  subscribeAssistantScreen(listener: (rect: ScreenRect | null) => void): () => void {
    this.aiListeners.add(listener)
    listener(this.tablet.aiScreenRect())
    return () => {
      this.aiListeners.delete(listener)
    }
  }

  private syncAssistantScreen(): void {
    const rect = this.tablet.aiScreenRect()
    const key = rect ? `${rect.x}:${rect.y}:${rect.w}:${rect.h}` : ''
    if (key === this.aiScreenKey) return
    this.aiScreenKey = key
    for (const listener of this.aiListeners) listener(rect)
  }

  devRevealAll(): void {
    this.tracker.devRevealAll()
  }

  devSkipCutscene(): void {
    this.cutscene.skip()
  }

  devStatus(): DevStatus {
    const P = this.player
    return {
      fps: Math.round(this.fps),
      scene: this.scene,
      x: Math.round(P.x),
      z: Math.round(P.z),
      y: +P.y.toFixed(1),
      heading: Math.round((((P.heading * 180) / Math.PI) % 360 + 360) % 360),
      region: this.tracker.currentRegion,
      quest: this.tracker.activeQuest?.title ?? 'none',
      act: this.tracker.act,
      hp: Math.round(this.hp),
      enemies: this.enemies.length,
      god: this.devGod,
      speed: P.speedMult,
      minimap: this.showMinimap,
    }
  }

  private devAddPart(part: BasePart): void {
    const structure = PART_STRUCTURES[part]
    if (structure && !this.surface.structures.includes(structure)) this.surface.structures.push(structure)
  }

  assistantContext(): string {
    const s = this.stateForAI()
    const parts: string[] = []
    const q = s.activeQuest
    if (q) {
      const steps = q.objectives.map((o) => `${o.label} ${o.done ? 'DONE' : o.target > 1 ? `${o.current}/${o.target}` : 'not done'}`).join('; ')
      parts.push(`Act ${q.act}, quest "${q.title}": ${q.summary} Progress: ${steps}. Hint: ${q.hint}`)
    } else {
      parts.push('All available quests are complete; more acts are coming.')
    }
    for (const o of s.optionalQuests) {
      const p = o.objectives[0]
      parts.push(`Side quest "${o.title}" ${p.current}/${p.target}`)
    }
    const inv = Object.entries(s.inventory).map(([id, n]) => `${ITEMS[id as ItemId].name.toLowerCase()} x${n}`)
    parts.push(`Inventory: ${inv.length ? inv.join(', ') : 'empty'}`)
    parts.push(`Location: ${s.currentRegion}${this.onSurface ? '' : ' (in the caves)'}${s.player.atBase ? ', at the base site' : ''}${s.player.inCrater ? ', inside a crater' : ''}`)
    parts.push(`Health ${Math.round(this.hp)}/${PLAYER_MAX_HP}${this.enemies.length ? `, ${this.enemies.length} suits nearby` : ''}`)
    for (const r of s.nearestNeededResources) parts.push(`Nearest ${ITEMS[r.item].name.toLowerCase()}: ${r.distance}m ${r.direction}`)
    if (s.signalSource) parts.push(`Strange signal: ${s.signalSource.distance}m ${s.signalSource.direction}`)
    const part = this.tracker.nextPart()
    if (part && q) parts.push(`Next thing to build at the base site: ${RECIPES[part].name.toLowerCase()}`)
    if (q?.objectives.some((o) => o.label.toLowerCase().includes('scan') && !o.done) && s.nearestUnscannedCreature) {
      parts.push(`Nearest drifter: ${s.nearestUnscannedCreature.distance}m ${s.nearestUnscannedCreature.direction}`)
    }
    if (q?.objectives.some((o) => o.label.toLowerCase().includes('anomal') && !o.done) && s.nearestUninvestigatedAnomaly) {
      parts.push(`Nearest anomaly: ${s.nearestUninvestigatedAnomaly.distance}m ${s.nearestUninvestigatedAnomaly.direction}`)
    }
    return parts.map((p) => p.replace(/\.+$/, '')).join('. ').slice(0, 1200)
  }

  stateForAI(): GameStateForAI {
    const { player, world, tracker } = this
    const needed = new Set<ItemId>()
    const quest = tracker.activeQuest
    if (quest) {
      const progress = tracker.progress(quest)
      quest.objectives.forEach((o, i) => {
        if (progress[i].done) return
        if (o.kind === 'collect') needed.add(o.item)
        if (o.kind === 'collect-any') o.items.forEach((item) => needed.add(item))
      })
    }
    const nearest: NearbyResource[] = []
    for (const item of needed) {
      let best: Pickup | null = null
      let bestDist = Infinity
      for (const p of world.pickups) {
        if (p.collected || p.item !== item) continue
        const d = this.distanceTo(p.x, p.z)
        if (d < bestDist) {
          bestDist = d
          best = p
        }
      }
      if (best) nearest.push({ item, distance: Math.round(bestDist), direction: this.directionTo(best.x, best.z) })
    }
    return {
      ...tracker.snapshot(),
      player: {
        x: Math.round(player.x),
        z: Math.round(player.z),
        headingDegrees: Math.round((((player.heading * 180) / Math.PI) % 360 + 360) % 360),
        inCrater: craterAt(world, player.x, player.z) !== null,
        atBase: this.atBase(),
      },
      nearestNeededResources: nearest,
      signalSource: tracker.signalRevealed && !tracker.signalFound
        ? { distance: Math.round(this.distanceTo(HATCH.x, HATCH.z)), direction: this.directionTo(HATCH.x, HATCH.z) }
        : null,
      nearestUnscannedCreature: this.nearestOf(this.creatures.filter((c) => !c.scanned)),
      nearestUninvestigatedAnomaly: this.nearestOf(ANOMALIES.filter((a) => !tracker.anomalies.includes(a.id))),
      nearestBoulder: this.nearestBoulder(),
    }
  }

  private nearestBoulder(): (Bearing & { x: number; z: number }) | null {
    let best: Boulder | null = null
    let bestDist = Infinity
    for (const b of this.world.boulders) {
      if (b.broken) continue
      const d = this.distanceTo(b.x, b.z)
      if (d < bestDist) {
        bestDist = d
        best = b
      }
    }
    if (!best) return null
    return { distance: Math.round(bestDist), direction: this.directionTo(best.x, best.z), x: Math.round(best.x), z: Math.round(best.z) }
  }

  private nearestOf(points: { x: number; z: number }[]): Bearing | null {
    let best: { x: number; z: number } | null = null
    let bestDist = Infinity
    for (const p of points) {
      const d = this.distanceTo(p.x, p.z)
      if (d < bestDist) {
        bestDist = d
        best = p
      }
    }
    return best ? { distance: Math.round(bestDist), direction: this.directionTo(best.x, best.z) } : null
  }

  private get playing(): boolean {
    return this.cutscene.done
  }

  private skipCutscene = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    if (!this.cutscene.done && !e.repeat) this.cutscene.skip()
  }

  private frame = (now: number) => {
    const raw = (now - this.last) / 1000
    if (raw > 0) this.fps += (1 / raw - this.fps) * 0.05
    const dt = Math.min(0.05, raw)
    this.last = now
    this.time += dt
    this.update(dt)
    this.render()
    this.raf = requestAnimationFrame(this.frame)
  }

  private sound(name: SoundName): void {
    this.audio.play(name)
  }

  private update(dt: number): void {
    this.audio.update(dt)
    if (!this.cutscene.done) {
      this.cutscene.update(dt, this.audio)
      return
    }
    if (!this.playStarted) {
      this.playStarted = true
      this.input.clear()
      this.tracker.start()
    }

    this.tablet.update(dt)
    this.syncAssistantScreen()
    this.inventory.update(dt)
    this.sky.update(dt)
    this.fade = Math.max(0, this.fade - dt * 1.5)
    const menu = this.tablet.visible || this.inventory.visible
    const dead = this.deadTimer > 0
    const controls = menu || dead ? NO_CONTROLS : this.input.controls()
    if (this.mouseFire && !menu && !dead) controls.fire = true
    this.mouseFire = false
    this.player.update(dt, controls, this.world)
    this.camera.follow(this.player.x, this.player.z, this.player.heading, dt)

    for (const e of this.player.events) {
      if (e === 'step') this.sound('step')
      if (e === 'jump') this.sound('jump')
      if (e === 'land') {
        this.sound('land')
        this.spawnBurst(this.player.x, this.player.z, this.player.y, 8, '#c3c9e3', 3)
      }
    }

    if (this.onSurface) {
      this.discoverStructures()
      this.updateActTwo(dt)
    } else if (this.distanceTo(CAVERN.x, CAVERN.z) < CAVERN_RANGE) {
      this.tracker.findCavern()
    }
    this.updateProduction(dt)
    this.updateCombat(dt, controls.fire)
    this.tracker.tick(dt, this.player.x, this.player.z, this.onSurface)
    for (const s of this.tracker.sounds) this.sound(s)
    this.tracker.sounds = []

    for (const b of this.world.boulders) b.shake = Math.max(0, b.shake - dt)
    this.updateParticles(dt)

    this.interaction = menu ? null : this.findInteraction()
    if (this.interactQueued) {
      this.interactQueued = false
      if (this.interaction?.run) this.interaction.run()
      else if (this.interaction) this.sound('deny')
    }
  }

  private updateActTwo(dt: number): void {
    const { player, tracker } = this
    updateCreatures(this.creatures, dt, player.x, player.z, this.world)
    tracker.enterRegion(regionAt(player.x, player.z))
    if (tracker.signalRevealed && !tracker.signalFound && this.distanceTo(HATCH.x, HATCH.z) < HATCH_RANGE) tracker.findSignal()
    if (tracker.baseParts.has('housing') && this.survivors.length === 0) {
      this.survivors = createSurvivors()
      for (const s of this.survivors) s.job = tracker.jobs[s.name] ?? null
    }
    updateSurvivors(this.survivors, dt, this.time)
  }

  private updateProduction(dt: number): void {
    const working = this.survivors.filter((s) => s.job)
    if (working.length > 0) {
      this.productionTimer += dt
      if (this.productionTimer >= PRODUCTION_INTERVAL) {
        this.productionTimer = 0
        for (const s of working) {
          const item = JOB_OUTPUT[s.job!]
          this.pendingSupplies[item] = Math.min(MAX_STORED_SUPPLIES, (this.pendingSupplies[item] ?? 0) + 1)
        }
      }
    }
  }

  private updateCombat(dt: number, fire: boolean): void {
    const { player, tracker } = this
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    this.turretCooldown = Math.max(0, this.turretCooldown - dt)
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    this.sinceHurt += dt
    if (this.sinceHurt > 5 && this.hp < PLAYER_MAX_HP && this.deadTimer <= 0) this.hp = Math.min(PLAYER_MAX_HP, this.hp + 6 * dt)

    if (this.deadTimer > 0) {
      this.deadTimer -= dt
      if (this.deadTimer <= 0) this.respawn()
      return
    }

    const quest = tracker.activeQuest?.id
    if (quest === 'act3.first-attack' && !this.firstAttackSpawned && this.onSurface) {
      this.firstAttackSpawned = true
      for (let i = 0; i < 3; i++) {
        const a = player.heading + (i - 1) * 0.6
        this.enemies.push(spawnEnemy(player.x + Math.sin(a) * 48, player.z + Math.cos(a) * 48))
      }
      this.sound('warning')
    }
    if (quest === 'act3.defend-settlement' && tracker.baseParts.has('turret') && !this.wave.started) this.startWave()
    if (this.wave.restartTimer > 0) {
      this.wave.restartTimer -= dt
      if (this.wave.restartTimer <= 0) this.startWave()
    }

    if (this.onSurface) {
      const atBase = updateEnemies(
        this.enemies,
        dt,
        { playerX: player.x, playerZ: player.z, playerAlive: true, baseX: BASE_CENTER.x, baseZ: BASE_CENTER.z, world: this.world },
        (p) => {
          this.projectiles.push(p)
          if (this.distanceTo(p.x, p.z) < 60) this.sound('enemyShoot')
        },
      )
      if (this.wave.active) {
        this.wave.integrity -= atBase * 6 * dt
        if (this.wave.integrity <= 0) this.failWave()
        else if (!this.enemies.some((e) => e.waveMember)) {
          this.wave.active = false
          tracker.surviveWave()
        }
      }

      const turret = PART_STRUCTURES.turret
      if (turret && tracker.baseParts.has('turret') && this.turretCooldown <= 0) {
        const target = this.enemies.find((e) => Math.hypot(wrap(e.x - turret.x), wrap(e.z - turret.z)) < TURRET_RANGE)
        if (target) {
          this.turretCooldown = TURRET_COOLDOWN
          const shot = shoot(turret.x, turret.z, target.x, target.z, true, 0.05, turret.radius + 0.6)
          shot.y = 3.2
          this.projectiles.push(shot)
          if (this.distanceTo(turret.x, turret.z) < 70) this.sound('turret')
        }
      }
    }

    if (fire && this.fireCooldown <= 0) {
      if (tracker.hasItem('blaster')) {
        this.fireCooldown = BLASTER_COOLDOWN
        const target = this.onSurface ? pickTarget(this.enemies, player.x, player.z, player.heading) : null
        const tx = target ? target.x : player.x + Math.sin(player.heading) * 30
        const tz = target ? target.z : player.z + Math.cos(player.heading) * 30
        this.projectiles.push(shoot(player.x, player.z, tx, tz, true))
        this.sound('shoot')
      } else if (this.enemies.length > 0) {
        this.fireCooldown = 1
        this.sound('deny')
      }
    }

    this.projectiles = updateProjectiles(this.projectiles, dt, this.onSurface ? this.enemies : [], player.x, player.z, this.world, (p, hit) => {
      if (hit.enemy) {
        hit.enemy.hp--
        hit.enemy.hitFlash = 0.12
        this.spawnBurst(hit.enemy.x, hit.enemy.z, 1.6, 4, '#ff8a7a', 3)
        if (hit.enemy.hp > 0) this.sound('enemyHit')
        else this.killEnemy(hit.enemy)
      } else if (hit.player && !p.friendly && this.onSurface) {
        this.damagePlayer(ENEMY_DAMAGE)
      }
    })
    this.enemies = this.enemies.filter((e) => e.hp > 0)
  }

  private killEnemy(e: Enemy): void {
    this.sound('enemyDie')
    this.spawnBurst(e.x, e.z, 1.5, 18, '#e6e6ee', 5)
    this.wrecks.push({ id: e.id, x: e.x, z: e.z, searched: false })
    if (this.wrecks.length > 12) this.wrecks.shift()
    this.tracker.defeatEnemy()
  }

  private damagePlayer(amount: number): void {
    if (this.devGod) return
    const dmg = this.tracker.hasItem('armor-plating') ? amount * (1 - ARMOR_REDUCTION) : amount
    this.hp -= dmg
    this.hurtFlash = 0.3
    this.sinceHurt = 0
    this.sound('hurt')
    if (this.hp <= 0) {
      this.hp = 0
      this.deadTimer = 3
      this.tablet.close()
      this.inventory.close()
    }
  }

  private respawn(): void {
    this.hp = PLAYER_MAX_HP
    this.scene = 'surface'
    this.placePlayer(BASE_CENTER.x - 6, BASE_CENTER.z - 10, 0)
    this.projectiles = []
    this.fade = 1
    this.tracker.toastMessage('YOU BLACKED OUT... AND WOKE UP AT THE BASE.', '#ff8a7a')
  }

  private startWave(): void {
    this.wave = { started: true, active: true, integrity: 100, restartTimer: 0 }
    this.enemies = this.enemies.filter((e) => !e.waveMember)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4
      this.enemies.push(spawnEnemy(BASE_CENTER.x + Math.sin(a) * 85, BASE_CENTER.z + Math.cos(a) * 85, true))
    }
    this.sound('warning')
    this.tracker.toastMessage('SUITS INBOUND. DEFEND THE SETTLEMENT!', '#ff8a7a')
  }

  private failWave(): void {
    this.wave.active = false
    this.wave.restartTimer = 8
    this.wave.integrity = 100
    this.enemies = this.enemies.filter((e) => !e.waveMember)
    this.tracker.toastMessage('THE SUITS BROKE THROUGH. REGROUP... THEY ARE COMING BACK.', '#ff8a7a')
  }

  private placePlayer(x: number, z: number, heading: number): void {
    const P = this.player
    P.x = x
    P.z = z
    P.heading = heading
    P.y = groundHeightAt(this.world, x, z)
    P.vy = 0
    P.speed = 0
    P.grounded = true
    this.camera.heading = heading
    this.camera.follow(x, z, heading, 1)
  }

  private enterCave(): void {
    this.scene = 'cave'
    this.placePlayer(CAVE_SPAWN.x, CAVE_SPAWN.z, Math.PI)
    this.projectiles = []
    this.particles = []
    this.fade = 1
    this.sound('rumble')
    this.tracker.currentRegion = 'UNDERGROUND'
    this.tracker.enterCave()
  }

  private exitCave(): void {
    this.scene = 'surface'
    this.placePlayer(HATCH.x + 5, HATCH.z, Math.PI / 2)
    this.particles = []
    this.fade = 1
    this.sound('rumble')
  }

  private distanceTo(x: number, z: number): number {
    return Math.hypot(wrap(x - this.player.x), wrap(z - this.player.z))
  }

  private directionTo(x: number, z: number): NearbyResource['direction'] {
    const angle = Math.atan2(wrap(x - this.player.x), wrap(z - this.player.z)) - this.player.heading
    const a = Math.atan2(Math.sin(angle), Math.cos(angle))
    if (Math.abs(a) < Math.PI / 4) return 'ahead'
    if (Math.abs(a) > (3 * Math.PI) / 4) return 'behind'
    return a > 0 ? 'to the right' : 'to the left'
  }

  private atBase(): boolean {
    return this.distanceTo(BASE_CENTER.x, BASE_CENTER.z) < BASE_RADIUS
  }

  private discoverStructures(): void {
    for (const s of this.world.structures) {
      if (s.discoverable && this.distanceTo(s.x, s.z) < s.radius + 14) this.tracker.discover(s.name)
    }
  }

  private findInteraction(): Interaction | null {
    const { world, player, tracker } = this
    if (!player.grounded) return null

    const build = this.onSurface ? this.buildInteraction() : null
    if (build) return build

    let pickup: Pickup | null = null
    let pickupDist = PICKUP_RADIUS
    for (const p of world.pickups) {
      if (p.collected) continue
      const d = this.distanceTo(p.x, p.z)
      if (d < pickupDist && Math.abs(groundHeightAt(world, p.x, p.z) - player.y) < 1.5) {
        pickupDist = d
        pickup = p
      }
    }
    if (pickup) {
      const target = pickup
      return {
        title: `[E] PICK UP ${ITEMS[target.item].name}`,
        detail: '',
        ok: true,
        run: () => {
          target.collected = true
          this.spawnBurst(target.x, target.z, 0, 5, ITEMS[target.item].color, 2)
          if (target.clue) tracker.findClue(target.clue.id, target.clue.text)
          else tracker.collect(target.item)
        },
      }
    }

    const candidates: { gap: number; make: () => Interaction }[] = []
    const consider = (x: number, z: number, size: number, range: number, make: () => Interaction) => {
      const gap = this.distanceTo(x, z) - size
      if (gap < range) candidates.push({ gap, make })
    }

    for (const creature of this.creatures) {
      if (creature.scanned) continue
      consider(creature.x, creature.z, 0, SCAN_RANGE, () => ({
        title: '[E] SCAN CREATURE',
        detail: 'IT SEEMS TO BE WATCHING YOU',
        ok: true,
        run: () => {
          creature.scanned = true
          creature.fleeing = 3
          this.spawnBurst(creature.x, creature.z, 2.4, 10, '#9fe1cb', 3)
          tracker.scanCreature(String(creature.id), speciesNote(creature))
        },
      }))
    }

    for (const anomaly of ANOMALIES) {
      if (tracker.anomalies.includes(anomaly.id)) continue
      consider(anomaly.x, anomaly.z, 0, ANOMALY_RANGE, () => ({
        title: '[E] INVESTIGATE ANOMALY',
        detail: 'THE AIR IS HUMMING',
        ok: true,
        run: () => {
          this.spawnBurst(anomaly.x, anomaly.z, 3, 18, '#c9a6ff', 5)
          tracker.investigateAnomaly(anomaly.id, anomaly.text)
        },
      }))
    }

    for (const survivor of this.survivors) {
      consider(survivor.x, survivor.z, 0, TALK_RANGE, () => {
        if (!tracker.talked.includes(survivor.name)) {
          return { title: `[E] TALK TO ${survivor.name}`, detail: '', ok: true, run: () => tracker.talkTo(survivor.name, survivor.line) }
        }
        const next = nextJob(survivor.job)
        return {
          title: `[E] ASSIGN ${survivor.name}: ${next}`,
          detail: survivor.job ? `CURRENT JOB: ${survivor.job}` : 'NO JOB YET',
          ok: true,
          run: () => {
            survivor.job = next
            tracker.assignJob(survivor.name, next)
          },
        }
      })
    }

    const storage = PART_STRUCTURES.storage
    const waiting = Object.values(this.pendingSupplies).reduce((a, n) => a + (n ?? 0), 0)
    if (storage && waiting > 0 && tracker.baseParts.has('storage')) {
      consider(storage.x, storage.z, storage.radius, 3, () => ({
        title: `[E] COLLECT SUPPLIES (${waiting})`,
        detail: 'MADE BY YOUR SETTLEMENT',
        ok: true,
        run: () => {
          const items = this.pendingSupplies
          this.pendingSupplies = {}
          tracker.collectSupplies(items)
        },
      }))
    }

    if (this.onSurface) {
      for (const w of this.wrecks) {
        consider(w.x, w.z, 0, SEARCH_RANGE, () => ({
          title: w.searched ? '[E] SEARCH AGAIN' : '[E] SEARCH THE SUIT',
          detail: w.searched ? 'NOTHING ELSE TO FIND... PROBABLY' : 'STILL WARM',
          ok: true,
          run: () => {
            const first = !tracker.suitSearched
            w.searched = true
            tracker.searchSuit(first ? SUIT_CLUES[0] : SUIT_CLUES[1 + (w.id % (SUIT_CLUES.length - 1))])
          },
        }))
      }
    }

    for (const b of world.boulders) {
      if (b.broken || b.hp > 3) continue
      consider(b.x, b.z, b.r, MINE_RANGE, () =>
        tracker.hasPickaxe()
          ? { title: '[E] MINE BOULDER', detail: `${b.hp} ${b.hp === 1 ? 'HIT' : 'HITS'} LEFT`, ok: true, run: () => this.mine(b) }
          : { title: 'BOULDER', detail: 'CRAFT A PICKAXE TO MINE IT', ok: false },
      )
    }

    for (const s of world.structures) {
      if (s.kind === 'ladder') {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({ title: '[E] CLIMB UP', detail: 'BACK TO THE SURFACE', ok: true, run: () => this.exitCave() }))
        continue
      }
      if (s.kind === 'hatch' && tracker.hasItem('power-drill')) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({
          title: tracker.caveReached ? '[E] CLIMB DOWN' : '[E] DRILL OPEN THE HATCH',
          detail: 'INTO THE CAVES',
          ok: true,
          run: () => this.enterCave(),
        }))
        continue
      }
      const info = INSPECTIONS[s.kind]
      if (!info) continue
      consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({
        title: `[E] INSPECT ${s.name}`,
        detail:
          s.kind === 'hatch'
            ? tracker.activeQuest?.id === 'act3.into-the-depths' ? 'NEED A POWER DRILL' : ''
            : !tracker.inspected.includes(s.name) && info.reward ? 'SOMETHING MIGHT BE SALVAGEABLE' : '',
        ok: true,
        run: () => {
          this.sound('inspect')
          tracker.inspect(s.name, info.text, info.reward)
        },
      }))
    }

    if (candidates.length === 0) return null
    candidates.sort((a, b) => a.gap - b.gap)
    return candidates[0].make()
  }

  private buildInteraction(): Interaction | null {
    if (!this.atBase()) return null
    const part = this.tracker.nextPart() ?? this.tracker.nextUpgrade()
    if (!part) return null
    const recipe = RECIPES[part]
    const spot = PART_STRUCTURES[part]
    if (spot && this.distanceTo(spot.x, spot.z) < spot.radius + 1.5) {
      return { title: `BUILD ${recipe.name}`, detail: 'STEP OFF THE BUILD SPOT', ok: false }
    }
    const cost = costEntries(recipe)
      .map(([item, n]) => `${ITEMS[item].short} ${Math.min(this.tracker.count(item), n)}/${n}`)
      .join('   ')
    const ok = this.tracker.canAfford(part)
    return {
      title: ok ? `[E] BUILD ${recipe.name}` : `BUILD ${recipe.name}`,
      detail: ok ? cost : `NEED ${cost}`,
      ok,
      run: ok
        ? () => {
            if (!this.tracker.build(part)) return
            const structure = PART_STRUCTURES[part]
            if (structure) {
              this.world.structures.push(structure)
              this.spawnBurst(structure.x, structure.z, 0, 14, '#e2e5f2', 4)
            }
          }
        : undefined,
    }
  }

  private mine(b: Boulder): void {
    const tier = this.tracker.toolTier()
    if (tier === 0) return
    this.player.actionTime = 0.3
    this.player.swingTier = tier
    b.hp -= tier >= 2 ? 2 : 1
    b.shake = 0.25
    this.spawnBurst(b.x, b.z, b.height * 0.6, tier >= 2 ? 7 : 5, tier >= 2 ? '#c9a6ff' : '#9aa0c0', 3)
    if (b.hp > 0) {
      this.sound('hit')
      return
    }
    b.broken = true
    this.sound('break')
    this.spawnBurst(b.x, b.z, b.height * 0.5, 16, tier >= 2 ? '#e2e5f2' : '#c9cbe0', 6)
    this.tracker.collect('moon-rock', tier >= 2 ? 3 : 2)
    if (tier >= 2 && !this.onSurface && Math.random() < 0.25) this.tracker.collect('rare-ore', 1)
    this.tracker.mineBoulder()
  }

  private spawnBurst(x: number, z: number, y: number, count: number, color: string, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.6)
      this.particles.push({
        x,
        z,
        y,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: 2 + Math.random() * speed,
        life: 0.5 + Math.random() * 0.5,
        color,
      })
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.z += p.vz * dt
      p.vy -= 12 * dt
      p.y = Math.max(0, p.y + p.vy * dt)
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  private inventoryItems(): HotbarItem[] {
    const owned = this.tracker.itemOrder.filter((item) => this.tracker.count(item) > 0)
    // Tools and gear come first so the equipped pickaxe stays in the hotbar.
    const gear: ItemId[] = ['pickaxe', 'moon-pickaxe', 'power-drill', 'armor-plating', 'blaster']
    const ordered = [...gear.filter((item) => owned.includes(item)), ...owned.filter((item) => !gear.includes(item))]
    return ordered.map((item) => ({ item, count: this.tracker.count(item) }))
  }

  private hotbarItems(): HotbarItem[] {
    return this.inventoryItems().slice(0, HOTBAR_SLOTS)
  }

  private render(): void {
    if (!this.cutscene.done) {
      this.text.begin()
      this.cutscene.draw(this.ctx, this.text)
      return
    }
    const { ctx, camera: cam, world, player } = this
    const surface = this.onSurface
    this.glows = []

    if (surface) this.sky.draw(ctx, cam, player.x, player.z, this.time)
    else drawCaveCeiling(ctx, cam, this.time)
    this.drawSurface()

    const decals: Decal[] = []
    for (const crater of world.craters) {
      const pos = cam.toCamera(crater.x, crater.z)
      const margin = crater.r * 1.3
      if (pos.rz + margin < 1) continue
      if (Math.hypot(pos.rx, pos.rz) - margin > HORIZON_D) continue
      if (Math.abs(pos.rx) > pos.rz * 1.3 + margin + 4) continue
      decals.push({ kind: 'crater', crater, pos, depth: pos.rz })
    }
    for (const pebble of world.pebbles) {
      const pos = cam.toCamera(pebble.x, pebble.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx >= 0 && p.sx < SCREEN_W) decals.push({ kind: 'pebble', p, depth: pos.rz })
    }
    const addShadow = (x: number, z: number, radius: number) => {
      const pos = cam.toCamera(x, z)
      if (pos.rz + radius > 1 && Math.hypot(pos.rx, pos.rz) - radius < HORIZON_D) {
        decals.push({ kind: 'shadow', pos, radius, depth: pos.rz })
      }
    }
    for (const s of world.structures) addShadow(s.x, s.z, s.radius * 1.25)
    for (const b of world.boulders) if (!b.broken) addShadow(b.x, b.z, b.r * 1.3)
    if (surface) for (const c of this.creatures) addShadow(c.x, c.z, 1.1)
    if (surface) for (const s of this.survivors) addShadow(s.x, s.z, 0.9)
    if (surface) for (const e of this.enemies) addShadow(e.x, e.z, 0.9)
    const padPos = cam.toCamera(BASE_CENTER.x, BASE_CENTER.z)
    if (surface && padPos.rz + BASE_HALF * 1.5 > 1 && Math.hypot(padPos.rx, padPos.rz) - BASE_HALF * 1.5 < HORIZON_D) {
      decals.push({ kind: 'pad', depth: padPos.rz })
    }

    decals.sort((a, b) => b.depth - a.depth)
    for (const d of decals) {
      if (d.kind === 'crater') drawCrater(ctx, cam, d.crater, d.pos)
      else if (d.kind === 'pebble') rect(ctx, d.p.scale > 4 ? '#6f78a8' : '#848dbb', d.p.sx, d.p.sy, d.p.scale > 5 ? 2 : 1, 1)
      else if (d.kind === 'pad') this.drawBasePad()
      else {
        const [ox, oz] = cam.rotate(-0.25 * d.radius, -0.25 * d.radius)
        fillPolygon(ctx, '#5b6496', cam.projectPolygon(ring(d.pos.rx + ox, d.pos.rz + oz, d.radius, 0, 14)))
      }
    }

    const uprights: Upright[] = []
    for (const boulder of world.boulders) {
      if (boulder.broken) continue
      const pos = cam.toCamera(boulder.x, boulder.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'boulder', boulder, p })
    }
    for (const structure of world.structures) {
      const pos = cam.toCamera(structure.x, structure.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -80 && p.sx < SCREEN_W + 80) uprights.push({ kind: 'structure', structure, p })
    }
    for (const pickup of world.pickups) {
      if (pickup.collected) continue
      const pos = cam.toCamera(pickup.x, pickup.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -10 && p.sx < SCREEN_W + 10) uprights.push({ kind: 'pickup', pickup, p })
    }
    if (surface) {
    for (const creature of this.creatures) {
      const pos = cam.toCamera(creature.x, creature.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'creature', creature, p })
    }
    for (const anomaly of ANOMALIES) {
      const pos = cam.toCamera(anomaly.x, anomaly.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -40 && p.sx < SCREEN_W + 40) uprights.push({ kind: 'anomaly', anomaly, p })
    }
    for (const survivor of this.survivors) {
      const pos = cam.toCamera(survivor.x, survivor.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'survivor', survivor, p })
    }
      for (const enemy of this.enemies) {
        const pos = cam.toCamera(enemy.x, enemy.z)
        const p = cam.projectPoint(pos.rx, pos.rz)
        if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'enemy', enemy, p })
      }
      for (const wreck of this.wrecks) {
        const pos = cam.toCamera(wreck.x, wreck.z)
        const p = cam.projectPoint(pos.rx, pos.rz)
        if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'wreck', wreck, p })
      }
    }
    this.labels = []
    const playerPos = cam.toCamera(player.x, player.z)
    const playerP = cam.projectPoint(playerPos.rx, playerPos.rz)
    if (playerP) {
      if (player.y > 0.5) playerP.depth -= 1
      uprights.push({ kind: 'player', p: playerP, pos: playerPos })
    }

    uprights.sort((a, b) => b.p.depth - a.p.depth)
    for (const u of uprights) {
      if (u.kind === 'boulder') this.drawBoulder(u.boulder)
      else if (u.kind === 'structure') drawStructure(ctx, this.model, u.structure, u.p.scale, this.time)
      else if (u.kind === 'pickup') drawPickup(ctx, u.pickup, u.p.sx, u.p.sy, u.p.scale, this.time)
      else if (u.kind === 'creature') drawCreature(ctx, u.creature, u.p.sx, u.p.sy, u.p.scale, this.time)
      else if (u.kind === 'anomaly') drawAnomaly(ctx, this.model, u.anomaly, this.tracker.anomalies.includes(u.anomaly.id), u.p.scale, this.time)
      else if (u.kind === 'survivor') {
        drawSurvivor(ctx, u.survivor, u.p.sx, u.p.sy)
        if (u.p.depth < 30) this.labels.push({ x: u.p.sx, y: u.p.sy - 24, name: u.survivor.name, job: u.survivor.job ?? '' })
      }
      else if (u.kind === 'enemy') drawEnemy(ctx, u.enemy, u.p.sx, u.p.sy, this.time)
      else if (u.kind === 'wreck') drawWreck(ctx, u.wreck, u.p.sx, u.p.sy, u.p.scale, this.time)
      else this.drawPlayer(u.p, u.pos)
      if (u.kind === 'pickup' && u.pickup.item === 'rare-ore') this.glows.push({ x: u.p.sx, y: u.p.sy - u.p.scale, color: '#ffd28a' })
      if (u.kind === 'structure' && (u.structure.kind === 'cavern' || u.structure.kind === 'ladder')) {
        this.glows.push({ x: u.p.sx, y: u.p.sy - u.p.scale * 4, color: u.structure.kind === 'ladder' ? '#fac775' : '#ff9f5a' })
      }
    }
    this.drawParticles()
    this.drawProjectiles()
    if (!surface) {
      const pc = cam.toCamera(player.x, player.z)
      const pp = cam.projectPoint(pc.rx, pc.rz)
      drawDarkness(ctx, pp?.sx ?? SCREEN_W / 2, (pp?.sy ?? 140) - 8)
      for (const g of this.glows) {
        rect(ctx, g.color, g.x, g.y, 1, 1)
        if (Math.sin(this.time * 3 + g.x) > 0) rect(ctx, '#ffffff', g.x, g.y - 1, 1, 1)
      }
    }
    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(226,75,74,${this.hurtFlash})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
    if (this.deadTimer > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (3 - this.deadTimer) * 1.5)})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    }

    const crater = craterAt(world, player.x, player.z)
    this.text.begin()
    this.text.alpha = 1 - 0.55 * Math.max(this.tablet.progress, this.inventory.progress)
    drawHud(ctx, this.text, {
      world,
      player,
      tracker: this.tracker,
      hotbar: this.hotbar,
      hotbarItems: this.hotbarItems(),
      time: this.time,
      showPitWarning: !!crater?.isPit && player.grounded && player.y < -1 && !this.tablet.open,
      prompt: this.deadTimer > 0 ? null : this.interaction,
      muted: this.audio.muted,
      showMinimap: this.showMinimap,
      combat: {
        hp: this.hp,
        maxHp: PLAYER_MAX_HP,
        armor: this.tracker.hasItem('armor-plating'),
        blaster: this.tracker.hasItem('blaster'),
        integrity: this.wave.active ? this.wave.integrity : null,
        dead: this.deadTimer > 0,
        underground: !surface,
      },
    })
    for (const l of this.labels) {
      this.text.text(l.name, l.x, l.y, '#fac775', { size: 4.8, align: 'center' })
      if (l.job) this.text.text(l.job, l.x, l.y + 5.5, '#9aa2cf', { size: 4, align: 'center', weight: 500 })
    }
    this.text.alpha = 1
    const view = this.tabletView()
    this.tablet.draw(ctx, this.time, view)
    this.tablet.drawText(this.text, this.time, view)
    this.inventory.drawBackdrop(ctx)
    this.inventory.draw(this.text, this.inventoryItems(), this.hotbar.selected)
  }

  private drawProjectiles(): void {
    const { ctx, camera: cam } = this
    for (const p of this.projectiles) {
      const c = cam.toCamera(p.x, p.z)
      const s = cam.projectPoint(c.rx, c.rz)
      if (!s) continue
      const y = s.sy - p.y * s.scale
      const color = p.friendly ? '#9fe1cb' : '#ff5a5a'
      const tail = cam.toCamera(p.x - p.vx * 0.03, p.z - p.vz * 0.03)
      const t = cam.projectPoint(tail.rx, tail.rz)
      if (t) rect(ctx, p.friendly ? '#2f6f5f' : '#7a2e2e', t.sx, t.sy - p.y * t.scale, 1, 1)
      rect(ctx, color, s.sx - 1, y - 1, 2, 2)
      rect(ctx, '#ffffff', s.sx, y - 1, 1, 1)
    }
  }

  private drawSurface(): void {
    const { ctx } = this
    const pal = this.onSurface ? { rim: '#e9e5cc', rim2: '#c3c9e3', band: '#7f88b4', base: '#9aa2c8' } : CAVE_GROUND
    for (let sx = 0; sx < SCREEN_W; sx++) {
      const yf = horizonY(sx + 0.5)
      const y0 = Math.floor(yf)
      const cover = 1 - (yf - y0)
      ctx.globalAlpha = cover
      ctx.fillStyle = pal.rim
      ctx.fillRect(sx, y0, 1, 1)
      ctx.globalAlpha = 1
      ctx.fillStyle = pal.rim
      ctx.fillRect(sx, y0 + 1, 1, 1)
      ctx.fillStyle = pal.rim2
      ctx.fillRect(sx, y0 + 2, 1, 1)
      ctx.globalAlpha = cover
      ctx.fillStyle = pal.band
      ctx.fillRect(sx, y0 + 3, 1, 1)
      ctx.globalAlpha = 1
      ctx.fillStyle = pal.band
      ctx.fillRect(sx, y0 + 4, 1, 3)
      ctx.fillStyle = pal.base
      ctx.fillRect(sx, y0 + 7, 1, SCREEN_H - y0)
    }
  }

  private drawBasePad(): void {
    const { ctx, camera: cam } = this
    const square = (half: number): CamPt[] =>
      [[-half, -half], [half, -half], [half, half], [-half, half]].map(([dx, dz]) => {
        const c = cam.toCamera(BASE_CENTER.x + dx, BASE_CENTER.z + dz)
        return [c.rx, c.rz, 0]
      })
    fillPolygon(ctx, '#7b84b4', cam.projectPolygon(square(BASE_HALF)))
    fillPolygon(ctx, '#a1a8d0', cam.projectPolygon(square(BASE_HALF - 1)))
    fillPolygon(ctx, '#959dc9', cam.projectPolygon(square(BASE_HALF - 3)))
    const building = this.tracker.nextPart() !== null
    const color = building && Math.floor(this.time * 2) % 2 ? '#fac775' : '#e2e5f2'
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const c = cam.toCamera(BASE_CENTER.x + dx * (BASE_HALF - 0.6), BASE_CENTER.z + dz * (BASE_HALF - 0.6))
      const p = cam.projectPoint(c.rx, c.rz)
      if (p) rect(ctx, color, p.sx - 1, p.sy, 3, 1)
    }
  }

  private drawBoulder(b: Boulder): void {
    const jitter = b.shake > 0 ? Math.sin(this.time * 70) * b.shake * 0.6 : 0
    const r = b.r
    const h = b.height
    const damage = 3 - b.hp
    this.model.begin({ x: b.x + jitter, z: b.z, yaw: b.yaw })
    this.model.draw(this.ctx, [
      box(-r, r, 0, h * 0.62, -r * 0.85, r * 0.85, damage >= 2 ? '#6c759f' : '#7c85b4', '#9aa2cf'),
      box(-r * 0.72, r * 0.55, h * 0.62, h, -r * 0.6, r * 0.72, damage >= 1 ? '#7a83b1' : '#8a92c0', '#dfe1f0'),
    ])
  }

  private drawParticles(): void {
    const { ctx, camera: cam } = this
    for (const p of this.particles) {
      const c = cam.toCamera(p.x, p.z)
      const s = cam.projectPoint(c.rx, c.rz)
      if (!s) continue
      rect(ctx, p.color, s.sx, s.sy - p.y * s.scale, p.life > 0.3 ? 2 : 1, 1)
    }
  }

  private drawPlayer(p: ScreenPoint, pos: CamPos): void {
    const { ctx, camera: cam, world, player } = this
    const crater = craterAt(world, player.x, player.z)
    const sunk = crater !== null && player.y < -0.2

    if (sunk) {
      const c = cam.toCamera(crater.x, crater.z)
      let rimBottom = 0
      for (const q of cam.projectPolygon(ring(c.rx, c.rz, crater.r, 0, 24))) rimBottom = Math.max(rimBottom, q[1])
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, SCREEN_W, rimBottom)
      ctx.clip()
    }

    const ground = groundHeightAt(world, player.x, player.z)
    const lift = Math.max(0, player.y - ground)
    const [ox, oz] = cam.rotate(-0.5, -0.5)
    fillPolygon(ctx, '#2e3560', cam.projectPolygon(ring(pos.rx + ox, pos.rz + oz, 1.2 - Math.min(0.6, lift * 0.12), ground, 14)))

    player.draw(ctx, p.sx, p.sy, p.scale, this.tablet.visible, { armor: this.tracker.hasItem('armor-plating'), blaster: this.tracker.hasItem('blaster'), pickaxe: this.tracker.toolTier() })
    if (sunk) ctx.restore()
  }
}
