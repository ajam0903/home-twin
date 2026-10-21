import { useMemo, useState } from 'react'
import { ROOMS, ITEMS, levelById, roomArea, plantedInfo } from '../model/house.js'
import { FURNITURE_PRESETS, feetInches } from '../model/furniture.js'
import { roomNoteKey, notesText } from '../model/notes.js'
import { Icon } from './Icons.jsx'

// First floor first; the property goes with the whole house.
const ORDER = ['L1', 'L2', 'B', 'site']
const groupName = (id) => (id === 'site' ? 'Property' : levelById[id].name)

export default function RoomList({ selection, onSelect, level, furniture = [], onAddFurniture, notes = {} }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const groups = useMemo(() => {
    const match = (s) => !query || s.toLowerCase().includes(query)
    const shown = level === 'exterior' ? ORDER : [level]
    return shown
      .map((id) => ({
        id,
        // with the whole house, outdoor rooms (the deck) are listed with the property
        rooms: ROOMS.filter((r) => {
          const listed = level === 'exterior' && r.outdoor ? 'site' : r.level
          // the search also looks through your notes for the room
          return listed === id && match(`${r.name} ${r.subtitle ?? ''} ${r.type} ${notesText(notes[roomNoteKey(r.id)])}`)
        }),
        items: ITEMS.filter((i) => i.level === id && match(`${i.name} ${i.category}`)),
        furniture: furniture.filter((f) => f.level === id && match(`${f.name} furniture`)),
      }))
      .filter((g) => g.rooms.length || g.items.length || g.furniture.length || (g.id === level && !query))
  }, [query, level, furniture, notes])

  const isSel = (kind, id) => selection?.kind === kind && selection.id === id

  return (
    <div className="room-list">
      <label className="search">
        <Icon.search />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={level === 'exterior' ? 'Search rooms and systems' : `Search the ${groupName(level).toLowerCase()}`} />
        {q && (
          <button type="button" className="icon-btn ghost" onClick={() => setQ('')} aria-label="Clear search">
            <Icon.close width={16} height={16} />
          </button>
        )}
      </label>
      {groups.map((g) => (
        <section key={g.id} className={'group' + (level === g.id ? ' current' : '')}>
          <h3>{groupName(g.id)}</h3>
          <ul>
            {g.rooms.map((r) => (
              <li key={r.id}>
                <button type="button" className={'row' + (isSel('room', r.id) ? ' on' : '')} onClick={() => onSelect({ kind: 'room', id: r.id })}>
                  <span className={`swatch t-${r.type}`} />
                  <span className="row-main">
                    <span className="row-title">{r.name}</span>
                    {r.subtitle && <span className="row-sub">{r.subtitle}</span>}
                  </span>
                  <span className="row-meta">
                    {notes[roomNoteKey(r.id)]?.length > 0 && <span className="note-dot" title="Has notes" />}
                    {roomArea(r)} sf
                  </span>
                </button>
              </li>
            ))}
            {g.items.map((i) => (
              <li key={i.id}>
                <button type="button" className={'row' + (isSel('item', i.id) ? ' on' : '')} onClick={() => onSelect({ kind: 'item', id: i.id })}>
                  <span className="pin-dot" data-category={i.category} />
                  <span className="row-main">
                    <span className="row-title">{i.name}</span>
                  </span>
                  <span className="row-meta">{i.planted ? plantedInfo(i.planted).age : i.category}</span>
                </button>
              </li>
            ))}
          </ul>
          {g.id !== 'site' && (g.furniture.length > 0 || level === g.id) && (
            <>
              <h4 className="subhead">Furniture</h4>
              <ul>
                {g.furniture.map((f) => (
                  <li key={f.id}>
                    <button type="button" className={'row' + (isSel('furniture', f.id) ? ' on' : '')} onClick={() => onSelect({ kind: 'furniture', id: f.id })}>
                      <span className="swatch furniture" />
                      <span className="row-main">
                        <span className="row-title">{f.name}</span>
                      </span>
                      <span className="row-meta">
                        {feetInches(f.w)} x {feetInches(f.d)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {level === g.id && onAddFurniture && (
                <label className="add-furniture">
                  <Icon.plus width={16} height={16} />
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value !== '') onAddFurniture(FURNITURE_PRESETS[Number(e.target.value)], g.id)
                    }}
                    aria-label="Add furniture"
                  >
                    <option value="">Add furniture…</option>
                    {FURNITURE_PRESETS.map((p, i) => (
                      <option key={p.name} value={i}>
                        {p.name} ({p.w}" x {p.d}")
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
        </section>
      ))}
      {!groups.length && <p className="empty">Nothing matches "{q}".</p>}
    </div>
  )
}
