import type { Creature } from './creatures'
import type { Pickup } from './pickups'
import type { Structure } from './structures'
import type { Survivor } from './survivors'

/**
 * Merge rules for the shared multiplayer world. The host's copy is authoritative;
 * a guest's copy only contributes progress that can only grow (things picked up,
 * scanned, recruited, built), so stale guest data can never undo the host's world.
 */

const r = (n: number) => Math.round(n * 4)

function pickupKey(p: Pickup): string {
  // The ice miner moves while it is dragged, so it is matched by item alone.
  if (p.item === 'ice-miner' || p.item === 'anvil') return p.item
  return `${p.item}|${r(p.x)}|${r(p.z)}|${p.garden ?? ''}|${p.clue?.id ?? ''}`
}

/** Pickups: `base` keeps its list; anything collected in `other` becomes collected in base. */
export function mergePickups(base: Pickup[], other: Pickup[] | undefined, takeMoves: boolean): Pickup[] {
  if (!other) return base
  const theirs = new Map(other.map((p) => [pickupKey(p), p]))
  for (const p of base) {
    const t = theirs.get(pickupKey(p))
    if (!t) continue
    if (t.collected) p.collected = true
    if (takeMoves && !p.collected && (t.x !== p.x || t.z !== p.z)) {
      p.x = t.x
      p.z = t.z
    }
  }
  return base
}

/** For a guest applying the host's list: host list wins, but keep what we collected ourselves. */
export function adoptPickups(mine: Pickup[], host: Pickup[] | undefined, dragging: Pickup | null): Pickup[] {
  if (!host) return mine
  const local = new Map(mine.map((p) => [pickupKey(p), p]))
  return host.map((h) => {
    const m = local.get(pickupKey(h))
    if (m && m === dragging && !h.collected) {
      // We are hauling it: our position is the true one.
      return m
    }
    const out = { ...h }
    if (m?.collected) out.collected = true
    return out
  })
}

export function structureKey(s: Structure): string {
  return `${s.kind}|${s.name}|${Math.round(s.x)}|${Math.round(s.z)}`
}

/** Adds structures `other` has that `base` lacks. Named base parts reuse their shared objects. */
export function unionStructures(base: Structure[], other: Structure[] | undefined, parts: Map<string, Structure>): Structure[] {
  if (!other) return base
  const have = new Set(base.map(structureKey))
  for (const s of other) {
    if (have.has(structureKey(s))) continue
    const part = parts.get(s.name)
    base.push(part && part.kind === s.kind ? Object.assign(part, { x: s.x, z: s.z }) : { ...s })
    have.add(structureKey(s))
  }
  return base
}

/** Guest side: the host's structures (and damage) win; keep our own very recent additions too. */
export function adoptStructures(mine: Structure[], host: Structure[] | undefined, parts: Map<string, Structure>): Structure[] {
  if (!host) return mine
  const local = new Map(mine.map((s) => [structureKey(s), s]))
  const out = host.map((h) => {
    const part = parts.get(h.name)
    if (part && part.kind === h.kind) return Object.assign(part, h)
    const m = local.get(structureKey(h))
    return m ? Object.assign(m, h) : { ...h }
  })
  return out
}

/** Host side: take recruits, gear and homes from a guest's survivors (never resurrect the lost). */
export function mergeSurvivors(base: Survivor[], other: Survivor[] | undefined): void {
  if (!other) return
  const byName = new Map(base.map((s) => [s.name, s]))
  for (const t of other) {
    const s = byName.get(t.name)
    if (!s) continue
    if (t.recruited && !s.recruited) {
      s.recruited = true
      s.homeX = t.homeX
      s.homeZ = t.homeZ
      s.x = t.x
      s.z = t.z
      s.targetX = t.x
      s.targetZ = t.z
    }
    if (t.armed) s.armed = true
    if (t.talked) s.talked = true
  }
}

/** Guest side: host survivors win, keeping recruits we made since the last update. */
export function adoptSurvivors(mine: Survivor[], host: Survivor[] | undefined): Survivor[] {
  if (!host) return mine
  const local = new Map(mine.map((s) => [s.name, s]))
  return host.map((h) => {
    const m = local.get(h.name)
    const out = { ...h }
    if (m) {
      if (m.recruited && !h.recruited) {
        out.recruited = true
        out.homeX = m.homeX
        out.homeZ = m.homeZ
      }
      if (m.armed) out.armed = true
      // Keep our smooth local walking instead of snapping every update.
      out.x = m.x + (h.x - m.x) * 0.5
      out.z = m.z + (h.z - m.z) * 0.5
    }
    return out
  })
}

export function mergeCreatures(base: Creature[], other: Creature[] | undefined, adopt: boolean): Creature[] {
  if (!other) return base
  const theirs = new Map(other.map((c) => [c.id, c]))
  if (adopt) {
    const local = new Map(base.map((c) => [c.id, c]))
    return other.map((h) => {
      const m = local.get(h.id)
      const out = { ...h }
      if (m) {
        if (m.scanned) out.scanned = true
        out.x = m.x + (h.x - m.x) * 0.5
        out.z = m.z + (h.z - m.z) * 0.5
      }
      return out
    })
  }
  for (const c of base) if (theirs.get(c.id)?.scanned) c.scanned = true
  return base
}

export function unionIndices(a: number[], b: number[] | undefined): number[] {
  if (!b) return a
  return [...new Set([...a, ...b])]
}
