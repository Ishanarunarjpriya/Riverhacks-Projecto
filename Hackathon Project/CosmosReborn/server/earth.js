import { gunzipSync } from 'node:zlib'

/**
 * Live IGS Earth Rotation Parameters (ERP) for the radio dish "Earth lock".
 *
 * The NASA CDDIS copy of this dataset sits behind Earthdata login, so we read the
 * same IGS combined ERP product from the BKG mirror, which needs no credentials.
 * Files are gzipped IGS ERP v2: MJD, X pole, Y pole, UT1-UTC, LOD.
 *   X/Y in 1e-6 arcsec, UT1-UTC and LOD in 0.1 microseconds.
 * A real record is bundled so the game still shows an Earth lock offline.
 */

const MIRROR = 'https://igs.bkg.bund.de/root_ftp/IGS/products'
const CACHE_MS = 3 * 60 * 60 * 1000
const TIMEOUT_MS = 9000
const PRODUCT = /IGS0OPS(?:RAP|ULT|FIN|SNX)_\d{11}_[A-Z0-9]{3}_[A-Z0-9]{3}_ERP\.ERP\.gz/g

// IGS ultra-rapid ERP for 2026-11-15, fetched from the mirror on 2026-11-15.
const SNAPSHOT = {
  mjd: 61359,
  date: '2026-11-15',
  x: 0.120752,
  y: 0.326151,
  ut1: -0.069541,
  lod: 1.0387,
  product: 'IGS0OPSULT_20263181200_02D_01D_ERP',
  source: 'IGS ultra-rapid ERP',
  live: false,
}

let cache = { at: 0, data: null }
let inFlight = null

function mjdNow() {
  return Math.floor(Date.now() / 86400000) + 40587
}

function gpsWeek() {
  return Math.floor((mjdNow() - 44244) / 7)
}

/** Millisecond timestamp encoded in an IGS product name, e.g. 20263181200. */
function stamp(name) {
  const match = /_(20\d{2})(\d{3})(\d{2})(\d{2})_/.exec(name)
  if (!match) return 0
  return Date.UTC(+match[1], 0, 1) + (+match[2] - 1) * 86400000 + +match[3] * 3600000 + +match[4] * 60000
}

function sourceOf(name) {
  if (name.includes('OPSULT_')) return 'IGS ultra-rapid ERP'
  if (name.includes('OPSRAP_')) return 'IGS rapid ERP'
  return 'IGS final ERP'
}

function round(value, digits) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

async function listWeek(week) {
  const res = await fetch(`${MIRROR}/${week}/`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) return []
  const html = await res.text()
  return [...new Set(html.match(PRODUCT) ?? [])]
}

async function fetchProduct(name, week) {
  const res = await fetch(`${MIRROR}/${week}/${name}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`ERP MIRROR HTTP ${res.status}`)
  const body = Buffer.from(await res.arrayBuffer())
  if (body.length > 512 * 1024) throw new Error('ERP PRODUCT TOO LARGE')
  return gunzipSync(body).toString('utf8')
}

/** The ERP row closest to today, converted to arcseconds, seconds and milliseconds. */
function parseErp(text) {
  const rows = new Map()
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5 || !/^\d+(\.\d+)?$/.test(parts[0])) continue
    const [mjd, x, y, ut1, lod] = parts.slice(0, 5).map(Number)
    if (![mjd, x, y, ut1, lod].every(Number.isFinite)) continue
    rows.set(mjd, { mjd, x: x / 1e6, y: y / 1e6, ut1: ut1 * 1e-7, lod: lod * 1e-4 })
  }
  if (!rows.size) throw new Error('ERP PRODUCT HAD NO ROWS')
  const today = mjdNow()
  const row = [...rows.values()].sort((a, b) => Math.abs(a.mjd - today) - Math.abs(b.mjd - today))[0]
  return {
    mjd: row.mjd,
    date: new Date((row.mjd - 40587) * 86400000).toISOString().slice(0, 10),
    x: round(row.x, 6),
    y: round(row.y, 6),
    ut1: round(row.ut1, 7),
    lod: round(row.lod, 4),
  }
}

async function fetchLatest() {
  const now = Date.now()
  const week = gpsWeek()
  const listings = await Promise.all([0, 1, 2].map((back) => listWeek(week - back).catch(() => [])))
  const products = listings.flatMap((names, back) => names.map((name) => ({ name, week: week - back })))
  if (!products.length) throw new Error('NO ERP PRODUCTS IN THE MIRROR')

  const byStamp = (a, b) => stamp(b.name) - stamp(a.name)
  const rapid = products.filter((p) => p.name.includes('OPSRAP_')).sort(byStamp)
  // Fresh rapid files are observed rather than predicted; otherwise take the newest product.
  const pick = rapid.find((p) => now - stamp(p.name) < 3 * 86400000) ?? products.sort(byStamp)[0]

  const row = parseErp(await fetchProduct(pick.name, pick.week))
  return { ...row, product: pick.name.replace(/\.gz$/, ''), source: sourceOf(pick.name), live: true }
}

/** Cached Earth rotation fix; never rejects, so the dish always has telemetry. */
export async function getEarthRotation() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const data = { ...(await fetchLatest()), fetchedAt: new Date().toISOString() }
      cache = { at: Date.now(), data }
      return data
    } catch {
      if (cache.data) return { ...cache.data, live: false }
      return { ...SNAPSHOT, fetchedAt: new Date().toISOString() }
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}
