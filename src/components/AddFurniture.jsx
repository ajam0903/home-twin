import { useEffect, useRef, useState } from 'react'
import { furnitureFromPhoto, furnitureFromLink, furnitureFromText } from '../model/ai.js'
import { Icon } from './Icons.jsx'
import { pointInPoly } from '../model/house.js'
import { feetInches } from '../model/furniture.js'

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

// What Claude is doing while it reads, step by step (a link takes longest)
const STEPS = {
  photo: ['Looking at the photo', 'Reading the shape and any tag', 'Working out the size', 'Picking the colors and legs'],
  link: ['Opening the product page', 'Reading the details', 'Finding the dimensions', 'Working out the look'],
  description: ['Reading your description', 'Thinking it through', 'Working out the size', 'Shaping the 3D piece'],
}
const STEP_SECONDS = 4

const bbox = (poly) => {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
}

// The room a new or restyled piece goes in, for Claude: its size and what is
// already there, so "this room", a size that fits or "to match the couch"
// make sense
export function roomContext(room, furniture = [], except) {
  if (!room) return null
  const [w, d] = bbox(room.poly)
  const pieces = furniture
    .filter((f) => f.id !== except && f.level === room.level && pointInPoly([f.x, f.y], room.poly))
    .map((f) => `${f.name} (${f.kind}, ${f.w} x ${f.d} x ${f.h} in${f.look?.main_color ? `, ${f.look.main_color}` : ''})`)
  return { name: room.name, size: room.dims ?? `about ${feetInches(w * 12)} x ${feetInches(d * 12)}`, ceiling: room.ceiling, pieces }
}

// Read a piece through the AI helper from what the owner gave: a photo (of the
// piece or its store tag) with any words about it, a product link (the rest of
// the text goes along), or a description alone. Calls onRead(piece, what).
function useReader(room) {
  const [state, setState] = useState({ step: 'idle' })
  const read = async ({ text, file }, onRead) => {
    const url = file ? null : linkIn(text)
    const note = url ? text.replace(url, '').trim() : text.trim()
    const what = file ? 'photo' : url ? 'link' : 'description'
    setState({ step: 'reading', what })
    try {
      const p = file
        ? await furnitureFromPhoto(file, room, note)
        : url ? await furnitureFromLink(url, room, note)
        : await furnitureFromText(note, room)
      onRead({ ...p, w: Math.round(p.w), d: Math.round(p.d), h: Math.round(p.h) }, what)
      setState({ step: 'done', what })
    } catch (err) {
      setState({ step: 'error', message: err.message })
    }
  }
  return [state, setState, read]
}

// While Claude reads: a moving bar, the step it is on and the seconds so far
function Thinking({ what }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(t)
  }, [])
  const steps = STEPS[what]
  const step = steps[Math.min(steps.length - 1, Math.floor(secs / STEP_SECONDS))]
  return (
    <div className="thinking" role="status">
      <span className="thinking-icon">
        <Icon.sofa width={16} height={16} />
      </span>
      <span className="thinking-step" key={step}>
        {step}
        <span className="thinking-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="thinking-secs">{secs} s</span>
    </div>
  )
}

// One field for everything: type a description, paste a link (or an image),
// or attach a photo with the camera button. Enter sends. What was sent stays
// in the field while Claude reads, and after an error to try again.
// action: the send button's words, [idle, while Claude works]
function PromptBox({ id, state, onSend, action, placeholder = 'Describe, paste a link or attach a photo' }) {
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
            {reading ? action[1] : action[0]}
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
      {reading && <Thinking what={state.what} />}
      {state.step === 'error' && <p className="photo-error">{state.message}</p>}
    </div>
  )
}

// The one Add furniture button: opens a card to add a piece from a
// description, a product link or a photo (of the item or its tag), which
// Claude reads and the owner checks, or a standard piece from the list.
export default function AddFurniture({ placeName, room, furniture, presets, ai, onAdd }) {
  const [open, setOpen] = useState(false)
  const context = roomContext(room, furniture)
  const [state, setState, read] = useReader(context)
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
            <>
              <p className="add-card-context">
                {context
                  ? `Claude knows the ${context.name}: ${context.size}, ${context.pieces.length ? `${context.pieces.length} piece${context.pieces.length > 1 ? 's' : ''} in it` : 'empty so far'}.`
                  : 'Select a room first and Claude will size the piece to fit it.'}
              </p>
              <PromptBox id="furniture-prompt" state={state} action={['Create', 'Creating...']} onSend={(s) => read(s, setPiece)} />
            </>
          )}
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
export function RestyleFurniture({ piece, room, furniture, onChange }) {
  const [state, setState, read] = useReader(roomContext(room, furniture, piece.id))
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
      {!reviewing && <PromptBox id="restyle-prompt" state={state} action={['Restyle', 'Restyling...']} onSend={(s) => read(s, setFound)} />}
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
