import * as THREE from 'three'
import {
  H, LEVELS, levelById, ROOMS, WALLS, FIXTURES, DECK, SITE, PLANT_TYPES, openingPoint, roomFloor, gradeAt, deckY,
} from '../model/house.js'

// Plan (x, y) maps to three.js (X, Z); height is Y. 1 unit = 1 foot.

const HOUSE_W = 36.17

const COLORS = {
  siding: '#ece8df',
  interior: '#f6f4ef',
  trim: '#ffffff',
  foundation: '#a8a49c',
  roof: '#4b515a',
  roofEdge: '#3c4148',
  glass: '#9fc3dd',
  frontDoor: '#2f4a68',
  door: '#f2efe8',
  garageDoor: '#f7f6f2',
  porchDeck: '#a98762',
  step: '#b9b2a6',
  stair: '#b98f62',
  rail: '#fbfaf7',
  chimney: '#9b6f5a',
  ground: '#93b47c',
  drive: '#9a9893',
  walk: '#c2bcb0',
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
  porch: '#a98762',
  deck: '#8d6e57',
}

export function buildHouse() {
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

  const plain = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.9, side: THREE.DoubleSide })
  const roofMat = plain(COLORS.roof, { roughness: 0.95 })
  const roofEdgeMat = plain(COLORS.roofEdge)
  const sidingMat = plain(COLORS.siding)
  const trimMat = plain(COLORS.trim)

  // ------------------------------------------------------------ walls
  for (const wall of WALLS) addWall(levelGroups[wall.level], wall, mat)

  // ------------------------------------------------------------ floors
  const roomMeshes = []
  const highlightMat = new THREE.MeshBasicMaterial({
    color: COLORS.select, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
  })
  for (const room of ROOMS) {
    const shape = new THREE.Shape(room.poly.map(([x, y]) => new THREE.Vector2(x, y)))
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(Math.PI / 2) // (x, y, 0) -> (x, 0, y)
    const y = roomFloor(room)
    const floorMat =
      room.type === 'deck'
        ? new THREE.MeshStandardMaterial({ map: deckingTexture(), roughness: 0.8, side: THREE.DoubleSide, clippingPlanes: [clipPlanes[room.level]] })
        : mat(room.level, FLOOR_COLORS[room.type] ?? '#ccc', { roughness: 0.7 })
    const floor = new THREE.Mesh(geo, floorMat)
    floor.position.y = y
    floor.receiveShadow = true
    floor.userData = { kind: 'room', id: room.id }
    levelGroups[room.level].add(floor)

    const hl = new THREE.Mesh(geo, highlightMat)
    hl.position.y = y + 0.04
    hl.visible = false
    hl.renderOrder = 2
    levelGroups[room.level].add(hl)
    roomMeshes.push({ id: room.id, level: room.level, floor, highlight: hl })
  }

  // Thin slabs under each upper floor so the levels read as solid from the side.
  addBox(levelGroups.L2, 0, 0, HOUSE_W, 32, H.ceil1, H.ff2 - 0.02, mat('L2', '#d9d4ca'), { holes: [[13.5, 16.5, 22.67, 32]] })
  addBox(levelGroups.L1, 0, 0, HOUSE_W, 32, H.ff1 - 0.9, H.ff1 - 0.02, mat('L1', '#d9d4ca'), { holes: [[13.5, 16.9, 16.5, 28]] })
  addBox(levelGroups.L1, 36.17, 3, 49, 14, H.garageFloor, H.ff1 - 0.02, mat('L1', '#d9d4ca'))
  addBox(levelGroups.L1, 36.17, 14, 57, 36, H.garageFloor - 0.3, H.garageFloor - 0.01, mat('L1', '#b0aca4'))
  addBox(levelGroups.L1, 49, 3, 57, 14, H.garageFloor - 0.3, H.garageFloor - 0.01, mat('L1', '#b0aca4'))

  // ------------------------------------------------------------ fixtures
  for (const f of FIXTURES) {
    const base = levelById[f.level].floor
    const g = levelGroups[f.level]
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
  }

  // ------------------------------------------------------------ stairs
  // Main stair: bottom tread at the front (y 28), climbing to the upper hall at y 16.5.
  addStair(levelGroups.L1, { x0: 13.55, x1: 16.45, yLow: 28, yHigh: 16.5, zLow: H.ff1, zHigh: H.ff2, risers: 15 }, mat('L1', COLORS.stair, { roughness: 0.6 }))
  // Basement stair below it, top at the rear.
  addStair(levelGroups.B, { x0: 13.55, x1: 16.45, yLow: 28, yHigh: 16.9, zLow: H.basementFloor, zHigh: H.ff1, risers: 13 }, mat('B', '#a88a66'))
  // Garage steps from the mudroom door.
  addStair(levelGroups.L1, { x0: 49.25, x1: 51.6, yLow: 10.4, yHigh: 13.6, zLow: H.garageFloor, zHigh: H.ff1, risers: 3, alongX: true, xLow: 51.6, xHigh: 49.25 }, mat('L1', COLORS.step))

  // ------------------------------------------------------------ porch & stoops
  const L1 = levelGroups.L1
  addBox(L1, 0, 32, 35.83, 36, H.grade, H.porchFloor, mat('L1', '#8f8a80'))
  addBox(L1, 0, 32, 35.83, 36, H.porchFloor - 0.02, H.porchFloor + 0.05, mat('L1', COLORS.porchDeck, { roughness: 0.7 }))
  addStair(L1, { x0: 15, x1: 21.2, yLow: 38.6, yHigh: 36, zLow: H.grade, zHigh: H.porchFloor, risers: 3 }, mat('L1', COLORS.step))
  // Bay underside skirt
  addBox(L1, 18.3, -1.62, 24.3, 0, H.ff1 - 0.7, H.ff1 - 0.02, mat('L1', COLORS.siding))

  // ------------------------------------------------------------ deck (2020)
  buildDeck(L1, mat)

  const postXs = [0.25, 7, 14.4, 21.6, 28.6, 35.6]
  const balusters = []
  const railMat = plain(COLORS.rail)
  for (const x of postXs) addBox(roofGroup, x - 0.17, 35.55, x + 0.17, 35.89, H.porchFloor, 10.4, railMat, { shadow: true })
  for (let i = 0; i < postXs.length - 1; i++) {
    const a = postXs[i] + 0.17
    const b = postXs[i + 1] - 0.17
    if (i === 2) continue // entry steps
    addBox(roofGroup, a, 35.66, b, 35.8, H.porchFloor + 2.9, H.porchFloor + 3.1, railMat)
    addBox(roofGroup, a, 35.66, b, 35.8, H.porchFloor + 0.25, H.porchFloor + 0.4, railMat)
    for (let x = a + 0.35; x < b - 0.1; x += 0.42) balusters.push([x, 35.73])
  }
  // Left end railing
  addBox(roofGroup, 0.15, 32.2, 0.35, 35.55, H.porchFloor + 2.9, H.porchFloor + 3.1, railMat)
  for (let y = 32.5; y < 35.4; y += 0.42) balusters.push([0.25, y])
  const balGeo = new THREE.BoxGeometry(0.12, 2.5, 0.12)
  const balMesh = new THREE.InstancedMesh(balGeo, railMat, balusters.length)
  balusters.forEach(([x, y], i) => {
    balMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, H.porchFloor + 1.65, y))
  })
  roofGroup.add(balMesh)

  // ------------------------------------------------------------ roofs
  // Main roof: side gable, ridge along x, 9/12.
  gableRoof(roofGroup, { x0: 0, x1: 36.17, z0: 0, z1: 32, axis: 'x', base: H.ceil2, pitch: 0.75, eave: 1, rake: 0.8 }, roofMat, roofEdgeMat)
  gableEnd(roofGroup, { plane: 'x', at: 0, from: 0, to: 32, base: H.ceil2, pitch: 0.75 }, sidingMat)
  gableEnd(roofGroup, { plane: 'x', at: 36.17, from: 0, to: 32, base: H.ceil2, pitch: 0.75 }, sidingMat)
  // Decorative front gable over the center window
  gableRoof(roofGroup, { x0: 13.6, x1: 22.6, z0: 24.5, z1: 32, axis: 'z', base: H.ceil2, pitch: 1, eave: 0.6, rake: 0.6, noBackRake: true }, roofMat, roofEdgeMat)
  gableEnd(roofGroup, { plane: 'z', at: 32, from: 13.6, to: 22.6, base: H.ceil2, pitch: 1 }, plain('#e4dfd3'))
  const fan = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24, 0, Math.PI), trimMat)
  fan.position.set(18.1, H.ceil2 + 0.6, 32.3)
  roofGroup.add(fan)

  // Porch shed roof
  shedRoof(roofGroup, { x0: -0.4, x1: 36.1, zWall: 32, zEave: 36.6, yWall: 13.5, yEave: 10.35 }, roofMat)
  addBox(roofGroup, -0.1, 35.5, 35.95, 36.0, 9.9, 10.5, trimMat)

  // Bay roof
  shedRoof(roofGroup, { x0: 16.4, x1: 26.2, zWall: 0, zEave: -2.2, yWall: H.ff1 + 8.8, yEave: H.ff1 + 7.85 }, roofMat)

  // Garage: side gable (ridge along x) plus a full-width front gable, 11/12.
  gableRoof(roofGroup, { x0: 36.17, x1: 57, z0: 3, z1: 36, axis: 'x', base: H.garagePlate, pitch: 0.75, eave: 1, rake: 0.8, noStartRake: true }, roofMat, roofEdgeMat)
  gableEnd(roofGroup, { plane: 'x', at: 57, from: 3, to: 36, base: H.garagePlate, pitch: 0.75 }, sidingMat)
  // No side eaves: the right wall's siding runs straight up into the side gable (photo).
  gableRoof(roofGroup, { x0: 36.17, x1: 57, z0: 19.5, z1: 36, axis: 'z', base: H.garagePlate, pitch: 11 / 12, eave: 0, rake: 0.8, noBackRake: true }, roofMat, roofEdgeMat)
  gableEnd(roofGroup, { plane: 'z', at: 36, from: 36.17, to: 57, base: H.garagePlate, pitch: 11 / 12 }, sidingMat)
  const vent = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 32), trimMat)
  vent.position.set(46.58, 16.2, 36.32)
  roofGroup.add(vent)
  const ventGlass = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), plain('#59636e'))
  ventGlass.position.set(46.58, 16.2, 36.3)
  roofGroup.add(ventGlass)


  // Chimney on the left wall, 2'-0" above the ridge. The property survey marks
  // "CHIM." on the garage's right wall instead; the owner confirmed (2026-10-17)
  // it is on the left wall by the family room fireplace, as the 2001 plans show.
  const chimMat = plain(COLORS.chimney)
  addBox(roofGroup, -2.2, 5.5, 0, 10.5, -0.3, 34.5, chimMat, { shadow: true })
  addBox(roofGroup, -2.4, 5.3, 0.2, 10.7, 34.5, 35.1, plain('#7c5949'))

  // ------------------------------------------------------------ site
  const woodsGroup = new THREE.Group()
  woodsGroup.name = 'woods'
  root.add(woodsGroup)
  buildSite(siteGroup, woodsGroup, plain)
  // Excavation walls visible in the basement cutaway
  addBox(siteGroup, -0.55, -0.55, 36.72, -0.5, H.basementFloor, -0.12, plain('#7a6a58'))

  return { root, levelGroups, roofGroup, siteGroup, woodsGroup, roomMeshes, clipPlanes }
}

