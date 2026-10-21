import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { buildHouse } from './buildHouse.js'
import { buildFurniturePiece } from './furniture.js'
import { moveFurniture } from '../model/furniture.js'
import { loadMayaModel, appMaterial, fixVertexColors } from './mayaModel.js'
import { bakeBumpMaps } from './bakeBump.js'
import { Measure } from './measure.js'
import {
  ROOMS, ITEMS, SITE, levelById, roomById, itemById, roomFloor, roomLabelPoint, polyArea, gradeAt,
} from '../model/house.js'

// Light mode, remembered per device: a device that lost the 3D view once
// starts without shadows, at 1x pixels and without the background woods.
// ?lite=1 or ?lite=0 sets it.
const LITE_KEY = 'homeTwin.lite3d'
function readLite() {
  try {
    return localStorage.getItem(LITE_KEY) === '1'
  } catch {
    return false
  }
}
function writeLite(on) {
  try {
    if (on) localStorage.setItem(LITE_KEY, '1')
    else localStorage.removeItem(LITE_KEY)
  } catch {
    // storage unavailable: light mode lasts for this page only
  }
}

const CENTER = new THREE.Vector3(28.5, 9, 14)
const NORTH_RAD = THREE.MathUtils.degToRad(SITE.northDeg)
// Deed north: "up" on the plans (toward the rear, -z) turned counterclockwise.
const NORTH = new THREE.Vector3(-Math.sin(NORTH_RAD), 0, -Math.cos(NORTH_RAD))
// Items on the lot live on the pseudo level 'site', shown with the whole house.
const modeOf = (level) => (level === 'site' ? 'exterior' : level)
const CUT_HEIGHT = 4.5
// Where to aim and how much to fit for each floor.
const LEVEL_FRAME = {
  L1: { cx: 28.5, cz: 9, r: 38 }, // includes the deck behind the house
  L2: { cx: 22, cz: 16, r: 27 },
  B: { cx: 18, cz: 16, r: 23 },
}
const CATEGORY_GLYPH = { HVAC: 'H', Plumbing: 'P', Electrical: 'E', Safety: 'S', Structure: 'B', Appliances: 'A', Site: 'L', Landscape: 'T', Drainage: 'D' }

