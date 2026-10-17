import { useEffect, useRef, useState } from 'react'

// Mobile bottom sheet with three snap points: peek, half and full.
const SNAPS = { peek: 0, half: 1, full: 2 }

export default function BottomSheet({ snap, onSnap, peek, children }) {
  const sheet = useRef(null)
  const drag = useRef(null)
  const [dragY, setDragY] = useState(null)

  const heights = () => {
    const vh = window.innerHeight
    return { peek: 92, half: Math.round(vh * 0.48), full: Math.round(vh - 72) }
  }

  const onPointerDown = (e) => {
    drag.current = { y0: e.clientY, h0: heights()[snap], t0: performance.now() }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const hs = heights()
    const h = Math.max(hs.peek - 20, Math.min(hs.full + 10, drag.current.h0 - (e.clientY - drag.current.y0)))
    setDragY(h)
  }
  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dy = e.clientY - d.y0
    const hs = heights()
    if (Math.abs(dy) < 6) {
      // Tap on the handle toggles between peek and half.
      onSnap(snap === 'peek' ? 'half' : 'peek')
    } else {
      const v = dy / Math.max(1, performance.now() - d.t0) // px per ms, + is down
      const h = d.h0 - dy
      let next
      if (v > 0.6) next = snap === 'full' ? 'half' : 'peek'
      else if (v < -0.6) next = snap === 'peek' ? 'half' : 'full'
      else next = Object.entries(hs).reduce((best, [k, val]) => (Math.abs(val - h) < Math.abs(hs[best] - h) ? k : best), 'peek')
      onSnap(next)
    }
    setDragY(null)
  }

  useEffect(() => {
    const onResize = () => setDragY(null)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const height = dragY ?? heights()[snap]
  return (
    <div
      ref={sheet}
      className={'sheet' + (dragY != null ? ' dragging' : '') + ` snap-${snap}`}
      style={{ height }}
      data-snap={SNAPS[snap]}
    >
      <div
        className="sheet-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="grabber" />
        <div className="sheet-peek">{peek}</div>
      </div>
      <div className="sheet-body">{children}</div>
    </div>
  )
}
