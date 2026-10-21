import * as THREE from 'three'
import {
  H, LEVELS, levelById, ROOMS, WALLS, FIXTURES, DECK, SITE, PLANT_TYPES, BAY, STAIR, openingPoint, roomFloor, gradeAt, deckY,
  pointInPoly,
} from '../model/house.js'
import { shingleTextures, sidingTextures, concreteTexture, applyWorldUV } from './textures.js'
import { buildForest, forestFloor, clump, limb, thujaGeometry, foliageMaterial, seeded, setVegetationDetail } from './vegetation.js'

// Every mesh added to `group` since child index `mark` belongs to one named
// part (a wall, a window, a cabinet, a plant...). The Maya export uses these
// names and groups. Inner parts win (a window inside its wall).
function tagSince(group, mark, part) {
  for (let i = mark; i < group.children.length; i++) group.children[i].userData.part ??= part
}
function tagged(group, part, build) {
  const mark = group.children.length
  const out = build()
  tagSince(group, mark, part)
  return out
}
// Turn a flat surface's triangles to face up. The app draws both sides, but
// Maya (and the FBX) use the winding: floors and ground must face the sky.
function faceUp(geo) {
  const pos = geo.attributes.position
  if (!geo.index) geo.setIndex(Array.from({ length: pos.count }, (_, i) => i))
  const idx = geo.index.array
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i + 2 < idx.length; i += 3) {
    a.fromBufferAttribute(pos, idx[i])
    b.fromBufferAttribute(pos, idx[i + 1])
    c.fromBufferAttribute(pos, idx[i + 2])
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)
    if (ny < 0) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
  }
  geo.index.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// Maya-safe names: letters, digits and underscores
const safeName = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
// Snapshot of every group's child count, then name what a build step added
const snap = (groups) => groups.map((g) => [g, g.children.length])
const nameSince = (snapshot, name, kind = 'part') => {
  for (const [g, n] of snapshot) tagSince(g, n, { kind, name })
}
const counters = new Map()
const nextName = (prefix) => {
  const n = (counters.get(prefix) ?? 0) + 1
  counters.set(prefix, n)
  return `${prefix}_${String(n).padStart(2, '0')}`
}

// Exterior textures are drawn once and shared by every viewer
let exteriorTextures = null
function exterior() {
  if (!exteriorTextures) {
    exteriorTextures = {
      shingles: shingleTextures(8),
      siding: sidingTextures(8),
      concrete: concreteTexture(8),
    }
    // file names in the Maya export
    for (const [name, t] of Object.entries(exteriorTextures)) {
      if (t.isTexture) t.name = name
      else {
        t.map.name = name
        t.bumpMap.name = `${name}_bump`
      }
    }
  }
  return exteriorTextures
}

// Plan (x, y) maps to three.js (X, Z); height is Y. 1 unit = 1 foot.

const HOUSE_W = 36.17

const COLORS = {
  siding: '#ece8df',
  interior: '#f6f4ef',
  trim: '#ffffff',
  foundation: '#a8a49c',
  roofEdge: '#4d4744', // ridge caps, same weathered shingles
  glass: '#9fc3dd',
  frontDoor: '#2f4a68',
  door: '#f2efe8',
  garageDoor: '#f7f6f2',
  porchDeck: '#a98762',
  step: '#b9b2a6',
  stair: '#b98f62',
  rail: '#fbfaf7',
  select: '#ff8a1f',
}

const FLOOR_COLORS = {
  living: '#cfa97c',
  bedroom: '#d8bf9c',
  kitchen: '#d6c3a3',
  hall: '#cfa97c',
  bath: '#dfe3e6',
  utility: '#d9d6cf',
  closet: '#d6cfc3',
  garage: '#bdbab3',
  basement: '#aeaaa2',
  porch: '#5d4231',
  deck: '#8d6e57',
}

// lowDetail: coarser trees and shrubs (phones)
export function buildHouse({ lowDetail = false } = {}) {
  setVegetationDetail(lowDetail ? 'low' : 'high')
  counters.clear()
  const root = new THREE.Group()
  const levelGroups = {}
  const clipPlanes = {}
  const levelMats = {}

  for (const lvl of LEVELS) {
    const g = new THREE.Group()
    g.name = lvl.id
    levelGroups[lvl.id] = g
    root.add(g)
    // Keeps y <= constant. Parked far above until a cutaway is requested.
    clipPlanes[lvl.id] = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5)
    levelMats[lvl.id] = new Map()
  }

  // One material cache per level so each level can be cut independently.
  const mat = (level, color, opts = {}) => {
    const key = color + JSON.stringify(opts)
    const cache = levelMats[level]
    if (!cache.has(key)) {
      cache.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: opts.roughness ?? 0.85,
          metalness: 0,
          transparent: !!opts.opacity,
          opacity: opts.opacity ?? 1,
          side: THREE.DoubleSide,
          clippingPlanes: [clipPlanes[level]],
          clipShadows: true,
        }),
      )
    }
    return cache.get(key)
  }

  const roofGroup = new THREE.Group()
  roofGroup.name = 'roof'
  root.add(roofGroup)
  const siteGroup = new THREE.Group()
  siteGroup.name = 'site'
  root.add(siteGroup)
  // Buried drain lines, shown with the Systems toggle
  const utilitiesGroup = new THREE.Group()
  utilitiesGroup.name = 'utilities'
  root.add(utilitiesGroup)

  const plain = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.9, side: THREE.DoubleSide })
  const tex = exterior()
  // Charcoal architectural shingles (the texture carries the color)
  const roofMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', ...tex.shingles, bumpScale: 2.2, roughness: 0.93, side: THREE.DoubleSide,
  })
  const roofEdgeMat = plain(COLORS.roofEdge)
  const trimMat = plain(COLORS.trim)
  // Vinyl lap siding: one material for the gables, one per level for the
  // walls so a level can still be cut away
  const sidingOpts = { color: COLORS.siding, ...tex.siding, bumpScale: 1.4, roughness: 0.6, side: THREE.DoubleSide }
  const sidingMat = new THREE.MeshStandardMaterial(sidingOpts)
  const sidingMats = {}
  const siding = (level) =>
    (sidingMats[level] ??= new THREE.MeshStandardMaterial({ ...sidingOpts, clippingPlanes: [clipPlanes[level]], clipShadows: true }))

  const allGroups = () => [...Object.values(levelGroups), roofGroup, siteGroup, utilitiesGroup]
  let mark = snap(allGroups())

  // ------------------------------------------------------------ walls
  const ends = wallEnds(WALLS)
  for (const wall of WALLS) {
    const g = levelGroups[wall.level]
    const kind = wall.kind === 'rail' ? 'railing' : wall.kind === 'knee' ? 'halfwall' : wall.kind === 'foundation' ? 'foundation' : wall.ext ? 'extwall' : 'wall'
    const name = nextName(`${wall.level}_${kind}`)
    tagged(g, { kind: 'wall', name }, () => addWall(g, wall, mat, ends.get(wall), siding, name))
  }
  addCornerBoards(levelGroups, mat)

  // ------------------------------------------------------------ floors
  const roomMeshes = []
  const floorMats = new Map()
  const highlightMat = new THREE.MeshBasicMaterial({
    color: COLORS.select, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
  })
  for (const room of ROOMS) {
    const shape = new THREE.Shape(room.poly.map(([x, y]) => new THREE.Vector2(x, y)))
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(Math.PI / 2) // (x, y, 0) -> (x, 0, y)
    faceUp(geo)
    const y = roomFloor(room)
    const floorMat =
      room.type === 'deck'
        ? new THREE.MeshStandardMaterial({ map: deckingTexture(), roughness: 0.8, side: THREE.DoubleSide, clippingPlanes: [clipPlanes[room.level]] })
        : FLOOR_TEXTURES[room.flooring]
          ? floorFinish(room.level, room.flooring, clipPlanes, floorMats)
          : mat(room.level, FLOOR_COLORS[room.type] ?? '#ccc', { roughness: 0.7 })
    const floor = new THREE.Mesh(geo, floorMat)
    floor.position.y = y
    floor.receiveShadow = true
    floor.castShadow = room.type === 'deck' // shade the ground under the deck
    floor.userData = { kind: 'room', id: room.id, part: { kind: 'room', name: `room_${safeName(room.id)}` } }
    levelGroups[room.level].add(floor)

    const hl = new THREE.Mesh(geo, highlightMat)
    hl.position.y = y + 0.04
    hl.visible = false
    hl.userData.appOnly = true
    hl.renderOrder = 2
    levelGroups[room.level].add(hl)
    roomMeshes.push({ id: room.id, level: room.level, floor, highlight: hl })
  }

  // Thin slabs under each upper floor so the levels read as solid from the side.
  // Second floor: open over the stair and the two-story foyer
  const upperHole = [
    [STAIR.x0, STAIR.landY0], [STAIR.topX, STAIR.landY0], [STAIR.topX, STAIR.landY1],
    [22.67, STAIR.landY1], [22.67, 31.85], [STAIR.x0, 31.85], // inside the slab edge, or the triangulation fails
  ]
  addBox(levelGroups.L2, 0, 0, HOUSE_W, 32, H.ceil1, H.ff2 - 0.02, mat('L2', '#d9d4ca'), { holes: [upperHole] })
  // First floor: open over the basement stair
  const lowerHole = [
    [STAIR.x0, 15.6], [STAIR.topX, 15.6], [STAIR.topX, STAIR.landY1],
    [STAIR.x1, STAIR.landY1], [STAIR.x1, 25.4], [STAIR.x0, 25.4],
  ]
  addBox(levelGroups.L1, 0, 0, HOUSE_W, 32, H.ff1 - 0.9, H.ff1 - 0.02, mat('L1', '#d9d4ca'), { holes: [lowerHole] })
  addBox(levelGroups.L1, 36.17, 3, 57, 14, H.garageFloor, H.ff1 - 0.02, mat('L1', '#d9d4ca')) // raised floor under the study wing
  addBox(levelGroups.L1, 36.17, 14, 57, 36, H.garageFloor - 0.3, H.garageFloor - 0.01, mat('L1', '#b0aca4'))
  nameSince(mark, 'floor_structure')

  // ------------------------------------------------------------ fixtures
  for (const f of FIXTURES) {
    const base = levelById[f.level].floor
    const g = levelGroups[f.level]
    const mark = g.children.length
    const m = mat(f.level, f.color, f.glass ? { opacity: 0.35, roughness: 0.1 } : { roughness: 0.6 })
    if (f.shape === 'cyl') {
      const geo = new THREE.CylinderGeometry(f.r, f.r, f.z1 - f.z0, 24)
      const mesh = new THREE.Mesh(geo, m)
      mesh.position.set(f.x, base + (f.z0 + f.z1) / 2, f.y)
      mesh.castShadow = true
      g.add(mesh)
    } else {
      const mesh = addBox(g, f.x0, f.y0, f.x1, f.y1, base + f.z0, base + f.z1, m)
      mesh.castShadow = !f.glass
      if (f.top) addBox(g, f.x0 - 0.05, f.y0 - 0.05, f.x1 + 0.05, f.y1 + 0.05, base + f.z1, base + f.z1 + 0.12, mat(f.level, f.top, { roughness: 0.4 }))
    }
    tagSince(g, mark, { kind: 'fixture', name: nextName(`${f.level}_${safeName(f.name ?? 'cabinet')}`) })
  }

  // ------------------------------------------------------------ stairs
  mark = snap(allGroups())
  buildMainStairs(levelGroups, mat)
  // Steps from the back hall door down into the garage
  addStair(levelGroups.L1, { x0: 36.6, x1: 39.6, yLow: 16.6, yHigh: 14.17, zLow: H.garageFloor, zHigh: H.ff1, risers: 3 }, mat('L1', COLORS.step))
  nameSince(mark, 'stairs')

  // ------------------------------------------------------------ porch & stoops
  const L1 = levelGroups.L1
  mark = snap(allGroups())
  buildPorch(L1, roofGroup, mat, plain)
  nameSince(mark, 'front_porch')
  mark = snap(allGroups())
  // Bay underside skirt
  addBox(L1, 18.3, -1.62, 24.3, 0, H.ff1 - 0.7, H.ff1 - 0.02, siding('L1')).userData.uv = 'wall'
  nameSince(mark, 'bay_skirt')

  // ------------------------------------------------------------ deck (2020)
  mark = snap(allGroups())
  buildDeck(L1, mat)
  nameSince(mark, 'deck')
  mark = snap(allGroups())

  // ------------------------------------------------------------ roofs
  // Main roof: side gable, ridge along x, 9/12.
  gableRoof(roofGroup, { x0: 0, x1: 36.17, z0: 0, z1: 32, axis: 'x', base: H.ceil2, pitch: 0.75, eave: 1, rake: 0.8 }, roofMat, roofEdgeMat, trimMat)
  gableEnd(roofGroup, { plane: 'x', at: 0, from: 0, to: 32, base: H.ceil2, pitch: 0.75 }, sidingMat)
  gableEnd(roofGroup, { plane: 'x', at: 36.17, from: 0, to: 32, base: H.ceil2, pitch: 0.75 }, sidingMat)
  nameSince(mark, 'main_roof')
  mark = snap(allGroups())
  // Decorative front gable over the center window
  gableRoof(roofGroup, { x0: 13.6, x1: 22.6, z0: 24.5, z1: 32, axis: 'z', base: H.ceil2, pitch: 1, eave: 0.6, rake: 0.6, noBackRake: true }, roofMat, roofEdgeMat, trimMat)
  gableEnd(roofGroup, { plane: 'z', at: 32, from: 13.6, to: 22.6, base: H.ceil2, pitch: 1 }, plain('#f3f1ec')) // white scallop shingles
  const fan = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24, 0, Math.PI), trimMat)
  fan.position.set(18.1, H.ceil2 + 0.6, 32.3)
  roofGroup.add(fan)
  nameSince(mark, 'front_gable')
  mark = snap(allGroups())

  // Porch shed roof
  shedRoof(roofGroup, { x0: -0.4, x1: 36.1, zWall: 32, zEave: 36.6, yWall: 13.5, yEave: 10.35 }, roofMat)
  addBox(roofGroup, -0.4, 36.55, 36.1, 36.65, 9.8, 10.5, trimMat, { shadow: true }) // fascia
  addBox(roofGroup, -0.4, 36.65, 36.1, 37.0, 9.85, 10.25, trimMat, { shadow: true }) // gutter
  addBox(roofGroup, -0.1, 35.5, 35.95, 36.0, 9.9, 10.5, trimMat)
  nameSince(mark, 'porch_roof')
  mark = snap(allGroups())

  // Bay roof: hipped, with white fascia and soffit (as in the photo)
  bayRoof(roofGroup, roofMat, roofEdgeMat, trimMat)
  nameSince(mark, 'bay_roof')
  mark = snap(allGroups())

  // Garage: side gable (ridge along x) plus a full-width front gable, 11/12.
  gableRoof(roofGroup, { x0: 36.17, x1: 57, z0: 3, z1: 36, axis: 'x', base: H.garagePlate, pitch: 0.75, eave: 1, rake: 0.8, noStartRake: true }, roofMat, roofEdgeMat, trimMat)
  gableEnd(roofGroup, { plane: 'x', at: 57, from: 3, to: 36, base: H.garagePlate, pitch: 0.75 }, sidingMat)
  // No side eaves: the right wall's siding runs straight up into the side gable (photo).
  gableRoof(roofGroup, { x0: 36.17, x1: 57, z0: 19.5, z1: 36, axis: 'z', base: H.garagePlate, pitch: 11 / 12, eave: 0, rake: 0.8, noBackRake: true }, roofMat, roofEdgeMat, trimMat)
  gableEnd(roofGroup, { plane: 'z', at: 36, from: 36.17, to: 57, base: H.garagePlate, pitch: 11 / 12 }, sidingMat)
  const vent = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 32), trimMat)
  vent.position.set(46.58, 16.2, 36.32)
  roofGroup.add(vent)
  const ventBack = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), plain('#3b3d40'))
  ventBack.position.set(46.58, 16.2, 36.3)
  roofGroup.add(ventBack)
  for (let i = -2; i <= 2; i++) {
    const dy = i * 0.27
    const half = Math.sqrt(0.75 ** 2 - dy ** 2)
    addBox(roofGroup, 46.58 - half, 36.3, 46.58 + half, 36.4, 16.2 + dy - 0.06, 16.2 + dy + 0.06, trimMat)
  }


  nameSince(mark, 'garage_roof')
  mark = snap(allGroups())
  // Chimney on the left wall, 2'-0" above the ridge. The property survey marks
  // "CHIM." on the garage's right wall instead; the owner confirmed (2026-10-17)
  // it is on the left wall by the family room fireplace, as the 2001 plans show.
  // It is a framed chase in the same beige siding (aerial photo): white
  // corner boards, a white chase cover and a stainless flue pipe with a cap.
  addBox(roofGroup, -2.2, 5.5, 0, 10.5, -0.3, 34.5, sidingMat, { shadow: true })
  const chaseTop = 34.5
  for (const y of [5.5, 10.5]) {
    const dy = y < 8 ? -1 : 1
    addBox(roofGroup, -2.28, y, -1.85, y + dy * 0.08, -0.3, chaseTop, trimMat) // outer corners
    addBox(roofGroup, -2.28, y - dy * 0.35, -2.2, y + dy * 0.08, -0.3, chaseTop, trimMat)
    addBox(roofGroup, -0.35, y, 0.05, y + dy * 0.08, 27, chaseTop, trimMat) // above the roof
  }
  addBox(roofGroup, -2.35, 5.35, 0.15, 10.65, chaseTop, chaseTop + 0.25, trimMat, { shadow: true }) // chase cover
  const steel = new THREE.MeshStandardMaterial({ color: '#b8bcc0', metalness: 0.6, roughness: 0.35 })
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.4, 20), steel)
  flue.position.set(-1.1, chaseTop + 0.95, 8)
  const flueCap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.55, 0.35, 20), steel)
  flueCap.position.set(-1.1, chaseTop + 1.95, 8)
  const flueRing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.45, 20), steel)
  flueRing.position.set(-1.1, chaseTop + 1.6, 8)
  for (const part of [flue, flueRing, flueCap]) {
    part.castShadow = true
    roofGroup.add(part)
  }
  nameSince(mark, 'chimney')

  // ------------------------------------------------------------ site
  const woodsGroup = new THREE.Group()
  woodsGroup.name = 'woods'
  root.add(woodsGroup)
  buildSite(siteGroup, woodsGroup, plain)
  mark = snap(allGroups())
  // Buried drain lines, shown with the Systems toggle; downspouts on the house
  buildDrainage(utilitiesGroup, roofGroup, plain)
  nameSince(mark, 'drainage')
  mark = snap(allGroups())
  // Excavation walls visible in the basement cutaway
  const earth = plain('#7a6a58')
  addBox(siteGroup, -0.55, -0.55, 36.72, -0.5, H.basementFloor, -0.12, earth)
  // around the basement under the study wing
  addBox(siteGroup, 36.17, 2.45, 51.05, 2.5, H.basementFloor, -0.12, earth)
  addBox(siteGroup, 51, 2.45, 51.05, 14.5, H.basementFloor, -0.12, earth)
  nameSince(mark, 'excavation')

  // World-space UVs (feet) for the textured exterior, so shingle courses and
  // siding laps line up across separate pieces
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if (!o.isMesh) return
    if (o.material === roofMat) applyWorldUV(o, 'roof')
    else if (o.material === sidingMat || o.userData.uv) applyWorldUV(o, 'wall')
  })

  return { root, levelGroups, roofGroup, siteGroup, woodsGroup, utilitiesGroup, roomMeshes, clipPlanes }
}

