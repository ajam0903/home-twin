import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Simple, recognizable furniture shapes. A piece's group sits on the floor at
// its center; local x is its width, local z its depth with the back at -z.
// Sizes come in inches. f.look (from the AI helper: colors, arm and back
// style, legs, table top and base, headboard, drawers) shapes the details;
// without it each kind gets its plain default.

const COLORS = {
  bed: { frame: '#6b5040', mattress: '#ece8e1', pillow: '#f8f7f4', blanket: '#8a9bb0' },
  sofa: { body: '#7c7f86', cushion: '#8b8e95' },
  table: { top: '#9a7351', legs: '#6e5038' },
  chair: { body: '#8a6646', seat: '#8a6646' },
  stool: { body: '#3a2a22', seat: '#18181a' },
  cabinet: { body: '#8c6b4c', top: '#7a5c41' },
}

const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null)
// A lighter or darker tone of a color (k > 1 lightens)
const tone = (color, k) => `#${new THREE.Color(color).multiplyScalar(k).getHexString()}`
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function buildFurniturePiece(f, mat) {
  const g = new THREE.Group()
  const W = f.w / 12
  const D = f.d / 12
  const H = f.h / 12
  const look = f.look ?? {}
  // A look measurement in feet, when it is given and fits the piece
  const ft = (inches, fallback, max = H) => (Number(inches) > 0 && inches / 12 <= max ? inches / 12 : fallback)

  const add = (geometry, color, x, y, z) => {
    const m = new THREE.Mesh(geometry, mat(color))
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    g.add(m)
    return m
  }
  const box = (w, h, d, x, y, z, color) => add(new THREE.BoxGeometry(w, h, d), color, x, y, z)
  // Soft box for cushions and upholstery
  const soft = (w, h, d, x, y, z, color, r = 0.08) =>
    add(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), color, x, y, z)

  // Four legs under a w x d footprint, from the floor up to height h
  const legs = (w, d, h, style, color, inset = 0.12) => {
    if (h <= 0.01 || style === 'none') return
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - inset)
        const z = sz * (d / 2 - inset)
        if (style === 'splayed') {
          // Tapered leg angled out from its top corner (mid-century)
          const a = 0.2
          const len = h / Math.cos(a)
          const geo = new THREE.CylinderGeometry(0.06, 0.035, len, 10)
          geo.translate(0, -len / 2, 0)
          const m = add(geo, color, x, h, z)
          m.rotation.set(-sz * a * 0.7, 0, sx * a * 0.7)
        } else if (style === 'tapered') {
          add(new THREE.CylinderGeometry(0.06, 0.035, h, 10), color, x, h / 2, z)
        } else if (style === 'turned') {
          add(new THREE.CylinderGeometry(0.05, 0.04, h, 12), color, x, h / 2, z)
          add(new THREE.SphereGeometry(0.075, 12, 8), color, x, h * 0.55, z)
        } else if (style === 'metal') {
          box(0.05, h, 0.05, x, h / 2, z, color)
        } else {
          box(0.15, h, 0.15, x, h / 2, z, color)
        }
      }
    }
  }

  if (f.kind === 'bed') {
    const c = COLORS.bed
    const frame = hex(look.main_color) ?? c.frame
    const mattress = hex(look.accent_color) ?? c.mattress
    const legH = look.leg_style && look.leg_style !== 'none' ? ft(look.leg_height, 0.4, H * 0.6) : 0
    const base = Math.max(H * 0.45 - legH, 0.2)
    legs(W, D, legH, look.leg_style, hex(look.leg_color) ?? frame)
    box(W, base, D, 0, legH + base / 2, 0, frame)
    const top = legH + base
    box(W - 0.1, Math.max(H - top, 0.3), D - 0.15, 0, top + Math.max(H - top, 0.3) / 2, 0.05, mattress)
    const bedTop = Math.max(H, top + 0.3)
    box(W - 0.1, 0.12, D * 0.62, 0, bedTop + 0.04, D * 0.17, c.blanket)
    soft(W / 2 - 0.35, 0.3, 1.3, -W / 4 + 0.05, bedTop + 0.12, -D / 2 + 0.9, c.pillow, 0.12)
    soft(W / 2 - 0.35, 0.3, 1.3, W / 4 - 0.05, bedTop + 0.12, -D / 2 + 0.9, c.pillow, 0.12)
    const style = look.headboard ?? 'panel'
    const hbH = ft(look.headboard_height, bedTop + 1.4, 8)
    if (style === 'upholstered') {
      soft(W + 0.2, hbH, 0.35, 0, hbH / 2, -D / 2 - 0.1, frame, 0.12)
    } else if (style === 'slatted') {
      for (const s of [-1, 1]) box(0.25, hbH, 0.25, s * (W / 2 - 0.05), hbH / 2, -D / 2 - 0.05, frame)
      box(W + 0.1, 0.25, 0.2, 0, hbH - 0.12, -D / 2 - 0.05, frame)
      const n = Math.max(3, Math.round(W / 0.45))
      for (let i = 0; i < n; i++) box(0.22, hbH - bedTop, 0.1, -W / 2 + (W * (i + 0.5)) / n, bedTop + (hbH - bedTop) / 2, -D / 2 - 0.05, frame)
    } else if (style === 'panel') {
      box(W + 0.1, hbH, 0.2, 0, hbH / 2, -D / 2 - 0.05, frame)
    }
  } else if (f.kind === 'sofa') {
    const c = COLORS.sofa
    const body = hex(look.main_color) ?? c.body
    const cushion = hex(look.accent_color) ?? (look.main_color ? tone(body, 1.06) : c.cushion)
    const legStyle = look.leg_style ?? (f.look ? 'block' : 'none')
    const legH = legStyle === 'none' ? 0 : ft(look.leg_height, 0.33, H * 0.4)
    const arms = look.arms ?? 'track'
    const armW = arms === 'none' ? 0 : ft(look.arm_width, clamp(W * 0.12, 0.35, 0.6), W / 4)
    const armTop = ft(look.arm_height, H * 0.72)
    const seatTop = ft(look.seat_height, Math.min(1.55, H * 0.55), H * 0.8)
    const cushionT = clamp((seatTop - legH) * 0.45, 0.25, 0.42)
    const backD = clamp(D * 0.22, 0.45, 0.8)
    const innerW = W - 2 * armW
    legs(W, D, legH, legStyle, hex(look.leg_color) ?? '#3b2a20', 0.25)

    // Frame under the seat cushions
    const baseH = seatTop - cushionT - legH
    soft(innerW + 0.02, baseH, D, 0, legH + baseH / 2, 0, body, 0.06)

    // Back: tight or tufted upholstery, or a low frame behind loose cushions
    const back = look.back ?? 'cushions'
    const backZ = -D / 2 + backD / 2
    if (back === 'cushions') {
      const frameD = backD * 0.55
      soft(innerW + 0.02, H - legH, frameD, 0, legH + (H - legH) / 2, -D / 2 + frameD / 2, body, 0.1)
      const n = clamp(Math.round(look.seat_cushions ?? Math.round(innerW / 2.2)), 1, 4)
      const w = innerW / n
      const h = Math.max(H - seatTop - 0.1, 0.4)
      for (let i = 0; i < n; i++) {
        const m = soft(w - 0.06, h, backD * 0.55, -innerW / 2 + w * (i + 0.5), seatTop + h / 2, -D / 2 + frameD + backD * 0.2, cushion, 0.14)
        m.rotation.x = -0.12
      }
    } else {
      soft(innerW + 0.02, H - legH, backD, 0, legH + (H - legH) / 2, backZ, body, 0.14)
      if (back === 'tufted') {
        const cols = Math.max(2, Math.round(innerW / 0.6))
        const rows = H - seatTop > 1.1 ? 2 : 1
        const button = tone(body, 0.7)
        const span = H - seatTop - 0.25
        for (let r = 0; r < rows; r++) {
          for (let i = 0; i < cols; i++) {
            const x = -innerW / 2 + (innerW * (i + 0.5)) / cols
            const y = seatTop + 0.15 + (span * (r + 1)) / (rows + 1)
            add(new THREE.SphereGeometry(0.035, 8, 6), button, x, y, backZ + backD / 2)
          }
        }
      }
    }

    // Seat cushions
    const seats = clamp(Math.round(look.seat_cushions ?? (innerW > 4.5 ? 3 : innerW > 2.5 ? 2 : 1)), 1, 4)
    const seatD = D - backD - 0.02
    const sw = innerW / seats
    for (let i = 0; i < seats; i++) {
      soft(sw - 0.04, cushionT, seatD, -innerW / 2 + sw * (i + 0.5), seatTop - cushionT / 2, D / 2 - seatD / 2, cushion, 0.1)
    }

    // Arms
    for (const s of [-1, 1]) {
      if (arms === 'none') break
      const x = s * (W / 2 - armW / 2)
      const h = armTop - legH
      if (arms === 'rounded') {
        soft(armW, h, D, x, legH + h / 2, 0, body, Math.min(armW * 0.45, 0.22))
      } else if (arms === 'rolled') {
        const r = armW * 0.6
        soft(armW, h - r, D, x, legH + (h - r) / 2, 0, body, 0.05)
        const roll = add(new THREE.CylinderGeometry(r, r, D, 16), body, x + s * (r - armW / 2), armTop - r, 0)
        roll.rotation.x = Math.PI / 2
      } else if (arms === 'sloped') {
        // Side profile: full height at the back, lower toward the front
        const shape = new THREE.Shape()
        shape.moveTo(-D / 2, 0)
        shape.lineTo(D / 2, 0)
        shape.lineTo(D / 2, h * 0.7)
        shape.lineTo(-D / 2 + backD, h)
        shape.lineTo(-D / 2, h)
        const geo = new THREE.ExtrudeGeometry(shape, { depth: armW, bevelEnabled: false })
        // profile across the depth (back at -z), extruded across the arm's width
        geo.rotateY(-Math.PI / 2)
        geo.translate(armW / 2, 0, 0)
        add(geo, body, x, legH, 0)
      } else {
        soft(armW, h, D, x, legH + h / 2, 0, body, 0.05)
      }
    }

    // Throw pillows leaning on the back
    const pillows = clamp(Math.round(look.pillows ?? 0), 0, 6)
    const pw = Math.min(1.4, (innerW - 0.2) / Math.max(pillows, 1))
    for (let i = 0; i < pillows; i++) {
      const x = -innerW / 2 + (innerW * (i + 0.5)) / pillows
      const m = soft(pw, pw, 0.35, x, seatTop + pw / 2 - 0.05, -D / 2 + backD + 0.2, hex(look.accent_color) ?? tone(body, 1.25), 0.15)
      m.rotation.x = -0.25
    }
  } else if (f.kind === 'table') {
    const c = COLORS.table
    const topColor = hex(look.accent_color) ?? hex(look.main_color) ?? c.top
    const legColor = hex(look.leg_color) ?? hex(look.main_color) ?? c.legs
    const t = 0.12
    const shape = look.top_shape ?? 'rectangle'
    if (shape === 'round' || shape === 'oval') {
      const m = add(new THREE.CylinderGeometry(W / 2, W / 2, t, 40), topColor, 0, H - t / 2, 0)
      m.scale.z = D / W
    } else {
      box(W, t, D, 0, H - t / 2, 0, topColor)
    }
    const base = look.table_base ?? 'four_legs'
    const legH = H - t
    if (base === 'pedestal') {
      add(new THREE.CylinderGeometry(0.22, 0.3, legH, 16), legColor, 0, legH / 2, 0)
      add(new THREE.CylinderGeometry(Math.min(W, D) * 0.3, Math.min(W, D) * 0.33, 0.12, 24), legColor, 0, 0.06, 0)
    } else if (base === 'trestle') {
      for (const s of [-1, 1]) {
        box(0.2, legH, D * 0.6, s * (W / 2 - 0.6), legH / 2, 0, legColor)
        box(0.3, 0.15, D * 0.75, s * (W / 2 - 0.6), 0.075, 0, legColor)
      }
      box(W - 1.2, 0.18, 0.18, 0, legH * 0.3, 0, legColor)
    } else {
      const round = shape !== 'rectangle'
      // legs sit inside a round top's edge
      const w = round ? W * 0.72 : W
      const d = round ? D * 0.72 : D
      legs(w, d, legH, look.leg_style && look.leg_style !== 'none' ? look.leg_style : 'block', legColor, 0.18)
    }
  } else if (f.kind === 'chair') {
    const c = COLORS.chair
    const body = hex(look.main_color) ?? c.body
    const seat = hex(look.accent_color) ?? body
    const seatH = ft(look.seat_height, Math.min(1.5, H * 0.53), H * 0.8)
    box(W, 0.14, D, 0, seatH, 0, seat)
    box(W, H - seatH, 0.12, 0, seatH + (H - seatH) / 2, -D / 2 + 0.06, body)
    legs(W, D, seatH - 0.07, look.leg_style && look.leg_style !== 'none' ? look.leg_style : 'block', hex(look.leg_color) ?? body, 0.1)
  } else if (f.kind === 'stool') {
    // Backless saddle stool: padded seat on four legs with a footrest ring
    const c = COLORS.stool
    const body = hex(look.leg_color) ?? hex(look.main_color) ?? c.body
    soft(W, 0.25, D, 0, H - 0.12, 0, hex(look.accent_color) ?? (look.leg_color ? hex(look.main_color) : null) ?? c.seat, 0.08)
    legs(W, D, H - 0.25, look.leg_style && look.leg_style !== 'none' ? look.leg_style : 'block', body, 0.1)
    for (const sz of [-1, 1]) box(W - 0.26, 0.08, 0.08, 0, 0.75, sz * (D / 2 - 0.13), body)
  } else {
    const c = COLORS.cabinet
    const body = hex(look.main_color) ?? c.body
    const top = hex(look.accent_color) ?? (look.main_color ? tone(body, 0.9) : c.top)
    const legH = look.leg_style && look.leg_style !== 'none' ? ft(look.leg_height, 0.35, H * 0.4) : 0
    legs(W, D, legH, look.leg_style, hex(look.leg_color) ?? tone(body, 0.75), 0.15)
    const bodyH = H - 0.06 - legH
    box(W, bodyH, D, 0, legH + bodyH / 2, 0, body)
    box(W + 0.04, 0.06, D + 0.04, 0, H - 0.03, 0, top)

    // Drawer and door fronts: raised panels with a knob each
    const front = tone(body, 1.05)
    const knob = hex(look.leg_color) ?? '#c9b48a'
    const panel = (w, h, x, y, knobX, knobY) => {
      box(w - 0.06, h - 0.06, 0.04, x, y, D / 2 + 0.02, front)
      add(new THREE.SphereGeometry(0.035, 8, 6), knob, knobX, knobY, D / 2 + 0.06)
    }
    const drawers = clamp(Math.round(look.drawers ?? 0), 0, 24)
    const doors = clamp(Math.round(look.doors ?? 0), 0, 8)
    const y0 = legH + 0.06
    const fh = bodyH - 0.12
    if (drawers) {
      const cols = clamp(Math.round(look.drawer_columns ?? (W > 4 && drawers > 3 ? 2 : 1)), 1, 4)
      const rows = Math.ceil(drawers / cols)
      // with doors too, drawers take the top third
      const dh = (doors ? fh / 3 : fh) / rows
      const dyTop = y0 + fh
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < cols; i++) {
          const w = (W - 0.12) / cols
          const x = -W / 2 + 0.06 + w * (i + 0.5)
          const y = dyTop - dh * (r + 0.5)
          panel(w, dh, x, y, x, y)
        }
      }
    }
    if (doors) {
      const h = drawers ? (fh * 2) / 3 : fh
      const w = (W - 0.12) / doors
      for (let i = 0; i < doors; i++) {
        const x = -W / 2 + 0.06 + w * (i + 0.5)
        // knobs toward the meeting edge of a pair
        const kx = x + (doors > 1 ? (i % 2 ? -1 : 1) * (w / 2 - 0.15) : w / 2 - 0.15)
        panel(w, h, x, y0 + h / 2, kx, y0 + h * 0.6)
      }
    }
  }

  g.position.set(f.x, 0, f.y)
  g.rotation.y = -THREE.MathUtils.degToRad(f.rot ?? 0)
  return g
}