// ------------------------------------------------------------ property

const FAR = 450

function buildSite(group, woods, plain) {
  const { lot, setbacks: sb, curbY, roadWidth } = SITE
  const groundMat = plain(COLORS.ground, { roughness: 1 })
  const flat = (pts, y, material) => {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))))
    geo.rotateX(Math.PI / 2)
    const mesh = new THREE.Mesh(geo, material)
    mesh.position.y = y
    mesh.receiveShadow = true
    group.add(mesh)
  }

  // Front and side lawns up to the curb, notched for the basement cutaway
  flat([[-FAR, 0], [0, 0], [0, 32], [HOUSE_W, 32], [HOUSE_W, 0], [FAR, 0], [FAR, curbY], [-FAR, curbY]], -0.02, groundMat)
  // Orchard Street, curbs, and the far side
  const farSide = curbY + roadWidth
  addBox(group, -FAR, curbY, FAR, farSide, -0.62, -0.45, plain('#606268', { roughness: 0.95 }), { receive: true })
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
  back.setIndex(idx)
  back.computeVertexNormals()
  const backMesh = new THREE.Mesh(back, groundMat)
  backMesh.receiveShadow = true
  group.add(backMesh)

  // Driveways (over the depressed curb) and the concrete at the porch steps
  const asphalt = plain('#55575c', { roughness: 0.95 })
  addBox(group, SITE.drive.x0, 36, SITE.drive.x1, curbY + 0.5, -0.03, 0.04, asphalt, { receive: true })
  const nd = SITE.neighborDrive
  addBox(group, nd.x0, nd.y0, nd.x1, curbY + 0.5, -0.03, 0.035, asphalt, { receive: true })
  const w = SITE.walk
  addBox(group, w.x0, w.y0, w.x1, w.y1, -0.03, 0.06, plain(COLORS.walk), { receive: true })

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

  buildFences(group, plain)

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

  buildPlantings(group, plain)
  buildWoods(woods)
}

