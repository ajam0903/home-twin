import * as THREE from 'three'

// Bump shading painted into the color texture. The siding laps and shingle
// courses get their shadow lines from a plain texture lookup instead of the
// bump shader, which drew black and crashed the PowerVR GPU in the Pixel 10
// (Oct 2026). The light is fixed like the sun: from above and in front, so
// the bottom edge of each lap or course reads dark and its top catches light.

// Light in the surface's own frame: x along it, y up it, z out of it
const LIGHT = new THREE.Vector3(-0.15, 0.6, 0.79).normalize()
// Height difference (0..1 in the bump image) per pixel, turned into a slope;
// scaled by the material's bumpScale (siding 1.4, shingles 2.2)
const SLOPE = 2.2
const DARKEST = 0.5
const BRIGHTEST = 1.2

const ready = (img) => !!img && img.width > 0 && (img.complete === undefined || img.complete)

// A copy of `map` with the shading of `bumpImage` (same tile) painted in
export function bakedMap(map, bumpImage, strength = 1) {
  const src = map.image
  const w = src.width
  const h = src.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(bumpImage, 0, 0, w, h)
  const hb = g.getImageData(0, 0, w, h).data
  g.drawImage(src, 0, 0, w, h)
  const img = g.getImageData(0, 0, w, h)
  const px = img.data
  // the textures tile, so neighbours wrap around the edges
  const H = (x, y) => hb[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255
  const k = SLOPE * strength
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 0.5 * k
      // row 0 is the top of the image, which is up the surface
      const dy = (H(x, y - 1) - H(x, y + 1)) * 0.5 * k
      // normal (-dx, -dy, 1), lit by LIGHT, relative to a flat surface
      const s = (-dx * LIGHT.x - dy * LIGHT.y + LIGHT.z) / Math.hypot(dx, dy, 1) / LIGHT.z
      const f = Math.min(BRIGHTEST, Math.max(DARKEST, s))
      const i = (y * w + x) * 4
      px[i] = Math.min(255, px[i] * f)
      px[i + 1] = Math.min(255, px[i + 1] * f)
      px[i + 2] = Math.min(255, px[i + 2] * f)
    }
  }
  g.putImageData(img, 0, 0)
  const baked = map.clone() // same wrapping, repeat, color space
  baked.source = new THREE.Source(c)
  baked.needsUpdate = true
  return baked
}

// Each color map is baked once per bump image and strength
const cache = new Map()

// Swap a material's color map for the baked one once both images have
// loaded (the FBX's textures and the bump file arrive on their own time)
export function bakeWhenReady(material, bumpImage, strength, onDone) {
  let tries = 0
  const attempt = () => {
    const map = material.map
    const bump = bumpImage()
    if (map && ready(map.image) && ready(bump)) {
      const key = `${map.uuid}|${bump.src ?? bump.uuid ?? ''}|${strength}`
      if (!cache.has(key)) cache.set(key, bakedMap(map, bump, strength))
      material.map = cache.get(key)
      material.needsUpdate = true
      onDone?.()
    } else if (tries++ < 200) {
      setTimeout(attempt, 100)
    }
  }
  attempt()
}

// The house built from the plans: its siding and shingle materials carry
// a bump map (canvas, ready at once); bake it in and drop it
export function bakeBumpMaps(root) {
  root.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m?.bumpMap || !m.map) continue
      const bump = m.bumpMap.image
      m.bumpMap = null
      bakeWhenReady(m, () => bump, m.bumpScale ?? 1)
    }
  })
}
