# Home Twin

A web app with a 3D digital double of the house, built from the architect's drawings
(Roger C. Winkle, A.I.A., 5 sheets, Jan. 25, 2001), the backyard deck drawings
(Jeffrey A. Fleisher, AIA, project 2001-71, 4 sheets, June 11, 2020) and the property
survey of Lot 56.01, Block 216.

```bash
npm install
npm run dev      # http://localhost:5180 (this computer only)
npm run build    # static site in dist/
```

To try it on a phone on the same Wi-Fi, opt in for that run with `npm run dev -- --host`. The dev
server is for development only; don't leave it exposed on a network.

Online, the app is on GitHub Pages at https://ajam0903.github.io/home-twin/. Every push to
`master` rebuilds and redeploys it (`.github/workflows/pages.yml`), so wait a minute or two after
pushing. The site is public: anyone with the link can open it.

### Shared data and the admin

Room notes, saved measurements and the furniture layout live in one Firestore document
(`homes/orchard` in the Firebase project `home-twin-orchard`), so every device and visitor sees the
same thing, updated live. Anyone can read it; only the admin's Google account can change it.

- Sign in (top right) with the admin account (ajamali0903, Google) to edit. Everyone else sees
  notes as text, can't add, move or resize furniture, and can take measurements but not save them.
- `firestore.rules` enforces this (deploy with `firebase deploy --only firestore:rules`); the
  app only hides the editing controls. To add an editor, add their user id to both
  `firestore.rules` and `ADMIN_UIDS` in `src/firebaseConfig.js` (ids are under Authentication,
  Users, in the Firebase console).
- Each browser keeps a copy, so the app opens with the last data it saw. Signed in as admin on a
  browser that has notes, measurements or furniture the shared copy doesn't have yet, a banner
  offers to share them.
- The shared data is as public as the site. Keep anything private out of notes.

## Layout

- Desktop (1000px and wider): levels and the room list on the left, the 3D model in the middle, details on the right.
- Phones: full-screen model, level chips at the top, a draggable bottom sheet for rooms, systems and details.
- Blueprints tab: the original sheets (house, deck, survey) with pan and zoom (pinch on phones).
- In the whole-house view, the Top button shows the lot as a site plan, with deed north on the compass.
- The room list shows the selected floor only (everything for Whole house). With a floor selected
  and nothing picked, the right panel shows that floor's overview.
- Measure: turn on the Measure tool, then click (or tap) two points on anything you can see:
  walls, floors, cabinets, furniture, the yard. The label gives the length of the line in feet
  and inches to the nearest 1/4", with the total inches under it (1'-5 3/4" over "17 3/4 inches"). Points snap to a nearby corner
  (shown square). Drag either point afterwards to adjust it (it snaps the same way). Shift keeps
  a point square to the other one; Esc drops a half-done measurement; the x on a label removes
  it. Turning the tool off clears unsaved ones. Save on a label keeps it as a thin line in the
  view it was taken in (whole house or a floor), with or without the tool on; click the line to
  open its points and label (and drag a point to change it), click anywhere else to close it.
  Saved measurements are shared (see Shared data) and are listed in that view's
  overview panel, where you can name them, click the length to fly to one, or delete it. The
  cutaway applies: in a floor view you measure what is below the cut.
- Related things share one listing (the deck and its posts, ledger, lights and door; all 20
  arborvitae; the fences and gate; the drainage lines; the lot and its survey lines), with a
  titled section for each part.
- My notes: every room's details have a notes box for your own notes (paint colors, what is
  stored where...). They save as you type (shared, like the furniture); rooms with notes
  get a dot in the list, and the search looks through them.
- The deck counts as outside: with the whole house it is listed under Property and its label
  shows in the 3D view, and picking it there keeps the whole-house view.
- Furniture: toggle it with the Furniture button, add pieces from presets in the room list, click
  a piece in a floor view to select it and then drag it to move it (snaps to the inch; dragging
  across a piece that is not selected just moves the view), and type its width, depth and height or
  rotate it in the right panel. Walls stop a piece (it slides along them); it can pass through
  a doorway or opening if it fits under the head, and a size or rotation typed in that would push
  it into a wall moves it clear. The layout is shared (`src/model/furniture.js`, and Shared data
  above).