// Unit-size lathe profile [radius, height] turned into a solid of revolution.
const lathe = (profile, segments = 18) => new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), segments)

function buildPlantings(group, plain) {
  const bark = plain('#5b4636')
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const color = new THREE.Color()

  // Thuja Green Giant: narrow column, full near the bottom, soft point on top
  const thujas = SITE.plants.filter((p) => p.kind === 'thuja')
  const t = PLANT_TYPES.thuja
  const thujaGeo = lathe([[0, 0], [0.4, 0.02], [0.5, 0.15], [0.47, 0.4], [0.37, 0.65], [0.22, 0.86], [0.08, 0.97], [0, 1]])
  const thujaMesh = new THREE.InstancedMesh(thujaGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }), thujas.length)
  thujas.forEach((p, i) => {
    const [x, y] = p.at
    const k = 0.93 + ((i * 37) % 11) / 75 // slight size variation
    m.compose(new THREE.Vector3(x, gradeAt(y) - 0.1, y), q, new THREE.Vector3(t.spread * k, t.height * k, t.spread * k))
    thujaMesh.setMatrixAt(i, m)
    color.setHSL(0.33, 0.42, 0.2 + ((i * 13) % 7) / 100)
    thujaMesh.setColorAt(i, color)
  })
  thujaMesh.castShadow = thujaMesh.receiveShadow = true
  group.add(thujaMesh)

  for (const p of SITE.plants) {
    const [x, y] = p.at
    const g = gradeAt(y)
    if (p.kind === 'serviceberry') {
      // Multi-stem small tree with a loose, rounded crown
      const s = PLANT_TYPES.serviceberry
      const leaves = plain('#6f8f3e')
      for (const [dx, dy, lean] of [[0, 0, 0], [0.35, 0.2, 0.18], [-0.3, 0.25, -0.15]]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, s.height * 0.55, 6), bark)
        stem.position.set(x + dx, g + s.height * 0.27, y + dy)
        stem.rotation.z = lean
        stem.castShadow = true
        group.add(stem)
      }
      for (const [dx, dz, dy, r] of [[0, 0.62, 0, 1.6], [0.9, 0.55, 0.4, 1.2], [-0.8, 0.6, -0.3, 1.25], [0.2, 0.82, -0.5, 1.1]]) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaves)
        blob.position.set(x + dx, g + s.height * dz + 1.2, y + dy)
        blob.scale.set(s.spread / 4.2, 1, s.spread / 4.2)
        blob.castShadow = blob.receiveShadow = true
        group.add(blob)
      }
    } else if (p.kind === 'cherry') {
      // Weeping form: straight trunk under a domed canopy whose edges hang down
      const c = PLANT_TYPES.cherry
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, c.height * 0.85, 8), bark)
      trunk.position.set(x, g + c.height * 0.42, y)
      trunk.castShadow = true
      group.add(trunk)
      const canopy = new THREE.Mesh(
        lathe([[0.5, 0.3], [0.53, 0.5], [0.47, 0.72], [0.32, 0.88], [0.13, 0.98], [0, 1], [0, 0.82], [0.26, 0.72], [0.42, 0.5], [0.5, 0.3]], 24),
        plain('#5d7f3b'),
      )
      canopy.position.set(x, g, y)
      canopy.scale.set(c.spread, c.height, c.spread)
      canopy.castShadow = canopy.receiveShadow = true
      group.add(canopy)
    }
  }
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
  geo.computeVertexNormals()
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
    if (f.kind === 'vinyl') {
      verticalRibbon(group, f.pts, f.height, vinyl)
      for (const [x, y] of postsAlong(f.pts, 8)) {
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
  let seed = 90
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
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
      spots.push([x, y, k, rnd()])
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.65, 1, 7)
  trunkGeo.translate(0, 0.5, 0)
  const crownGeo = new THREE.IcosahedronGeometry(1, 1)
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 1 }), spots.length)
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), spots.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const color = new THREE.Color()
  spots.forEach(([x, y, k, t], i) => {
    const g = gradeAt(y)
    const trunkH = 10 * k
    const r = 6 * k
    m.compose(new THREE.Vector3(x, g - 0.3, y), q, new THREE.Vector3(1, trunkH, 1))
    trunks.setMatrixAt(i, m)
    m.compose(new THREE.Vector3(x, g + trunkH + r * 0.55, y), q, new THREE.Vector3(r, r * 1.15, r))
    crowns.setMatrixAt(i, m)
    color.setHSL(0.24 + t * 0.08, 0.38 + t * 0.12, 0.27 + t * 0.1)
    crowns.setColorAt(i, color)
  })
  trunks.castShadow = crowns.castShadow = true
  crowns.receiveShadow = true
  group.add(trunks, crowns)
}

