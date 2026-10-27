import Anthropic from '@anthropic-ai/sdk'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// Home Twin's AI helper. The site is public, so the Claude API key lives here
// as a secret (ANTHROPIC_API_KEY), and every request must carry the admin's
// Firebase sign-in token (checked against Google's public keys).
//
// POST /furniture-from-photo  { image: <base64 JPEG>, mediaType?, room? }
// POST /furniture-from-link   { url, room? }
//   -> { piece: { name, kind, w, d, h, estimated, brand, model, price, notes, look } }

const FIREBASE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const KINDS = ['bed', 'sofa', 'table', 'chair', 'stool', 'cabinet']

// How the piece looks, for drawing it in 3D (inches; colors as #rrggbb).
// Every field is required; "unknown", "" or 0 mean unknown or not relevant to
// the kind (the API takes no nullable enums), and come back to the app as null.
const nullable = (schema) =>
  schema.enum ? { ...schema, enum: [...schema.enum, 'unknown'] }
  : { ...schema, description: `${schema.description}; ${schema.type === 'string' ? '""' : '0'} if unknown` }
const lookOut = (look) =>
  Object.fromEntries(Object.entries(look ?? {}).map(([k, v]) => [k, v === 'unknown' || v === '' || v === 0 ? null : v]))
const LOOK_SCHEMA = {
  type: 'object',
  description: 'How the piece looks, so a simple 3D model can resemble it',
  properties: {
    main_color: nullable({ type: 'string', description: 'Main color (upholstery, wood or paint) as #rrggbb' }),
    accent_color: nullable({ type: 'string', description: 'Second color as #rrggbb: seat cushions if different, a table or dresser top, a mattress' }),
    leg_color: nullable({ type: 'string', description: 'Leg or base color as #rrggbb' }),
    arms: nullable({ type: 'string', enum: ['none', 'track', 'rounded', 'rolled', 'sloped'], description: 'Sofas and armchairs: track = square, straight-sided; rounded = straight-sided with a rounded top (mid-century); rolled = scrolled outward; sloped = lower toward the front' }),
    arm_height: nullable({ type: 'number', description: 'Top of the arms above the floor, inches' }),
    arm_width: nullable({ type: 'number', description: 'Width of one arm, inches' }),
    back: nullable({ type: 'string', enum: ['tight', 'cushions', 'tufted'], description: 'tight = upholstered flat back; cushions = loose back cushions; tufted = buttoned or channel tufting' }),
    seat_height: nullable({ type: 'number', description: 'Top of the seat above the floor, inches' }),
    seat_cushions: nullable({ type: 'integer', description: 'Number of separate seat cushions (1 = one bench cushion)' }),
    pillows: nullable({ type: 'integer', description: 'Throw pillows shown' }),
    leg_style: nullable({ type: 'string', enum: ['none', 'block', 'tapered', 'splayed', 'turned', 'metal'], description: 'none = sits on a base or skirt; splayed = tapered legs angled outward (mid-century); metal = thin metal legs or frame' }),
    leg_height: nullable({ type: 'number', description: 'Visible leg height, inches' }),
    top_shape: nullable({ type: 'string', enum: ['rectangle', 'round', 'oval'], description: 'Tables' }),
    table_base: nullable({ type: 'string', enum: ['four_legs', 'pedestal', 'trestle'], description: 'Tables' }),
    headboard: nullable({ type: 'string', enum: ['none', 'panel', 'upholstered', 'slatted'], description: 'Beds' }),
    headboard_height: nullable({ type: 'number', description: 'Beds: top of the headboard above the floor, inches' }),
    drawers: nullable({ type: 'integer', description: 'Dressers, nightstands, cabinets: drawers across the front, counting all rows' }),
    drawer_columns: nullable({ type: 'integer', description: 'Dressers: drawers side by side in a row' }),
    doors: nullable({ type: 'integer', description: 'Cabinets, TV stands, sideboards: doors across the front' }),
  },
  required: [
    'main_color', 'accent_color', 'leg_color', 'arms', 'arm_height', 'arm_width', 'back', 'seat_height', 'seat_cushions', 'pillows',
    'leg_style', 'leg_height', 'top_shape', 'table_base', 'headboard', 'headboard_height', 'drawers', 'drawer_columns', 'doors',
  ],
  additionalProperties: false,
}

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
    notes: { type: ['string', 'null'], description: 'Product details worth keeping, such as color, material, size option or SKU, in under 15 words; or null. Not how you found it.' },
    look: LOOK_SCHEMA,
  },
  required: ['name', 'kind', 'w', 'd', 'h', 'estimated', 'brand', 'model', 'price', 'notes', 'look'],
  additionalProperties: false,
}

