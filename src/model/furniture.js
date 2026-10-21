import { WALLS, openingPoint } from './house.js'

// Furniture the owner places and edits in the app. Sizes are in inches (as
// you would measure them); positions are plan feet at the center of the
// piece; rotation is in degrees, clockwise seen from above. Rotation 0 puts
// the back of the piece (headboard, sofa back) toward the rear of the house.

export const FURNITURE_PRESETS = [
  { kind: 'bed', name: 'Twin bed', w: 39, d: 75, h: 24 },
  { kind: 'bed', name: 'Full bed', w: 54, d: 75, h: 24 },
  { kind: 'bed', name: 'Queen bed', w: 60, d: 80, h: 24 },
  { kind: 'bed', name: 'King bed', w: 76, d: 80, h: 24 },
  { kind: 'sofa', name: 'Sofa', w: 84, d: 36, h: 34 },
  { kind: 'sofa', name: 'Armchair', w: 34, d: 34, h: 34 },
  { kind: 'table', name: 'Coffee table', w: 48, d: 24, h: 18 },
  { kind: 'table', name: 'Dining table', w: 72, d: 40, h: 30 },
  { kind: 'chair', name: 'Dining chair', w: 18, d: 20, h: 38 },
  { kind: 'stool', name: 'Counter stool', w: 18, d: 14, h: 26 },
  { kind: 'table', name: 'Desk', w: 60, d: 30, h: 30 },
  { kind: 'cabinet', name: 'Dresser', w: 60, d: 20, h: 34 },
  { kind: 'cabinet', name: 'Nightstand', w: 22, d: 18, h: 24 },
  { kind: 'cabinet', name: 'Bookcase', w: 36, d: 12, h: 72 },
  { kind: 'cabinet', name: 'TV stand', w: 60, d: 18, h: 24 },
  { kind: 'cabinet', name: 'Box / other', w: 24, d: 24, h: 24 },
]

// Optional `colors` override a kind's default colors (see three/furniture.js).
const ESPRESSO = { body: '#3a2a22', seat: '#18181a' }
export const DEFAULT_FURNITURE = [
  { id: 'nook-bed', kind: 'bed', name: 'Twin bed', level: 'L2', x: 43.75, y: 21.2, w: 39, d: 75, h: 24, rot: 0 },
  // Kitchen, from photos (Oct 2026): dinette set along the half wall by the bay,
  // stools at the island, black storage cabinet on the wall toward the foyer
  { id: 'dinette-table', kind: 'table', name: 'Dinette table', level: 'L1', x: 19.1, y: 4.5, w: 36, d: 60, h: 30, rot: 0, colors: { top: '#a39686', legs: '#3a2a22' } },
  { id: 'dinette-chair-1', kind: 'chair', name: 'Dinette chair', level: 'L1', x: 19.1, y: 7.7, w: 18, d: 21, h: 38, rot: 180, colors: ESPRESSO },
  { id: 'dinette-chair-2', kind: 'chair', name: 'Dinette chair', level: 'L1', x: 19.1, y: 1.3, w: 18, d: 21, h: 38, rot: 0, colors: ESPRESSO },
  { id: 'dinette-chair-3', kind: 'chair', name: 'Dinette chair', level: 'L1', x: 21.5, y: 3.4, w: 18, d: 21, h: 38, rot: 90, colors: ESPRESSO },
  { id: 'dinette-chair-4', kind: 'chair', name: 'Dinette chair', level: 'L1', x: 21.5, y: 5.6, w: 18, d: 21, h: 38, rot: 90, colors: ESPRESSO },
  { id: 'island-stool-1', kind: 'stool', name: 'Counter stool', level: 'L1', x: 26.4, y: 6.7, w: 18, d: 14, h: 26, rot: 90, colors: ESPRESSO },
  { id: 'island-stool-2', kind: 'stool', name: 'Counter stool', level: 'L1', x: 26.4, y: 8.8, w: 18, d: 14, h: 26, rot: 90, colors: ESPRESSO },
  { id: 'black-cabinet', kind: 'cabinet', name: 'Black storage cabinet', level: 'L1', x: 23.6, y: 14.65, w: 26, d: 16, h: 58, rot: 180, colors: { body: '#1c1c1e', top: '#141416' } },
]

const KEY = 'homeTwin.furniture.v1'
const SEEDED = 'homeTwin.furnitureSeeded.v2'

// Kept in this browser, as a copy of the shared layout (see model/shared.js).
// Defaults added to the app later are placed once into a saved layout; ones
// the owner removed stay removed. Loading has no side effects (React may call
// it twice); saving records which defaults have been placed.
export function loadFurniture() {
  let list = null
  let seeded = []
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (Array.isArray(saved)) list = saved
    seeded = JSON.parse(localStorage.getItem(SEEDED)) ?? (list ? list.map((f) => f.id) : [])
  } catch {
    // no saved layout
  }
  return withNewDefaults(list ?? [], seeded)
}

// A layout plus the defaults it has not had yet (`seeded`: default ids
// already placed once)
export function withNewDefaults(list, seeded = []) {
  const out = Array.isArray(list) ? [...list] : []
  for (const f of DEFAULT_FURNITURE) {
    if (!seeded.includes(f.id) && !out.some((g) => g.id === f.id)) out.push({ ...f })
  }
  return out
}

