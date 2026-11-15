/**
 * Earth rotation fix shown on the tablet and used by the radio dish.
 * Fetched from /api/earth, which pulls live IGS ERP data (NASA CDDIS dataset)
 * and falls back to a bundled real record when the archive is unreachable.
 */
export interface EarthRotation {
  mjd: number
  date: string
  x: number
  y: number
  ut1: number
  lod: number
  product: string
  source: string
  live: boolean
  fetchedAt?: string
}

let current: EarthRotation | null = null
let started = false

export function earthRotation(): EarthRotation | null {
  return current
}

export function loadEarthRotation(): void {
  if (started) return
  started = true
  fetch('/api/earth')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data: Partial<EarthRotation>) => {
      if (typeof data.x === 'number' && typeof data.y === 'number' && typeof data.ut1 === 'number') {
        current = data as EarthRotation
      }
    })
    .catch(() => {
      // Allow a retry the next time the tablet opens.
      started = false
    })
}
