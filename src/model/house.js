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
// Rough sizes of the plantings in fall 2026, 2.5 years after planting, in feet.
export const PLANT_TYPES = {
  thuja: { name: 'Thuja Green Giant arborvitae', height: 8, spread: 3.2 },
  serviceberry: { name: `Autumn Brilliance serviceberry`, height: 8, spread: 5 },
  cherry: { name: 'Double pink weeping cherry', height: 6.5, spread: 6 },
  maple: { name: 'Japanese maple', height: 22, spread: 20 },
}

// `count` plants evenly spaced along a line, each centered in its share of it.
function plantRow(kind, [ax, ay], [bx, by], count) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count
    return { kind, at: [ax + (bx - ax) * t, ay + (by - ay) * t] }
  })
}

// Lot 56.01, Block 216. Placed from the newer survey (owner, 2026-10-17): the
// main house's left wall is 9.53' from the left line and the garage doors are
// 48.00' from the street line. The older scanned survey (to scale) gives the
// woods, flood limit and other features. Lot lines are square to the house.
// The newer survey's right offset (8.28') would make the house 57.19' wide
// against 57'-0" on the plans; the left offset is kept exact.
// Points measured on the older survey (its rear-left corner was at -9.5, -90.35),
// kept in place relative to the lot lines
const fromOldSurvey = (pts) => pts.map(([x, y]) => [x + LOT.x0 + 9.5, y + LOT.y0 + 90.35])
const LOT = { x0: -9.53, x1: -9.53 + 75, y0: 36 + 48 - 175, y1: 36 + 48 } // 75.00' x 175.00'
export const SITE = {
  lot: LOT,
  // Required setback lines drawn on the survey
  setbacks: { front: 25, rear: 25, left: 10, right: 8 },
  // Bearing of the side lines is N 08 deg 32' E, so deed north is 8.53 deg
  // counterclockwise from "up" on the plans (toward the rear, -y).
  northDeg: 8.53,
  // Orchard Street (formerly Orchard Avenue), 60' right of way: curb about
  // 12.7' out from the lot line on each side
  curbY: LOT.y1 + 12.7,
  roadWidth: 60 - 2 * 12.7,
  drive: { x0: 36.17, x1: 57 }, // asphalt, garage doors to the street
  neighborDrive: { x0: -18.5, x1: LOT.x0 + 0.3, y0: 23 }, // Lot 58 B, 0.3' over the line
  // Concrete walk from the porch steps to the driveway, with planting beds
  // along the porch on each side of the steps (owner)
  walk: { x0: 15, x1: 36.17, y0: 39.3, y1: 43.3 },
  beds: [{ x0: 0.2, x1: 14.5, y0: 36.15, y1: 39.3 }, { x0: 21.7, x1: 35.7, y0: 36.15, y1: 39.3 }],
  // 100-year flood limit, crossing the rear-left corner of the lot (older survey)
  flood: fromOldSurvey([[-19.8, -56.35], [-9.5, -59.25], [0.4, -65.05], [38.6, -90.35]]),
  // Edge of woods as surveyed (before the 2020 deck)
  woods: fromOldSurvey([
    [-21.6, -31.25], [-9.5, -30.95], [0.1, -30.15], [5.7, -30.95], [10.6, -28.35], [15.5, -25.25],
    [24.6, -21.35], [31.6, -15.65], [42.1, -9.65], [52.6, -4.25], [58.2, -2.15], [64.8, -1.05], [74, -10],
  ]),
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
  // Plantings, all put in April 2025 (owner, corrected 2026-10-18). Sizes are estimates.
  plants: [
    // 12 Thuja Green Giant arborvitae, evenly spaced 3' in front of the back fence
    ...plantRow('thuja', [LOT.x0, LOT.y0 + 3.15], [LOT.x1, LOT.y0 + 3.15], 12),
    // 4 each behind the house, out past the garage side and the chimney side
    ...plantRow('thuja', [54.6, -0.3], [54.6, -19.8], 4),
    ...plantRow('thuja', [-2.8, -1.9], [-2.8, -19.4], 4),
    { kind: 'serviceberry', at: [27.6, -29.1] },
    { kind: 'cherry', at: [8.9, -29.1] },
    // Front yard (owner's markup), mature multi-trunk trees
    { kind: 'maple', at: [3.6, 40.2] },
    { kind: 'maple', at: [28.2, 49.5] },
  ],
  // Downspout drains and French drain (owner's markup on a later survey,
  // 2026-10-17), scaled off that drawing. Pipes are buried.
  drainage: {
    // [x, y, gutter height]: downspouts tied into the solid pipe
    downspouts: [[-0.3, 31.7, 19.6], [-0.3, -0.3, 19.6], [57.3, 3.3, 9.9], [57.3, 35.7, 9.9]],
    // 4" solid pipe from the downspouts, back along both side yards and across the back
    solid: [
      [[-0.3, 31.7], [-4.3, 30.4], [-3.8, -1.6], [-3.6, -88.9], [59.4, -82.4], [60.4, 3.3], [59.7, 33.4], [57.3, 35.7]],
      [[-0.3, -0.3], [-3.8, -1.6]],
      [[57.3, 3.3], [60.4, 3.3]],
    ],
    // 4" perforated pipe in a fabric-wrapped trench of 3/4" clean stone
    french: [[35.8, -85.6], [62.6, -86.1], [63.9, -49.6]],
  },
  pole: [LOT.x1 + 5.7, LOT.y1 + 9.5], // utility pole by the P.O.B.
  // Overhead service drop lands high on the garage's right side wall and runs
  // down the wall to the meter, about 7.5' back from the front corner.
  service: { x: 57.25, y: 28.5, attachZ: 15, meterZ: 5 },
  corners: [
    { at: [LOT.x1, LOT.y1], label: 'Pipe found (P.O.B.); the older survey shows an iron bar' },
    { at: [LOT.x1, LOT.y0], label: `Iron pipes found, 0.5' S / 0.3' E and 0.2' S` },
    { at: [LOT.x0, LOT.y0], label: 'Iron pipe with cap' },
    { at: [LOT.x0, LOT.y1], label: 'Front left corner (no marker noted)' },
  ],
}

// Kitchen bay, cantilevered off the rear wall (centerlines). Sizes from the
// deck plan's outline of the house: 9'-3" at the wall, 6'-0" face, 1'-7" out.
export const BAY = [[16.68, 0], [18.3, -1.62], [24.3, -1.62], [25.92, 0]]

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
  joistBottom: 0.69, // 5/4 decking + 2x8 joists
  beams: [8, 16], // (3) 2x10 beams, 2'-0" cantilever past the outer one
  // Lattice door in the skirt on the stair side, between the stair and the outer corner (photo)
  skirtDoor: { d0: 12.9, d1: 15.9 },
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