// ------------------------------------------------------------ property

const FAR = 450
export const LAWN_COLOR = '#7ba163'
export const ASPHALT_COLOR = '#535457'

function buildSite(group, woods, plain) {
  const { lot, setbacks: sb, curbY, roadWidth } = SITE
  const tex = exterior()
  // lawn and asphalt are flat colors: a repeating texture shows its tiling
  const groundMat = new THREE.MeshStandardMaterial({ color: LAWN_COLOR, roughness: 1, side: THREE.DoubleSide })
  const asphalt = new THREE.MeshStandardMaterial({ color: ASPHALT_COLOR, roughness: 0.95 })
  const concrete = new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.9 })
  // boxes get world-space UVs (feet) once the scene is assembled
  const paved = (mesh) => {
    mesh.userData.uv = 'wall'
    return mesh
  }
  const flat = (pts, y, material) => {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))))
    geo.rotateX(Math.PI / 2)
    faceUp(geo)
    const mesh = new THREE.Mesh(geo, material)
    mesh.position.y = y
    mesh.receiveShadow = true
    group.add(mesh)
  }

  let mark = snap([group])
  // Front and side lawns up to the curb, notched for the basement cutaway
  // (and for the basement under the study wing)
  flat([[-FAR, 0], [0, 0], [0, 32], [HOUSE_W, 32], [HOUSE_W, 14.5], [51, 14.5], [51, 2.5], [HOUSE_W, 2.5], [HOUSE_W, 0], [FAR, 0], [FAR, curbY], [-FAR, curbY]], -0.02, groundMat)
  // Orchard Street, curbs, and the far side
  const farSide = curbY + roadWidth
  paved(addBox(group, -FAR, curbY, FAR, farSide, -0.62, -0.45, asphalt, { receive: true }))
  for (const y of [curbY, farSide - 0.5]) addBox(group, -FAR, y, FAR, y + 0.5, -0.62, 0.02, plain('#cbc8c1'), { receive: true })
  flat([[-FAR, farSide], [FAR, farSide], [FAR, FAR], [-FAR, FAR]], -0.02, groundMat)

  // Backyard, falling away from the house (see gradeAt)
  const rows = [0, -20, -112, -FAR]
  const pos = []
  for (const z of rows) for (const x of [-FAR, FAR]) pos.push(x, gradeAt(z) - 0.02, z)
  const idx = []
  for (let r = 0; r < rows.length - 1; r++) {
    const a = r * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const back = new THREE.BufferGeometry()
  back.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  back.setAttribute('uv', new THREE.Float32BufferAttribute(pos.flatMap((v, i) => (i % 3 === 1 ? [] : [v])), 2))
  back.setIndex(idx)
  faceUp(back)
  const backMesh = new THREE.Mesh(back, groundMat)
  backMesh.receiveShadow = true
  group.add(backMesh)

  // Driveways (over the depressed curb) and the concrete at the porch steps
  paved(addBox(group, SITE.drive.x0, 36, SITE.drive.x1, curbY + 0.5, -0.03, 0.04, asphalt, { receive: true }))
  const nd = SITE.neighborDrive
  paved(addBox(group, nd.x0, nd.y0, nd.x1, curbY + 0.5, -0.03, 0.035, asphalt, { receive: true }))
  const w = SITE.walk
  paved(addBox(group, w.x0, w.y0, w.x1, w.y1, -0.03, 0.06, concrete, { receive: true }))

  nameSince(mark, 'lawn_and_paving')
  mark = snap([group])
  // Lines on the ground: lot lines, required setbacks, 100-year flood limit
  const { x0, x1, y0, y1 } = lot
  groundRibbon(group, [[[x0, y1], [x1, y1], [x1, y0], [x0, y0], [x0, y1]]], { width: 0.35, color: '#f2b53c' })
  const s = { x0: x0 + sb.left, x1: x1 - sb.right, y0: y0 + sb.rear, y1: y1 - sb.front }
  groundRibbon(group, [[[s.x0, s.y1], [s.x1, s.y1], [s.x1, s.y0], [s.x0, s.y0], [s.x0, s.y1]]], { width: 0.2, color: '#f4f1ea', dash: [4, 2] })
  groundRibbon(group, [SITE.flood], { width: 0.3, color: '#3b8fe0', dash: [4, 2] })

  // Corner markers (iron pipes / bar)
  const pipe = plain('#6a6d72')
  const flag = new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff7a1a', emissiveIntensity: 0.35 })
  for (const c of SITE.corners) {
    const [x, y] = c.at
    const g = gradeAt(y)
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 8), pipe)
    stake.position.set(x, g + 0.5, y)
    group.add(stake)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), flag)
    cap.position.set(x, g + 1.05, y)
    group.add(cap)
  }

  nameSince(mark, 'survey_lines_and_markers')
  mark = snap([group])
  buildFences(group, plain) // fences name themselves; the gate joins the pole below

  // Utility pole and the overhead service drop to the garage
  const [px, py] = SITE.pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 32, 12), plain('#6b5641'))
  pole.position.set(px, 15.5, py)
  pole.castShadow = true
  group.add(pole)
  addBox(group, px - 3.5, py - 0.2, px + 3.5, py + 0.2, 27.6, 28.1, plain('#6b5641'))
  // Service drop to the garage's right wall, then down the wall to the meter
  const sv = SITE.service
  const wireMat = plain('#1d1f22')
  const face = sv.x + 0.06
  for (const off of [-0.25, 0.25]) {
    const a = new THREE.Vector3(px + off, 26.5, py)
    const b = new THREE.Vector3(face + 0.1, sv.attachZ + off * 0.4, sv.y + off)
    const mid = a.clone().lerp(b, 0.5)
    mid.y -= 2
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.04, 5), wireMat))
  }
  const meterTop = sv.meterZ + 0.65
  addBox(group, face, sv.y - 0.05, face + 0.09, sv.y + 0.05, meterTop, sv.attachZ + 0.2, wireMat)
  const meterMat = plain('#a3a8ad', { roughness: 0.5 })
  addBox(group, face, sv.y - 0.4, face + 0.35, sv.y + 0.4, sv.meterZ - 0.65, meterTop, meterMat, { shadow: true })
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.3, 20),
    new THREE.MeshStandardMaterial({ color: '#cfe0ea', transparent: true, opacity: 0.7, roughness: 0.1 }),
  )
  dome.rotation.z = Math.PI / 2
  dome.position.set(face + 0.5, sv.meterZ + 0.1, sv.y)
  group.add(dome)
  addBox(group, face, sv.y + 0.15, face + 0.25, sv.y + 0.55, sv.meterZ - 1.55, sv.meterZ - 1.0, meterMat)
  addBox(group, face, sv.y - 0.05, face + 0.07, sv.y + 0.05, 0.3, sv.meterZ - 0.65, wireMat)

  nameSince(mark, 'gate_pole_and_service')
  buildPlantings(group, plain)
  buildFrontBeds(group, plain)
  // Big trees go with the woods: hidden in the floor cutaways so they don't cover rooms
  buildMaples(woods, plain)
  buildWoods(woods)
}