// ------------------------------------------------------------ deck

const DECK_COLORS = {
  board: '#8d6e57',
  frame: '#6f5442',
  framing: '#a8916b',
  rail: '#f7f6f2',
  baluster: '#1f2226',
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
  ]
  for (const [[ax, ay], [bx, by]] of edges) {
    const vertical = ax === bx
    const nx = vertical ? 0.05 : 0
    const ny = vertical ? 0 : 0.05
    addBox(group, Math.min(ax, bx) - nx, Math.min(ay, by) - ny, Math.max(ax, bx) + nx, Math.max(ay, by) + ny, top - 0.78, top, m(DECK_COLORS.frame))
    // 5.5" border board laid on top along the edge, inside the deck
    const ix = vertical ? (ax === x0 ? 0.46 : -0.46) : 0
    const iy = vertical ? 0 : 0.46
    addBox(group, Math.min(ax, ax + ix, bx), Math.min(ay, ay + iy, by), Math.max(ax, ax + ix, bx), Math.max(ay, ay + iy, by), top - 0.01, top + 0.012, m(DECK_COLORS.frame, { roughness: 0.75 }))
  }

  // Lattice skirt from grade up to the fascia, with a gate on the far side
  const lattice = latticeMaterial(mat)
  skirt(group, x0, deckY(0), x0, deckY(DECK.depth), top - 0.78, lattice)
  skirt(group, x0, deckY(DECK.depth), x1, deckY(DECK.depth), top - 0.78, lattice)
  skirt(group, x1, deckY(DECK.depth), x1, deckY(landing.depth), top - 0.78, lattice)
  skirt(group, landing.x1, deckY(0), landing.x1, deckY(landing.depth), top - 0.78, lattice)
  const gate = m('#e9e6df')
  const g0 = deckY(1)
  const g1 = deckY(3.6)
  for (const y of [g0, g1]) addBox(group, x0 - 0.12, y + 0.1, x0, y - 0.1, gradeAt(y), top - 0.78, gate)
  addBox(group, x0 - 0.12, g0, x0, g1, top - 1.0, top - 0.78, gate)

  // Stair: 7 treads down to a concrete pad, away from the house
  const sy0 = deckY(stair.from)
  const sy1 = deckY(stair.from + stair.run)
  const padY1 = deckY(stair.from + stair.run + DECK.pad.depth)
  const padTop = gradeAt((sy1 + padY1) / 2) + 0.1
  addBox(group, stair.x0, sy1, stair.x1, padY1, gradeAt(padY1) - 0.25, padTop, m(DECK_COLORS.concrete), { receive: true })
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

  // Vinyl railing with black aluminum balusters
  const railMat = m(DECK_COLORS.rail, { roughness: 0.5 })
  const balMat = m(DECK_COLORS.baluster, { roughness: 0.4 })
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
      beam(group, at(k0, 0.32), at(k1, 0.32), 0.2, 0.14, railMat)
      const n = Math.floor((len - 0.4) / 0.375)
      for (let j = 1; j < n; j++) balusters.push(at(k0 + ((k1 - k0) * j) / n, 1.6))
    }
  }
  const balMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 2.42, 0.055), balMat, balusters.length)
  balusters.forEach((p, i) => balMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)))
  balMesh.castShadow = true
  group.add(balMesh)

  // Graspable handrail on the deck side of the stair
  const hx = stair.x0 + 0.3
  const hTop = new THREE.Vector3(hx, stairBase(stair.from) + 2.9, sy0 - 0.2)
  const hBot = new THREE.Vector3(hx, stairBase(stair.from + stair.run) + 2.9, sy1)
  const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, hTop.distanceTo(hBot), 12), railMat)
  hr.position.copy(hTop).add(hBot).multiplyScalar(0.5)
  hr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hBot.clone().sub(hTop).normalize())
  group.add(hr)
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
  group.add(new THREE.Mesh(geo, material))
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
  const tones = ['#93735b', '#8a6b54']
  for (let i = 0; i < 2; i++) {
    const y0 = i * pitch
    g.fillStyle = tones[i]
    g.fillRect(0, y0, c.width, board)
    for (let k = 0; k < 40; k++) {
      g.fillStyle = k % 2 ? 'rgba(60,40,28,0.08)' : 'rgba(170,140,110,0.08)'
      g.fillRect(0, y0 + Math.random() * board, c.width, 1 + Math.random() * 2)
    }
    g.fillStyle = '#3d2f25'
    g.fillRect(0, y0 + board, c.width, pitch - board)
  }
  // one butt joint per board, staggered
  g.fillRect(300, 0, 3, board)
  g.fillRect(820, pitch, 3, board)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / 8, 12 / 11.5) // canvas = 8 ft of two boards
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  deckingTex = tex
  return tex
}