## Editing the model in Maya

The house the app shows comes from Maya: `public/model/house.fbx`, exported from the Maya scene
`maya/house.mb`, plus the woods on the neighboring lots in `public/model/woods.fbx` (and
`woods_phone.fbx`, a copy reduced to about a third of the polygons that phones load). Without
those files (or with `?model=plans` in the URL) the app builds everything from the plans in
`src/model/house.js` instead. `maya/house.mb` stays out of git (it is large); keep a backup.

To edit:

1. Open `maya/house.mb` in Maya (2026 here) and model as usual. The textures are in `maya/textures`.
2. Export for the app. In Maya's Script Editor (Python):
   ```python
   import sys; sys.path.append(r'W:/0_PROJECTS/HomeInfo/tools/maya')
   import home_twin; home_twin.export_to_app()
   ```
   or, after saving, from a terminal in this folder:
   ```bash
   npm run maya:export
   ```
3. With `npm run dev` running, the open app reloads with the new model.

Keep these conventions so the app's features keep working:

- 1 unit = 1 foot. Leave Maya's working units at centimeters (the numbers are feet). Y is up,
  x runs left to right and z from the back of the house toward the street.
- Everything sits under `home_twin`, in one of its groups: `B`, `L1`, `L2` (the floors, cut away
  one at a time), `roof` (shown only from outside), `site`, `utilities` (shown with Systems),
  `trees` (the front maples) and `woods` (the trees on the neighboring lots, one object per tree:
  `woods_tree_001`...). `trees` and `woods` are hidden in floor views. New objects go in one of
  those groups; a new background tree goes in `woods`.
- The export writes the woods to their own files, and makes the phone copy each time with Maya's
  polyReduce, so phones follow your edits.
- Room floors are named `room_<id>` (`room_kitchen`, `room_dining`...): clicking them selects the
  room. Keep the name when you reshape one.
- Materials keep their names. The app reads roughness, transparency and bump maps for them from
  `public/model/materials.json`; a new material gets plain defaults and its Maya color and texture.
  The lawn (`mat_grass`) and asphalt (`mat_asphalt`) are drawn in one flat color whatever texture
  they have in Maya (`FLAT_COLORS` in `src/three/mayaModel.js`): their textures showed the tiling.
- Every object is named for what it is (`L1_extwall_04`, `L1_extwall_04_window2`,
  `fixture` names like `L1_Refrigerator_01`, `japanese_maple_01`, `thuja_07`...).

What stays in the app: the leaf litter under the woods (it follows the surveyed edge of the
woods), the furniture, lighting, labels and pins, and the room and item information. Room labels, the room
list and the furniture's wall checks still use the plan data in `src/model/house.js`, so after
moving walls or rooms in Maya, update the matching numbers there too.

When the plans change (as with the 2017 basement), only the changed parts are swapped into
`maya/house.mb`, so your Maya edits elsewhere stay:

1. Open the app with `?export=maya&model=plans` to write the new export. (`maya/export_prev`
   keeps the export the scene was last built or updated from; the update job refreshes it.)
2. Run `node tools/maya/run.mjs update <groups or parts>`, for example `update B` or
   `update B site/excavation`. It first rebuilds those parts from `maya/export_prev` and compares
   them with your scene; if you have edited one, it stops and lists it (add `--force` to replace
   it anyway). Otherwise it backs the scene up to `maya/backups`, swaps the parts, saves and
   exports for the app.

To start over from the plans (this replaces `maya/house.mb` and every edit in it): open the app
with `?export=maya` (it writes `maya/export`), then run `npm run maya:build`.

## Where things live

- `src/model/house.js`: the house as data. Rooms, walls with their windows and doors, built-ins,
  points of interest ("items": furnace, sump pit, attic hatches...), the deck, the lot, and the house facts from the title blocks.
  Units are feet; x runs left to right and y runs rear to front, as printed on the plans.
- `src/three/buildHouse.js`: turns the data into three.js geometry (walls with openings, floors, stairs, roofs, porch, deck, site).
- `src/three/textures.js`: the exterior textures (architectural shingles, double 4" lap siding,
  concrete), drawn on canvases and mapped in world feet so courses line up. The lawn and asphalt
  are flat colors (`LAWN_COLOR`, `ASPHALT_COLOR` in `buildHouse.js`).