// Mulched beds along the porch with a row of low, rounded shrubs
function buildFrontBeds(group, plain) {
  const mulch = plain('#4a3426', { roughness: 1 })
  for (const b of SITE.beds) {
    const mark = group.children.length
    addBox(group, b.x0, b.y0, b.x1, b.y1, -0.02, 0.07, mulch, { receive: true })
    const n = Math.max(1, Math.round((b.x1 - b.x0) / 3.2))
    for (let i = 0; i < n; i++) {
      const x = b.x0 + ((b.x1 - b.x0) * (i + 0.5)) / n
      const r = 0.85 + ((i * 7) % 3) * 0.12
      group.add(clump(x, r * 0.62, (b.y0 + b.y1) / 2 + 0.2, r, r * 0.8, r, '#4a7a3a', i % 3))
    }
    tagSince(group, mark, { kind: 'site', name: nextName('planting_bed') })
  }
}

// Japanese maples: a few trunks leaning out from one base under a broad,
// layered canopy, green with autumn orange at the edges (photo)
function buildMaples(group, plain) {
  const bark = plain('#4b3d33')
  for (const p of SITE.plants.filter((pl) => pl.kind === 'maple')) {
    const [x, y] = p.at
    const g = gradeAt(y)
    const rnd = seeded(Math.round(x * 31 + y * 17) + 5)
    const t = PLANT_TYPES.maple
    const mark = group.children.length
    const base = new THREE.Vector3(x, g, y)
    // a low fork: four leaning trunks, each splitting into two limbs
    for (const [dx, dy] of [[1.8, 0.6], [-1.6, 1.0], [0.4, -1.8], [-0.6, -0.4]]) {
      const fork = new THREE.Vector3(x + dx * 1.3, g + t.height * 0.28, y + dy * 1.3)
      group.add(limb(base, fork, 0.34, 0.24, bark))
      for (const s of [-1, 1]) {
        const tip = new THREE.Vector3(x + dx * 2.6 + s * dy * 0.9, g + t.height * (0.5 + rnd() * 0.08), y + dy * 2.6 - s * dx * 0.9)
        group.add(limb(fork, tip, 0.22, 0.1, bark, 6))
      }
    }
    // Layered canopy: flattened clumps in a broad dome, wider low and
    // narrower high; green inside, orange on the outer edges
    for (let i = 0; i < 26; i++) {
      const h = 0.42 + rnd() * 0.52 // height fraction
      const edge = Math.sqrt(rnd())
      const reach = (t.spread / 2) * (1.02 - (h - 0.42) * 1.15) * edge
      const a = rnd() * Math.PI * 2
      const r = 2.2 + rnd() * 1.8
      const color = edge > 0.72 && rnd() < 0.7 ? (rnd() < 0.6 ? '#b8743a' : '#a35a33') : rnd() < 0.5 ? '#5f7f3c' : '#71883f'
      group.add(clump(x + Math.cos(a) * reach, g + h * t.height, y + Math.sin(a) * reach, r, r * 0.55, r, color, i % 3))
    }
    tagSince(group, mark, { kind: 'plant', name: nextName('japanese_maple') })
  }
}

function buildPlantings(group, plain) {
  const bark = plain('#5b4636')
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const color = new THREE.Color()

  // Thuja Green Giant: narrow column, full near the bottom, soft point on top
  const thujas = SITE.plants.filter((p) => p.kind === 'thuja')
  const t = PLANT_TYPES.thuja
  const thujaMesh = new THREE.InstancedMesh(thujaGeometry(), foliageMaterial({ roughness: 0.95 }), thujas.length)
  thujas.forEach((p, i) => {
    const [x, y] = p.at
    const k = 0.93 + ((i * 37) % 11) / 75 // slight size variation
    m.compose(new THREE.Vector3(x, gradeAt(y) - 0.1, y), q, new THREE.Vector3(t.spread * k, t.height * k, t.spread * k))
    thujaMesh.setMatrixAt(i, m)
    color.setHSL(0.31, 0.45, 0.24 + ((i * 13) % 7) / 100)
    thujaMesh.setColorAt(i, color)
  })
  thujaMesh.castShadow = thujaMesh.receiveShadow = true
  // one Maya mesh per tree
  thujaMesh.userData.instanceParts = thujas.map(() => ({ kind: 'plant', name: nextName('thuja') }))
  group.add(thujaMesh)

  for (const p of SITE.plants) {
    const [x, y] = p.at
    const g = gradeAt(y)
    const mark = group.children.length
    if (p.kind === 'serviceberry') {
      // Multi-stem small tree with a loose, rounded crown
      const s = PLANT_TYPES.serviceberry
      const base = new THREE.Vector3(x, g, y)
      for (const [dx, dy] of [[0, 0], [0.7, 0.4], [-0.6, 0.5], [0.2, -0.7]]) {
        group.add(limb(base, new THREE.Vector3(x + dx, g + s.height * 0.6, y + dy), 0.08, 0.04, bark, 6))
      }
      for (const [dx, dz, dy, r, c] of [
        [0, 0.66, 0, 1.6, '#6f8f3e'], [0.9, 0.56, 0.4, 1.2, '#7a9443'], [-0.8, 0.6, -0.3, 1.25, '#6a8a3b'],
        [0.2, 0.84, -0.5, 1.1, '#9a7a35'], [-0.3, 0.8, 0.6, 1.0, '#6f8f3e'],
      ]) {
        group.add(clump(x + dx, g + s.height * dz + 0.8, y + dy, r * s.spread / 4.2, r * 0.9, r * s.spread / 4.2, c, Math.round(r * 10) % 3))
      }
    } else if (p.kind === 'cherry') {
      // Weeping form: straight trunk under a domed canopy whose edges hang down
      const c = PLANT_TYPES.cherry
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, c.height * 0.85, 8), bark)
      trunk.position.set(x, g + c.height * 0.42, y)
      trunk.castShadow = true
      group.add(trunk)
      // dome on top, then a ring of long clumps hanging from its edge
      group.add(clump(x, g + c.height * 0.82, y, c.spread * 0.36, c.height * 0.2, c.spread * 0.36, '#5d7f3b', 0))
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        const rr = c.spread * 0.36
        group.add(clump(x + Math.cos(a) * rr, g + c.height * 0.55, y + Math.sin(a) * rr, 0.9, c.height * 0.3, 0.9, i % 2 ? '#5d7f3b' : '#678a40', i % 3))
      }
    }
    if (p.kind === 'serviceberry' || p.kind === 'cherry') tagSince(group, mark, { kind: 'plant', name: nextName(p.kind) })
  }
}

// Downspouts at the corners, and the buried pipes marked on the ground the way
// a utility locate would: red for the solid downspout lines, a stone trench with
// a blue dashed line for the French drain.
function buildDrainage(group, roofGroup, plain) {
  const d = SITE.drainage
  const white = plain('#f4f4f0', { roughness: 0.5 })
  for (const [x, y, top] of d.downspouts) {
    addBox(roofGroup, x - 0.13, y - 0.13, x + 0.13, y + 0.13, gradeAt(y) + 0.3, top, white, { shadow: true })
  }
  groundRibbon(group, d.solid, { width: 0.32, color: '#d0473a', lift: 0.15 })
  groundRibbon(group, [d.french], { width: 1.3, color: '#a39e94', lift: 0.13 })
  groundRibbon(group, [d.french], { width: 0.28, color: '#2f6fde', dash: [2, 1], lift: 0.16 })
}

// Flat strip lying on the (sloped) ground, optionally dashed [on, off] in feet.
function groundRibbon(group, paths, { width, color, dash = null, lift = 0.12 }) {
  const pos = []
  const idx = []
  const step = 2
  for (const pts of paths) {
    let run = 0
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[i + 1]
      const len = Math.hypot(bx - ax, by - ay)
      const ux = (bx - ax) / len
      const uy = (by - ay) / len
      const nx = (-uy * width) / 2
      const ny = (ux * width) / 2
      for (let d = 0; d < len - 1e-6; d += step) {
        const e = Math.min(len, d + step)
        const on = !dash || (run + d) % (dash[0] + dash[1]) < dash[0]
        if (on) {
          const p = [ax + ux * d, ay + uy * d]
          const q = [ax + ux * e, ay + uy * e]
          const base = pos.length / 3
          for (const [x, y] of [[p[0] + nx, p[1] + ny], [p[0] - nx, p[1] - ny], [q[0] - nx, q[1] - ny], [q[0] + nx, q[1] + ny]]) {
            pos.push(x, gradeAt(y) + lift, y)
          }
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
        }
      }
      run += len
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  faceUp(geo)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, side: THREE.DoubleSide, roughness: 0.8 }),
  )
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

