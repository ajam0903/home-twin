import { useEffect, useState } from 'react'
import {
  HOME, ITEMS, ROOMS, FLOORING_NAMES, FLOOR_FACTS, levelById, levelName, roomById, itemById, roomArea, openingsForRoom, pointInPoly, plantedInfo,
} from '../model/house.js'
import { roomNoteKey } from '../model/notes.js'
import { measuredLength } from '../model/measurements.js'
import { feetInchesText, inchesText } from '../three/measure.js'
import { sharingEnabled } from '../model/shared.js'
import { feetInches } from '../model/furniture.js'
import { Icon } from './Icons.jsx'

export default function DetailPanel({
  selection, onSelect, onClose, hideHeader = false, level = 'exterior', furniture = [], onFurnitureChange, onFurnitureDelete,
  notes = {}, onNoteChange,
  measurements = [], onRenameMeasurement, onRemoveMeasurement, onFocusMeasurement,
}) {
  if (selection?.kind === 'room' && roomById[selection.id]) {
    const key = roomNoteKey(selection.id)
    return (
      <RoomDetail
        room={roomById[selection.id]}
        furniture={furniture}
        onSelect={onSelect}
        onClose={onClose}
        hideHeader={hideHeader}
        note={notes[key] ?? ''}
        onNoteChange={onNoteChange ? (text) => onNoteChange(key, text) : null}
      />
    )
  }
  if (selection?.kind === 'item' && itemById[selection.id]) {
    return <ItemDetail item={itemById[selection.id]} onSelect={onSelect} onClose={onClose} hideHeader={hideHeader} />
  }
  const piece = selection?.kind === 'furniture' && furniture.find((f) => f.id === selection.id)
  if (piece) {
    return <FurnitureDetail piece={piece} onSelect={onSelect} onClose={onClose} hideHeader={hideHeader} onChange={onFurnitureChange} onDelete={onFurnitureDelete} />
  }
  const saved = measurements.length > 0 && (
    <div className="detail">
      <SavedMeasurements list={measurements} onRename={onRenameMeasurement} onRemove={onRemoveMeasurement} onFocus={onFocusMeasurement} />
    </div>
  )
  if (levelById[level]) {
    return (
      <>
        <FloorOverview level={level} furniture={furniture} onSelect={onSelect} />
        {saved}
      </>
    )
  }
  return (
    <>
      <HomeOverview />
      {saved}
    </>
  )
}

