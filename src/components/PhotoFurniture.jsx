import { useRef, useState } from 'react'
import { furnitureFromPhoto } from '../model/ai.js'
import { Icon } from './Icons.jsx'

const KINDS = [
  ['sofa', 'Sofa or chair'],
  ['bed', 'Bed'],
  ['table', 'Table or desk'],
  ['chair', 'Dining chair'],
  ['stool', 'Stool'],
  ['cabinet', 'Dresser, shelf or other'],
]

// Add a piece from a photo of its store tag (or of the piece itself): Claude
// reads it through the AI helper, then the owner checks the result and adds it.
export default function PhotoFurniture({ placeName, roomName, onAdd }) {
  const input = useRef(null)
  const [state, setState] = useState({ step: 'idle' })
  const [piece, setPiece] = useState(null)

  const read = async (file) => {
    if (!file) return
    setState({ step: 'reading' })
    try {
      const p = await furnitureFromPhoto(file, roomName)
      setPiece({ ...p, w: Math.round(p.w), d: Math.round(p.d), h: Math.round(p.h) })
      setState({ step: 'review' })
    } catch (err) {
      setState({ step: 'error', message: err.message })
    }
  }
  const set = (patch) => setPiece((p) => ({ ...p, ...patch }))
  const size = (key) => (
    <label className="field">
      <span>{{ w: 'Width', d: 'Depth', h: 'Height' }[key]}</span>
      <span className="with-unit">
        <input id={`photo-piece-${key}`} inputMode="decimal" value={piece[key]} onChange={(e) => set({ [key]: e.target.value })} />
        <em>in</em>
      </span>
    </label>
  )
  const valid = piece && piece.name.trim() && [piece.w, piece.d, piece.h].every((v) => Number(v) > 0 && Number(v) < 600)

  return (
    <div className="photo-furniture">
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          read(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {state.step !== 'review' && (
        <button type="button" className="add-furniture photo" onClick={() => input.current?.click()} disabled={state.step === 'reading'}>
          <Icon.camera width={16} height={16} />
          <span>{state.step === 'reading' ? 'Reading the photo...' : 'Add from a photo of the tag'}</span>
        </button>
      )}
      {state.step === 'error' && <p className="photo-error">{state.message}</p>}
      {state.step === 'review' && piece && (
        <div className="photo-review">
          <p className="kicker">From the photo{piece.estimated ? ' · size estimated, check it' : ''}</p>
          <label className="field">
            <span>Name</span>
            <input id="photo-piece-name" value={piece.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="field">
            <span>Kind</span>
            <select id="photo-piece-kind" value={piece.kind} onChange={(e) => set({ kind: e.target.value })}>
              {KINDS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="dims">
            {size('w')}
            {size('d')}
            {size('h')}
          </div>
          {(piece.brand || piece.model || piece.price || piece.notes) && (
            <p className="muted">{[piece.brand, piece.model, piece.price, piece.notes].filter(Boolean).join(' · ')}</p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="btn"
              disabled={!valid}
              onClick={() => {
                const info = [piece.brand, piece.model, piece.price, piece.notes].filter(Boolean).join(' · ')
                onAdd({ kind: piece.kind, name: piece.name.trim(), w: Number(piece.w), d: Number(piece.d), h: Number(piece.h), info: info || undefined })
                setPiece(null)
                setState({ step: 'idle' })
              }}
            >
              Add to {placeName}
            </button>
            <button type="button" className="btn" onClick={() => setState({ step: 'idle' })}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