// Vertical panel that follows the ground, `height` tall, UVs in feet.
function verticalRibbon(group, pts, height, material) {
  const pos = []
  const uv = []
  const idx = []
  let run = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[i + 1]
    const len = Math.hypot(bx - ax, by - ay)
    for (let d = 0; d < len - 1e-6; d += 2) {
      const e = Math.min(len, d + 2)
      const p = [ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]
      const q = [ax + ((bx - ax) * e) / len, ay + ((by - ay) * e) / len]
      const gp = gradeAt(p[1])
      const gq = gradeAt(q[1])
      const base = pos.length / 3
      pos.push(p[0], gp, p[1], q[0], gq, q[1], q[0], gq + height, q[1], p[0], gp + height, p[1])
      uv.push(run + d, 0, run + e, 0, run + e, height, run + d, height)
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    run += len
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

// Points every `spacing` feet (or closer) along a polyline, corners included.
function postsAlong(pts, spacing) {
  const out = [pts[0]]
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / spacing))
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n])
  }
  return out
}

// 6' white vinyl privacy fence, 4' chain link, and the vinyl gate by the garage.
function buildFences(group, plain) {
  const white = plain('#f6f6f2', { roughness: 0.55 })
  const steel = new THREE.MeshStandardMaterial({ color: '#a9aeb3', metalness: 0.6, roughness: 0.45 })
  const vinyl = vinylMaterial()
  const mesh = chainLinkMaterial()

  for (const f of SITE.fences) {
    const mark = group.children.length
    if (f.kind === 'vinyl') {
      verticalRibbon(group, f.pts, f.height, vinyl)
      const vposts = postsAlong(f.pts, 8)
      // top and bottom rails between the posts, standing proud of the boards
      vposts.forEach(([x, y], i) => {
        if (!i) return
        const [px, py] = vposts[i - 1]
        for (const [z, h] of [[f.height - 0.22, 0.4], [0.3, 0.3]]) {
          beam(group, new THREE.Vector3(px, gradeAt(py) + z, py), new THREE.Vector3(x, gradeAt(y) + z, y), 0.26, h, white)
        }
      })
      for (const [x, y] of vposts) {
        const g = gradeAt(y)
        addBox(group, x - 0.21, y - 0.21, x + 0.21, y + 0.21, g - 0.2, g + f.height + 0.15, white, { shadow: true })
        addBox(group, x - 0.27, y - 0.27, x + 0.27, y + 0.27, g + f.height + 0.15, g + f.height + 0.3, white)
      }
    } else {
      verticalRibbon(group, f.pts, f.height, mesh)
      const posts = postsAlong(f.pts, 10)
      posts.forEach(([x, y], i) => {
        const g = gradeAt(y)
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, f.height + 0.4, 10), steel)
        post.position.set(x, g + (f.height + 0.2) / 2 - 0.1, y)
        post.castShadow = true
        group.add(post)
        if (i > 0) {
          const [px, py] = posts[i - 1]
          const a = new THREE.Vector3(px, gradeAt(py) + f.height, py)
          const b = new THREE.Vector3(x, g + f.height, y)
          beam(group, a, b, 0.11, 0.11, steel)
        }
      })
    }
    tagSince(group, mark, { kind: 'site', name: nextName(`fence_${f.kind}`) })
  }

  // By the garage: a fixed panel from the wall to the hinge post, then a
  // single gate hinged on its left (garage) side, latching at the line post.
  const { a, b, hingeX, height } = SITE.gate
  const y = a[1]
  const g = gradeAt(y)
  const black = plain('#2b2d31', { roughness: 0.5 })
  for (const x of [a[0] + 0.25, hingeX, b[0] - 0.25]) {
    addBox(group, x - 0.25, y - 0.25, x + 0.25, y + 0.25, g - 0.2, g + height + 0.2, white, { shadow: true })
    addBox(group, x - 0.31, y - 0.31, x + 0.31, y + 0.31, g + height + 0.2, g + height + 0.35, white)
  }
  // fixed panel, down to grade like the rest of the fence
  addBox(group, a[0] + 0.5, y - 0.06, hingeX - 0.25, y + 0.06, g, g + height, vinyl, { shadow: true })
  // gate leaf, framed, held off the ground
  const l0 = hingeX + 0.3
  const l1 = b[0] - 0.55
  addBox(group, l0, y - 0.07, l1, y + 0.07, g + 0.25, g + height - 0.1, vinyl, { shadow: true })
  addBox(group, l0, y - 0.1, l1, y + 0.1, g + height - 0.35, g + height - 0.1, white)
  addBox(group, l0, y - 0.1, l1, y + 0.1, g + 0.25, g + 0.5, white)
  // black strap hinges on the left, latch on the right
  for (const z of [g + 1.0, g + height - 1.0]) addBox(group, hingeX + 0.2, y + 0.08, hingeX + 1.2, y + 0.13, z - 0.06, z + 0.06, black)
  addBox(group, l1 - 0.35, y + 0.08, l1 + 0.05, y + 0.15, g + 3.7, g + 3.95, black)
}

// White vinyl privacy panels: tongue-and-groove boards under a top rail.
// The texture covers 2' x 6'.
function vinylMaterial() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 384
  const g = c.getContext('2d')
  g.fillStyle = '#f5f5f1'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(0, 0, 0, 0.07)'
  for (let x = 0; x < c.width; x += 18) g.fillRect(x, 26, 2, c.height - 34)
  g.fillStyle = 'rgba(0, 0, 0, 0.1)'
  g.fillRect(0, 22, c.width, 3)
  g.fillRect(0, c.height - 10, c.width, 3)
  const tex = new THREE.CanvasTexture(c)
  tex.name = 'vinyl_fence'
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / 2, 1 / 6)
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.55 })
}

// Galvanized chain-link mesh; the texture covers 1' x 1'.
function chainLinkMaterial() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.strokeStyle = '#b4b9be'
  g.lineWidth = 3
  for (let i = -128; i <= 256; i += 32) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + 128, 128)
    g.stroke()
    g.beginPath()
    g.moveTo(i + 128, 0)
    g.lineTo(i, 128)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.name = 'chain_link'
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 })
}

// Trees behind the surveyed edge of woods, kept clear of the house and deck.
function buildWoods(group) {
  const { lot } = SITE
  const edge = SITE.woods
  const edgeY = (x) => {
    if (x <= edge[0][0]) return edge[0][1]
    for (let i = 0; i < edge.length - 1; i++) {
      const [ax, ay] = edge[i]
      const [bx, by] = edge[i + 1]
      if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax)
    }
    return edge[edge.length - 1][1]
  }
  const rnd = seeded(90)
  const spots = []
  for (let gx = -45; gx <= 100; gx += 10) {
    for (let gy = -135; gy <= 0; gy += 10) {
      const x = gx + (rnd() - 0.5) * 8
      const y = gy + (rnd() - 0.5) * 8
      const k = 0.7 + rnd() * 0.5
      // keep crowns behind the surveyed edge
      if (y > edgeY(x) - 5 * k) continue
      // The backyard itself is open: woods only on the neighboring lots
      if (x > lot.x0 - 4 && x < lot.x1 + 4 && y > lot.y0 - 4) continue
      spots.push([x, y, k])
    }
  }
  buildForest(group, spots, gradeAt)
  // Distance into the woods: behind the edge and outside the open backyard
  const inside = (x, y) => Math.min(edgeY(x) - y - 2, Math.max(lot.x0 - 4 - x, x - lot.x1 - 4, lot.y0 - 4 - y))
  forestFloor(group, { x0: -60, x1: 112, y0: -150, y1: 4 }, inside, gradeAt)
}

// ------------------------------------------------------------ deck

// Matched to a photo of the deck (Oct 2026)
const DECK_COLORS = {
  board: '#4f3728', // decking and stair treads, dark brown
  border: '#45301f', // picture-frame boards
  frame: '#8a5a3a', // fascia and skirt frame boards, reddish brown
  framing: '#a8916b', // pressure-treated lumber underneath
  rail: '#f7f6f2',
  cap: '#6a4835', // brown cap on the white rails
  baluster: '#1f2226',
  lattice: '#7a6a5d',
  concrete: '#b5b1a8',
  light: '#ffe2a3',
}