// Basement finished in 2017 (owner's permit sketch, released 3-29-17). The
// sketch is drawn with the front of the house at the top and is not to scale;
// positions come from it, anchored on the stair, the girder line and the
// mechanicals the 2001 foundation plan already locates. Walls are galvanized
// metal studs at 16" o.c. with 1/2" drywall and R-13; ceilings are drywall.
// The basement under the study wing (the plans' optional foundation) holds a
// bath and unfinished storage.
export const BSMT = {
  girderY: 15.2, // dividing walls follow the drop girder and its lally columns
  officeX: 18.75, // the open area | the finished room
  closetX: 19.25, // the closet under the stair, TV room side
  utilityX: 7.0, // the finished room | the utility room and its closet
  utilityY: 4.6, // the utility room | the closet behind it
  waterX: 25.3, // the water service closet in the right front corner
  waterY: 28.9,
  wingX: 56.31, // foundation under the study wing (as the owner modeled it in Maya, Oct 2026)
  wingY0: 3,
  wingY1: 14,
  bathX: 44.7, // the bath's left wall, in the wing
  bathY: 7.75, // the bath | the storage behind it
  ceiling: 'Drywall ceiling below the joists (8\'-0" to the joists)',
}

// Main stair (sheets 2 and 3): 3'-0" wide against the living room wall, up
// toward the rear: 10 treads to a 3'-0" landing, then 3 treads turning toward
// the kitchen side, arriving on the second floor at x 19. The basement stair
// runs underneath with the same L (sheet 1: 14 risers, 13 treads): down from
// a 2'-8" door at the back of the foyer, 3 treads to a landing, then 9 treads
// toward the front. Treads are 10".
export const STAIR = {
  x0: 13.5, x1: 16.5, // flight width
  landY0: 15.75, landY1: 18.75, // landing, back to front
  topX: 19.0, // top riser of the turn (both stairs)
  tread: 10 / 12,
  risers: 15, lower: 10, // main stair: risers in the long flight (the landing is the 11th)
  bRisers: 14, bLower: 9, // basement stair: treads in its long flight
}
STAIR.bottomY = STAIR.landY1 + STAIR.lower * STAIR.tread // first riser of the main stair
STAIR.bBottomY = STAIR.landY1 + STAIR.bLower * STAIR.tread // last riser of the basement stair
// Garage wing partitions (optional study plan, adjusted to the house): x of the
// walls between the back rooms, y of the wall along the back hall, and y of the
// back of the pantry, a 2' reach-in the laundry room wraps behind. The study
// is 109" wide inside (owner); the plan says 9'-10".
const WING = { powderX: 40.75, pantryX: 43.25, studyX: 47.5, roomsY: 10.75, pantryBackY: 8.4 }
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
    name: 'Open area',
    subtitle: 'Finished basement',
    type: 'living',
    flooring: 'carpet',
    poly: rect(BSMT.officeX, 0, W, BSMT.girderY),
    dims: '17\'-0" x 14\'-8"',
    ceiling: BSMT.ceiling,
    notes: [
      'Half wall along the girder line to the TV room',
      'Doors through the foundation wall to the bath and the storage under the study',
      '4" concrete slab, 6 mil vapor barrier on 4" gravel; 12" CMU foundation walls',
      '(2) 2x10 Microlam drop girder on 4" lally columns at about 5\'-9" o.c.',
      'Waterproofing below grade, 4" interior perimeter drain to sump pit',
    ],
  },
  {
    id: 'tvroom',
    level: 'B',
    name: 'TV room',
    subtitle: 'Finished basement',
    type: 'living',
    flooring: 'carpet',
    poly: [
      [BSMT.closetX, BSMT.girderY], [W, BSMT.girderY], [W, BSMT.waterY], [BSMT.waterX, BSMT.waterY], [BSMT.waterX, D],
      [STAIR.x0, D], [STAIR.x0, STAIR.bBottomY], [STAIR.x1, STAIR.bBottomY], [STAIR.x1, STAIR.landY1], [BSMT.closetX, STAIR.landY1],
    ],
    labelAt: [27, 22],
    dims: 'about 19\' x 16\'',
    ceiling: BSMT.ceiling,
    notes: ['Open to the area behind it over a half wall', 'The stair comes down along its left side', 'Smoke detector at the foot of the stair'],
  },
  {
    id: 'gym',
    level: 'B',
    name: 'Gym',
    subtitle: 'Finished basement',
    type: 'living',
    flooring: 'carpet',
    poly: rect(0, BSMT.girderY, STAIR.x0, D),
    dims: '13\'-0" x 16\'-3"',
    ceiling: BSMT.ceiling,
    notes: ['Door to the utility room', 'Reached past the foot of the stair from the TV room'],
  },
  {
    id: 'bonusroom',
    level: 'B',
    name: 'Finished room',
    subtitle: 'Finished basement',
    type: 'living',
    flooring: 'carpet',
    poly: rect(BSMT.utilityX, 0, BSMT.officeX, BSMT.girderY),
    dims: '11\'-2" x 14\'-8"',
    ceiling: BSMT.ceiling,
    notes: ['Door from the open area', 'Door to the closet in the corner'],
  },
  {
    id: 'utility',
    level: 'B',
    name: 'Utility room',
    type: 'basement',
    poly: rect(0, BSMT.utilityY, BSMT.utilityX, BSMT.girderY),
    dims: '6\'-6" x 10\'-1"',
    ceiling: BSMT.ceiling,
    notes: ['Furnace and hot water heater', 'Electric panel on the left foundation wall', 'Wall vent to the gym; door from the gym'],
  },
  {
    id: 'bcloset',
    level: 'B',
    name: 'Closet',
    subtitle: 'Basement, left rear corner',
    type: 'closet',
    flooring: 'carpet',
    poly: rect(0, 0, BSMT.utilityX, BSMT.utilityY),
    ceiling: BSMT.ceiling,
    notes: ['Door from the finished room'],
  },
  {
    id: 'stairclos',
    level: 'B',
    name: 'Closet',
    subtitle: 'Under the stair',
    type: 'closet',
    flooring: 'carpet',
    poly: rect(STAIR.x0, BSMT.girderY, BSMT.closetX, STAIR.landY1),
    ceiling: 'Under the stair',
    notes: ['Door from the TV room'],
  },
  {
    id: 'watercloset',
    level: 'B',
    name: 'Water service',
    subtitle: 'Basement, right front corner',
    type: 'basement',
    poly: rect(BSMT.waterX, BSMT.waterY, W, D),
    ceiling: BSMT.ceiling,
    notes: ['Water service and the main drain enter here from the street', 'Door from the TV room'],
  },
  {
    id: 'bbath',
    level: 'B',
    name: 'Bath',
    subtitle: 'Basement, under the study wing',
    type: 'bath',
    poly: rect(W, BSMT.bathY, BSMT.bathX, BSMT.wingY1),
    dims: 'about 8\'-6" x 6\'-3"',
    ceiling: BSMT.ceiling,
    notes: ['Shower, toilet and sink', 'Exhaust fan', 'Door through the foundation wall from the open area'],
  },
  {
    id: 'bstorage',
    level: 'B',
    name: 'Unfinished storage',
    subtitle: 'Under the study wing',
    type: 'basement',
    poly: [[W, BSMT.wingY0], [BSMT.wingX, BSMT.wingY0], [BSMT.wingX, BSMT.wingY1], [BSMT.bathX, BSMT.wingY1], [BSMT.bathX, BSMT.bathY], [W, BSMT.bathY]],
    ceiling: 'Open to the floor joists',
    notes: ['Left unfinished in the 2017 renovation', 'Door through the foundation wall from the open area'],
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
    // Includes the recess that juts into the dining room: refrigerator alcove,
    // then the short passage to the dining room's framed opening
    poly: [[16.67, 0], BAY[1], BAY[2], BAY[3], [W, 0], [W, 17.85], [25.1, 17.85], [25.1, 15.5], [16.67, 15.5]],
    labelAt: [21.5, 9],
    dims: '19\'-0" x 14\'-11" plus bay',
    ceiling: "9'-0\"",
    notes: [
      'Cantilevered bay with patio door and two tempered 2046 side windows',
      '(2) 2x12 Microlam header over the bay',
      'C235 casement over the sink, GFI outlets at 44" AFF',
      'Honey oak cabinets, black granite counters, dark backsplash, stainless appliances',
      'Gas range under a hood, dishwasher beside the sink',
      'French-door refrigerator and a microwave counter in an alcove under a (2) 2x14 Microlam header',
      '3\'-0" openings to the dining room and to the back of the foyer',
      'Island with seating for two; dinette table by the bay and the half wall',
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
    // The basement stairwell is cut out (its own room below)
    poly: [
      [STAIR.topX, 15.5], [22.67, 15.5], [22.67, D], [13.5, D], [13.5, 25.4],
      [STAIR.x1, 25.4], [STAIR.x1, STAIR.landY1], [STAIR.topX, STAIR.landY1],
    ],
    labelAt: [19.6, 29.5],
    dims: '8\'-10" wide, two-story',
    ceiling: 'Open to second floor',
    notes: [
      'Front entry: 3\'-0" x 6\'-8" metal insulated door',
      'Stair: 15 risers at 8.25" max, 14 treads at 10"; up toward the rear to a 3\'-0" landing, then 3 treads toward the kitchen side',
      'Handrails both sides at 36" above nosing, balusters at 4" max opening',
      'Back of the foyer: 3\'-0" opening to the kitchen, 2\'-8" door to the basement stair, coat closet',
    ],
  },
  {
    id: 'bstair',
    level: 'L1',
    name: 'Basement stair',
    type: 'hall',
    floor: H.ff1 - 4 * ((H.ff1 - H.basementFloor) / STAIR.bRisers), // landing under the main stair's landing
    poly: rect(STAIR.x0, 15.5, STAIR.topX, STAIR.landY1),
    labelAt: [16.2, 17.1],
    dims: '3\'-0" wide',
    ceiling: 'Under the main stair',
    notes: [
      '2\'-8" x 6\'-8" wood door from the back of the foyer',
      '14 risers at 8.25" max, 13 treads at 10": 3 treads down to a landing, then 9 toward the front',
      'Handrails both sides at 36" above nosing',
    ],
  },
  {
    id: 'coat',
    level: 'L1',
    name: 'Coat closet',
    subtitle: 'Foyer',
    type: 'closet',
    poly: rect(22.67, 15.5, 25.1, 19.0),
    dims: '2\'-0" deep',
    ceiling: "9'-0\"",
    notes: ['2\'-0" door from the back of the foyer', 'Pole and shelf'],
  },
  {
    id: 'dining',
    level: 'L1',
    name: 'Dining room',
    type: 'living',
    // Coat closet in the back-left corner, the kitchen's recess along the back
    poly: [[22.67, 19.0], [25.1, 19.0], [25.1, 17.85], [W, 17.85], [W, D], [22.67, D]],
    labelAt: [29.4, 24.6],
    dims: '13\'-0" x 14\'-1"',
    ceiling: "9'-0\"",
    notes: [
      '6\'-6" cased opening to the foyer under a (2) 2x10 header, toward the front',
      '3\'-0" x 6\'-8" framed opening to the kitchen',
      'The kitchen\'s refrigerator alcove and the coat closet take the back of the room',
    ],
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
    // outside: its label shows in the whole-house view, which it stays in when
    // picked there, and the whole-house list puts it with the property
    outdoor: true,
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
      `Stair: 7 treads down to the lawn (the plans show a 1' x 4' concrete pad; there is none), riser lights`,
      'Lattice skirt in brown frame panels, with a lattice door on the stair side',
      'Design loads: 50 PSF live, 10 PSF dead, 115 mph wind',
    ],
    // The deck's parts, each with its full notes, in one listing
    sections: [
      { title: 'Posts & helical piers', details: [
        'Seven 6x6 PT posts (ground-contact rated, MCA .23) on Goliath Tech helical piles',
        `Support plate MHC1161-3B post cap, 10" helix, 3'-0" minimum depth`,
        'Required loads: #1 246 lb, #2 2,992, #3 3,638, #4 2,880, #5 2,155, #6 2,880, #7 2,155',
        `Installer field report records each pile's depth, torque and bearing capacity`,
      ] },
      { title: 'Ledger', details: [
        'Bolted to the house rim joist with 3 5/8" LedgerLOK fasteners, staggered',
        'Simpson DTT1Z-KT tension ties at 4 places, one within 24" of each end',
        'Joist hangers: Simpson LUS26S; flashing and counter flashing behind the siding',
      ] },
      { title: 'Lighting', details: ['Post cap lights on 10 rail posts', 'Riser lights on the 7 stair risers'] },
      { title: 'Door to the under-deck space', details: [
        'Lattice door in the skirt on the stair side, between the bottom of the stair and the outer corner',
        'Black hinges on the corner side, latch on the stair side',
        'The deck plan shows a gate on the far side; the photo shows it here',
      ] },
    ],
  },

  // First floor, garage wing: built to the optional study plan (sheet 2). Along
  // the back, left to right: powder room, pantry closet, laundry room (owner),
  // then the study; a back hall runs along the garage wall. The three small
  // rooms share the plan's 8'-0" bath plus closet strip; their widths are estimates.
  {
    id: 'powder',
    level: 'L1',
    name: 'Powder room',
    type: 'bath',
    poly: rect(W, 3, WING.powderX, WING.roomsY),
    dims: `about 4'-4" x 7'-4"`,
    ceiling: "8'-0\"",
    notes: ['Toilet and lavatory', 'Andersen 3032 window', '2\'-8" x 6\'-8" wood door from the back hall'],
  },
  {
    id: 'pantry',
    level: 'L1',
    name: 'Pantry closet',
    type: 'closet',
    poly: rect(WING.powderX, WING.pantryBackY, WING.pantryX, WING.roomsY),
    dims: `about 2'-2" wide x 2'-0" deep (reach-in)`,
    ceiling: "8'-0\"",
    notes: ['Shelving on the back wall', 'Door from the back hall', 'The laundry room wraps behind it'],
  },
  {
    id: 'laundry',
    level: 'L1',
    name: 'Laundry room',
    type: 'utility',
    poly: [
      [WING.powderX, 3], [WING.studyX, 3], [WING.studyX, WING.roomsY], [WING.pantryX, WING.roomsY],
      [WING.pantryX, WING.pantryBackY], [WING.powderX, WING.pantryBackY],
    ],
    labelAt: [45.4, 6.4],
    dims: `L-shaped: about 3'-11" wide at the door, 6'-5" behind the pantry, 7'-4" deep`,
    ceiling: "8'-0\"",
    notes: [
      'Washer and dryer side by side in the alcove behind the pantry, facing the door',
      'Wire shelf across the back wall',
      'Tile floor',
      'Door from the back hall',
    ],
  },
  {
    id: 'backhall',
    level: 'L1',
    name: 'Back hall',
    type: 'hall',
    poly: rect(W, WING.roomsY, WING.studyX, 14),
    dims: '3\'-4" deep',
    ceiling: "8'-0\"",
    notes: [
      '2\'-8" x 6\'-8" framed opening to the kitchen',
      '3\'-0" x 6\'-8" 20-minute door with closer to the garage, steps down',
      'Doors to the powder room, pantry, laundry and study',
    ],
  },
  {
    id: 'study',
    level: 'L1',
    name: 'Study',
    type: 'living',
    poly: rect(WING.studyX, 3, GX, 14),
    dims: '9\'-1" x 11\'-0"',
    ceiling: "8'-0\" (2x6 ceiling joists at 16\" o.c.)",
    notes: [
      '(2) Andersen 3046 windows, R.O. 6\'-3 15/16" x 4\'-9 1/4"',
      '2\'-8" x 6\'-8" wood door from the back hall',
      'Built as the optional study plan on sheet 2, behind the garage',
      '109" wide inside (the plan says 9\'-10")',
    ],
  },
  {
    id: 'garage',
    level: 'L1',
    name: 'Two-car garage',
    type: 'garage',
    floor: H.garageFloor,
    poly: rect(W, 14, GX, 36),
    dims: '20\'-6" x 21\'-0"',
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
      [8.1, 12], [22.67, 12], [22.67, STAIR.landY1], [STAIR.topX, STAIR.landY1],
      [STAIR.topX, STAIR.landY0], [13.5, STAIR.landY0], [13.5, 20.4], [9.8, 20.4], [9.8, 17.9], [8.1, 17.9],
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
    notes: ['2x10 rafters and 2x10 ceiling joists at 16" o.c.', 'Door to the sleeping nook (former walk-in closet) over the garage'],
  },
  {
    id: 'mcloset',
    level: 'L2',
    name: 'Sleeping nook',
    subtitle: 'Former master closet',
    type: 'bedroom',
    poly: rect(W, 14.25, 45.67, 24.75),
    dims: '9\'-0" x 9\'-10"',
    ceiling: '6\'-8" plate height',
    notes: [
      'Built as the master walk-in closet over the garage; now a sleeping area with a twin bed',
      'Door from the master bedroom; door on the right wall to the closet extension',
    ],
  },
  {
    id: 'closetext',
    level: 'L2',
    name: 'Closet extension',
    subtitle: 'Under the garage roof',
    type: 'closet',
    // L-shaped: behind the nook across the wing, and beside it to the front (owner's markup)
    poly: [[W, 11], [55.4, 11], [55.4, 24.75], [45.67, 24.75], [45.67, 14.25], [W, 14.25]],
    labelAt: [50.5, 19.5],
    dims: `L-shaped: about 19' x 3' behind the nook, 9'-5" x 10'-6" beside it`,
    ceiling: 'Sloped under the garage roof, low knee walls at the back and side',
    notes: ['Carpeted', 'Built into the attic space over the garage', 'Door from the sleeping nook'],
  },
]

