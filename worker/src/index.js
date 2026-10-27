import Anthropic from '@anthropic-ai/sdk'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// Home Twin's AI helper. The site is public, so the Claude API key lives here
// as a secret (ANTHROPIC_API_KEY), and every request must carry the admin's
// Firebase sign-in token (checked against Google's public keys).
//
// POST /furniture-from-photo  { image: <base64 JPEG>, mediaType?, room? }
//   -> { piece: { name, kind, w, d, h, estimated, brand, model, price, notes } }

const FIREBASE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const KINDS = ['bed', 'sofa', 'table', 'chair', 'stool', 'cabinet']

const PIECE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short name for the piece, e.g. "Sven sofa" or "Oak dresser"' },
    kind: { type: 'string', enum: KINDS },
    w: { type: 'number', description: 'Width in inches: side to side, seen from the front' },
    d: { type: 'number', description: 'Depth in inches: front to back' },
    h: { type: 'number', description: 'Height in inches' },
    estimated: { type: 'boolean', description: 'True when the size is a guess from the photo rather than read from a tag' },
    brand: { type: ['string', 'null'] },
    model: { type: ['string', 'null'] },
    price: { type: ['string', 'null'], description: 'Price as printed, with currency, or null' },
    notes: { type: ['string', 'null'], description: 'Anything worth keeping from the tag (color, material, SKU), or null' },
  },
  required: ['name', 'kind', 'w', 'd', 'h', 'estimated', 'brand', 'model', 'price', 'notes'],
  additionalProperties: false,
}

const PROMPT = `This photo is either a furniture store tag or label, or a piece of furniture itself.
Return the piece for placing in a 3D model of a house.
- Read the dimensions from the tag when it shows them. Width is side to side, depth front to back, height floor to top. Convert centimeters (or feet) to inches. Tags often print W x D x H; when they don't say, use the usual order for that kind of furniture.
- With no tag, or no dimensions on it, estimate the size from the photo and set estimated to true.
- kind is the closest of: bed, sofa (sofas, sectionals, armchairs), table (tables, desks), chair, stool, cabinet (dressers, nightstands, bookcases, TV stands, storage, anything else).
- Keep name short. Use null for anything the photo doesn't show.`

const json = (body, status, cors) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

function corsFor(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  if (!allowed.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// The signed-in admin, or null
async function admin(request, env) {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT}`,
      audience: env.FIREBASE_PROJECT,
    })
    const admins = env.ADMIN_UIDS.split(',').map((s) => s.trim())
    return admins.includes(payload.sub) ? payload.sub : null
  } catch {
    return null
  }
}

async function furnitureFromPhoto(body, env) {
  const { image, mediaType = 'image/jpeg', room } = body ?? {}
  if (typeof image !== 'string' || !image) return [{ error: 'No photo was sent.' }, 400]
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return [{ error: 'The photo is too large.' }, 413]
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) return [{ error: 'Send a JPEG, PNG or WebP photo.' }, 400]

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    // a declined request is retried on Anthropic's recommended model for that case
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: PIECE_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: room ? `${PROMPT}\nIt is going in the ${room}.` : PROMPT },
        ],
      },
    ],
  })
  if (response.stop_reason === 'refusal') return [{ error: 'Claude declined to read this photo. Try another one.' }, 422]
  if (response.stop_reason === 'max_tokens') return [{ error: 'The answer was cut off. Try again.' }, 502]
  const text = response.content.find((b) => b.type === 'text')?.text
  let piece
  try {
    piece = JSON.parse(text)
  } catch {
    return [{ error: 'Could not read the answer. Try again.' }, 502]
  }
  return [{ piece, usage: response.usage }, 200]
}

export default {
  async fetch(request, env) {
    const cors = corsFor(request, env)
    if (!cors) return new Response('Forbidden', { status: 403 })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors)
    if (!(await admin(request, env))) return json({ error: 'Sign in as the admin to use this.' }, 401, cors)

    const path = new URL(request.url).pathname
    try {
      const body = await request.json()
      if (path === '/furniture-from-photo') {
        const [result, status] = await furnitureFromPhoto(body, env)
        return json(result, status, cors)
      }
      return json({ error: 'Unknown request.' }, 404, cors)
    } catch (err) {
      // the API key: missing, wrong, expired or out of credits
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        return json({ error: 'The AI key is missing or has expired. Make a new key in the Claude Console and update the Worker.', code: 'key' }, 503, cors)
      }
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'Too many requests right now. Try again in a minute.' }, 429, cors)
      if (err instanceof Anthropic.BadRequestError) return json({ error: `Claude could not take this request: ${err.message}` }, 400, cors)
      if (err instanceof Anthropic.APIError) return json({ error: `Claude is unavailable (${err.status}). Try again.` }, 502, cors)
      return json({ error: 'Something went wrong. Try again.' }, 500, cors)
    }
  },
}
