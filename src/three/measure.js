import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

// Tape measure for the 3D view: pick two points on any visible surface and
// get the distance in feet and inches (and total inches). Points snap to a
// corner of the surface under the pointer when one is close on screen, and
// can be dragged afterwards. Shift keeps a point square to the other one (one
// axis). A saved measurement is a thin line until it is clicked.

const SNAP_PX = 12
const LINE_HIT_PX = 10

// 12'-4 1/2" (to the nearest quarter inch)
export function feetInchesText(feet) {
  const quarters = Math.round(Math.abs(feet) * 48)
  let ft = Math.floor(quarters / 48)
  let rest = quarters - ft * 48
  let inch = Math.floor(rest / 4)
  const q = rest % 4
  if (inch === 12) {
    ft += 1
    inch = 0
  }
  const frac = q === 0 ? '' : q === 2 ? ' 1/2' : ` ${q}/4`
  return `${feet < 0 ? '-' : ''}${ft}'-${inch}${frac}"`
}

// 148 1/2 inches (total inches, to the nearest quarter inch), spelled out so
// it reads as inches next to the feet and inches above it
export function inchesText(feet) {
  const quarters = Math.round(Math.abs(feet) * 48)
  const inch = Math.floor(quarters / 4)
  const q = quarters % 4
  const frac = q === 0 ? '' : q === 2 ? ' 1/2' : ` ${q}/4`
  return `${inch.toLocaleString()}${frac} ${quarters === 4 ? 'inch' : 'inches'}`
}

export class Measure {
  constructor(viewer) {
    this.v = viewer
    this.done = [] // { id, a, b, view, saved, name, open, dots, line, label }
    this.first = null // { point, snapped, dot }
    this.preview = null // { line, label }
    this.openId = null // the saved measurement showing its points and label
    this.raycaster = new THREE.Raycaster()
    // a 3 px line, drawn over everything (plain WebGL lines are 1 px); saved
    // measurements are a thin line until opened
    this.lineMat = new LineMaterial({ color: 0xff8a1f, linewidth: 3, depthTest: false, transparent: true })
    this.thinMat = new LineMaterial({ color: 0xff8a1f, linewidth: 1.5, depthTest: false, transparent: true, opacity: 0.9 })
  }

  setResolution(w, h) {
    this.lineMat.resolution.set(w, h)
    this.thinMat.resolution.set(w, h)
  }

  // ------------------------------------------------------------ picking

  // The surface point under the pointer (with snapping), or null
  pick(ndc, rect) {
    const v = this.v
    const ray = this.raycaster
    ray.setFromCamera(ndc, v.camera)
    const cut = v.mode !== 'exterior' && v.cut ? v.house.clipPlanes[v.mode].constant : Infinity
    const targets = [v.house.root, ...v.furnitureGroups.values()]
    const shown = (o) => {
      for (let p = o; p; p = p.parent) {
        if (!p.visible) return false
        if (p === v.house.woodsGroup) return false // the neighbors' woods: not part of the house
      }
      return true
    }
    for (const hit of ray.intersectObjects(targets, true)) {
      const o = hit.object
      if (!o.isMesh || !hit.face || !shown(o) || hit.point.y > cut + 0.01) continue
      return this.snap(hit, rect)
    }
    return null
  }

