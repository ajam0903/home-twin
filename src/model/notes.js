// The owner's own notes, by room: 'room:kitchen' -> [{ id, text, at }], each
// note its own item (at: when it was added, ms). Shared (model/shared.js),
// with a copy in this browser.

const KEY = 'homeTwin.notes.v1'

export function loadNotes() {
  try {
    return cleanNotes(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return {}
  }
}

// Notes saved before they were separate items were one text per room: each
// becomes a single item
export function cleanNotes(notes) {
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return {}
  const out = {}
  for (const [key, value] of Object.entries(notes)) {
    const list =
      typeof value === 'string'
        ? value.trim() ? [{ id: `n-${key}`, text: value.trim(), at: 0 }] : []
        : Array.isArray(value) ? value.filter((n) => n && typeof n.text === 'string' && n.id) : []
    if (list.length) out[key] = list
  }
  return out
}

// The text of a room's notes, for search
export const notesText = (list = []) => list.map((n) => n.text).join(' ')

export function saveNotes(notes) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes))
  } catch {
    // storage unavailable: notes last for this session only
  }
}

export const roomNoteKey = (id) => `room:${id}`