const RULES = `- Width is side to side, depth front to back, height floor to top. Convert centimeters (or feet) to inches. When dimensions aren't labeled, use the usual order for that kind of furniture.
- kind is the closest of: bed, sofa (sofas, sectionals, armchairs), table (tables, desks), chair, stool, cabinet (dressers, nightstands, bookcases, TV stands, storage, anything else).
- Keep name short. Use null for anything you couldn't find.
- look describes its appearance for a simple 3D model: colors as you see them (or as the color name suggests, e.g. "dark gray linen" #4a4b4f), and the parts that apply to its kind. Fill in what the photos or description show; estimate heights from the proportions; leave the rest unknown. From a link, take the look from the description, the features and the color option named.`

const PHOTO_PROMPT = `This photo is either a furniture store tag or label, or a piece of furniture itself.
Return the piece for placing in a 3D model of a house.
- Read the dimensions from the tag when it shows them.
- With no tag, or no dimensions on it, estimate the size from the photo and set estimated to true.
${RULES}`

const linkPrompt = (url) => `Return the furniture product at this link for placing in a 3D model of a house: ${url}
- Open the page and read the product's name, overall dimensions, brand, model and price. If the page can't be read, search the web for the same product (from the store and words in the link).
- When several sizes or configurations are listed, use the one the link points to, or else the most common one, and say which in notes.
- If no dimensions can be found anywhere, estimate them for that product and set estimated to true.
${RULES}`

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

// One piece from Claude: `content` is the user turn, `tools` any server tools
// (web fetch and search for a link). A server-tool turn can pause; it is
// resumed by sending the conversation back as it is.
async function readPiece(env, content, tools, what) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const messages = [{ role: 'user', content }]
  let response
  for (let turn = 0; turn < 5; turn++) {
    response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      // a declined request is retried on Anthropic's recommended model for that case
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PIECE_SCHEMA } },
      ...(tools ? { tools } : {}),
      messages,
    })
    if (response.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: response.content })
  }
  if (response.stop_reason === 'refusal') return [{ error: `Claude declined to read this ${what}. Try another one.` }, 422]
  if (response.stop_reason === 'max_tokens' || response.stop_reason === 'pause_turn') return [{ error: 'The answer was cut off. Try again.' }, 502]
  // the structured answer is the last text block (web tools add others before it)
  const text = response.content.filter((b) => b.type === 'text').at(-1)?.text
  let piece
  try {
    piece = JSON.parse(text)
    piece.look = lookOut(piece.look)
  } catch {
    return [{ error: 'Could not read the answer. Try again.' }, 502]
  }
  return [{ piece, usage: response.usage }, 200]
}

const forRoom = (prompt, room) => (room ? `${prompt}\nIt is going in the ${room}.` : prompt)

async function furnitureFromPhoto(body, env) {
  const { image, mediaType = 'image/jpeg', room } = body ?? {}
  if (typeof image !== 'string' || !image) return [{ error: 'No photo was sent.' }, 400]
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return [{ error: 'The photo is too large.' }, 413]
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) return [{ error: 'Send a JPEG, PNG or WebP photo.' }, 400]
  return readPiece(
    env,
    [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
      { type: 'text', text: forRoom(PHOTO_PROMPT, room) },
    ],
    null,
    'photo',
  )
}

async function furnitureFromLink(body, env) {
  const { url, room } = body ?? {}
  let link
  try {
    link = new URL(url)
  } catch {
    return [{ error: 'That is not a link. Paste the product page address.' }, 400]
  }
  if (!['http:', 'https:'].includes(link.protocol) || url.length > 2000) return [{ error: 'Paste a web page link (https://...).' }, 400]
  return readPiece(
    env,
    [{ type: 'text', text: forRoom(linkPrompt(link.href), room) }],
    [
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 },
      { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
    ],
    'link',
  )
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
      const handler = { '/furniture-from-photo': furnitureFromPhoto, '/furniture-from-link': furnitureFromLink }[path]
      if (handler) {
        const [result, status] = await handler(body, env)
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
