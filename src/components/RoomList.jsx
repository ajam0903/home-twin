import { useMemo, useState } from 'react'
import { ROOMS, ITEMS, LEVELS, roomArea } from '../model/house.js'
import { Icon } from './Icons.jsx'

export default function RoomList({ selection, onSelect, level }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const groups = useMemo(() => {
    const match = (s) => !query || s.toLowerCase().includes(query)
    return LEVELS.map((lvl) => ({
      level: lvl,
      rooms: ROOMS.filter((r) => r.level === lvl.id && match(`${r.name} ${r.subtitle ?? ''} ${r.type}`)),
      items: ITEMS.filter((i) => i.level === lvl.id && match(`${i.name} ${i.category}`)),
    }))
      .concat([{ level: { id: 'site', name: 'Property' }, rooms: [], items: ITEMS.filter((i) => i.level === 'site' && match(`${i.name} ${i.category}`)) }])
      .filter((g) => g.rooms.length || g.items.length)
  }, [query])

  const isSel = (kind, id) => selection?.kind === kind && selection.id === id

  return (
    <div className="room-list">
      <label className="search">
        <Icon.search />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rooms and systems" />
        {q && (
          <button type="button" className="icon-btn ghost" onClick={() => setQ('')} aria-label="Clear search">
            <Icon.close width={16} height={16} />
          </button>
        )}
      </label>
      {groups.map(({ level: lvl, rooms, items }) => (
        <section key={lvl.id} className={'group' + (level === lvl.id || (lvl.id === 'site' && level === 'exterior') ? ' current' : '')}>
          <h3>{lvl.name}</h3>
          <ul>
            {rooms.map((r) => (
              <li key={r.id}>
                <button type="button" className={'row' + (isSel('room', r.id) ? ' on' : '')} onClick={() => onSelect({ kind: 'room', id: r.id })}>
                  <span className={`swatch t-${r.type}`} />
                  <span className="row-main">
                    <span className="row-title">{r.name}</span>
                    {r.subtitle && <span className="row-sub">{r.subtitle}</span>}
                  </span>
                  <span className="row-meta">{roomArea(r)} sf</span>
                </button>
              </li>
            ))}
            {items.map((i) => (
              <li key={i.id}>
                <button type="button" className={'row' + (isSel('item', i.id) ? ' on' : '')} onClick={() => onSelect({ kind: 'item', id: i.id })}>
                  <span className="pin-dot" data-category={i.category} />
                  <span className="row-main">
                    <span className="row-title">{i.name}</span>
                  </span>
                  <span className="row-meta">{i.category}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="empty">Nothing matches "{q}".</p>}
    </div>
  )
}
