import { useCallback, useEffect, useRef, useState } from 'react'
import ViewerCanvas from './components/ViewerCanvas.jsx'
import LevelPicker from './components/LevelPicker.jsx'
import RoomList from './components/RoomList.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import BottomSheet from './components/BottomSheet.jsx'
import Blueprints from './components/Blueprints.jsx'
import { Icon } from './components/Icons.jsx'
import { HOME, levelName, roomById, itemById, roomLabelPoint } from './model/house.js'
import { loadFurniture, saveFurniture, settleFurniture, withNewDefaults, defaultFurnitureIds } from './model/furniture.js'
import { loadNotes, saveNotes, cleanNotes } from './model/notes.js'
import { loadMeasurements, saveMeasurements, cleanMeasurements } from './model/measurements.js'
import { useSharedHome, useSharedField, sharingEnabled, signInAdmin, signOutAdmin } from './model/shared.js'

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
  const [pins, setPins] = useState(false) // systems pins, off until the Systems button turns them on
  const [sheet, setSheet] = useState('peek')
  const [sheetTab, setSheetTab] = useState('rooms')
  // Smaller desktop windows: the details panel floats over the 3D view and
  // opens when something is picked, so the view keeps most of the width
  const compact = useMediaQuery('(max-width: 1279px)')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showFurniture, setShowFurniture] = useState(true)
  const [measure, setMeasure] = useState(false)
  const viewer = useRef(null)

  // Notes, saved measurements and the furniture layout are shared: everyone
  // sees them, only the admin edits them (model/shared.js)
  const shared = useSharedHome()
  const { editable } = shared
  const [furniture, setFurniture, furnitureSync] = useSharedField(shared, 'furniture', {
    load: loadFurniture,
    save: saveFurniture,
    fromShared: (list, data) => withNewDefaults(list, data.furnitureSeeded),
    toShared: (list) => ({ furniture: list, furnitureSeeded: defaultFurnitureIds() }),
  })
  // Measurements the owner saved (each in the view it was taken in)
  const [measurements, setMeasurements, measurementsSync] = useSharedField(shared, 'measurements', {
    load: loadMeasurements,
    save: saveMeasurements,
    fromShared: cleanMeasurements,
  })
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
    onRenameMeasurement: editable ? renameMeasurement : null,
    onRemoveMeasurement: editable ? removeMeasurement : null,
    onFocusMeasurement: focusMeasurement,
  }

  // The owner's notes by room
  const [notes, setNotes, notesSync] = useSharedField(shared, 'notes', { load: loadNotes, save: saveNotes, fromShared: cleanNotes })
  const addNote = useCallback((key, text) => {
    const note = { id: `n${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, text: text.trim(), at: Date.now() }
    if (note.text) setNotes((all) => ({ ...all, [key]: [...(all[key] ?? []), note] }))
  }, [])
  const editNote = useCallback((key, id, text) => {
    if (!text.trim()) return
    setNotes((all) => ({ ...all, [key]: (all[key] ?? []).map((n) => (n.id === id ? { ...n, text: text.trim(), edited: Date.now() } : n)) }))
  }, [])
  const removeNote = useCallback((key, id) => {
    setNotes((all) => {
      const next = { ...all }
      const list = (next[key] ?? []).filter((n) => n.id !== id)
      if (list.length) next[key] = list
      else delete next[key]
      return next
    })
  }, [])
  const noteProps = {
    notes,
    onAddNote: editable ? addNote : null,
    onEditNote: editable ? editNote : null,
    onRemoveNote: editable ? removeNote : null,
  }

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

  // A tap on a pin or room label in the 3D view. On phones it opens the panel
  // (select does), and tapping the one already open lowers the panel again
  const selectFromView = (sel) => {
    if (!desktop && sel && selection && sel.kind === selection.kind && sel.id === selection.id) {
      setSheet((s) => (s === 'peek' ? 'half' : 'peek'))
      return
    }
    select(sel)
  }

  const addFurniture = (preset, lvl) => {
    const room = selection?.kind === 'room' && roomById[selection.id]?.level === lvl ? roomById[selection.id] : null
    const [x, y] = room ? roomLabelPoint(room) : LEVEL_CENTER[lvl]
    const piece = settleFurniture({ id: `f${Date.now()}`, kind: preset.kind, name: preset.name, level: lvl, x, y, w: preset.w, d: preset.d, h: preset.h, rot: 0 })
    if (preset.info) piece.info = preset.info // from a photo or link: brand, model, price
    if (preset.look) piece.look = preset.look // and how it looks
    setFurniture((list) => [...list, piece])
    setShowFurniture(true)
    setSelection({ kind: 'furniture', id: piece.id })
  }
  const removeFurniture = (id) => {
    setFurniture((list) => list.filter((f) => f.id !== id))
    setSelection(null)
  }

  // The admin, signed in on a browser whose notes, measurements or furniture
  // are not shared yet, can share them (moving them from this browser)
  const unshared = [
    notesSync.missing && Object.keys(notes).length > 0 && ['notes', notesSync],
    measurementsSync.missing && measurements.length > 0 && ['measurements', measurementsSync],
    furnitureSync.missing && ['furniture layout', furnitureSync],
  ].filter(Boolean)
  const [uploading, setUploading] = useState(false)
  const uploadLocal = async () => {
    setUploading(true)
    try {
      for (const [, sync] of unshared) await sync.upload()
    } catch (e) {
      console.warn('Upload failed', e)
    }
    setUploading(false)
  }
  const unsharedNames = unshared.map(([name]) => name)
  const listNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0])

  // Edits this browser made that never reached the shared copy (a bug, fixed
  // Oct 22 2026; see model/shared.js): save them into it, or let them go
  const byId = (shared, kept) => [...shared.filter((x) => !kept.some((k) => k.id === x.id)), ...kept]
  const keepers = [
    notesSync.unsynced && [
      'notes',
      notesSync,
      (cur, kept) => {
        const out = { ...cur }
        for (const [key, list] of Object.entries(kept)) out[key] = byId(cur[key] ?? [], list)
        return out
      },
    ],
    measurementsSync.unsynced && ['measurements', measurementsSync, (cur, kept) => byId(cur, kept)],
    furnitureSync.unsynced && ['furniture changes', furnitureSync, (cur, kept) => kept],
  ].filter(Boolean)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const unsyncedBanner = sharingEnabled && shared.admin && keepers.length > 0 && (
    <div className="share-banner" role="status">
      <span>
        This browser has {listNames(keepers.map(([name]) => name))} that never reached the shared copy, because of a bug that's now
        fixed.
      </span>
      {confirmDiscard ? (
        <>
          <button type="button" className="btn danger" onClick={() => keepers.forEach(([, sync]) => sync.resolveUnsynced(null))}>
            Discard them
          </button>
          <button type="button" className="btn" onClick={() => setConfirmDiscard(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn" onClick={() => keepers.forEach(([, sync, merge]) => sync.resolveUnsynced(merge))}>
            Save them
          </button>
          <button type="button" className="btn" onClick={() => setConfirmDiscard(true)}>
            Discard
          </button>
        </>
      )}
    </div>
  )
  const shareBanner = unsyncedBanner || (sharingEnabled && shared.admin && unshared.length > 0 && (
    <div className="share-banner" role="status">
      <span>
        This browser has {unsharedNames.length > 1 ? `${unsharedNames.slice(0, -1).join(', ')} and ${unsharedNames.at(-1)}` : unsharedNames[0]} that
        others can't see yet.
      </span>
      <button type="button" className="btn" onClick={uploadLocal} disabled={uploading}>
        {uploading ? 'Sharing...' : 'Share them'}
      </button>
    </div>
  ))

  // Sign in to edit (only the admin's account can)
  const account = sharingEnabled && (
    <div className="account">
      {shared.user ? (
        <>
          <span className={'account-role' + (shared.admin ? ' admin' : '')}>{shared.admin ? 'Editing' : 'View only'}</span>
          <button type="button" className="link" onClick={() => signOutAdmin()}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" className="link" onClick={() => signInAdmin().catch((e) => console.warn('Sign-in failed', e))}>
          Sign in
        </button>
      )}
    </div>
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

  // On phones the floor and tool bars and the bottom sheet cover part of the canvas.
  const insetTop = desktop ? 0 : 112
  const insetBottom = desktop ? 0 : sheet === 'peek' ? 92 : Math.round(window.innerHeight * 0.48)
  const viewerEl = (
    <ViewerCanvas
      ref={viewer}
      level={level}
      cut={cut}
      pins={pins}
      selection={selection}
      onSelect={selectFromView}
      insetTop={insetTop}
      insetBottom={insetBottom}
      furniture={furniture}
      showFurniture={showFurniture}
      onFurnitureMove={moveFurniture}
      editable={editable}
      measure={measure}
      savedMeasurements={measurements}
      onMeasurementSave={saveMeasurement}
      onMeasurementRemove={removeMeasurement}
    />
  )

  const hint =
    measure ? (desktop ? 'Click two points to measure · drag a point to adjust · Shift: one axis · Esc: cancel' : 'Tap two points to measure · drag a point to adjust')
    : level === 'exterior' ? 'Pick a floor to look inside'
    : selection?.kind === 'furniture' && editable ? 'Drag the piece to move it'
    : selection ? null
    : 'Tap a room or a pin for details'

  // The Blueprints tab is for the admin only (signed in), not the public
  const showPlans = !sharingEnabled || shared.admin
  useEffect(() => {
    if (!showPlans && tab === 'plans') setTab('model')
  }, [showPlans, tab])
  const tabs = showPlans && (
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
    const overlay = compact && tab === 'model'
    const showDetails = !overlay || detailsOpen || !!selection
    const closeDetails = () => {
      setSelection(null)
      setDetailsOpen(false)
    }
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
          {account}
        </header>
        {shareBanner}
        {tab === 'model' ? (
          <>
            <aside className="sidebar">
              <LevelPicker value={level} onChange={changeLevel} vertical />
              <RoomList selection={selection} onSelect={select} level={level} furniture={furniture} onAddFurniture={editable ? addFurniture : null} notes={notes} />
            </aside>
            <main className={'stage' + (overlay && showDetails ? ' beside-details' : '')}>
              {viewerEl}
              {tools}
              {hint && <div className="hint">{hint}</div>}
              {overlay && !showDetails && (
                <button type="button" className="details-toggle" onClick={() => setDetailsOpen(true)}>
                  Details
                </button>
              )}
            </main>
            <aside className={'details' + (overlay ? ' overlay' : '')} hidden={!showDetails}>
              {overlay && !selection && (
                <button type="button" className="icon-btn details-close" onClick={closeDetails} aria-label="Close details">
                  <Icon.close />
                </button>
              )}
              <DetailPanel
                selection={selection}
                onSelect={select}
                onClose={selection ? (overlay ? closeDetails : () => setSelection(null)) : null}
                level={level}
                furniture={furniture}
                onFurnitureChange={editable ? updateFurniture : null}
                onFurnitureDelete={editable ? removeFurniture : null}
                {...noteProps}
                {...measureProps}
              />
            </aside>
          </>
        ) : (
          <main className="plans-stage">
            {showPlans && <Blueprints />}
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
      {shareBanner}
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
                  {account && (
                    <div className="peek-account" onPointerDown={(e) => e.stopPropagation()}>
                      {account}
                    </div>
                  )}
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
                onFurnitureChange={editable ? updateFurniture : null}
                onFurnitureDelete={editable ? removeFurniture : null}
                {...noteProps}
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
                  {showPlans && (
                    <button type="button" onClick={() => setTab('plans')}>
                      Blueprints
                    </button>
                  )}
                </div>
                {sheetTab === 'rooms' ? (
                  <RoomList selection={sel} onSelect={select} level={level} furniture={furniture} onAddFurniture={editable ? addFurniture : null} notes={notes} />
                ) : (
                  <DetailPanel selection={null} onSelect={select} level={level} furniture={furniture} {...measureProps} />
                )}
              </>
            )}
          </BottomSheet>
        </>
      ) : (
        <main className="plans-stage">
          <button type="button" className="plans-back" onClick={() => setTab('model')}>
            <Icon.cube />
            <span>3D model</span>
          </button>
          {showPlans && <Blueprints compact />}
        </main>
      )}
    </div>
  )
}
