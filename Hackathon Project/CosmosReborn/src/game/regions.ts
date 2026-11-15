import { wrap } from './math'

export interface Region {
  id: string
  name: string
  x: number
  z: number
  color: string
  home?: boolean
}

export const REGIONS: readonly Region[] = [
  { id: 'crash-site', name: 'CRASH SITE', x: 10, z: 40, color: '#fac775', home: true },
  { id: 'stillness', name: 'SEA OF STILLNESS', x: 230, z: 180, color: '#d9dcef' },
  { id: 'dust-basin', name: 'DUST BASIN', x: 140, z: 520, color: '#c9cbe0' },
  { id: 'glass-fields', name: 'GLASS FIELDS', x: 420, z: 640, color: '#7fb2ff' },
  { id: 'shattered', name: 'SHATTERED PLAINS', x: 520, z: 360, color: '#e0884a' },
  { id: 'frost-ridge', name: 'FROST RIDGE', x: 650, z: 80, color: '#9fe1cb' },
  { id: 'highlands', name: 'SIGNAL HIGHLANDS', x: 760, z: 300, color: '#ff8a7a' },
]

export function regionAt(x: number, z: number): Region {
  let best = REGIONS[0]
  let bestDist = Infinity
  for (const r of REGIONS) {
    const d = Math.hypot(wrap(x - r.x), wrap(z - r.z))
    if (d < bestDist) {
      bestDist = d
      best = r
    }
  }
  return best
}
