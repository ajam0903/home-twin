import { useCallback, useEffect, useRef, useState } from 'react'
import ViewerCanvas from './components/ViewerCanvas.jsx'
import LevelPicker from './components/LevelPicker.jsx'
import RoomList from './components/RoomList.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import BottomSheet from './components/BottomSheet.jsx'
import Blueprints from './components/Blueprints.jsx'
import { Icon } from './components/Icons.jsx'
import { HOME, levelName, roomById, itemById } from './model/house.js'

function useMediaQuery(q) {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return match
}

const levelOf = (sel) => (sel?.kind === 'room' ? roomById[sel.id]?.level : sel?.kind === 'item' ? itemById[sel.id]?.level : null)
// Lot features ('site') are shown with the whole house.
const modeOf = (level) => (level === 'site' ? 'exterior' : level)

export default function App() {
  const desktop = useMediaQuery('(min-width: 1000px)')
  const [tab, setTab] = useState('model')
  const [level, setLevel] = useState('exterior')
  const [selection, setSelection] = useState(null)
  const [cut, setCut] = useState(true)
  const [pins, setPins] = useState(true)
  const [sheet, setSheet] = useState('peek')
  const [sheetTab, setSheetTab] = useState('rooms')
  const viewer = useRef(null)

  const select = useCallback(
    (sel) => {
      setSelection(sel)
      const l = levelOf(sel)
      if (l) setLevel(modeOf(l))
      if (sel && !desktop) setSheet((s) => (s === 'full' ? 'full' : 'half'))
    },
    [desktop],
  )

  const changeLevel = (l) => {
    setLevel(l)
    if (selection && modeOf(levelOf(selection)) !== l) setSelection(null)
  }

  const tools = (
    <div className="view-tools">
      <button type="button" className="tool" onClick={() => viewer.current?.home()} title="Reset view">
        <Icon.orbit />
        <span>3D</span>
      </button>
      <button type="button" className="tool" onClick={() => viewer.current?.top()} title="Top-down view">
        <Icon.top />
        <span>Top</span>
      </button>
      <button
        type="button"
        className={'tool' + (cut ? ' on' : '')}
        onClick={() => setCut((c) => !c)}
        disabled={level === 'exterior'}
        title="Cut walls at 4'-6&quot; to see into rooms"
        aria-pressed={cut}
      >
        <Icon.cut />
        <span>Cutaway</span>
      </button>
      <button type="button" className={'tool' + (pins ? ' on' : '')} onClick={() => setPins((p) => !p)} title="Show systems" aria-pressed={pins}>
        <Icon.pin />
        <span>Systems</span>
      </button>
    </div>
  )

  // On phones the header and bottom sheet cover part of the canvas.
  const insetTop = desktop ? 0 : 60
  const insetBottom = desktop ? 0 : sheet === 'peek' ? 92 : Math.round(window.innerHeight * 0.48)
  const viewerEl = (
    <ViewerCanvas
      ref={viewer}
      level={level}
      cut={cut}
      pins={pins}
      selection={selection}
      onSelect={select}
      insetTop={insetTop}
      insetBottom={insetBottom}
    />
  )

  const hint =
    level === 'exterior' ? 'Pick a floor to look inside' : selection ? null : 'Tap a room or a pin for details'

  const tabs = (
    <div className="tabs" role="tablist">
      <button type="button" role="tab" aria-label="3D model" aria-selected={tab === 'model'} className={tab === 'model' ? 'on' : ''} onClick={() => setTab('model')}>
        <Icon.cube />
        <span>3D model</span>
      </button>
      <button type="button" role="tab" aria-label="Blueprints" aria-selected={tab === 'plans'} className={tab === 'plans' ? 'on' : ''} onClick={() => setTab('plans')}>
        <Icon.plan />
        <span>Blueprints</span>
      </button>
    </div>
  )

  if (desktop) {
    return (
      <div className={'app desktop tab-' + tab}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <Icon.home />
            </span>
            <div>
              <strong>{HOME.title}</strong>
              <span>{HOME.address}</span>
            </div>
          </div>
          {tabs}
          <div className="topbar-spacer" />
        </header>
        {tab === 'model' ? (
          <>
            <aside className="sidebar">
              <LevelPicker value={level} onChange={changeLevel} vertical />
              <RoomList selection={selection} onSelect={select} level={level} />
            </aside>
            <main className="stage">
              {viewerEl}
              {tools}
              {hint && <div className="hint">{hint}</div>}
            </main>
            <aside className="details">
              <DetailPanel selection={selection} onSelect={select} onClose={selection ? () => setSelection(null) : null} />
            </aside>
          </>
        ) : (
          <main className="plans-stage">
            <Blueprints />
          </main>
        )}
      </div>
    )
  }

  const sel = selection
  const selTitle = sel ? (sel.kind === 'room' ? roomById[sel.id]?.name : itemById[sel.id]?.name) : null
  return (
    <div className={'app mobile tab-' + tab}>
      <header className="m-top">
        <div className="brand compact">
          <span className="brand-mark">
            <Icon.home />
          </span>
          <strong>{HOME.title}</strong>
        </div>
        {tabs}
      </header>
      {tab === 'model' ? (
        <>
          <main className="stage">{viewerEl}</main>
          <div className="m-levels">
            <LevelPicker value={level} onChange={changeLevel} />
          </div>
          <div className="m-tools">{tools}</div>
          {hint && sheet === 'peek' && <div className="hint">{hint}</div>}
          <BottomSheet
            snap={sheet}
            onSnap={setSheet}
            peek={
              sel ? (
                <div className="peek-row">
                  <div>
                    <div className="kicker">
                      {sel.kind === 'item' ? `${itemById[sel.id]?.category} · ` : ''}
                      {levelName(levelOf(sel))}
                    </div>
                    <strong>{selTitle}</strong>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setSelection(null)}
                    aria-label="Clear selection"
                  >
                    <Icon.close />
                  </button>
                </div>
              ) : (
                <div className="peek-row">
                  <div>
                    <div className="kicker">Explore</div>
                    <strong>Rooms, systems &amp; home facts</strong>
                  </div>
                </div>
              )
            }
          >
            {sel ? (
              <DetailPanel selection={sel} onSelect={select} hideHeader />
            ) : (
              <>
                <div className="seg">
                  <button type="button" className={sheetTab === 'rooms' ? 'on' : ''} onClick={() => setSheetTab('rooms')}>
                    Rooms &amp; systems
                  </button>
                  <button type="button" className={sheetTab === 'home' ? 'on' : ''} onClick={() => setSheetTab('home')}>
                    Home info
                  </button>
                </div>
                {sheetTab === 'rooms' ? <RoomList selection={sel} onSelect={select} level={level} /> : <DetailPanel selection={null} />}
              </>
            )}
          </BottomSheet>
        </>
      ) : (
        <main className="plans-stage">
          <Blueprints compact />
        </main>
      )}
    </div>
  )
}
