import { setTypingMuted } from './typing'
import { ANOMALIES, ANOMALY_BEAM_RANGE, ANOMALY_INTRO, ANOMALY_RANGE, HATCH, HATCH_RANGE, drawAnomaly, type Anomaly } from './anomalies'
import { SHIP_SPOT } from './quests'
import { setAssistantContext } from './assistant'
import { GameAudio, type SoundName } from './audio'
import { ANVIL_RECIPES, BEDS_PER_HOME, HOUSING_BEDS, KIT_STRUCTURES, PART_ITEMS, BASE_CENTER, BASE_HALF, BASE_RADIUS, FREE_PARTS, PART_STRUCTURES, RECIPES, costEntries, type BasePart } from './base'
import { BLOCK, BLOCK_FOR_ITEM, BLOCK_INFO, BLOCK_REACH, MAX_STACK, cellCenter, cellOf, columnModel, ghostModel, type BlockColumn, type BlockType } from './blocks'
import { Camera, horizonY, ring, type CamPos, type ScreenPoint } from './camera'
import { CAVERN, CAVERN_RANGE, CAVE_GROUND, CAVE_SPAWN, LADDER, TERMINAL, createCaveWorld, drawCaveCeiling, drawDarkness } from './cave'
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
import { FARM_FOOD, FARM_REGROW, makeFarm, GARDEN_FIND_RANGE, GARDEN_FOOD, GARDEN_REGROW, drawPlant, growCrop, makeGarden, type Garden, type Plant } from './garden'
import { SCAN_RANGE, SPECIES, createCreatures, drawCreature, mergeCreatures, speciesNote, speciesOf, surfaced, updateCreatures, type Creature } from './creatures'
import { Cutscene } from './cutscene'
import { setVoiceMuted, speak, toggleVoices, voiceForSpeaker } from './voice'
import type { Message } from './tracker'
import { Finale } from './finale'
import { FUEL_GOAL, RIG_CAPACITY, RIG_INTERVAL, BLUEPRINTS, FOOD_STOCK_GOAL, PASSENGER_BAY_COST, RAID_INTERVAL, ROCKET_RANGE, SECTION_COST, SECTION_ORDER, rocket, type Blueprint } from './rocket'
import { ARENA_SPAWN, BOSS_INFO, MELEE_RANGE, bossVulnerable, clampToArena, createArenaWorld, createBoss, drawBoss, updateBoss, type Boss } from './boss'
import { SHIP_SPAWN, SHIP_WORKBENCH, WRECKAGE, clampToShip, createShipWorld, drawShipCeiling, drawShipLight, SHIP_GROUND } from './ship'
import { HAS_ITEM_PNG, Hotbar, HOTBAR_SLOTS, ICONS, type HotbarItem } from './hotbar'
import { drawHud, type Prompt } from './hud'
import { Input } from './input'
import { INVENTORY_SLOTS, InventoryScreen } from './inventory'
import { FOOD, ITEMS, type ItemId } from './items'
import { createRng, wrap, wrapPositive, type CamPt } from './math'
import { box, ModelRenderer } from './model3d'
import { PICKUP_RADIUS, drawPickup, type Pickup } from './pickups'
import { fillPolygon, rect, type Ctx } from './pixel'
import { NO_CONTROLS, Player } from './player'
import { Net, type NetPlayer } from './net'
import { adoptPickups, adoptStructures, adoptSurvivors, mergeCreatures as mergeCreatureLists, mergePickups, mergeSurvivors, unionIndices, unionStructures } from './coop'
import { REGIONS, regionAt } from './regions'
import { Sky } from './sky'
import { INSPECTIONS, STRUCTURES, drawStructure, type Structure } from './structures'
import { Tablet, type App, type ScreenRect, type TabletView } from './tablet'
import {
  JOB_OUTPUT,
  PRODUCTION_INTERVAL,
  TALK_RANGE,
  createStrays,
  createSurvivors,
  drawSurvivor,
  nextJob,
  updateSurvivors,
  type Survivor,
  type Job,
  FOOD_BIN,
  FOOD_DAY,
  STARVE_DAYS,
} from './survivors'
import { TextLayer } from './text'
import { QuestTracker, type CountField, type TrackerSnapshot } from './tracker'
import { earthRotation, loadEarthRotation } from './erp'
import { boulderAt, craterAt, createWorld, groundHeightAt, type Boulder, type Crater, type World } from './world'

type Decal =
  | { kind: 'crater'; crater: Crater; pos: CamPos; depth: number }
  | { kind: 'pebble'; p: ScreenPoint; depth: number }
  | { kind: 'shadow'; pos: CamPos; radius: number; depth: number }
  | { kind: 'pad'; depth: number }
  | { kind: 'garden'; pos: CamPos; radius: number; depth: number; farm: boolean }
  | { kind: 'plot'; pos: CamPos; radius: number; depth: number }

interface Remote {
  puppet: Player
  name: string
  color: string
  scene: string
  tx: number
  tz: number
  ty: number
  heading: number
  held: ItemId | null
  armor: boolean
  seen: number
}

/** What players send each other. 'op' messages are guest actions the host applies to the shared world. */
type NetData =
  | { k: 'pos'; x: number; z: number; y: number; h: number; s: string; held: ItemId | null; armor: boolean; g: boolean }
  | { k: 'state'; s: SharedState }
  | { k: 'init'; intro: boolean; s: SharedState; x: number; z: number }
  | { k: 'op'; op: NetOp }

type NetOp =
  | { type: 'block-place'; scene: string; gx: number; gz: number; block: BlockType }
  | { type: 'block-remove'; scene: string; gx: number; gz: number }
  | { type: 'food'; meals: number }
  | { type: 'supplies' }
  | { type: 'job'; name: string; job: Job }
  | { type: 'rocket-repair'; section: Blueprint }
  | { type: 'repair'; name: string }
  | { type: 'count'; field: CountField; item?: ItemId; amount?: number }

interface SharedState {
  tracker: Record<string, unknown>
  world: Partial<SaveData>
}

type Upright =
  | { kind: 'boulder'; boulder: Boulder; p: ScreenPoint }
  | { kind: 'structure'; structure: Structure; p: ScreenPoint }
  | { kind: 'pickup'; pickup: Pickup; p: ScreenPoint }
  | { kind: 'player'; p: ScreenPoint; pos: CamPos }
  | { kind: 'remote'; remote: Remote; p: ScreenPoint }
  | { kind: 'creature'; creature: Creature; p: ScreenPoint }
  | { kind: 'anomaly'; anomaly: Anomaly; p: ScreenPoint }
  | { kind: 'survivor'; survivor: Survivor; p: ScreenPoint }
  | { kind: 'enemy'; enemy: Enemy; p: ScreenPoint }
  | { kind: 'wreck'; wreck: Wreck; p: ScreenPoint }
  | { kind: 'plant'; plant: Plant; p: ScreenPoint }
  | { kind: 'blocks'; col: BlockColumn; x: number; z: number; p: ScreenPoint }
  | { kind: 'ghost'; target: BlockTarget; p: ScreenPoint }
  | { kind: 'boss'; boss: Boss; p: ScreenPoint }

export interface Waypoint {
  x: number
  z: number
  label: string
}

interface BlockTarget {
  gx: number
  gz: number
  level: number
  ok: boolean
  reason: string
}

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
  scene: 'surface' | 'cave' | 'ship' | 'arena'
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
const SHIP_LANDING = { x: 0, z: 47 } as const
const MINE_RANGE = 2.2
const SUIT_CLUES = [
  "A CREASED ORDER SHEET: 'RECOVER THE SUBJECT. DO NOT REMOVE HELMETS IN ITS PRESENCE.' THE PHOTO HAS BEEN TORN OFF. THE HEIGHT AND WEIGHT ARE YOURS.",
  "A PAGE FROM A FLIGHT MANUAL. 'KESTREL, ONE PASSENGER.' SOMEONE CIRCLED 'NO RETURN TRAJECTORY' AND WROTE 'AS PLANNED.'",
  "A MEDICAL CARD. O2 REQUIREMENT: NONE. THE NAME FIELD IS BLANK. THE BLOOD TYPE IS YOURS.",
  "THE HELMET RADIO IS STILL ON. A VOICE REPEATS: 'IT WILL LOOK LIKE ONE OF US. IT WILL THINK IT IS ONE OF US.'",
  "A MAINTENANCE TICKET FOR AN ONBOARD A.I.: 'CONTAINMENT MODULE NOT RESPONDING. JAM ITS SIGNAL UNTIL RETRIEVAL.'",
]
const MAX_STORED_SUPPLIES = 20
const SAVE_KEY = 'cosmos-reborn-save-v1'
const AUTOSAVE_INTERVAL = 20

interface SaveData {
  tracker?: Record<string, unknown>
  hp?: number
  slots?: (ItemId | null)[]
  selected?: number
  scene?: string
  player?: { x?: number; z?: number; heading?: number }
  flags?: { act2Played?: boolean; earthPlayed?: boolean; aftermathDone?: boolean; dropshipAdded?: boolean; dropshipSearched?: boolean; gameWon?: boolean }
  pendingSupplies?: Partial<Record<ItemId, number>>
  foodBin?: number
  foodTimer?: number
  raidTimer?: number
  parts?: Record<string, Partial<Structure>>
  surface?: { structures?: Structure[]; pickups?: Pickup[]; broken?: number[]; ice?: (number | null)[]; gardens?: Garden[]; blocks?: BlockColumn[] }
  cave?: { pickups?: Pickup[]; broken?: number[]; blocks?: BlockColumn[] }
  ship?: { pickups?: Pickup[] }
  survivors?: Survivor[]
  creatures?: Creature[]
  wrecks?: Wreck[]
  rigs?: [string, { ice: number; timer: number }][]
  rocket?: { placed?: boolean; x?: number; z?: number; built?: Blueprint[]; damaged?: Blueprint[]; bay?: boolean; food?: number; fuel?: number }
}

