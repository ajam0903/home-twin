// Measurements the owner saved: [{ id, a: [x, y, z], b: [x, y, z], view, name }],
// in three.js feet (view: 'exterior' or a floor id). Saved in this browser,
// like the furniture layout and the notes.

const KEY = 'homeTwin.measurements.v1'

export function loadMeasurements() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(saved) ? saved.filter((m) => m && Array.isArray(m.a) && Array.isArray(m.b) && m.view) : []
  } catch {
    return []
  }
}

export function saveMeasurements(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage unavailable: saved measurements last for this session only
  }
}

export const measuredLength = (m) => Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1], m.b[2] - m.a[2])
