import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Viewer } from '../three/Viewer.js'

// Thin React wrapper around the imperative three.js viewer.
const ViewerCanvas = forwardRef(function ViewerCanvas(
  { level, cut, pins, selection, onSelect, insetTop = 0, insetBottom = 0, furniture, showFurniture, onFurnitureMove },
  ref,
) {
  const host = useRef(null)
  const viewer = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onMoveRef = useRef(onFurnitureMove)
  onMoveRef.current = onFurnitureMove

  useEffect(() => {
    const v = new Viewer(host.current, {
      onSelect: (s) => onSelectRef.current?.(s),
      onFurnitureMove: (id, x, y) => onMoveRef.current?.(id, x, y),
    })
    viewer.current = v
    if (import.meta.env.DEV) window.__homeViewer = v // for camera checks in dev
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

  useImperativeHandle(ref, () => ({
    home: () => viewer.current?.homeView(),
    top: () => viewer.current?.topView(),
  }))

  return <div className="viewer" ref={host} />
})

export default ViewerCanvas
