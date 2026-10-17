// Digital double of the house, transcribed from the architect's drawings
// (Roger C. Winkle, A.I.A., sheets 1-5, Jan. 25, 2001).
//
// Units are feet. Plan coordinates follow the drawings as printed:
//   x runs left to right (left side wall = 0, garage right wall = 57)
//   y runs rear to front (rear wall = 0, front of porch / garage = 36)
// Heights are feet above finished grade.
// Walls are drawn on their centerlines, and rooms tile those centerlines.

export const H = {
  grade: 0,
  basementFloor: -6,
  ff1: 2.5, // first finished floor
  ceil1: 11.5, // 9'-0" first floor ceiling
  ff2: 12.4,
  ceil2: 20.4, // 8'-0" second floor ceiling
  garageFloor: 0.3,
  garagePlate: 10.5, // top of plate (garage), 8'-0" above first floor
  porchFloor: 2.2,
}

export const LEVELS = [
  { id: 'L2', name: 'Second floor', short: '2nd', floor: H.ff2, height: 8 },
  { id: 'L1', name: 'First floor', short: '1st', floor: H.ff1, height: 9 },
  { id: 'B', name: 'Basement', short: 'Bsmt', floor: H.basementFloor, height: 8 },
]

export const levelById = Object.fromEntries(LEVELS.map((l) => [l.id, l]))

// Points of interest on the lot use the pseudo level 'site' (shown with the
// whole-house view).
export const levelName = (id) => (id === 'site' || id === 'exterior' ? 'Property' : levelById[id]?.name)

// The backyard falls away from the house: the deck sits about 5'-4" above
// grade at its outer edge (deck sheet A-1), then the ground keeps easing down
// toward the woods and the flood limit at the back of the lot. Flat in front.
export function gradeAt(y) {
  if (y >= 0) return 0
  if (y >= -20) return 0.16 * y
  return Math.max(-5.5, -3.2 + (y + 20) * 0.025)
}

// ---------------------------------------------------------------- property
// Rough sizes of the plantings today (about 2 years old), in feet.
export const PLANT_TYPES = {
  thuja: { name: 'Thuja Green Giant arborvitae', height: 8, spread: 3.2 },
  serviceberry: { name: `Autumn Brilliance serviceberry`, height: 8, spread: 5 },
  cherry: { name: 'Double pink weeping cherry', height: 6.5, spread: 6 },
}

// `count` plants evenly spaced along a line, each centered in its share of it.
function plantRow(kind, [ax, ay], [bx, by], count) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count
    return { kind, at: [ax + (bx - ax) * t, ay + (by - ay) * t] }
  })
}

// From the property survey of Lot 56.01, Block 216 (scanned, to scale).
// Lot lines are square to the house; plan coordinates as above.
const LOT = { x0: -9.5, x1: 65.5, y0: -90.35, y1: 84.65 } // 75.00' x 175.00'
export const SITE = {
  lot: LOT,
  // Required setback lines drawn on the survey
  setbacks: { front: 25, rear: 25, left: 10, right: 8 },
  // Bearing of the side lines is N 08 deg 32' E, so deed north is 8.53 deg
  // counterclockwise from "up" on the plans (toward the rear, -y).
  northDeg: 8.53,
  curbY: LOT.y1 + 11.6, // concrete curb on Orchard Street
  roadWidth: 30,
  drive: { x0: 36.17, x1: 57 }, // asphalt, garage doors to the street
  neighborDrive: { x0: -18.5, x1: LOT.x0 + 0.3, y0: 23 }, // Lot 58 B, 0.3' over the line
  walk: { x0: 16.2, x1: 36.17, y0: 36, y1: 44.2 }, // concrete at the porch steps
  // 100-year flood limit, crossing the rear-left corner of the lot
  flood: [[-19.8, -56.35], [-9.5, -59.25], [0.4, -65.05], [38.6, -90.35]],
  // Edge of woods as surveyed (before the 2020 deck)
  woods: [
    [-21.6, -31.25], [-9.5, -30.95], [0.1, -30.15], [5.7, -30.95], [10.6, -28.35], [15.5, -25.25],
    [24.6, -21.35], [31.6, -15.65], [42.1, -9.65], [52.6, -4.25], [58.2, -2.15], [64.8, -1.05], [74, -10],
  ],
  // Fences around the backyard (owner's markup and notes, 2026-10-17).
  // The wood stockade fence the survey shows on the right line is gone.
  fences: [
    // 6' white vinyl: off the left wall of the house to the left line, then back along it
    { kind: 'vinyl', height: 6, pts: [[-0.25, 17.5], [LOT.x0 + 0.15, 17.5], [LOT.x0 + 0.15, -22]] },
    // 4' chain link: rest of the left line, then across on the back lot line
    { kind: 'chainlink', height: 4, pts: [[LOT.x0 + 0.15, -22], [LOT.x0 + 0.15, LOT.y0 + 0.15], [LOT.x1 - 0.15, LOT.y0 + 0.15]] },
    // 6' white vinyl: right line, from the back lot line forward to the gate
    { kind: 'vinyl', height: 6, pts: [[LOT.x1 - 0.15, LOT.y0 + 0.15], [LOT.x1 - 0.15, 6.5]] },
  ],
  // Between the garage's right wall and the right line: a fixed white vinyl
  // panel, then a single gate hinged on its left (garage) side.
  gate: { a: [57.25, 6.5], b: [LOT.x1 - 0.15, 6.5], hingeX: 61.3, height: 6 },
  // Plantings, all about 2 years old (owner, 2026-10-17). Sizes are estimates.
  plants: [
    // 12 Thuja Green Giant arborvitae, evenly spaced 3' in front of the back fence
    ...plantRow('thuja', [LOT.x0, LOT.y0 + 3.15], [LOT.x1, LOT.y0 + 3.15], 12),
    // 4 each behind the house, out past the garage side and the chimney side
    ...plantRow('thuja', [54.6, -0.3], [54.6, -19.8], 4),
    ...plantRow('thuja', [-2.8, -1.9], [-2.8, -19.4], 4),
    { kind: 'serviceberry', at: [27.6, -29.1] },
    { kind: 'cherry', at: [8.9, -29.1] },
  ],
  pole: [71.4, 93.75], // utility pole by the P.O.B.
  // Overhead service drop lands high on the garage's right side wall and runs
  // down the wall to the meter, about 7.5' back from the front corner.
  service: { x: 57.25, y: 28.5, attachZ: 15, meterZ: 5 },
  corners: [
    { at: [LOT.x1, LOT.y1], label: 'Iron bar found (P.O.B.)' },
    { at: [LOT.x1, LOT.y0], label: `Iron pipes found, 0.5' S / 0.3' E and 0.2' S` },
    { at: [LOT.x0, LOT.y0], label: 'Iron pipe with cap' },
    { at: [LOT.x0, LOT.y1], label: 'Front left corner (no marker noted)' },
  ],
}

// Kitchen bay, cantilevered off the rear wall (centerlines). Sizes from the
// deck plan's outline of the house: 9'-3" at the wall, 6'-0" face, 1'-7" out.
const BAY = [[16.68, 0], [18.3, -1.62], [24.3, -1.62], [25.92, 0]]

