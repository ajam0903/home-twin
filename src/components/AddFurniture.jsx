import { useEffect, useRef, useState } from 'react'
import { furnitureFromPhoto, furnitureFromLink, furnitureFromText } from '../model/ai.js'
import { Icon } from './Icons.jsx'

const KINDS = [
  ['sofa', 'Sofa or chair'],
  ['bed', 'Bed'],
  ['table', 'Table or desk'],
  ['chair', 'Dining chair'],
  ['stool', 'Stool'],
  ['cabinet', 'Dresser, shelf or other'],
]

// The first web link in text (a share often adds a title around it)
const linkIn = (text) => text.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\].,;]+$/, '')

// The look without its empty parts (what a piece stores)
const compactLook = (look) => {
  const out = Object.fromEntries(Object.entries(look ?? {}).filter(([, v]) => v != null))
  return Object.keys(out).length ? out : undefined
}
const infoOf = (p) => [p.brand, p.model, p.price, p.notes].filter(Boolean).join(' · ') || undefined

const WAIT = {
  photo: 'Reading the photo...',
  link: 'Opening the product page. A link can take up to half a minute.',
  description: 'Reading your description...',
}

// Read a piece through the AI helper from what the owner gave: a photo (of the
// piece or its store tag) with any words about it, a product link (the rest of
// the text goes along), or a description alone. Calls onRead(piece, what).
function useReader(roomName) {
  const [state, setState] = useState({ step: 'idle' })
  const read = async ({ text, file }, onRead) => {
    const url = file ? null : linkIn(text)
    const note = url ? text.replace(url, '').trim() : text.trim()
    const what = file ? 'photo' : url ? 'link' : 'description'
    setState({ step: 'reading', what })
    try {
      const p = file
        ? await furnitureFromPhoto(file, roomName, note)
        : url ? await furnitureFromLink(url, roomName, note)
        : await furnitureFromText(note, roomName)
      onRead({ ...p, w: Math.round(p.w), d: Math.round(p.d), h: Math.round(p.h) }, what)
      setState({ step: 'done', what })
    } catch (err) {
      setState({ step: 'error', message: err.message })
    }
  }
  return [state, setState, read]
}

// One field for everything: type a description, paste a link (or an image),
// or attach a photo with the camera button. Enter sends.
function PromptBox({ id, state, onSend, placeholder = 'Describe, paste a link or attach a photo' }) {
  const input = useRef(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const reading = state.step === 'reading'

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const send = () => {
    if (reading || (!text.trim() && !file)) return
    onSend({ text, file })
    setText('')
    setFile(null)
  }

  return (
    <div className="prompt-wrap">
      <form
        className={'prompt-box' + (reading ? ' busy' : '')}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        {preview && (
          <div className="prompt-photo">
            <img src={preview} alt="Attached photo" />
            <button type="button" className="prompt-photo-x" onClick={() => setFile(null)} aria-label="Remove the photo" disabled={reading}>
              <Icon.close width={12} height={12} />
            </button>
          </div>
        )}
        <textarea
          id={id}
          rows={2}
          value={text}
          placeholder={file ? 'Add a note (optional)' : placeholder}
          aria-label="Describe the piece, paste a link or attach a photo"
          disabled={reading}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          onPaste={(e) => {
            // a pasted image becomes the attached photo
            const image = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
            if (image) {
              e.preventDefault()
              setFile(image)
            }
          }}
        />
        <div className="prompt-actions">
          <button type="button" className="icon-btn ghost" onClick={() => input.current?.click()} aria-label="Attach a photo" title="Attach a photo" disabled={reading}>
            <Icon.camera width={18} height={18} />
          </button>
          <button type="submit" className="btn prompt-send" disabled={reading || (!text.trim() && !file)}>
            {reading ? 'Reading...' : 'Read'}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setFile(f)
            e.target.value = ''
          }}
        />
      </form>
      {reading && <p className="muted">{WAIT[state.what]}</p>}
      {state.step === 'error' && <p className="photo-error">{state.message}</p>}
    </div>
  )
}

// The one Add furniture button: opens a card to add a piece from a
// description, a product link or a photo (of the item or its tag), which
// Claude reads and the owner checks, or a standard piece from the list.
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
          {ai && <PromptBox id="furniture-prompt" state={state} onSend={(s) => read(s, setPiece)} />}
          <select
            className="preset-select"
            value=""
            disabled={state.step === 'reading'}
            onChange={(e) => {
              if (e.target.value === '') return
              onAdd(presets[Number(e.target.value)])
              close()
            }}
            aria-label="Add a standard piece"
          >
            <option value="">{ai ? 'Or pick a standard piece...' : 'Pick a standard piece...'}</option>
            {presets.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name} ({p.w}" x {p.d}")
              </option>
            ))}
          </select>
        </>
      )}
      {reviewing && (
        <div className="photo-review">
          <p className="kicker">
            {{ link: 'From the link', photo: 'From the photo', description: 'From your description' }[state.what]}
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

// Make a placed piece look like the real one, from a photo of it, its product
// link or a description. Its place stays; the size changes only when asked.
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
      {!reviewing && <PromptBox id="restyle-prompt" state={state} onSend={(s) => read(s, setFound)} />}
      {reviewing && (
        <div className="photo-review">
          <p className="kicker">{{ link: 'From the link', photo: 'From the photo', description: 'From your description' }[state.what]}</p>
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