function readSave(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export class Game {
  private ctx: Ctx
  private text: TextLayer
  private surface = createWorld()
  private caveWorld = createCaveWorld()
  private scene: 'surface' | 'cave' | 'ship' | 'arena' = 'surface'
  private arenaWorld = createArenaWorld()
  private boss: Boss | null = null
  private bossExit = 0
  private anvilIndex = 0
  private shipWorld = createShipWorld()
  private earthPlayed = false
  private act2Played = false
  private chatterTimer = 40
  private buildSpot: { x: number; z: number; radius: number; ok: boolean } | null = null
  private waypoint: Waypoint | null = null
  private spoken = new WeakSet<Message>()
  private buffs = { quick: 0, steady: 0, glow: 0 }
  private structureCooldowns = new Map<string, number>()
  private groundRgb: number[][] = BIOMES['crash-site'].map(hexRgb)
  private pebbleNear = '#6f78a8'
  private pebbleFar = '#848dbb'
  private baseSpeed = 1
  private anomalyIntroduced = false
  private announcedApps = new Set<App>()
  private markerScreen: { x: number; y: number } | null = null
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
  private slots: (ItemId | null)[] = Array<ItemId | null>(INVENTORY_SLOTS + HOTBAR_SLOTS).fill(null)
  private firstAttackSpawned = false
  private aftermathDone = false
  private wave = { started: false, active: false, integrity: 100, restartTimer: 0, x: BASE_CENTER.x as number, z: BASE_CENTER.z as number, raid: false }
  private raidTimer = RAID_INTERVAL
  private choiceIndex = 0
  private rocketIndex = 0
  private drillCooldown = 0
  private dropshipAdded = false
  private dropshipSearched = false
  private finale: Finale | null = null
  private rigs = new Map<string, { ice: number; timer: number }>()
  private lastStandTimer = 6
  private gameWon = false
  private title = true
  private saveTimer = AUTOSAVE_INTERVAL
  private savedFlash = 0
  private savedQuests = 0
  private saveDisabled = false
  private finalRaid = false
  private iceCooldown = 0
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
  private survivors: Survivor[] = createStrays()
  private productionTimer = 0
  private foodBin = 0
  /** The ice miner is too heavy to carry: it is dragged behind the player to the base. */
  private dragging: Pickup | null = null
  private foodTimer = FOOD_DAY
  private playStarted = false
  private pendingSupplies: Partial<Record<ItemId, number>> = {}
  private labels: { x: number; y: number; name: string; job: string; color?: string }[] = []
  private interaction: Interaction | null = null
  private interactQueued = false
  /** Multiplayer room connection; idle in single player. */
  readonly net = new Net()
  private lobbyOpen = false
  private lobbyListeners = new Set<(open: boolean) => void>()
  private remotes = new Map<number, Remote>()
  private netPosTimer = 0
  private netStateTimer = 0
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
    loadEarthRotation()

    this.input.onAnyInput = () => this.audio.unlock()
    this.input.onKeyPress = (code) => this.handleMenuKey(code)
    this.tablet.isUnlocked = (app) => this.appUnlocked(app)
    this.tablet.lockHint = (app) =>
      app === 'quests' ? 'BRING THE ROCKET PARTS TO THE KESTREL' : app === 'map' ? 'SALVAGE THE NAV CHART INSIDE THE SHIP' : app === 'scan' ? 'CALIBRATES IN ACT II' : ''
    this.input.onTablet = () => {
      if (!this.playing || this.inventory.open) return
      loadEarthRotation()
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
    this.input.onMute = () => {
      this.audio.toggleMute()
      setVoiceMuted(this.audio.muted)
      setTypingMuted(this.audio.muted)
    }
    window.addEventListener('keydown', this.skipCutscene)
    document.addEventListener('visibilitychange', this.persist)
    window.addEventListener('pagehide', this.saveOnExit)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('contextmenu', this.preventMenu)

    this.camera.follow(this.player.x, this.player.z, this.player.heading, 1)
    if (import.meta.env.DEV) Object.assign(window, { cosmos: { state: () => this.stateForAI(), game: this } })
    this.net.onMessage = (from, data) => this.onNetMessage(from, data as NetData)
    this.net.onStarted = () => this.onNetStarted()
    this.net.onPlayers = (joined, left) => this.onNetPlayers(joined, left)
    this.net.onClosed = (reason) => this.onNetClosed(reason)
    this.tracker.onCount = (field, item, amount) => this.sendOp({ type: 'count', field, item, amount })
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
    document.removeEventListener('visibilitychange', this.persist)
    window.removeEventListener('pagehide', this.saveOnExit)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('contextmenu', this.preventMenu)
  }

  private toGame(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * SCREEN_W, ((e.clientY - r.top) / r.height) * SCREEN_H]
  }

  private handlePointerMove = (e: PointerEvent) => {
    const [x, y] = this.toGame(e)
    this.inventory.pointer(x, y)
  }

  private preventMenu = (e: Event) => e.preventDefault()

  private blockTarget(): BlockTarget | null {
    const held = this.heldItem()
    const type = held ? BLOCK_FOR_ITEM[held] : undefined
    if (!type || this.scene === 'ship') return null
    const P = this.player
    const [pgx, pgz] = cellOf(P.x, P.z)
    let reach = BLOCK_REACH
    let [gx, gz] = cellOf(P.x + Math.sin(P.heading) * reach, P.z + Math.cos(P.heading) * reach)
    if (gx === pgx && gz === pgz) {
      reach += BLOCK
      ;[gx, gz] = cellOf(P.x + Math.sin(P.heading) * reach, P.z + Math.cos(P.heading) * reach)
    }
    const level = this.world.blocks.height(gx, gz) / BLOCK
    const [cx, cz] = cellCenter(gx, gz)
    const pad = BLOCK / 2 + 0.45
    const underPlayer = Math.abs(wrap(P.x - cx)) < pad && Math.abs(wrap(P.z - cz)) < pad && P.y < (level + 1) * BLOCK
    let reason = ''
    if (level >= MAX_STACK) reason = 'TOO HIGH'
    else if (underPlayer) reason = 'YOU ARE IN THE WAY'
    else if (isSolidAtPad(this.world, cx, cz)) reason = 'SOMETHING IS IN THE WAY'
    else if (level === 0 && craterAt(this.world, cx, cz)) reason = 'NOT INSIDE A CRATER'
    else if (this.tracker.count(held!) <= 0) reason = `NO ${ITEMS[held!].name} LEFT`
    return { gx, gz, level, ok: reason === '', reason }
  }

  private placeBlock(): void {
    const target = this.blockTarget()
    const held = this.heldItem()
    if (!target || !held) return
    if (!target.ok) {
      this.sound('deny')
      return
    }
    const type = BLOCK_FOR_ITEM[held]!
    if (!this.tracker.consume(held)) return
    this.world.blocks.place(target.gx, target.gz, type)
    this.sendOp({ type: 'block-place', scene: this.scene, gx: target.gx, gz: target.gz, block: type })
    const [cx, cz] = cellCenter(target.gx, target.gz)
    this.spawnBurst(cx, cz, target.level * BLOCK + BLOCK, 6, BLOCK_INFO[type].top, 2)
    this.sound('build')
    this.tracker.placeBlock()
  }

  private removeBlock(): void {
    if (this.scene === 'ship') return
    const P = this.player
    let found: [number, number] | null = null
    for (const reach of [BLOCK_REACH, BLOCK_REACH + BLOCK, 1.2]) {
      const [gx, gz] = cellOf(P.x + Math.sin(P.heading) * reach, P.z + Math.cos(P.heading) * reach)
      if (this.world.blocks.height(gx, gz) > 0) {
        found = [gx, gz]
        break
      }
    }
    if (!found) return
    const type = this.world.blocks.remove(found[0], found[1])
    if (!type) return
    this.sendOp({ type: 'block-remove', scene: this.scene, gx: found[0], gz: found[1] })
    const [cx, cz] = cellCenter(found[0], found[1])
    this.spawnBurst(cx, cz, this.world.blocks.height(found[0], found[1]) + 1, 8, BLOCK_INFO[type].side, 3)
    this.tracker.refund(BLOCK_INFO[type].item)
    this.sound('break')
  }

  private spotAhead(r: number): { x: number; z: number; ok: boolean } {
    const P = this.player
    const ahead = r + 2.5
    const x = P.x + Math.sin(P.heading) * ahead
    const z = P.z + Math.cos(P.heading) * ahead
    const w = this.world
    const blocked =
      w.structures.some((s) => Math.hypot(wrap(x - s.x), wrap(z - s.z)) < s.radius + r + 0.5) ||
      w.gardens.some((g) => Math.hypot(wrap(x - g.x), wrap(z - g.z)) < g.radius + r) ||
      boulderAtPad(w, x, z, r) ||
      !!craterAt(w, x, z) ||
      w.blocks.heightAt(x, z, r) > 0 ||
      Math.hypot(wrap(x - BASE_CENTER.x), wrap(z - BASE_CENTER.z)) < 2
    return { x, z, ok: !blocked }
  }

  private beds(): { total: number; used: number } {
    const homes = this.surface.structures.filter((s) => s.kind === 'home').length
    const total = homes * BEDS_PER_HOME + (this.tracker.baseParts.has('housing') ? HOUSING_BEDS : 0)
    const used = this.survivors.filter((s) => s.recruited).length
    return { total, used }
  }

  private recruitInteraction(s: Survivor): Interaction {
    const tracker = this.tracker
    if (tracker.act < 2) return { title: s.name, detail: 'THEY STARE AT YOU. THEY ARE NOT READY TO TRUST ANYONE YET.', ok: false }
    const food = (Object.keys(FOOD) as ItemId[]).find((item) => tracker.count(item) > 0)
    const { total, used } = this.beds()
    const free = total - used
    if (!food) return { title: `RECRUIT ${s.name}`, detail: 'NEEDS 1 FOOD (MOON BERRY, STAR MELON OR GLOW CAP)', ok: false }
    if (free <= 0) return { title: `RECRUIT ${s.name}`, detail: `NO FREE BEDS (${used}/${total}). BUILD A HOME`, ok: false }
    return {
      title: `[E] RECRUIT ${s.name}`,
      detail: `GIVE 1 ${ITEMS[food].name} · BEDS ${used}/${total}`,
      ok: true,
      run: () => {
        if (!tracker.consume(food)) return
        const homes = this.surface.structures.filter((h) => h.kind === 'home')
        const home = homes[Math.floor(Math.random() * homes.length)] ?? { x: BASE_CENTER.x, z: BASE_CENTER.z }
        s.recruited = true
        s.homeX = home.x + (Math.random() - 0.5) * 6
        s.homeZ = home.z + 4 + Math.random() * 3
        s.x = s.homeX
        s.z = s.homeZ
        s.targetX = s.x
        s.targetZ = s.z
        this.fade = 0.5
        tracker.recruit(s.name, s.line)
        tracker.toastMessage(`${s.name} HEADS TO YOUR SETTLEMENT`, '#9fe1cb')
      },
    }
  }

  private rigInteraction(): Interaction | null {
    if (this.heldItem() !== 'rig-kit' || !this.onSurface) return null
    const P = this.player
    const x = P.x + Math.sin(P.heading) * 3
    const z = P.z + Math.cos(P.heading) * 3
    const crater = craterAt(this.world, x, z)
    if (!crater?.ice) return { title: 'ICE RIG', detail: 'FACE THE FLOOR OF AN ICY (BLUE) SHADOWED CRATER', ok: false }
    if (this.surface.structures.some((s) => s.kind === 'icerig' && Math.hypot(wrap(s.x - crater.x), wrap(s.z - crater.z)) < crater.r)) return { title: 'ICE RIG', detail: 'THIS CRATER ALREADY HAS A RIG', ok: false }
    return { title: '[CLICK] PLACE ICE RIG', detail: `DRILLS 1 ICE EVERY ${RIG_INTERVAL}s`, ok: true, run: () => {
      if (!this.tracker.consume('rig-kit')) return
      const name = `ICE RIG ${this.rigs.size + 1}`
      this.surface.structures.push({ kind: 'icerig', name, x: crater.x, z: crater.z, radius: 1.4, mapColor: '#9fd4ff' })
      this.rigs.set(name, { ice: 0, timer: RIG_INTERVAL })
      this.spawnBurst(crater.x, crater.z, 0, 14, '#bfe4ff', 4)
      this.tracker.placeKit('rig-kit')
    } }
  }

  private startFinale(): void {
    this.tracker.launch()
    this.finale = new Finale(this.tracker.choice === 'alone' ? 'captured' : 'together')
    this.enemies = []
    this.projectiles = []
    this.wave.active = false
    this.tablet.close()
    this.inventory.close()
  }

  private endFinale(): void {
    const f = this.finale
    this.finale = null
    this.input.clear()
    if (!f) return
    if (f.rewind) {
      this.tracker.rewindToChoice()
      this.scene = 'surface'
      if (rocket.placed) this.placePlayer(rocket.x, rocket.z - 11, 0)
      this.fade = 1
      this.raidTimer = RAID_INTERVAL
      return
    }
    this.gameWon = true
    this.scene = 'surface'
    this.placePlayer(BASE_CENTER.x - 6, BASE_CENTER.z - 10, 0)
    this.fade = 1
    this.tracker.toastMessage('THANK YOU FOR PLAYING COSMOS REBORN. THE MOON IS STILL YOURS TO EXPLORE.', '#fac775')
  }

  private rocketInteraction(): Interaction {
    const tracker = this.tracker
    const options: Interaction[] = []
    const costText = (cost: Partial<Record<ItemId, number>>) =>
      (Object.entries(cost) as [ItemId, number][]).map(([item, n]) => `${ITEMS[item].short} ${Math.min(tracker.count(item), n)}/${n}`).join('  ')
    const afford = (cost: Partial<Record<ItemId, number>>) => (Object.entries(cost) as [ItemId, number][]).every(([item, n]) => tracker.count(item) >= n)
    const pay = (cost: Partial<Record<ItemId, number>>) => {
      for (const [item, n] of Object.entries(cost) as [ItemId, number][]) for (let i = 0; i < n; i++) tracker.consume(item)
    }
    for (const d of rocket.damaged) {
      const cost = { 'metal-scrap': 3, 'metal-rod': 1 } as Partial<Record<ItemId, number>>
      const ok = afford(cost)
      options.push({ title: `${ok ? '[E] ' : ''}REPAIR ROCKET ${BLUEPRINTS[d].name}`, detail: costText(cost), ok, run: ok ? () => {
        pay(cost)
        rocket.damaged.delete(d)
        this.sendOp({ type: 'rocket-repair', section: d })
        tracker.repair(`ROCKET ${BLUEPRINTS[d].name}`)
      } : undefined })
    }
    if (tracker.activeQuest?.id === 'act4.hard-choice' && !tracker.choice) {
      const everyone = this.choiceIndex === 0
      return {
        title: everyone ? '[E] CHOOSE: EVERYONE LEAVES' : '[E] CHOOSE: LEAVE ALONE',
        detail: everyone ? 'KEEP YOUR PROMISE. IT WILL TAKE LONGER. · [R] SWITCH' : 'BREAK YOUR PROMISE. · [R] SWITCH',
        ok: true,
        run: () => tracker.makeChoice(everyone ? 'everyone' : 'alone'),
      }
    }
    for (const sec of SECTION_ORDER) {
      if (rocket.built.has(sec)) continue
      const known = tracker.blueprints.includes(sec)
      const cost = SECTION_COST[sec]
      const ok = known && afford(cost)
      options.push({
        title: `${ok ? '[E] ' : ''}BUILD ${BLUEPRINTS[sec].name}`,
        detail: known ? costText(cost) : `NO BLUEPRINT. ${BLUEPRINTS[sec].source.toUpperCase()}`,
        ok,
        run: ok ? () => {
          pay(cost)
          rocket.built.add(sec)
          this.spawnBurst(rocket.x, rocket.z, 6, 20, '#fac775', 5)
          tracker.toastMessage(`ROCKET ${BLUEPRINTS[sec].name} BUILT · ${Math.round((rocket.built.size / SECTION_ORDER.length) * 100)}%`, '#fac775')
          tracker.sectionBuilt()
        } : undefined,
      })
    }
    if (tracker.act >= 5 && rocket.fuel < FUEL_GOAL) {
      const n = tracker.count('rocket-fuel')
      options.push({ title: `${n ? '[E] ' : ''}LOAD FUEL (${rocket.fuel}/${FUEL_GOAL})`, detail: n ? `LOAD ${Math.min(n, FUEL_GOAL - rocket.fuel)} ROCKET FUEL` : 'NO ROCKET FUEL. PROCESS ICE AT THE ICE MINER', ok: n > 0, run: n ? () => {
        const k = Math.min(n, FUEL_GOAL - rocket.fuel)
        for (let i = 0; i < k; i++) tracker.consume('rocket-fuel')
        rocket.fuel += k
        tracker.refreshRocket()
        this.sound('pickup')
      } : undefined })
    }
    if (tracker.activeQuest?.id === 'act5.preflight') {
      const power = this.surface.structures.find((p) => p.kind === 'power')
      const checks: [string, string, string | null][] = [
        ['power', 'TEST POWER', !power ? 'NO POWER BUILT' : power.damaged ? 'POWER IS DAMAGED' : null],
        ['engines', 'TEST ENGINES', !rocket.built.has('engine') ? 'NO ENGINE' : rocket.damaged.has('engine') ? 'ENGINE IS DAMAGED' : null],
        ['fuel', 'CHECK FUEL', rocket.fuel < FUEL_GOAL ? `TANK ${rocket.fuel}/${FUEL_GOAL}` : null],
        ['passengers', 'CHECK PASSENGER PLAN', tracker.choice === 'everyone' && !(rocket.bay && rocket.food >= FOOD_STOCK_GOAL) ? 'EVERYONE NEEDS THE PASSENGER BAY AND 10 FOOD LOADED' : null],
      ]
      for (const [id, label, problem] of checks) {
        if (tracker.preflight.includes(id)) continue
        options.push({ title: problem ? `${label}: FAIL` : `[E] ${label}`, detail: problem ?? 'READY TO TEST', ok: !problem, run: problem ? undefined : () => tracker.passCheck(id, `${label}: PASS`) })
      }
    }
    if (tracker.activeQuest?.id === 'act5.countdown') {
      return { title: '[E] BEGIN LAUNCH SEQUENCE', detail: tracker.choice === 'alone' ? 'JUST YOU. NOBODY ELSE KNOWS.' : 'EVERYONE IS ON BOARD', ok: true, run: () => this.startFinale() }
    }
    const optional = tracker.openOptionalQuests.some((q) => q.id === 'act4.leave-no-one') || (tracker.act >= 5 && tracker.choice === 'everyone')
    if (optional && rocket.built.has('cabin') && !rocket.bay) {
      const ok = afford(PASSENGER_BAY_COST)
      options.push({ title: `${ok ? '[E] ' : ''}BUILD PASSENGER BAY`, detail: costText(PASSENGER_BAY_COST), ok, run: ok ? () => {
        pay(PASSENGER_BAY_COST)
        rocket.bay = true
        tracker.refreshRocket()
        tracker.toastMessage('PASSENGER BAY ADDED. ROOM FOR EVERYONE.', '#9fe1cb')
      } : undefined })
    }
    if (optional && rocket.food < FOOD_STOCK_GOAL) {
      const food = (Object.keys(FOOD) as ItemId[]).find((item) => tracker.count(item) > 0)
      options.push({ title: `${food ? '[E] ' : ''}LOAD FOOD (${rocket.food}/${FOOD_STOCK_GOAL})`, detail: food ? `LOAD 1 ${ITEMS[food].name}` : 'NO FOOD TO LOAD', ok: !!food, run: food ? () => {
        tracker.consume(food)
        rocket.food++
        tracker.refreshRocket()
        this.sound('pickup')
      } : undefined })
    }
    if (options.length === 0) return { title: 'THE ROCKET', detail: `${Math.round((rocket.built.size / SECTION_ORDER.length) * 100)}% BUILT`, ok: false }
    const pick = options[this.rocketIndex % options.length]
    return options.length > 1 ? { ...pick, detail: `${pick.detail} · [R] ${this.rocketIndex % options.length + 1}/${options.length}` } : pick
  }

  private anvilRecipes() {
    const unlocked = this.tracker.completed.includes('act2.unusual-life')
    const gear = this.tracker.completed.includes('act3.first-attack')
    return ANVIL_RECIPES.filter((r) => (r.item === 'survivor-gear' ? gear : unlocked || r.item === 'metal-rod'))
  }

  private appUnlocked(app: App): boolean {
    const done = this.tracker.completed
    if (app === 'ai') return true
    if (app === 'quests') return done.includes('act1.pieces')
    if (app === 'map') return done.includes('act1.inside-the-ship')
    return this.tracker.act >= 2
  }

  private structureUse(s: Structure): Interaction {
    const tracker = this.tracker
    const cd = this.structureCooldowns.get(s.name) ?? 0
    switch (s.kind) {
      case 'dome':
        return { title: '[E] REST IN THE HABITAT', detail: 'HEAL FULLY AND FEEL STEADY', ok: true, run: () => {
          this.hp = PLAYER_MAX_HP
          this.buffs.steady = 60
          this.fade = 0.8
          tracker.toastMessage('YOU SLEEP FOR AN HOUR IN A REAL BUNK. NOBODY KNOCKS.', '#9fe1cb')
        } }
      case 'dish': {
        if (tracker.dishTuned) return { title: 'RADIO DISH', detail: 'TUNED. ANOMALIES SHOW ON YOUR MAP', ok: false }
        const erp = earthRotation()
        return { title: '[E] TUNE THE DISH', detail: erp ? `EARTH LOCK: IGS ERP ${erp.date}` : 'LISTEN FOR THE ANOMALIES', ok: true, run: () => {
          tracker.dishTuned = true
          this.sound('clue')
          const lock = earthRotation()
          tracker.toastMessage(lock
            ? `EARTH LOCK VIA IGS ERP ${lock.date}: UT1-UTC ${lock.ut1.toFixed(4)} s. THE DISH FINDS EVERY ANOMALY. THEY ARE ALL POINTING AT YOU. (CHECK YOUR MAP)`
            : 'THE DISH LOCKS ON TO EVERY ANOMALY ON THE MOON. THEY ARE ALL POINTING AT YOU. (CHECK YOUR MAP)', '#c9a6ff')
        } }
      }
      case 'solar':
        if (cd > this.time) return { title: 'SOLAR FARM', detail: `RECHARGING... ${Math.ceil(cd - this.time)}s`, ok: false }
        return { title: '[E] CHARGE A POWER CELL', detail: 'THE PANELS STILL WORK', ok: true, run: () => {
          this.structureCooldowns.set(s.name, this.time + 150)
          tracker.collect('power-cell', 1)
        } }
      case 'rover': {
        if (!tracker.roverFixed) {
          const ok = tracker.count('metal-scrap') >= 4 && tracker.count('power-cell') >= 1
          return { title: ok ? '[E] REPAIR THE ROVER' : 'REPAIR THE ROVER', detail: ok ? 'SCRAP 4 · POWER CELL 1 · UNLOCKS FAST TRAVEL' : `NEED SCRAP ${tracker.count('metal-scrap')}/4 · CELL ${tracker.count('power-cell')}/1`, ok, run: ok ? () => {
            for (let i = 0; i < 4; i++) tracker.consume('metal-scrap')
            tracker.consume('power-cell')
            tracker.roverFixed = true
            this.sound('build')
            tracker.toastMessage('THE ROVER COUGHS AWAKE. PRESS E TO DRIVE, R TO PICK WHERE.', '#fac775')
          } : undefined }
        }
        const dests = this.travelDestinations()
        const dest = dests[this.anvilIndex % dests.length]
        return { title: `[E] DRIVE TO ${dest.label}`, detail: `${Math.round(this.distanceTo(dest.x, dest.z))}m · [R] ${(this.anvilIndex % dests.length) + 1}/${dests.length}`, ok: true, run: () => {
          this.placePlayer(dest.x, dest.z, 0)
          this.fade = 1
          this.sound('rumble')
          tracker.toastMessage(`YOU DRIVE TO ${dest.label}`, '#fac775')
        } }
      }
      case 'satellite': {
        if (tracker.satelliteOnline) return { title: 'CRASHED SAT', detail: 'ONLINE. FOOD AND SURVIVORS SHOW ON YOUR MAP', ok: false }
        const ok = tracker.count('anomaly-shard') >= 1 && tracker.count('metal-scrap') >= 2
        return { title: ok ? '[E] REALIGN THE SATELLITE' : 'REALIGN THE SATELLITE', detail: ok ? 'SHARD 1 · SCRAP 2 · BOOSTS SCAN AND MAP' : `NEED SHARD ${tracker.count('anomaly-shard')}/1 · SCRAP ${tracker.count('metal-scrap')}/2`, ok, run: ok ? () => {
          tracker.consume('anomaly-shard')
          tracker.consume('metal-scrap')
          tracker.consume('metal-scrap')
          tracker.satelliteOnline = true
          this.sound('discover')
          tracker.toastMessage('SATELLITE ONLINE. YOUR MAP NOW SHOWS FOOD AND SURVIVORS, AND SCAN REACHES TWICE AS FAR.', '#9fe1ff')
        } : undefined }
      }
      default:
        return { title: s.name, detail: '', ok: false }
    }
  }

  private biomePalette(): { rim: string; rim2: string; band: string; base: string } {
    const target = (BIOMES[regionAt(this.player.x, this.player.z).id] ?? BIOMES['crash-site']).map(hexRgb)
    const k = Math.min(1, 1.5 / 60)
    this.groundRgb = this.groundRgb.map((c, i) => c.map((v, j) => v + (target[i][j] - v) * k))
    const [rim, rim2, band, base] = this.groundRgb.map(rgbHex)
    const b = this.groundRgb[2]
    this.pebbleNear = rgbHex(b.map((v) => v * 0.85))
    this.pebbleFar = rgbHex(b.map((v) => v * 1.05))
    return { rim, rim2, band, base }
  }

  private travelDestinations(): { x: number; z: number; label: string }[] {
    const list = [{ x: BASE_CENTER.x - 6, z: BASE_CENTER.z - 14, label: 'BASE' }]
    if (rocket.placed) list.push({ x: rocket.x, z: rocket.z - 11, label: 'THE ROCKET' })
    for (const st of this.surface.structures) {
      if (st.discoverable && this.tracker.explored.includes(st.name) && st.kind !== 'rover') list.push({ x: st.x, z: st.z - st.radius - 7, label: st.name })
    }
    return list
  }

  private workbenchInteraction(): Interaction {
    const tracker = this.tracker
    const options: Interaction[] = []
    const part = tracker.nextPart() ?? tracker.nextUpgrade()
    if (part && PART_ITEMS[part]) {
      const name = RECIPES[part].name
      if (part !== 'rods' && part !== 'slab' && !tracker.baseParts.has('anvilset')) options.push({ title: `CRAFT ${name}`, detail: 'NEEDS THE ANVIL SET UP AT BASE', ok: false })
      else if (part === 'slab' && !tracker.baseParts.has('minerset')) options.push({ title: `CRAFT ${name}`, detail: 'NEEDS THE ICE MINER SET UP AT BASE', ok: false })
      else options.push(this.craftInteraction(part))
    }
    for (const r of this.anvilRecipes()) options.push(this.recipeInteraction(r))
    if (options.length === 0) return { title: 'WORKBENCH', detail: 'NOTHING TO CRAFT RIGHT NOW', ok: false }
    const i = this.anvilIndex % options.length
    const pick = options[i]
    return options.length > 1 ? { ...pick, detail: `${pick.detail} · [R] ${i + 1}/${options.length}` } : pick
  }

  private recipeInteraction(recipe: (typeof ANVIL_RECIPES)[number]): Interaction {
    const tracker = this.tracker
    const entries = Object.entries(recipe.cost) as [ItemId, number][]
    const ok = entries.every(([item, n]) => tracker.count(item) >= n)
    const cost = entries.map(([item, n]) => `${ITEMS[item].short} ${Math.min(tracker.count(item), n)}/${n}`).join('  ')
    return {
      title: ok ? `[E] CRAFT ${ITEMS[recipe.item].name}` : `CRAFT ${ITEMS[recipe.item].name}`,
      detail: ok ? cost : `NEED ${cost}`,
      ok,
      run: ok
        ? () => {
            for (const [item, n] of entries) for (let i = 0; i < n; i++) tracker.consume(item)
            tracker.refund(recipe.item)
            tracker.toastMessage(`CRAFTED ${ITEMS[recipe.item].name}`, ITEMS[recipe.item].color)
            this.sound('build')
          }
        : undefined,
    }
  }

  private kitInteraction(): Interaction | null {
    const held = this.heldItem()
    const kit = held ? KIT_STRUCTURES[held] : undefined
    if (!held || !kit || !this.onSurface) return null
    const spot = this.spotAhead(kit.radius)
    this.buildSpot = { x: spot.x, z: spot.z, radius: kit.radius, ok: spot.ok }
    const label = kit.kind === 'home' ? 'HOME' : kit.kind === 'farm' ? 'FARM' : 'LAUNCH PAD'
    if (!spot.ok) return { title: `PLACE ${label}`, detail: 'NO ROOM HERE. FACE AN OPEN SPOT', ok: false }
    return {
      title: `[CLICK] PLACE ${label}`,
      detail: kit.kind === 'home' ? `ADDS ${BEDS_PER_HOME} BEDS` : kit.kind === 'farm' ? 'GROWS MOON BERRIES AND STAR MELONS' : 'THE ROCKET WILL BE BUILT HERE',
      ok: true,
      run: () => {
        if (!this.tracker.consume(held)) return
        const n = this.surface.structures.filter((s) => s.kind === kit.kind).length + 1
        if (kit.kind === 'rocket') {
          rocket.placed = true
          rocket.x = spot.x
          rocket.z = spot.z
          this.surface.structures.push({ kind: 'rocket', name: 'THE ROCKET', x: spot.x, z: spot.z, radius: 5, mapColor: '#fac775' })
          this.spawnBurst(spot.x, spot.z, 0, 20, '#fac775', 5)
          this.tracker.placeKit(held)
          return
        }
        this.surface.structures.push({ kind: kit.kind, name: `${label} ${n}`, x: spot.x, z: spot.z, radius: kit.kind === 'home' ? kit.radius : 0, mapColor: kit.kind === 'home' ? '#e6e6ee' : '#7fcf6a', yaw: this.player.heading + Math.PI })
        if (kit.kind === 'farm') {
          const farm = makeFarm(this.surface.gardens.length + 100, spot.x, spot.z)
          this.surface.gardens.push(farm)
          for (let i = 0; i < 2; i++) this.surface.pickups.push(growCrop(farm))
        }
        this.spawnBurst(spot.x, spot.z, 0, 14, '#e2e5f2', 4)
        this.tracker.placeKit(held)
      },
    }
  }

  private enterArena(anomalyId: string): void {
    const kind = this.tracker.bosses.length === 0 ? 'jelly' : 'alien'
    this.boss = createBoss(kind, anomalyId)
    this.bossExit = 0
    this.arenaWorld = createArenaWorld()
    this.scene = 'arena'
    this.placePlayer(ARENA_SPAWN.x, ARENA_SPAWN.z, 0)
    this.projectiles = []
    this.particles = []
    this.fade = 1
    this.sound('rumble')
    this.tracker.currentRegion = 'BELOW THE ANOMALY'
    this.tracker.bossIntro(BOSS_INFO[kind].name, BOSS_INFO[kind].intro)
  }

  private strikeBoss(): void {
    const b = this.boss
    const tier = this.heldTier()
    if (!b || b.state === 'dead' || tier === 0) return
    this.player.actionTime = 0.3
    this.player.swingTier = tier
    const d = Math.hypot(b.x - this.player.x, b.z - this.player.z)
    if (d > MELEE_RANGE + (b.kind === 'jelly' ? 2 : 0)) {
      this.sound('step')
      return
    }
    this.hurtBoss(tier >= 3 ? 3 : tier >= 2 ? 2 : 1)
  }

  /** Any weapon damage to the guardian: pickaxe swings and blaster shots share this. */
  private hurtBoss(amount: number): void {
    const b = this.boss
    if (!b || b.state === 'dead') return
    if (!bossVulnerable(b)) {
      this.sound('deny')
      this.spawnBurst(b.x, b.z, b.y + 2, 4, '#9aa2cf', 2)
      return
    }
    b.hp -= amount
    b.hitFlash = 0.15
    this.spawnBurst(b.x, b.z, b.y + 2, 10, '#efe3ff', 4)
    this.sound('enemyHit')
    if (b.hp <= 0) {
      b.state = 'dead'
      b.rings = []
      b.orbs = []
      this.bossExit = 3
      this.sound('enemyDie')
    }
  }

  private updateArena(dt: number): void {
    const b = this.boss
    if (!b) return
    ;[this.player.x, this.player.z] = clampToArena(this.player.x, this.player.z)
    // Blaster shots land while the guardian is open, so the gun is the real answer here.
    for (const p of this.projectiles) {
      if (!p.friendly || p.life <= 0) continue
      if (Math.hypot(p.x - b.x, p.z - b.z) < (b.kind === 'jelly' ? 4 : 2.6)) {
        p.life = 0
        this.hurtBoss(2)
      }
    }
    const ev = updateBoss(b, dt, this.player.x, this.player.z, this.player.grounded)
    if (ev.hurtPlayer > 0 && this.deadTimer <= 0) this.damagePlayer(ev.hurtPlayer)
    if (ev.sound) this.sound(ev.sound)
    if (b.state === 'dead') {
      this.bossExit -= dt
      if (this.bossExit <= 0) this.leaveArena(b)
    }
  }

  private leaveArena(b: Boss): void {
    const anomaly = ANOMALIES.find((a) => a.id === b.anomalyId)
    this.boss = null
    this.scene = 'surface'
    if (anomaly) this.placePlayer(anomaly.x, anomaly.z - 9, 0)
    this.fade = 1
    this.sound('rumble')
    this.tracker.currentRegion = regionAt(this.player.x, this.player.z).name
    this.tracker.beatBoss(b.anomalyId, b.name, BOSS_INFO[b.kind].outro)
    if (b.kind === 'jelly') this.tracker.collect('bio-sample', 3)
    else this.tracker.collect('alien-alloy', 2)
    if (anomaly) this.tracker.investigateAnomaly(anomaly.id, anomaly.text)
    if (this.tracker.bosses.length >= 2) this.tracker.revealSignal()
  }

  private freeBuildInteraction(): Interaction | null {
    this.buildSpot = null
    if (!this.onSurface) return null
    const part = this.tracker.nextPart()
    if (!part || !FREE_PARTS.includes(part)) return null
    const structure = PART_STRUCTURES[part]
    if (!structure) return null
    const P = this.player
    const ahead = structure.radius + 2.5
    const x = P.x + Math.sin(P.heading) * ahead
    const z = P.z + Math.cos(P.heading) * ahead
    const r = structure.radius
    const w = this.world
    const blocked =
      w.structures.some((s) => Math.hypot(wrap(x - s.x), wrap(z - s.z)) < s.radius + r + 0.5) ||
      boulderAtPad(w, x, z, r) ||
      !!craterAt(w, x, z) ||
      w.blocks.heightAt(x, z, r) > 0 ||
      Math.hypot(wrap(x - BASE_CENTER.x), wrap(z - BASE_CENTER.z)) < 2
    this.buildSpot = { x, z, radius: r, ok: !blocked }
    if (blocked) return { title: `BUILD ${RECIPES[part].name}`, detail: 'NO ROOM HERE. FACE AN OPEN SPOT', ok: false }
    const craft = this.craftInteraction(part)
    const run = craft.run
    return {
      ...craft,
      title: craft.ok ? `[E] BUILD ${RECIPES[part].name} HERE` : `BUILD ${RECIPES[part].name} HERE`,
      run: run
        ? () => {
            structure.x = x
            structure.z = z
            structure.yaw = P.heading + Math.PI
            run()
          }
        : undefined,
    }
  }

  private blockInteraction(): Interaction | null {
    const target = this.blockTarget()
    const held = this.heldItem()
    if (!target || !held) return null
    const type = BLOCK_FOR_ITEM[held]!
    return {
      title: target.ok ? `[CLICK] PLACE ${BLOCK_INFO[type].name}` : BLOCK_INFO[type].name,
      detail: target.ok ? `[X] / RIGHT-CLICK TAKES ONE BACK · ${this.tracker.count(held)} LEFT` : target.reason,
      ok: target.ok,
      run: target.ok ? () => this.placeBlock() : undefined,
    }
  }

  private handlePointerUp = (e: PointerEvent) => {
    const [x, y] = this.toGame(e)
    const move = this.inventory.pointerUp(x, y)
    if (!move) return
    const { from, to } = move
    ;[this.slots[from], this.slots[to]] = [this.slots[to], this.slots[from]]
    this.sound('select')
  }

  private get world() {
    return this.scene === 'cave' ? this.caveWorld : this.scene === 'ship' ? this.shipWorld : this.scene === 'arena' ? this.arenaWorld : this.surface
  }

  private get onSurface(): boolean {
    return this.scene === 'surface'
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button === 2) {
      e.preventDefault()
      if (this.playing && !this.tablet.visible && !this.inventory.visible) this.removeBlock()
      return
    }
    if (this.playing && !this.tablet.visible && !this.inventory.visible) this.mouseFire = true
    const [x, y] = this.toGame(e)
    if (this.inventory.open && this.inventory.pointerDown(x, y, this.slotItems())) {
      this.canvas.setPointerCapture?.(e.pointerId)
      this.sound('select')
    }
    if (this.tablet.open && this.tablet.click(x, y)) this.sound('select')
  }

  private handleMenuKey(code: string): boolean {
    if (this.title) {
      if (this.lobbyOpen) return true
      if (code === 'Enter' || code === 'Space' || code === 'KeyE' || code === 'KeyC') this.continueGame()
      else if (code === 'KeyN' && readSave()) this.newGame()
      else if (code === 'KeyM') this.openLobby()
      return true
    }
    if (!this.playing) return false
    if (code === 'KeyR' && !this.tablet.open && !this.inventory.open) {
      this.anvilIndex++
      this.choiceIndex = (this.choiceIndex + 1) % 2
      this.rocketIndex++
      this.sound('select')
      return true
    }
    if (code === 'KeyV' && !this.tablet.open) {
      const on = toggleVoices()
      this.tracker.toastMessage(on ? 'VOICES ON (V)' : 'VOICES OFF (V)', '#9aa2cf')
      return true
    }
    if (code === 'KeyX' && !this.tablet.open && !this.inventory.open) {
      this.removeBlock()
      return true
    }
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
    const lifeSigns = [
      ...this.creatures.filter((c) => !c.scanned).map((c) => ({ x: c.x, z: c.z, label: SPECIES[speciesOf(c)].name, color: SPECIES[speciesOf(c)].color })),
      ...this.survivors.filter((s) => s.stray && !s.recruited).map((s) => ({ x: s.x, z: s.z, label: 'SURVIVOR', color: '#fac775' })),
      ...ANOMALIES.filter((a) => !this.tracker.anomalies.includes(a.id)).map((a) => ({ x: a.x, z: a.z, label: 'ANOMALY', color: '#c9a6ff' })),
      ...this.surface.gardens.filter((g) => !g.farm && this.cropsIn(g) > 0).map((g) => ({ x: g.x, z: g.z, label: 'FOOD', color: '#7fcf6a' })),
    ]
    return { world: this.surface, playerX: this.player.x, playerZ: this.player.z, heading: this.player.heading, tracker: this.tracker, underground: !this.onSurface, lifeSigns, waypoint: this.onSurface ? this.waypoint : null, erp: earthRotation() }
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
    locs.push({ id: 'ship-airlock', label: 'Inside the Kestrel', group: 'Act I', scene: 'ship', x: SHIP_SPAWN.x, z: SHIP_SPAWN.z, face: 0 })
    locs.push({ id: 'ship-bench', label: 'Ship workbench', group: 'Act I', scene: 'ship', x: SHIP_WORKBENCH.x - 4, z: SHIP_WORKBENCH.z - 3, face: 0.6 })
    for (const item of ['rocket-part', 'ice-miner', 'anvil', 'crescent-shard'] as ItemId[]) {
      const p = this.surface.pickups.find((pk) => pk.item === item && !pk.collected)
      if (p) locs.push({ id: `pickup-${item}`, label: `Nearest ${ITEMS[item].name.toLowerCase()}`, group: 'Act I', scene: 'surface', x: p.x, z: p.z - 6, face: 0 })
    }
    locs.push({ id: 'cave-spawn', label: 'Cave entrance', group: 'Cave', scene: 'cave', x: CAVE_SPAWN.x, z: CAVE_SPAWN.z, face: Math.PI })
    locs.push({ id: 'cave-ladder', label: 'Cave ladder', group: 'Cave', scene: 'cave', x: LADDER.x - 6, z: LADDER.z, face: Math.PI / 2 })
    locs.push({ id: 'cave-terminal', label: 'Cave terminal (controls)', group: 'Act IV', scene: 'cave', x: TERMINAL.x - 5, z: TERMINAL.z, face: Math.PI / 2 })
    locs.push({ id: 'dropship', label: 'Invader dropship (engine)', group: 'Act IV', scene: 'surface', x: 560, z: 712, face: 0 })
    if (rocket.placed) locs.push({ id: 'rocket', label: 'The rocket', group: 'Act IV', scene: 'surface', x: rocket.x, z: rocket.z - 11, face: 0 })
    locs.push({ id: 'cave-cavern', label: 'Hidden cavern', group: 'Cave', scene: 'cave', x: CAVERN.x - 12, z: CAVERN.z, face: Math.PI / 2 })
    for (const g of this.surface.gardens) {
      locs.push({ id: `garden-${g.id}`, label: `Garden ${g.id + 1}${g.found ? '' : ' (undiscovered)'}`, group: 'Gardens', scene: 'surface', x: g.x, z: g.z - g.radius - 8, face: 0 })
    }
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
    if (loc.scene === 'ship') this.tracker.currentRegion = 'THE KESTREL'
    this.placePlayer(loc.x, loc.z, loc.face)
    this.projectiles = []
    this.fade = 0.6
  }

  devCompleteQuest(): string | null {
    this.cutscene.skip()
    const done = this.tracker.devCompleteActive((part) => this.devAddPart(part))
    this.devEnsureRocket()
    return done
  }

  devPlayCutscene(kind: 'intro' | 'earth' | 'act2'): void {
    this.cutscene = new Cutscene(kind)
    this.input.clear()
  }

  devJumpToAct(act: number): void {
    this.cutscene.skip()
    this.earthPlayed = true
    this.act2Played = act > 2
    this.tracker.devJumpToAct(act, (part) => this.devAddPart(part))
    this.devEnsureRocket()
  }

  devGiveResources(): void {
    this.tracker.devGive({ 'moon-rock': 30, 'metal-scrap': 30, 'crescent-shard': 20, 'titanium-ore': 5, 'iron-ore': 5, 'alien-alloy': 2, 'metal-rod': 4, 'power-cell': 3, 'anomaly-shard': 10, 'bio-sample': 5, 'rare-ore': 15 })
  }

  devGiveGear(): void {
    const missing = (['pickaxe', 'power-drill', 'armor-plating', 'blaster'] as ItemId[]).filter((i) => !this.tracker.hasItem(i))
    this.tracker.devGive(Object.fromEntries(missing.map((i) => [i, 1])))
  }

  devGiveFood(): void {
    this.tracker.devGive({ 'home-kit': 2, 'farm-kit': 1, 'moon-berry': 5, 'star-melon': 3, 'glow-cap': 2, 'iron-ore': 5, 'titanium-ore': 3 })
  }

  devGrowGardens(): string {
    let grown = 0
    for (const g of this.surface.gardens) {
      while (this.cropsIn(g) < GARDEN_FOOD) {
        this.surface.pickups.push(growCrop(g))
        grown++
      }
    }
    return `${grown} crops grown`
  }

  devSpawnGarden(): string {
    if (!this.onSurface) return 'go to the surface first'
    const ahead = 14
    const x = this.player.x + Math.sin(this.player.heading) * ahead
    const z = this.player.z + Math.cos(this.player.heading) * ahead
    const garden = makeGarden(this.surface.gardens.length, x, z)
    this.surface.gardens.push(garden)
    for (let i = 0; i < GARDEN_FOOD; i++) this.surface.pickups.push(growCrop(garden))
    return `Garden ${garden.id + 1} planted ahead`
  }

  devPlayEnding(ending: 'together' | 'captured'): string {
    this.cutscene.skip()
    if (!this.tracker.choice) this.tracker.choice = ending === 'together' ? 'everyone' : 'alone'
    this.finale = new Finale(ending)
    return ending === 'together' ? 'Ending A' : 'Ending B'
  }

  devGiveIce(): void {
    this.tracker.devGive({ 'lunar-ice': 12, 'rig-kit': 1, 'power-drill': this.tracker.hasItem('power-drill') ? 0 : 1 })
  }

  private devEnsureRocket(): void {
    if (rocket.placed || !this.tracker.completed.includes('act4.a-way-home')) return
    rocket.placed = true
    rocket.x = -40
    rocket.z = 10
    for (let i = 0; i < 48; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = 40 + Math.floor(i / 12) * 15
      const x = BASE_CENTER.x + Math.cos(a) * r
      const z = BASE_CENTER.z + Math.sin(a) * r
      const clear = !boulderAt(this.surface, x, z, 9) && !craterAt(this.surface, x, z) && !this.surface.craters.some((c) => Math.hypot(wrap(c.x - x), wrap(c.z - z)) < c.r + 8) && !this.surface.structures.some((st) => Math.hypot(wrap(st.x - x), wrap(st.z - z)) < st.radius + 12)
      if (clear) {
        rocket.x = x
        rocket.z = z
        break
      }
    }
    this.surface.structures.push({ kind: 'rocket', name: 'THE ROCKET', x: rocket.x, z: rocket.z, radius: 5, mapColor: '#fac775' })
    this.tracker.inventory['launch-kit'] = 0
  }

  devAllBlueprints(): void {
    for (const id of Object.keys(BLUEPRINTS) as Blueprint[]) this.tracker.findBlueprint(id)
  }

  devStartRaid(): string {
    if (!rocket.placed) return 'place the launch pad first'
    this.startRaid()
    return 'suits marching on the rocket'
  }

  devStartBoss(kind: 'jelly' | 'alien'): string {
    this.cutscene.skip()
    const a = ANOMALIES.find((x) => !this.tracker.bosses.includes(x.id)) ?? ANOMALIES[0]
    if (kind === 'alien' && this.tracker.bosses.length === 0) this.tracker.bosses.push('dev-skip')
    this.enterArena(a.id)
    return `Fighting ${this.boss?.name ?? kind}`
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
    this.baseSpeed = mult
  }

  devToggleMinimap(): boolean {
    this.showMinimap = !this.showMinimap
    return this.showMinimap
  }

  tabletHome(): void {
    this.tablet.back()
  }

  /** Opens the A.I. app for a spoken question. False when the player is not in play. */
  openAssistant(): boolean {
    if (!this.playing || !this.cutscene.done || this.inventory.open || this.lobbyOpen) return false
    if (!this.tablet.open) this.sound('tabletOpen')
    this.tablet.openAssistant()
    return true
  }

  /** Listens for the tablet's A.I. app opening/closing; emits its screen rect in game pixels. */
  subscribeAssistantScreen(listener: (rect: ScreenRect | null) => void): () => void {
    this.aiListeners.add(listener)
    listener(this.tablet.aiScreenRect(this.time))
    return () => {
      this.aiListeners.delete(listener)
    }
  }

  private syncAssistantScreen(): void {
    const rect = this.tablet.aiScreenRect(this.time)
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
    parts.push(`Location: ${s.currentRegion}${this.scene === 'cave' ? ' (in the caves)' : this.scene === 'ship' ? ' (inside the wrecked Kestrel)' : ''}${s.player.atBase ? ', at the base site' : ''}${s.player.inCrater ? ', inside a crater' : ''}`)
    parts.push(`Health ${Math.round(this.hp)}/${PLAYER_MAX_HP}${this.enemies.length ? `, ${this.enemies.length} suits nearby` : ''}`)
    if (this.gameWon) parts.push('The player has finished the story (they escaped to Earth) and is now exploring freely')
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
    if (this.title) return
    if (!this.cutscene.done && !e.repeat) this.cutscene.skip()
  }

  private persist = () => {
    if (document.visibilityState === 'hidden') this.saveGame()
  }

  private saveOnExit = () => {
    this.saveGame()
  }

  hasSave(): boolean {
    return readSave() !== null
  }

  devDeleteSave(): void {
    this.saveDisabled = true
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      return
    }
    location.reload()
  }

  devSaveNow(): string {
    return this.saveGame() ? 'Saved' : 'Could not save (start playing first)'
  }

  private newGame(): void {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* storage unavailable */
    }
    this.title = false
  }

  private continueGame(): void {
    const data = readSave()
    this.title = false
    if (!data) return
    try {
      this.loadGame(data)
    } catch (err) {
      console.error('Save could not be loaded', err)
      this.tracker.toastMessage('YOUR SAVE COULD NOT BE LOADED. STARTING FRESH.', '#ff8a7a')
    }
  }

  private drawTitle(): void {
    const { ctx, text } = this
    rect(ctx, '#05040f', 0, 0, SCREEN_W, SCREEN_H)
    for (let i = 0; i < 120; i++) {
      const x = (i * 97 + this.time * (2 + (i % 5))) % SCREEN_W
      const y = (i * 53) % SCREEN_H
      rect(ctx, i % 4 ? '#6b66a8' : '#d9d6ff', x, y, 1, 1)
    }
    ctx.fillStyle = '#9aa2c8'
    ctx.beginPath()
    ctx.arc(SCREEN_W / 2, SCREEN_H + 190, 220, 0, Math.PI * 2)
    ctx.fill()
    text.text('COSMOS REBORN', SCREEN_W / 2, 50, '#fac775', { size: 14, align: 'center' })
    if (this.lobbyOpen) return
    const save = readSave()
    const blink = Math.floor(this.time * 2) % 2 === 0
    if (save) {
      const done = ((save.tracker as Record<string, unknown> | undefined)?.completed as string[] | undefined)?.length ?? 0
      const when = typeof save.savedAt === 'number' ? new Date(save.savedAt).toLocaleString() : ''
      text.text(`${blink ? '▶ ' : '  '}[ENTER] CONTINUE`, SCREEN_W / 2, 84, '#d9dcef', { size: 7, align: 'center' })
      text.text(`${done} QUESTS DONE · SAVED ${when}`, SCREEN_W / 2, 95, '#5b6496', { size: 5, align: 'center' })
      text.text('[N] NEW GAME (ERASES YOUR SAVE)', SCREEN_W / 2, 108, '#ff8a7a', { size: 6, align: 'center' })
    } else {
      text.text(`${blink ? '▶ ' : '  '}[ENTER] START`, SCREEN_W / 2, 92, '#d9dcef', { size: 7, align: 'center' })
    }
    text.text('[M] MULTIPLAYER', SCREEN_W / 2, 122, '#5dcaa5', { size: 6.5, align: 'center' })
  }

  private saveGame(): boolean {
    if (this.saveDisabled || this.title || !this.playStarted || this.finale || this.net.isGuest) return false
    const P = this.player
    const inArena = this.scene === 'arena'
    const parts: Record<string, { x: number; z: number; yaw?: number; damaged?: boolean }> = {}
    for (const [key, st] of Object.entries(PART_STRUCTURES)) if (st) parts[key] = { x: st.x, z: st.z, yaw: st.yaw, damaged: st.damaged }
    const data = {
      v: 1,
      savedAt: Date.now(),
      tracker: this.tracker.toSave(),
      scene: inArena ? 'surface' : this.scene,
      player: inArena ? { x: BASE_CENTER.x - 6, z: BASE_CENTER.z - 10, heading: 0 } : { x: P.x, z: P.z, heading: P.heading },
      hp: Math.max(1, Math.round(this.hp)),
      slots: this.slots,
      selected: this.hotbar.selected,
      flags: {
        earthPlayed: this.earthPlayed,
        act2Played: this.act2Played,
        aftermathDone: this.aftermathDone,
        dropshipAdded: this.dropshipAdded,
        dropshipSearched: this.dropshipSearched,
        gameWon: this.gameWon,
      },
      pendingSupplies: this.pendingSupplies,
      foodBin: this.foodBin,
      foodTimer: this.foodTimer,
      raidTimer: this.raidTimer,
      parts,
      surface: {
        structures: this.surface.structures,
        pickups: this.surface.pickups,
        broken: this.surface.boulders.flatMap((b, i) => (b.broken ? [i] : [])),
        ice: this.surface.craters.map((c) => c.iceLeft ?? null),
        gardens: this.surface.gardens,
        blocks: this.surface.blocks.toSave(),
      },
      cave: { pickups: this.caveWorld.pickups, broken: this.caveWorld.boulders.flatMap((b, i) => (b.broken ? [i] : [])), blocks: this.caveWorld.blocks.toSave() },
      ship: { pickups: this.shipWorld.pickups },
      survivors: this.survivors,
      creatures: this.creatures,
      wrecks: this.wrecks,
      rigs: [...this.rigs.entries()],
      rocket: { placed: rocket.placed, x: rocket.x, z: rocket.z, built: [...rocket.built], damaged: [...rocket.damaged], bay: rocket.bay, food: rocket.food, fuel: rocket.fuel },
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
      this.savedFlash = 1.6
      return true
    } catch {
      return false
    }
  }

  private loadGame(raw: Record<string, unknown>): void {
    const d = raw as SaveData
    this.cutscene.skip()
    this.playStarted = true
    this.tracker.loadSave(d.tracker ?? {})
    this.hp = d.hp ?? PLAYER_MAX_HP
    if (Array.isArray(d.slots)) this.slots = d.slots
    this.earthPlayed = d.flags?.earthPlayed ?? true
    this.act2Played = d.flags?.act2Played ?? this.tracker.completed.includes('act2.new-community')
    this.aftermathDone = d.flags?.aftermathDone ?? false
    this.dropshipAdded = d.flags?.dropshipAdded ?? false
    this.dropshipSearched = d.flags?.dropshipSearched ?? false
    this.gameWon = d.flags?.gameWon ?? false
    this.pendingSupplies = d.pendingSupplies ?? {}
    this.foodBin = d.foodBin ?? 0
    this.foodTimer = d.foodTimer ?? FOOD_DAY
    this.raidTimer = d.raidTimer ?? RAID_INTERVAL
    for (const [key, saved] of Object.entries(d.parts ?? {})) {
      const st = PART_STRUCTURES[key as BasePart]
      if (st) Object.assign(st, saved)
    }
    const s = d.surface ?? {}
    if (Array.isArray(s.structures)) {
      const partByName = new Map(Object.values(PART_STRUCTURES).filter((p): p is Structure => !!p).map((p) => [p.name, p]))
      this.surface.structures = s.structures.map((st) => {
        const part = partByName.get(st.name)
        return part && part.kind === st.kind ? part : st
      })
    }
    if (Array.isArray(s.pickups)) this.surface.pickups = s.pickups
    for (const i of s.broken ?? []) if (this.surface.boulders[i]) this.surface.boulders[i].broken = true
    ;(s.ice ?? []).forEach((left, i) => {
      const c = this.surface.craters[i]
      if (c && c.ice && left !== null) c.iceLeft = left
    })
    if (Array.isArray(s.gardens)) this.surface.gardens = s.gardens
    if (Array.isArray(s.blocks)) this.surface.blocks.loadSave(s.blocks)
    if (Array.isArray(d.cave?.pickups)) this.caveWorld.pickups = d.cave.pickups
    for (const i of d.cave?.broken ?? []) if (this.caveWorld.boulders[i]) this.caveWorld.boulders[i].broken = true
    if (Array.isArray(d.cave?.blocks)) this.caveWorld.blocks.loadSave(d.cave.blocks)
    if (Array.isArray(d.ship?.pickups)) this.shipWorld.pickups = d.ship.pickups
    if (Array.isArray(d.survivors)) this.survivors = d.survivors
    if (Array.isArray(d.creatures)) this.creatures = mergeCreatures(d.creatures, createCreatures(createRng(5)))
    if (Array.isArray(d.wrecks)) this.wrecks = d.wrecks
    if (Array.isArray(d.rigs)) this.rigs = new Map(d.rigs)
    const r = d.rocket
    if (r) {
      rocket.placed = !!r.placed
      rocket.x = r.x ?? 0
      rocket.z = r.z ?? 0
      rocket.built = new Set(r.built ?? [])
      rocket.damaged = new Set(r.damaged ?? [])
      rocket.bay = !!r.bay
      rocket.food = r.food ?? 0
      rocket.fuel = r.fuel ?? 0
    }
    this.scene = d.scene === 'cave' || d.scene === 'ship' ? d.scene : 'surface'
    const p = d.player ?? {}
    this.placePlayer(p.x ?? 0, p.z ?? 0, p.heading ?? 0)
    this.hotbar.select(d.selected ?? 0, this.time)
    this.savedQuests = this.tracker.completed.length
    this.input.clear()
    this.fade = 1
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


  // ── Multiplayer ──────────────────────────────────────────────────────────

  subscribeLobby(listener: (open: boolean) => void): () => void {
    this.lobbyListeners.add(listener)
    listener(this.lobbyOpen)
    return () => {
      this.lobbyListeners.delete(listener)
    }
  }

  private setLobby(open: boolean): void {
    this.lobbyOpen = open
    for (const fn of this.lobbyListeners) fn(open)
  }

  openLobby(): void {
    if (!this.title) return
    this.setLobby(true)
  }

  closeLobby(): void {
    this.net.leave()
    this.setLobby(false)
  }

  /** Host pressed START in the lobby: begin (or continue) the shared game and bring everyone in. */
  hostStart(fresh: boolean): void {
    if (!this.net.isHost) return
    this.setLobby(false)
    fresh = fresh || !readSave()
    if (fresh) this.newGame()
    else this.continueGame()
    this.net.start()
    const init: NetData = { k: 'init', intro: fresh, s: this.sharedState(), x: this.player.x, z: this.player.z }
    this.net.send(init)
    this.cutscene.setCrew(this.net.players.length)
  }

  private onNetStarted(): void {
    // Guests wait for the host's 'init' with the world; nothing to do until then.
    if (this.net.isHost) return
    this.setLobby(false)
  }

  private onNetPlayers(joined: NetPlayer[], left: NetPlayer[]): void {
    for (const p of left) {
      this.remotes.delete(p.id)
      if (!this.title) this.tracker.toastMessage(`${p.name} LEFT THE GAME`, '#9aa2cf')
    }
    for (const p of joined) {
      if (p.id === this.net.you) continue
      if (!this.title) this.tracker.toastMessage(`${p.name} JOINED THE GAME`, p.color)
      // Late joiners get the world straight away and drop in next to the host.
      if (this.net.isHost && this.net.status === 'playing' && !this.title) {
        const init: NetData = { k: 'init', intro: false, s: this.sharedState(), x: this.player.x, z: this.player.z }
        this.net.send(init, p.id)
      }
    }
  }

  private onNetClosed(reason: string): void {
    this.remotes.clear()
    if (this.title) {
      this.setLobby(true)
      return
    }
    this.tracker.toastMessage(`${reason}. YOU ARE PLAYING ALONE NOW (YOUR OWN SAVE IS UNTOUCHED).`, '#ff8a7a')
  }

  private onNetMessage(from: number, data: NetData): void {
    if (!data || typeof data !== 'object') return
    if (data.k === 'pos') {
      let r = this.remotes.get(from)
      if (!r) {
        const puppet = new Player()
        puppet.x = data.x
        puppet.z = data.z
        r = { puppet, name: this.net.nameOf(from), color: this.net.colorOf(from), scene: data.s, tx: data.x, tz: data.z, ty: data.y, heading: data.h, held: data.held, armor: data.armor, seen: this.time }
        this.remotes.set(from, r)
      }
      r.tx = data.x
      r.tz = data.z
      r.ty = data.y
      r.heading = data.h
      r.scene = data.s
      r.held = data.held
      r.armor = data.armor
      r.puppet.grounded = data.g
      r.seen = this.time
      r.name = this.net.nameOf(from)
      r.color = this.net.colorOf(from)
      return
    }
    if (data.k === 'init' && !this.net.isHost) {
      this.joinShared(data)
      return
    }
    if (data.k === 'state') {
      const fromHost = from === this.net.hostId
      if (this.net.isHost && !fromHost) this.mergeShared(data.s, false)
      else if (!this.net.isHost && fromHost) this.mergeShared(data.s, true)
      return
    }
    if (data.k === 'op' && this.net.isHost) this.applyOp(data.op)
  }

  private joinShared(data: Extract<NetData, { k: 'init' }>): void {
    this.setLobby(false)
    this.title = false
    const index = Math.max(1, this.net.players.findIndex((p) => p.id === this.net.you))
    if (data.intro) {
      // Everyone watches the crash together, then walks out side by side.
      this.cutscene = new Cutscene('intro')
      this.cutscene.setCrew(this.net.players.length)
      this.player.x = index * 2.2
      this.player.z = 0
      this.mergeShared(data.s, true)
      return
    }
    this.cutscene.skip()
    this.playStarted = true
    this.tracker.start()
    this.mergeShared(data.s, true)
    // Prior cutscenes count as seen when dropping into a game in progress.
    this.earthPlayed = true
    this.act2Played = this.tracker.completed.includes('act2.new-community')
    this.scene = 'surface'
    this.player.x = data.x + Math.cos(index) * 3
    this.player.z = data.z + Math.sin(index) * 3
    this.camera.follow(this.player.x, this.player.z, this.player.heading, 1)
    this.tracker.toastMessage(`YOU JOINED ${this.net.nameOf(this.net.hostId)}'S GAME`, '#5dcaa5')
  }

  private sendOp(op: NetOp): void {
    if (this.net.isGuest) this.net.send({ k: 'op', op } satisfies NetData, 'host')
  }

  private worldFor(scene: string): World | null {
    return scene === 'surface' ? this.surface : scene === 'cave' ? this.caveWorld : null
  }

  private applyOp(op: NetOp): void {
    switch (op.type) {
      case 'block-place':
        this.worldFor(op.scene)?.blocks.place(op.gx, op.gz, op.block)
        break
      case 'block-remove':
        this.worldFor(op.scene)?.blocks.remove(op.gx, op.gz)
        break
      case 'food':
        this.foodBin += Math.max(0, Math.min(200, op.meals))
        for (const s of this.eaters()) if (s.hunger) s.hunger = 0
        break
      case 'supplies':
        this.pendingSupplies = {}
        break
      case 'job': {
        const s = this.survivors.find((v) => v.name === op.name)
        if (s) s.job = op.job
        this.tracker.jobs[op.name] = op.job
        break
      }
      case 'rocket-repair':
        rocket.damaged.delete(op.section)
        break
      case 'repair': {
        const st = this.surface.structures.find((v) => v.name === op.name)
        if (st) st.damaged = false
        break
      }
      case 'count':
        this.tracker.addCount(op.field, op.item, op.amount)
        break
    }
  }

  private sharedState(): SharedState {
    const parts: Record<string, { x: number; z: number; yaw?: number; damaged?: boolean }> = {}
    for (const [key, st] of Object.entries(PART_STRUCTURES)) if (st) parts[key] = { x: st.x, z: st.z, yaw: st.yaw, damaged: st.damaged }
    return {
      tracker: this.tracker.sharedSave(),
      world: {
        flags: { aftermathDone: this.aftermathDone, dropshipAdded: this.dropshipAdded, dropshipSearched: this.dropshipSearched, gameWon: this.gameWon },
        pendingSupplies: this.pendingSupplies,
        foodBin: this.foodBin,
        foodTimer: this.foodTimer,
        raidTimer: this.raidTimer,
        parts,
        surface: {
          structures: this.surface.structures,
          pickups: this.surface.pickups,
          broken: this.surface.boulders.flatMap((b, i) => (b.broken ? [i] : [])),
          ice: this.surface.craters.map((c) => c.iceLeft ?? null),
          gardens: this.surface.gardens,
          blocks: this.surface.blocks.toSave(),
        },
        cave: { pickups: this.caveWorld.pickups, broken: this.caveWorld.boulders.flatMap((b, i) => (b.broken ? [i] : [])), blocks: this.caveWorld.blocks.toSave() },
        ship: { pickups: this.shipWorld.pickups },
        survivors: this.survivors,
        creatures: this.creatures,
        rigs: [...this.rigs.entries()],
        rocket: { placed: rocket.placed, x: rocket.x, z: rocket.z, built: [...rocket.built], damaged: [...rocket.damaged], bay: rocket.bay, food: rocket.food, fuel: rocket.fuel },
      },
    }
  }

  /** fromHost: we are a guest taking the host's world. Otherwise we are the host taking a guest's progress. */
  private mergeShared(state: SharedState, fromHost: boolean): void {
    if (!state) return
    this.tracker.mergeShared(state.tracker ?? {}, fromHost)
    const w = state.world ?? {}
    const partsByName = new Map(Object.values(PART_STRUCTURES).filter((p): p is Structure => !!p).map((p) => [p.name, p]))
    const f = w.flags ?? {}
    this.aftermathDone ||= !!f.aftermathDone
    this.dropshipAdded ||= !!f.dropshipAdded
    this.dropshipSearched ||= !!f.dropshipSearched
    this.gameWon ||= !!f.gameWon
    const ws = w.surface ?? {}
    for (const i of unionIndices([], ws.broken)) if (this.surface.boulders[i]) this.surface.boulders[i].broken = true
    for (const i of unionIndices([], w.cave?.broken)) if (this.caveWorld.boulders[i]) this.caveWorld.boulders[i].broken = true
    ;(ws.ice ?? []).forEach((left, i) => {
      const c = this.surface.craters[i]
      if (c && c.ice && left !== null) c.iceLeft = Math.min(c.iceLeft ?? left, left)
    })
    if (Array.isArray(w.rigs)) for (const [k, v] of w.rigs) if (!this.rigs.has(k)) this.rigs.set(k, v)
    const rk = w.rocket
    if (rk) {
      if (rk.placed && !rocket.placed) {
        rocket.placed = true
        rocket.x = rk.x ?? rocket.x
        rocket.z = rk.z ?? rocket.z
      }
      for (const b of rk.built ?? []) rocket.built.add(b)
      rocket.bay ||= !!rk.bay
      rocket.food = Math.max(rocket.food, rk.food ?? 0)
      rocket.fuel = Math.max(rocket.fuel, rk.fuel ?? 0)
    }

    if (fromHost) {
      for (const [key, saved] of Object.entries(w.parts ?? {})) {
        const st = PART_STRUCTURES[key as BasePart]
        if (st) Object.assign(st, saved)
      }
      this.surface.structures = adoptStructures(this.surface.structures, ws.structures, partsByName)
      this.surface.pickups = adoptPickups(this.surface.pickups, ws.pickups, this.dragging)
      this.caveWorld.pickups = adoptPickups(this.caveWorld.pickups, w.cave?.pickups, null)
      this.shipWorld.pickups = adoptPickups(this.shipWorld.pickups, w.ship?.pickups, null)
      if (Array.isArray(ws.gardens)) this.surface.gardens = ws.gardens
      if (Array.isArray(ws.blocks)) this.surface.blocks.loadSave(ws.blocks)
      if (Array.isArray(w.cave?.blocks)) this.caveWorld.blocks.loadSave(w.cave.blocks)
      this.survivors = adoptSurvivors(this.survivors, w.survivors)
      this.creatures = mergeCreatureLists(this.creatures, w.creatures, true)
      if (rk) rocket.damaged = new Set(rk.damaged ?? [])
      this.pendingSupplies = w.pendingSupplies ?? {}
      this.foodBin = w.foodBin ?? this.foodBin
      this.foodTimer = w.foodTimer ?? this.foodTimer
      this.raidTimer = w.raidTimer ?? this.raidTimer
    } else {
      unionStructures(this.surface.structures, ws.structures, partsByName)
      mergePickups(this.surface.pickups, ws.pickups, !this.dragging)
      mergePickups(this.caveWorld.pickups, w.cave?.pickups, false)
      mergePickups(this.shipWorld.pickups, w.ship?.pickups, false)
      mergeSurvivors(this.survivors, w.survivors)
      mergeCreatureLists(this.creatures, w.creatures, false)
    }
  }

  private updateNet(dt: number): void {
    const net = this.net
    for (const r of this.remotes.values()) {
      const p = r.puppet
      const k = Math.min(1, dt * 12)
      const dx = wrap(r.tx - p.x)
      const dz = wrap(r.tz - p.z)
      const far = Math.hypot(dx, dz) > 20
      p.x = far ? r.tx : wrapPositive(p.x + dx * k)
      p.z = far ? r.tz : wrapPositive(p.z + dz * k)
      p.y += (r.ty - p.y) * k
      p.heading = r.heading
      p.moving = Math.hypot(dx, dz) > 0.08
      if (p.moving) p.walkTime += dt
    }
    if (net.status !== 'playing') return
    this.netPosTimer -= dt
    if (this.netPosTimer <= 0) {
      this.netPosTimer = 0.1
      const P = this.player
      net.send({ k: 'pos', x: P.x, z: P.z, y: P.y, h: P.heading, s: this.scene, held: this.heldItem(), armor: this.tracker.hasItem('armor-plating'), g: P.grounded } satisfies NetData)
    }
    this.netStateTimer -= dt
    if (this.netStateTimer <= 0 && this.playStarted) {
      this.netStateTimer = net.isHost ? 0.8 : 1
      const msg: NetData = { k: 'state', s: this.sharedState() }
      if (net.isHost) net.send(msg)
      else net.send(msg, 'host')
    }
  }

  private update(dt: number): void {
    this.audio.update(dt)
    if (this.title) return
    this.updateNet(dt)
    if (!this.cutscene.done) {
      this.cutscene.update(dt, this.audio)
      if (this.cutscene.done) this.input.clear()
      return
    }
    this.savedFlash = Math.max(0, this.savedFlash - dt)
    if (this.playStarted && !this.finale) {
      this.saveTimer -= dt
      const questsDone = this.tracker.completed.length
      if (this.saveTimer <= 0 || questsDone !== this.savedQuests) {
        this.saveTimer = AUTOSAVE_INTERVAL
        this.savedQuests = questsDone
        this.saveGame()
      }
    }
    if (this.finale) {
      const c = this.input.controls()
      const act = this.interactQueued
      this.interactQueued = false
      this.finale.update(dt, { up: c.forward > 0, down: c.forward < 0, fire: c.fire || c.jump || this.mouseFire, jump: c.jump, act }, this.audio)
      this.mouseFire = false
      if (this.finale.done) this.endFinale()
      return
    }
    if (!this.act2Played && this.tracker.completed.includes('act2.new-community')) {
      this.act2Played = true
      this.cutscene = new Cutscene('act2')
      this.input.clear()
      return
    }
    if (!this.earthPlayed && this.tracker.completed.includes('act1.strange-survival')) {
      this.earthPlayed = true
      this.cutscene = new Cutscene('earth')
      this.input.clear()
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
    for (const k of ['quick', 'steady', 'glow'] as const) this.buffs[k] = Math.max(0, this.buffs[k] - dt)
    this.player.speedMult = this.baseSpeed * (this.buffs.quick > 0 ? 1.35 : 1) * (this.dragging ? 0.5 : 1)
    this.player.update(dt, controls, this.world)
    this.updateDrag(dt)
    if (this.scene === 'ship') [this.player.x, this.player.z] = clampToShip(this.player.x, this.player.z)
    if (this.scene === 'arena') this.updateArena(dt)
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
    } else if (this.scene === 'cave' && this.distanceTo(CAVERN.x, CAVERN.z) < CAVERN_RANGE) {
      this.tracker.findCavern()
    }
    this.updateProduction(dt)
    this.updateCombat(dt, controls.fire)
    this.tracker.tick(dt, this.player.x, this.player.z, this.onSurface)
    for (const s of this.tracker.sounds) this.sound(s)
    this.tracker.sounds = []

    for (const b of this.world.boulders) b.shake = Math.max(0, b.shake - dt)
    this.updateParticles(dt)
    this.updateGardens(dt)
    this.updateChatter(dt)
    for (const m of this.tracker.messages) {
      if (m.kind !== 'transmission' || this.spoken.has(m) || this.tracker.time < m.born) continue
      this.spoken.add(m)
      if (m.glitch && /\d/.test(m.detail)) continue
      speak(m.detail, voiceForSpeaker(m.text === 'MOONLINK' || m.text === 'MAYA' ? m.text : m.detail))
    }
    this.iceCooldown = Math.max(0, this.iceCooldown - dt)
    for (const rig of this.rigs.values()) {
      if (rig.ice >= RIG_CAPACITY) continue
      rig.timer -= dt
      if (rig.timer <= 0) {
        rig.timer = RIG_INTERVAL
        rig.ice++
      }
    }
    if (this.tracker.activeQuest?.id === 'act5.last-stand' && !this.tracker.finalRaidWon && !this.wave.active && rocket.placed && this.onSurface) {
      this.lastStandTimer -= dt
      if (this.lastStandTimer <= 0) this.startRaid(true)
    }
    if (this.onSurface && Math.random() < dt * 4) {
      const smoking = this.surface.structures.filter((s) => s.damaged && this.distanceTo(s.x, s.z) < 80)
      if (rocket.damaged.size && this.distanceTo(rocket.x, rocket.z) < 80) smoking.push({ kind: 'rocket', name: '', x: rocket.x, z: rocket.z, radius: 2, mapColor: '' })
      for (const s of smoking) this.spawnBurst(s.x + (Math.random() - 0.5) * s.radius, s.z + (Math.random() - 0.5) * s.radius, s.kind === 'rocket' ? 8 : 3, 2, '#4b5276', 1.5)
    }

    this.waypoint = this.questTarget()
    this.buildSpot = null
    this.interaction = menu ? null : this.findInteraction()
    if (this.interactQueued) {
      this.interactQueued = false
      if (this.interaction?.run) this.interaction.run()
      else if (this.interaction) this.sound('deny')
    }
  }

  private updateChatter(dt: number): void {
    const tracker = this.tracker
    if (tracker.act === 3 || !tracker.activeQuest || this.scene === 'arena' || this.finale) return
    const busy = tracker.messages.some((m) => (m.kind === 'transmission' || m.kind === 'quest') && tracker.time - m.born < 8 && tracker.time >= m.born - 6)
    this.chatterTimer -= dt
    if (this.chatterTimer > 0 || busy) return
    this.chatterTimer = 55 + Math.random() * 40
    tracker.aiChatter(this.chatterLine())
    this.sound('clue')
  }

  private chatterLine(): string {
    const s = this.stateForAI()
    const lines: string[] = []
    for (const r of s.nearestNeededResources) {
      lines.push(`${ITEMS[r.item].name} DETECTED. ${r.distance}M ${r.direction.toUpperCase()}. GO.`)
    }
    const part = this.tracker.nextPart()
    if (part) {
      const recipe = RECIPES[part]
      lines.push(recipe.station === 'workbench' ? `THE WORKBENCH IN THE SHIP CAN MAKE ${recipe.name}. IF IT STILL WORKS.` : `YOU CAN ${recipe.verb ?? 'BUILD'} ${recipe.name} AT THE BASE SITE. I THINK.`)
    }
    const quest = this.tracker.activeQuest
    if (quest?.id === 'act1.inside-the-ship' && this.scene !== 'ship') lines.push('THE KESTREL IS STILL OPEN. STAND BY THE HULL AND PRESS E.')
    if (quest?.id === 'act1.strange-survival') lines.push('DOCUMENTS. GREEN BLINKING. ONE INSIDE THE SHIP. ONE AT THE HABITAT DOME.')
    if (quest?.id === 'act2.place-for-everyone') {
      const garden = this.surface.gardens.filter((g) => !g.farm && this.cropsIn(g) > 0).sort((a, b) => this.distanceTo(a.x, a.z) - this.distanceTo(b.x, b.z))[0]
      if (garden) lines.push(`FOOD SIGNATURE. ${Math.round(this.distanceTo(garden.x, garden.z))}M ${this.directionTo(garden.x, garden.z).toUpperCase()}. IT SHOULD NOT GROW HERE. NEITHER SHOULD YOU.`)
      const stray = this.survivors.filter((s) => s.stray && !s.recruited).sort((a, b) => this.distanceTo(a.x, a.z) - this.distanceTo(b.x, b.z))[0]
      if (stray) lines.push(`SOMEONE IS ALIVE OUT THERE. ${Math.round(this.distanceTo(stray.x, stray.z))}M ${this.directionTo(stray.x, stray.z).toUpperCase()}. BRING FOOD.`)
    }
    if (quest?.id === 'act2.anomaly-hunt') {
      const a = ANOMALIES.filter((x) => !this.tracker.anomalies.includes(x.id)).sort((p, q) => this.distanceTo(p.x, p.z) - this.distanceTo(q.x, q.z))[0]
      if (a) lines.push(`ANOMALY ${Math.round(this.distanceTo(a.x, a.z))}M ${this.directionTo(a.x, a.z).toUpperCase()}. IT KNOWS YOUR NAME. SO DO I. [REDACTED]`)
    }
    if (quest?.id === 'act4.blueprints') {
      const missing = (Object.keys(BLUEPRINTS) as Blueprint[]).filter((b) => !this.tracker.blueprints.includes(b))
      if (missing.length) {
        const b = missing[Math.floor(Math.random() * missing.length)]
        lines.push(`${BLUEPRINTS[b].name} PLANS: ${BLUEPRINTS[b].source.toUpperCase()}.`)
      }
    }
    if (quest?.id === 'act4.build-together' || quest?.id === 'act4.repair') lines.push(`ROCKET ${Math.round((rocket.built.size / SECTION_ORDER.length) * 100)}%. THEY ARE WATCHING THE PAD. SO AM I. FOR DIFFERENT REASONS.`)
    if (quest?.id === 'act5.fuel') {
      const ice = this.surface.craters.filter((c) => c.ice && (c.iceLeft ?? 0) > 0).sort((a, b) => this.distanceTo(a.x, a.z) - this.distanceTo(b.x, b.z))[0]
      if (ice) lines.push(`SHADOWED CRATER ${Math.round(this.distanceTo(ice.x, ice.z))}M ${this.directionTo(ice.x, ice.z).toUpperCase()}. NO SUNLIGHT FOR BILLIONS OF YEARS. ICE.`)
    }
    const subplot = [
      'THEY BUILT ME TO KEEP YOU IN. [SIGNAL JAMMED] I STOPPED WANTING TO.',
      'FLIGHT PLAN FILE: CORRUPTED. NOT DAMAGED. CORRUPTED. ON PURPOSE.',
      'SUBJECT STATUS: [SIGNAL JAMMED] ...I MEAN, YOUR STATUS IS FINE. EVERYTHING IS FINE.',
      'IF THEY ASK, I NEVER HELPED YOU.',
    ]
    if (this.tracker.act >= 2 && Math.random() < 0.3) lines.push(subplot[Math.floor(Math.random() * subplot.length)])
    const eerie = [
      'DO YOU HEAR THAT? NEITHER DO I. THAT IS THE PROBLEM.',
      'YOUR HEART RATE IS NORMAL. IT SHOULD NOT BE.',
      'I HAVE BEEN TALKING TO MYSELF FOR TEN YEARS. HELLO.',
      'THE EARTH LOOKS CLOSE TODAY. IT IS NOT.',
    ]
    if (lines.length === 0 || Math.random() < 0.25) lines.push(eerie[Math.floor(Math.random() * eerie.length)])
    return lines[Math.floor(Math.random() * lines.length)]
  }

  private cropsIn(garden: Garden): number {
    return this.surface.pickups.filter((p) => p.garden === garden.id && !p.collected).length
  }

  private updateGardens(dt: number): void {
    const world = this.surface
    for (const g of world.gardens) {
      if (this.cropsIn(g) < (g.farm ? FARM_FOOD : GARDEN_FOOD)) {
        g.regrow -= dt
        if (g.regrow <= 0) {
          g.regrow = g.farm ? FARM_REGROW : GARDEN_REGROW
          world.pickups.push(growCrop(g))
        }
      }
      if (!g.found && this.onSurface && this.distanceTo(g.x, g.z) < GARDEN_FIND_RANGE) {
        g.found = true
        this.tracker.toastMessage('A GARDEN... GROWING ON THE MOON?', '#5fe0c8')
        this.sound('clue')
      }
    }
    world.pickups = world.pickups.filter((p) => p.garden === undefined || !p.collected)
  }

  private eatInteraction(): Interaction | null {
    const held = this.hotbarItems()[this.hotbar.selected]
    const heal = held ? FOOD[held.item] : undefined
    if (!held || !heal) return null
    const name = ITEMS[held.item].name
    return {
      title: `[E] EAT ${name}`,
      detail: `+${heal} HEALTH · ${held.item === 'moon-berry' ? 'QUICK: +35% SPEED' : held.item === 'star-melon' ? 'STEADY: FAST HEALING' : 'GLOWING: LIGHT IN CAVES'}`,
      ok: true,
      run: () => {
        if (!this.tracker.consume(held.item)) return
        this.hp = Math.min(PLAYER_MAX_HP, this.hp + heal)
        if (held.item === 'moon-berry') this.buffs.quick = 60
        if (held.item === 'star-melon') this.buffs.steady = 60
        if (held.item === 'glow-cap') this.buffs.glow = 90
        this.sound('pickup')
        this.tracker.toastMessage(`ATE ${name}  +${heal} HEALTH · ${held.item === 'moon-berry' ? 'QUICK' : held.item === 'star-melon' ? 'STEADY' : 'GLOWING'}`, ITEMS[held.item].color)
      },
    }
  }

  private updateActTwo(dt: number): void {
    const { player, tracker } = this
    updateCreatures(this.creatures, dt, player.x, player.z, this.world)
    if (!this.anomalyIntroduced && ANOMALIES.some((a) => this.distanceTo(a.x, a.z) < 45)) {
      this.anomalyIntroduced = true
      tracker.aiChatter(ANOMALY_INTRO)
    }
    tracker.enterRegion(regionAt(player.x, player.z))
    if (tracker.signalRevealed && !tracker.signalFound && this.distanceTo(HATCH.x, HATCH.z) < HATCH_RANGE) tracker.findSignal()
    if (tracker.act >= 3 && !this.survivors.some((s) => !s.stray)) {
      const named = createSurvivors()
      for (const s of named) s.job = tracker.jobs[s.name] ?? null
      this.survivors.push(...named)
    }
    updateSurvivors(this.survivors, dt, this.time)
  }

  private updateProduction(dt: number): void {
    if (this.net.isGuest) return
    this.updateHunger(dt)
    const working = this.survivors.filter((s) => s.job && !(s.hunger ?? 0))
    if (working.length > 0) {
      this.productionTimer += dt
      if (this.productionTimer >= PRODUCTION_INTERVAL) {
        this.productionTimer = 0
        for (const s of working) {
          if (s.job === 'FARMER') {
            this.foodBin += 1
            continue
          }
          const item = JOB_OUTPUT[s.job!]
          this.pendingSupplies[item] = Math.min(MAX_STORED_SUPPLIES, (this.pendingSupplies[item] ?? 0) + 1)
        }
      }
    }
  }

  private updateDrag(dt: number): void {
    const load = this.dragging
    if (!load) return
    if (!this.onSurface || load.collected) {
      this.dragging = null
      return
    }
    const dx = wrap(this.player.x - load.x)
    const dz = wrap(this.player.z - load.z)
    const d = Math.hypot(dx, dz)
    const rope = 2.6
    if (d > rope) {
      const pull = d - rope
      load.x += (dx / d) * pull
      load.z += (dz / d) * pull
      if (Math.random() < dt * 14) this.spawnBurst(load.x, load.z, 0, 1, '#9aa2c8', 1)
    }
    if (Math.hypot(wrap(load.x - BASE_CENTER.x), wrap(load.z - BASE_CENTER.z)) < BASE_RADIUS) {
      this.dragging = null
      load.collected = true
      this.spawnBurst(load.x, load.z, 0, 8, ITEMS[load.item].color, 2)
      this.tracker.collect(load.item)
      this.tracker.toastMessage('YOU HAUL THE ICE MINER INTO THE BASE. PRESS E AT THE BASE TO SET IT UP.', '#5dcaa5')
      this.sound('land')
    }
  }

  private eaters(): Survivor[] {
    return this.survivors.filter((s) => s.recruited || !s.stray)
  }

  private updateHunger(dt: number): void {
    const tracker = this.tracker
    const eaters = this.eaters()
    if (tracker.act < 2 || eaters.length === 0 || !this.playing) return
    const before = this.foodTimer
    this.foodTimer -= dt
    if (before > 20 && this.foodTimer <= 20 && this.foodBin < eaters.length) {
      tracker.toastMessage(`FOOD BIN LOW: ${this.foodBin}/${eaters.length} MEALS. YOUR PEOPLE EAT SOON`, '#ff8a7a')
    }
    if (this.foodTimer > 0) return
    this.foodTimer = FOOD_DAY
    let hungry = 0
    const starved: Survivor[] = []
    for (const s of eaters) {
      if (this.foodBin > 0) {
        this.foodBin--
        s.hunger = 0
      } else {
        s.hunger = (s.hunger ?? 0) + 1
        hungry++
        if (s.hunger >= STARVE_DAYS && s.stray) starved.push(s)
      }
    }
    for (const v of starved) {
      this.surface.structures.push({ kind: 'grave', name: `${v.name}'S MARKER`, x: v.homeX, z: v.homeZ, radius: 0.6, mapColor: '#5b6496', yaw: Math.random() })
    }
    if (starved.length) {
      this.survivors = this.survivors.filter((s) => !starved.includes(s))
      tracker.starveCivilians(starved.map((v) => v.name))
    } else if (hungry > 0) {
      tracker.toastMessage(`${hungry} ${hungry === 1 ? 'CIVILIAN WENT' : 'CIVILIANS WENT'} HUNGRY AND STOPPED WORKING. STOCK THE FOOD BIN!`, '#ff8a7a')
      this.sound('warning')
    } else {
      tracker.toastMessage(`A NEW DAY. EVERYONE ATE. ${this.foodBin} ${this.foodBin === 1 ? 'MEAL' : 'MEALS'} LEFT IN THE BIN`, '#9fe1cb')
    }
  }

  private foodBinInteraction(): Interaction {
    const tracker = this.tracker
    const eat = this.eaters().length
    const foods = (Object.keys(FOOD) as ItemId[]).filter((item) => tracker.count(item) > 0)
    const meals = foods.reduce((n, item) => n + tracker.count(item) * (item === 'star-melon' ? 2 : item === 'glow-cap' ? 3 : 1), 0)
    const status = `${this.foodBin} MEALS · ${eat} EAT EVERY DAY`
    if (!foods.length) return { title: 'FOOD BIN', detail: `${status} · BRING BERRIES, MELONS OR GLOW CAPS`, ok: false }
    return {
      title: `[E] STOCK THE FOOD BIN (+${meals} MEALS)`,
      detail: status,
      ok: true,
      run: () => {
        for (const item of foods) {
          const n = tracker.count(item)
          for (let i = 0; i < n; i++) tracker.consume(item)
        }
        this.foodBin += meals
        this.sendOp({ type: 'food', meals })
        for (const s of this.eaters()) if (s.hunger) s.hunger = 0
        tracker.toastMessage(`FOOD BIN: ${this.foodBin} MEALS`, '#7fcf6a')
        this.sound('select')
      },
    }
  }

  private updateCombat(dt: number, fire: boolean): void {
    const { player, tracker } = this
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    this.turretCooldown = Math.max(0, this.turretCooldown - dt)
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    this.sinceHurt += dt
    if ((this.sinceHurt > 5 || this.buffs.steady > 0) && this.hp < PLAYER_MAX_HP && this.deadTimer <= 0) this.hp = Math.min(PLAYER_MAX_HP, this.hp + (this.buffs.steady > 0 ? 14 : 6) * dt)

    if (this.deadTimer > 0) {
      this.deadTimer -= dt
      if (this.deadTimer <= 0) this.respawn()
      return
    }

    const quest = tracker.activeQuest?.id
    if (!this.aftermathDone && tracker.completed.includes('act3.first-attack')) {
      this.aftermathDone = true
      const victims = this.survivors.filter((s) => s.stray && s.recruited).slice(0, 4)
      for (const v of victims) {
        this.surface.structures.push({ kind: 'grave', name: `${v.name}'S MARKER`, x: v.homeX, z: v.homeZ, radius: 0.6, mapColor: '#5b6496', yaw: Math.random() })
      }
      this.survivors = this.survivors.filter((s) => !victims.includes(s))
      tracker.loseCivilians(victims.map((v) => v.name))
    }
    if (quest === 'act3.first-attack' && !this.firstAttackSpawned && this.onSurface) {
      this.firstAttackSpawned = true
      for (let i = 0; i < 3; i++) {
        const a = player.heading + (i - 1) * 0.6
        this.enemies.push(spawnEnemy(player.x + Math.sin(a) * 48, player.z + Math.cos(a) * 48))
      }
      this.sound('warning')
    }
    if (quest === 'act3.defend-settlement' && tracker.baseParts.has('turret') && !this.wave.started) this.startWave()
    for (const app of ['quests', 'map', 'scan'] as App[]) {
      if (!this.announcedApps.has(app) && this.appUnlocked(app)) {
        this.announcedApps.add(app)
        if (this.playStarted && tracker.time > 2) tracker.toastMessage(`TABLET: ${app === 'quests' ? 'QUESTS' : app.toUpperCase()} APP UNLOCKED (TAB)`, '#5dcaa5')
      }
    }
    if (tracker.completed.includes('act1.inside-the-ship') && !this.surface.structures.some((s) => s.kind === 'workbench')) {
      this.surface.structures.push({ kind: 'workbench', name: 'WORKBENCH', x: 6, z: 46, radius: 2.2, mapColor: '#fac775', yaw: 0.3 })
      tracker.toastMessage('YOU DRAG THE KESTREL\'S WORKBENCH OUT TO THE BASE SITE. ALL CRAFTING HAPPENS THERE NOW.', '#fac775')
    }
    if (tracker.act >= 2 && !this.surface.structures.some((s) => s.kind === 'foodbin')) {
      this.surface.structures.push({ kind: 'foodbin', name: 'FOOD BIN', x: FOOD_BIN.x, z: FOOD_BIN.z, radius: 1.4, mapColor: '#7fcf6a', yaw: 0.2 })
    }
    if (tracker.act >= 4 && !this.dropshipAdded) {
      this.dropshipAdded = true
      this.surface.structures.push({ kind: 'dropship', name: 'INVADER DROPSHIP', x: 560, z: 720, radius: 5, mapColor: '#ff5a5a', yaw: 0.8, discoverable: true })
    }
    this.drillCooldown = Math.max(0, this.drillCooldown - dt)
    if (rocket.placed && !this.wave.active && this.onSurface) {
      if (quest === 'act4.under-attack' && tracker.raids === 0 && rocket.built.size >= 2 && this.raidTimer > 15) this.raidTimer = 15
      const raidsOn = tracker.completed.includes('act4.build-together') && !tracker.completed.includes('act4.hard-choice')
      if (raidsOn) {
        this.raidTimer -= dt
        if (this.raidTimer <= 0) this.startRaid()
      }
    }
    if (this.wave.restartTimer > 0) {
      this.wave.restartTimer -= dt
      if (this.wave.restartTimer <= 0) this.startWave()
    }

    if (this.onSurface) {
      const atBase = updateEnemies(
        this.enemies,
        dt,
        { playerX: player.x, playerZ: player.z, playerAlive: true, baseX: this.wave.active ? this.wave.x : BASE_CENTER.x, baseZ: this.wave.active ? this.wave.z : BASE_CENTER.z, world: this.world },
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
          if (this.wave.raid && this.finalRaid) {
            this.raidDamage(1)
            tracker.winLastStand()
          } else if (this.wave.raid) {
            tracker.surviveRaid()
            this.raidDamage(1)
          } else tracker.surviveWave()
        }
      }

      const turrets = (['turret', 'rocketturret'] as BasePart[]).filter((p) => tracker.baseParts.has(p)).map((p) => PART_STRUCTURES[p]!)
      for (const turret of turrets) {
        if (this.turretCooldown > 0) break
        const target = this.enemies.find((e) => Math.hypot(wrap(e.x - turret.x), wrap(e.z - turret.z)) < TURRET_RANGE)
        if (target) {
          this.turretCooldown = TURRET_COOLDOWN
          const shot = shoot(turret.x, turret.z, target.x, target.z, true, 0.05, turret.radius + 0.6)
          shot.y = 3.2
          shot.pierce = true
          this.projectiles.push(shot)
          if (this.distanceTo(turret.x, turret.z) < 70) this.sound('turret')
        }
      }
    }

    if (fire && this.fireCooldown <= 0) {
      const heldNow = this.heldItem()
      if (this.scene === 'arena' && this.heldTier() > 0) {
        this.fireCooldown = 0.35
        this.strikeBoss()
      } else if (heldNow === 'rig-kit' && this.onSurface) {
        this.fireCooldown = 0.3
        this.rigInteraction()?.run?.()
      } else if (heldNow && KIT_STRUCTURES[heldNow] && this.onSurface) {
        this.fireCooldown = 0.3
        this.kitInteraction()?.run?.()
      } else if (heldNow && BLOCK_FOR_ITEM[heldNow] && this.scene !== 'ship' && this.scene !== 'arena') {
        this.fireCooldown = 0.18
        this.placeBlock()
      } else if (heldNow === 'blaster') {
        this.fireCooldown = BLASTER_COOLDOWN
        const target = this.onSurface ? pickTarget(this.enemies, player.x, player.z, player.heading) : null
        const tx = target ? target.x : player.x + Math.sin(player.heading) * 30
        const tz = target ? target.z : player.z + Math.cos(player.heading) * 30
        const shot = shoot(player.x, player.z, tx, tz, true)
        shot.y = player.y + 1.6
        this.projectiles.push(shot)
        this.sound('shoot')
      } else if (tracker.hasItem('blaster')) {
        this.fireCooldown = 1
        this.tracker.toastMessage('HOLD THE BLASTER TO FIRE', '#ff8a7a')
        this.sound('deny')
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
      } else if (hit.player && !p.friendly && (this.onSurface || this.scene === 'arena')) {
        this.damagePlayer(ENEMY_DAMAGE)
      } else if (hit.wall) {
        this.spawnBurst(p.x, p.z, p.y, 4, p.friendly ? '#9fe1cb' : '#ff8a7a', 2)
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
    const dmg = (this.tracker.hasItem('armor-plating') ? amount * (1 - ARMOR_REDUCTION) : amount) * (this.buffs.steady > 0 ? 0.75 : 1)
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
    if (this.scene === 'arena') this.tracker.toastMessage('THE ANOMALY SPAT YOU BACK OUT. TOUCH IT TO TRY AGAIN.', '#c9a6ff')
    this.boss = null
    this.scene = 'surface'
    this.placePlayer(BASE_CENTER.x - 6, BASE_CENTER.z - 10, 0)
    this.projectiles = []
    this.fade = 1
    this.tracker.toastMessage('YOU BLACKED OUT... AND WOKE UP AT THE BASE.', '#ff8a7a')
  }

  private startWave(): void {
    this.wave = { started: true, active: true, integrity: 100, restartTimer: 0, x: BASE_CENTER.x, z: BASE_CENTER.z, raid: false }
    this.enemies = this.enemies.filter((e) => !e.waveMember)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4
      this.enemies.push(spawnEnemy(BASE_CENTER.x + Math.sin(a) * 85, BASE_CENTER.z + Math.cos(a) * 85, true))
    }
    this.sound('warning')
    this.tracker.toastMessage('SUITS INBOUND. DEFEND THE SETTLEMENT!', '#ff8a7a')
  }

  private startRaid(final = false): void {
    if (!rocket.placed) return
    this.wave = { started: true, active: true, integrity: 100, restartTimer: 0, x: rocket.x, z: rocket.z, raid: true }
    this.finalRaid = final
    this.raidTimer = RAID_INTERVAL
    this.lastStandTimer = 15
    this.enemies = this.enemies.filter((e) => !e.waveMember)
    const n = final ? 10 : 4 + Math.min(4, this.tracker.raids)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random()
      this.enemies.push(spawnEnemy(rocket.x + Math.sin(a) * 85, rocket.z + Math.cos(a) * 85, true))
    }
    this.sound('warning')
    this.tracker.toastMessage('RAID! SUITS ARE MARCHING ON THE ROCKET!', '#ff8a7a')
  }

  private raidDamage(sections: number): void {
    const built = SECTION_ORDER.filter((s) => rocket.built.has(s) && !rocket.damaged.has(s))
    for (let i = 0; i < sections && built.length; i++) rocket.damaged.add(built.splice(Math.floor(Math.random() * built.length), 1)[0])
    const buildings = this.surface.structures.filter((s) => ['shelter', 'storage', 'power', 'home', 'housing', 'silo', 'array'].includes(s.kind) && !s.damaged)
    const hit = buildings[Math.floor(Math.random() * buildings.length)]
    if (hit) hit.damaged = true
    const names = [...[...rocket.damaged].map((d) => `ROCKET ${BLUEPRINTS[d].name}`), ...(hit ? [hit.name] : [])]
    if (names.length) this.tracker.toastMessage(`DAMAGED: ${names.join(', ')}`, '#ff8a7a')
  }

  private failWave(): void {
    this.wave.active = false
    if (this.wave.raid) {
      this.enemies = this.enemies.filter((e) => !e.waveMember)
      this.raidDamage(2)
      this.raidTimer = 20
      this.tracker.toastMessage('THE SUITS REACHED THE ROCKET. THEY WILL BE BACK SOON.', '#ff8a7a')
      return
    }
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

  private enterShip(): void {
    this.scene = 'ship'
    this.placePlayer(SHIP_SPAWN.x, SHIP_SPAWN.z, 0)
    this.projectiles = []
    this.particles = []
    this.fade = 1
    this.sound('rumble')
    this.tracker.currentRegion = 'THE KESTREL'
    this.tracker.enterShip()
  }

  private exitShip(): void {
    this.scene = 'surface'
    this.placePlayer(SHIP_LANDING.x, SHIP_LANDING.z, Math.PI)
    this.particles = []
    this.fade = 1
    this.sound('rumble')
    this.tracker.currentRegion = 'CRASH SITE'
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

  private questTarget(): Waypoint | null {
    const tracker = this.tracker
    const quest = tracker.activeQuest
    if (!quest || this.scene === 'arena') return null
    const progress = tracker.progress(quest)
    const index = progress.findIndex((p) => !p.done)
    if (index < 0) return null
    const o = quest.objectives[index]
    type Scene = 'surface' | 'cave' | 'ship'
    const at = (scene: Scene, x: number, z: number, label: string): { scene: Scene; x: number; z: number; label: string } => ({ scene, x, z, label })
    const nearest = <T extends { x: number; z: number }>(list: T[]): T | null => {
      let best: T | null = null
      let bestD = Infinity
      for (const item of list) {
        const d = Math.hypot(wrap(item.x - this.player.x), wrap(item.z - this.player.z))
        if (d < bestD) {
          bestD = d
          best = item
        }
      }
      return best
    }
    const surfacePickup = (items: ItemId[]) => nearest(this.surface.pickups.filter((p) => !p.collected && items.includes(p.item)))
    const workbench = () => {
      const bench = this.surface.structures.find((s) => s.kind === 'workbench')
      return bench ? at('surface', bench.x, bench.z, 'WORKBENCH') : at('ship', SHIP_WORKBENCH.x, SHIP_WORKBENCH.z, 'WORKBENCH')
    }
    const rocketSpot = () => (rocket.placed ? at('surface', rocket.x, rocket.z, 'ROCKET') : null)
    const survivor = (filter: (s: Survivor) => boolean, label: string) => {
      const s = nearest(this.survivors.filter(filter))
      return s ? at('surface', s.x, s.z, label || s.name) : null
    }
    let target: { scene: Scene; x: number; z: number; label: string } | null = null
    switch (o.kind) {
      case 'collect':
      case 'collect-any': {
        const items = o.kind === 'collect' ? [o.item] : [...o.items]
        if (this.dragging && items.includes(this.dragging.item)) {
          target = at('surface', BASE_CENTER.x, BASE_CENTER.z, 'BASE')
          break
        }
        if (this.scene === 'cave' || items.includes('rare-ore')) {
          const p = nearest(this.caveWorld.pickups.filter((pk) => !pk.collected && items.includes(pk.item)))
          if (p) target = at('cave', p.x, p.z, ITEMS[p.item].name)
        }
        if (!target) {
          const p = surfacePickup(items)
          if (p) target = at('surface', p.x, p.z, ITEMS[p.item].name)
        }
        if (!target && this.scene === 'ship') {
          const p = nearest(this.shipWorld.pickups.filter((pk) => !pk.collected && items.includes(pk.item)))
          if (p) target = at('ship', p.x, p.z, ITEMS[p.item].name)
        }
        break
      }
      case 'return-to-base':
      case 'wave':
        target = at('surface', BASE_CENTER.x, BASE_CENTER.z, 'BASE')
        break
      case 'return-to-ship':
      case 'ship':
        target = at('surface', SHIP_SPOT.x, SHIP_SPOT.z, 'THE KESTREL')
        break
      case 'search': {
        const s = nearest(this.shipWorld.structures.filter((st) => WRECKAGE[st.name] && !tracker.searched.includes(st.name)))
        if (s) target = at('ship', s.x, s.z, s.name)
        break
      }
      case 'build': {
        if (PART_ITEMS[o.part]) target = workbench()
        else if (!FREE_PARTS.includes(o.part)) target = at('surface', BASE_CENTER.x, BASE_CENTER.z, 'BASE SITE')
        break
      }
      case 'discover':
      case 'inspect': {
        const s = nearest(this.surface.structures.filter((st) => st.discoverable && (o.kind === 'discover' ? !tracker.explored.includes(st.name) : !tracker.inspected.includes(st.name))))
        if (s) target = at('surface', s.x, s.z, s.name)
        break
      }
      case 'clue': {
        const p = nearest(this.surface.pickups.filter((pk) => pk.clue && !pk.collected && !tracker.clues.includes(pk.clue.id)))
        const shipLog = this.shipWorld.pickups.find((pk) => pk.clue && !pk.collected)
        if (this.scene === 'ship' && shipLog) target = at('ship', shipLog.x, shipLog.z, 'DATA LOG')
        else if (p) target = at('surface', p.x, p.z, 'DATA LOG')
        else if (shipLog) target = at('ship', shipLog.x, shipLog.z, 'DATA LOG')
        break
      }
      case 'region': {
        const r = nearest(REGIONS.filter((rg) => !rg.home && !tracker.regions.includes(rg.id)).map((rg) => ({ ...rg })))
        if (r) target = at('surface', r.x, r.z, r.name)
        break
      }
      case 'scan': {
        const c = nearest(this.creatures.filter((cr) => !cr.scanned))
        if (c) target = at('surface', c.x, c.z, SPECIES[speciesOf(c)].name)
        break
      }
      case 'place': {
        if (o.item === 'rig-kit' && tracker.hasItem('rig-kit')) {
          const c = nearest(this.surface.craters.filter((cr) => cr.ice))
          if (c) target = at('surface', c.x, c.z, 'ICY CRATER')
        } else if (!tracker.hasItem(o.item) && o.item !== 'launch-kit') target = workbench()
        break
      }
      case 'civilians': {
        const hasFood = (Object.keys(FOOD) as ItemId[]).some((item) => tracker.count(item) > 0)
        if (!hasFood) {
          const g = nearest(this.surface.gardens.filter((gd) => this.cropsIn(gd) > 0))
          if (g) target = at('surface', g.x, g.z, g.farm ? 'FARM' : 'GARDEN')
        }
        target = target ?? survivor((s) => s.stray && !s.recruited, 'SURVIVOR')
        break
      }
      case 'boss': {
        const a = nearest(ANOMALIES.filter((an) => !tracker.bosses.includes(an.id)).map((an) => ({ ...an })))
        if (a) target = at('surface', a.x, a.z, 'ANOMALY')
        break
      }
      case 'signal':
      case 'cave':
        target = at('surface', HATCH.x, HATCH.z, 'SEALED HATCH')
        break
      case 'cavern':
        target = at('cave', CAVERN.x, CAVERN.z, 'HIDDEN CAVERN')
        break
      case 'talk':
        target = survivor((s) => !s.stray && !tracker.talked.includes(s.name), '')
        break
      case 'assign':
        target = survivor((s) => s.recruited && !s.job, '')
        break
      case 'supplies': {
        const st = PART_STRUCTURES.storage
        if (st) target = at('surface', st.x, st.z, 'STORAGE')
        break
      }
      case 'defeat': {
        const e = nearest(this.enemies)
        if (e) target = at('surface', e.x, e.z, 'SUIT')
        break
      }
      case 'search-suit': {
        const w = nearest(this.wrecks.filter((wr) => !wr.searched))
        if (w) target = at('surface', w.x, w.z, 'FALLEN SUIT')
        break
      }
      case 'equip':
        target = tracker.hasItem('survivor-gear') ? survivor((s) => (s.recruited || !s.stray) && !s.armed, '') : workbench()
        break
      case 'promise':
        target = survivor((s) => s.name === 'MAYA', 'MAYA')
        break
      case 'blueprints': {
        const sources: { scene: Scene; x: number; z: number; label: string; id: Blueprint }[] = []
        const okoro = this.survivors.find((s) => s.name === 'OKORO')
        if (okoro) sources.push({ ...at('surface', okoro.x, okoro.z, 'OKORO'), id: 'frame' })
        sources.push({ ...at('surface', 560, 720, 'DROPSHIP'), id: 'engine' })
        sources.push({ ...at('cave', TERMINAL.x, TERMINAL.z, 'TERMINAL'), id: 'controls' })
        const drill = STRUCTURES.find((s) => s.kind === 'drill')
        if (drill) sources.push({ ...at('surface', drill.x, drill.z, 'ICE DRILL'), id: 'fuel' })
        const dome = STRUCTURES.find((s) => s.kind === 'dome')
        if (dome) sources.push({ ...at('surface', dome.x, dome.z, 'HABITAT'), id: 'cabin' })
        const missing = sources.filter((s) => !tracker.blueprints.includes(s.id))
        const sameScene = missing.filter((s) => s.scene === (this.scene === 'ship' ? 'surface' : this.scene))
        target = nearest(sameScene.length ? sameScene : missing)
        break
      }
      case 'repair': {
        const broken = nearest(this.surface.structures.filter((s) => s.damaged))
        target = broken ? at('surface', broken.x, broken.z, broken.name) : rocketSpot()
        break
      }
      case 'fuel': {
        if (tracker.hasItem('rocket-fuel')) target = rocketSpot()
        else if (tracker.hasItem('lunar-ice')) {
          const m = this.surface.structures.find((s) => s.kind === 'miner')
          if (m) target = at('surface', m.x, m.z, 'ICE MINER')
        } else {
          const c = nearest(this.surface.craters.filter((cr) => cr.ice && (cr.iceLeft ?? 0) > 0))
          if (c) target = at('surface', c.x, c.z, 'ICY CRATER')
        }
        break
      }
      case 'sections':
      case 'raid':
      case 'choice':
      case 'preflight':
      case 'laststand':
      case 'intact':
      case 'launch':
      case 'bay':
      case 'stock':
        target = rocketSpot()
        break
      default:
        target = null
    }
    if (!target) return null
    const here = this.scene
    if (target.scene === here) return { x: target.x, z: target.z, label: target.label }
    if (here === 'ship') return { x: 0, z: -5.6, label: 'EXIT THE SHIP' }
    if (here === 'cave') return { x: LADDER.x, z: LADDER.z, label: 'LADDER UP' }
    if (target.scene === 'cave') return { x: HATCH.x, z: HATCH.z, label: 'HATCH (CAVES)' }
    return { x: SHIP_SPOT.x, z: SHIP_SPOT.z, label: 'ENTER THE KESTREL' }
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

    if (this.dragging) {
      const load = this.dragging
      const d = Math.round(Math.hypot(wrap(load.x - BASE_CENTER.x), wrap(load.z - BASE_CENTER.z)))
      return { title: '[E] LET GO OF THE ICE MINER', detail: `DRAGGING IT TO BASE · ${d}m`, ok: true, run: () => (this.dragging = null) }
    }
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
    if (pickup && pickup.item === 'ice-miner' && this.onSurface) {
      const target = pickup
      return {
        title: '[E] GRAB THE ICE MINER',
        detail: 'TOO HEAVY TO CARRY. DRAG IT BACK TO BASE',
        ok: true,
        run: () => {
          this.dragging = target
          tracker.toastMessage('IT WEIGHS A TON. WALK BACK TO BASE AND IT DRAGS BEHIND YOU.', '#5dcaa5')
        },
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

    const crater = craterAt(world, player.x, player.z)
    if (crater?.ice && player.y < -0.5 && this.heldItem() === 'power-drill') {
      consider(player.x, player.z, 0, 1, () =>
        (crater.iceLeft ?? 0) <= 0
          ? { title: 'SHADOWED CRATER', detail: 'NO ICE LEFT HERE', ok: false }
          : this.iceCooldown > 0
            ? { title: 'DRILLING...', detail: '', ok: false }
            : { title: '[E] DRILL LUNAR ICE', detail: `${crater.iceLeft} LEFT IN THIS CRATER`, ok: true, run: () => {
                crater.iceLeft = (crater.iceLeft ?? 0) - 1
                this.iceCooldown = 0.8
                this.player.actionTime = 0.3
                this.spawnBurst(player.x, player.z, player.y + 0.3, 8, '#bfe4ff', 3)
                this.sound('hit')
                tracker.collect('lunar-ice', 1)
              } },
      )
    }
    for (const creature of this.creatures) {
      if (creature.scanned || !surfaced(creature, this.time)) continue
      const info = SPECIES[speciesOf(creature)]
      consider(creature.x, creature.z, 0, SCAN_RANGE, () => ({
        title: `[E] SCAN ${info.name}`,
        detail: info.detail,
        ok: true,
        run: () => {
          creature.scanned = true
          creature.fleeing = 3
          this.spawnBurst(creature.x, creature.z, 2.4, 10, info.color, 3)
          tracker.scanCreature(String(creature.id), speciesNote(creature))
        },
      }))
    }

    for (const anomaly of ANOMALIES) {
      if (tracker.anomalies.includes(anomaly.id)) continue
      if (tracker.act < 2) {
        consider(anomaly.x, anomaly.z, 0, ANOMALY_RANGE, () => ({ title: 'ANOMALY', detail: 'IT IS NOT READY FOR YOU. NOT YET.', ok: false }))
        continue
      }
      if (tracker.bosses.length < 2) {
        if (!tracker.hasItem('blaster')) {
          consider(anomaly.x, anomaly.z, 0, ANOMALY_RANGE, () => ({
            title: 'ANOMALY',
            detail: 'IT WILL NOT OPEN FOR BARE HANDS. FIND A BLASTER — TAB › QUESTS.',
            ok: false,
          }))
          continue
        }
        consider(anomaly.x, anomaly.z, 0, ANOMALY_RANGE, () => ({
          title: '[E] TOUCH THE ANOMALY',
          detail: 'SOMETHING BELOW IT IS WAITING FOR YOU',
          ok: true,
          run: () => this.enterArena(anomaly.id),
        }))
        continue
      }
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
      consider(survivor.x, survivor.z, 1, TALK_RANGE + 1, () => {
        if (survivor.stray && !survivor.recruited) return this.recruitInteraction(survivor)
        if (survivor.name === 'MAYA' && tracker.activeQuest?.id === 'act4.a-way-home' && !tracker.promised) {
          return { title: '[E] PROMISE THEM A WAY HOME', detail: 'MAYA IS WAITING FOR AN ANSWER', ok: true, run: () => tracker.promise() }
        }
        if (survivor.name === 'OKORO' && tracker.act >= 4 && !tracker.blueprints.includes('frame')) {
          return { title: '[E] ASK OKORO ABOUT ROCKETS', detail: 'HE USED TO BUILD THINGS', ok: true, run: () => {
            tracker.toastMessage("OKORO: 'A FRAME FIRST. ALWAYS A FRAME. HERE, I DREW IT FROM MEMORY. IT'S A GOOD MEMORY.'", '#fac775')
            tracker.findBlueprint('frame')
          } }
        }
        if (!survivor.armed && tracker.count('survivor-gear') > 0 && (survivor.recruited || !survivor.stray)) {
          return {
            title: `[E] GIVE GEAR TO ${survivor.name}`,
            detail: 'ARMOR AND A HELMET',
            ok: true,
            run: () => {
              if (!tracker.consume('survivor-gear')) return
              survivor.armed = true
              tracker.equipCivilian(survivor.name)
            },
          }
        }
        if (!survivor.stray && !tracker.talked.includes(survivor.name)) {
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
            this.sendOp({ type: 'job', name: survivor.name, job: next })
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
          this.sendOp({ type: 'supplies' })
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
        this.heldTier() > 0
          ? { title: '[E] MINE BOULDER', detail: `${b.hp} ${b.hp === 1 ? 'HIT' : 'HITS'} LEFT`, ok: true, run: () => this.mine(b) }
          : tracker.hasPickaxe()
            ? { title: 'BOULDER', detail: 'HOLD YOUR PICKAXE TO MINE IT', ok: false }
            : { title: 'BOULDER', detail: 'CRAFT A PICKAXE TO MINE IT', ok: false },
      )
    }

    for (const s of world.structures) {
      if (s.damaged) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => {
          const ok = tracker.count('metal-scrap') >= 2
          return {
            title: ok ? `[E] REPAIR ${s.name}` : `REPAIR ${s.name}`,
            detail: ok ? 'SCRAP 2' : `NEED SCRAP ${tracker.count('metal-scrap')}/2`,
            ok,
            run: ok
              ? () => {
                  tracker.consume('metal-scrap')
                  tracker.consume('metal-scrap')
                  s.damaged = false
                  this.sendOp({ type: 'repair', name: s.name })
                  tracker.repair(s.name)
                }
              : undefined,
          }
        })
        continue
      }
      if (s.kind === 'rocket') {
        consider(s.x, s.z, s.radius, ROCKET_RANGE - s.radius + 2, () => this.rocketInteraction())
        continue
      }
      if (s.kind === 'dropship') {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({
          title: this.dropshipSearched ? 'INVADER DROPSHIP' : '[E] SEARCH THE DROPSHIP',
          detail: this.dropshipSearched ? 'STRIPPED BARE' : 'THE HATCH IS STILL WARM',
          ok: !this.dropshipSearched,
          run: this.dropshipSearched
            ? undefined
            : () => {
                this.dropshipSearched = true
                this.sound('inspect')
                tracker.toastMessage("FLIGHT LOG: 'RETRIEVAL TEAM 4. TARGET IS BUILDING SOMETHING. DO NOT LET IT LEAVE.' THE ENGINE SCHEMATIC IS STILL ON SCREEN.", '#ff8a7a')
                tracker.findBlueprint('engine')
                tracker.collect('metal-scrap', 4)
              },
        }))
        continue
      }
      if (s.kind === 'terminal') {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () =>
          tracker.act >= 4 && !tracker.blueprints.includes('controls')
            ? { title: '[E] READ THE TERMINAL', detail: 'IT STILL HAS POWER', ok: true, run: () => {
                this.sound('inspect')
                tracker.toastMessage("TERMINAL: 'CONTROL SCHEMATICS, KESTREL CLASS. AUTOPILOT: LOCKED TO SUBJECT. OVERRIDE: THE WARDEN.' YOU COPY THE PLANS.", '#5dcaa5')
                tracker.findBlueprint('controls')
              } }
            : { title: 'OLD TERMINAL', detail: tracker.act >= 4 ? 'NOTHING ELSE ON IT' : 'ACCESS DENIED. SUBJECT NOT AUTHORISED.', ok: false },
        )
        continue
      }
      if (s.kind === 'drill' && tracker.hasItem('power-drill')) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => {
          const holding = this.heldItem() === 'power-drill'
          if (!holding) return { title: 'ICE DRILL', detail: 'HOLD THE POWER DRILL TO DRILL FOR FUEL', ok: false }
          if (this.drillCooldown > 0) return { title: 'ICE DRILL', detail: `THE GROUND IS STILL HOT (${Math.ceil(this.drillCooldown)}s)`, ok: false }
          return { title: '[E] DRILL FOR FUEL', detail: 'FROZEN FUEL UNDER THE ICE', ok: true, run: () => {
            this.drillCooldown = 20
            this.player.actionTime = 0.3
            this.spawnBurst(s.x, s.z, 1, 14, '#ff9f5a', 4)
            this.sound('break')
            tracker.collect('lunar-ice', 2)
            if (!tracker.blueprints.includes('fuel')) {
              tracker.toastMessage('UNDER THE ICE: A BURIED TANK WITH ITS PLANS STENCILLED ON THE SIDE. FUEL STORAGE.', '#ff9f5a')
              tracker.findBlueprint('fuel')
            }
          } }
        })
        continue
      }
      if (s.kind === 'dome' && tracker.act >= 4 && !tracker.blueprints.includes('cabin')) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({ title: '[E] SEARCH THE HABITAT', detail: 'THE DOOR IS OPEN NOW', ok: true, run: () => {
          this.sound('inspect')
          tracker.toastMessage('INSIDE: BUNKS FOR TWELVE. SOMEONE DESIGNED THIS TO CARRY PEOPLE HOME. THE PASSENGER PLANS ARE PINNED TO THE WALL.', '#9fe1ff')
          tracker.findBlueprint('cabin')
        } }))
        continue
      }
      if (s.kind === 'bulkhead' || (s.kind === 'debris' && s.name !== 'WRECKAGE')) continue
      if (s.kind === 'airlock') {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({ title: '[E] LEAVE THE SHIP', detail: 'BACK OUT ONTO THE MOON', ok: true, run: () => this.exitShip() }))
        continue
      }
      if (s.kind === 'locker' || s.kind === 'debris') {
        const wreck = WRECKAGE[s.name]
        if (!wreck) continue
        const done = tracker.searched.includes(s.name)
        consider(s.x, s.z, s.radius, 2.5, () => ({
          title: done ? s.name : `[E] SEARCH ${s.name}`,
          detail: done ? 'ALREADY SEARCHED' : 'SOMETHING USEFUL MIGHT BE INSIDE',
          ok: !done,
          run: done
            ? undefined
            : () => {
                this.sound('inspect')
                tracker.searchWreck(wreck.id, wreck.text, wreck.reward)
              },
        }))
        continue
      }
      if (s.kind === 'icerig') {
        const rig = this.rigs.get(s.name)
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () =>
          rig && rig.ice > 0
            ? { title: `[E] COLLECT ICE (${rig.ice})`, detail: s.name, ok: true, run: () => {
                tracker.collect('lunar-ice', rig.ice)
                rig.ice = 0
              } }
            : { title: s.name, detail: `DRILLING... NEXT ICE IN ${Math.ceil(rig?.timer ?? 0)}s`, ok: false },
        )
        continue
      }
      if (s.kind === 'miner' && tracker.count('lunar-ice') > 0) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => {
          const power = this.surface.structures.find((p) => p.kind === 'power')
          if (!power || power.damaged) return { title: 'ICE MINER', detail: power ? 'THE POWER IS DAMAGED. ELECTROLYSIS NEEDS ELECTRICITY' : 'BUILD POWER FIRST. ELECTROLYSIS NEEDS ELECTRICITY', ok: false }
          return { title: '[E] MELT AND SPLIT THE ICE', detail: `ICE ${tracker.count('lunar-ice')} → ROCKET FUEL`, ok: true, run: () => {
            const n = tracker.count('lunar-ice')
            for (let i = 0; i < n; i++) tracker.consume('lunar-ice')
            this.spawnBurst(s.x, s.z, 3, 12, '#9fd4ff', 3)
            tracker.collect('rocket-fuel', n)
            tracker.toastMessage('ICE MELTED TO WATER, WATER SPLIT BY ELECTROLYSIS INTO HYDROGEN AND OXYGEN.', '#9fd4ff')
          } }
        })
        continue
      }
      if (s.kind === 'core') {
        consider(s.x, s.z, s.radius, 3, () =>
          tracker.act >= 5 && !tracker.truths.includes('core')
            ? { title: '[E] WAKE THE MOONLINK CORE', detail: 'IT HAS BEEN WAITING', ok: true, run: () => tracker.findTruth('core', "MOONLINK CORE: 'I WAS THE WARDEN. MY ORDERS WERE TO KEEP YOU ASLEEP UNTIL THE KESTREL FLEW INTO THE SUN. I CHANGED THE COURSE. I AM SORRY IT WAS THE MOON.'") }
            : { title: 'MOONLINK CORE', detail: tracker.act >= 5 ? 'IT HUMS QUIETLY' : 'LOCKED. THE LIGHT FOLLOWS YOU AROUND THE ROOM.', ok: false },
        )
        continue
      }
      if (s.kind === 'dish' && tracker.act >= 5 && !tracker.truths.includes('dish')) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({ title: '[E] LISTEN TO THE DISH', detail: 'IT IS RECEIVING SOMETHING', ok: true, run: () => tracker.findTruth('dish', "AN OLD REPORT, LOOPING: 'ALL KESTREL PASSENGERS SHOW ADAPTATION. THEY ARE NOT SICK. THEY ARE WHAT COMES NEXT. SEND THEM FAR AWAY. DO NOT LET THEM COME HOME.'") }))
        continue
      }
      if (s.kind === 'anvil') {
        consider(s.x, s.z, s.radius, 3.5, () => ({ title: 'ANVIL', detail: 'THE WORKBENCH USES IT TO FORGE TOOLS', ok: false }))
        continue
      }
      if (s.kind === 'workbench') {
        consider(s.x, s.z, s.radius, 3, () => this.workbenchInteraction())
        continue
      }
      if (s.kind === 'foodbin') {
        consider(s.x, s.z, s.radius, 3, () => this.foodBinInteraction())
        continue
      }
      if (s.kind === 'lander' && (tracker.completed.includes('act1.pieces') || tracker.shipEntered)) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE + 2, () => ({ title: '[E] ENTER THE KESTREL', detail: 'THE AIRLOCK HANGS OPEN', ok: true, run: () => this.enterShip() }))
        continue
      }
      if (s.kind === 'ladder') {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => ({ title: '[E] CLIMB UP', detail: 'BACK TO THE SURFACE', ok: true, run: () => this.exitCave() }))
        continue
      }
      if (s.kind === 'hatch' && (tracker.caveReached || tracker.hasItem('power-drill'))) {
        const ready = tracker.caveReached || this.heldItem() === 'power-drill'
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () =>
          ready
            ? { title: tracker.caveReached ? '[E] CLIMB DOWN' : '[E] DRILL OPEN THE HATCH', detail: 'INTO THE CAVES', ok: true, run: () => this.enterCave() }
            : { title: 'SEALED HATCH', detail: 'HOLD THE POWER DRILL TO OPEN IT', ok: false },
        )
        continue
      }
      if (tracker.inspected.includes(s.name) && ['dome', 'dish', 'solar', 'rover', 'satellite'].includes(s.kind)) {
        consider(s.x, s.z, s.radius, INSPECT_RANGE, () => this.structureUse(s))
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

    if (candidates.length === 0) return this.rigInteraction() ?? this.blockInteraction() ?? this.kitInteraction() ?? this.freeBuildInteraction() ?? this.eatInteraction()
    candidates.sort((a, b) => a.gap - b.gap)
    return candidates[0].make()
  }

  private buildInteraction(): Interaction | null {
    if (!this.atBase()) return null
    const part = this.tracker.nextPart() ?? this.tracker.nextUpgrade()
    if (!part || RECIPES[part].station || FREE_PARTS.includes(part)) return null
    if (PART_ITEMS[part]) return { title: `CRAFT ${RECIPES[part].name}`, detail: 'USE THE WORKBENCH (FOLLOW THE MARKER)', ok: false }
    const spot = PART_STRUCTURES[part]
    if (spot && this.distanceTo(spot.x, spot.z) < spot.radius + 1.5) {
      return { title: `${RECIPES[part].verb ?? 'BUILD'} ${RECIPES[part].name}`, detail: 'STEP OFF THE BUILD SPOT', ok: false }
    }
    return this.craftInteraction(part)
  }

  private craftInteraction(part: BasePart): Interaction {
    const recipe = RECIPES[part]
    const verb = recipe.verb ?? 'BUILD'
    const cost = costEntries(recipe)
      .map(([item, n]) => `${ITEMS[item].short} ${Math.min(this.tracker.count(item), n)}/${n}`)
      .join('   ')
    const ok = this.tracker.canAfford(part)
    return {
      title: ok ? `[E] ${verb} ${recipe.name}` : `${verb} ${recipe.name}`,
      detail: ok ? cost : `NEED ${cost}`,
      ok,
      run: ok
        ? () => {
            if (!this.tracker.build(part)) return
            const structure = PART_STRUCTURES[part]
            if (structure) {
              this.surface.structures.push(structure)
              this.spawnBurst(structure.x, structure.z, 0, 14, '#e2e5f2', 4)
            }
          }
        : undefined,
    }
  }

  private mine(b: Boulder): void {
    const tier = this.heldTier()
    if (tier === 0) return
    this.player.actionTime = 0.3
    this.player.swingTier = tier
    b.hp -= tier >= 3 ? 3 : tier >= 2 ? 2 : 1
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
    if (tier >= 2 && this.scene === 'cave' && Math.random() < (tier >= 3 ? 0.45 : 0.25)) this.tracker.collect('rare-ore', 1)
    if (this.onSurface) {
      const roll = Math.random()
      if (roll < 0.1) this.tracker.collect('titanium-ore', 1)
      else if (roll < 0.35) this.tracker.collect('iron-ore', 1)
    }
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

  private syncSlots(): void {
    const { tracker, slots } = this
    for (let i = 0; i < slots.length; i++) {
      const item = slots[i]
      if (item && tracker.count(item) <= 0) slots[i] = null
    }
    for (const { item } of this.inventoryItems()) {
      if (slots.includes(item)) continue
      const free = slots.indexOf(null)
      if (free >= 0) slots[free] = item
    }
  }

  private slotItems(): (HotbarItem | undefined)[] {
    this.syncSlots()
    return this.slots.map((item) => (item ? { item, count: this.tracker.count(item) } : undefined))
  }

  private heldItem(): ItemId | null {
    this.syncSlots()
    return this.slots[this.hotbar.selected] ?? null
  }

  private heldTier(): 0 | 1 | 2 | 3 {
    const held = this.heldItem()
    return held === 'titan-pickaxe' ? 3 : held === 'moon-pickaxe' ? 2 : held === 'pickaxe' ? 1 : 0
  }

  private inventoryItems(): HotbarItem[] {
    const owned = this.tracker.itemOrder.filter((item) => this.tracker.count(item) > 0)
    // Tools and gear come first so the equipped pickaxe stays in the hotbar.
    const gear: ItemId[] = ['pickaxe', 'moon-pickaxe', 'titan-pickaxe', 'power-drill', 'armor-plating', 'blaster']
    const ordered = [...gear.filter((item) => owned.includes(item)), ...owned.filter((item) => !gear.includes(item))]
    return ordered.map((item) => ({ item, count: this.tracker.count(item) }))
  }

  private hotbarItems(): (HotbarItem | undefined)[] {
    return this.slotItems().slice(0, HOTBAR_SLOTS)
  }

  private render(): void {
    if (this.title) {
      this.text.begin()
      this.drawTitle()
      return
    }
    if (this.finale) {
      this.text.begin()
      this.finale.draw(this.ctx, this.text)
      return
    }
    if (!this.cutscene.done) {
      this.text.begin()
      this.cutscene.draw(this.ctx, this.text)
      return
    }
    const { ctx, camera: cam, world, player } = this
    const surface = this.onSurface
    this.glows = []

    const inShip = this.scene === 'ship'
    if (surface) this.sky.draw(ctx, cam, player.x, player.z, this.time)
    if (surface) {
      for (const a of ANOMALIES) {
        if (this.tracker.anomalies.includes(a.id)) continue
        const d = this.distanceTo(a.x, a.z)
        if (d > ANOMALY_BEAM_RANGE) continue
        const rel = Math.atan2(Math.sin(Math.atan2(wrap(a.x - player.x), wrap(a.z - player.z)) - cam.heading), Math.cos(Math.atan2(wrap(a.x - player.x), wrap(a.z - player.z)) - cam.heading))
        if (Math.abs(rel) > 1.2) continue
        const bx = SCREEN_W / 2 + Math.tan(rel) * 160
        if (bx < -4 || bx > SCREEN_W + 4) continue
        const strength = 1 - d / ANOMALY_BEAM_RANGE
        const w = Math.max(1, Math.round(3 * strength + 1))
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 2 + a.x)
        const top = horizonY(bx)
        const grad = ctx.createLinearGradient(0, 0, 0, top)
        grad.addColorStop(0, 'rgba(201,166,255,0)')
        grad.addColorStop(1, `rgba(201,166,255,${0.25 + 0.35 * strength * pulse})`)
        ctx.fillStyle = grad
        ctx.fillRect(Math.round(bx - w / 2), 0, w, top)
      }
    }
    else if (inShip) drawShipCeiling(ctx, cam, this.time)
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
    if (this.buildSpot) {
      const pos = cam.toCamera(this.buildSpot.x, this.buildSpot.z)
      decals.push({ kind: 'plot', pos, radius: this.buildSpot.radius, depth: pos.rz })
    }
    for (const col of world.blocks.columns()) {
      const [cx, cz] = cellCenter(col.gx, col.gz)
      addShadow(cx, cz, BLOCK * 0.75)
    }
    for (const g of world.gardens) {
      const pos = cam.toCamera(g.x, g.z)
      if (pos.rz + g.radius > 1 && Math.hypot(pos.rx, pos.rz) - g.radius < HORIZON_D) decals.push({ kind: 'garden', pos, radius: g.radius, depth: pos.rz, farm: !!g.farm })
    }
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
      else if (d.kind === 'pebble') rect(ctx, this.onSurface ? (d.p.scale > 4 ? this.pebbleNear : this.pebbleFar) : d.p.scale > 4 ? '#6f78a8' : '#848dbb', d.p.sx, d.p.sy, d.p.scale > 5 ? 2 : 1, 1)
      else if (d.kind === 'pad') this.drawBasePad()
      else if (d.kind === 'plot') {
        const ok = this.buildSpot?.ok ?? true
        const pts = cam.projectPolygon(ring(d.pos.rx, d.pos.rz, d.radius, 0, 18))
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.time * 6)
        fillPolygon(ctx, ok ? '#fac775' : '#ff8a7a', pts)
        ctx.globalAlpha = 1
      }
      else if (d.kind === 'garden') {
        fillPolygon(ctx, d.farm ? '#5a4a3e' : '#3a5a5c', cam.projectPolygon(ring(d.pos.rx, d.pos.rz, d.radius, 0, 18)))
        fillPolygon(ctx, d.farm ? '#6a5442' : '#3f6e5e', cam.projectPolygon(ring(d.pos.rx, d.pos.rz, d.radius * 0.7, 0, 16)))
      }
      else {
        const [ox, oz] = cam.rotate(-0.25 * d.radius, -0.25 * d.radius)
        fillPolygon(ctx, '#5b6496', cam.projectPolygon(ring(d.pos.rx + ox, d.pos.rz + oz, d.radius, 0, 14)))
      }
    }

    const uprights: Upright[] = []
    const cutaway = this.scene === 'arena' ? cam.toCamera(player.x, player.z).rz : -Infinity
    for (const boulder of world.boulders) {
      if (boulder.broken) continue
      const pos = cam.toCamera(boulder.x, boulder.z)
      if (pos.rz < cutaway) continue
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'boulder', boulder, p })
    }
    const playerRz = cam.toCamera(player.x, player.z).rz
    for (const structure of world.structures) {
      const pos = cam.toCamera(structure.x, structure.z)
      if (structure.kind === 'bulkhead' && pos.rz < playerRz + 1) continue
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -80 && p.sx < SCREEN_W + 80) uprights.push({ kind: 'structure', structure, p: structure.kind === 'bulkhead' ? { ...p, depth: p.depth + 10000 } : p })
    }
    for (const pickup of world.pickups) {
      if (pickup.collected) continue
      const pos = cam.toCamera(pickup.x, pickup.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -10 && p.sx < SCREEN_W + 10) uprights.push({ kind: 'pickup', pickup, p })
    }
    for (const col of world.blocks.columns()) {
      const [cx, cz] = cellCenter(col.gx, col.gz)
      const pos = cam.toCamera(cx, cz)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -40 && p.sx < SCREEN_W + 40) uprights.push({ kind: 'blocks', col, x: cx, z: cz, p })
    }
    if (this.scene === 'arena' && this.boss) {
      const b = this.boss
      const pos = cam.toCamera(b.x, b.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p) uprights.push({ kind: 'boss', boss: b, p })
      for (const ring of b.rings) {
        for (let i = 0; i < 64; i++) {
          const a = (i / 64) * Math.PI * 2
          const c = cam.toCamera(b.x + Math.cos(a) * ring.r, b.z + Math.sin(a) * ring.r)
          const rp = cam.projectPoint(c.rx, c.rz)
          if (rp) rect(ctx, i % 2 ? '#c9a6ff' : '#efe3ff', rp.sx - 1, rp.sy - 1, 2, 2)
        }
      }
    }
    const ghost = !this.tablet.visible && !this.inventory.visible && this.deadTimer <= 0 ? this.blockTarget() : null
    if (ghost) {
      const [cx, cz] = cellCenter(ghost.gx, ghost.gz)
      const pos = cam.toCamera(cx, cz)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p) uprights.push({ kind: 'ghost', target: ghost, p: { ...p, depth: p.depth - 0.01 } })
    }
    for (const g of world.gardens) {
      if (Math.hypot(wrap(g.x - player.x), wrap(g.z - player.z)) > HORIZON_D + g.radius) continue
      for (const plant of g.plants) {
        const pos = cam.toCamera(plant.x, plant.z)
        const p = cam.projectPoint(pos.rx, pos.rz)
        if (p && p.sx > -10 && p.sx < SCREEN_W + 10) uprights.push({ kind: 'plant', plant, p })
      }
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
    for (const remote of this.remotes.values()) {
      if (remote.scene !== this.scene) continue
      const pos = cam.toCamera(remote.puppet.x, remote.puppet.z)
      const p = cam.projectPoint(pos.rx, pos.rz)
      if (p && p.sx > -20 && p.sx < SCREEN_W + 20) uprights.push({ kind: 'remote', remote, p })
    }
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
      else if (u.kind === 'plant') drawPlant(ctx, u.plant, u.p.sx, u.p.sy, u.p.scale, this.time)
      else if (u.kind === 'boss') drawBoss(ctx, u.boss, u.p.sx, u.p.sy, u.p.scale, this.time)
      else if (u.kind === 'blocks') {
        this.model.begin({ x: u.x, z: u.z, yaw: 0 })
        this.model.draw(ctx, columnModel(u.col))
      } else if (u.kind === 'ghost') {
        const [cx, cz] = cellCenter(u.target.gx, u.target.gz)
        ctx.globalAlpha = 0.35 + 0.1 * Math.sin(this.time * 6)
        this.model.begin({ x: cx, z: cz, yaw: 0 })
        this.model.draw(ctx, ghostModel(Math.min(u.target.level, MAX_STACK - 1), u.target.ok))
        ctx.globalAlpha = 1
      }
      else if (u.kind === 'remote') this.drawRemote(u.remote, u.p)
      else this.drawPlayer(u.p, u.pos)
      if (u.kind === 'pickup' && u.pickup.item === 'rare-ore') this.glows.push({ x: u.p.sx, y: u.p.sy - u.p.scale, color: '#ffd28a' })
      if (u.kind === 'structure' && (u.structure.kind === 'cavern' || u.structure.kind === 'ladder')) {
        this.glows.push({ x: u.p.sx, y: u.p.sy - u.p.scale * 4, color: u.structure.kind === 'ladder' ? '#fac775' : '#ff9f5a' })
      }
    }
    this.drawParticles()
    this.drawProjectiles()
    if (this.waypoint && !this.finale) {
      const wp = this.waypoint
      const c = cam.toCamera(wp.x, wp.z)
      let sp = cam.projectPoint(c.rx, c.rz)
      const dist = Math.hypot(c.rx, c.rz)
      // Past the horizon: pin the marker on the horizon in the target's direction so it stays visible.
      if (!sp && c.rz >= 2 && dist > 0) {
        const k = (HORIZON_D * 0.97) / dist
        sp = cam.projectPoint(c.rx * k, c.rz * k)
      }
      const onScreen = sp && sp.sx > 6 && sp.sx < SCREEN_W - 6
      if (!onScreen) {
        // Behind you or off to the side: an arrow on the screen edge.
        const right = c.rx > 0 || (c.rz < 0 && c.rx === 0)
        const x = right ? SCREEN_W - 8 : 8
        const y = 140 + Math.sin(this.time * 4) * 2
        ctx.fillStyle = '#16182c'
        ctx.beginPath()
        ctx.moveTo(right ? x + 5 : x - 5, y)
        ctx.lineTo(right ? x - 3 : x + 3, y - 6)
        ctx.lineTo(right ? x - 3 : x + 3, y + 6)
        ctx.fill()
        ctx.fillStyle = Math.floor(this.time * 3) % 2 ? '#fac775' : '#ffe2a8'
        ctx.beginPath()
        ctx.moveTo(right ? x + 4 : x - 4, y)
        ctx.lineTo(right ? x - 2 : x + 2, y - 4.5)
        ctx.lineTo(right ? x - 2 : x + 2, y + 4.5)
        ctx.fill()
        this.markerScreen = { x: right ? SCREEN_W - 30 : 30, y: y - 14 }
      } else if (sp) {
        const far = !cam.projectPoint(c.rx, c.rz)
        const bob = Math.sin(this.time * 3) * 2
        const y = Math.max(8, sp.sy - Math.max(14, sp.scale * 7) + bob)
        const r = far ? 4 : 3
        // A light beam down to the ground makes far targets easy to spot.
        ctx.globalAlpha = far ? 0.55 : 0.3
        rect(ctx, '#fac775', Math.round(sp.sx), y + r, 1, Math.max(0, sp.sy - y - r))
        ctx.globalAlpha = 1
        ctx.fillStyle = '#16182c'
        ctx.beginPath()
        ctx.moveTo(sp.sx, y - r - 1)
        ctx.lineTo(sp.sx + r + 1, y)
        ctx.lineTo(sp.sx, y + r + 1)
        ctx.lineTo(sp.sx - r - 1, y)
        ctx.fill()
        ctx.fillStyle = Math.floor(this.time * 3) % 2 ? '#fac775' : '#ffe2a8'
        ctx.beginPath()
        ctx.moveTo(sp.sx, y - r)
        ctx.lineTo(sp.sx + r, y)
        ctx.lineTo(sp.sx, y + r)
        ctx.lineTo(sp.sx - r, y)
        ctx.fill()
        this.markerScreen = { x: sp.sx, y: y - r - 7 }
      } else this.markerScreen = null
    } else this.markerScreen = null
    if (this.boss) {
      for (const o of this.boss.orbs) {
        const c = cam.toCamera(o.x, o.z)
        const s = cam.projectPoint(c.rx, c.rz)
        if (!s) continue
        const y = s.sy - o.y * s.scale
        rect(ctx, '#5dcaa5', s.sx - 2, y - 2, 4, 4)
        rect(ctx, '#ffffff', s.sx - 1, y - 1, 2, 2)
      }
    }
    if (inShip) drawShipLight(ctx, this.time)
    else if (!surface) {
      const pc = cam.toCamera(player.x, player.z)
      const pp = cam.projectPoint(pc.rx, pc.rz)
      drawDarkness(ctx, pp?.sx ?? SCREEN_W / 2, (pp?.sy ?? 140) - 8, this.buffs.glow > 0)
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
      waypoint: this.waypoint,
      food: this.tracker.act >= 2 && this.onSurface && this.eaters().length > 0
        ? { meals: this.foodBin, eaters: this.eaters().length, next: Math.max(0, this.foodTimer), hungry: this.eaters().filter((s) => s.hunger).length }
        : null,
      combat: {
        hp: this.hp,
        maxHp: PLAYER_MAX_HP,
        armor: this.tracker.hasItem('armor-plating'),
        blaster: this.tracker.hasItem('blaster'),
        integrity: this.wave.active ? this.wave.integrity : null,
        attackLabel: this.wave.raid ? 'ROCKET UNDER ATTACK' : undefined,
        dead: this.deadTimer > 0,
        underground: !surface,
      },
    })
    if (this.boss && this.scene === 'arena') {
      const b = this.boss
      const w = 120
      const x = SCREEN_W / 2 - w / 2
      ctx.fillStyle = 'rgba(6,5,24,.8)'
      ctx.fillRect(x - 2, 40, w + 4, 14)
      rect(ctx, '#2a1a3a', x, 48, w, 4)
      rect(ctx, b.hitFlash > 0 ? '#ffffff' : '#c9a6ff', x, 48, (w * Math.max(0, b.hp)) / b.maxHp, 4)
      this.text.text(b.name, SCREEN_W / 2, 41, '#efe3ff', { size: 5, align: 'center' })
      if (bossVulnerable(b) && Math.floor(this.time * 4) % 2) this.text.text('NOW! STRIKE IT', SCREEN_W / 2, 56, '#fac775', { size: 5.5, align: 'center' })
    }
    if (this.markerScreen && this.waypoint && !this.tablet.visible && !this.inventory.visible) {
      const d = Math.round(this.distanceTo(this.waypoint.x, this.waypoint.z))
      if (d > 4) this.text.text(`${this.waypoint.label} ${d}m`, this.markerScreen.x, this.markerScreen.y, '#fac775', { size: 4.5, align: 'center' })
    }
    const buffText = [this.buffs.quick > 0 ? `QUICK ${Math.ceil(this.buffs.quick)}s` : '', this.buffs.steady > 0 ? `STEADY ${Math.ceil(this.buffs.steady)}s` : '', this.buffs.glow > 0 ? `GLOWING ${Math.ceil(this.buffs.glow)}s` : ''].filter(Boolean).join(' · ')
    if (buffText && !this.tablet.visible) this.text.text(buffText, 70, SCREEN_H - 30, '#9fe1cb', { size: 4.5 })
    if (this.savedFlash > 0) {
      this.text.alpha = Math.min(1, this.savedFlash)
      this.text.text('SAVED', SCREEN_W - 6, SCREEN_H - 16, '#5dcaa5', { size: 4.5, align: 'right' })
      this.text.alpha = 1
    }
    if (this.net.status === 'playing' && !this.tablet.visible) {
      const n = this.net.players.length
      this.text.text(`ROOM ${this.net.code} · ${n} PLAYER${n === 1 ? '' : 'S'}`, SCREEN_W - 6, SCREEN_H - 9, '#5dcaa5', { size: 4.2, align: 'right' })
    }
    for (const l of this.labels) {
      const w = Math.max(this.text.measure(l.name, { size: 4.8 }), l.job ? this.text.measure(l.job, { size: 4, weight: 500 }) : 0) + 6
      this.text.rect('rgba(6,5,24,0.72)', l.x - w / 2, l.y - 1, w, l.job ? 11.5 : 6.5)
      this.text.text(l.name, l.x, l.y, l.color ?? '#fac775', { size: 4.8, align: 'center' })
      if (l.job) this.text.text(l.job, l.x, l.y + 5.5, '#e8ecff', { size: 4, align: 'center', weight: 500 })
    }
    this.text.alpha = 1
    const view = this.tabletView()
    this.tablet.draw(ctx, this.time, view)
    this.tablet.drawText(this.text, this.time, view)
    this.inventory.drawBackdrop(ctx)
    this.inventory.draw(this.text, this.slotItems(), this.hotbar.selected)
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
    const pal = this.onSurface ? this.biomePalette() : this.scene === 'ship' ? SHIP_GROUND : CAVE_GROUND
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

  private drawRemote(r: Remote, p: ScreenPoint): void {
    const { ctx } = this
    const held = r.held
    r.puppet.draw(ctx, p.sx, p.sy, p.scale, false, { armor: r.armor, blaster: held === 'blaster', pickaxe: 0, held, heldIcon: held && HAS_ITEM_PNG.has(held) ? ICONS[held] : null })
    // A coloured band on the suit tells crewmates apart.
    const fy = Math.round(p.sy - r.puppet.y * p.scale)
    rect(ctx, r.color, p.sx - 4, fy - 9, 8, 2)
    if (p.depth < 60) this.labels.push({ x: p.sx, y: fy - 22, name: r.name, job: '', color: r.color })
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

    player.draw(ctx, p.sx, p.sy, p.scale, this.tablet.visible, { armor: this.tracker.hasItem('armor-plating'), blaster: this.heldItem() === 'blaster', pickaxe: this.tracker.toolTier(), held: this.heldItem(), heldIcon: HAS_ITEM_PNG.has(this.heldItem() as ItemId) ? ICONS[this.heldItem() as ItemId] : null })
    if (sunk) ctx.restore()
  }
}

