import * as THREE from 'three'

// Simple, recognizable furniture shapes built from boxes. A piece's group sits
// on the floor at its center; local x is its width, local z its depth with the
// back at -z. Sizes come in inches.

const COLORS = {
  bed: { frame: '#6b5040', mattress: '#ece8e1', pillow: '#f8f7f4', blanket: '#8a9bb0' },
  sofa: { body: '#7c7f86', cushion: '#8b8e95' },
  table: { top: '#9a7351', legs: '#6e5038' },
  chair: { body: '#8a6646', seat: '#8a6646' },
  stool: { body: '#3a2a22', seat: '#18181a' },
  cabinet: { body: '#8c6b4c', top: '#7a5c41' },
}

export function buildFurniturePiece(f, mat) {
  const g = new THREE.Group()
  const W = f.w / 12
  const D = f.d / 12
  const H = f.h / 12
  const box = (w, h, d, x, y, z, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    g.add(m)
    return m
  }
  const c = { ...(COLORS[f.kind] ?? COLORS.cabinet), ...f.colors }

  if (f.kind === 'bed') {
    const base = H * 0.45
    box(W, base, D, 0, base / 2, 0, c.frame)
    box(W - 0.1, H - base, D - 0.15, 0, base + (H - base) / 2, 0.05, c.mattress)
    box(W - 0.1, 0.12, D * 0.62, 0, H + 0.04, D * 0.17, c.blanket)
    box(W - 0.5, 0.25, 1.3, 0, H + 0.12, -D / 2 + 0.9, c.pillow)
    box(W + 0.1, H + 1.4, 0.2, 0, (H + 1.4) / 2, -D / 2 - 0.05, c.frame)
  } else if (f.kind === 'sofa') {
    const seat = Math.min(1.5, H * 0.5)
    const arm = Math.min(0.55, W * 0.15)
    box(W, seat, D, 0, seat / 2, 0, c.body)
    box(W - 2 * arm, 0.35, D * 0.7, 0, seat + 0.17, D * 0.12, c.cushion)
    box(W, H, D * 0.25, 0, H / 2, -D / 2 + D * 0.125, c.body)
    for (const s of [-1, 1]) box(arm, H * 0.7, D, s * (W / 2 - arm / 2), (H * 0.7) / 2, 0, c.body)
  } else if (f.kind === 'table') {
    const top = 0.12
    box(W, top, D, 0, H - top / 2, 0, c.top)
    const leg = 0.18
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(leg, H - top, leg, sx * (W / 2 - leg), (H - top) / 2, sz * (D / 2 - leg), c.legs)
  } else if (f.kind === 'chair') {
    const seatH = Math.min(1.5, H * 0.53)
    box(W, 0.14, D, 0, seatH, 0, c.seat)
    box(W, H - seatH, 0.12, 0, seatH + (H - seatH) / 2, -D / 2 + 0.06, c.body)
    const leg = 0.12
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(leg, seatH, leg, sx * (W / 2 - leg), seatH / 2, sz * (D / 2 - leg), c.body)
  } else if (f.kind === 'stool') {
    // Backless saddle stool: padded seat on four legs with a footrest ring
    box(W, 0.25, D, 0, H - 0.12, 0, c.seat)
    const leg = 0.13
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(leg, H - 0.25, leg, sx * (W / 2 - leg), (H - 0.25) / 2, sz * (D / 2 - leg), c.body)
    for (const sz of [-1, 1]) box(W - 2 * leg, 0.08, 0.08, 0, 0.75, sz * (D / 2 - leg), c.body)
  } else {
    box(W, H - 0.06, D, 0, (H - 0.06) / 2, 0, c.body)
    box(W + 0.04, 0.06, D + 0.04, 0, H - 0.03, 0, c.top)
  }

  g.position.set(f.x, 0, f.y)
  g.rotation.y = -THREE.MathUtils.degToRad(f.rot ?? 0)
  return g
}
