import * as THREE from 'three'
import { buildHouse } from './buildHouse.js'

// Dev-only: export the house as it is built from the plans, for Maya.
// Each named part (a wall, a window, a room floor, the deck, a plant...)
// becomes one mesh with world-space vertices, per-face materials, normals,
// UVs (texture repeats baked in) and vertex colors. The dev server writes
// maya/export/scene.json, scene.bin and textures/*.png, and
// tools/maya/build_scene.py turns those into the Maya scene and the FBX.
// The woods on the neighboring lots are left out: the app keeps drawing them.

const GROUPS = (house) => [
  ['B', house.levelGroups.B],
  ['L1', house.levelGroups.L1],
  ['L2', house.levelGroups.L2],
  ['roof', house.roofGroup],
  ['site', house.siteGroup],
  ['utilities', house.utilitiesGroup],
  ['trees', house.woodsGroup],
]

export async function exportForMaya({ onStatus = () => {} } = {}) {
  onStatus('Building the house from the plans...')
  const house = buildHouse({ lowDetail: false })
  house.root.updateMatrixWorld(true)

  // ---------------------------------------------------------- materials
  const materials = []
  const matBySig = new Map()
  const textures = new Map() // texture -> name
  const texName = (t, fallback) => {
    if (!t) return null
    if (!textures.has(t)) textures.set(t, t.name || `${fallback}_${textures.size + 1}`)
    return textures.get(t)
  }
  const hex = (c) => '#' + c.getHexString()
  const materialIndex = (m) => {
    const props = {
      color: hex(m.color ?? new THREE.Color(1, 1, 1)),
      map: texName(m.map, 'texture'),
      bump: texName(m.bumpMap, 'bump'),
      bumpScale: m.bumpMap ? m.bumpScale : 0,
      roughness: m.roughness ?? 0.8,
      metalness: m.metalness ?? 0,
      opacity: m.opacity ?? 1,
      transparent: !!m.transparent,
      alphaTest: m.alphaTest ?? 0,
      vertexColors: !!m.vertexColors,
      emissive: m.emissive ? hex(m.emissive) : '#000000',
      emissiveIntensity: m.emissiveIntensity ?? 0,
    }
    const sig = JSON.stringify(props)
    if (!matBySig.has(sig)) {
      const base = props.map ?? (props.vertexColors ? 'foliage' : `color_${props.color.slice(1)}`)
      let name = `mat_${base}${props.opacity < 1 ? '_glass' : ''}`
      if (materials.some((x) => x.name === name)) name += `_${materials.length + 1}`
      matBySig.set(sig, materials.length)
      materials.push({ name, ...props, repeat: m.map ? [m.map.repeat.x, m.map.repeat.y] : [1, 1] })
    }
    return matBySig.get(sig)
  }

  // ---------------------------------------------------------- parts
  // { group, name, kind, sources: [{ mesh, instance }] } in build order
  const parts = new Map()
  for (const [groupName, group] of GROUPS(house)) {
    group.traverse((o) => {
      if (!o.isMesh || o.userData.appOnly) return
      const list = o.isInstancedMesh
        ? Array.from({ length: o.count }, (_, i) => [o.userData.instanceParts?.[i], i])
        : [[o.userData.part, null]]
      for (const [part, instance] of list) {
        // the woods group: only the named trees (the forest stays in the app)
        if (!part && groupName === 'trees') continue
        const name = part?.name ?? `${groupName}_misc`
        const key = `${groupName}/${name}`
        if (!parts.has(key)) parts.set(key, { group: groupName, name, kind: part?.kind ?? 'part', sources: [] })
        parts.get(key).sources.push({ mesh: o, instance })
      }
    })
  }

  // Names used in more than one group get the group in front (B_stairs,
  // L1_stairs), so every name in the Maya scene is unique
  const groupsOfName = new Map()
  for (const p of parts.values()) groupsOfName.set(p.name, (groupsOfName.get(p.name) ?? 0) + 1)
  for (const p of parts.values()) {
    if (groupsOfName.get(p.name) > 1 && !p.name.startsWith(`${p.group}_`)) p.name = `${p.group}_${p.name}`
  }

  // ---------------------------------------------------------- geometry
  const chunks = []
  let offset = 0
  const put = (typed) => {
    const at = offset
    chunks.push(typed)
    offset += typed.byteLength
    return at
  }
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const im = new THREE.Matrix4()
  const world = new THREE.Matrix4()
  const nm = new THREE.Matrix3()
  const ic = new THREE.Color()
  const groups = new Map()
  let triTotal = 0

  for (const part of parts.values()) {
    const pos = []
    const nor = []
    const uvs = []
    const cols = []
    const idx = []
    const faceMat = []
    const mats = [] // global material indices used by this mesh
    let anyUV = false
    let anyColor = false
    for (const { mesh, instance } of part.sources) {
      const geo = mesh.geometry
      const P = geo.attributes.position
      if (!P) continue
      const N = geo.attributes.normal
      const UV = geo.attributes.uv
      const C = geo.attributes.color
      world.copy(mesh.matrixWorld)
      if (instance != null) {
        mesh.getMatrixAt(instance, im)
        world.multiply(im)
        if (mesh.instanceColor) mesh.getColorAt(instance, ic)
        else ic.setRGB(1, 1, 1)
      } else ic.setRGB(1, 1, 1)
      nm.getNormalMatrix(world)
      const base = pos.length / 3
      // per-vertex material (for the UV repeat), from the geometry groups
      const meshMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const vertMat = new Int32Array(P.count).fill(0)
      const index = geo.index ? geo.index.array : Array.from({ length: P.count }, (_, i) => i)
      const groupsOf = geo.groups.length ? geo.groups : [{ start: 0, count: index.length, materialIndex: 0 }]
      for (const g of groupsOf) {
        for (let k = g.start; k < g.start + g.count; k++) vertMat[index[k]] = g.materialIndex ?? 0
      }
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(world)
        pos.push(v.x, v.y, v.z)
        if (N) n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize()
        else n.set(0, 1, 0)
        nor.push(n.x, n.y, n.z)
        if (UV) {
          anyUV = true
          const rep = meshMats[vertMat[i]]?.map?.repeat
          uvs.push(UV.getX(i) * (rep?.x ?? 1), UV.getY(i) * (rep?.y ?? 1))
        } else uvs.push(0, 0)
        if (C || instance != null) {
          anyColor = anyColor || !!C || !!mesh.instanceColor
          const r = C ? C.getX(i) : 1
          const g = C ? C.getY(i) : 1
          const b = C ? C.getZ(i) : 1
          cols.push(r * ic.r, g * ic.g, b * ic.b)
        } else cols.push(1, 1, 1)
      }
      for (const g of groupsOf) {
        const gm = materialIndex(meshMats[g.materialIndex ?? 0] ?? meshMats[0])
        let local = mats.indexOf(gm)
        if (local < 0) local = mats.push(gm) - 1
        for (let k = g.start; k + 2 < g.start + g.count; k += 3) {
          idx.push(base + index[k], base + index[k + 1], base + index[k + 2])
          faceMat.push(local)
        }
      }
    }
    if (!idx.length) continue
    triTotal += idx.length / 3
    const mesh = {
      name: part.name,
      kind: part.kind,
      vertexCount: pos.length / 3,
      triCount: idx.length / 3,
      positions: put(new Float32Array(pos)),
      normals: put(new Float32Array(nor)),
      uvs: anyUV ? put(new Float32Array(uvs)) : null,
      colors: anyColor ? put(new Float32Array(cols)) : null,
      indices: put(new Uint32Array(idx)),
      faceMaterials: put(new Uint32Array(faceMat)),
      materials: mats,
    }
    if (!groups.has(part.group)) groups.set(part.group, [])
    groups.get(part.group).push(mesh)
  }

  const bin = new Uint8Array(offset)
  let at = 0
  for (const c of chunks) {
    bin.set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength), at)
    at += c.byteLength
  }
  const manifest = {
    version: 1,
    note: 'Home Twin export. 1 unit = 1 foot. x left to right, y up, z from the back of the house toward the street.',
    groups: [...groups].map(([name, meshes]) => ({ name, meshes })),
    materials,
    textures: [...textures.values()].map((name) => ({ name, file: `textures/${name}.png` })),
  }

  // ---------------------------------------------------------- upload
  const send = async (file, body, type) => {
    const res = await fetch(`/__maya/export?file=${encodeURIComponent(file)}`, {
      method: 'POST',
      headers: { 'content-type': type, 'x-home-twin': '1' },
      body,
    })
    if (!res.ok) throw new Error(`${file}: ${res.status} ${await res.text()}`)
  }
  onStatus(`Writing ${parts.size} parts, ${triTotal.toLocaleString()} triangles...`)
  await send('scene.bin', bin, 'application/octet-stream')
  for (const [tex, name] of textures) {
    const canvas = tex.image
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    await send(`textures/${name}.png`, blob, 'image/png')
  }
  await send('scene.json', JSON.stringify(manifest), 'application/json')
  house.root.traverse((o) => o.geometry?.dispose())
  const summary = { parts: parts.size, meshes: [...groups.values()].reduce((s, g) => s + g.length, 0), triangles: triTotal, materials: materials.length, textures: textures.size, bytes: offset }
  onStatus(`Exported ${summary.meshes} meshes (${summary.triangles.toLocaleString()} triangles) to maya/export`)
  return summary
}
