import * as THREE from 'three'
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Trees and shrubs built from organic foliage clumps: noise-displaced spheres
// with smooth shading and per-vertex shade (leafy speckle, darker undersides
// and hollows), tinted per instance. Trunks and limbs are tapered cylinders.

const noise = new SimplexNoise({ random: seeded(4242) })

// Phones get coarser foliage: fewer, lower-poly clumps and a lighter
// understory. Set once per build, before any plant is made.
let low = false
export function setVegetationDetail(level) {
  low = level === 'low'
}

export function seeded(seed) {
  let s = seed % 2147483647 || 1
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// A unit foliage clump. `lumpy` sets how far the surface breaks up.
export function clumpGeometry(detail = 3, offset = 0, lumpy = 1) {
  let geo = new THREE.IcosahedronGeometry(1, detail)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const big = noise.noise3d(p.x * 1.3 + offset, p.y * 1.3, p.z * 1.3)
    const small = noise.noise3d(p.x * 3.6 + offset, p.y * 3.6 + 7, p.z * 3.6)
    const leaf = noise.noise3d(p.x * 9 + offset, p.y * 9, p.z * 9 + 3)
    const r = 1 + lumpy * (0.2 * big + 0.1 * small)
    pos.setXYZ(i, p.x * r, p.y * r * 0.92, p.z * r)
    // shade: hollows and undersides darker, a fine leafy speckle on top
    const hollow = 0.78 + 0.22 * Math.max(-1, Math.min(1, big * 1.2 + small * 0.6))
    const under = 0.62 + 0.38 * THREE.MathUtils.smoothstep(p.y, -1, 0.8)
    const k = hollow * under * (0.9 + 0.12 * leaf)
    colors[i * 3] = k * (1 + 0.04 * leaf)
    colors[i * 3 + 1] = k
    colors[i * 3 + 2] = k * (0.93 - 0.04 * leaf)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

export const foliageMaterial = (opts = {}) =>
  new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.92, ...opts })

// Tapered limb from a to b (Vector3), radii at each end.
export function limb(a, b, r0, r1, material, segments = 7) {
  const len = a.distanceTo(b)
  const geo = new THREE.CylinderGeometry(r1, r0, len, segments)
  const m = new THREE.Mesh(geo, material)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  m.castShadow = true
  return m
}

