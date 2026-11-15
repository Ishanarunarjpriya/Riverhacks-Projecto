import { ANOMALIES, ANOMALY_RANGE, HATCH, HATCH_RANGE, drawAnomaly, type Anomaly } from './anomalies'
import { setAssistantContext } from './assistant'
import { GameAudio, type SoundName } from './audio'
import { ANVIL_RECIPES, BEDS_PER_HOME, HOUSING_BEDS, KIT_STRUCTURES, BASE_CENTER, BASE_HALF, BASE_RADIUS, FREE_PARTS, PART_STRUCTURES, RECIPES, costEntries, type BasePart } from './base'
import { BLOCK, BLOCK_FOR_ITEM, BLOCK_INFO, BLOCK_REACH, MAX_STACK, cellCenter, cellOf, columnModel, ghostModel, type BlockColumn } from './blocks'
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
import { SCAN_RANGE, createCreatures, drawCreature, speciesNote, updateCreatures, type Creature } from './creatures'
import { Cutscene } from './cutscene'
import { Finale } from './finale'
import { FUEL_GOAL, RIG_CAPACITY, RIG_INTERVAL, BLUEPRINTS, FOOD_STOCK_GOAL, PASSENGER_BAY_COST, RAID_INTERVAL, ROCKET_RANGE, SECTION_COST, SECTION_ORDER, rocket, type Blueprint } from './rocket'
import { ARENA_SPAWN, BOSS_INFO, MELEE_RANGE, bossVulnerable, clampToArena, createArenaWorld, createBoss, drawBoss, updateBoss, type Boss } from './boss'
import { SHIP_SPAWN, SHIP_WORKBENCH, WRECKAGE, clampToShip, createShipWorld, drawShipCeiling, drawShipLight, SHIP_GROUND } from './ship'
import { Hotbar, HOTBAR_SLOTS, type HotbarItem } from './hotbar'
import { drawHud, type Prompt } from './hud'
import { Input } from './input'
import { INVENTORY_SLOTS, InventoryScreen } from './inventory'
import { FOOD, ITEMS, type ItemId } from './items'
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
  createStrays,
  createSurvivors,
  drawSurvivor,
  nextJob,
  updateSurvivors,
  type Survivor,
} from './survivors'
import { TextLayer } from './text'
import { QuestTracker, type TrackerSnapshot } from './tracker'
import { boulderAt, craterAt, createWorld, groundHeightAt, type Boulder, type Crater, type World } from './world'