// ---------------------------------------------------------------- deck
// Trex deck built in 2020 (Jeffrey A. Fleisher, AIA, project 2001-71, sheets
// A-1 to A-4). The deck plan draws the bay about 4' closer to the garage than
// the 2001 house plans do; the deck is placed by the bay it wraps around.
// The owner confirmed (2026-10-17) that the 2001 bay position is right: the
// real deck stair stops short of the house corner, as modeled here.
// `d` below is the distance out from the face of the rear wall.
const WALL_FACE = -0.25
export const deckY = (d) => WALL_FACE - d

export const DECK = {
  top: H.ff1 - 0.12, // just below the kitchen floor, ledger on the rim joist
  x0: 8.05, // far end (family room side)
  x1: 28.05, // 20'-0" along the house
  depth: 18,
  landing: { x0: 28.05, x1: 32.05, depth: 4 }, // 4'-0" x 4'-0", stair side
  stair: { x0: 28.05, x1: 32.05, from: 4, treads: 7, run: 6.43 }, // DN away from the house
  pad: { depth: 1 }, // 1' x 4' x 4" concrete pad at the bottom
  joistBottom: 0.69, // 5/4 decking + 2x8 joists
  beams: [8, 16], // (3) 2x10 beams, 2'-0" cantilever past the outer one
  // 6x6 PT posts on Goliath Tech helical piers: [x, d, footing no., required load lb]
  posts: [
    [31.78, 3.75, 1, 246],
    [26.05, 8, 2, 2992], [18.05, 8, 3, 3638], [10.05, 8, 4, 2880],
    [26.05, 16, 5, 2155], [18.05, 16, 6, 2880], [10.05, 16, 7, 2155],
  ],
  // Vinyl rail posts [x, d]; `light` = post cap light
  rails: [
    // far side, outer edge and stair side, at deck level
    { level: 'deck', posts: [[8.2, 0.15], [8.2, 5.95, 'light'], [8.2, 11.97, 'light'], [8.2, 17.85]] },
    { level: 'deck', posts: [[8.2, 17.85], [14.67, 17.85, 'light'], [21.34, 17.85, 'light'], [27.9, 17.85]] },
    { level: 'deck', posts: [[27.9, 17.85], [27.9, 10.7, 'light'], [27.9, 3.74, 'light']] },
    // landing, then down the stair
    { level: 'deck', posts: [[31.9, 0.15], [31.9, 3.74, 'light']] },
    { level: 'stair', posts: [[31.9, 3.74, 'light'], [31.9, 10.17, 'light']] },
  ],
}

const DECK_POLY = [
  [DECK.x0, WALL_FACE],
  [BAY[0][0] - 0.25, WALL_FACE],
  [BAY[1][0] - 0.1, BAY[1][1] - 0.25],
  [BAY[2][0] + 0.1, BAY[2][1] - 0.25],
  [BAY[3][0] + 0.25, WALL_FACE],
  [DECK.landing.x1, WALL_FACE],
  [DECK.landing.x1, deckY(DECK.landing.depth)],
  [DECK.x1, deckY(DECK.landing.depth)],
  [DECK.x1, deckY(DECK.depth)],
  [DECK.x0, deckY(DECK.depth)],
]

// Andersen units called out on the plans. w/h are nominal sizes in feet.
const UNITS = {
  3046: { w: 3.17, h: 4.75, label: 'Andersen 3046 double-hung, R.O. 3\'-2 1/8" x 4\'-9 1/4"' },
  3052: { w: 3.17, h: 5.42, label: 'Andersen 3052 double-hung, R.O. 3\'-2 1/8" x 5\'-5 1/4"' },
  3032: { w: 3.17, h: 3.42, label: 'Andersen 3032 double-hung, R.O. 3\'-2 1/8" x 3\'-5 1/4"' },
  2046: { w: 2.17, h: 4.75, label: 'Andersen 2046 double-hung (tempered)' },
  2032: { w: 2.17, h: 3.42, label: 'Andersen 2032 double-hung, R.O. 3\'-2 1/8" x 3\'-5 1/4"' },
  C235: { w: 4.04, h: 3.45, label: 'Andersen C235 casement, R.O. 4\'-0 1/2" x 3\'-5 3/8"' },
  2813: { w: 2.67, h: 1.33, label: 'Andersen 2813 basement window, R.O. 2\'-8 5/8" x 1\'-3 1/4"' },
  PS50: { w: 5, h: 6.67, label: 'Andersen PS50 patio door, R.O. 5\'-0" x 6\'-8"' },
}

// at = position along the wall's axis (absolute plan coordinate) for straight
// walls, or f = fraction of the wall length for angled ones.
function win(model, at, opts = {}) {
  const u = UNITS[model]
  const count = opts.twin ? 2 : 1
  const head = opts.head ?? 7
  return {
    type: 'window',
    model,
    label: (count > 1 ? '(2) ' : '') + u.label + (opts.note ? ` - ${opts.note}` : ''),
    at,
    f: opts.f,
    w: u.w * count,
    sill: head - u.h,
    head,
  }
}
function door(at, w, label, opts = {}) {
  return { type: 'door', at, f: opts.f, w, sill: opts.sill ?? 0, head: opts.h ?? 6.67, label, style: opts.style ?? 'entry' }
}
function opening(at, w, label, h = 6.67) {
  return { type: 'opening', at, w, sill: 0, head: h, label }
}

const W = 36.17 // main house width (36'-2")
const D = 32 // main house depth
const GX = 57 // overall width incl. garage
const EXT = 0.5
const INT = 0.33

// ---------------------------------------------------------------- rooms

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