// One clump mesh (for the few featured plants; the woods are instanced).
const clumpCache = new Map()
export function clump(x, y, z, sx, sy, sz, color, variant = 0) {
  const key = `${variant}-${low}`
  if (!clumpCache.has(key)) clumpCache.set(key, clumpGeometry(low ? 2 : 4, variant * 13.7))
  const mesh = new THREE.Mesh(clumpCache.get(key), foliageMaterial({ color }))
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  mesh.rotation.y = variant * 1.3
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

// Thuja Green Giant: a dense, slightly shaggy column. Unit height and width.
export function thujaGeometry() {
  const profile = [[0, 0], [0.4, 0.02], [0.5, 0.15], [0.47, 0.4], [0.37, 0.65], [0.22, 0.86], [0.08, 0.97], [0, 1]]
  // resample the outline densely so the noise can shape the height too
  const dense = []
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, h0] = profile[i]
    const [r1, h1] = profile[i + 1]
    const n = Math.max(1, Math.round((h1 - h0) * (low ? 20 : 60)))
    for (let k = 0; k < n; k++) dense.push(new THREE.Vector2(r0 + ((r1 - r0) * k) / n, h0 + ((h1 - h0) * k) / n))
  }
  dense.push(new THREE.Vector2(0, 1))
  let geo = new THREE.LatheGeometry(dense, low ? 16 : 40)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo, 1e-4)
  // subdivide nothing; displace along the radius with layered noise
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const rr = Math.hypot(p.x, p.z)
    if (rr > 1e-4) {
      const a = Math.atan2(p.z, p.x)
      const n = noise.noise3d(Math.cos(a) * 1.6, p.y * 9, Math.sin(a) * 1.6) * 0.12 + noise.noise3d(Math.cos(a) * 5, p.y * 30, Math.sin(a) * 5) * 0.07
      const k = 1 + n
      pos.setX(i, p.x * k)
      pos.setZ(i, p.z * k)
      const shade = (0.8 + 0.2 * Math.min(1, p.y * 2 + 0.3)) * (0.88 + n * 1.4)
      colors[i * 3] = shade
      colors[i * 3 + 1] = shade
      colors[i * 3 + 2] = shade
    } else {
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.9
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

// ------------------------------------------------------------ woods

// Deciduous woods (mixed oak, maple and tulip poplar in the aerial photo,
// mostly green with yellow, orange and red turning in October). Tall bare
// trunks with a few limbs under a crown of clumps; instanced. Every trunk,
// limb and clump records its tree (`t`), so the Maya export can make one
// object per tree: woods_tree_001... (understory included).
export function buildForest(group, spots, gradeAt) {
  const rnd = seeded(77)
  const variants = [0, 1, 2].map((v) => clumpGeometry(low ? 2 : 3, v * 21.3, 1.15))
  const clumps = variants.map(() => [])
  const trunks = []
  const limbs = []
  const palette = [
    ['#4d6b2e', 30], ['#5b7a35', 26], ['#6d8a3c', 18], ['#7f8f3a', 8], // greens
    ['#b5952f', 7], ['#c48a2a', 5], ['#b8612a', 3], ['#8f4a2c', 1], // turning
  ]
  const total = palette.reduce((s, [, w]) => s + w, 0)
  const pick = () => {
    let t = rnd() * total
    for (const [c, w] of palette) if ((t -= w) <= 0) return c
    return palette[0][0]
  }
  const color = new THREE.Color()
  spots.forEach(([x, y, k], t) => {
    const g = gradeAt(y)
    const height = (34 + rnd() * 26) * k
    const crownBase = height * (0.45 + rnd() * 0.12)
    const crownR = (7 + rnd() * 5) * k
    const lean = new THREE.Vector3((rnd() - 0.5) * 0.12, 1, (rnd() - 0.5) * 0.12).normalize()
    const top = new THREE.Vector3(x, g, y).addScaledVector(lean, height * 0.85)
    trunks.push({ a: new THREE.Vector3(x, g - 0.3, y), b: top, r: (0.55 + rnd() * 0.35) * k, t })
    const base = new THREE.Color(pick())
    const n = low ? 4 + Math.floor(rnd() * 2) : 6 + Math.floor(rnd() * 3)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.8
      const rise = rnd()
      const reach = crownR * (0.35 + 0.55 * Math.sqrt(rnd())) * (1 - rise * 0.45)
      const cx = top.x + Math.cos(a) * reach
      const cz = top.z + Math.sin(a) * reach
      const cy = g + crownBase + (height - crownBase) * (0.25 + rise * 0.6)
      const s = crownR * (low ? 0.6 : 0.5 + rnd() * 0.25) // fewer clumps, each a bit larger
      // most clumps share the tree's color; a few turn early
      color.copy(rnd() < 0.15 ? new THREE.Color(pick()) : base).offsetHSL((rnd() - 0.5) * 0.02, 0, (rnd() - 0.5) * 0.05)
      clumps[Math.floor(rnd() * 3)].push({ p: new THREE.Vector3(cx, cy, cz), s: new THREE.Vector3(s, s * (0.75 + rnd() * 0.2), s), rot: rnd() * 6.28, c: color.clone(), t })
      // a limb from the trunk out to the lower clumps
      if (rise < 0.5) {
        const from = new THREE.Vector3(x, g, y).addScaledVector(lean, cy - g - s * 0.9)
        limbs.push({ a: from, b: new THREE.Vector3(cx, cy - s * 0.3, cz), r: 0.22 * k, t })
      }
    }
    // Understory between the trunks: low shrubs, and now and then a sapling
    // or young tree, so the woods do not read as bare poles from the yard
    for (let i = 0; i < (low ? 1 : 2); i++) {
      const a = rnd() * Math.PI * 2
      const d = 2 + rnd() * 4
      const ux = x + Math.cos(a) * d
      const uz = y + Math.sin(a) * d
      const r = 1.6 + rnd() * 2.2
      color.set(rnd() < 0.8 ? '#41602b' : '#8c7a32').offsetHSL(0, 0, (rnd() - 0.5) * 0.06)
      clumps[i % 3].push({ p: new THREE.Vector3(ux, gradeAt(uz) + r * 0.55, uz), s: new THREE.Vector3(r, r * 0.8, r), rot: rnd() * 6.28, c: color.clone(), t })
    }
    if (rnd() < (low ? 0.25 : 0.55)) {
      const a = rnd() * Math.PI * 2
      const ux = x + Math.cos(a) * 5
      const uz = y + Math.sin(a) * 5
      const gu = gradeAt(uz)
      const h = 10 + rnd() * 8
      limbs.push({ a: new THREE.Vector3(ux, gu - 0.2, uz), b: new THREE.Vector3(ux, gu + h * 0.7, uz), r: 0.18, t })
      const r = 3 + rnd() * 2
      color.set(pick()).offsetHSL(0, 0, -0.03)
      clumps[2].push({ p: new THREE.Vector3(ux, gu + h * 0.75, uz), s: new THREE.Vector3(r, r * 0.9, r), rot: rnd() * 6.28, c: color.clone(), t })
    }
  })

  const treeName = (t) => `woods_tree_${String(t + 1).padStart(3, '0')}`
  const named = (im, list) => {
    im.userData.forest = true
    im.userData.instanceParts = list.map(({ t }) => ({ kind: 'tree', name: treeName(t) }))
  }

  const bark = new THREE.MeshStandardMaterial({ color: '#4f4238', roughness: 1 })
  const cyl = new THREE.CylinderGeometry(0.6, 1, 1, 8)
  cyl.translate(0, 0.5, 0)
  const up = new THREE.Vector3(0, 1, 0)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const sticks = (list, mat) => {
    const im = new THREE.InstancedMesh(cyl, mat, list.length)
    list.forEach(({ a, b, r }, i) => {
      const d = b.clone().sub(a)
      q.setFromUnitVectors(up, d.clone().normalize())
      m.compose(a, q, new THREE.Vector3(r, d.length(), r))
      im.setMatrixAt(i, m)
    })
    // the woods only receive shadows: the sun's shadow covers the lot, so a
    // tree's shadow would end in a straight edge out on the lawn
    im.castShadow = false
    im.receiveShadow = true
    named(im, list)
    group.add(im)
  }
  sticks(trunks, bark)
  sticks(limbs, bark)

  const leafMat = foliageMaterial()
  clumps.forEach((list, v) => {
    const im = new THREE.InstancedMesh(variants[v], leafMat, list.length)
    list.forEach(({ p, s, rot, c }, i) => {
      q.setFromAxisAngle(up, rot)
      m.compose(p, q, s)
      im.setMatrixAt(i, m)
      im.setColorAt(i, c)
    })
    im.castShadow = false
    im.receiveShadow = true
    named(im, list)
    group.add(im)
  })
}

// Leaf litter under the woods: a ground overlay whose opacity fades in over a
// few feet past the edge of the trees. `inside(x, y)` returns the signed
// distance into the woods in feet.
export function forestFloor(group, bounds, inside, gradeAt) {
  const { x0, x1, y0, y1 } = bounds
  const step = 3
  const nx = Math.ceil((x1 - x0) / step)
  const ny = Math.ceil((y1 - y0) / step)
  const pos = []
  const col = []
  const rnd = seeded(5)
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * step
      const y = y0 + j * step
      pos.push(x, gradeAt(y) + 0.06, y)
      const w = THREE.MathUtils.clamp(inside(x, y) / 6, 0, 1)
      const t = rnd()
      // brown and rust leaves over dark soil
      col.push(0.36 + t * 0.12, 0.25 + t * 0.06, 0.14 + t * 0.03, w * 0.92)
    }
  }
  const idx = []
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1 }),
  )
  mesh.receiveShadow = true
  mesh.renderOrder = -1
  group.add(mesh)
}