type Decal =
  | { kind: 'crater'; crater: Crater; pos: CamPos; depth: number }
  | { kind: 'pebble'; p: ScreenPoint; depth: number }
  | { kind: 'shadow'; pos: CamPos; radius: number; depth: number }
  | { kind: 'pad'; depth: number }
  | { kind: 'garden'; pos: CamPos; radius: number; depth: number; farm: boolean }
  | { kind: 'plot'; pos: CamPos; radius: number; depth: number }

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
  | { kind: 'plant'; plant: Plant; p: ScreenPoint }
  | { kind: 'blocks'; col: BlockColumn; x: number; z: number; p: ScreenPoint }
  | { kind: 'ghost'; target: BlockTarget; p: ScreenPoint }
  | { kind: 'boss'; boss: Boss; p: ScreenPoint }

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
  private chatterTimer = 40
  private buildSpot: { x: number; z: number; radius: number; ok: boolean } | null = null
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
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('contextmenu', this.preventMenu)

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

  private anvilInteraction(): Interaction {
    const list = this.anvilRecipes()
    const recipe = list[this.anvilIndex % list.length]
    const tracker = this.tracker
    const entries = Object.entries(recipe.cost) as [ItemId, number][]
    const ok = entries.every(([item, n]) => tracker.count(item) >= n)
    const cost = entries.map(([item, n]) => `${ITEMS[item].short} ${Math.min(tracker.count(item), n)}/${n}`).join('  ')
    const more = list.length > 1 ? ' · [R] NEXT' : ''
    return {
      title: ok ? `[E] CRAFT ${ITEMS[recipe.item].name}` : `CRAFT ${ITEMS[recipe.item].name}`,
      detail: (ok ? cost : `NEED ${cost}`) + more,
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
    if (!bossVulnerable(b)) {
      this.sound('deny')
      this.spawnBurst(b.x, b.z, b.y + 2, 4, '#9aa2cf', 2)
      return
    }
    b.hp -= tier >= 3 ? 3 : tier >= 2 ? 2 : 1
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
    if (!this.playing) return false
    if (code === 'KeyR' && !this.tablet.open && !this.inventory.open) {
      const list = this.anvilRecipes()
      if (list.length > 1) this.anvilIndex = (this.anvilIndex + 1) % list.length
      this.choiceIndex = (this.choiceIndex + 1) % 2
      this.rocketIndex++
      this.sound('select')
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
      ...this.creatures.filter((c) => !c.scanned).map((c) => ({ x: c.x, z: c.z, label: 'DRIFTER', color: '#9fe1cb' })),
      ...this.survivors.filter((s) => s.stray && !s.recruited).map((s) => ({ x: s.x, z: s.z, label: 'SURVIVOR', color: '#fac775' })),
    ]
    return { world: this.surface, playerX: this.player.x, playerZ: this.player.z, heading: this.player.heading, tracker: this.tracker, underground: !this.onSurface, lifeSigns }
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

  devJumpToAct(act: number): void {
    this.cutscene.skip()
    this.earthPlayed = true
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
      if (this.cutscene.done) this.input.clear()
      return
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
    this.player.update(dt, controls, this.world)
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
    if (this.hp >= PLAYER_MAX_HP) return { title: name, detail: 'HEALTH IS ALREADY FULL', ok: false }
    return {
      title: `[E] EAT ${name}`,
      detail: `+${heal} HEALTH`,
      ok: true,
      run: () => {
        if (!this.tracker.consume(held.item)) return
        this.hp = Math.min(PLAYER_MAX_HP, this.hp + heal)
        this.sound('pickup')
        this.tracker.toastMessage(`ATE ${name}  +${heal} HEALTH`, ITEMS[held.item].color)
      },
    }
  }

  private updateActTwo(dt: number): void {
    const { player, tracker } = this
    updateCreatures(this.creatures, dt, player.x, player.z, this.world)
    tracker.enterRegion(regionAt(player.x, player.z))
    if (tracker.signalRevealed && !tracker.signalFound && this.distanceTo(HATCH.x, HATCH.z) < HATCH_RANGE) tracker.findSignal()
    if (tracker.baseParts.has('housing') && !this.survivors.some((s) => !s.stray)) {
      const named = createSurvivors()
      for (const s of named) s.job = tracker.jobs[s.name] ?? null
      this.survivors.push(...named)
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
      if (tracker.act < 2) {
        consider(anomaly.x, anomaly.z, 0, ANOMALY_RANGE, () => ({ title: 'ANOMALY', detail: 'IT IS NOT READY FOR YOU. NOT YET.', ok: false }))
        continue
      }
      if (tracker.bosses.length < 2) {
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
      if (s.kind === 'drill' && tracker.act >= 4) {
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
      if (s.kind === 'miner' && tracker.act >= 4 && tracker.count('lunar-ice') > 0) {
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
        consider(s.x, s.z, s.radius, 3.5, () => this.anvilInteraction())
        continue
      }
      if (s.kind === 'workbench') {
        const part = tracker.nextPart()
        consider(s.x, s.z, s.radius, 3, () =>
          part && RECIPES[part].station === 'workbench'
            ? this.craftInteraction(part)
            : { title: 'WORKBENCH', detail: 'NOTHING TO CRAFT HERE RIGHT NOW', ok: false },
        )
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
      else if (d.kind === 'pebble') rect(ctx, d.p.scale > 4 ? '#6f78a8' : '#848dbb', d.p.sx, d.p.sy, d.p.scale > 5 ? 2 : 1, 1)
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
      if (p && p.sx > -80 && p.sx < SCREEN_W + 80) uprights.push({ kind: 'structure', structure, p })
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
      else this.drawPlayer(u.p, u.pos)
      if (u.kind === 'pickup' && u.pickup.item === 'rare-ore') this.glows.push({ x: u.p.sx, y: u.p.sy - u.p.scale, color: '#ffd28a' })
      if (u.kind === 'structure' && (u.structure.kind === 'cavern' || u.structure.kind === 'ladder')) {
        this.glows.push({ x: u.p.sx, y: u.p.sy - u.p.scale * 4, color: u.structure.kind === 'ladder' ? '#fac775' : '#ff9f5a' })
      }
    }
    this.drawParticles()
    this.drawProjectiles()
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
    for (const l of this.labels) {
      this.text.text(l.name, l.x, l.y, '#fac775', { size: 4.8, align: 'center' })
      if (l.job) this.text.text(l.job, l.x, l.y + 5.5, '#9aa2cf', { size: 4, align: 'center', weight: 500 })
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
    const pal = this.onSurface ? { rim: '#e9e5cc', rim2: '#c3c9e3', band: '#7f88b4', base: '#9aa2c8' } : this.scene === 'ship' ? SHIP_GROUND : CAVE_GROUND
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

    player.draw(ctx, p.sx, p.sy, p.scale, this.tablet.visible, { armor: this.tracker.hasItem('armor-plating'), blaster: this.heldItem() === 'blaster', pickaxe: this.tracker.toolTier(), held: this.heldItem() })
    if (sunk) ctx.restore()
  }
}

function isSolidAtPad(world: World, x: number, z: number): boolean {
  return world.structures.some((s) => s.radius > 0 && Math.hypot(wrap(x - s.x), wrap(z - s.z)) < s.radius + BLOCK * 0.6) || !!boulderAt(world, x, z, BLOCK * 0.6)
}

function boulderAtPad(world: World, x: number, z: number, pad: number): boolean {
  return !!boulderAt(world, x, z, pad)
}