export const ROOMS = [
  // Basement
  {
    id: 'basement',
    level: 'B',
    name: 'Basement',
    type: 'basement',
    poly: rect(0, 0, W, D),
    labelAt: [25, 22],
    dims: '35\'-2" x 31\'-0" (open)',
    ceiling: "8'-0\"",
    notes: [
      '4" concrete slab, 6 mil vapor barrier on 4" gravel',
      '12" CMU foundation walls on 24" x 10" continuous concrete footing',
      '(2) 2x10 Microlam drop girder on 4" lally columns at about 5\'-9" o.c.',
      'Waterproofing below grade, 4" interior perimeter drain to sump pit',
      'Washer / dryer hook-up provided here if the optional study is built',
    ],
  },

  // First floor, main house
  {
    id: 'family',
    level: 'L1',
    name: 'Family room',
    type: 'living',
    poly: rect(0, 0, 16.67, 15.5),
    dims: '16\'-2" x 14\'-11"',
    ceiling: "9'-0\"",
    notes: [
      'Pre-fabricated fireplace with B-label flue and non-combustible hearth',
      '36" high kneewall, open to the kitchen',
      '2x10 floor joists at 12" o.c. in this area',
    ],
  },
  {
    id: 'kitchen',
    level: 'L1',
    name: 'Kitchen / dinette',
    type: 'kitchen',
    poly: [[16.67, 0], BAY[1], BAY[2], BAY[3], [W, 0], [W, 15.5], [16.67, 15.5]],
    labelAt: [21.5, 9],
    dims: '19\'-0" x 14\'-11" plus bay',
    ceiling: "9'-0\"",
    notes: [
      'Cantilevered bay with patio door and two tempered 2046 side windows',
      '(2) 2x12 Microlam header over the bay',
      'C235 casement over the sink, GFI outlets at 44" AFF',
      'Optional dishwasher on the plumbing riser',
    ],
  },
  {
    id: 'living',
    level: 'L1',
    name: 'Living room',
    type: 'living',
    poly: rect(0, 15.5, 13.5, D),
    dims: '13\'-0" x 16\'-1"',
    ceiling: "9'-0\"",
    notes: ['4\'-0" x 6\'-8" framed opening to the family room', 'Hard-wired smoke detector'],
  },
  {
    id: 'foyer',
    level: 'L1',
    name: 'Foyer & stair',
    type: 'hall',
    poly: rect(13.5, 15.5, 22.67, D),
    labelAt: [19.6, 29.5],
    dims: '8\'-10" wide, two-story',
    ceiling: 'Open to second floor',
    notes: [
      'Front entry: 3\'-0" x 6\'-8" metal insulated door',
      'Stair: 15 risers at 8.25" max, 14 treads at 10"',
      'Handrails both sides at 36" above nosing, balusters at 4" max opening',
      'Basement stair below, behind a 2\'-8" door',
    ],
  },
  {
    id: 'dining',
    level: 'L1',
    name: 'Dining room',
    type: 'living',
    poly: rect(22.67, 15.5, W, D),
    dims: '13\'-0" x 14\'-1"',
    ceiling: "9'-0\"",
    notes: ['6\'-6" cased opening to the foyer under a (2) 2x10 header', '3\'-0" framed opening to the kitchen'],
  },
  {
    id: 'porch',
    level: 'L1',
    name: 'Front porch',
    type: 'porch',
    floor: H.porchFloor,
    poly: rect(0, D, 35.83, 36),
    dims: '35\'-10" x 4\'-0"',
    ceiling: "8'-0\"",
    notes: [
      '4x4 pressure-treated decorative posts on 12" dia. x 3\'-0" deep footings',
      '2x2 pressure-treated balusters at 5" o.c.',
      'Stairs down to grade at the front door',
    ],
  },

  {
    id: 'deck',
    level: 'L1',
    name: 'Deck',
    subtitle: 'Backyard, built 2020',
    type: 'deck',
    floor: DECK.top,
    poly: DECK_POLY,
    labelAt: [18, -11],
    area: 376,
    dims: `20'-0" x 18'-0" plus 4'-0" x 4'-0" landing`,
    ceiling: `Open; about 5'-4" above grade at the outer edge`,
    notes: [
      '5/4 x 6 Trex Transcend decking, hidden fasteners, picture-frame border',
      `Vinyl railing with black aluminum balusters, 3'-0" high, posts at 8'-0" o.c. max.`,
      `2x8 PT joists at 16" o.c. on (3) 2x10 beams at 8'-0" and 16'-0", 2'-0" cantilever`,
      `Seven 6x6 PT posts on Goliath Tech helical piers (10" helix, 3'-0" min. deep)`,
      'Ledger: 3 5/8" LedgerLOK bolts, staggered; Simpson DTT1Z tension ties at 4 places',
      `Stair: 7 treads down to a 1' x 4' x 4" concrete pad, riser lights, graspable handrail`,
      'Lattice skirt with a gate on the far side',
      'Design loads: 50 PSF live, 10 PSF dead, 115 mph wind',
    ],
  },

  // First floor, garage wing
  {
    id: 'powder',
    level: 'L1',
    name: 'Powder room',
    type: 'bath',
    poly: rect(W, 3, 40, 9.8),
    dims: '3\'-4" x 6\'-8"',
    ceiling: "8'-0\"",
    notes: ['Andersen 3032 window', 'Toilet and lavatory (plumbing riser, first floor)'],
  },
  {
    id: 'backhall',
    level: 'L1',
    name: 'Back hall',
    type: 'hall',
    poly: rect(W, 9.8, 40, 14),
    dims: '4\'-0" deep',
    ceiling: "8'-0\"",
    notes: ['3\'-0" x 6\'-8" framed opening to the kitchen'],
  },
  {
    id: 'mudroom',
    level: 'L1',
    name: 'Mudroom / laundry',
    type: 'utility',
    poly: rect(40, 3, 49, 14),
    dims: 'about 8\'-6" x 10\'-6"',
    ceiling: "8'-0\"",
    notes: [
      'No rear entry: the plans show a door and stairs down to grade, but the rear wall is solid',
      'Door to garage: 3\'-0" x 6\'-8" metal insulated, stairs down',
      'Washer and dryer; laundry tub on the plumbing riser',
      'The optional study plan turns this wing into a study and full bath',
    ],
  },
  {
    id: 'garage',
    level: 'L1',
    name: 'Two-car garage',
    type: 'garage',
    floor: H.garageFloor,
    poly: [[49, 3], [GX, 3], [GX, 36], [W, 36], [W, 14], [49, 14]],
    labelAt: [46.5, 25],
    dims: '20\'-6" x 21\'-0" plus 7\'-6" rear bay',
    ceiling: "8'-0\" (2x6 joists)",
    notes: [
      'Two 8\'-0" x 7\'-0" overhead doors on (2) 2x10 Microlam headers',
      '5/8" Type X gypsum on garage walls, two layers on the ceiling',
      '4" slab, 3500 PSI concrete with 6x6 W.W.M.',
      'Ceiling outlets for garage door openers',
    ],
  },

  // Second floor
  {
    id: 'bed2',
    level: 'L2',
    name: 'Bedroom 2',
    subtitle: 'Rear left',
    type: 'bedroom',
    poly: rect(0, 0, 11.83, 12),
    dims: '11\'-1" x 11\'-3"',
    ceiling: "8'-0\"",
    notes: ['(2) Andersen 3046 windows on a (2) 2x12 header', 'Closet with (2) 2\'-0" wood sliders'],
  },
  {
    id: 'closet2',
    level: 'L2',
    name: 'Closet',
    subtitle: 'Bedroom 2',
    type: 'closet',
    poly: rect(11.83, 0, 14.33, 6),
    dims: 'Pole and shelf',
    ceiling: "8'-0\"",
    notes: [],
  },
  {
    id: 'closet3',
    level: 'L2',
    name: 'Closet',
    subtitle: 'Bedroom 3',
    type: 'closet',
    poly: rect(11.83, 6, 14.33, 12),
    dims: 'Pole and shelf, 24" deep',
    ceiling: "8'-0\"",
    notes: [],
  },
  {
    id: 'bed3',
    level: 'L2',
    name: 'Bedroom 3',
    subtitle: 'Rear middle',
    type: 'bedroom',
    poly: rect(14.33, 0, 25.67, 12),
    dims: '11\'-1" x 11\'-3"',
    ceiling: "8'-0\"",
    notes: ['(2) Andersen 3046 windows on a (2) 2x12 header'],
  },
  {
    id: 'mbath',
    level: 'L2',
    name: 'Master bath',
    type: 'bath',
    poly: rect(25.67, 0, W, 13.33),
    dims: '10\'-4" x 12\'-6"',
    ceiling: "8'-0\"",
    notes: [
      'Whirlpool tub: power and access panel for the motor',
      'Separate shower, double vanity, linen closet',
      'Andersen 3032 tempered glass window',
    ],
  },
  {
    id: 'hallbath',
    level: 'L2',
    name: 'Hall bath',
    type: 'bath',
    poly: [[0, 12], [8.1, 12], [8.1, 17.9], [5.8, 17.9], [5.8, 20.4], [0, 20.4]],
    labelAt: [3.5, 15.5],
    dims: '7\'-6" x 8\'-0"',
    ceiling: "8'-0\"",
    notes: ['Tub, toilet, double lavatory', 'Andersen 2032 window'],
  },
  {
    id: 'hall2',
    level: 'L2',
    name: 'Upper hall',
    type: 'hall',
    poly: [
      [8.1, 12], [25.67, 12], [25.67, 13.33], [22.67, 13.33], [22.67, 20.4], [16.5, 20.4],
      [16.5, 16.5], [13.5, 16.5], [13.5, 20.4], [9.8, 20.4], [9.8, 17.9], [8.1, 17.9],
    ],
    labelAt: [19.5, 14.6],
    dims: 'Overlooks the two-story foyer',
    ceiling: "8'-0\"",
    notes: ['Attic access hatch, 22" x 30" min.', '(2) 2x10 flush girder over the stair'],
  },
  {
    id: 'closet4',
    level: 'L2',
    name: 'Closet',
    subtitle: 'Bedroom 4',
    type: 'closet',
    poly: rect(5.8, 17.9, 9.8, 20.4),
    dims: 'Pole and shelf',
    ceiling: "8'-0\"",
    notes: [],
  },
  {
    id: 'bed4',
    level: 'L2',
    name: 'Bedroom 4',
    subtitle: 'Front left',
    type: 'bedroom',
    poly: rect(0, 20.4, 13.5, D),
    dims: '13\'-0" x 11\'-3"',
    ceiling: "8'-0\"",
    notes: ['Two Andersen 3046 windows'],
  },
  {
    id: 'master',
    level: 'L2',
    name: 'Master bedroom',
    type: 'bedroom',
    poly: rect(22.67, 13.33, W, D),
    dims: '13\'-0" x 18\'-6"',
    ceiling: "8'-0\"",
    notes: ['2x10 rafters and 2x10 ceiling joists at 16" o.c.', 'Walk-in closet over the garage'],
  },
  {
    id: 'mcloset',
    level: 'L2',
    name: 'Master closet',
    type: 'closet',
    poly: rect(W, 14.25, 45.67, 24.75),
    dims: '9\'-0" x 9\'-10"',
    ceiling: '6\'-8" plate height',
    notes: [
      'Built into the garage roof, pole and shelf on two walls',
      'Access panel into the attic storage above the garage (24" x 36" min.)',
    ],
  },
]