// Floor finishes (owner, 2026-10-17): carpet in the study, family room and
// living room and all of the second floor, hardwood everywhere else. Baths and the laundry room are tile
// (the laundry photo shows white tile).
const CARPETED = new Set(['study', 'family', 'living'])
export const FLOORING_NAMES = { carpet: 'Carpet', hardwood: 'Hardwood', tile: 'Tile', concrete: 'Concrete' }
for (const r of ROOMS) {
  if (r.flooring !== undefined) continue
  if (CARPETED.has(r.id)) r.flooring = 'carpet'
  else if (r.type === 'bath' || r.id === 'laundry') r.flooring = 'tile'
  else if (r.level === 'L2') r.flooring = 'carpet'
  else if (r.type === 'garage' || r.type === 'basement') r.flooring = 'concrete'
  else if (r.type === 'porch' || r.type === 'deck') r.flooring = null
  else r.flooring = 'hardwood'
}

export const roomById = Object.fromEntries(ROOMS.map((r) => [r.id, r]))

// ---------------------------------------------------------------- walls

// kind: wall (default) | knee | rail | foundation
export const WALLS = [
  // Basement foundation, 12" CMU
  ...[
    [[0, 0], [W, 0], [win('2813', 14.1, { head: 8.2 }), win('2813', 30.6, { head: 8.2 })]],
    [[W, 0], [W, D], [
      door(4.9, 2.67, 'Door through the foundation wall to the storage under the study', { style: 'interior' }),
      door(9.6, 2.67, 'Door through the foundation wall to the bath', { style: 'interior' }),
    ]],
    [[0, D], [W, D], []],
    [[0, 0], [0, D], [win('2813', 24.7, { head: 8.2 })]],
    // under the study wing
    [[W, BSMT.wingY0], [BSMT.wingX, BSMT.wingY0], []],
    [[BSMT.wingX, BSMT.wingY0], [BSMT.wingX, BSMT.wingY1], []],
    [[W, BSMT.wingY1], [BSMT.wingX, BSMT.wingY1], []],
  ].map(([a, b, openings]) => ({ level: 'B', a, b, t: 1, ext: true, kind: 'foundation', h: 8.4, openings })),

  // Basement finished in 2017: metal-stud walls (see BSMT)
  {
    level: 'B', a: [0, BSMT.girderY], b: [BSMT.closetX, BSMT.girderY], t: INT,
    openings: [door(2.4, 2.67, 'Door from the gym to the utility room', { style: 'interior' })],
  },
  { level: 'B', a: [BSMT.closetX, BSMT.girderY], b: [W, BSMT.girderY], t: INT, kind: 'knee', h: 3.5 },
  { level: 'B', a: [STAIR.x0, BSMT.girderY], b: [STAIR.x0, STAIR.bBottomY], t: INT },
  { level: 'B', a: [STAIR.x1, STAIR.landY1], b: [STAIR.x1, STAIR.bBottomY], t: INT },
  { level: 'B', a: [STAIR.x1, STAIR.landY1], b: [BSMT.closetX, STAIR.landY1], t: INT },
  {
    level: 'B', a: [BSMT.closetX, BSMT.girderY], b: [BSMT.closetX, STAIR.landY1], t: INT,
    openings: [door(17.0, 2, 'Closet door', { style: 'interior' })],
  },
  {
    level: 'B', a: [BSMT.officeX, 0], b: [BSMT.officeX, BSMT.girderY], t: INT,
    openings: [door(12.2, 2.67, 'Door from the open area', { style: 'interior' })],
  },
  {
    level: 'B', a: [BSMT.utilityX, 0], b: [BSMT.utilityX, BSMT.girderY], t: INT,
    openings: [door(2.3, 2.5, 'Closet door', { style: 'interior' })],
  },
  { level: 'B', a: [0, BSMT.utilityY], b: [BSMT.utilityX, BSMT.utilityY], t: INT },
  { level: 'B', a: [BSMT.waterX, BSMT.waterY], b: [W, BSMT.waterY], t: INT },
  {
    level: 'B', a: [BSMT.waterX, BSMT.waterY], b: [BSMT.waterX, D], t: INT,
    openings: [door(30.2, 2, 'Door to the water service', { style: 'interior' })],
  },
  { level: 'B', a: [BSMT.bathX, BSMT.bathY], b: [BSMT.bathX, BSMT.wingY1], t: INT },
  { level: 'B', a: [W, BSMT.bathY], b: [BSMT.bathX, BSMT.bathY], t: INT },

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
    // none on the living room side (owner)
    openings: [win('3046', 2.92), win('3046', 13.08)],
  },
  {
    level: 'L1', a: [0, D], b: [W, D], t: EXT, ext: true,
    openings: [
      ...[3.75, 10.25].map((x) => ({ ...win('3052', x), shutters: true })),
      door(18.1, 5.3, '3\'-0" x 6\'-8" front entry door with two sidelights', { style: 'front' }),
      ...[25.75, 32.25].map((x) => ({ ...win('3052', x), shutters: true })),
    ],
  },
  { level: 'L1', a: [W, 0], b: [W, 3], t: EXT, ext: true },
  {
    level: 'L1', a: [W, 3], b: [W, 14], t: INT,
    openings: [opening(12.4, 2.67, '2\'-8" x 6\'-8" framed opening')],
  },
  // House | garage fire wall
  { level: 'L1', a: [W, 14], b: [W, D], t: EXT, base: H.garageFloor, h: H.ceil1 - H.garageFloor },
  { level: 'L1', a: [W, D], b: [W, 36], t: EXT, ext: true, base: H.garageFloor, h: H.garagePlate - H.garageFloor },

  // Garage wing exterior
  {
    level: 'L1', a: [W, 3], b: [GX, 3], t: EXT, ext: true, base: H.garageFloor, h: H.garagePlate - H.garageFloor,
    openings: [
      // Optional study plan: 3032 at the powder room, (2) 3046 at the study, no rear door
      win('3032', W + 3.5, { head: 7 + H.ff1 - H.garageFloor }),
      win('3046', W + 3.5 + 12.08, { twin: true, head: 7 + H.ff1 - H.garageFloor }),
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
      opening(20.75, 3, '3\'-0" opening to the back of the foyer'),
      // The (2) 2x14 Microlam header is flush with the ceiling here (owner): open full height
      opening(30.63, 10.67, 'Open to the refrigerator alcove; (2) 2x14 Microlam header in the ceiling', 9),
    ],
  },
  // Back wall of the kitchen's recess (refrigerator alcove and the passage to
  // the dining room), built out into the dining room
  {
    level: 'L1', a: [25.1, 17.85], b: [W, 17.85], t: INT,
    openings: [opening(27.45, 3, '3\'-0" x 6\'-8" framed opening to the dining room')],
  },
  // Coat closet (pole and shelf) and the basement stair door at the back of the foyer
  { level: 'L1', a: [25.1, 15.5], b: [25.1, 19.0], t: INT },
  { level: 'L1', a: [22.67, 19.0], b: [25.1, 19.0], t: INT },
  {
    level: 'L1', a: [STAIR.topX, 15.5], b: [STAIR.topX, STAIR.landY1], t: INT,
    openings: [door(17.15, 2.67, '2\'-8" x 6\'-8" wood door to the basement stair', { style: 'interior' })],
  },
  { level: 'L1', a: [16.67, 0], b: [16.67, 9.4], t: INT, kind: 'knee', h: 3 },
  { level: 'L1', a: [13.5, 15.5], b: [13.5, D], t: INT, openings: [opening(29.6, 3.4, 'Cased opening')] },
  {
    level: 'L1', a: [22.67, 15.5], b: [22.67, D], t: INT,
    openings: [
      door(17.55, 2, '2\'-0" x 6\'-8" coat closet door', { style: 'interior' }),
      opening(27.55, 6.5, '6\'-6" cased opening'),
    ],
  },
  // Garage wing interior (raised to first floor level, 8'-0" ceilings)
  { level: 'L1', a: [WING.powderX, 3], b: [WING.powderX, WING.roomsY], t: INT, h: 8 },
  { level: 'L1', a: [WING.pantryX, WING.pantryBackY], b: [WING.pantryX, WING.roomsY], t: INT, h: 8 },
  { level: 'L1', a: [WING.powderX, WING.pantryBackY], b: [WING.pantryX, WING.pantryBackY], t: INT, h: 8 },
  {
    level: 'L1', a: [WING.studyX, 3], b: [WING.studyX, 14], t: INT, h: 8,
    openings: [door(12.4, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' })],
  },
  {
    level: 'L1', a: [W, WING.roomsY], b: [WING.studyX, WING.roomsY], t: INT, h: 8,
    openings: [
      door(39.2, 2.67, '2\'-8" x 6\'-8" wood door', { style: 'interior' }),
      door((WING.powderX + WING.pantryX) / 2, 2, '2\'-0" x 6\'-8" pantry door', { style: 'interior' }),
      door((WING.pantryX + WING.studyX) / 2, 2.67, '2\'-8" x 6\'-8" laundry door', { style: 'interior' }),
    ],
  },
  // Load-bearing wall between the wing and the garage
  {
    level: 'L1', a: [W, 14], b: [GX, 14], t: EXT, base: H.garageFloor, h: H.garagePlate - H.garageFloor,
    openings: [door(38.1, 3, '3\'-0" x 6\'-8" 20-minute door with closer to the garage', { h: 6.67 + H.ff1 - H.garageFloor, sill: H.ff1 - H.garageFloor, style: 'entry' })],
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
    // Shutters on every front window except the center one under the gable (photo)
    openings: [3.75, 10.25, 18.1, 25.75, 32.25].map((x) => ({ ...win('3046', x, { head: 6.83 }), shutters: x !== 18.1 })),
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
  // Master bedroom's left wall: it runs back to the hall wall (no jog in the
  // hall; the corner behind it belongs to the master suite), with a pair of
  // 2'-6" doors onto the stair landing (plans sheet 3; owner's photo)
  {
    level: 'L2', a: [22.67, 12], b: [22.67, D], t: INT,
    openings: [door(16.2, 5, '(2) 2\'-6" x 6\'-8" wood doors (a pair)', { style: 'interior' })],
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
  { level: 'L2', a: [13.5, STAIR.landY0], b: [13.5, D], t: INT },
  // Guards around the stairwell and the two-story foyer
  { level: 'L2', a: [13.5, STAIR.landY0], b: [STAIR.topX, STAIR.landY0], t: 0.25, kind: 'rail', h: 3 },
  { level: 'L2', a: [STAIR.topX, STAIR.landY1], b: [22.67, STAIR.landY1], t: 0.25, kind: 'rail', h: 3 },
  // Master closet tucked under the garage roof (6'-8" +/- plate height)
  { level: 'L2', a: [W, 14.25], b: [45.67, 14.25], t: INT, h: 6.3 },
  {
    level: 'L2', a: [45.67, 14.25], b: [45.67, 24.75], t: INT, h: 6.3,
    openings: [door(16.2, 2.67, 'Door to the closet extension', { style: 'interior' })],
  },
  { level: 'L2', a: [W, 24.75], b: [55.4, 24.75], t: INT, h: 6.3 },
  // Closet extension: knee walls under the sloped garage roof
  { level: 'L2', a: [W, 11], b: [55.4, 11], t: INT, h: 3.9 },
  { level: 'L2', a: [55.4, 11], b: [55.4, 24.75], t: INT, h: 3.9 },
]

// ---------------------------------------------------------------- fixtures
// Built-ins drawn on the plans. z0/z1 are heights above the level's floor
// (or above `floor` when given). shape: box (default) or cyl.

const OAK = '#caa26c' // honey oak cabinets
const GRANITE = '#1c1d1f' // black granite
const STEEL = '#b9bcc0' // stainless
const SPLASH = '#2e3a40' // dark backsplash

export const FIXTURES = [
  // Basement
  ...[6.75, 12.5, 18.25, 24, 29.75].map((x) => ({ level: 'B', shape: 'cyl', x, y: 15.2, r: 0.17, z0: 0, z1: 7.4, color: '#7d8590' })),
  { level: 'B', x0: 0.5, y0: 14.95, x1: W - 0.5, y1: 15.45, z0: 7.4, z1: 8.4, color: '#b69a73' },
  { level: 'B', x0: 3.66, y0: 5.34, x1: 6.26, y1: 7.54, z0: 0, z1: 5, color: '#9aa3ad', name: 'Furnace' },
  { level: 'B', shape: 'cyl', x: 1.6, y: 10.97, r: 0.95, z0: 0, z1: 5, color: '#c9ced4', name: 'Hot water heater' },
  { level: 'B', shape: 'cyl', x: 54.59, y: 4.76, r: 0.9, z0: 0, z1: 0.1, color: '#4c5560', name: 'Sump pit' },
  // Basement bath (2017): shower against the bath's left wall, toilet and sink
  // along the front wall
  { level: 'B', x0: 42.0, y0: 8.2, x1: 44.45, y1: 12.9, z0: 0, z1: 0.3, color: '#dfe6ec', name: 'Shower' },
  { level: 'B', x0: 41.95, y0: 8.2, x1: 42.05, y1: 12.9, z0: 0.3, z1: 6.5, color: '#bcd3e3', glass: true },
  { level: 'B', x0: 39.6, y0: 12.0, x1: 40.9, y1: 13.45, z0: 0, z1: 1.3, color: '#f4f5f6', name: 'Toilet' },
  { level: 'B', x0: 36.75, y0: 12.0, x1: 38.95, y1: 13.45, z0: 0, z1: 2.8, color: '#e9e4da', top: '#f4f5f6', name: 'Bath sink' },

  // Kitchen, from photos (Oct 2026): honey oak cabinets, black granite, stainless
  // appliances. Window wall: base run with the sink under the window and the
  // dishwasher beside it.
  { level: 'L1', x0: 24.8, y0: 0.25, x1: 35.92, y1: 2.25, z0: 0, z1: 2.95, color: OAK, top: GRANITE },
  { level: 'L1', x0: 27.4, y0: 2.22, x1: 29.4, y1: 2.3, z0: 0.3, z1: 2.85, color: STEEL, name: 'Dishwasher' },
  { level: 'L1', x0: 29.65, y0: 0.6, x1: 31.85, y1: 1.85, z0: 3.08, z1: 3.12, color: '#55595e', name: 'Sink' },
  { level: 'L1', x0: 24.8, y0: 0.25, x1: 28.6, y1: 1.35, z0: 4.5, z1: 7.5, color: OAK },
  { level: 'L1', x0: 32.9, y0: 0.25, x1: 34.6, y1: 1.35, z0: 4.5, z1: 7.5, color: OAK },
  { level: 'L1', x0: 24.8, y0: 0.25, x1: 28.6, y1: 0.3, z0: 3.1, z1: 4.5, color: SPLASH },
  // Range wall: base cabinets and uppers either side of the range and hood,
  // corner open shelves, dark backsplash; the run stops at the back-hall opening
  { level: 'L1', x0: 33.92, y0: 2.25, x1: 35.92, y1: 5.2, z0: 0, z1: 2.95, color: OAK, top: GRANITE },
  { level: 'L1', x0: 33.92, y0: 7.7, x1: 35.92, y1: 10.6, z0: 0, z1: 2.95, color: OAK, top: GRANITE },
  { level: 'L1', x0: 33.85, y0: 5.2, x1: 35.92, y1: 7.7, z0: 0, z1: 3.0, color: STEEL, top: '#26282b', name: 'Range' },
  { level: 'L1', x0: 35.85, y0: 0.25, x1: 35.92, y1: 10.6, z0: 3.1, z1: 4.5, color: SPLASH },
  { level: 'L1', x0: 34.6, y0: 1.35, x1: 35.92, y1: 5.2, z0: 4.5, z1: 7.5, color: OAK },
  { level: 'L1', x0: 34.6, y0: 7.7, x1: 35.92, y1: 10.6, z0: 4.5, z1: 7.5, color: OAK },
  { level: 'L1', x0: 34.6, y0: 5.2, x1: 35.92, y1: 7.7, z0: 6.5, z1: 7.5, color: OAK },
  { level: 'L1', x0: 34.35, y0: 5.25, x1: 35.92, y1: 7.65, z0: 6.15, z1: 6.5, color: STEEL, name: 'Range hood' },
  { level: 'L1', x0: 34.6, y0: 0.25, x1: 35.92, y1: 1.35, z0: 4.5, z1: 7.5, color: '#b9874c' },
  // Island: oak base with drawers toward the range, granite top overhanging the stool side
  { level: 'L1', x0: 27.9, y0: 5.0, x1: 30.9, y1: 10.5, z0: 0, z1: 2.95, color: OAK },
  { level: 'L1', x0: 27.3, y0: 4.9, x1: 31.0, y1: 10.6, z0: 2.95, z1: 3.1, color: GRANITE, name: 'Island' },
  // Alcove by the back-hall opening (plan: "REF." and a counter): French-door
  // refrigerator, then a counter with the microwave under its own uppers
  { level: 'L1', x0: 32.75, y0: 15.25, x1: 35.85, y1: 17.7, z0: 0, z1: 5.8, color: STEEL, name: 'Refrigerator' },
  { level: 'L1', x0: 32.75, y0: 16.3, x1: 35.85, y1: 17.7, z0: 6.0, z1: 7.6, color: OAK },
  { level: 'L1', x0: 29.45, y0: 15.6, x1: 32.65, y1: 17.7, z0: 0, z1: 2.95, color: OAK, top: GRANITE },
  { level: 'L1', x0: 30.25, y0: 16.3, x1: 31.85, y1: 17.6, z0: 3.1, z1: 4.0, color: '#1d1f22', name: 'Microwave' },
  { level: 'L1', x0: 29.45, y0: 16.6, x1: 32.65, y1: 17.7, z0: 4.6, z1: 7.6, color: OAK },
  { level: 'L1', x0: 29.45, y0: 17.62, x1: 32.65, y1: 17.7, z0: 3.1, z1: 4.6, color: SPLASH },
  // Post at the end of the half wall between the dinette and the family room
  { level: 'L1', x0: 16.5, y0: 9.25, x1: 16.85, y1: 9.6, z0: 0, z1: 9, color: '#d9dcd8' },
  // Fireplace
  { level: 'L1', x0: 0.25, y0: 5.8, x1: 1.4, y1: 10.2, z0: 0, z1: 4.4, color: '#9c8b7a' },
  { level: 'L1', x0: 1.38, y0: 6.9, x1: 1.45, y1: 9.1, z0: 0.4, z1: 2.9, color: '#2a2622' },
  { level: 'L1', x0: 0.25, y0: 5.4, x1: 2.9, y1: 10.6, z0: 0, z1: 0.06, color: '#8b7d6f' },
  // Powder room
  { level: 'L1', x0: 36.6, y0: 3.4, x1: 38.0, y1: 5.0, z0: 0, z1: 1.3, color: '#f4f5f6' },
  { level: 'L1', x0: 36.45, y0: 6.0, x1: 38.0, y1: 7.6, z0: 0, z1: 2.8, color: '#f4f5f6' },
  // Laundry room: washer and dryer side by side in the alcove behind the pantry,
  // fronts facing the door, under a wire shelf across the back wall (photo)
  { level: 'L1', x0: 40.95, y0: 5.85, x1: 43.25, y1: 8.15, z0: 0, z1: 3.2, color: '#f2f3f5', name: 'Washer' },
  { level: 'L1', x0: 40.95, y0: 3.45, x1: 43.25, y1: 5.75, z0: 0, z1: 3.2, color: '#f2f3f5', name: 'Dryer' },
  { level: 'L1', x0: 40.92, y0: 3.25, x1: 47.33, y1: 4.25, z0: 5.0, z1: 5.08, color: '#f4f5f6' },
  // Pantry shelving on its back wall
  { level: 'L1', x0: 40.92, y0: 8.57, x1: 43.08, y1: 9.6, z0: 0, z1: 7, color: '#d9c7a5' },

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
    id: 'furnace', level: 'B', at: [4.96, 6.44], z: 5.5, category: 'HVAC', name: 'Furnace',
    details: ['Utility room, basement, next to the water heater', 'Ducts run between 2x10 floor joists at 16" o.c.'],
  },
  {
    id: 'waterheater', level: 'B', at: [1.6, 10.97], z: 5.5, category: 'Plumbing', name: 'Hot water heater',
    details: ['Utility room, basement', 'Double joists framed above the mechanical area'],
  },
  {
    id: 'sump', level: 'B', at: [54.59, 4.76], z: 1.5, category: 'Plumbing', name: 'Sump pit',
    details: ['Collects the 4" interior perimeter drain', 'Unfinished storage under the study wing, right rear corner'],
  },
  {
    id: 'panel', level: 'B', at: [0.7, 11.7], z: 4.5, category: 'Electrical', name: 'Electric panel',
    details: ['Utility room, on the left foundation wall ("ELE" on the 2017 plan)', 'Basement circuits added in the 2017 renovation (electrical permit 3-29-17)'],
  },
  {
    id: 'smokeB', level: 'B', at: [15.4, 27.1], z: 7.5, category: 'Safety', name: 'Smoke detector (basement)',
    details: ['At the foot of the stair', 'Added in the 2017 renovation'],
  },
  {
    id: 'bathfan', level: 'B', at: [38.6, 8.6], z: 7.5, category: 'HVAC', name: 'Bath exhaust fan',
    details: ['Basement bath, under the study wing'],
  },
  {
    id: 'bsmtreno', level: 'B', at: [27, 8], z: 6.5, category: 'Structure', name: 'Basement renovation (2017)',
    details: [
      'Plan released by the Metuchen construction office: electrical 3-29-17, fire 3-28-17',
      'Walls and ceilings: 1/2" drywall; R-13 insulation in all walls',
      'Framing: galvanized metal studs at 16" o.c.; fire stopping at all walls as needed',
      'Existing lally columns kept in the walls',
    ],
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
    id: 'washer', level: 'L1', at: [42.1, 5.8], z: 3.8, category: 'Appliances', name: 'Washer & dryer',
    details: ['Laundry room, side by side in the alcove behind the pantry', 'Laundry tub with 1 1/2" drain on the riser diagram'],
  },
  {
    id: 'garagedoors', level: 'L1', floor: H.garageFloor, at: [46.5, 30], z: 8, category: 'Electrical', name: 'Garage door openers',
    details: ['Ceiling-mounted outlets for each opener', 'Two 8\'-0" x 7\'-0" overhead doors'],
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
    id: 'garageattic', level: 'L2', at: [52, 13], z: 4, category: 'Structure', name: 'Garage attic space',
    details: [
      'The plans call for a 24" x 36" access panel from the master closet into storage above the garage',
      'That space is now the carpeted closet extension, entered from the sleeping nook',
    ],
  },
  {
    id: 'smoke2', level: 'L2', at: [19, 14.6], z: 8, category: 'Safety', name: 'Smoke detectors (2nd floor)',
    details: ['Hard-wired to the panel', 'Upper hall and master bedroom'],
  },

  // Property (from the survey). `focus` frames the camera on a wider area.
  {
    id: 'lot', level: 'site', at: [28, 70], z: 3, category: 'Site', name: 'Lot & survey',
    focus: { at: [28, -3], r: 95 },
    sections: [
      { title: 'Lot 56.01, Block 216', details: [
        `75.00' x 175.00' = 13,125 sq ft (0.3013 acre)`,
        `Front line S 81°28'00" E on Orchard Street (formerly Orchard Avenue, 60' R.O.W.); side lines N 08°32'00" E`,
        `Point of beginning (front right corner) is 1,101.60' from Main Street (66' R.O.W.)`,
        'Borough of Metuchen tax map, sheet 75',
        `Also lot 96 and part of lot 95 on the "Map of 218 Building Plots, Property of Laura E. Jones" (1871), filed 1873 as Map No. 80, File No. 57`,
        'Neighbors: Lot 58 B (left), Lot 54 (right), Lot 126 (rear)',
      ] },
      { title: 'Setbacks', details: [
        `Required: front 25.00', rear 25.00', left side 10.00', right side 8.00'`,
        `Garage doors to front line: 48.00' (porch face 48.0', main house front about 52')`,
        `House to left line: 9.53' (the setback line is drawn at 10.00')`,
        `Garage to right line: 8.28' on the newer survey`,
        `Rear yard: about 91' from the back of the house to the rear line`,
      ] },
      { title: '100-year flood limit', details: [
        `Crosses the left line about 31' in front of the rear corner and the rear line about 48' from the left corner`,
        'The rear-left corner of the lot lies beyond the line',
      ] },
      { title: 'Edge of woods', details: [
        `Runs from about 59' in front of the rear line on the left side to just behind the garage at the right line`,
        'The backyard inside the lot lines is open; the woods continue on the neighboring lots',
      ] },
      { title: 'Property corner markers', details: SITE.corners.map((c) => c.label) },
    ],
  },
  {
    id: 'fence', level: 'site', at: [LOT.x1 - 0.15, -30], z: 6.5, category: 'Site', name: 'Fences & gate',
    focus: { at: [28, -25], r: 70 },
    sections: [
      { title: `6' white vinyl privacy fence`, details: [
        `Left side: from the left wall of the house (about 17.5' behind the front wall) to the left line, then back along the line to about 22' behind the house`,
        `Right side: along the right line (Lot 54) from the gate all the way back to the back lot line`,
        'The survey shows a wood stockade fence on the right line; it has been replaced',
      ] },
      { title: `4' chain-link fence`, details: [
        `Along the left line from about 22' behind the house to the back corner, then across the lot on the back lot line`,
        'The whole backyard, including the 100-year flood-limit corner, is inside the fence',
      ] },
      { title: 'Side yard gate', details: [
        `Single white vinyl gate, hinged on the left (garage side), latching at the right line`,
        `A fixed vinyl panel fills the space between the garage's right wall and the gate`,
      ] },
    ],
  },
  {
    id: 'arborvitae', level: 'site', at: [28, LOT.y0 + 3.15], z: 9, category: 'Landscape', name: 'Thuja Green Giant arborvitae (20)',
    focus: { at: [28, -48], r: 62 },
    planted: '2025-04',
    sections: [
      {
        title: 'Back screen (12)',
        details: [`Evenly spaced about 6'-3" apart, 3' in front of the back chain-link fence`],
      },
      {
        title: 'Garage side (4)',
        details: [`Evenly spaced in a line running back about 20' behind the house, out past the garage`],
      },
      {
        title: 'Chimney side (4)',
        details: [`Evenly spaced in a line running back about 19' behind the house, just outside its left wall`],
      },
      {
        title: 'The plant',
        details: [`Modeled at about 8' tall; Green Giants grow 3' to 5' a year, to 40' to 60' tall and 12' to 20' wide`],
      },
    ],
  },
  {
    id: 'serviceberry', level: 'site', at: [27.6, -29.1], z: 9, category: 'Landscape', name: 'Autumn Brilliance serviceberry',
    focus: { at: [20, -26], r: 25 },
    planted: '2025-04',
    details: [
      `Amelanchier × grandiflora 'Autumn Brilliance'`,
      `About 29' behind the house, in line with the deck's stair side`,
      `White flowers in early spring, small edible berries in June, orange-red fall color`,
      `Matures at about 20' to 25' tall and 15' to 20' wide`,
    ],
  },
  {
    id: 'cherry', level: 'site', at: [8.9, -29.1], z: 7.5, category: 'Landscape', name: 'Double pink weeping cherry',
    focus: { at: [12, -26], r: 25 },
    planted: '2025-04',
    details: [
      `About 29' behind the house, in line with the deck's far end`,
      'Double pink flowers in spring on weeping branches',
    ],
  },
  {
    id: 'drainage', level: 'site', at: [63.2, -70], z: 1.5, category: 'Drainage', name: 'Drainage',
    focus: { at: [28, -35], r: 75 },
    sections: [
      { title: 'Downspout drain lines', details: [
        '4" solid pipe, buried',
        'Downspouts at the front-left and rear-left corners of the house and the rear-right and front-right corners of the garage',
        'Runs back along both side yards and across the back of the lot to the French drain',
      ] },
      { title: 'French drain', details: [
        '4" perforated (holed) pipe, buried',
        'Along the back lot line on the right half, then up the right side line about 37\'',
        'Trench: 3/4" clean stone wrapped in filter fabric around the pipe, topsoil on top',
        'Takes the water from the downspout drain lines',
      ] },
    ],
  },
  {
    id: 'maples', level: 'site', at: [3.6, 40.2], z: 23, category: 'Landscape', name: 'Japanese maples (2)',
    focus: { at: [16, 44], r: 34 },
    sections: [
      { title: 'By the porch', details: [
        'Mature multi-trunk Japanese maple in front of the left end of the porch',
        'Identified from a photo of the house; about 20\' to 25\' tall',
      ] },
      { title: 'Front lawn', details: [
        'Mature multi-trunk Japanese maple in the front lawn, left of the driveway',
        'Identified from a photo of the house; about 20\' to 25\' tall',
      ] },
    ],
  },
  {
    id: 'frontbeds', level: 'site', at: [7.3, 37.7], z: 1.5, category: 'Landscape', name: 'Front planting beds',
    focus: { at: [18, 40], r: 25 },
    details: ['Mulched beds with low shrubs along the porch, on each side of the front steps'],
  },
  {
    id: 'driveway', level: 'site', at: [46.6, 66], z: 1, category: 'Site', name: 'Driveways',
    focus: { at: [20, 60], r: 50 },
    sections: [
      { title: 'Ours: asphalt', details: [`About 20.8' wide, from the garage doors to Orchard Street`, 'Depressed curb at the street'] },
      { title: `Neighbor's (Lot 58 B)`, details: [`Lot 58 B's asphalt drive runs on the left line and overlaps it by 0.3'`] },
    ],
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
    ['First floor', '1,320 sq ft'],
    ['Second floor', '1,255 sq ft (incl. open foyer)'],
    ['Total', '2,575 sq ft'],
    ['Volume', '51,968 cu ft'],
    ['Footprint', '57\'-0" x 36\'-0"'],
    ['Building height', '30\'-11" +/-'],
    ['Bedrooms', '4, plus a first-floor study'],
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
        ['Area', '0.3013 acre'],
        ['Size', `75.00' x 175.00' (13,125 sq ft)`],
        ['Faces', `Orchard Street (60' R.O.W.), S 08°32' W`],
        ['Setbacks', `25' front and rear, 10' / 8' sides`],
        ['House', `Garage 48.00' from the street; 9.53' and 8.28' from the sides`],
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
        ['Areas', 'Sheet 1: 1,320 / 2,575 sq ft with the optional study (as built), 1,415 / 2,670 without'],
        ['Prepared for', 'Anda Builders, Inc.'],
        ['Date', 'Jan. 25, 2001 (5 sheets)'],
      ],
    },
  ],
}

