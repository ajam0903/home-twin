import { useCallback, useEffect, useRef, useState } from 'react'
import { BLUEPRINTS } from '../model/house.js'
import { Icon } from './Icons.jsx'

const src = (file) => `${import.meta.env.BASE_URL}blueprints/${file}`

export default function Blueprints({ compact }) {
  const [active, setActive] = useState(BLUEPRINTS[1].id)
  const sheet = BLUEPRINTS.find((b) => b.id === active)
  return (
    <div className={'blueprints' + (compact ? ' compact' : '')}>
      <nav className="sheet-list" aria-label="Drawing sheets">
        {BLUEPRINTS.map((b) => (
          <button key={b.id} type="button" className={'sheet-thumb' + (b.id === active ? ' on' : '')} onClick={() => setActive(b.id)}>
            <img src={src(b.file)} alt="" loading="lazy" />
            <span>
              <strong>{b.title}</strong>
              <em>
                {b.set} · Sheet {b.sheet}
              </em>
            </span>
          </button>
        ))}
      </nav>
      <PanZoom key={sheet.id} image={src(sheet.file)} alt={sheet.title} />
    </div>
  )
}

function PanZoom({ image, alt }) {
  const box = useRef(null)
  const img = useRef(null)
  const [t, setT] = useState({ s: 1, x: 0, y: 0 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  const fit = useCallback(() => {
    const b = box.current
    const i = img.current
    if (!b || !i || !i.naturalWidth) return
    const s = Math.min(b.clientWidth / i.naturalWidth, b.clientHeight / i.naturalHeight)
    setT({ s, x: (b.clientWidth - i.naturalWidth * s) / 2, y: (b.clientHeight - i.naturalHeight * s) / 2 })
  }, [])

  useEffect(() => {
    const ro = new ResizeObserver(fit)
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [fit])

  const zoomAt = (cx, cy, factor) =>
    setT((p) => {
      const s = Math.min(8, Math.max(0.05, p.s * factor))
      const k = s / p.s
      return { s, x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }
    })

  useEffect(() => {
    const el = box.current
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const local = (e) => {
    const r = box.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onDown = (e) => {
    box.current.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, local(e))
    gesture.current = null
  }
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    const prev = [...pointers.current.values()]
    pointers.current.set(e.pointerId, local(e))
    const now = [...pointers.current.values()]
    if (now.length === 1) {
      const dx = now[0].x - prev[0].x
      const dy = now[0].y - prev[0].y
      setT((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
    } else if (now.length === 2) {
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (now[0].x + now[1].x) / 2, y: (now[0].y + now[1].y) / 2 }
      const pmid = { x: (prev[0].x + prev[1].x) / 2, y: (prev[0].y + prev[1].y) / 2 }
      const k = dist(now[0], now[1]) / Math.max(1, dist(prev[0], prev[1]))
      setT((p) => {
        const s = Math.min(8, Math.max(0.05, p.s * k))
        const kk = s / p.s
        return { s, x: mid.x - (pmid.x - p.x) * kk, y: mid.y - (pmid.y - p.y) * kk }
      })
    }
  }
  const onUp = (e) => pointers.current.delete(e.pointerId)

  const center = () => ({ x: box.current.clientWidth / 2, y: box.current.clientHeight / 2 })

  return (
    <div className="panzoom-wrap">
      <div
        ref={box}
        className="panzoom"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => {
          const p = local(e)
          zoomAt(p.x, p.y, 2)
        }}
      >
        <img
          ref={img}
          src={image}
          alt={alt}
          draggable={false}
          onLoad={fit}
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}
        />
      </div>
      <div className="zoom-tools">
        <button type="button" className="icon-btn" onClick={() => zoomAt(center().x, center().y, 1.4)} aria-label="Zoom in">
          <Icon.plus />
        </button>
        <button type="button" className="icon-btn" onClick={() => zoomAt(center().x, center().y, 1 / 1.4)} aria-label="Zoom out">
          <Icon.minus />
        </button>
        <button type="button" className="icon-btn" onClick={fit} aria-label="Fit sheet">
          <Icon.fit />
        </button>
      </div>
    </div>
  )
}