function buildDeck(group, mat) {
  const m = (c, o) => mat('L1', c, o)
  const top = DECK.top
  const { x0, x1, landing, stair } = DECK
  const joistTop = top - 0.083
  const joistBot = top - DECK.joistBottom
  const beamBot = joistBot - 0.77

  // Framing: ledger, 2x8 joists at 16" o.c., (3) 2x10 beams, 6x6 posts
  addBox(group, x0, deckY(0) + 0.12, landing.x1, deckY(0), joistBot, joistTop, m(DECK_COLORS.framing))
  for (let x = x0 + 0.06; x < x1; x += 4 / 3) {
    const inBay = x > 16.4 && x < 26.2
    addBox(group, x, deckY(inBay ? 1.95 : 0), x + 0.125, deckY(DECK.depth), joistBot, joistTop, m(DECK_COLORS.framing))
  }
  for (let x = landing.x0 + 0.06; x < landing.x1; x += 4 / 3) {
    addBox(group, x, deckY(0), x + 0.125, deckY(landing.depth), joistBot, joistTop, m(DECK_COLORS.framing))
  }
  for (const d of DECK.beams) addBox(group, x0, deckY(d - 0.19), x1, deckY(d + 0.19), beamBot, joistBot, m(DECK_COLORS.framing))
  for (const [x, d, n] of DECK.posts) {
    const y = deckY(d)
    const capAt = n === 1 ? joistBot : beamBot
    addBox(group, x - 0.23, y + 0.23, x + 0.23, y - 0.23, gradeAt(y) - 0.3, capAt, m(DECK_COLORS.framing), { shadow: true })
  }

  // Fascia (edge band) and the picture-frame border boards
  const edges = [
    [[x0, deckY(0)], [x0, deckY(DECK.depth)]],
    [[x0, deckY(DECK.depth)], [x1, deckY(DECK.depth)]],
    [[x1, deckY(DECK.depth)], [x1, deckY(landing.depth)]],
    [[landing.x1, deckY(0)], [landing.x1, deckY(landing.depth)]],
    // top of the stair: closes the open riser under the landing's edge
    [[x1, deckY(landing.depth)], [landing.x1, deckY(landing.depth)]],
  ]
  for (const [[ax, ay], [bx, by]] of edges) {
    const vertical = ax === bx
    const nx = vertical ? 0.05 : 0
    const ny = vertical ? 0 : 0.05
    addBox(group, Math.min(ax, bx) - nx, Math.min(ay, by) - ny, Math.max(ax, bx) + nx, Math.max(ay, by) + ny, top - 0.78, top, m(DECK_COLORS.frame))
    // 5.5" border board laid on top along the edge, inside the deck
    const ix = vertical ? (ax === x0 ? 0.46 : -0.46) : 0
    const iy = vertical ? 0 : 0.46
    addBox(group, Math.min(ax, ax + ix, bx), Math.min(ay, ay + iy, by), Math.max(ax, ax + ix, bx), Math.max(ay, ay + iy, by), top - 0.01, top + 0.012, m(DECK_COLORS.border, { roughness: 0.75 }))
  }

  // Shaded, bare ground under the deck and landing only (seen through the lattice)
  for (const [ax, bx, depth] of [[x0, x1, DECK.depth], [x1, landing.x1, landing.depth]]) {
    const pts = [[ax, deckY(0)], [bx, deckY(0)], [bx, deckY(depth)], [ax, deckY(depth)]]
    const pos = pts.flatMap(([x, y]) => [x, gradeAt(y) + 0.03, y])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    faceUp(geo)
    group.add(new THREE.Mesh(geo, m('#3a332c', { roughness: 1 })))
  }

  // Lattice skirt set in brown frame panels: a bottom rail on the grade and
  // frame boards between panels. Faces run from `a` to `b`; `cuts` are frame
  // boards measured along the face; `out` is the outward side.
  const lattice = latticeMaterial(mat)
  const frameMat = m(DECK_COLORS.frame, { roughness: 0.7 })
  const skirtTop = top - 0.78
  const door = DECK.skirtDoor
  const faces = [
    { a: [x0, deckY(0)], b: [x0, deckY(DECK.depth)], out: [-1, 0], cuts: [4.5, 9, 13.5] },
    { a: [x0, deckY(DECK.depth)], b: [x1, deckY(DECK.depth)], out: [0, -1], cuts: [4, 8, 12, 16] },
    // stair side: the lattice door, then the panel down to the bottom of the stair, then behind the stair
    {
      a: [x1, deckY(DECK.depth)], b: [x1, deckY(landing.depth)], out: [1, 0],
      cuts: [DECK.depth - door.d1, DECK.depth - door.d0, DECK.depth - stair.from - stair.run],
    },
    { a: [landing.x1, deckY(0)], b: [landing.x1, deckY(landing.depth)], out: [1, 0], cuts: [] },
  ]
  // A board `width` wide along the face, 0.1' thick on the outward side
  const frameBoard = (x, y, out, along, z0, z1, width = 0.45) => {
    const hw = width / 2
    if (Math.abs(along[0]) < 0.5) {
      const [xa, xb] = [x + out[0] * 0.02, x + out[0] * 0.12]
      addBox(group, Math.min(xa, xb), y - hw, Math.max(xa, xb), y + hw, z0, z1, frameMat)
    } else {
      const [ya, yb] = [y + out[1] * 0.02, y + out[1] * 0.12]
      addBox(group, x - hw, Math.min(ya, yb), x + hw, Math.max(ya, yb), z0, z1, frameMat)
    }
  }
  for (const f of faces) {
    const [ax, ay] = f.a
    const [bx, by] = f.b
    const len = Math.hypot(bx - ax, by - ay)
    const along = [(bx - ax) / len, (by - ay) / len]
    const at = (s) => [ax + along[0] * s, ay + along[1] * s]
    skirt(group, ax, ay, bx, by, skirtTop, lattice)
    // bottom rail on the grade, just outside the lattice
    const off = (p) => [p[0] + f.out[0] * 0.07, p[1] + f.out[1] * 0.07]
    verticalRibbon(group, [off(f.a), off(f.b)], 0.45, frameMat)
    for (const s of [0, ...f.cuts, len]) {
      const [x, y] = at(s)
      frameBoard(x, y, f.out, along, gradeAt(y) - 0.05, skirtTop)
    }
  }
  // Lattice door: stiles and rails inside its opening, hinges on the corner side
  {
    const s0 = DECK.depth - door.d1
    const s1 = DECK.depth - door.d0
    const x = x1 + 0.12
    const black = m('#1d1f22', { roughness: 0.5 })
    const g = gradeAt(deckY(door.d1))
    for (const s of [s0 + 0.4, s1 - 0.4]) frameBoard(x, deckY(DECK.depth - s), [1, 0], [0, 1], g + 0.45, skirtTop - 0.05, 0.3)
    for (const z of [g + 0.45, skirtTop - 0.3]) addBox(group, x, deckY(door.d1 - 0.25), x + 0.1, deckY(door.d0 + 0.25), z, z + 0.3, frameMat)
    for (const z of [g + 0.9, skirtTop - 0.55]) addBox(group, x + 0.1, deckY(door.d1 - 0.2), x + 0.14, deckY(door.d1 - 0.75), z - 0.06, z + 0.06, black)
    addBox(group, x + 0.1, deckY(door.d0 + 0.35), x + 0.16, deckY(door.d0 + 0.6), g + 1.8, g + 2.05, black)
  }

  // Stair: 7 treads down to a concrete pad, away from the house
  const sy0 = deckY(stair.from)
  const sy1 = deckY(stair.from + stair.run)
  // The bottom step lands on the lawn (no concrete pad, owner)
  const padTop = gradeAt(sy1)
  const rise = (top - padTop) / (stair.treads + 1)
  addStair(group, { x0: stair.x0 + 0.06, x1: stair.x1 - 0.1, yLow: sy1, yHigh: sy0, zLow: padTop, zHigh: top - rise, risers: stair.treads }, m(DECK_COLORS.board, { roughness: 0.8 }))
  const run = (sy0 - sy1) / stair.treads
  const lightMat = new THREE.MeshStandardMaterial({ color: DECK_COLORS.light, emissive: DECK_COLORS.light, emissiveIntensity: 0.9 })
  for (let i = 0; i < stair.treads; i++) {
    const yFace = sy1 + run * i
    const zMid = padTop + rise * (i + 0.5)
    const cx = (stair.x0 + stair.x1) / 2
    addBox(group, cx - 0.15, yFace - 0.03, cx + 0.15, yFace, zMid - 0.04, zMid + 0.04, lightMat)
  }
  // Height of the stair nosing line at distance d from the house
  const stairBase = (d) => {
    const t = Math.min(1, Math.max(0, (d - stair.from) / stair.run))
    return top - rise + (padTop + rise - (top - rise)) * t
  }

  // Outer side of the stair: a brown stringer board along the slope with a
  // triangle of lattice under it and a bottom rail on the grade
  {
    const x = stair.x1 + 0.06
    const zTop = stairBase(stair.from) - 0.15
    const zBot = stairBase(stair.from + stair.run) - 0.15
    beam(group, new THREE.Vector3(x + 0.02, zTop - 0.45, sy0), new THREE.Vector3(x + 0.02, zBot - 0.45, sy1), 0.12, 0.9, frameMat)
    const gTop = gradeAt(sy0) - 0.05
    const gBot = gradeAt(sy1) - 0.05
    const hTop = zTop - 0.9
    const hBot = Math.max(gBot, zBot - 0.9)
    const len = sy0 - sy1
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([x, gTop, sy0, x, hTop, sy0, x, hBot, sy1, x, gBot, sy1], 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, gTop, 0, hTop, len, hBot, len, gBot], 2))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    geo.computeVertexNormals()
    const tri = new THREE.Mesh(geo, lattice)
    tri.castShadow = tri.receiveShadow = true
    group.add(tri)
    verticalRibbon(group, [[x + 0.07, sy0], [x + 0.07, sy1]], 0.45, frameMat)
  }

  // Vinyl railing with black aluminum balusters
  const railMat = m(DECK_COLORS.rail, { roughness: 0.5 })
  const balMat = m(DECK_COLORS.baluster, { roughness: 0.4 })
  const capMat = m(DECK_COLORS.cap, { roughness: 0.6 })
  const balusters = []
  for (const rail of DECK.rails) {
    const pts = rail.posts.map(([x, d, light]) => ({
      x,
      y: deckY(d),
      base: rail.level === 'stair' && d > stair.from ? stairBase(d) : top,
      light: light === 'light',
    }))
    for (const p of pts) {
      addBox(group, p.x - 0.2, p.y + 0.2, p.x + 0.2, p.y - 0.2, p.base - 0.75, p.base + 3.1, railMat, { shadow: true })
      addBox(group, p.x - 0.25, p.y + 0.25, p.x + 0.25, p.y - 0.25, p.base + 3.1, p.base + 3.22, p.light ? lightMat : railMat)
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      // stop short of the posts at each end
      const k0 = 0.2 / len
      const k1 = 1 - k0
      const at = (k, h) => new THREE.Vector3(a.x + (b.x - a.x) * k, a.base + (b.base - a.base) * k + h, a.y + (b.y - a.y) * k)
      beam(group, at(k0, 2.9), at(k1, 2.9), 0.3, 0.2, railMat)
      beam(group, at(k0, 3.02), at(k1, 3.02), 0.34, 0.05, capMat)
      beam(group, at(k0, 0.32), at(k1, 0.32), 0.2, 0.14, railMat)
      const n = Math.floor((len - 0.4) / 0.375)
      for (let j = 1; j < n; j++) balusters.push(at(k0 + ((k1 - k0) * j) / n, 1.6))
    }
  }
  const balMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 2.42, 0.055), balMat, balusters.length)
  balusters.forEach((p, i) => balMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)))
  balMesh.castShadow = true
  group.add(balMesh)
}

// Box from p to q (3D) with a w x h cross-section, kept upright.
function beam(group, p, q, w, h, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, p.distanceTo(q)), material)
  mesh.position.copy(p).add(q).multiplyScalar(0.5)
  mesh.lookAt(q)
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

// Vertical panel along a deck edge, from the sloped grade up to topY.
function skirt(group, ax, ay, bx, by, topY, material) {
  const ga = gradeAt(ay) - 0.05
  const gb = gradeAt(by) - 0.05
  const len = Math.hypot(bx - ax, by - ay)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute([ax, ga, ay, bx, gb, by, bx, topY, by, ax, topY, ay], 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, ga, len, gb, len, topY, 0, topY], 2))
  geo.setIndex([0, 1, 2, 0, 2, 3])
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = mesh.receiveShadow = true // the space under the deck reads dark through the lattice
  group.add(mesh)
}

// ------------------------------------------------------------ floor finishes
// Canvas textures; floor UVs are plan feet, so `feet` is the area one tile covers.

function canvasTexture(w, h, feet, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / feet[0], 1 / feet[1])
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

let seedState = 7
const rand = () => {
  seedState = (seedState * 16807) % 2147483647
  return seedState / 2147483647
}

const FLOOR_TEXTURES = {
  // Natural oak strips, 2 1/4" wide, staggered butt joints (4' x 1.875' tile)
  hardwood: () =>
    canvasTexture(512, 240, [4, 1.875], (g, w, h) => {
      const strip = 24
      for (let row = 0; row < h / strip; row++) {
        let x = -Math.floor(rand() * 200)
        while (x < w) {
          const len = 120 + rand() * 260
          const tone = 140 + rand() * 40
          g.fillStyle = `rgb(${tone + 50}, ${tone + 8}, ${tone - 50})`
          g.fillRect(x, row * strip, len, strip)
          g.fillStyle = 'rgba(90, 55, 25, 0.1)'
          for (let k = 0; k < 3; k++) g.fillRect(x, row * strip + 3 + rand() * (strip - 6), len, 1)
          g.fillStyle = 'rgba(60, 35, 15, 0.45)'
          g.fillRect(x, row * strip, 2, strip)
          x += len
        }
        g.fillStyle = 'rgba(60, 35, 15, 0.35)'
        g.fillRect(0, row * strip + strip - 1, w, 1)
      }
    }),
  // Light neutral carpet with a fine speckle (2' tile)
  carpet: () =>
    canvasTexture(128, 128, [2, 2], (g, w, h) => {
      g.fillStyle = '#b9ad9d'
      g.fillRect(0, 0, w, h)
      for (let k = 0; k < 2200; k++) {
        const v = rand() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(60,45,30,0.10)'
        g.fillStyle = v
        g.fillRect(rand() * w, rand() * h, 1.5, 1.5)
      }
    }),
  // 12" white ceramic tile with gray grout (1' tile)
  tile: () =>
    canvasTexture(128, 128, [1, 1], (g, w, h) => {
      g.fillStyle = '#b8b3aa'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#eeece7'
      g.fillRect(2, 2, w - 4, h - 4)
    }),
}

// Textures are shared; materials belong to one build because they hold its clip planes.
const floorTextures = new Map()
function floorFinish(level, flooring, clipPlanes, cache) {
  const key = level + flooring
  if (!cache.has(key)) {
    if (!floorTextures.has(flooring)) {
      const tex = FLOOR_TEXTURES[flooring]()
      tex.name = `floor_${flooring}` // the texture's file name in the Maya export
      floorTextures.set(flooring, tex)
    }
    cache.set(
      key,
      new THREE.MeshStandardMaterial({
        map: floorTextures.get(flooring),
        roughness: flooring === 'carpet' ? 1 : flooring === 'tile' ? 0.45 : 0.6,
        side: THREE.DoubleSide,
        clippingPlanes: [clipPlanes[level]],
      }),
    )
  }
  return cache.get(key)
}