- `src/three/vegetation.js`: trees and shrubs built from noise-shaped foliage clumps (the woods
  with an understory and leaf litter, the maples, serviceberry, cherry, thujas and bed shrubs).
- `src/three/Viewer.js`: camera, controls, lighting (sun with soft shadows over the lot; the
  woods on the neighboring lots receive shadows but cast none, since their shadows would end in
  a straight edge where the sun's shadow area stops; sky light, a cool
  fill, and ambient occlusion on desktop; phones skip the occlusion pass and get coarser trees
  and shrubs, about a third of the triangles), level cutaways,
  picking, labels and the compass.
- `src/three/mayaModel.js`: loads the Maya FBX and turns its materials into the app's;
  `src/three/mayaExport.js` writes the plans-built house for Maya (dev only).
- `tools/maya/home_twin.py`: builds `maya/house.mb` and the FBX from that export, and exports
  the Maya scene for the app; `tools/maya/run.mjs` runs it with Maya's Python (`npm run maya:*`).
- `src/components/`: the React UI.
- `blueprints/`: the RAW photos of the house sheets (ignored by git), the deck PDF and the survey PDF. `public/blueprints/` holds JPEG copies of every sheet.

## Accuracy

Overall dimensions, room sizes, window and door positions, ceiling heights and roof pitches come from the
dimension strings on the sheets. Some details were read off the drawing by scale and are approximate:
kitchen counter and island layout, the refrigerator spot, bathroom fixture positions, the exact
position of interior doors, and the garage roof framing where the front gable meets the side gable.
To correct anything, edit the numbers in `src/model/house.js`.

Around the foyer, sheets 1 to 3 together give the stair as an L: up from the front door toward the
rear, 10 treads to a 3'-0" landing against the kitchen wall, then 3 treads turning toward the
dining-room side onto the upper hall. The basement stair runs under it with the same L, behind
a 2'-8" door at the back of the foyer. Also at the back of the foyer: the 3'-0" opening to the
kitchen and a 2'-0" pole-and-shelf coat closet tucked into the dining room's corner. The 6'-6"
cased opening to the dining room sits toward the front, after 5'-3" of wall. The railing colors
(stained handrail, white balusters) are a guess until there is a photo.

Where the drawings and the house differ, the model follows the owner's corrections (2026-10-17):

- The chimney is on the left side wall by the family room fireplace, as the 2001 plans show.
  The survey marks it on the garage's right wall; that label is wrong. From an aerial photo, it
  is a chase clad in the same beige siding, with white corner boards, a white chase cover and a
  stainless flue cap, and the roof is weathered brown-gray architectural shingles.
- The garage wing is built to the optional study plan on sheet 2: a study behind the garage,
  a back hall along the garage wall with a fire-rated door down to the garage, and no rear door.
  Where that plan shows a full bath and closets, the house has (left to right) a powder room,
  a 2' reach-in pantry off the hall and a laundry room that wraps behind the pantry, with the
  washer and dryer in that alcove (from a photo). The study is 109" wide inside (the plan says
  9'-10"). The powder room and pantry widths are estimates.
- Floors: carpet in the study, family room, living room and the whole second floor; hardwood
  everywhere else on the first floor; tile in the bathrooms and the laundry room (the laundry
  photo shows tile).
- The master walk-in closet over the garage is now a sleeping nook with a twin bed. A door in
  its right wall opens to a carpeted, L-shaped closet extension built into the attic space under
  the garage roof (behind the nook and beside it, from the owner's markup; knee-wall heights
  are estimates).
- Drainage, from the owner's markup on a later survey: 4" solid pipe from four downspouts (house
  front-left and rear-left corners, garage rear-right and front-right corners) along both side
  yards and across the back, into a French drain (4" perforated pipe in fabric-wrapped 3/4" clean
  stone) along the back right and up the right side line. The buried runs are drawn as ground
  markings and show with the Systems toggle; positions are scaled off a photo of the markup.