export class Viewer {
  constructor(container, { onSelect, onFurnitureMove, onMeasurementSave, onMeasurementRemove } = {}) {
    this.container = container
    this.onSelect = onSelect
    this.onFurnitureMove = onFurnitureMove
    this.onMeasurementSave = onMeasurementSave
    this.onMeasurementRemove = onMeasurementRemove
    this.furniture = []
    this.furnitureGroups = new Map()
    this.furnitureMats = new Map()
    this.showFurniture = true
    this.mode = 'exterior'
    this.cut = true
    this.selection = null
    this.tween = null
    this.dirty = true

    // Phones and small screens skip the ambient occlusion pass, use a
    // smaller shadow map and render at 1.5x (graphics memory is tight there:
    // running out drops the 3D view); everything else looks the same.
    const highQuality = window.matchMedia('(pointer: fine)').matches && Math.min(screen.width, screen.height) >= 700
    this.highQuality = highQuality

    const liteParam = new URLSearchParams(window.location.search).get('lite')
    if (liteParam != null) writeLite(liteParam !== '0')
    const lite = liteParam != null ? liteParam !== '0' : readLite()
    this.lite = lite
    this.startedAt = performance.now()

    const renderer = new THREE.WebGLRenderer({ antialias: !lite, alpha: true })
    renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio, highQuality ? 2 : 1.5))
    renderer.localClippingEnabled = true
    renderer.shadowMap.enabled = !lite
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    container.appendChild(renderer.domElement)
    this.renderer = renderer
    // the graphics chip, shown if the view is lost
    const gl = renderer.getContext()
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    this.gpuName = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? 'unknown')

    const labels = new CSS2DRenderer()
    labels.domElement.className = 'label-layer'
    // clip instead of hidden: a focused button on a label near the edge
    // would otherwise scroll the layer and shift every label
    labels.domElement.style.overflow = 'clip'
    container.appendChild(labels.domElement)
    this.labelRenderer = labels

    const compass = document.createElement('div')
    compass.className = 'compass'
    compass.title = `North (lot lines bear N 08°32' E)`
    const needle = document.createElement('div')
    needle.className = 'compass-needle'
    needle.appendChild(document.createElement('span')).textContent = 'N'
    compass.appendChild(needle)
    container.appendChild(compass)

    // The browser can drop the WebGL context (a phone low on graphics memory,
    // the GPU process restarting) and the view goes blank. three.js rebuilds
    // its GPU state when the context comes back; until then a note explains,
    // with a reload, which also switches this device to light mode.
    const lost = document.createElement('div')
    lost.className = 'gl-lost'
    lost.hidden = true
    const lostText = document.createElement('p')
    const reload = document.createElement('button')
    reload.type = 'button'
    reload.className = 'btn'
    reload.addEventListener('click', () => window.location.reload())
    const lostInfo = document.createElement('p')
    lostInfo.className = 'gl-lost-info'
    lost.append(lostText, reload, lostInfo)
    container.appendChild(lost)
    this.lostNote = lost
    renderer.domElement.addEventListener('webglcontextlost', () => {
      if (this.disposed) return
      if (!lite) writeLite(true)
      lostText.textContent = lite
        ? 'The 3D view stopped again, even in light mode. If reloading does not help, close the browser completely (swipe it away) and open the page again.'
        : 'The 3D view stopped: the graphics driver on this device reset it.'
      reload.textContent = lite ? 'Reload the 3D view' : 'Reload in light mode'
      const secs = ((performance.now() - this.startedAt) / 1000).toFixed(1)
      lostInfo.textContent = `${this.gpuName} · lost ${secs} s after opening${this.usingMaya ? '' : ', while loading'}${lite ? ' · light mode' : ''}`
      lost.hidden = false
      labels.domElement.style.visibility = 'hidden'
    })
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      lost.hidden = true
      labels.domElement.style.visibility = ''
      this.dirty = true
    })
    this.compassEl = compass

    const scene = new THREE.Scene()
    this.scene = scene
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1000)
    this.camera = camera

    // Sky and ground bounce. (An environment map was tried: its glancing
    // reflections washed the lawn out to a pale mint.)
    scene.add(new THREE.HemisphereLight('#eaf1ff', '#7d7462', 1.1))
    // Late-morning sun from the front left (the camera's usual side), warm
    const sun = new THREE.DirectionalLight('#fff1dc', 2.5)
    sun.position.set(-38, 100, 70)
    sun.target.position.copy(CENTER)
    sun.castShadow = true
    sun.shadow.mapSize.set(highQuality ? 4096 : 2048, highQuality ? 4096 : 2048)
    const sc = sun.shadow.camera
    sc.left = -52
    sc.right = 52
    sc.top = 52
    sc.bottom = -52
    sc.near = 20
    sc.far = 230
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.03
    scene.add(sun, sun.target)
    // Cool fill from the opposite side so shaded faces keep their detail
    const fill = new THREE.DirectionalLight('#dce6ff', 0.45)
    fill.position.set(60, 50, -70)
    fill.target.position.copy(CENTER)
    scene.add(fill, fill.target)

    const house = buildHouse({ lowDetail: !highQuality })
    // siding and shingle courses painted into their color maps (bakeBump.js)
    bakeBumpMaps(house.root)
    if (lite) {
      // light mode: no background woods
      for (const o of house.woodsGroup.children.filter((c) => c.userData.forest)) {
        house.woodsGroup.remove(o)
        o.geometry?.dispose()
      }
    }
    this.house = house
    scene.add(house.root)

    // Ambient occlusion: darkens corners, eaves, the ground under the deck and
    // where furniture meets the floor. Its normal pass honors the cutaway.
    if (highQuality) {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
      const composer = new EffectComposer(renderer, target)
      composer.addPass(new RenderPass(scene, camera))
      const ao = new GTAOPass(scene, camera, 1, 1)
      ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.4, thickness: 1.5, scale: 1.25, samples: 16 })
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 })
      ao.blendIntensity = 0.85
      ao.normalMaterial.side = THREE.DoubleSide
      composer.addPass(ao)
      composer.addPass(new OutputPass())
      this.composer = composer
      this.aoPass = ao
    }

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minDistance = 8
    controls.maxDistance = 450
    controls.screenSpacePanning = true
    controls.addEventListener('change', () => (this.dirty = true))
    controls.addEventListener('start', () => (this.tween = null))
    this.controls = controls

    this.buildLabels()
    this.measure = new Measure(this)
    this.measure.setResolution(container.clientWidth || 1, container.clientHeight || 1)
    this.measuring = false
    this.editable = true // furniture moves and saved-measurement edits (the admin, or no sharing)
    this.attachPicking()

    // The Maya model, when there is one, replaces the house built from the plans
    // (open the app with ?model=plans to see the generated house instead)
    const usePlans = new URLSearchParams(window.location.search).get('model') === 'plans'
    ;(usePlans ? Promise.resolve(null) : loadMayaModel({ phone: !highQuality, woods: !lite }))
      .then((model) => {
        if (model && !this.disposed) this.useMayaModel(model)
      })
      .catch((err) => console.warn('Maya model not loaded:', err))

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.homeView(false)
    this.applyMode()

    const loop = (now) => {
      this.raf = requestAnimationFrame(loop)
      this.stepTween(now)
      const moved = controls.update()
      if (moved || this.dirty || this.tween) {
        if (this.composer) this.composer.render()
        else renderer.render(scene, camera)
        labels.render(scene, camera)
        this.updateCompass()
        this.dirty = false
      }
    }
    this.raf = requestAnimationFrame(loop)
  }

  // ------------------------------------------------------------ labels

  buildLabels() {
    this.roomLabels = []
    for (const room of ROOMS) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'room-label'
      el.textContent = room.name
      if (polyArea(room.poly) < 30) el.classList.add('small')
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.onSelect?.({ kind: 'room', id: room.id })
      })
      const obj = new CSS2DObject(el)
      const [x, y] = roomLabelPoint(room)
      obj.position.set(x, roomFloor(room) + 0.3, y)
      obj.userData = { level: room.level, id: room.id }
      this.scene.add(obj)
      this.roomLabels.push(obj)
    }
    this.itemPins = []
    for (const item of ITEMS) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'item-pin'
      el.dataset.category = item.category
      el.title = item.name
      el.setAttribute('aria-label', item.name)
      el.textContent = CATEGORY_GLYPH[item.category] ?? 'i'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.onSelect?.({ kind: 'item', id: item.id })
      })
      const obj = new CSS2DObject(el)
      const base = item.floor ?? levelById[item.level].floor
      obj.position.set(item.at[0], base + item.z, item.at[1])
      obj.userData = { level: item.level, id: item.id }
      this.scene.add(obj)
      this.itemPins.push(obj)
    }
    // Street and neighboring lots, shown with the whole house
    this.siteLabels = []
    const siteLabel = (text, cls, x, y, z) => {
      const el = document.createElement('div')
      el.className = cls
      el.textContent = text
      const obj = new CSS2DObject(el)
      obj.position.set(x, y, z)
      this.scene.add(obj)
      this.siteLabels.push(obj)
    }
    const { lot, curbY, roadWidth } = SITE
    siteLabel('Orchard Street', 'street-label', 28, -0.4, curbY + roadWidth / 2)
    siteLabel('Lot 58 B', 'lot-label', lot.x0 - 18, 0.5, 5)
    siteLabel('Lot 54', 'lot-label', lot.x1 + 16, 0.5, 5)
    siteLabel('Lot 126', 'lot-label', 28, gradeAt(lot.y0 - 15) + 0.5, lot.y0 - 15)
  }

  updateCompass() {
    const t = this.controls.target
    const a = t.clone().project(this.camera)
    const b = t.clone().addScaledVector(NORTH, 10).project(this.camera)
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    const angle = Math.atan2((b.x - a.x) * w, (b.y - a.y) * h)
    this.compassEl.firstChild.style.transform = `rotate(${angle}rad)`
  }

  setShowPins(show) {
    this.showPins = show
    this.applyMode()
  }

  // ------------------------------------------------------------ modes

  setMode(mode, cut = this.cut) {
    const changed = mode !== this.mode
    this.mode = mode
    this.cut = cut
    this.applyMode()
    if (changed && !this.tween) this.frameMode()
  }

  applyMode() {
    const { levelGroups, roofGroup, clipPlanes } = this.house
    const order = ['B', 'L1', 'L2']
    const idx = this.mode === 'exterior' ? 99 : order.indexOf(this.mode)
    order.forEach((id, i) => {
      levelGroups[id].visible = i <= idx
      clipPlanes[id].constant = 1e5
    })
    roofGroup.visible = this.mode === 'exterior'
    this.house.woodsGroup.visible = this.mode === 'exterior'
    this.house.utilitiesGroup.visible = this.showPins !== false
    for (const l of this.siteLabels) l.visible = this.mode === 'exterior'
    if (this.mode !== 'exterior' && this.cut) {
      clipPlanes[this.mode].constant = levelById[this.mode].floor + CUT_HEIGHT
    }
    // The AO normal pass draws everything with one material: give it the same
    // cut, or walls above the cut would still darken the rooms
    if (this.aoPass) {
      this.aoPass.normalMaterial.clippingPlanes = this.mode === 'exterior' ? [] : [clipPlanes[this.mode]]
      this.aoPass.normalMaterial.needsUpdate = true
    }
    const showPins = this.showPins !== false
    for (const l of this.roomLabels) {
      l.visible = l.userData.level === this.mode || (this.mode === 'exterior' && !!roomById[l.userData.id]?.outdoor)
      l.element.classList.toggle('active', this.selection?.kind === 'room' && this.selection.id === l.userData.id)
    }
    for (const p of this.itemPins) {
      p.visible = showPins && modeOf(p.userData.level) === this.mode
      p.element.classList.toggle('active', this.selection?.kind === 'item' && this.selection.id === p.userData.id)
    }
    for (const r of this.house.roomMeshes) {
      r.highlight.visible = this.selection?.kind === 'room' && this.selection.id === r.id
    }
    this.updateFurnitureOutline()
    this.measure?.updateVisibility()
    this.dirty = true
  }

  select(selection, { fly = true } = {}) {
    this.selection = selection
    if (selection) {
      const level =
        selection.kind === 'room' ? roomById[selection.id]?.level
        : selection.kind === 'furniture' ? this.furnitureLevel(selection.id)
        : itemById[selection.id]?.level
      const stayOutside = this.mode === 'exterior' && selection.kind === 'room' && roomById[selection.id]?.outdoor
      if (level && modeOf(level) !== this.mode && !stayOutside) {
        this.mode = modeOf(level)
      }
    }
    this.applyMode()
    // Furniture is being edited in place: keep the camera still
    if (selection && fly && selection.kind !== 'furniture') this.frameSelection()
  }

  // ------------------------------------------------------------ measuring

  // Tape measure mode: clicks place measuring points instead of selecting.
  // Turning it off clears the unsaved measurements.
  setMeasureMode(on) {
    if (on === this.measuring) return
    this.measuring = on
    if (!on) this.measure.clear()
    this.renderer.domElement.classList.toggle('measuring', on)
    this.dirty = true
  }

  // Viewers who can't edit still measure, but can't save, move furniture or
  // change saved measurements
  setEditable(on) {
    if (on === this.editable) return
    this.editable = on
    this.measure.refreshAll()
  }

  // Saved measurements from the app (each shows in the view it was taken in)
  setSavedMeasurements(list) {
    this.measure.setSaved(list)
  }

  // Frame a saved measurement (the app switches to its view first)
  focusMeasurement(id) {
    const e = this.measure.find(id)
    if (!e) return
    this.measure.open(e)
    const center = e.a.clone().add(e.b).multiplyScalar(0.5)
    const radius = e.a.distanceTo(e.b) * 0.7 + 6
    const pos = center.clone().addScaledVector(this.viewDir(0.6), this.viewDistance(radius))
    this.flyTo(pos, center, true)
  }

  // ------------------------------------------------------------ Maya model

  // Swap the generated geometry for the FBX from Maya. Its top groups match the
  // app's: B, L1, L2 (cut away floor by floor), roof, site, utilities, trees.
  // The forest on the neighboring lots stays generated.
  useMayaModel({ fbx, woods, extras }) {
    const h = this.house
    const targets = {
      B: [h.levelGroups.B, 'B'],
      L1: [h.levelGroups.L1, 'L1'],
      L2: [h.levelGroups.L2, 'L2'],
      roof: [h.roofGroup, null],
      site: [h.siteGroup, null],
      utilities: [h.utilitiesGroup, null],
      trees: [h.woodsGroup, null],
    }
    const found = Object.keys(targets).filter((name) => fbx.getObjectByName(name))
    const oldMats = new Set() // the plans model's materials, freed once replaced
    if (!found.includes('L1')) {
      console.warn('Maya model has no L1 group; keeping the house from the plans')
      return
    }
    for (const name of found) {
      const [group] = targets[name]
      // the woods group keeps its generated forest (unnamed parts)
      const old = group.children.filter((o) => name !== 'trees' || o.userData.part)
      for (const o of old) {
        group.remove(o)
        o.traverse((c) => {
          c.geometry?.dispose()
          for (const m of [c.material].flat()) if (m) oldMats.add(m)
        })
      }
    }
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
    const mats = new Map()
    const material = (m, level) => {
      const key = m.uuid + (level ?? '')
      if (!mats.has(key)) mats.set(key, appMaterial(m, extras, level ? h.clipPlanes[level] : null, { onBaked: () => (this.dirty = true) }))
      return mats.get(key)
    }
    const roomMeshes = []
    fbx.updateMatrixWorld(true)
    for (const name of found) {
      const [group, level] = targets[name]
      const node = fbx.getObjectByName(name)
      for (const child of [...node.children]) {
        child.traverse((o) => {
          if (!o.isMesh) return
          fixVertexColors(o.geometry)
          o.material = Array.isArray(o.material) ? o.material.map((m) => material(m, level)) : material(o.material, level)
          o.castShadow = !(Array.isArray(o.material) ? o.material : [o.material]).every((m) => m.transparent && m.opacity < 0.6)
          o.receiveShadow = true
          if (level && o.name.startsWith('room_')) {
            // room_<id>, or room_<id>1 after Maya renames a copy
            const raw = o.name.slice(5)
            const id = roomById[raw] ? raw : roomById[raw.replace(/\d+$/, '')] ? raw.replace(/\d+$/, '') : null
            if (!id) return
            o.userData = { kind: 'room', id }
            roomMeshes.push({ id, level, floor: o })
          }
        })
        // keep the world placement Maya gave it
        child.matrixWorld.decompose(child.position, child.quaternion, child.scale)
        group.add(child)
      }
    }
    // selection highlights, added after the material swap so they stay unlit
    for (const r of roomMeshes) {
      const hl = new THREE.Mesh(r.floor.geometry, highlightMat)
      hl.position.y = 0.04
      hl.visible = false
      hl.renderOrder = 2
      r.floor.add(hl)
      r.highlight = hl
    }
    if (roomMeshes.length) h.roomMeshes = roomMeshes

    // The woods from Maya replace the generated forest (the leaf litter stays)
    if (woods) {
      for (const o of h.woodsGroup.children.filter((c) => c.userData.forest)) {
        h.woodsGroup.remove(o)
        o.geometry?.dispose()
        for (const m of [o.material].flat()) if (m) oldMats.add(m)
      }
      woods.updateMatrixWorld(true)
      const trees = []
      woods.traverse((o) => o.isMesh && trees.push(o))
      for (const o of trees) {
        fixVertexColors(o.geometry)
        o.material = Array.isArray(o.material) ? o.material.map((m) => material(m, null)) : material(o.material, null)
        // receive only, like the generated woods (see buildForest)
        o.castShadow = false
        o.receiveShadow = true
        o.matrixWorld.decompose(o.position, o.quaternion, o.scale)
        h.woodsGroup.add(o)
      }
    }
    this.freeUnused(oldMats)
    this.usingMaya = true
    this.setFurniture(this.furniture, this.showFurniture)
    this.applyMode()
  }

  // Free the GPU copies of replaced materials and their textures (anything
  // still drawn by the scene is kept)
  freeUnused(mats) {
    const inUse = new Set()
    this.scene.traverse((o) => {
      for (const m of [o.material].flat()) if (m) inUse.add(m)
    })
    const usedTex = new Set()
    for (const m of inUse) for (const v of Object.values(m)) if (v?.isTexture) usedTex.add(v)
    for (const m of mats) {
      if (inUse.has(m)) continue
      for (const v of Object.values(m)) if (v?.isTexture && !usedTex.has(v)) v.dispose()
      m.dispose()
    }
  }

  // ------------------------------------------------------------ furniture

  furnitureLevel(id) {
    return this.furniture.find((f) => f.id === id)?.level
  }

  furnitureMat(level, color) {
    const key = level + color
    if (!this.furnitureMats.has(key)) {
      this.furnitureMats.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide, clippingPlanes: [this.house.clipPlanes[level]] }),
      )
    }
    return this.furnitureMats.get(key)
  }

  setFurniture(list, show = true) {
    this.furniture = list
    this.showFurniture = show
    for (const g of this.furnitureGroups.values()) {
      g.parent?.remove(g)
      g.traverse((o) => o.geometry?.dispose())
    }
    this.furnitureGroups.clear()
    for (const f of list) {
      const lvl = levelById[f.level]
      if (!lvl) continue
      const g = buildFurniturePiece(f, (color) => this.furnitureMat(f.level, color))
      g.position.y = lvl.floor
      g.visible = show
      g.traverse((o) => {
        if (o.isMesh) o.userData.furnitureId = f.id
      })
      this.house.levelGroups[f.level].add(g)
      this.furnitureGroups.set(f.id, g)
    }
    this.updateFurnitureOutline()
    this.dirty = true
  }

  // Orange box around the selected piece
  updateFurnitureOutline() {
    if (this.outline) {
      this.outline.parent?.remove(this.outline)
      this.outline = null
    }
    const s = this.selection
    const g = s?.kind === 'furniture' && this.showFurniture ? this.furnitureGroups.get(s.id) : null
    if (!g) return
    g.updateMatrixWorld(true)
    this.outline = new THREE.Box3Helper(new THREE.Box3().setFromObject(g).expandByScalar(0.08), 0xff8a1f)
    this.scene.add(this.outline)
    this.dirty = true
  }

  // ------------------------------------------------------------ camera

  viewDistance(radius) {
    const vfov = THREE.MathUtils.degToRad(this.camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect)
    // Portrait phones need the whole width in view, so they get less crop.
    return Math.max(radius / Math.tan(vfov / 2), radius / Math.tan(hfov / 2)) * (this.camera.aspect < 1 ? 1 : 0.85)
  }

  homeView(animate = true) {
    const dir = new THREE.Vector3(-0.42, 0.42, 0.8).normalize()
    const target = CENTER.clone()
    const pos = target.clone().addScaledVector(dir, this.viewDistance(36))
    this.flyTo(pos, target, animate)
  }

  topView(animate = true) {
    // Outside, the top view is a site plan of the whole lot, like the survey
    const { lot } = SITE
    const f =
      this.mode === 'exterior'
        ? { cx: (lot.x0 + lot.x1) / 2, cz: (lot.y0 + lot.y1) / 2 - 4, r: 99, y: 0 }
        : { ...LEVEL_FRAME[this.mode], y: levelById[this.mode].floor }
    const target = new THREE.Vector3(f.cx, f.y, f.cz)
    const pos = target.clone().add(new THREE.Vector3(0, this.viewDistance(f.r), 0.01))
    this.flyTo(pos, target, animate)
  }

  // Direction from target to camera, raised to at least minY (portrait phones look down more).
  viewDir(minY) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    const y = Math.max(dir.y, this.camera.aspect < 1 ? Math.max(minY, 0.8) : minY)
    const h = Math.hypot(dir.x, dir.z) || 1
    const k = Math.sqrt(1 - y * y) / h
    return new THREE.Vector3(dir.x * k, y, dir.z * k)
  }

  frameMode() {
    if (this.mode === 'exterior') return this.homeView()
    const f = LEVEL_FRAME[this.mode]
    const target = new THREE.Vector3(f.cx, levelById[this.mode].floor, f.cz)
    const pos = target.clone().addScaledVector(this.viewDir(0.55), this.viewDistance(f.r))
    this.flyTo(pos, target, true)
  }

  frameSelection() {
    const s = this.selection
    let center
    let radius
    if (s.kind === 'room') {
      const room = roomById[s.id]
      const xs = room.poly.map((p) => p[0])
      const ys = room.poly.map((p) => p[1])
      center = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, roomFloor(room), (Math.min(...ys) + Math.max(...ys)) / 2)
      radius = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.8 + 9
    } else {
      const item = itemById[s.id]
      if (item.focus) {
        // Lot features frame an area rather than a point
        const [fx, fy] = item.focus.at
        center = new THREE.Vector3(fx, gradeAt(fy), fy)
        radius = item.focus.r
      } else {
        center = new THREE.Vector3(item.at[0], (item.floor ?? levelById[item.level].floor) + 1, item.at[1])
        radius = 15
      }
    }
    const pos = center.clone().addScaledVector(this.viewDir(0.6), this.viewDistance(radius))
    this.flyTo(pos, center, true)
  }

  flyTo(pos, target, animate) {
    if (!animate) {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.controls.update()
      this.dirty = true
      return
    }
    this.tween = {
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: pos,
      t1: target,
      start: performance.now(),
      dur: 700,
    }
  }

  stepTween(now) {
    const tw = this.tween
    if (!tw) return
    let k = Math.min(1, (now - tw.start) / tw.dur)
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
    this.camera.position.lerpVectors(tw.p0, tw.p1, e)
    this.controls.target.lerpVectors(tw.t0, tw.t1, e)
    this.dirty = true
    if (k >= 1) this.tween = null
  }

  // ------------------------------------------------------------ picking

  attachPicking() {
    const el = this.renderer.domElement
    this.onKey = (e) => {
      if (e.key === 'Escape' && this.measuring) this.measure.cancel()
    }
    window.addEventListener('keydown', this.onKey)
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const point = new THREE.Vector3()
    const aim = (e) => {
      const rect = el.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, this.camera)
    }
    const furnitureUnder = () => {
      if (this.mode === 'exterior' || !this.showFurniture) return null
      const meshes = []
      for (const [id, g] of this.furnitureGroups) {
        if (this.furnitureLevel(id) === this.mode) g.traverse((o) => o.isMesh && meshes.push(o))
      }
      return ray.intersectObjects(meshes, false)[0]?.object.userData.furnitureId ?? null
    }
    let down = null
    let drag = null

    // Capture phase, so pressing on the selected piece of furniture drags it
    // instead of orbiting the camera. Any other piece only gets selected (on
    // click), so moving around the view never moves furniture by accident.
    el.addEventListener(
      'pointerdown',
      (e) => {
        down = { x: e.clientX, y: e.clientY }
        if (this.measuring || !this.editable) return // measuring or view only: no furniture dragging
        aim(e)
        const id = furnitureUnder()
        if (!id || !(this.selection?.kind === 'furniture' && this.selection.id === id)) return
        const g = this.furnitureGroups.get(id)
        floorPlane.constant = -levelById[this.mode].floor
        if (!ray.ray.intersectPlane(floorPlane, point)) return
        drag = { id, g, dx: g.position.x - point.x, dz: g.position.z - point.z, moved: false }
        this.controls.enabled = false
        el.setPointerCapture(e.pointerId)
      },
      { capture: true },
    )
    // live measuring line, at most once a frame
    let hoverEvent = null
    el.addEventListener('pointermove', (e) => {
      if (!drag && e.pointerType === 'mouse' && !e.buttons) {
        if (!hoverEvent) {
          requestAnimationFrame(() => {
            const ev = hoverEvent
            hoverEvent = null
            const rect = el.getBoundingClientRect()
            // a saved measurement's line can be clicked
            const overLine = !(this.measuring && this.measure.first) && this.measure.lineAt(ev.clientX - rect.left, ev.clientY - rect.top, rect)
            el.style.cursor = overLine ? 'pointer' : ''
            if (!this.measuring) return
            const ndcAt = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
            this.measure.hover(ndcAt, rect, ev.shiftKey)
          })
        }
        hoverEvent = e
      }
      if (!drag) return
      if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return
      aim(e)
      if (!ray.ray.intersectPlane(floorPlane, point)) return
      drag.moved = true
      // Snap to the inch; walls stop the piece (it slides along them)
      const f = this.furniture.find((p) => p.id === drag.id)
      const from = { ...f, x: drag.g.position.x, y: drag.g.position.z }
      const to = moveFurniture(from, Math.round((point.x + drag.dx) * 12) / 12, Math.round((point.z + drag.dz) * 12) / 12)
      drag.g.position.x = to.x
      drag.g.position.z = to.y
      this.updateFurnitureOutline()
      this.dirty = true
    })
    el.addEventListener('pointerup', (e) => {
      if (drag) {
        const d = drag
        drag = null
        down = null
        this.controls.enabled = true
        if (d.moved) this.onFurnitureMove?.(d.id, d.g.position.x, d.g.position.z)
        this.onSelect?.({ kind: 'furniture', id: d.id })
        return
      }
      if (!down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > 6) return
      // a saved measurement's thin line opens it (unless a measurement is
      // half placed); any other click closes the open one
      if (!(this.measuring && this.measure.first)) {
        const rect = el.getBoundingClientRect()
        const line = this.measure.lineAt(e.clientX - rect.left, e.clientY - rect.top, rect)
        if (line) {
          this.measure.open(line)
          return
        }
        this.measure.close()
      }
      if (this.measuring) {
        aim(e)
        this.measure.click(ndc, el.getBoundingClientRect(), e.shiftKey)
        return
      }
      if (this.mode === 'exterior') return
      aim(e)
      // a click on furniture selects it (then it can be dragged)
      const piece = furnitureUnder()
      if (piece) {
        this.onSelect?.({ kind: 'furniture', id: piece })
        return
      }
      const targets = this.house.roomMeshes.filter((r) => r.level === this.mode).map((r) => r.floor)
      const hit = ray.intersectObjects(targets, false)[0]
      this.onSelect?.(hit ? { kind: 'room', id: hit.object.userData.id } : null)
    })
  }

  // Screen space covered by overlays (phone header, bottom sheet). The view is
  // shifted so the orbit target sits in the middle of what is still visible.
  setInsets({ top = 0, bottom = 0 } = {}) {
    this.insets = { top, bottom }
    this.resize()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    const { top = 0, bottom = 0 } = this.insets ?? {}
    const shift = Math.round((bottom - top) / 2)
    if (shift) this.camera.setViewOffset(w, h, 0, shift, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.measure?.setResolution(w, h)
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio())
      this.composer.setSize(w, h)
    }
    this.labelRenderer.setSize(w, h)
    this.dirty = true
  }

  dispose() {
    this.disposed = true
    window.removeEventListener('keydown', this.onKey)
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.composer?.dispose()
    this.aoPass?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss() // hand the GPU memory back now
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
    })
    this.renderer.domElement.remove()
    this.labelRenderer.domElement.remove()
  }
}
