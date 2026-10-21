import { useCallback, useEffect, useRef, useState } from 'react'
import ViewerCanvas from './components/ViewerCanvas.jsx'
import LevelPicker from './components/LevelPicker.jsx'
import RoomList from './components/RoomList.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import BottomSheet from './components/BottomSheet.jsx'
import Blueprints from './components/Blueprints.jsx'
import { Icon } from './components/Icons.jsx'
import { HOME, levelName, roomById, itemById, roomLabelPoint } from './model/house.js'
import { loadFurniture, saveFurniture, settleFurniture } from './model/furniture.js'
import { loadNotes, saveNotes } from './model/notes.js'
import { loadMeasurements, saveMeasurements } from './model/measurements.js'

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

// Lot features ('site') are shown with the whole house.
const modeOf = (level) => (level === 'site' ? 'exterior' : level)
// Where a new piece of furniture lands when no room on that floor is selected
const LEVEL_CENTER = { L1: [24, 22], L2: [30, 22], B: [24, 22] }

export default function App() {
  const desktop = useMediaQuery('(min-width: 1000px)')
  const [tab, setTab] = useState('model')
  const [level, setLevel] = useState('exterior')
  const [selection, setSelection] = useState(null)
  const [cut, setCut] = useState(true)
  const [pins, setPins] = useState(true)
  const [sheet, setSheet] = useState('peek')
  const [sheetTab, setSheetTab] = useState('rooms')
  const [furniture, setFurniture] = useState(loadFurniture)
  const [showFurniture, setShowFurniture] = useState(true)
  const [measure, setMeasure] = useState(false)
  const viewer = useRef(null)

  useEffect(() => saveFurniture(furniture), [furniture])

  // Measurements the owner saved (each in the view it was taken in), saved in this browser
  const [measurements, setMeasurements] = useState(loadMeasurements)
  useEffect(() => saveMeasurements(measurements), [measurements])
  const saveMeasurement = useCallback(
    // a new one, or new end points for a saved one (dragged in the view)
    (m) =>
      setMeasurements((list) =>
        list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? { ...x, a: m.a, b: m.b } : x)) : [...list, { ...m, name: '' }],
      ),
    [],
  )
  const removeMeasurement = useCallback((id) => setMeasurements((list) => list.filter((m) => m.id !== id)), [])
  const renameMeasurement = (id, name) => setMeasurements((list) => list.map((m) => (m.id === id ? { ...m, name } : m)))
  const focusMeasurement = (m) => {
    if (m.view !== level) setLevel(m.view)
    setTimeout(() => viewer.current?.focusMeasurement(m.id), 60)
  }
  const measureProps = {
    measurements: measurements.filter((m) => m.view === level),
    onRenameMeasurement: renameMeasurement,
    onRemoveMeasurement: removeMeasurement,
    onFocusMeasurement: focusMeasurement,
  }

  // The owner's notes by room, saved in this browser
  const [notes, setNotes] = useState(loadNotes)
  useEffect(() => saveNotes(notes), [notes])
  const setNote = useCallback((key, text) => {
    setNotes((all) => {
      const next = { ...all }
      if (text.trim()) next[key] = text
      else delete next[key]
      return next
    })
  }, [])

  const levelOf = (sel) =>
    sel?.kind === 'room' ? roomById[sel.id]?.level
    : sel?.kind === 'item' ? itemById[sel.id]?.level
    : sel?.kind === 'furniture' ? furniture.find((f) => f.id === sel.id)?.level
    : null

  const updateFurniture = useCallback((id, patch) => {
    // A typed size or rotation that would push the piece into a wall moves it clear
    setFurniture((list) => list.map((f) => (f.id === id ? settleFurniture({ ...f, ...patch }, f) : f)))
  }, [])
  const moveFurniture = useCallback((id, x, y) => updateFurniture(id, { x, y }), [updateFurniture])

  const select = useCallback(
    (sel) => {
      setSelection(sel)
      const l = levelOf(sel)
      // an outdoor room (the deck) picked from outside keeps the whole-house view
      const stayOutside = level === 'exterior' && sel?.kind === 'room' && roomById[sel.id]?.outdoor
      if (l && !stayOutside) setLevel(modeOf(l))
      if (sel && !desktop) setSheet((s) => (s === 'full' ? 'full' : 'half'))
    },
    [desktop, furniture, level],
  )

  const addFurniture = (preset, lvl) => {
    const room = selection?.kind === 'room' && roomById[selection.id]?.level === lvl ? roomById[selection.id] : null
    const [x, y] = room ? roomLabelPoint(room) : LEVEL_CENTER[lvl]
    const piece = settleFurniture({ id: `f${Date.now()}`, kind: preset.kind, name: preset.name, level: lvl, x, y, w: preset.w, d: preset.d, h: preset.h, rot: 0 })
    setFurniture((list) => [...list, piece])
    setShowFurniture(true)
    setSelection({ kind: 'furniture', id: piece.id })
  }
  const removeFurniture = (id) => {
    setFurniture((list) => list.filter((f) => f.id !== id))
    setSelection(null)
  }

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
      <button
        type="button"
        className={'tool' + (showFurniture ? ' on' : '')}
        onClick={() => setShowFurniture((v) => !v)}
        title="Show furniture"
        aria-pressed={showFurniture}
      >
        <Icon.sofa />
        <span>Furniture</span>
      </button>
      <button
        type="button"
        className={'tool' + (measure ? ' on' : '')}
        onClick={() => setMeasure((m) => !m)}
        title="Measure: pick two points"
        aria-pressed={measure}
      >
        <Icon.ruler />
        <span>Measure</span>
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
      furniture={furniture}
      showFurniture={showFurniture}
      onFurnitureMove={moveFurniture}
      measure={measure}
      savedMeasurements={measurements}
      onMeasurementSave={saveMeasurement}
      onMeasurementRemove={removeMeasurement}
    />
  )

  const hint =
    measure ? (desktop ? 'Click two points to measure · drag a point to adjust · Shift: one axis · Esc: cancel' : 'Tap two points to measure · drag a point to adjust')
    : level === 'exterior' ? 'Pick a floor to look inside'
    : selection?.kind === 'furniture' ? 'Drag the piece to move it'
    : selection ? null
    : 'Tap a room or a pin for details'

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
              <RoomList selection={selection} onSelect={select} level={level} furniture={furniture} onAddFurniture={addFurniture} notes={notes} />
            </aside>
            <main className="stage">
              {viewerEl}
              {tools}
              {hint && <div className="hint">{hint}</div>}
            </main>
            <aside className="details">
              <DetailPanel
                selection={selection}
                onSelect={select}
                onClose={selection ? () => setSelection(null) : null}
                level={level}
                furniture={furniture}
                onFurnitureChange={updateFurniture}
                onFurnitureDelete={removeFurniture}
                notes={notes}
                onNoteChange={setNote}
                {...measureProps}
              />
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
  const selTitle = sel
    ? sel.kind === 'room' ? roomById[sel.id]?.name
      : sel.kind === 'furniture' ? furniture.find((f) => f.id === sel.id)?.name
      : itemById[sel.id]?.name
    : null
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
                      {sel.kind === 'item' ? `${itemById[sel.id]?.category} · ` : sel.kind === 'furniture' ? 'Furniture · ' : ''}
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
              <DetailPanel
                selection={sel}
                onSelect={select}
                hideHeader
                level={level}
                furniture={furniture}
                onFurnitureChange={updateFurniture}
                onFurnitureDelete={removeFurniture}
                notes={notes}
                onNoteChange={setNote}
              />
            ) : (
              <>
                <div className="seg">
                  <button type="button" className={sheetTab === 'rooms' ? 'on' : ''} onClick={() => setSheetTab('rooms')}>
                    Rooms &amp; systems
                  </button>
                  <button type="button" className={sheetTab === 'home' ? 'on' : ''} onClick={() => setSheetTab('home')}>
                    {level === 'exterior' ? 'Home info' : 'Floor info'}
                  </button>
                </div>
                {sheetTab === 'rooms' ? (
                  <RoomList selection={sel} onSelect={select} level={level} furniture={furniture} onAddFurniture={addFurniture} notes={notes} />
                ) : (
                  <DetailPanel selection={null} onSelect={select} level={level} furniture={furniture} {...measureProps} />
                )}
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