// Saved measurements for the view: name them, jump to one, or delete it
function SavedMeasurements({ list, onRename, onRemove, onFocus }) {
  return (
    <Section title={`Saved measurements (${list.length})`}>
      <ul className={'saved-measures' + (onRename ? '' : ' read-only')}>
        {list.map((m) => {
          const len = measuredLength(m)
          return (
            <li key={m.id}>
              {onRename ? (
                <input
                  value={m.name ?? ''}
                  placeholder="Name it (e.g. sofa wall)"
                  onChange={(e) => onRename(m.id, e.target.value)}
                  aria-label="Measurement name"
                />
              ) : (
                <span className="measure-name">{m.name || 'Measurement'}</span>
              )}
              <button type="button" className="link" onClick={() => onFocus?.(m)} title="Show it in the view">
                {feetInchesText(len)} <span>{inchesText(len)}</span>
              </button>
              {onRemove && (
                <button type="button" className="icon-btn small" onClick={() => onRemove(m.id)} aria-label="Delete this measurement">
                  <Icon.close width={14} height={14} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {onRename && <p className="muted">{SAVED_WHERE}</p>}
    </Section>
  )
}

// Where edits go: the shared copy everyone sees, or just this browser
const SAVED_WHERE = sharingEnabled ? 'Shared: everyone who opens Home Twin sees it.' : 'Saved in this browser.'

const roomAt = (level, x, y) => ROOMS.find((r) => r.level === level && pointInPoly([x, y], r.poly))

// Summary of one floor: size, finishes, rooms, systems and furniture
function FloorOverview({ level, furniture, onSelect }) {
  const lvl = levelById[level]
  const facts = FLOOR_FACTS[level] ?? {}
  const rooms = ROOMS.filter((r) => r.level === level)
  const items = ITEMS.filter((i) => i.level === level)
  const pieces = furniture.filter((f) => f.level === level)
  const indoor = rooms.filter((r) => !['porch', 'deck', 'garage'].includes(r.type))
  const count = (t) => rooms.filter((r) => r.type === t).length
  const byFloor = {}
  for (const r of indoor) if (r.flooring) byFloor[r.flooring] = (byFloor[r.flooring] ?? 0) + roomArea(r)
  return (
    <div className="detail">
      <Header kicker="Floor overview" title={lvl.name} subtitle={`${indoor.length} rooms and spaces`} />
      <div className="facts">
        <Stat label="Area" value={facts.area ?? `about ${indoor.reduce((a, r) => a + roomArea(r), 0)} sq ft`} />
        <Stat label="Ceiling" value={facts.ceiling ?? `${lvl.height}'-0"`} />
        {count('bedroom') > 0 && <Stat label="Bedrooms" value={count('bedroom')} />}
        {count('bath') > 0 && <Stat label="Baths" value={count('bath')} />}
      </div>
      {Object.keys(byFloor).length > 0 && (
        <Section title="Flooring">
          <dl className="kv">
            {Object.entries(byFloor).map(([k, v]) => (
              <div key={k}>
                <dt>{FLOORING_NAMES[k]}</dt>
                <dd>about {v} sq ft</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      <Section title="Rooms">
        <div className="chips">
          {rooms.map((r) => (
            <button key={r.id} type="button" className="chip" onClick={() => onSelect({ kind: 'room', id: r.id })}>
              <span className={`swatch t-${r.type}`} />
              {r.name}
              {r.subtitle && r.name === 'Closet' ? ` (${r.subtitle})` : ''}
            </button>
          ))}
        </div>
      </Section>
      {items.length > 0 && (
        <Section title="Systems">
          <div className="chips">
            {items.map((i) => (
              <button key={i.id} type="button" className="chip" onClick={() => onSelect({ kind: 'item', id: i.id })}>
                <span className="pin-dot" data-category={i.category} />
                {i.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      <Section title={`Furniture (${pieces.length})`}>
        {pieces.length ? (
          <div className="chips">
            {pieces.map((f) => (
              <button key={f.id} type="button" className="chip" onClick={() => onSelect({ kind: 'furniture', id: f.id })}>
                <span className="swatch furniture" />
                {f.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">None yet. Use “Add furniture” in the room list.</p>
        )}
      </Section>
    </div>
  )
}

// Edit one piece: name, size in inches, rotation; drag it in the 3D view to move it
function FurnitureDetail({ piece, onSelect, onClose, hideHeader, onChange, onDelete }) {
  const room = roomAt(piece.level, piece.x, piece.y)
  const set = (patch) => onChange?.(piece.id, patch)
  if (!onChange) {
    // view only
    return (
      <div className="detail">
        {!hideHeader && <Header kicker={`Furniture · ${levelName(piece.level)}`} title={piece.name} onClose={onClose} />}
        <p className="muted">
          {feetInches(piece.w)} wide x {feetInches(piece.d)} deep x {feetInches(piece.h)} high
        </p>
        {room && (
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Located in</div>
              <button type="button" className="link" onClick={() => onSelect({ kind: 'room', id: room.id })}>
                {room.name}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="detail">
      {!hideHeader && <Header kicker={`Furniture · ${levelName(piece.level)}`} title={piece.name} onClose={onClose} />}
      <label className="field">
        <span>Name</span>
        <input value={piece.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="dims">
        <NumberField label="Width" unit="in" value={piece.w} onCommit={(v) => set({ w: v })} />
        <NumberField label="Depth" unit="in" value={piece.d} onCommit={(v) => set({ d: v })} />
        <NumberField label="Height" unit="in" value={piece.h} onCommit={(v) => set({ h: v })} />
      </div>
      <p className="muted">
        {feetInches(piece.w)} wide x {feetInches(piece.d)} deep x {feetInches(piece.h)} high
      </p>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Located in</div>
          {room ? (
            <button type="button" className="link" onClick={() => onSelect({ kind: 'room', id: room.id })}>
              {room.name}
            </button>
          ) : (
            <div className="stat-value">Outside the rooms</div>
          )}
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="btn" onClick={() => set({ rot: ((piece.rot ?? 0) + 270) % 360 })}>
          Rotate left
        </button>
        <button type="button" className="btn" onClick={() => set({ rot: ((piece.rot ?? 0) + 90) % 360 })}>
          Rotate right
        </button>
        <button type="button" className="btn danger" onClick={() => onDelete?.(piece.id)}>
          Remove
        </button>
      </div>
      <p className="muted">Click a piece in the 3D view to select it, then drag it to move it (floor views). {SAVED_WHERE}</p>
    </div>
  )
}

// Number input that keeps what you type and commits valid positive values
function NumberField({ label, unit, value, onCommit }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <label className="field">
      <span>{label}</span>
      <span className="with-unit">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const v = Number(e.target.value)
            if (v > 0 && v < 600) onCommit(v)
          }}
          onBlur={() => setText(String(value))}
        />
        <em>{unit}</em>
      </span>
    </label>
  )
}

function Header({ kicker, title, subtitle, onClose }) {
  return (
    <header className="detail-head">
      <div>
        <div className="kicker">{kicker}</div>
        <h2>{title}</h2>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {onClose && (
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
          <Icon.close />
        </button>
      )}
    </header>
  )
}

function RoomDetail({ room, furniture, onSelect, onClose, hideHeader, note, onNoteChange }) {
  const openings = openingsForRoom(room)
  const items = ITEMS.filter((i) => i.level === room.level && pointInPoly(i.at, room.poly))
  const pieces = furniture.filter((f) => f.level === room.level && pointInPoly([f.x, f.y], room.poly))
  return (
    <div className="detail">
      {!hideHeader && <Header kicker={levelById[room.level].name} title={room.name} subtitle={room.subtitle} onClose={onClose} />}
      <div className="stats">
        <Stat label="Size on plan" value={room.dims} />
        <Stat label="Floor area" value={`about ${roomArea(room)} sq ft`} />
        <Stat label="Ceiling" value={room.ceiling} />
        {room.flooring && <Stat label="Flooring" value={FLOORING_NAMES[room.flooring]} />}
      </div>
      <MyNotes value={note} onChange={onNoteChange} />
      {room.notes.length > 0 && (
        <Section title="From the drawings">
          <ul className="bullets">
            {room.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      )}
      <DetailSections sections={room.sections} />
      {openings.length > 0 && (
        <Section title={`Windows & doors (${openings.length})`}>
          <ul className="spec-list">
            {openings.map((o, i) => (
              <li key={i}>
                <span className={'tag ' + o.type}>{o.type === 'window' ? 'Window' : 'Door'}</span>
                <span>{o.label}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {items.length > 0 && (
        <Section title="Systems here">
          <div className="chips">
            {items.map((i) => (
              <button key={i.id} type="button" className="chip" onClick={() => onSelect({ kind: 'item', id: i.id })}>
                <span className="pin-dot" data-category={i.category} />
                {i.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      {pieces.length > 0 && (
        <Section title="Furniture">
          <div className="chips">
            {pieces.map((f) => (
              <button key={f.id} type="button" className="chip" onClick={() => onSelect({ kind: 'furniture', id: f.id })}>
                <span className="swatch furniture" />
                {f.name}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function ItemDetail({ item, onSelect, onClose, hideHeader }) {
  const room = ROOMS.find((r) => r.level === item.level && pointInPoly(item.at, r.poly))
  return (
    <div className="detail">
      {!hideHeader && <Header kicker={`${item.category} · ${levelName(item.level)}`} title={item.name} onClose={onClose} />}
      {room && (
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Located in</div>
            <button type="button" className="link" onClick={() => onSelect({ kind: 'room', id: room.id })}>
              {room.name}
            </button>
          </div>
        </div>
      )}
      {item.planted && <PlantedStats planted={item.planted} />}
      {item.details && (
        <Section title={item.level === 'site' ? 'Details' : 'From the drawings'}>
          <ul className="bullets">
            {item.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Section>
      )}
      <DetailSections sections={item.sections} />
    </div>
  )
}

// The owner's own notes for a room: saved as they type, in this browser
function MyNotes({ value, onChange }) {
  if (!onChange) {
    // view only: just the note, when there is one
    if (!value) return null
    return (
      <section className="detail-section my-notes">
        <h3>Notes</h3>
        <p className="note-text">{value}</p>
      </section>
    )
  }
  return (
    <section className="detail-section my-notes">
      <h3>My notes</h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paint colors, measurements, what is stored here, things to fix..."
        rows={Math.min(12, Math.max(3, value.split('\n').length + 1))}
      />
      <p className="muted">{SAVED_WHERE}</p>
    </section>
  )
}

// One listing that covers several parts (the deck, the arborvitae rows...):
// a titled list of notes for each part
function DetailSections({ sections }) {
  if (!sections?.length) return null
  return sections.map((sec) => (
    <Section key={sec.title} title={sec.title}>
      <ul className="bullets">
        {sec.details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </Section>
  ))
}

function PlantedStats({ planted }) {
  const { label, age } = plantedInfo(planted)
  return (
    <div className="facts">
      <Stat label="Planted" value={label} />
      <Stat label="In the ground" value={age} />
    </div>
  )
}

export function HomeOverview() {
  return (
    <div className="detail">
      <Header kicker="Home overview" title={HOME.title} subtitle={HOME.address} />
      <p className="lede">{HOME.style}.</p>
      <div className="facts">
        {HOME.facts.map(([k, v]) => (
          <Stat key={k} label={k} value={v} />
        ))}
      </div>
      {HOME.sections.map((s) => (
        <Section key={s.title} title={s.title} collapsible>
          <dl className="kv">
            {s.rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function Section({ title, children, collapsible = false }) {
  if (collapsible) {
    // Closed by default; click the heading to open
    return (
      <details className="detail-section collapsible">
        <summary>
          <h3>{title}</h3>
        </summary>
        {children}
      </details>
    )
  }
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