let deckingTex = null
// 5/4 x 6 boards (5.5" plus a 1/4" gap) running parallel to the house.
function deckingTexture() {
  if (deckingTex) return deckingTex
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')
  const pitch = 128
  const board = Math.round(pitch * (5.5 / 5.75))
  const tones = ['#563c2c', '#4e3627']
  for (let i = 0; i < 2; i++) {
    const y0 = i * pitch
    g.fillStyle = tones[i]
    g.fillRect(0, y0, c.width, board)
    for (let k = 0; k < 40; k++) {
      g.fillStyle = k % 2 ? 'rgba(30,18,10,0.1)' : 'rgba(150,110,80,0.08)'
      g.fillRect(0, y0 + Math.random() * board, c.width, 1 + Math.random() * 2)
    }
    g.fillStyle = '#24180f'
    g.fillRect(0, y0 + board, c.width, pitch - board)
  }
  // one butt joint per board, staggered
  g.fillRect(300, 0, 3, board)
  g.fillRect(820, pitch, 3, board)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / 8, 12 / 11.5) // canvas = 8 ft of two boards
  tex.name = 'decking'
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  deckingTex = tex
  return tex
}

function latticeMaterial(mat, color = DECK_COLORS.lattice) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.strokeStyle = color
  g.lineWidth = 14
  for (let i = -128; i <= 256; i += 64) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + 128, 128)
    g.stroke()
    g.beginPath()
    g.moveTo(i + 128, 0)
    g.lineTo(i, 128)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.name = 'lattice'
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / 1.2, 1 / 1.2)
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.8,
    clippingPlanes: mat('L1', '#ffffff').clippingPlanes,
  })
}

// ------------------------------------------------------------ primitives

function addBox(group, x0, y0, x1, y1, z0, z1, material, opts = {}) {
  if (opts.holes) {
    // Slab with rectangular holes: build as a shape extrusion.
    const shape = new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)])
    // A hole is a rectangle [x0, y0, x1, y1] or a polygon [[x, y], ...]
    for (const hole of opts.holes) {
      const pts = Array.isArray(hole[0]) ? hole : [[hole[0], hole[1]], [hole[0], hole[3]], [hole[2], hole[3]], [hole[2], hole[1]]]
      shape.holes.push(new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y))))
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false })
    geo.rotateX(Math.PI / 2) // extrusion +z -> -y
    const mesh = new THREE.Mesh(geo, material)
    mesh.position.y = z1
    group.add(mesh)
    return mesh
  }
  const geo = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0))
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2)
  mesh.castShadow = !!opts.shadow
  mesh.receiveShadow = opts.receive ?? true
  group.add(mesh)
  return mesh
}

// How far each wall runs past its end points, [start, end] (negative: it
// stops short). Exterior walls run half their thickness past both ends, as
// they always have. Elsewhere no two walls overlap, so a cutaway never shows
// doubled faces: at an L corner the thicker (else the earlier) wall runs to the
// outer face and the other stops at its face; at a T the stem stops at the
// face of the wall it meets; walls in line just meet.
function wallEnds(walls) {
  const info = walls
    .filter((w) => w.kind !== 'rail')
    .map((w, i) => {
      const [ax, ay] = w.a
      const [bx, by] = w.b
      const L = Math.hypot(bx - ax, by - ay)
      return { w, i, ax, ay, ux: (bx - ax) / L, uy: (by - ay) / L, L }
    })
  const ends = new Map()
  for (const A of info) {
    if (A.w.ext) {
      ends.set(A.w, [A.w.t / 2, A.w.t / 2])
      continue
    }
    const adj = [0, 0]
    ;[A.w.a, A.w.b].forEach(([px, py], k) => {
      let trim = 0
      let extend = false
      let inLine = false
      for (const B of info) {
        if (B === A || B.w.level !== A.w.level) continue
        const along = (px - B.ax) * B.ux + (py - B.ay) * B.uy
        const off = Math.abs((py - B.ay) * B.ux - (px - B.ax) * B.uy)
        if (off > 0.05 || along < -0.05 || along > B.L + 0.05) continue
        if (Math.abs(A.ux * B.uy - A.uy * B.ux) < 0.1) {
          inLine = true
          continue
        }
        const atEnd = along < 0.05 || along > B.L - 0.05
        const aFirst = A.w.t > B.w.t || (A.w.t === B.w.t && A.i < B.i)
        if (atEnd && aFirst && !B.w.ext) extend = true
        else trim = Math.max(trim, B.w.t / 2)
      }
      adj[k] = trim ? -trim : extend && !inLine ? A.w.t / 2 : 0
    })
    ends.set(A.w, adj)
  }
  return ends
}

// White 5/4 corner boards on the outside corners, from the sill to the eave
const CORNERS = [
  // [x, y, outward x, outward y, level, bottom, top]
  [0, 0, -1, -1, 'L1', H.ff1 - 0.55, H.ff2], [36.17, 0, 1, -1, 'L1', H.ff1 - 0.55, H.ff2],
  [0, 32, -1, 1, 'L1', H.ff1 - 0.55, H.ff2],
  [0, 0, -1, -1, 'L2', H.ff2, H.ceil2], [36.17, 0, 1, -1, 'L2', H.ff2, H.ceil2],
  [0, 32, -1, 1, 'L2', H.ff2, H.ceil2], [36.17, 32, 1, 1, 'L2', H.ff2, H.ceil2],
  [57, 3, 1, -1, 'L1', H.garageFloor - 0.3, H.garagePlate], [57, 36, 1, 1, 'L1', H.garageFloor - 0.3, H.garagePlate],
  [36.17, 36, -1, 1, 'L1', H.garageFloor - 0.3, H.garagePlate],
]
function addCornerBoards(levelGroups, mat) {
  const w = 0.42 // board width on each face
  const t = 0.08
  for (const [x, y, sx, sy, level, z0, z1] of CORNERS) {
    const m = mat(level, '#fbfaf7', { roughness: 0.5 })
    const ox = x + sx * 0.25 // outside face of the 6" exterior wall
    const oy = y + sy * 0.25
    // one board on each face, meeting at the corner
    addBox(levelGroups[level], ox, oy, ox + sx * t, oy - sy * w, z0, z1, m, { shadow: true })
    addBox(levelGroups[level], ox + sx * t, oy + sy * t, ox - sx * w, oy, z0, z1, m, { shadow: true })
  }
}

function addWall(group, wall, mat, [e0, e1] = [0, 0], siding, name = 'wall') {
  const lvl = levelById[wall.level]
  const base = wall.base ?? lvl.floor
  const h = wall.h ?? (wall.kind === 'foundation' ? 8.4 : lvl.height)
  const [ax, ay] = wall.a
  const [bx, by] = wall.b
  const L = Math.hypot(bx - ax, by - ay)
  const ux = (bx - ax) / L
  const uy = (by - ay) / L
  const ang = Math.atan2(uy, ux)
  const t = wall.t
  const isFoundation = wall.kind === 'foundation'
  let wallMat = mat(wall.level, isFoundation ? '#a8a49c' : '#f6f4ef')
  if (wall.ext && !isFoundation) {
    // Box faces: +x, -x (ends), +y, -y (top, bottom), +z, -z (the two sides).
    // Local +z points to (-uy, ux) in plan; siding goes on whichever side is
    // outside the house, interior paint on the other.
    const mx = (ax + bx) / 2 - uy * 0.8
    const my = (ay + by) / 2 + ux * 0.8
    const plusZInside = ROOMS.some(
      (r) => r.level === wall.level && r.type !== 'porch' && r.type !== 'deck' && pointInPoly([mx, my], r.poly),
    )
    const paint = wallMat
    const end = mat(wall.level, '#fbfaf7')
    const side = siding(wall.level)
    wallMat = [end, end, paint, paint, plusZInside ? paint : side, plusZInside ? side : paint]
  }

  const piece = (s0, s1, z0, z1, material, thick = t, offset = 0) => {
    if (s1 - s0 < 0.01 || z1 - z0 < 0.01) return null
    const geo = new THREE.BoxGeometry(s1 - s0, z1 - z0, thick)
    const m = new THREE.Mesh(geo, material)
    if (Array.isArray(material)) m.userData.uv = 'wall'
    const sm = (s0 + s1) / 2
    m.position.set(ax + ux * sm - uy * offset, base + (z0 + z1) / 2, ay + uy * sm + ux * offset)
    m.rotation.y = -ang
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
    return m
  }

  if (wall.kind === 'rail') {
    // Stained handrail over white balusters at 4" max opening, on a shoe
    const balMat = mat(wall.level, RAIL_COLORS.baluster)
    piece(0, L, h - 0.15, h, mat(wall.level, RAIL_COLORS.handrail, { roughness: 0.5 }), 0.22)
    piece(0, L, 0, 0.12, balMat, 0.22)
    const n = Math.max(1, Math.round(L / BALUSTER_STEP))
    for (let i = 1; i < n; i++) {
      const sm = (L * i) / n
      piece(sm - 0.04, sm + 0.04, 0.12, h - 0.15, balMat, 0.08)
    }
    return
  }
  if (wall.kind === 'knee') {
    piece(-e0, L + e1, 0, h, wallMat)
    piece(-e0, L + e1, h, h + 0.1, mat(wall.level, '#fbfaf7'), t + 0.12)
    return
  }

  const ops = (wall.openings ?? [])
    .map((op) => {
      const { d } = openingPoint(wall, op)
      return { ...op, s0: d - op.w / 2, s1: d + op.w / 2 }
    })
    .sort((a, b) => a.s0 - b.s0)

  let s = -e0
  for (const op of ops) {
    piece(s, op.s0, 0, h, wallMat)
    piece(op.s0, op.s1, 0, op.sill, wallMat)
    piece(op.s0, op.s1, op.head, h, wallMat)
    s = op.s1
    const mark = group.children.length

    if (op.type === 'window') {
      piece(op.s0, op.s1, op.sill, op.head, mat(wall.level, '#9fc3dd', { opacity: 0.45, roughness: 0.1 }), 0.06)
      const trim = mat(wall.level, '#ffffff')
      if (op.shutters) {
        // Black louvered shutters on the outside face, one each side of the window
        const sh = mat(wall.level, '#1e2226', { roughness: 0.6 })
        const out = t / 2 + 0.05
        for (const [a, b] of [[op.s0 - 1.5, op.s0 - 0.15], [op.s1 + 0.15, op.s1 + 1.5]]) {
          piece(a, b, op.sill, op.head, sh, 0.08, out)
          for (let z = op.sill + 0.35; z < op.head - 0.2; z += 0.3) piece(a + 0.1, b - 0.1, z - 0.03, z + 0.03, sh, 0.05, out + 0.06)
        }
      }
      piece(op.s0 - 0.12, op.s1 + 0.12, op.sill - 0.12, op.sill, trim, t + 0.14)
      piece(op.s0 - 0.12, op.s1 + 0.12, op.head, op.head + 0.15, trim, t + 0.1)
      // Casements have side-by-side sashes; double-hungs a meeting rail (and a mullion when paired)
      if (op.model === 'C235') {
        piece((op.s0 + op.s1) / 2 - 0.08, (op.s0 + op.s1) / 2 + 0.08, op.sill, op.head, trim, t + 0.02)
      } else {
        piece(op.s0, op.s1, (op.sill + op.head) / 2 - 0.05, (op.sill + op.head) / 2 + 0.05, trim, 0.12)
        if (op.w > 4) piece((op.s0 + op.s1) / 2 - 0.12, (op.s0 + op.s1) / 2 + 0.12, op.sill, op.head, trim, t + 0.02)
      }
    } else if (op.type === 'door') {
      if (op.style === 'garage') {
        // Insulated steel door: four sections of four raised short panels (photo)
        const door = mat(wall.level, '#f4f3ee', { roughness: 0.45 })
        const groove = mat(wall.level, '#cfccc4')
        piece(op.s0, op.s1, op.sill, op.head, door, 0.15)
        const rows = 4
        const cols = 4
        const sh = (op.head - op.sill) / rows
        const sw = (op.s1 - op.s0) / cols
        for (let j = 0; j < rows; j++) {
          const z0 = op.sill + j * sh
          if (j) piece(op.s0 + 0.05, op.s1 - 0.05, z0 - 0.025, z0 + 0.025, groove, 0.2)
          for (let i = 0; i < cols; i++) {
            const a = op.s0 + i * sw
            piece(a + 0.22, a + sw - 0.22, z0 + 0.32, z0 + sh - 0.32, door, 0.23)
          }
        }
        const white = mat(wall.level, '#ffffff')
        piece(op.s0 - 0.35, op.s0, op.sill, op.head + 0.35, white, t + 0.1)
        piece(op.s1, op.s1 + 0.35, op.sill, op.head + 0.35, white, t + 0.1)
        piece(op.s0 - 0.35, op.s1 + 0.35, op.head, op.head + 0.35, white, t + 0.1)
      } else if (op.style === 'front') {
        // Black 6-panel door with a small light, between two sidelights, in white casing (photo)
        const black = mat(wall.level, '#1f2328', { roughness: 0.45 })
        const white = mat(wall.level, '#ffffff')
        const glass = mat(wall.level, '#c9d6de', { opacity: 0.7, roughness: 0.15 })
        const mid = (op.s0 + op.s1) / 2
        piece(mid - 1.5, mid + 1.5, op.sill, op.head, black, 0.18)
        piece(mid - 0.8, mid + 0.8, op.head - 1.5, op.head - 0.5, glass, 0.22)
        for (const [g0, g1] of [[op.s0, mid - 1.5], [mid + 1.5, op.s1]]) {
          piece(g0, g1, op.sill, op.head, black, 0.12)
          piece(g0 + 0.12, g1 - 0.12, op.sill + 0.8, op.head - 0.2, glass, 0.16)
        }
        piece(op.s0 - 0.3, op.s0, op.sill, op.head + 0.3, white, t + 0.12)
        piece(op.s1, op.s1 + 0.3, op.sill, op.head + 0.3, white, t + 0.12)
        piece(op.s0 - 0.3, op.s1 + 0.3, op.head, op.head + 0.4, white, t + 0.12)
      } else if (op.style === 'entry') {
        piece(op.s0, op.s1, op.sill, op.head, mat(wall.level, '#f2efe8', { roughness: 0.5 }), 0.18)
        piece(op.s0 - 0.25, op.s1 + 0.25, op.head, op.head + 0.3, mat(wall.level, '#ffffff'), t + 0.12)
      } else if (op.style === 'patio') {
        // Two-panel sliding door in a white frame
        const trim = mat(wall.level, '#ffffff')
        piece(op.s0, op.s1, op.sill, op.head, mat(wall.level, '#9fc3dd', { opacity: 0.45, roughness: 0.1 }), 0.06)
        piece((op.s0 + op.s1) / 2 - 0.1, (op.s0 + op.s1) / 2 + 0.1, op.sill, op.head, trim, t)
        piece(op.s0 - 0.2, op.s0 + 0.05, op.sill, op.head + 0.05, trim, t + 0.12)
        piece(op.s1 - 0.05, op.s1 + 0.2, op.sill, op.head + 0.05, trim, t + 0.12)
        piece(op.s0 - 0.2, op.s1 + 0.2, op.head - 0.05, op.head + 0.25, trim, t + 0.12)
        piece(op.s0, op.s1, op.sill, op.sill + 0.12, trim, t + 0.06)
      }
    }
    tagSince(group, mark, { kind: 'opening', name: `${name}_${op.style === 'garage' ? 'garage_door' : op.type}${ops.indexOf(op) + 1}` })
  }
  piece(s, L + e1, 0, h, wallMat)
}