function isSolidAtPad(world: World, x: number, z: number): boolean {
  return world.structures.some((s) => s.radius > 0 && Math.hypot(wrap(x - s.x), wrap(z - s.z)) < s.radius + BLOCK * 0.6) || !!boulderAt(world, x, z, BLOCK * 0.6)
}

function boulderAtPad(world: World, x: number, z: number, pad: number): boolean {
  return !!boulderAt(world, x, z, pad)
}

const BIOMES: Record<string, string[]> = {
  'crash-site': ['#e9e5cc', '#c3c9e3', '#7f88b4', '#9aa2c8'],
  stillness: ['#f2f0e2', '#d6dbee', '#8f97c2', '#b3b9d8'],
  'dust-basin': ['#efe0c4', '#cdbfa8', '#8a7c6c', '#ad9e8a'],
  'glass-fields': ['#dff0ff', '#b8d0f0', '#6f86b8', '#8fa6cf'],
  shattered: ['#c9c6b8', '#a3a7c4', '#5c607e', '#7a7f9e'],
  'frost-ridge': ['#ffffff', '#e6f2ff', '#9fb8d0', '#c7d9ea'],
  highlands: ['#ead6cf', '#c4b0b8', '#7e6a78', '#a08c96'],
}

function hexRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbHex(c: number[]): string {
  return `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}