- Kitchen, from photos: honey oak base and upper cabinets with black granite and a dark
  backsplash; sink and dishwasher on the window wall; range and hood on the garage-side wall;
  a freestanding island (the plans showed a peninsula); refrigerator and a microwave counter
  in the alcove the plans show beside the back-hall opening (built out into the dining room
  under a (2) 2x14 header, which is why the dining room is 14'-1" deep). The same recess runs
  on past the counter to the coat closet, and the 3'-0" framed opening to the dining room is
  in its back wall, right beside the microwave counter; a post at the end of the half wall. The dinette table and chairs,
  the island stools and the black storage cabinet are furniture, so they can be moved.
- The basement was finished in 2017 (permit sketch in the Blueprints tab, released 3-29-17): TV
  room and gym across the front on either side of the stair, a half wall along the girder line to
  the open area behind, a finished room (the sketch calls it an office), a utility room with the
  furnace, water heater and electric panel, two closets and a small water-service closet in the
  right front corner. Under the study wing, through two doors in the foundation wall: a bath
  (shower, toilet, sink, exhaust fan) and unfinished storage. Walls are metal studs with drywall
  and R-13. The sketch is not to scale: positions follow it, anchored on the stair, the girder
  line and the mechanicals the 2001 foundation plan locates, and the extent of the basement under
  the study wing (to x 50.5) is an estimate. The finished rooms are shown carpeted, a guess.
- The deck stair ends on the lawn (the deck plans show a concrete pad).
- Front, from a photo: black shutters on every front window except the center one under the
  gable, a black front door with sidelights, white porch columns and rails with black balusters,
  a dark lattice skirt under a white fascia, white-riser steps with brown treads, a white porch
  ceiling, planting beds on each side of the steps, and two mature Japanese maples in the front
  yard (species identified from the photo).
- There is no skylight over the master bath, although the 2001 plans show one.
- The backyard inside the lot lines is open. The trees in the model are on the neighboring lots only.
- Fences, from the owner's markup on the survey: a 6' white vinyl fence from the left wall of the
  house to the left line and back along it, a 4' chain-link fence along the rest of the left line
  and across the back lot line, and a 6' white vinyl fence up the right line. Between the garage
  and the right line: a fixed vinyl panel and a single gate hinged on its left (garage) side.
  The survey's wood stockade fence is gone.
- Plantings, all put in April 2025 (the app shows each one's time in the ground): 12 Thuja Green
  Giant arborvitae evenly spaced 3' in front of the back fence, two more rows of 4 running back
  from the house (out past the garage side and just outside the chimney side), an Autumn
  Brilliance serviceberry and a double pink weeping cherry about 29' behind the house. Positions
  come from the owner's markup on a top view; heights and spreads are estimates.
- From a photo of the deck: dark brown decking and treads, reddish-brown fascia and skirt frame
  boards, brown-gray lattice in framed panels, brown caps on the white rails, and the lattice door
  on the stair side (the deck plan shows a gate on the far side). The kitchen bay has a hipped
  roof with white fascia and soffit.
- The overhead electric service lands on the garage's right side wall and runs down to the meter,
  about 7'-6" back from the front corner (placed from a photo).
- The garage's front gable has no side eaves: as the photo shows, the right wall's siding runs
  straight up into the big side gable.

The deck sheets are vector CAD drawings at true 1/4" scale, so the deck itself is exact. Its
placement is not: the deck plan's outline of the house puts the kitchen bay about 4' closer to the
garage corner than the 2001 plans do (and draws the garage wing set back 4'-0" instead of 3'-0").
The model keeps the 2001 bay position and places the deck by the bay it wraps around, so the deck
stair lands about 4' short of the house corner, which the owner confirmed matches the real deck.

There are two surveys. The lot is placed from the newer one (a photo, which also carries the
drainage markup): the house's left wall is 9.53' from the left line, the garage doors are 48.00'
from the street line, and Orchard Street has a 60' right of way. Its right offset (8.28') would
make the house 57.19' wide against 57'-0" on the plans, so the model keeps the left offset exact
and the garage ends up about 8.47' from the right line. The older survey is a to-scale scan; the
edge of woods and the 100-year flood limit come from it, kept in place relative to the lot lines.
Setbacks, driveways, the walk and the utility pole agree between the two. The street width and the shape of the ground are assumptions: the backyard slopes
away from the house so the deck stands about 5'-4" above grade at its outer edge, as deck sheet
A-1 states, then eases down toward the back of the lot.