// Interior stair railings (colors are a guess: no photo of the stair yet)
const RAIL_COLORS = { handrail: '#5a3b28', baluster: '#fbfaf7', skirt: '#f6f4ef' }
const BALUSTER_STEP = 0.35 // 4" max opening between balusters

// Main stair and the basement stair under it, both L-shaped (see STAIR).
function buildMainStairs(levelGroups, mat) {
  const L1 = levelGroups.L1
  const { x0, x1, landY0, landY1, topX, tread } = STAIR
  const stairMat = mat('L1', COLORS.stair, { roughness: 0.6 })

  // Main stair: 10 treads up toward the rear, the landing, 3 treads toward the kitchen side
  const r = (H.ff2 - H.ff1) / STAIR.risers
  const land = H.ff1 + (STAIR.lower + 1) * r
  addStair(L1, { x0: x0 + 0.05, x1: x1 - 0.05, yLow: STAIR.bottomY, yHigh: landY1, zLow: H.ff1, zHigh: land - r, risers: STAIR.lower }, stairMat)
  addBox(L1, x0 + 0.05, landY0, x1, landY1, land - 0.8, land, stairMat, { shadow: true })
  addStair(L1, { alongX: true, xLow: x1, xHigh: topX, yLow: landY0, yHigh: landY1, zLow: land, zHigh: H.ff2 - r, risers: 3 }, stairMat)

  // Basement stair: 3 treads down from the door at x 19 to a landing, then 9 toward the front
  const br = (H.ff1 - H.basementFloor) / STAIR.bRisers
  const bLand = H.ff1 - 4 * br
  const bMat = mat('L1', '#a88a66', { roughness: 0.7 })
  addStair(levelGroups.B, { x0: x0 + 0.05, x1: x1 - 0.05, yLow: STAIR.bBottomY, yHigh: landY1, zLow: H.basementFloor, zHigh: bLand - br, risers: STAIR.bLower }, mat('B', '#a88a66'))
  addBox(L1, x0 + 0.05, landY0, x1, landY1, bLand - 0.6, bLand, bMat)
  addStair(L1, { alongX: true, xLow: x1, xHigh: topX, yLow: landY0, yHigh: landY1, zLow: bLand, zHigh: bLand + 3 * br, risers: 3 }, bMat)

  // Open sides of the main stair: a skirt wall from the floor up to the
  // stringer, closing off the basement stair, with balusters and a handrail
  // 36" above the nosing. Nosing line of each flight:
  const noseLower = (y) => H.ff1 + r * (1 + (STAIR.bottomY - y) / tread)
  const noseUpper = (x) => land + r * (1 + (x - x1) / tread)
  const skirtMat = mat('L1', RAIL_COLORS.skirt)
  const top = 0.3 // stringer above the nosing
  sideWall(L1, skirtMat, 'y', x1, [[STAIR.bottomY, H.ff1], [landY1, H.ff1], [landY1, noseLower(landY1) + top], [STAIR.bottomY, noseLower(STAIR.bottomY) + top]])
  sideWall(L1, skirtMat, 'x', landY1, [[x1, H.ff1], [topX, H.ff1], [topX, H.ff2], [x1, noseUpper(x1) + top]])

  const railMat = mat('L1', RAIL_COLORS.handrail, { roughness: 0.5 })
  const balMat = mat('L1', RAIL_COLORS.baluster)
  balustrade(L1, railMat, balMat, [x1, STAIR.bottomY, noseLower(STAIR.bottomY) + top], [x1, landY1, noseLower(landY1) + top])
  balustrade(L1, railMat, balMat, [x1, landY1, noseUpper(x1) + top], [topX, landY1, H.ff2])
  // Newel posts: at the bottom step and at the turn
  addBox(L1, x1 - 0.17, STAIR.bottomY - 0.34, x1 + 0.17, STAIR.bottomY, H.ff1, H.ff1 + r + 3.5, balMat, { shadow: true })
  addBox(L1, x1 - 0.17, landY1 - 0.17, x1 + 0.17, landY1 + 0.17, H.ff1, noseUpper(x1) + 3.4, balMat, { shadow: true })
}

// Vertical wall with a sloped top, drawn as a polygon of [along, height]
// points in the plane x = at (axis 'y') or y = at (axis 'x').
function sideWall(group, material, axis, at, pts, t = 0.3) {
  const shape = new THREE.Shape(pts.map(([s, z]) => new THREE.Vector2(s, z)))
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false })
  const mesh = new THREE.Mesh(geo, material)
  if (axis === 'y') {
    mesh.rotation.y = -Math.PI / 2 // shape x -> world z, extrusion -> world -x
    mesh.position.x = at + t / 2
  } else {
    mesh.position.z = at - t / 2
  }
  mesh.castShadow = mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

// Sloped handrail 3' above a line of [x, y, z] points, with balusters below it.
function balustrade(group, railMat, balMat, a, b) {
  const [ax, ay, az] = a
  const [bx, by, bz] = b
  const A = new THREE.Vector3(ax, az + 3, ay)
  const B = new THREE.Vector3(bx, bz + 3, by)
  const len = A.distanceTo(B)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.15, 0.22), railMat)
  rail.position.copy(A).add(B).multiplyScalar(0.5)
  rail.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize())
  rail.castShadow = true
  group.add(rail)
  const run = Math.hypot(bx - ax, by - ay)
  const n = Math.max(1, Math.round(run / BALUSTER_STEP))
  for (let i = 1; i < n; i++) {
    const f = i / n
    const x = ax + (bx - ax) * f
    const y = ay + (by - ay) * f
    const z = az + (bz - az) * f
    addBox(group, x - 0.04, y - 0.04, x + 0.04, y + 0.04, z, z + 2.92, balMat)
  }
}

function addStair(group, s, material) {
  const n = s.risers
  const rise = (s.zHigh - s.zLow) / n
  for (let i = 0; i < n; i++) {
    const zTop = s.zLow + rise * (i + 1)
    if (s.alongX) {
      const run = (s.xHigh - s.xLow) / n
      const xa = s.xLow + run * i
      const xb = s.xHigh
      addBox(group, Math.min(xa, xb), s.yLow, Math.max(xa, xb), s.yHigh, s.zLow, zTop, material, { shadow: true })
    } else {
      const run = (s.yHigh - s.yLow) / n
      const ya = s.yLow + run * i
      const yb = s.yHigh
      addBox(group, s.x0, Math.min(ya, yb), s.x1, Math.max(ya, yb), s.zLow, zTop, material, { shadow: true })
    }
  }
}

// Gable roof built from two thick sloped slabs. axis = ridge direction.
function gableRoof(group, r, material, edgeMat, trimMat) {
  const T = 0.35
  const across0 = r.axis === 'x' ? r.z0 : r.x0
  const across1 = r.axis === 'x' ? r.z1 : r.x1
  const along0 = (r.axis === 'x' ? r.x0 : r.z0) - (r.noStartRake || r.noBackRake ? 0 : r.rake)
  const along1 = (r.axis === 'x' ? r.x1 : r.z1) + r.rake
  const half = (across1 - across0) / 2
  const mid = (across0 + across1) / 2
  const run = half + r.eave
  const rise = run * r.pitch
  const slope = Math.hypot(run, rise)
  const ang = Math.atan(r.pitch)
  const yEave = r.base - r.eave * r.pitch
  const len = along1 - along0
  const alongMid = (along0 + along1) / 2
  const lift = (T / 2) / Math.cos(ang)

  for (const side of [-1, 1]) {
    const acrossMid = mid + side * (run / 2)
    const yMid = yEave + rise / 2 + lift
    let geo
    const m = new THREE.Mesh()
    if (r.axis === 'x') {
      geo = new THREE.BoxGeometry(len, T, slope)
      m.position.set(alongMid, yMid, acrossMid)
      m.rotation.x = side * ang
    } else {
      geo = new THREE.BoxGeometry(slope, T, len)
      m.position.set(acrossMid, yMid, alongMid)
      m.rotation.z = -side * ang
    }
    m.geometry = geo
    m.material = material
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
  }
  // Ridge cap
  const ridgeY = r.base + half * r.pitch + T
  const cap = r.axis === 'x' ? new THREE.BoxGeometry(len, 0.25, 0.6) : new THREE.BoxGeometry(0.6, 0.25, len)
  const capMesh = new THREE.Mesh(cap, edgeMat)
  if (r.axis === 'x') capMesh.position.set(alongMid, ridgeY, mid)
  else capMesh.position.set(mid, ridgeY, alongMid)
  group.add(capMesh)
  if (trimMat) roofTrim(group, r, { along0, along1, mid, run, yEave, lift, ridgeY: r.base + half * r.pitch + lift }, trimMat)
}

