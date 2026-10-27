import { useRef, useState } from 'react'
import { furnitureFromPhoto, furnitureFromLink } from '../model/ai.js'
import { Icon } from './Icons.jsx'

const KINDS = [
  ['sofa', 'Sofa or chair'],
  ['bed', 'Bed'],
  ['table', 'Table or desk'],
  ['chair', 'Dining chair'],
  ['stool', 'Stool'],
  ['cabinet', 'Dresser, shelf or other'],
]

// The first web link in pasted text (a share often adds a title around it)
const linkIn = (text) => text.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\].,;]+$/, '')

// The look without its empty parts (what a piece stores)
const compactLook = (look) => {
  const out = Object.fromEntries(Object.entries(look ?? {}).filter(([, v]) => v != null))
  return Object.keys(out).length ? out : undefined
}
const infoOf = (p) => [p.brand, p.model, p.price, p.notes].filter(Boolean).join(' · ') || undefined

// Read a piece through the AI helper from a photo (of its store tag, or of the
// piece itself) or from a link to its product page. Calls onRead(piece, what).
function useReader(roomName) {
  const [state, setState] = useState({ step: 'idle' })
  const read = async (source, onRead) => {
    const what = source.url ? 'link' : 'photo'
    setState({ step: 'reading', what })
    try {
      const p = source.url ? await furnitureFromLink(source.url, roomName) : await furnitureFromPhoto(source.file, roomName)
      onRead({ ...p, w: Math.round(p.w), d: Math.round(p.d), h: Math.round(p.h) }, what)
      setState({ step: 'done', what })
    } catch (err) {
      setState({ step: 'error', message: err.message })
    }
  }
  return [state, setState, read]
}

function SourcePicker({ id, state, setState, onSource, photoLabel }) {
  const input = useRef(null)
  const [link, setLink] = useState('')
  const reading = state.step === 'reading'
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onSource({ file })
          e.target.value = ''
        }}
      />
      <button type="button" className="add-furniture photo" onClick={() => input.current?.click()} disabled={reading}>
        <Icon.camera width={16} height={16} />
        <span>{reading && state.what === 'photo' ? 'Reading the photo...' : photoLabel}</span>
      </button>
      <form
        className="link-furniture"
        onSubmit={(e) => {
          e.preventDefault()
          const url = linkIn(link)
          if (url) {
            setLink('')
            onSource({ url })
          } else setState({ step: 'error', message: 'Paste a product page link (https://...).' })
        }}
      >
        <input
          id={id}
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPaste={(e) => {
            // a shared link often arrives with a title around it
            const url = linkIn(e.clipboardData.getData('text'))
            if (url) {
              e.preventDefault()
              setLink(url)
            }
          }}
          placeholder="Or paste a product link"
          aria-label="Product link"
          disabled={reading}
        />
        <button type="submit" className="btn" disabled={!link.trim() || reading}>
          {reading && state.what === 'link' ? 'Reading...' : 'Read'}
        </button>
      </form>
      {reading && state.what === 'link' && <p className="muted">Opening the product page. A link can take up to half a minute.</p>}
      {state.step === 'error' && <p className="photo-error">{state.message}</p>}
    </>
  )
}

// The one Add furniture button: opens a card to add a piece from a photo (of
// the item or its store tag) or a product link, which Claude reads and the
// owner checks, or a standard piece in one tap.
export default function AddFurniture({ placeName, roomName, presets, ai, onAdd }) {
  const [open, setOpen] = useState(false)
  const [state, setState, read] = useReader(roomName)
  const [piece, setPiece] = useState(null)
  const close = () => {
    setOpen(false)
    setPiece(null)
    setState({ step: 'idle' })
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
  const reviewing = state.step === 'done' && piece

  if (!open) {
    return (
      <button type="button" className="add-furniture-btn" onClick={() => setOpen(true)}>
        <Icon.plus width={18} height={18} />
        <span>Add furniture</span>
      </button>
    )
  }
  return (
    <div className="add-card">
      <div className="add-card-head">
        <span className="kicker">Add to {placeName}</span>
        <button type="button" className="icon-btn ghost" onClick={close} aria-label="Close">
          <Icon.close width={16} height={16} />
        </button>
      </div>
      {!reviewing && (
        <>
          {ai && (
            <div className="photo-furniture">
              <SourcePicker id="furniture-link" state={state} setState={setState} photoLabel="Photo of the item or its tag" onSource={(s) => read(s, setPiece)} />
            </div>
          )}
          <p className="add-card-sub">{ai ? 'Or a standard piece' : 'A standard piece'}</p>
          <div className="preset-grid">
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                className="preset"
                disabled={state.step === 'reading'}
                onClick={() => {
                  onAdd(p)
                  close()
                }}
              >
                <span>{p.name}</span>
                <em>
                  {p.w}" x {p.d}"
                </em>
              </button>
            ))}
          </div>
        </>
      )}
      {reviewing && (
        <div className="photo-review">
          <p className="kicker">
            {state.what === 'link' ? 'From the link' : 'From the photo'}
            {piece.estimated ? ' · size estimated, check it' : ''}
          </p>
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
          {infoOf(piece) && <p className="muted">{infoOf(piece)}</p>}
          <div className="button-row">
            <button
              type="button"
              className="btn"
              disabled={!valid}
              onClick={() => {
                onAdd({
                  kind: piece.kind, name: piece.name.trim(), w: Number(piece.w), d: Number(piece.d), h: Number(piece.h),
                  info: infoOf(piece), look: compactLook(piece.look),
                })
                close()
              }}
            >
              Add to {placeName}
            </button>
            <button type="button" className="btn" onClick={() => setState({ step: 'idle' })}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Make a placed piece look like the real one, from a photo of it or its
// product link. Its place stays; the size changes only when asked.
export function RestyleFurniture({ piece, roomName, onChange }) {
  const [state, setState, read] = useReader(roomName)
  const [found, setFound] = useState(null)
  const reviewing = state.step === 'done' && found
  const apply = (withSize) => {
    onChange({
      kind: found.kind, look: compactLook(found.look) ?? null, info: infoOf(found) ?? null,
      ...(withSize ? { w: found.w, d: found.d, h: found.h } : {}),
    })
    setFound(null)
    setState({ step: 'idle' })
  }
  const sameSize = found && found.w === piece.w && found.d === piece.d && found.h === piece.h

  return (
    <div className="photo-furniture restyle">
      <p className="muted">Doesn't look right? Show Claude the real piece and its 3D shape will follow: colors, arms, back, cushions, legs.</p>
      {!reviewing && (
        <SourcePicker id="restyle-link" state={state} setState={setState} photoLabel="Restyle from a photo" onSource={(s) => read(s, setFound)} />
      )}
      {reviewing && (
        <div className="photo-review">
          <p className="kicker">{state.what === 'link' ? 'From the link' : 'From the photo'}</p>
          <p>
            <strong>{found.name}</strong>
            <br />
            <span className="muted">
              {found.w} x {found.d} x {found.h} in{found.estimated ? ' (estimated)' : ''}
              {infoOf(found) ? ` · ${infoOf(found)}` : ''}
            </span>
          </p>
          <div className="button-row">
            <button type="button" className="btn" onClick={() => apply(false)}>
              Apply the look
            </button>
            {!sameSize && !found.estimated && (
              <button type="button" className="btn" onClick={() => apply(true)}>
                Look and size
              </button>
            )}
            <button type="button" className="btn" onClick={() => setState({ step: 'idle' })}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
