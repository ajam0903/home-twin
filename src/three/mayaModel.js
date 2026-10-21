import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { bakeWhenReady } from './bakeBump.js'
import { LAWN_COLOR, ASPHALT_COLOR } from './buildHouse.js'

// The house as edited in Maya: public/model/house.fbx, with per-material
// settings in public/model/materials.json (see tools/maya/home_twin.py), and
// the woods on the neighboring lots in woods.fbx (woods_phone.fbx, a reduced
// copy, on phones). Returns null when there is no Maya model; the app then
// builds the house from the plans as before. Without a woods file the app
// keeps generating the woods.

const BASE = `${import.meta.env.BASE_URL}model/`

export async function loadMayaModel({ phone = false, woods: withWoods = true } = {}) {
  let extras
  try {
    const res = await fetch(`${BASE}materials.json`, { cache: 'no-cache' })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
    extras = (await res.json()).materials ?? {}
  } catch {
    return null
  }
  const loader = new FBXLoader()
  // a missing file comes back as the app's HTML page, which fails to parse
  const optional = (file) => loader.loadAsync(`${BASE}${file}`).catch(() => null)
  const [fbx, woods] = await Promise.all([
    loader.loadAsync(`${BASE}house.fbx`),
    withWoods ? optional(phone ? 'woods_phone.fbx' : 'woods.fbx') : null,
  ])
  return { fbx, woods, extras }
}

// Bump images (the siding and shingle courses), baked into the color maps
const bumpCache = new Map()
function bumpImage(name) {
  if (!bumpCache.has(name)) {
    const img = new Image()
    img.src = `${BASE}textures/${name}.png`
    bumpCache.set(name, img)
  }
  return bumpCache.get(name)
}

// The FBX loader reads colors as sRGB, but Maya stores linear values: undo
// its conversion so colors match what Maya shows.
const toLinearAsIs = (c) => c.convertLinearToSRGB()

// Surfaces drawn in one flat color even when the Maya material has a texture
// (the lawn and asphalt textures showed their tiling)
const FLAT_COLORS = { mat_grass: LAWN_COLOR, mat_asphalt: ASPHALT_COLOR }

// A standard material for the app (shadows, the cutaway plane, roughness
// from materials.json) in place of the FBX loader's Phong/Lambert. A bump map
// in materials.json is painted into the color map (bakeBump.js) rather than
// used as one; `onBaked` runs when that is done.
export function appMaterial(m, extras, clipPlane, { onBaked } = {}) {
  const x = extras[m.name] ?? extras[m.name.replace(/\d+$/, '')] ?? {}
  const flat = FLAT_COLORS[m.name] ?? FLAT_COLORS[m.name.replace(/\d+$/, '')]
  const map = flat ? null : (m.map ?? null)
  if (map) map.anisotropy = 8
  // a texture carries its own color; otherwise the shader color from Maya
  const color = flat ? new THREE.Color(flat) : map ? new THREE.Color(1, 1, 1) : toLinearAsIs(m.color.clone())
  const mat = new THREE.MeshStandardMaterial({
    name: m.name,
    color,
    map,
    vertexColors: m.vertexColors || !!x.vertexColors,
    roughness: x.roughness ?? 0.85,
    metalness: x.metalness ?? 0,
    transparent: x.transparent ?? m.transparent,
    opacity: x.opacity ?? m.opacity,
    alphaTest: x.alphaTest ?? 0,
    emissive: toLinearAsIs((m.emissive ?? new THREE.Color(0, 0, 0)).clone()),
    side: THREE.DoubleSide,
    clippingPlanes: clipPlane ? [clipPlane] : [],
    clipShadows: !!clipPlane,
  })
  if (x.bump && map) bakeWhenReady(mat, () => bumpImage(x.bump), x.bumpScale ?? 1, onBaked)
  return mat
}

// Vertex colors: same correction as the materials
export function fixVertexColors(geometry) {
  const c = geometry.attributes.color
  if (!c || geometry.userData.colorsFixed) return
  const col = new THREE.Color()
  for (let i = 0; i < c.count; i++) {
    col.setRGB(c.getX(i), c.getY(i), c.getZ(i)).convertLinearToSRGB()
    c.setXYZ(i, col.r, col.g, col.b)
  }
  c.needsUpdate = true
  geometry.userData.colorsFixed = true
}