// Per-floor facts for the floor overview panel
export const FLOOR_FACTS = {
  L1: { area: '1,320 sq ft (plans, with the study)', ceiling: `9'-0" (8'-0" in the garage wing)` },
  L2: { area: '1,255 sq ft (plans, incl. the open foyer)', ceiling: `8'-0"` },
  B: { area: 'about 1,130 sq ft, finished in 2017, plus about 200 sq ft under the study wing', ceiling: `Drywall below the joists (8'-0" to the joists)` },
}

export const BLUEPRINTS = [
  { id: 's1', set: 'House 2001', file: 'sheet-1-foundation.jpg', title: 'Foundation plan', sheet: '1 of 5' },
  { id: 'b1', set: 'Basement 2017', file: 'basement-2017.jpg', title: 'Basement finishing plan (permit)', sheet: 'sketch' },
  { id: 's2', set: 'House 2001', file: 'sheet-2-first-floor.jpg', title: 'First floor plan & optional study', sheet: '2 of 5' },
  { id: 's3', set: 'House 2001', file: 'sheet-3-second-floor-roof.jpg', title: 'Second floor & roof plan', sheet: '3 of 5' },
  { id: 's4', set: 'House 2001', file: 'sheet-4-elevations.jpg', title: 'Elevations', sheet: '4 of 5' },
  { id: 's5', set: 'House 2001', file: 'sheet-5-section-plumbing.jpg', title: 'Building section & plumbing riser', sheet: '5 of 5' },
  { id: 'd1', set: 'Deck 2020', file: 'deck-a1-notes.jpg', title: 'Deck notes & calculations', sheet: 'A-1' },
  { id: 'd2', set: 'Deck 2020', file: 'deck-a2-structural.jpg', title: 'Deck framing plan', sheet: 'A-2' },
  { id: 'd3', set: 'Deck 2020', file: 'deck-a3-plan.jpg', title: 'Deck plan & lighting', sheet: 'A-3' },
  { id: 'd4', set: 'Deck 2020', file: 'deck-a4-details.jpg', title: 'Deck details', sheet: 'A-4' },
  { id: 'p2', set: 'Survey', file: 'drainage-plan.jpg', title: 'Newer survey, with the drainage markup', sheet: 'photo' },
  { id: 'p1', set: 'Survey', file: 'property-survey.jpg', title: 'Older survey (woods, flood limit)', sheet: '1 of 1' },
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

// "2025-04" -> { label: 'April 2025', age: '1 year, 6 months' } as of `now`.
export function plantedInfo(planted, now = new Date()) {
  const [y, m] = planted.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const months = Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m))
  const yrs = Math.floor(months / 12)
  const mos = months % 12
  const part = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`
  const age = [yrs && part(yrs, 'year'), (mos || !yrs) && part(mos, 'month')].filter(Boolean).join(', ')
  return { label, age }
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
