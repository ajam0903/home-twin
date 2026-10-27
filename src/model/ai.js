import { adminIdToken } from './shared.js'

// Home Twin's AI helper: the Cloudflare Worker in worker/ holds the Claude API
// key and answers only the signed-in admin. Empty: the AI features are hidden.
export const AI_URL = 'https://home-twin-ai.ajamali0903.workers.dev'
export const aiAvailable = !!AI_URL

// A photo shrunk on the device (Claude reads 1568px on the long side well;
// larger only costs more) and turned into base64 JPEG
async function shrink(file, max = 1568) {
  const bitmap = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * k)
  canvas.height = Math.round(bitmap.height * k)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

async function call(path, body) {
  const token = await adminIdToken()
  if (!token) throw new Error('Sign in as the admin to use this.')
  let res
  try {
    res = await fetch(`${AI_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the AI helper. Check the connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `The AI helper failed (${res.status}).`)
  return data
}

// A furniture piece from a product page link (Claude opens the page, or
// searches for the product when the store blocks it); same shape as below.
// note: the owner's own words sent along, which win where they differ.
export async function furnitureFromLink(url, room, note) {
  const { piece } = await call('/furniture-from-link', { url, room, note })
  return piece
}

// A furniture piece read from a photo of its tag or of the piece itself:
// { name, kind, w, d, h (inches), estimated, brand, model, price, notes, look }
export async function furnitureFromPhoto(file, room, note) {
  const image = await shrink(file)
  const { piece } = await call('/furniture-from-photo', { image, mediaType: 'image/jpeg', room, note })
  return piece
}

// A furniture piece from the owner's description (Claude searches the web
// when it names a product); same shape as above
export async function furnitureFromText(text, room) {
  const { piece } = await call('/furniture-from-text', { text, room })
  return piece
}
