// Measurements the owner saved: [{ id, a: [x, y, z], b: [x, y, z], view, name }],
// in three.js feet (view: 'exterior' or a floor id). Shared (model/shared.js),
// with a copy in this browser, like the furniture layout and the notes.

const KEY = 'homeTwin.measurements.v1'

export function loadMeasurements() {
  try {
    return cleanMeasurements(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return []
  }
}

export const cleanMeasurements = (list) =>
  Array.isArray(list) ? list.filter((m) => m && Array.isArray(m.a) && Array.isArray(m.b) && m.view) : []

export function saveMeasurements(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage unavailable: saved measurements last for this session only
  }
}

export const measuredLength = (m) => Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1], m.b[2] - m.a[2])