  // Move the point to the nearest corner of the hit triangle when that corner
  // is within a few pixels on screen
  snap(hit, rect) {
    const o = hit.object
    const pos = o.geometry.attributes.position
    const m = new THREE.Matrix4().copy(o.matrixWorld)
    if (o.isInstancedMesh && hit.instanceId != null) {
      const im = new THREE.Matrix4()
      o.getMatrixAt(hit.instanceId, im)
      m.multiply(im)
    }
    const toScreen = (p) => {
      const s = p.clone().project(this.v.camera)
      return new THREE.Vector2(((s.x + 1) / 2) * rect.width, ((1 - s.y) / 2) * rect.height)
    }
    const at = toScreen(hit.point)
    let best = null
    let bestD = SNAP_PX
    for (const i of [hit.face.a, hit.face.b, hit.face.c]) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m)
      const d = toScreen(p).distanceTo(at)
      if (d < bestD) [best, bestD] = [p, d]
    }
    return { point: best ?? hit.point.clone(), snapped: !!best }
  }

  // Shift: keep the second point square to the first, along its biggest axis
  constrain(a, b) {
    const d = b.clone().sub(a)
    const ax = ['x', 'y', 'z'].reduce((m, k) => (Math.abs(d[k]) > Math.abs(d[m]) ? k : m), 'x')
    const out = a.clone()
    out[ax] = b[ax]
    return out
  }

  // ------------------------------------------------------------ drawing

  // A point; on a finished measurement it can be dragged to adjust it
  dot(point, snapped, entry = null, end = null) {
    const el = document.createElement('div')
    el.className = 'measure-dot' + (snapped ? ' snapped' : '') + (entry ? ' handle' : '')
    const obj = new CSS2DObject(el)
    obj.position.copy(point)
    obj.renderOrder = 10 // over the room and plant labels
    this.v.scene.add(obj)
    if (entry) this.makeDraggable(obj, entry, end)
    return obj
  }

  line(a, b, mat = this.lineMat) {
    const geo = new LineGeometry()
    geo.setPositions([a.x, a.y, a.z, b.x, b.y, b.z])
    const line = new Line2(geo, mat)
    line.renderOrder = 20
    line.frustumCulled = false
    this.v.scene.add(line)
    return line
  }

  // The label: the name (when saved and named), then the length in feet and
  // inches over the total inches; Save and remove buttons
  label(a, b, entry = null) {
    const el = document.createElement('div')
    el.className = 'measure-label'
    const obj = new CSS2DObject(el)
    obj.renderOrder = 11
    this.setLabel(obj, a, b, entry)
    this.v.scene.add(obj)
    return obj
  }

  setLabel(obj, a, b, entry = null) {
    const len = a.distanceTo(b)
    const el = obj.element
    el.replaceChildren()
    el.classList.toggle('saved', !!entry?.saved)
    const text = document.createElement('div')
    text.className = 'ml-text'
    const add = (tag, cls, value) => {
      const node = document.createElement(tag)
      if (cls) node.className = cls
      node.textContent = value
      text.appendChild(node)
    }
    if (entry?.saved && entry.name) add('div', 'ml-name', entry.name)
    add('strong', null, feetInchesText(len))
    add('em', null, inchesText(len))
    el.appendChild(text)
    if (entry) {
      const actions = document.createElement('div')
      actions.className = 'ml-actions'
      const button = (cls, label, title, onClick) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = cls
        btn.textContent = label
        btn.title = title
        btn.setAttribute('aria-label', title)
        btn.addEventListener('pointerdown', (e) => e.stopPropagation())
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          onClick()
        })
        actions.appendChild(btn)
      }
      const editable = this.v.editable
      if (!entry.saved && editable) button('measure-save', 'Save', 'Save this measurement', () => this.save(entry))
      if (!entry.saved || editable) button('measure-remove', '×', entry.saved ? 'Delete this saved measurement' : 'Remove this measurement', () => this.remove(entry))
      if (actions.children.length) el.appendChild(actions)
    }
    obj.position.copy(a).add(b).multiplyScalar(0.5)
  }

  // Draw a finished measurement and remember it
  addEntry({ id, a, b, view, saved = false, name = '', snappedA = false, snappedB = false }) {
    const entry = { id, a, b, view, saved, name, open: false }
    entry.dots = [this.dot(a, snappedA, entry, 'a'), this.dot(b, snappedB, entry, 'b')]
    entry.line = this.line(a, b, saved ? this.thinMat : this.lineMat)
    entry.label = this.label(a, b, entry)
    entry.objs = [...entry.dots, entry.line, entry.label]
    this.done.push(entry)
    this.showFor(entry)
    this.v.dirty = true
    return entry
  }

  // A measurement belongs to the view it was taken in (whole house or a
  // floor). A saved one is a thin line; opened, it shows its points and label.
  showFor(entry) {
    const here = entry.view === this.v.mode
    const full = here && (!entry.saved || entry.open)
    entry.line.visible = here
    entry.line.material = full ? this.lineMat : this.thinMat
    for (const o of [...entry.dots, entry.label]) o.visible = full
    // saved ones can be dragged only by someone who can edit
    for (const d of entry.dots) d.element.classList.toggle('handle', !entry.saved || this.v.editable)
  }

  // Redraw every label and handle (after the edit permission changed)
  refreshAll() {
    for (const e of this.done) {
      this.setLabel(e.label, e.a, e.b, e)
      this.showFor(e)
    }
    this.v.dirty = true
  }

  updateVisibility() {
    for (const e of this.done) this.showFor(e)
    this.v.dirty = true
  }

  // Keep each label beside its line rather than on it, so the line and its
  // end points stay visible (and can be grabbed): shifted off the midpoint,
  // square to the line as it looks on screen, toward its upper side, by half
  // the label plus a gap. Runs before every label render.
  placeLabels() {
    const canvas = this.v.renderer.domElement
    const W = canvas.clientWidth / 2
    const Hh = canvas.clientHeight / 2
    const cam = this.v.camera
    const pa = new THREE.Vector3()
    const pb = new THREE.Vector3()
    const place = (label, a, b) => {
      if (!label?.visible) return
      const el = label.element
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (!w || !h) return
      pa.copy(a).project(cam)
      pb.copy(b).project(cam)
      const dx = (pb.x - pa.x) * W
      const dy = -(pb.y - pa.y) * Hh // screen y points down
      const len = Math.hypot(dx, dy)
      let nx = 0
      let ny = -1
      if (len > 1) {
        nx = -dy / len
        ny = dx / len
        if (ny > 0) [nx, ny] = [-nx, -ny]
      }
      const d = 0.5 * (Math.abs(nx) * w + Math.abs(ny) * h) + 10
      label.center.set(0.5 - (nx * d) / w, 0.5 - (ny * d) / h)
    }
    for (const e of this.done) place(e.label, e.a, e.b)
    if (this.preview && this.first) place(this.preview.label, this.first.point, this.preview.end ?? this.first.point)
  }

  // Redraw after a point moved
  refresh(entry) {
    const { a, b } = entry
    entry.line.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z])
    entry.dots[0].position.copy(a)
    entry.dots[1].position.copy(b)
    this.setLabel(entry.label, a, b, entry)
    this.v.dirty = true
  }

  // ------------------------------------------------------------ input

  // A click / tap at screen point (ndc in -1..1); `shift` locks to an axis
  click(ndc, rect, shift) {
    const hit = this.pick(ndc, rect)
    if (!hit) return
    if (!this.first) {
      this.first = { point: hit.point, snapped: hit.snapped, dot: this.dot(hit.point, hit.snapped) }
      return
    }
    const a = this.first.point
    const b = shift ? this.constrain(a, hit.point) : hit.point
    this.clearPreview()
    this.v.scene.remove(this.first.dot)
    const id = `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
    this.addEntry({ id, a, b, view: this.v.mode, snappedA: this.first.snapped, snappedB: hit.snapped && !shift })
    this.first = null
  }

  // Pointer moves while the first point is down: a live line to the pointer
  hover(ndc, rect, shift) {
    if (!this.first) return
    const hit = this.pick(ndc, rect)
    if (!hit) return
    const a = this.first.point
    const b = shift ? this.constrain(a, hit.point) : hit.point
    if (!this.preview) {
      this.preview = { line: this.line(a, b), label: this.label(a, b), end: b.clone() }
      this.preview.label.element.classList.add('live')
    } else {
      this.preview.end.copy(b)
      this.preview.line.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z])
      this.setLabel(this.preview.label, a, b)
    }
    this.v.dirty = true
  }

  // Drag a point of a finished measurement over the surfaces (snapping as
  // when placing it; Shift keeps it square to the other point)
  makeDraggable(obj, entry, end) {
    const el = obj.element
    let dragging = false
    el.addEventListener('pointerdown', (e) => {
      if (!el.classList.contains('handle')) return
      e.stopPropagation()
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      dragging = true
      el.classList.add('dragging')
    })
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const rect = this.v.renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      const hit = this.pick(ndc, rect)
      if (!hit) return
      const other = end === 'a' ? entry.b : entry.a
      entry[end].copy(e.shiftKey ? this.constrain(other, hit.point) : hit.point)
      el.classList.toggle('snapped', hit.snapped && !e.shiftKey)
      this.refresh(entry)
    })
    const stop = () => {
      if (!dragging) return
      dragging = false
      el.classList.remove('dragging')
      // a saved measurement keeps its new length
      if (entry.saved) this.save(entry)
    }
    el.addEventListener('pointerup', stop)
    el.addEventListener('pointercancel', stop)
  }

  // The saved measurement whose line passes within a few pixels of a screen
  // point (x, y in px from the view's corner), or null
  lineAt(x, y, rect) {
    const at = new THREE.Vector2(x, y)
    const toScreen = (p) => {
      const s = p.clone().project(this.v.camera)
      return s.z > 1 ? null : new THREE.Vector2(((s.x + 1) / 2) * rect.width, ((1 - s.y) / 2) * rect.height)
    }
    let best = null
    let bestD = LINE_HIT_PX
    for (const e of this.done) {
      if (!e.saved || e.view !== this.v.mode) continue
      const a = toScreen(e.a)
      const b = toScreen(e.b)
      if (!a || !b) continue
      const ab = b.clone().sub(a)
      const t = THREE.MathUtils.clamp(at.clone().sub(a).dot(ab) / (ab.lengthSq() || 1), 0, 1)
      const d = a.clone().addScaledVector(ab, t).distanceTo(at)
      if (d < bestD) [best, bestD] = [e, d]
    }
    return best
  }

  // Show a saved measurement's points and label (one at a time)
  open(entry) {
    this.openId = entry?.id ?? null
    for (const e of this.done) {
      e.open = e === entry
      this.showFor(e)
    }
    this.v.dirty = true
  }

  close() {
    if (this.openId) this.open(null)
  }

  cancel() {
    this.clearPreview()
    if (this.first) {
      this.v.scene.remove(this.first.dot)
      this.first = null
    }
    this.v.dirty = true
  }

  clearPreview() {
    if (!this.preview) return
    this.v.scene.remove(this.preview.line, this.preview.label)
    this.preview.line.geometry.dispose()
    this.preview = null
  }

  // ------------------------------------------------------------ keeping them

  // Save (or a saved one moved): hand it to the app, which stores it and
  // sends the saved list back
  save(entry) {
    this.v.onMeasurementSave?.({ id: entry.id, a: entry.a.toArray(), b: entry.b.toArray(), view: entry.view })
  }

  remove(entry) {
    if (entry.saved) {
      this.v.onMeasurementRemove?.(entry.id)
      return
    }
    this.drop(entry)
  }

  drop(entry) {
    for (const o of entry.objs) {
      this.v.scene.remove(o)
      o.geometry?.dispose()
    }
    this.done = this.done.filter((e) => e !== entry)
    this.v.dirty = true
  }

  // The saved measurements, from the app: [{ id, a, b, view, name }]. A newly
  // saved one turns into a thin line; one that was open stays open.
  setSaved(list) {
    const ids = new Set(list.map((m) => m.id))
    const wasSaved = new Set(this.done.filter((e) => e.saved).map((e) => e.id))
    for (const e of [...this.done]) if (e.saved || ids.has(e.id)) this.drop(e)
    if (!wasSaved.has(this.openId) || !ids.has(this.openId)) this.openId = null
    for (const m of list) {
      const e = this.addEntry({ id: m.id, a: new THREE.Vector3(...m.a), b: new THREE.Vector3(...m.b), view: m.view, saved: true, name: m.name ?? '' })
      if (e.id === this.openId) {
        e.open = true
        this.showFor(e)
      }
    }
  }

  // Unsaved measurements go when the tool is turned off; saved ones stay
  clear() {
    this.cancel()
    for (const e of [...this.done]) if (!e.saved) this.drop(e)
  }

  find(id) {
    return this.done.find((e) => e.id === id)
  }
}