function latticeMaterial(mat) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.strokeStyle = '#f1efe9'
  g.lineWidth = 16
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
    for (const [hx0, hy0, hx1, hy1] of opts.holes) {
      shape.holes.push(new THREE.Path([new THREE.Vector2(hx0, hy0), new THREE.Vector2(hx0, hy1), new THREE.Vector2(hx1, hy1), new THREE.Vector2(hx1, hy0)]))
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

function addWall(group, wall, mat) {
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
  const ext = wall.ext ? t / 2 : 0
  const isFoundation = wall.kind === 'foundation'
  const wallMat = mat(wall.level, isFoundation ? '#a8a49c' : wall.ext ? '#ece8df' : '#f6f4ef')

  const piece = (s0, s1, z0, z1, material, thick = t, offset = 0) => {
    if (s1 - s0 < 0.01 || z1 - z0 < 0.01) return null
    const geo = new THREE.BoxGeometry(s1 - s0, z1 - z0, thick)
    const m = new THREE.Mesh(geo, material)
    const sm = (s0 + s1) / 2
    m.position.set(ax + ux * sm - uy * offset, base + (z0 + z1) / 2, ay + uy * sm + ux * offset)
    m.rotation.y = -ang
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
    return m
  }

  if (wall.kind === 'rail') {
    piece(0, L, h - 0.15, h, mat(wall.level, '#fbfaf7'), 0.3)
    piece(0, L, 0.05, h - 0.15, mat(wall.level, '#ffffff', { opacity: 0.25, roughness: 0.2 }), 0.06)
    return
  }
  if (wall.kind === 'knee') {
    piece(-ext, L + ext, 0, h, wallMat)
    piece(-ext, L + ext, h, h + 0.1, mat(wall.level, '#fbfaf7'), t + 0.12)
    return
  }

  const ops = (wall.openings ?? [])
    .map((op) => {
      const { d } = openingPoint(wall, op)
      return { ...op, s0: d - op.w / 2, s1: d + op.w / 2 }
    })
    .sort((a, b) => a.s0 - b.s0)

  let s = -ext
  for (const op of ops) {
    piece(s, op.s0, 0, h, wallMat)
    piece(op.s0, op.s1, 0, op.sill, wallMat)
    piece(op.s0, op.s1, op.head, h, wallMat)
    s = op.s1

    if (op.type === 'window') {
      piece(op.s0, op.s1, op.sill, op.head, mat(wall.level, '#9fc3dd', { opacity: 0.45, roughness: 0.1 }), 0.06)
      const trim = mat(wall.level, '#ffffff')
      piece(op.s0 - 0.12, op.s1 + 0.12, op.sill - 0.12, op.sill, trim, t + 0.14)
      piece(op.s0 - 0.12, op.s1 + 0.12, op.head, op.head + 0.15, trim, t + 0.1)
      piece(op.s0, op.s1, (op.sill + op.head) / 2 - 0.05, (op.sill + op.head) / 2 + 0.05, trim, 0.12)
      if (op.model !== 'C235' && op.w > 4) piece((op.s0 + op.s1) / 2 - 0.12, (op.s0 + op.s1) / 2 + 0.12, op.sill, op.head, trim, t + 0.02)
    } else if (op.type === 'door') {
      if (op.style === 'garage') {
        piece(op.s0, op.s1, op.sill, op.head, mat(wall.level, '#f7f6f2', { roughness: 0.5 }), 0.15)
        for (let z = op.sill + 1.75; z < op.head - 0.2; z += 1.75) {
          piece(op.s0 + 0.1, op.s1 - 0.1, z - 0.04, z + 0.04, mat(wall.level, '#d9d7d0'), 0.22)
        }
      } else if (op.style === 'front' || op.style === 'entry') {
        const c = op.style === 'front' ? '#2f4a68' : '#f2efe8'
        piece(op.s0, op.s1, op.sill, op.head, mat(wall.level, c, { roughness: 0.5 }), 0.18)
        piece(op.s0 - 0.25, op.s1 + 0.25, op.head, op.head + 0.3, mat(wall.level, '#ffffff'), t + 0.12)
      } else if (op.style === 'patio') {
        piece(op.s0, op.s1, op.sill, op.head, mat(wall.level, '#9fc3dd', { opacity: 0.45, roughness: 0.1 }), 0.06)
        piece((op.s0 + op.s1) / 2 - 0.1, (op.s0 + op.s1) / 2 + 0.1, op.sill, op.head, mat(wall.level, '#ffffff'), t)
      }
    }
  }
  piece(s, L + ext, 0, h, wallMat)
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
function gableRoof(group, r, material, edgeMat) {
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
