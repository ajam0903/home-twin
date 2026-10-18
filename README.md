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

## Layout

- Desktop (1000px and wider): levels and the room list on the left, the 3D model in the middle, details on the right.
- Phones: full-screen model, level chips at the top, a draggable bottom sheet for rooms, systems and details.
- Blueprints tab: the original sheets (house, deck, survey) with pan and zoom (pinch on phones).
- In the whole-house view, the Top button shows the lot as a site plan, with deed north on the compass.
- The room list shows the selected floor only (everything for Whole house). With a floor selected
  and nothing picked, the right panel shows that floor's overview.
- Furniture: toggle it with the Furniture button, add pieces from presets in the room list, drag a
  piece in a floor view to move it (snaps to the inch), and type its width, depth and height or
  rotate it in the right panel. Walls stop a piece (it slides along them); it can pass through
  a doorway or opening if it fits under the head, and a size or rotation typed in that would push
  it into a wall moves it clear. The layout is saved in this browser (`src/model/furniture.js`),
  so it does not follow you to other devices yet.

## Where things live

- `src/model/house.js`: the house as data. Rooms, walls with their windows and doors, built-ins,
  points of interest ("items": furnace, sump pit, attic hatches...), the deck, the lot, and the house facts from the title blocks.
  Units are feet; x runs left to right and y runs rear to front, as printed on the plans.
- `src/three/buildHouse.js`: turns the data into three.js geometry (walls with openings, floors, stairs, roofs, porch, deck, site).
- `src/three/Viewer.js`: camera, controls, level cutaways, picking, labels and the compass.
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
  The survey marks it on the garage's right wall; that label is wrong.
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
- Plantings, all put in April 2024 (the app shows each one's time in the ground): 12 Thuja Green
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
