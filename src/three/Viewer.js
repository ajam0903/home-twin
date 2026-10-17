import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { buildHouse } from './buildHouse.js'
import {
  ROOMS, ITEMS, SITE, levelById, roomById, itemById, roomFloor, roomLabelPoint, polyArea, gradeAt,
} from '../model/house.js'

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
const CATEGORY_GLYPH = { HVAC: 'H', Plumbing: 'P', Electrical: 'E', Safety: 'S', Structure: 'B', Appliances: 'A', Site: 'L', Landscape: 'T' }

export class Viewer {
  constructor(container, { onSelect } = {}) {
    this.container = container
    this.onSelect = onSelect
    this.mode = 'exterior'
    this.cut = true
    this.selection = null
    this.tween = null
    this.dirty = true

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.localClippingEnabled = true
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    container.appendChild(renderer.domElement)
    this.renderer = renderer

    const labels = new CSS2DRenderer()
    labels.domElement.className = 'label-layer'
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
    this.compassEl = compass

    const scene = new THREE.Scene()
    this.scene = scene
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1000)
    this.camera = camera

    scene.add(new THREE.HemisphereLight('#f4f7ff', '#8a8370', 1.35))
    const sun = new THREE.DirectionalLight('#fff6e8', 2.1)
    sun.position.set(-30, 110, 55)
    sun.target.position.copy(CENTER)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const sc = sun.shadow.camera
    sc.left = -55
    sc.right = 55
    sc.top = 55
    sc.bottom = -55
    sc.near = 10
    sc.far = 220
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.04
    scene.add(sun, sun.target)

    const house = buildHouse()
    this.house = house
    scene.add(house.root)

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
    this.attachPicking()

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
        renderer.render(scene, camera)
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
    for (const l of this.siteLabels) l.visible = this.mode === 'exterior'
    if (this.mode !== 'exterior' && this.cut) {
      clipPlanes[this.mode].constant = levelById[this.mode].floor + CUT_HEIGHT
    }
    const showPins = this.showPins !== false
    for (const l of this.roomLabels) {
      l.visible = l.userData.level === this.mode
      l.element.classList.toggle('active', this.selection?.kind === 'room' && this.selection.id === l.userData.id)
    }
    for (const p of this.itemPins) {
      p.visible = showPins && modeOf(p.userData.level) === this.mode
      p.element.classList.toggle('active', this.selection?.kind === 'item' && this.selection.id === p.userData.id)
    }
    for (const r of this.house.roomMeshes) {
      r.highlight.visible = this.selection?.kind === 'room' && this.selection.id === r.id
    }
    this.dirty = true
  }

  select(selection, { fly = true } = {}) {
    this.selection = selection
    if (selection) {
      const level = selection.kind === 'room' ? roomById[selection.id]?.level : itemById[selection.id]?.level
      if (level && modeOf(level) !== this.mode) {
        this.mode = modeOf(level)
      }
    }
    this.applyMode()
    if (selection && fly) this.frameSelection()
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
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let down = null
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY }
    })
    el.addEventListener('pointerup', (e) => {
      if (!down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > 6 || this.mode === 'exterior') return
      const rect = el.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, this.camera)
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
    this.labelRenderer.setSize(w, h)
    this.dirty = true
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
    })
    this.renderer.domElement.remove()
    this.labelRenderer.domElement.remove()
  }
}