export const roomById = Object.fromEntries(ROOMS.map((r) => [r.id, r]))

// ---------------------------------------------------------------- walls

// kind: wall (default) | knee | rail | foundation
export const WALLS = [
  // Basement foundation, 12" CMU
  ...[
    [[0, 0], [W, 0], [win('2813', 14.1, { head: 8.2 }), win('2813', 30.6, { head: 8.2 })]],
    [[W, 0], [W, D], []],
    [[0, D], [W, D], []],
    [[0, 0], [0, D], [win('2813', 24.7, { head: 8.2 })]],
  ].map(([a, b, openings]) => ({ level: 'B', a, b, t: 1, ext: true, kind: 'foundation', h: 8.4, openings })),

  // First floor, main house exterior
  {
    level: 'L1', a: [0, 0], b: [16.67, 0], t: EXT, ext: true,
    openings: [win('3046', 2.92), win('3046', 13.25)],
  },
  { level: 'L1', a: BAY[0], b: BAY[1], t: EXT, h: 8, openings: [win('2046', null, { f: 0.5 })] },
  { level: 'L1', a: BAY[1], b: BAY[2], t: EXT, h: 8, openings: [{ ...win('PS50', 21.3, { head: 6.67 }), type: 'door', style: 'patio' }] },
  { level: 'L1', a: BAY[2], b: BAY[3], t: EXT, h: 8, openings: [win('2046', null, { f: 0.5 })] },
  { level: 'L1', a: [BAY[3][0], 0], b: [W, 0], t: EXT, ext: true, openings: [win('C235', 30.75, { head: 7.1 })] },
  {
    level: 'L1', a: [0, 0], b: [0, D], t: EXT, ext: true,
    openings: [win('3046', 2.92), win('3046', 13.08), win('3046', 23.5)],
  },
  {
    level: 'L1', a: [0, D], b: [W, D], t: EXT, ext: true,
    openings: [
      win('3052', 3.75), win('3052', 10.25),
      door(18.1, 3, '3\'-0" x 6\'-8" metal insulated front entry door', { style: 'front' }),
      win('3052', 25.75), win('3052', 32.25),
    ],
  },
  { level: 'L1', a: [W, 0], b: [W, 3], t: EXT, ext: true },
  {
    level: 'L1', a: [W, 3], b: [W, 14], t: INT,
    openings: [opening(12, 3, '3\'-0" x 6\'-8" framed opening')],
  },
  // House | garage fire wall
  { level: 'L1', a: [W, 14], b: [W, D], t: EXT, base: H.garageFloor, h: H.ceil1 - H.garageFloor },
  { level: 'L1', a: [W, D], b: [W, 36], t: EXT, ext: true, base: H.garageFloor, h: H.garagePlate - H.garageFloor },

  // Garage wing exterior
  {
    level: 'L1', a: [W, 3], b: [GX, 3], t: EXT, ext: true, base: H.garageFloor, h: H.garagePlate - H.garageFloor,
    openings: [
      // The plans show a rear entry door at x 44.3; the house has a plain wall there.
      win('3032', 38.2, { head: 7 + H.ff1 - H.garageFloor }),
    ],
  },
  { level: 'L1', a: [GX, 3], b: [GX, 36], t: EXT, ext: true, base: H.garageFloor, h: H.garagePlate - H.garageFloor },
  {
    level: 'L1', a: [W, 36], b: [GX, 36], t: EXT, ext: true, base: H.garageFloor, h: H.garagePlate - H.garageFloor,
    openings: [
      door(41.67, 8, '8\'-0" x 7\'-0" overhead garage door', { h: 7, style: 'garage' }),
      door(51.17, 8, '8\'-0" x 7\'-0" overhead garage door', { h: 7, style: 'garage' }),
    ],
  },

  // First floor interior
  {
    level: 'L1', a: [0, 15.5], b: [W, 15.5], t: INT,
    openings: [
      opening(11, 4, '4\'-0" x 6\'-8" framed opening'),
      opening(20.3, 3, 'Opening to the back of the foyer'),
      opening(27.1, 3, '3\'-0" x 6\'-8" framed opening'),
    ],
  },
  { level: 'L1', a: [16.67, 0], b: [16.67, 9.4], t: INT, kind: 'knee', h: 3 },
  { level: 'L1', a: [13.5, 15.5], b: [13.5, D], t: INT, openings: [opening(29.6, 3.4, 'Cased opening')] },
  { level: 'L1', a: [16.5, 18.6], b: [16.5, 28], t: INT, kind: 'knee', h: 3.2 },
  { level: 'L1', a: [22.67, 15.5], b: [22.67, D], t: INT, openings: [opening(24.35, 6.5, '6\'-6" cased opening')] },
  // Garage wing interior (raised to first floor level)
  {
    level: 'L1', a: [40, 3], b: [40, 9.8], t: INT, h: 8,
    openings: [door(8.1, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' })],
  },
  { level: 'L1', a: [W, 9.8], b: [40, 9.8], t: INT, h: 8 },
  { level: 'L1', a: [W, 14], b: [49, 14], t: EXT, base: H.garageFloor, h: H.garagePlate - H.garageFloor },
  {
    level: 'L1', a: [49, 3], b: [49, 14], t: EXT, base: H.garageFloor, h: H.garagePlate - H.garageFloor,
    openings: [door(12, 3, '3\'-0" x 6\'-8" metal insulated door to garage', { h: 6.67 + H.ff1 - H.garageFloor, sill: H.ff1 - H.garageFloor, style: 'entry' })],
  },

  // Second floor exterior
  {
    level: 'L2', a: [0, 0], b: [W, 0], t: EXT, ext: true,
    openings: [
      win('3046', 6.25, { twin: true, head: 6.83 }),
      win('3046', 20.67, { twin: true, head: 6.83 }),
      win('3032', 29.92, { head: 6.83, note: 'tempered glass' }),
    ],
  },
  {
    level: 'L2', a: [0, D], b: [W, D], t: EXT, ext: true,
    openings: [3.75, 10.25, 18.1, 25.75, 32.25].map((x) => win('3046', x, { head: 6.83 })),
  },
  { level: 'L2', a: [0, 0], b: [0, D], t: EXT, ext: true, openings: [win('2032', 16.3, { head: 6.83 })] },
  {
    level: 'L2', a: [W, 0], b: [W, D], t: EXT, ext: true,
    openings: [door(16.2, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' })],
  },

  // Second floor interior
  {
    level: 'L2', a: [0, 12], b: [25.67, 12], t: INT,
    openings: [door(9.6, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' }), door(16, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' })],
  },
  { level: 'L2', a: [11.83, 0], b: [11.83, 12], t: INT, openings: [opening(3.2, 4, '(2) 2\'-0" x 6\'-8" wood sliders')] },
  { level: 'L2', a: [14.33, 0], b: [14.33, 12], t: INT, openings: [opening(9.2, 4, '(2) 2\'-0" x 6\'-8" wood sliders')] },
  { level: 'L2', a: [11.83, 6], b: [14.33, 6], t: INT },
  { level: 'L2', a: [25.67, 0], b: [25.67, 13.33], t: INT },
  {
    level: 'L2', a: [22.67, 13.33], b: [W, 13.33], t: INT,
    openings: [door(29.1, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' })],
  },
  {
    level: 'L2', a: [22.67, 13.33], b: [22.67, D], t: INT,
    openings: [door(16.8, 2.5, '2\'-6" x 6\'-8" wood door', { style: 'interior' })],
  },
  {
    level: 'L2', a: [8.1, 12], b: [8.1, 17.9], t: INT,
    openings: [door(16.3, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' })],
  },
  { level: 'L2', a: [5.8, 17.9], b: [9.8, 17.9], t: INT },
  { level: 'L2', a: [5.8, 17.9], b: [5.8, 20.4], t: INT },
  { level: 'L2', a: [9.8, 17.9], b: [9.8, 20.4], t: INT },
  {
    level: 'L2', a: [0, 20.4], b: [13.5, 20.4], t: INT,
    openings: [door(7.6, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' }), door(11.7, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' })],
  },
  { level: 'L2', a: [13.5, 20.4], b: [13.5, D], t: INT },
  { level: 'L2', a: [16.5, 16.5], b: [16.5, 20.4], t: 0.25, kind: 'rail', h: 3 },
  { level: 'L2', a: [16.5, 20.4], b: [22.67, 20.4], t: 0.25, kind: 'rail', h: 3 },
  // Master closet tucked under the garage roof (6'-8" +/- plate height)
  { level: 'L2', a: [W, 14.25], b: [45.67, 14.25], t: INT, h: 6.3 },
  { level: 'L2', a: [45.67, 14.25], b: [45.67, 24.75], t: INT, h: 6.3 },
  { level: 'L2', a: [W, 24.75], b: [45.67, 24.75], t: INT, h: 6.3 },
]

// ---------------------------------------------------------------- fixtures
// Built-ins drawn on the plans. z0/z1 are heights above the level's floor
// (or above `floor` when given). shape: box (default) or cyl.

export const FIXTURES = [
  // Basement
  ...[6.75, 12.5, 18.25, 24, 29.75].map((x) => ({ level: 'B', shape: 'cyl', x, y: 15.2, r: 0.17, z0: 0, z1: 7.4, color: '#7d8590' })),
  { level: 'B', x0: 0.5, y0: 14.95, x1: W - 0.5, y1: 15.45, z0: 7.4, z1: 8.4, color: '#b69a73' },
  { level: 'B', x0: 2.6, y0: 8.2, x1: 5.2, y1: 10.4, z0: 0, z1: 5, color: '#9aa3ad', name: 'Furnace' },
  { level: 'B', shape: 'cyl', x: 3.9, y: 6.2, r: 0.95, z0: 0, z1: 5, color: '#c9ced4', name: 'Hot water heater' },
  { level: 'B', shape: 'cyl', x: 33.2, y: 3.9, r: 0.9, z0: 0, z1: 0.1, color: '#4c5560', name: 'Sump pit' },

  // Kitchen
  { level: 'L1', x0: 28.6, y0: 0.25, x1: 35.92, y1: 2.25, z0: 0, z1: 3, color: '#e9e4da', top: '#6e737b' },
  { level: 'L1', x0: 33.92, y0: 2.25, x1: 35.92, y1: 12.5, z0: 0, z1: 3, color: '#e9e4da', top: '#6e737b' },
  { level: 'L1', x0: 25.9, y0: 2.25, x1: 28.6, y1: 12.2, z0: 0, z1: 3, color: '#e9e4da', top: '#6e737b' },
  { level: 'L1', x0: 33.95, y0: 6, x1: 35.9, y1: 8.5, z0: 3, z1: 3.05, color: '#2b2f35' },
  { level: 'L1', x0: 29.6, y0: 0.45, x1: 31.9, y1: 1.9, z0: 3, z1: 3.03, color: '#aeb6bf' },
  { level: 'L1', x0: 32.6, y0: 13, x1: 35.6, y1: 15.2, z0: 0, z1: 6, color: '#d8dce0', name: 'Refrigerator' },
  // Fireplace
  { level: 'L1', x0: 0.25, y0: 5.8, x1: 1.4, y1: 10.2, z0: 0, z1: 4.4, color: '#9c8b7a' },
  { level: 'L1', x0: 1.38, y0: 6.9, x1: 1.45, y1: 9.1, z0: 0.4, z1: 2.9, color: '#2a2622' },
  { level: 'L1', x0: 0.25, y0: 5.4, x1: 2.9, y1: 10.6, z0: 0, z1: 0.06, color: '#8b7d6f' },
  // Powder room
  { level: 'L1', x0: 36.6, y0: 3.4, x1: 38.0, y1: 5.0, z0: 0, z1: 1.3, color: '#f4f5f6' },
  { level: 'L1', x0: 36.45, y0: 6.0, x1: 38.0, y1: 7.6, z0: 0, z1: 2.8, color: '#f4f5f6' },
  // Laundry
  { level: 'L1', x0: 46.3, y0: 3.4, x1: 48.7, y1: 5.8, z0: 0, z1: 3, color: '#f2f3f5', name: 'Washer' },
  { level: 'L1', x0: 46.3, y0: 5.9, x1: 48.7, y1: 8.3, z0: 0, z1: 3, color: '#f2f3f5', name: 'Dryer' },

  // Hall bath
  { level: 'L2', x0: 3.2, y0: 12.17, x1: 8.0, y1: 14, z0: 0, z1: 2.8, color: '#e9e4da', top: '#f4f5f6' },
  { level: 'L2', x0: 0.25, y0: 13.6, x1: 1.9, y1: 15.2, z0: 0, z1: 1.3, color: '#f4f5f6' },
  { level: 'L2', x0: 0.25, y0: 17.95, x1: 5.75, y1: 20.25, z0: 0, z1: 1.6, color: '#f4f5f6' },
  // Master bath
  { level: 'L2', x0: 25.83, y0: 1.4, x1: 27.4, y1: 3.0, z0: 0, z1: 1.3, color: '#f4f5f6' },
  { level: 'L2', x0: 25.83, y0: 4.0, x1: 27.83, y1: 10.3, z0: 0, z1: 2.8, color: '#e9e4da', top: '#f4f5f6' },
  { level: 'L2', x0: 31.4, y0: 0.25, x1: 35.92, y1: 7.5, z0: 0, z1: 1.8, color: '#f4f5f6', name: 'Whirlpool' },
  { level: 'L2', x0: 32.9, y0: 8.9, x1: 35.92, y1: 13.17, z0: 0, z1: 0.25, color: '#dfe6ec', name: 'Shower' },
  { level: 'L2', x0: 32.85, y0: 8.9, x1: 32.95, y1: 13.17, z0: 0, z1: 6.5, color: '#bcd3e3', glass: true },
]

// ---------------------------------------------------------------- items
// Points of interest that will carry service info, manuals, photos, etc.

export const ITEMS = [
  {
    id: 'furnace', level: 'B', at: [3.9, 9.3], z: 5.5, category: 'HVAC', name: 'Furnace',
    details: ['Basement, left rear corner next to the water heater', 'Ducts run between 2x10 floor joists at 16" o.c.'],
  },
  {
    id: 'waterheater', level: 'B', at: [3.9, 6.2], z: 5.5, category: 'Plumbing', name: 'Hot water heater',
    details: ['Basement, left rear corner', 'Double joists framed above the mechanical area'],
  },
  {
    id: 'sump', level: 'B', at: [33.2, 3.9], z: 1.5, category: 'Plumbing', name: 'Sump pit',
    details: ['Collects the 4" interior perimeter drain', 'Basement, right rear corner'],
  },
  {
    id: 'sewer', level: 'B', at: [26, 30.5], z: 3, category: 'Plumbing', name: 'Main drain to sewer',
    details: ['4" building drain leaves toward the street', '3" and 4" stacks vent through the roof (V.T.R.)', 'Cleanouts at the base of each stack'],
  },
  {
    id: 'fireplace', level: 'L1', at: [1, 8], z: 5, category: 'Structure', name: 'Fireplace',
    details: ['Pre-fabricated fireplace with B-label flue', 'Non-combustible hearth (20" min. in front, 12" min. at sides)', 'Chimney extends 2\'-0" above any point within 10\'-0"'],
  },
  {
    id: 'kitchensink', level: 'L1', at: [30.75, 1.2], z: 3.5, category: 'Plumbing', name: 'Kitchen sink',
    details: ['Under the C235 casement window', '1 1/2" drain, 2" vent; optional dishwasher'],
  },
  {
    id: 'laundry', level: 'L1', at: [47.5, 5.8], z: 3.5, category: 'Appliances', name: 'Washer & dryer',
    details: ['Mudroom / laundry', 'Laundry tub with 1 1/2" drain on the riser diagram'],
  },
  {
    id: 'garagedoors', level: 'L1', floor: H.garageFloor, at: [46.5, 30], z: 8, category: 'Electrical', name: 'Garage door openers',
    details: ['Ceiling-mounted outlets for each opener', 'Two 8\'-0" x 7\'-0" overhead doors'],
  },
  {
    id: 'deckpiers', level: 'L1', floor: DECK.top, at: [18.05, deckY(8)], z: -1.6, category: 'Structure', name: 'Deck posts & helical piers',
    details: [
      'Seven 6x6 PT posts (ground-contact rated, MCA .23) on Goliath Tech helical piles',
      `Support plate MHC1161-3B post cap, 10" helix, 3'-0" minimum depth`,
      'Required loads: #1 246 lb, #2 2,992, #3 3,638, #4 2,880, #5 2,155, #6 2,880, #7 2,155',
      `Installer field report records each pile's depth, torque and bearing capacity`,
    ],
  },
  {
    id: 'deckledger', level: 'L1', floor: DECK.top, at: [12, deckY(0.6)], z: -0.4, category: 'Structure', name: 'Deck ledger',
    details: [
      'Bolted to the house rim joist with 3 5/8" LedgerLOK fasteners, staggered',
      'Simpson DTT1Z-KT tension ties at 4 places, one within 24" of each end',
      'Joist hangers: Simpson LUS26S; flashing and counter flashing behind the siding',
    ],
  },
  {
    id: 'decklights', level: 'L1', floor: DECK.top, at: [29.9, deckY(7)], z: 1.5, category: 'Electrical', name: 'Deck lighting',
    details: ['Post cap lights on 10 rail posts', 'Riser lights on the 7 stair risers'],
  },
  {
    id: 'deckgate', level: 'L1', floor: DECK.top, at: [8.5, deckY(2.3)], z: -1.2, category: 'Structure', name: 'Gate to under-deck space',
    details: ['Gate in the lattice skirt on the far side, next to the house'],
  },
  {
    id: 'smoke1', level: 'L1', at: [6.5, 23], z: 9, category: 'Safety', name: 'Smoke detector (1st floor)',
    details: ['Hard-wired to the panel', 'Living room ceiling'],
  },
  {
    id: 'whirlpool', level: 'L2', at: [33.6, 3.8], z: 2.5, category: 'Plumbing', name: 'Whirlpool tub',
    details: ['Provide power and an access panel for the whirlpool motor'],
  },
  {
    id: 'attic', level: 'L2', at: [11.7, 16.8], z: 8, category: 'Structure', name: 'Attic access hatch',
    details: ['22" x 30" min. hatch in the upper hall ceiling', 'Attic storage over 2x10 ceiling joists, R-22 insulation'],
  },
  {
    id: 'garageattic', level: 'L2', at: [44.6, 19.5], z: 5, category: 'Structure', name: 'Garage attic access',
    details: ['Access panel from the master closet into storage above the garage', '24" x 36" minimum'],
  },
  {
    id: 'smoke2', level: 'L2', at: [19, 14.6], z: 8, category: 'Safety', name: 'Smoke detectors (2nd floor)',
    details: ['Hard-wired to the panel', 'Upper hall and master bedroom'],
  },

  // Property (from the survey). `focus` frames the camera on a wider area.
  {
    id: 'lot', level: 'site', at: [28, 70], z: 3, category: 'Site', name: 'Lot 56.01, Block 216',
    focus: { at: [28, -3], r: 95 },
    details: [
      `75.00' x 175.00' = 13,125 sq ft (0.30 acre)`,
      `Front line S 81°28' E on Orchard Street; side lines N 08°32' E`,
      `Point of beginning (front right corner) is 1,101.60' from Main Street (66' R.O.W.)`,
      'Borough of Metuchen tax map, sheet 75',
      `Also lot 96 and part of lot 95 on the "Map of 218 Building Plots, Property of Laura E. Jones" (1871), filed 1873 as Map No. 80, File No. 57`,
      'Neighbors: Lot 58 B (left), Lot 54 (right), Lot 126 (rear)',
    ],
  },
  {
    id: 'setbacks', level: 'site', at: [28.5, LOT.y1 - 25], z: 2, category: 'Site', name: 'Setbacks',
    focus: { at: [28, 0], r: 90 },
    details: [
      `Required: front 25.00', rear 25.00', left side 10.00', right side 8.00'`,
      `House to front line: 52.7' (porch face 48.6'), garage doors 48.6'`,
      `House to left line: 9.5' (the survey draws the left setback line at 10.00')`,
      `Garage to right line: 8.4'`,
      `Rear yard: about 90.3' from the back of the house to the rear line`,
    ],
  },
  {
    id: 'flood', level: 'site', at: [0.4, -65.05], z: 2, category: 'Site', name: '100-year flood limit',
    focus: { at: [10, -62], r: 45 },
    details: [
      `Crosses the left line about 31' in front of the rear corner and the rear line about 48' from the left corner`,
      'The rear-left corner of the lot lies beyond the line',
    ],
  },
  {
    id: 'woods', level: 'site', at: [12, -40], z: 3, category: 'Site', name: 'Edge of woods',
    focus: { at: [25, -30], r: 50 },
    details: [
      `Runs from about 59' in front of the rear line on the left side to just behind the garage at the right line`,
      'The backyard inside the lot lines is open; the woods continue on the neighboring lots',
    ],
  },
  {
    id: 'fence', level: 'site', at: [LOT.x1 - 0.15, -30], z: 6.5, category: 'Site', name: 'Vinyl privacy fence',
    focus: { at: [28, -25], r: 60 },
    details: [
      `6' white vinyl privacy fence`,
      `Left side: from the left wall of the house (about 17.5' behind the front wall) to the left line, then back along the line to about 22' behind the house`,
      `Right side: along the right line (Lot 54) from the gate all the way back to the back lot line`,
      'The survey shows a wood stockade fence on the right line; it has been replaced',
    ],
  },
  {
    id: 'chainlink', level: 'site', at: [28, LOT.y0 + 0.15], z: 4.5, category: 'Site', name: 'Chain-link fence',
    focus: { at: [20, -62], r: 55 },
    details: [
      `4' chain-link fence`,
      `Along the left line from about 22' behind the house to the back corner, then across the lot on the back lot line`,
      'The whole backyard, including the 100-year flood-limit corner, is inside the fence',
    ],
  },
  {
    id: 'arborvitae', level: 'site', at: [28, LOT.y0 + 3.15], z: 9, category: 'Landscape', name: 'Arborvitae screen (back)',
    focus: { at: [28, -78], r: 45 },
    details: [
      `12 Thuja Green Giant arborvitae, planted about 2 years ago`,
      `Evenly spaced about 6'-3" apart, 3' in front of the back chain-link fence`,
      `Modeled at about 8' tall; Green Giants grow 3' to 5' a year, to 40' to 60' tall and 12' to 20' wide`,
    ],
  },
  {
    id: 'arborvitae-garage', level: 'site', at: [54.6, -10], z: 9, category: 'Landscape', name: 'Arborvitae row (garage side)',
    focus: { at: [52, -12], r: 25 },
    details: [`4 Thuja Green Giant arborvitae, about 2 years old`, `Evenly spaced in a line running back about 20' behind the house, out past the garage`],
  },
  {
    id: 'arborvitae-chimney', level: 'site', at: [-2.8, -10.5], z: 9, category: 'Landscape', name: 'Arborvitae row (chimney side)',
    focus: { at: [0, -12], r: 25 },
    details: [`4 Thuja Green Giant arborvitae, about 2 years old`, `Evenly spaced in a line running back about 19' behind the house, just outside its left wall`],
  },
  {
    id: 'serviceberry', level: 'site', at: [27.6, -29.1], z: 9, category: 'Landscape', name: 'Autumn Brilliance serviceberry',
    focus: { at: [20, -26], r: 25 },
    details: [
      `Amelanchier × grandiflora 'Autumn Brilliance', planted about 2 years ago`,
      `About 29' behind the house, in line with the deck's stair side`,
      `White flowers in early spring, small edible berries in June, orange-red fall color`,
      `Matures at about 20' to 25' tall and 15' to 20' wide`,
    ],
  },
  {
    id: 'cherry', level: 'site', at: [8.9, -29.1], z: 7.5, category: 'Landscape', name: 'Double pink weeping cherry',
    focus: { at: [12, -26], r: 25 },
    details: [
      'Planted about 2 years ago',
      `About 29' behind the house, in line with the deck's far end`,
      'Double pink flowers in spring on weeping branches',
    ],
  },
  {
    id: 'fencegate', level: 'site', at: [63.3, 6.5], z: 6.5, category: 'Site', name: 'Side yard gate',
    focus: { at: [58, 4], r: 25 },
    details: [
      `Single white vinyl gate, hinged on the left (garage side), latching at the right line`,
      `A fixed vinyl panel fills the space between the garage's right wall and the gate`,
    ],
  },
  {
    id: 'driveway', level: 'site', at: [46.6, 66], z: 1, category: 'Site', name: 'Asphalt driveway',
    focus: { at: [46.6, 62], r: 40 },
    details: [`About 20.8' wide, from the garage doors to Orchard Street`, 'Depressed curb at the street'],
  },
  {
    id: 'neighbordrive', level: 'site', at: [-12, 60], z: 1, category: 'Site', name: `Neighbor's driveway`,
    focus: { at: [-8, 55], r: 40 },
    details: [`Lot 58 B's asphalt drive runs on the left line and overlaps it by 0.3'`],
  },
  {
    id: 'electric', level: 'site', at: [SITE.service.x + 0.4, SITE.service.y], z: SITE.service.meterZ + 1.4, category: 'Electrical', name: 'Electric meter & service',
    focus: { at: [60, 40], r: 40 },
    details: [
      'Overhead wires (O.H.W.) from the utility pole by the front right corner of the lot',
      `They land high on the garage's right side wall and run down the wall to the meter`,
      `Meter about 5' above grade, about 7'-6" back from the garage's front corner, with a small box below it`,
    ],
  },
  {
    id: 'corners', level: 'site', at: [LOT.x1, LOT.y1], z: 2, category: 'Site', name: 'Property corner markers',
    focus: { at: [28, -3], r: 95 },
    details: SITE.corners.map((c) => c.label),
  },
]

for (const item of ITEMS) {
  if (item.level === 'site' && item.floor == null) item.floor = gradeAt(item.at[1])
}

export const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

// ---------------------------------------------------------------- house facts

export const HOME = {
  title: 'My Home',
  address: '90 Orchard Street, Metuchen, NJ',
  style: 'Two-story colonial with attached two-car garage',
  facts: [
    ['First floor', '1,415 sq ft'],
    ['Second floor', '1,255 sq ft (incl. open foyer)'],
    ['Total', '2,670 sq ft'],
    ['Volume', '51,968 cu ft'],
    ['Footprint', '57\'-0" x 36\'-0"'],
    ['Building height', '30\'-11" +/-'],
    ['Bedrooms', '4'],
    ['Baths', '2 full, 1 half'],
    ['Deck', '376 sq ft Trex (2020)'],
    ['Lot', `75' x 175' (0.30 acre)`],
  ],
  sections: [
    {
      title: 'Construction',
      rows: [
        ['Use group', 'R-3, construction type 5B'],
        ['Foundation', '12" CMU on 24" x 10" concrete footing'],
        ['Floors', '2x10 joists at 16" o.c., 3/4" T&G plywood'],
        ['Walls', '2x4 studs at 16" o.c., 1/2" CDX sheathing, vinyl siding'],
        ['Roof', '9/12 pitch, 2x10 rafters at 16" o.c., 2x12 ridge'],
        ['Roofing', 'Self-sealing asphalt shingles, aluminum gutters'],
      ],
    },
    {
      title: 'Energy envelope',
      rows: [
        ['Walls', 'R-15.86 total (3 1/2" batts R-13), U 0.063'],
        ['Roof / ceiling', 'R-25.31 total (7" batts R-22), U 0.039'],
        ['Floors', 'R-21.82 total (6" batts R-19), U 0.046'],
      ],
    },
    {
      title: 'Design loads',
      rows: [
        ['Floors', '40 PSF'],
        ['Bedroom floors', '30 PSF'],
        ['Ceilings', '20 PSF'],
        ['Roof', '30 PSF'],
        ['Deck', '60 PSF'],
      ],
    },
    {
      title: 'Property (survey)',
      rows: [
        ['Lot', 'Lot 56.01, Block 216, Borough of Metuchen'],
        ['Size', `75.00' x 175.00' (13,125 sq ft)`],
        ['Faces', `Orchard Street, S 08°32' W`],
        ['Setbacks', `25' front and rear, 10' / 8' sides`],
        ['House', `52.7' from the street, 9.5' and 8.4' from the sides`],
        ['Back of lot', 'Woods, with the 100-year flood limit across the rear-left corner'],
        ['Utilities', 'Overhead electric from the pole at the front right corner'],
      ],
    },
    {
      title: 'Deck (2020)',
      rows: [
        ['Size', `20'-0" x 18'-0" plus 4'-0" landing and stair`],
        ['Decking', 'Trex Transcend 5/4 x 6, hidden fasteners'],
        ['Railing', 'Vinyl with black aluminum balusters'],
        ['Framing', '2x8 PT joists at 16" o.c., (3) 2x10 beams'],
        ['Footings', '6x6 posts on 7 helical piers'],
        ['Architect', 'Jeffrey A. Fleisher, AIA, Flemington, NJ'],
        ['Drawings', 'Project 2001-71, June 11, 2020 (4 sheets)'],
      ],
    },
    {
      title: 'House drawings',
      rows: [
        ['Architect', 'Roger C. Winkle, A.I.A., Plainfield, NJ'],
        ['Prepared for', 'Anda Builders, Inc.'],
        ['Date', 'Jan. 25, 2001 (5 sheets)'],
      ],
    },
  ],
}

export const BLUEPRINTS = [
  { id: 's1', set: 'House 2001', file: 'sheet-1-foundation.jpg', title: 'Foundation plan', sheet: '1 of 5' },
  { id: 's2', set: 'House 2001', file: 'sheet-2-first-floor.jpg', title: 'First floor plan & optional study', sheet: '2 of 5' },
  { id: 's3', set: 'House 2001', file: 'sheet-3-second-floor-roof.jpg', title: 'Second floor & roof plan', sheet: '3 of 5' },
  { id: 's4', set: 'House 2001', file: 'sheet-4-elevations.jpg', title: 'Elevations', sheet: '4 of 5' },
  { id: 's5', set: 'House 2001', file: 'sheet-5-section-plumbing.jpg', title: 'Building section & plumbing riser', sheet: '5 of 5' },
  { id: 'd1', set: 'Deck 2020', file: 'deck-a1-notes.jpg', title: 'Deck notes & calculations', sheet: 'A-1' },
  { id: 'd2', set: 'Deck 2020', file: 'deck-a2-structural.jpg', title: 'Deck framing plan', sheet: 'A-2' },
  { id: 'd3', set: 'Deck 2020', file: 'deck-a3-plan.jpg', title: 'Deck plan & lighting', sheet: 'A-3' },
  { id: 'd4', set: 'Deck 2020', file: 'deck-a4-details.jpg', title: 'Deck details', sheet: 'A-4' },
  { id: 'p1', set: 'Survey', file: 'property-survey.jpg', title: 'Property survey', sheet: '1 of 1' },
]

// ---------------------------------------------------------------- helpers

export function polyArea(poly) {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a) / 2
}

export function polyCentroid(poly) {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const c = x0 * y1 - x1 * y0
    a += c
    cx += (x0 + x1) * c
    cy += (y0 + y1) * c
  }
  a /= 2
  return [cx / (6 * a), cy / (6 * a)]
}

export function pointInPoly([x, y], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function roomFloor(room) {
  return room.floor ?? levelById[room.level].floor
}

export function roomLabelPoint(room) {
  return room.labelAt ?? polyCentroid(room.poly)
}

// Usable area: walls are drawn on centerlines, so take off about half a wall
// thickness on every side.
export function roomArea(room) {
  if (room.area) return room.area
  const a = polyArea(room.poly)
  let perim = 0
  for (let i = 0; i < room.poly.length; i++) {
    const [x0, y0] = room.poly[i]
    const [x1, y1] = room.poly[(i + 1) % room.poly.length]
    perim += Math.hypot(x1 - x0, y1 - y0)
  }
  return Math.max(0, Math.round(a - perim * 0.2))
}

// Openings resolved to plan points, used for per-room window / door lists.
export function openingPoint(wall, op) {
  const [ax, ay] = wall.a
  const [bx, by] = wall.b
  const L = Math.hypot(bx - ax, by - ay)
  let d
  if (op.f != null) d = op.f * L
  else if (Math.abs(by - ay) < 1e-6) d = op.at - ax
  else d = op.at - ay
  return { d, L, x: ax + ((bx - ax) * d) / L, y: ay + ((by - ay) * d) / L, nx: -(by - ay) / L, ny: (bx - ax) / L }
}

export function openingsForRoom(room) {
  const out = []
  for (const wall of WALLS) {
    if (wall.level !== room.level || !wall.openings) continue
    for (const op of wall.openings) {
      if (op.type === 'opening') continue
      const p = openingPoint(wall, op)
      const sides = [
        [p.x + p.nx * 0.8, p.y + p.ny * 0.8],
        [p.x - p.nx * 0.8, p.y - p.ny * 0.8],
      ]
      if (sides.some((pt) => pointInPoly(pt, room.poly))) out.push(op)
    }
  }
  return out
}
