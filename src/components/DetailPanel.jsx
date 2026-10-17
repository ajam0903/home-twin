import {
  HOME, ITEMS, ROOMS, levelById, levelName, roomById, itemById, roomArea, openingsForRoom, pointInPoly,
} from '../model/house.js'
import { Icon } from './Icons.jsx'

export default function DetailPanel({ selection, onSelect, onClose, hideHeader = false }) {
  if (selection?.kind === 'room' && roomById[selection.id]) {
    return <RoomDetail room={roomById[selection.id]} onSelect={onSelect} onClose={onClose} hideHeader={hideHeader} />
  }
  if (selection?.kind === 'item' && itemById[selection.id]) {
    return <ItemDetail item={itemById[selection.id]} onSelect={onSelect} onClose={onClose} hideHeader={hideHeader} />
  }
  return <HomeOverview />
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

function RoomDetail({ room, onSelect, onClose, hideHeader }) {
  const openings = openingsForRoom(room)
  const items = ITEMS.filter((i) => i.level === room.level && pointInPoly(i.at, room.poly))
  return (
    <div className="detail">
      {!hideHeader && <Header kicker={levelById[room.level].name} title={room.name} subtitle={room.subtitle} onClose={onClose} />}
      <div className="stats">
        <Stat label="Size on plan" value={room.dims} />
        <Stat label="Floor area" value={`about ${roomArea(room)} sq ft`} />
        <Stat label="Ceiling" value={room.ceiling} />
      </div>
      {room.notes.length > 0 && (
        <Section title="From the drawings">
          <ul className="bullets">
            {room.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      )}
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
      <Section title="From the drawings">
        <ul className="bullets">
          {item.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </Section>
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
        <Section key={s.title} title={s.title}>
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

function Section({ title, children }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
