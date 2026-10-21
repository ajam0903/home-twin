// The owner's own notes, by room ('room:kitchen' -> text). Saved in this
// browser, like the furniture layout, until the app has a backend.

const KEY = 'homeTwin.notes.v1'

export function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}

export function saveNotes(notes) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes))
  } catch {
    // storage unavailable: notes last for this session only
  }
}

export const roomNoteKey = (id) => `room:${id}`
