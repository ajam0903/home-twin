import { useCallback, useEffect, useRef, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { firebaseConfig, ADMIN_UIDS } from '../firebaseConfig.js'

// Shared house data: one Firestore document (homes/orchard) with the room
// notes, the saved measurements and the furniture layout. Everyone who opens
// the app reads it; only the admin's account may write (firestore.rules).
// Each browser keeps a copy, so the app starts with the last data it saw.

// ?local=1 (dev server only) keeps edits in this browser, for testing
// without touching the shared data
const localOnly = import.meta.env.DEV && new URLSearchParams(window.location.search).has('local')
export const sharingEnabled = !!firebaseConfig && !localOnly

const app = sharingEnabled ? initializeApp(firebaseConfig) : null
const db = app ? getFirestore(app) : null
const auth = app ? getAuth(app) : null
const homeRef = () => doc(db, 'homes', 'orchard')

export const isAdmin = (user) => !!user && ADMIN_UIDS.includes(user.uid)
export const signInAdmin = () => signInWithPopup(auth, new GoogleAuthProvider())
export const signOutAdmin = () => signOut(auth)

// Replace the given top-level fields (each whole), leaving the others
function writeHome(fields) {
  const clean = JSON.parse(JSON.stringify(fields)) // Firestore refuses undefined values
  return setDoc(homeRef(), { ...clean, updatedAt: serverTimestamp() }, { mergeFields: [...Object.keys(clean), 'updatedAt'] })
}

// The signed-in user and the shared document ({ loaded, data }; data is null
// until the document exists)
export function useSharedHome() {
  const [user, setUser] = useState(null)
  const [home, setHome] = useState({ loaded: !sharingEnabled, data: null, error: null })
  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : undefined), [])
  useEffect(() => {
    if (!db) return undefined
    return onSnapshot(
      homeRef(),
      (snap) => setHome({ loaded: true, data: snap.exists() ? snap.data() : null, error: null }),
      (error) => {
        console.warn('Shared house data unavailable', error)
        setHome((h) => ({ ...h, loaded: true, error }))
      },
    )
  }, [])
  const admin = isAdmin(user)
  return { user, admin, editable: !sharingEnabled || admin, ...home }
}

// One shared field. It starts from this browser's copy, follows the shared
// document, and (for the admin) writes edits back a moment after they stop.
// `toShared` turns the value into the document fields to write.
export function useSharedField(shared, field, { load, save, fromShared = (v) => v, toShared = (v) => ({ [field]: v }) }) {
  const [value, setValue] = useState(load)
  const dirty = useRef(false) // a local edit the server has not confirmed yet
  const generation = useRef(0)
  const timer = useRef(null)
  const latest = useRef(value)
  latest.current = value
  const canWrite = sharingEnabled && shared.admin

  const remote = shared.data?.[field]
  useEffect(() => {
    if (remote === undefined || dirty.current) return
    setValue(fromShared(remote, shared.data))
  }, [remote]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => save(value), [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(() => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    const gen = generation.current
    writeHome(toShared(latest.current))
      .then(() => {
        if (gen === generation.current) dirty.current = false
      })
      .catch((error) => {
        console.warn(`Could not save ${field}`, error)
        dirty.current = false
      })
  }, [field]) // eslint-disable-line react-hooks/exhaustive-deps

  // an edit by this browser (the shared document never comes back through here)
  const edit = useCallback(
    (update) => {
      setValue(update)
      if (!canWrite) return
      dirty.current = true
      generation.current++
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 600)
    },
    [canWrite, flush],
  )

  // don't lose the last keystrokes when the page is closed
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [flush])

  // Share this browser's copy now (moving local data into the shared document)
  const upload = useCallback(() => writeHome(toShared(latest.current)), []) // eslint-disable-line react-hooks/exhaustive-deps

  return [value, edit, { missing: shared.loaded && !shared.error && remote === undefined, upload }]
}
