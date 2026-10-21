import { Bytes, collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { firestore } from './shared.js'
import { BLUEPRINTS } from './house.js'

// The blueprint images are private: they live in Firestore, readable only by
// the admin's account (firestore.rules), not on the public site. Each sheet
// is blueprints/{id} ({ file, type, size, chunks }) with its bytes split
// across blueprints/{id}/chunks/{n} (a document holds at most 1 MiB).
// The originals stay on the owner's computer in private/blueprints (not in git).

const CHUNK = 700 * 1024
const urls = new Map() // file -> object URL (or a promise of one)

// An object URL for a sheet's image, loaded once per page
export function blueprintUrl(file) {
  if (!urls.has(file)) {
    const p = load(file).catch((err) => {
      urls.delete(file)
      throw err
    })
    urls.set(file, p)
  }
  return urls.get(file)
}

async function load(file) {
  const sheet = BLUEPRINTS.find((b) => b.file === file)
  const db = firestore()
  if (!db) {
    // no sharing (dev with ?local=1): the local copies, through the dev server
    if (import.meta.env.DEV) return `/private/blueprints/${file}`
    throw new Error('Blueprints are not available')
  }
  const meta = await getDoc(doc(db, 'blueprints', sheet.id))
  if (!meta.exists()) throw new Error(`${file} has not been uploaded`)
  const { chunks, type } = meta.data()
  const snap = await getDocs(collection(db, 'blueprints', sheet.id, 'chunks'))
  const parts = snap.docs.sort((a, b) => Number(a.id) - Number(b.id)).map((d) => d.data().data.toUint8Array())
  if (parts.length !== chunks) throw new Error(`${file} is incomplete (${parts.length} of ${chunks} parts)`)
  return URL.createObjectURL(new Blob(parts, { type }))
}

// Dev only, signed in as the admin: upload every sheet from private/blueprints
// (run window.__uploadBlueprints() in the browser console on the dev server)
export async function uploadBlueprintsFromLocal() {
  const db = firestore()
  const done = []
  for (const sheet of BLUEPRINTS) {
    const res = await fetch(`/private/blueprints/${sheet.file}`)
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) throw new Error(`${sheet.file}: not found in private/blueprints`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const count = Math.ceil(bytes.length / CHUNK)
    const batch = writeBatch(db)
    for (let i = 0; i < count; i++) {
      batch.set(doc(db, 'blueprints', sheet.id, 'chunks', String(i)), { data: Bytes.fromUint8Array(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)) })
    }
    await batch.commit()
    await setDoc(doc(db, 'blueprints', sheet.id), { file: sheet.file, type: res.headers.get('content-type'), size: bytes.length, chunks: count, updatedAt: serverTimestamp() })
    done.push(`${sheet.file} (${count})`)
  }
  return done
}