export const defaultFurnitureIds = () => DEFAULT_FURNITURE.map((f) => f.id)

export function saveFurniture(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    localStorage.setItem(SEEDED, JSON.stringify(defaultFurnitureIds()))
  } catch {
    // storage unavailable: changes last for this session only
  }
}

// ---------------------------------------------------------------- walls
// Furniture may not overlap a wall. A piece can stand in a doorway or a
// framed opening if it fits under the head; window openings count as wall.

let wallsByLevel = null
function walls(level) {
  if (!wallsByLevel) {
    wallsByLevel = {}
    for (const w of WALLS) {
      const [ax, ay] = w.a
      const [bx, by] = w.b
      const L = Math.hypot(bx - ax, by - ay)
      const gaps = (w.openings ?? [])
        .filter((op) => (op.sill ?? 0) <= 0.01)
        .map((op) => {
          const { d } = openingPoint(w, op)
          return { s0: d - op.w / 2, s1: d + op.w / 2, head: op.head }
        })
      ;(wallsByLevel[w.level] ??= []).push({ ax, ay, ux: (bx - ax) / L, uy: (by - ay) / L, L, t: w.t, gaps })
    }
  }
  return wallsByLevel[level] ?? []
}

// Solid stretches of a wall (along it, ends overlapping the walls they meet)
// for a piece `h` feet tall
function solidSpans(w, h) {
  const spans = []
  let s = -w.t / 2
  for (const g of [...w.gaps].sort((a, b) => a.s0 - b.s0)) {
    if (h > g.head) continue
    if (g.s0 > s) spans.push([s, g.s0])
    s = Math.max(s, g.s1)
  }
  if (w.L + w.t / 2 > s) spans.push([s, w.L + w.t / 2])
  return spans
}

const dot = (p, q) => p[0] * q[0] + p[1] * q[1]
// Separating-axis test for two rectangles {c, u, v, hu, hv}; touching is allowed
function overlaps(a, b) {
  const d = [b.c[0] - a.c[0], b.c[1] - a.c[1]]
  if (Math.hypot(...d) > Math.hypot(a.hu, a.hv) + Math.hypot(b.hu, b.hv)) return false
  for (const axis of [a.u, a.v, b.u, b.v]) {
    const ra = a.hu * Math.abs(dot(a.u, axis)) + a.hv * Math.abs(dot(a.v, axis))
    const rb = b.hu * Math.abs(dot(b.u, axis)) + b.hv * Math.abs(dot(b.v, axis))
    if (Math.abs(dot(d, axis)) >= ra + rb - 0.02) return false
  }
  return true
}

export function hitsWall(f) {
  const r = ((f.rot ?? 0) * Math.PI) / 180
  const a = { c: [f.x, f.y], u: [Math.cos(r), Math.sin(r)], v: [-Math.sin(r), Math.cos(r)], hu: f.w / 24, hv: f.d / 24 }
  for (const w of walls(f.level)) {
    for (const [s0, s1] of solidSpans(w, f.h / 12)) {
      const m = (s0 + s1) / 2
      const b = { c: [w.ax + w.ux * m, w.ay + w.uy * m], u: [w.ux, w.uy], v: [-w.uy, w.ux], hu: (s1 - s0) / 2, hv: w.t / 2 }
      if (overlaps(a, b)) return true
    }
  }
  return false
}

// Move a piece from `from` toward (x, y) in short steps, sliding along walls
// and stopping at them. A piece that already overlaps a wall moves freely
// until it is clear.
export function moveFurniture(from, x, y) {
  if (hitsWall(from)) return { x, y }
  // Steps shorter than the thinnest wall, each taken from where the piece is
  // now, so it can never hop over a wall
  const n = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 0.1))
  const sx = (x - from.x) / n
  const sy = (y - from.y) / n
  let cx = from.x
  let cy = from.y
  const free = (px, py) => !hitsWall({ ...from, x: px, y: py })
  for (let i = 0; i < n; i++) {
    if (free(cx + sx, cy + sy)) [cx, cy] = [cx + sx, cy + sy]
    else if (sx && free(cx + sx, cy)) cx += sx
    else if (sy && free(cx, cy + sy)) cy += sy
  }
  // the last free spot, snapped to the inch if that is still free
  const rx = Math.round(cx * 12) / 12
  const ry = Math.round(cy * 12) / 12
  return free(rx, ry) ? { x: rx, y: ry } : { x: cx, y: cy }
}

// After a typed change (size, rotation) pushes a piece into a wall: the
// nearest free spot within 3 feet, else the change is undone.
export function settleFurniture(next, prev) {
  if (!hitsWall(next) || (prev && hitsWall(prev))) return next
  const step = 1 / 12
  for (let r = 1; r <= 36; r++) {
    let best = null
    let bestD = Infinity
    for (let i = -r; i <= r; i++) {
      for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]]) {
        const dd = dx * dx + dy * dy
        if (dd >= bestD) continue
        const c = { ...next, x: next.x + dx * step, y: next.y + dy * step }
        if (!hitsWall(c)) [best, bestD] = [c, dd]
      }
    }
    if (best) return best
  }
  return prev ?? next
}

export const feetInches = (inches) => {
  const ft = Math.floor(inches / 12)
  const inch = Math.round(inches - ft * 12)
  return inch === 12 ? `${ft + 1}'-0"` : `${ft}'-${inch}"`
}
