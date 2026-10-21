import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Viewer } from '../three/Viewer.js'

let exportStarted = false

// Thin React wrapper around the imperative three.js viewer.
const ViewerCanvas = forwardRef(function ViewerCanvas(
  {
    level, cut, pins, selection, onSelect, insetTop = 0, insetBottom = 0, furniture, showFurniture, onFurnitureMove,
    measure = false, savedMeasurements, onMeasurementSave, onMeasurementRemove,
  },
  ref,
) {
  const host = useRef(null)
  const viewer = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onMoveRef = useRef(onFurnitureMove)
  onMoveRef.current = onFurnitureMove
  const onSaveRef = useRef(onMeasurementSave)
  onSaveRef.current = onMeasurementSave
  const onRemoveRef = useRef(onMeasurementRemove)
  onRemoveRef.current = onMeasurementRemove

  useEffect(() => {
    const v = new Viewer(host.current, {
      onSelect: (s) => onSelectRef.current?.(s),
      onFurnitureMove: (id, x, y) => onMoveRef.current?.(id, x, y),
      onMeasurementSave: (m) => onSaveRef.current?.(m),
      onMeasurementRemove: (id) => onRemoveRef.current?.(id),
    })
    viewer.current = v
    if (import.meta.env.DEV) window.__homeViewer = v // for camera checks in dev
    // Dev only: open the app with ?export=maya to write maya/export for Maya
    if (import.meta.env.DEV && !exportStarted && new URLSearchParams(window.location.search).get('export') === 'maya') {
      exportStarted = true // React mounts twice in dev; export once
      const note = document.createElement('div')
      note.className = 'export-status'
      document.body.appendChild(note)
      const say = (text) => {
        note.textContent = text
        console.info('[maya export]', text)
      }
      import('../three/mayaExport.js')
        .then(({ exportForMaya }) => exportForMaya({ onStatus: say }))
        .then((summary) => console.info('[maya export] done', summary))
        .catch((err) => say(`Export failed: ${err.message}`))
    }
    return () => v.dispose()
  }, [])

  // Mode first, then furniture, then selection, so a selection's fly-to wins over the level framing.
  useEffect(() => {
    const v = viewer.current
    if (!v) return
    v.setShowPins(pins)
    v.setMode(level, cut)
  }, [level, cut, pins])

  useEffect(() => {
    viewer.current?.setInsets({ top: insetTop, bottom: insetBottom })
  }, [insetTop, insetBottom])

  useEffect(() => {
    viewer.current?.setFurniture(furniture ?? [], showFurniture !== false)
  }, [furniture, showFurniture])

  useEffect(() => {
    viewer.current?.select(selection)
  }, [selection])

  useEffect(() => {
    viewer.current?.setMeasureMode(measure)
  }, [measure])

  useEffect(() => {
    viewer.current?.setSavedMeasurements(savedMeasurements ?? [])
  }, [savedMeasurements])

  useImperativeHandle(ref, () => ({
    home: () => viewer.current?.homeView(),
    top: () => viewer.current?.topView(),
    focusMeasurement: (id) => viewer.current?.focusMeasurement(id),
  }))

  return <div className="viewer" ref={host} />
})

export default ViewerCanvas
