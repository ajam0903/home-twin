import * as THREE from 'three'

// Exterior surface textures drawn on canvases: architectural asphalt
// shingles, and double 4" vinyl lap siding. Each comes with
// a grayscale bump map so the courses catch the light. UVs are in feet (see
// applyWorldUV), so a texture's repeat is 1 / (its tile size in feet).

let seed = 11
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function canvasPair(w, h) {
  const make = () => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  const color = make()
  const bump = make()
  return { color, bump, cx: color.getContext('2d'), bx: bump.getContext('2d') }
}

function textures({ color, bump }, feet, anisotropy) {
  const wrap = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / feet[0], 1 / feet[1])
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = anisotropy
    return t
  }
  return { map: wrap(color, true), bumpMap: wrap(bump, false) }
}

// Fine speckle that tiles seamlessly (each pixel is independent)
function speckle(ctx, w, h, amount, light = 255) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount
    d[i] = Math.max(0, Math.min(light, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(light, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(light, d[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
}

// Architectural (laminated) shingles in a weathered brown-gray, matched to an
// aerial photo of the house (Oct 2026): 5" courses of random-width tabs, low
// contrast, with a slightly darker laminate showing at some butt edges.
// Tile: 6' along the course x 5' up the slope.
export function shingleTextures(anisotropy) {
  const PX = 128 // per foot
  const W = 6 * PX
  const COURSES = 12
  const H = COURSES * (5 / 12) * PX
  const ch = H / COURSES
  const p = canvasPair(W, H)
  const { cx, bx } = p
  cx.fillStyle = '#46413f'
  cx.fillRect(0, 0, W, H)
  bx.fillStyle = '#000'
  bx.fillRect(0, 0, W, H)
  for (let r = 0; r < COURSES; r++) {
    const top = r * ch // canvas y grows down the slope
    let x = -rand() * 60
    while (x < W) {
      // pick everything for this tab once, then draw it twice (shifted by the
      // width) so tabs that cross the edge tile seamlessly
      const tw = 40 + rand() * 90
      const tone = 76 + rand() * 20
      const warm = rand() * 4
      const patch = rand() < 0.4 ? { w: tw * (0.3 + rand() * 0.5), at: rand() } : null
      const rgb = (d) => `rgb(${tone + d + 4 + warm},${tone + d},${tone + d - 2})`
      for (const off of [0, W]) {
        const x0 = x - off
        const grad = cx.createLinearGradient(0, top, 0, top + ch)
        grad.addColorStop(0, rgb(-8))
        grad.addColorStop(0.7, rgb(0))
        grad.addColorStop(1, rgb(-5))
        cx.fillStyle = grad
        cx.fillRect(x0, top, tw - 2, ch)
        if (patch) {
          cx.fillStyle = 'rgba(48,40,37,0.32)'
          cx.fillRect(x0 + patch.at * (tw - patch.w), top + ch * 0.62, patch.w, ch * 0.38)
        }
        // bump: each tab thickens toward its butt edge
        const bg = bx.createLinearGradient(0, top, 0, top + ch)
        bg.addColorStop(0, '#202020')
        bg.addColorStop(0.92, '#b0b0b0')
        bg.addColorStop(1, '#d8d8d8')
        bx.fillStyle = bg
        bx.fillRect(x0, top, tw - 2, ch)
      }
      x += tw
    }
    // butt edge shadow line at the bottom of each course
    cx.fillStyle = 'rgba(30,24,22,0.4)'
    cx.fillRect(0, top + ch - 3, W, 3)
    bx.fillStyle = '#000'
    bx.fillRect(0, top + ch - 1, W, 1)
  }
  speckle(p.cx, W, H, 22)
  speckle(p.bx, W, H, 40)
  return textures(p, [6, 5], anisotropy)
}

// Double 4" vinyl lap siding, near white (the material color tints it).
// Tile: 8' long x 8 courses (2'-8").
export function sidingTextures(anisotropy) {
  const PX = 96
  const W = 8 * PX
  const COURSES = 8
  const H = Math.round(COURSES * (4 / 12) * PX)
  const ch = H / COURSES
  const p = canvasPair(W, H)
  const { cx, bx } = p
  for (let r = 0; r < COURSES; r++) {
    const top = r * ch
    // each lap: lighter at the top, shading toward the butt that casts a shadow below
    const g = cx.createLinearGradient(0, top, 0, top + ch)
    g.addColorStop(0, '#f6f6f4')
    g.addColorStop(0.75, '#ffffff')
    g.addColorStop(0.97, '#e9e9e6')
    g.addColorStop(1, '#bdbdb8')
    cx.fillStyle = g
    cx.fillRect(0, top, W, ch)
    const b = bx.createLinearGradient(0, top, 0, top + ch)
    b.addColorStop(0, '#303030')
    b.addColorStop(0.95, '#d0d0d0')
    b.addColorStop(1, '#ffffff')
    bx.fillStyle = b
    bx.fillRect(0, top, W, ch)
    // a seam where two panels overlap, staggered course to course
    const seam = ((r * 0.37 + 0.13) % 1) * W
    cx.fillStyle = 'rgba(0,0,0,0.08)'
    cx.fillRect(seam, top, 2, ch)
  }
  // faint woodgrain streaks running along the panels
  cx.globalAlpha = 0.05
  for (let i = 0; i < 260; i++) {
    const y = rand() * H
    const x = rand() * W
    const len = 40 + rand() * 160
    cx.fillStyle = rand() < 0.5 ? '#000' : '#fff'
    for (const off of [0, W]) cx.fillRect(x - off, y, len, 1)
  }
  cx.globalAlpha = 1
  speckle(cx, W, H, 6)
  return textures(p, [8, COURSES * (4 / 12)], anisotropy)
}

// Value noise that tiles over the canvas: a grid of random values, smoothly
// interpolated, wrapping at the edges. Returns 0..1.
function tilingNoise(cells) {
  const g = Array.from({ length: cells * cells }, () => rand())
  const at = (i, j) => g[((j + cells) % cells) * cells + ((i + cells) % cells)]
  return (u, v) => {
    const x = u * cells
    const y = v * cells
    const i = Math.floor(x)
    const j = Math.floor(y)
    const fx = x - i
    const fy = y - j
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx
    return a + (b - a) * sy
  }
}

// Fill a canvas pixel by pixel from layered tiling noise
function noiseCanvas(size, paint) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const layers = [tilingNoise(4), tilingNoise(12), tilingNoise(48)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const [r, g, b] = paint(layers[0](u, v), layers[1](u, v), layers[2](u, v), rand())
      const k = (y * size + x) * 4
      img.data[k] = r
      img.data[k + 1] = g
      img.data[k + 2] = b
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function single(canvas, feet, anisotropy) {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / feet, 1 / feet)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = anisotropy
  return t
}

// Mown lawn: mottled greens with fine blade speckle and a few dry patches.
// Tile: 12'.
export function grassTexture(anisotropy) {
  const c = noiseCanvas(512, (big, mid, fine, n) => {
    const k = 0.82 + big * 0.22 + mid * 0.12 + fine * 0.08 + (n - 0.5) * 0.16
    const dry = Math.max(0, big * mid - 0.42) * 1.6
    return [(118 + dry * 60) * k, (156 + dry * 20) * k, (96 - dry * 10) * k]
  })
  return single(c, 12, anisotropy)
}

// Driveway asphalt: dark gray aggregate. Tile: 6'.
export function asphaltTexture(anisotropy) {
  const c = noiseCanvas(256, (big, mid, fine, n) => {
    const k = 72 + big * 10 + mid * 8 + (n - 0.5) * 34 + (n > 0.97 ? 40 : 0)
    return [k, k + 1, k + 4]
  })
  return single(c, 6, anisotropy)
}

// Broom-finished concrete walk with control joints every 4'. Tile: 4'.
export function concreteTexture(anisotropy) {
  const size = 256
  const c = noiseCanvas(size, (big, mid, fine, n) => {
    const k = 186 + big * 12 + mid * 8 + (n - 0.5) * 14
    return [k + 2, k, k - 6]
  })
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'rgba(70,64,58,0.55)'
  ctx.fillRect(0, 0, size, 2)
  ctx.fillRect(0, 0, 2, size)
  return single(c, 4, anisotropy)
}

// Replace a mesh's UVs with world-space coordinates in feet, so textures keep
// one scale and stay aligned across separate pieces.
//  'wall': vertical faces run along the wall horizontally and up in height
//  'roof': sloped faces run along the courses (level) and up the true slope
export function applyWorldUV(mesh, mode) {
  mesh.updateWorldMatrix(true, false)
  // Every piece built here keeps its own vertices per face, so the UVs can
  // follow each face's normal without splitting the geometry
  const geo = mesh.geometry
  if (!geo.attributes.normal) geo.computeVertexNormals()
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  const m = mesh.matrixWorld
  const nm = new THREE.Matrix3().getNormalMatrix(m)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(m)
    n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize()
    let u
    let v
    const hl = Math.hypot(n.x, n.z)
    if (mode === 'roof' && n.y > 0.2 && hl > 0.05) {
      // h points down the slope; the courses run across it
      const hx = n.x / hl
      const hz = n.z / hl
      u = p.x * -hz + p.z * hx
      v = -(p.x * hx + p.z * hz) / n.y // true distance up the slope
    } else if (Math.abs(n.y) < 0.5) {
      // vertical face: along the face, then height
      const tx = -n.z / (hl || 1)
      const tz = n.x / (hl || 1)
      u = p.x * tx + p.z * tz
      v = p.y
    } else {
      u = p.x
      v = p.z
    }
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
