// The owner's own notes, by room ('room:kitchen' -> text). Shared
// (model/shared.js), with a copy in this browser.

const KEY = 'homeTwin.notes.v1'

export function loadNotes() {
  try {
    return cleanNotes(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return {}
  }
}

export const cleanNotes = (notes) => (notes && typeof notes === 'object' && !Array.isArray(notes) ? notes : {})

export function saveNotes(notes) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes))
  } catch {
    // storage unavailable: notes last for this session only
  }
}

export const roomNoteKey = (id) => `room:${id}`