// White aluminum trim from the aerial photo: fascia with a K-style gutter
// along each eave, and a rake board up each gable edge.
function roofTrim(group, r, g, trimMat) {
  const { along0, along1, mid, run, yEave, lift, ridgeY } = g
  // (along, across) in plan to world x/z for this roof's ridge direction
  const box = (al0, al1, ac0, ac1, y0, y1) =>
    r.axis === 'x'
      ? addBox(group, al0, ac0, al1, ac1, y0, y1, trimMat, { shadow: true })
      : addBox(group, ac0, al0, ac1, al1, y0, y1, trimMat, { shadow: true })
  const P = (along, y, across) => (r.axis === 'x' ? new THREE.Vector3(along, y, across) : new THREE.Vector3(across, y, along))
  if (r.eave > 0) {
    for (const side of [-1, 1]) {
      const edge = mid + side * run
      // fascia over the rafter tails
      box(along0, along1, edge, edge + side * 0.08, yEave - 0.55, yEave + lift + 0.05)
      // gutter hung on the fascia
      box(along0, along1, edge + side * 0.08, edge + side * 0.45, yEave - 0.5, yEave - 0.08)
    }
  }
  const ends = [along1]
  if (!(r.noStartRake || r.noBackRake)) ends.push(along0)
  for (const end of ends) {
    const out = end === along1 ? 0.06 : -0.06
    for (const side of [-1, 1]) {
      const a = P(end + out, yEave + lift - 0.25, mid + side * run)
      const b = P(end + out, ridgeY - 0.25, mid)
      beam(group, a, b, 0.12, 0.6, trimMat)
    }
  }
}

// Triangular wall under a gable. plane 'x' = wall at x = at spanning z, 'z' = wall at z = at spanning x.
function gableEnd(group, g, material) {
  const span = g.to - g.from
  const rise = (span / 2) * g.pitch
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(span, 0), new THREE.Vector2(span / 2, rise)])
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false })
  const m = new THREE.Mesh(geo, material)
  if (g.plane === 'x') {
    m.rotation.y = -Math.PI / 2
    m.position.set(g.at + 0.25, g.base, g.from)
  } else {
    m.position.set(g.from, g.base, g.at - 0.25)
  }
  m.castShadow = true
  m.receiveShadow = true
  group.add(m)
}

// Front porch, matched to a photo: brown composite floor over a white fascia
// and dark lattice skirt, square white columns, white rails with black
// balusters, white-riser steps with brown treads and handrails, white ceiling.
const PORCH_POSTS = [0.25, 7, 14.4, 21.6, 28.6, 35.6]
function buildPorch(group, roofGroup, mat, plain) {
  const m = (c, o) => mat('L1', c, o)
  const top = H.porchFloor
  const [x0, x1, y0, y1] = [0, 35.83, 32, 36]
  const white = m('#f7f6f2', { roughness: 0.5 })
  const brown = m('#5d4231', { roughness: 0.7 })
  const fasciaBot = top - 0.65

  addBox(group, x0, y0, x1, y1, -0.01, 0.02, m('#3a332c', { roughness: 1 })) // shaded ground underneath
  addBox(group, x0, y0, x1, y1, top - 0.02, top + 0.05, brown)
  addBox(group, x0 - 0.05, y1 - 0.05, x1, y1 + 0.08, fasciaBot, top + 0.03, white)
  addBox(group, x0 - 0.1, y0, x0 + 0.03, y1 + 0.08, fasciaBot, top + 0.03, white)
  const lattice = latticeMaterial(mat, '#2b2724')
  skirt(group, x0 - 0.04, y1 + 0.02, x1, y1 + 0.02, fasciaBot, lattice)
  skirt(group, x0 - 0.04, y0, x0 - 0.04, y1 + 0.02, fasciaBot, lattice)
  addBox(group, x0, y1 + 0.03, x1, y1 + 0.13, -0.05, 0.4, white)
  addBox(group, x0 - 0.14, y0, x0 - 0.04, y1, -0.05, 0.4, white)
  for (const x of PORCH_POSTS) addBox(group, x - 0.22, y1 + 0.03, x + 0.22, y1 + 0.13, 0, fasciaBot, white)

  // Steps: 4 white risers, brown treads with a nosing
  const steps = { x0: 15, x1: 21.2, yLow: 39.3, yHigh: 36, risers: 4 }
  const rise = top / steps.risers
  const run = (steps.yLow - steps.yHigh) / (steps.risers - 1) // the porch floor is the top step
  addStair(group, { ...steps, zLow: 0, zHigh: top - rise, risers: steps.risers - 1, yHigh: steps.yHigh }, white)
  for (let i = 0; i < steps.risers - 1; i++) {
    const z = rise * (i + 1)
    const yOut = steps.yLow - run * i
    addBox(group, steps.x0 - 0.05, yOut + 0.08, steps.x1 + 0.05, yOut - run, z - 0.02, z + 0.06, brown)
  }

  // Columns with base and cap, rails, black balusters (roof group: outside view only)
  const whiteOut = plain('#f7f6f2')
  const black = plain('#1e2226')
  const py = 35.62
  for (const x of PORCH_POSTS) {
    addBox(roofGroup, x - 0.25, py - 0.25, x + 0.25, py + 0.25, top, 9.9, whiteOut, { shadow: true })
    addBox(roofGroup, x - 0.33, py - 0.33, x + 0.33, py + 0.33, top, top + 0.6, whiteOut)
    addBox(roofGroup, x - 0.31, py - 0.31, x + 0.31, py + 0.31, 9.6, 9.9, whiteOut)
  }
  const balusters = []
  const railRun = (ax, ay, bx, by) => {
    beam(roofGroup, new THREE.Vector3(ax, top + 3, ay), new THREE.Vector3(bx, top + 3, by), 0.3, 0.2, whiteOut)
    beam(roofGroup, new THREE.Vector3(ax, top + 0.35, ay), new THREE.Vector3(bx, top + 0.35, by), 0.22, 0.14, whiteOut)
    const len = Math.hypot(bx - ax, by - ay)
    for (let d = 0.35; d < len - 0.2; d += 0.38) balusters.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len])
  }
  for (let i = 0; i < PORCH_POSTS.length - 1; i++) {
    if (i === 2) continue // the steps
    railRun(PORCH_POSTS[i] + 0.25, py, PORCH_POSTS[i + 1] - 0.25, py)
  }
  railRun(x0 + 0.2, y0 + 0.3, x0 + 0.2, py - 0.25) // left end
  const balMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 2.5, 0.06), black, balusters.length)
  balusters.forEach(([x, y], i) => balMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, top + 1.68, y)))
  roofGroup.add(balMesh)
  // Stair handrails from the porch columns down to newel posts at the bottom step
  for (const x of [steps.x0 + 0.2, steps.x1 - 0.2]) {
    addBox(roofGroup, x - 0.2, steps.yLow - 0.6, x + 0.2, steps.yLow - 0.2, 0, 3.3, whiteOut, { shadow: true })
    addBox(roofGroup, x - 0.25, steps.yLow - 0.65, x + 0.25, steps.yLow - 0.15, 3.3, 3.45, whiteOut)
    beam(roofGroup, new THREE.Vector3(x, top + 3, py), new THREE.Vector3(x, 3.1, steps.yLow - 0.4), 0.22, 0.18, whiteOut)
    beam(roofGroup, new THREE.Vector3(x, top + 0.4, py), new THREE.Vector3(x, 0.5, steps.yLow - 0.4), 0.16, 0.12, whiteOut)
  }

  // White porch ceiling under the shed roof, and the lantern beside the door
  addBox(roofGroup, -0.1, y0 + 0.3, 35.95, 35.5, 10.26, 10.3, whiteOut)
  addBox(group, 14.25, y0 + 0.25, 14.65, y0 + 0.6, H.ff1 + 5.6, H.ff1 + 6.6, black)
  addBox(group, 14.3, y0 + 0.62, 14.6, y0 + 0.66, H.ff1 + 5.8, H.ff1 + 6.4, new THREE.MeshStandardMaterial({ color: '#ffe2a3', emissive: '#ffe2a3', emissiveIntensity: 0.5 }))
}

// Hip roof over the kitchen bay: a front face and two angled side faces that
// rise to the house wall, hip caps, white fascia and a white soffit.
function bayRoof(group, roofMat, capMat, trimMat) {
  const [, c0, c1] = BAY // centerline corners: wall-left, front-left, front-right, wall-right
  const reach = 1 // half the wall plus a 9" overhang
  const wallY = -0.25 // outside face of the rear wall
  const frontY = c0[1] - reach
  const corner = reach * Math.tan(Math.PI / 8) // the bay's corners are 135 degrees
  const B = [c0[0] - corner, frontY]
  const C = [c1[0] + corner, frontY]
  const A = [B[0] - (wallY - frontY), wallY] // side eaves run back to the wall at 45 degrees
  const D = [C[0] + (wallY - frontY), wallY]
  const he = H.ff1 + 8 // eave at the top of the bay walls
  const ht = he + 0.85 * (wallY - frontY) // about 10/12
  const v = ([x, y], h) => [x, h, y]
  const T1 = [B[0], wallY]
  const T2 = [C[0], wallY]
  const pos = [
    ...v(B, he), ...v(C, he), ...v(T2, ht), ...v(T1, ht), // front face
    ...v(A, he), ...v(B, he), ...v(T1, ht), // left side
    ...v(C, he), ...v(D, he), ...v(T2, ht), // right side
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 7, 8, 9])
  faceUp(geo)
  const roof = new THREE.Mesh(geo, roofMat)
  roof.position.y = 0.08
  roof.castShadow = roof.receiveShadow = true
  group.add(roof)

  const P = (p, h) => new THREE.Vector3(p[0], h, p[1])
  beam(group, P(B, he + 0.12), P(T1, ht + 0.12), 0.22, 0.08, capMat)
  beam(group, P(C, he + 0.12), P(T2, ht + 0.12), 0.22, 0.08, capMat)
  for (const [p, q] of [[A, B], [B, C], [C, D]]) beam(group, P(p, he - 0.12), P(q, he - 0.12), 0.12, 0.4, trimMat)
  const soffit = new THREE.ShapeGeometry(new THREE.Shape([A, B, C, D].map(([x, y]) => new THREE.Vector2(x, y))))
  soffit.rotateX(Math.PI / 2)
  const soffitMesh = new THREE.Mesh(soffit, trimMat)
  soffitMesh.position.y = he - 0.3
  group.add(soffitMesh)
}

function shedRoof(group, r, material) {
  const T = 0.3
  const dz = r.zEave - r.zWall
  const dy = r.yEave - r.yWall
  const slope = Math.hypot(dz, dy)
  const geo = new THREE.BoxGeometry(r.x1 - r.x0, T, slope)
  const m = new THREE.Mesh(geo, material)
  m.position.set((r.x0 + r.x1) / 2, (r.yWall + r.yEave) / 2 + T / 2, (r.zWall + r.zEave) / 2)
  m.rotation.x = Math.atan2(-dy, Math.abs(dz)) * Math.sign(dz)
  m.castShadow = true
  m.receiveShadow = true
  group.add(m)
}

export { COLORS }
