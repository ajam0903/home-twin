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

Where the drawings and the house differ, the model follows the owner's corrections (2026-10-17):

- The chimney is on the left side wall by the family room fireplace, as the 2001 plans show.
  The survey marks it on the garage's right wall; that label is wrong.
- There is no skylight over the master bath, and no rear door or stairs at the mudroom,
  although the 2001 plans show them.
- The backyard inside the lot lines is open. The trees in the model are on the neighboring lots only.
- Fences, from the owner's markup on the survey: a 6' white vinyl fence from the left wall of the
  house to the left line and back along it, a 4' chain-link fence along the rest of the left line
  and across the back lot line, and a 6' white vinyl fence up the right line. Between the garage
  and the right line: a fixed vinyl panel and a single gate hinged on its left (garage) side.
  The survey's wood stockade fence is gone.
- Plantings, all about 2 years old: 12 Thuja Green Giant arborvitae evenly spaced 3' in front of
  the back fence, two more rows of 4 running back from the house (out past the garage side and
  just outside the chimney side), an Autumn Brilliance serviceberry and a double pink weeping
  cherry about 29' behind the house. Positions come from the owner's markup on a top view;
  heights and spreads are estimates.
- The overhead electric service lands on the garage's right side wall and runs down to the meter,
  about 7'-6" back from the front corner (placed from a photo).
- The garage's front gable has no side eaves: as the photo shows, the right wall's siding runs
  straight up into the big side gable.

The deck sheets are vector CAD drawings at true 1/4" scale, so the deck itself is exact. Its
placement is not: the deck plan's outline of the house puts the kitchen bay about 4' closer to the
garage corner than the 2001 plans do (and draws the garage wing set back 4'-0" instead of 3'-0").
The model keeps the 2001 bay position and places the deck by the bay it wraps around, so the deck
stair lands about 4' short of the house corner, which the owner confirmed matches the real deck.

The property survey is a scan, but it is drawn to scale and its dimensions agree with the house
plans (house 52.7' from the street, 9.5' and 8.4' from the side lines). Lot lines, setbacks,
driveways, the walk, the utility pole, the edge of woods and the 100-year flood limit
come from it. The street width and the shape of the ground are assumptions: the backyard slopes
away from the house so the deck stands about 5'-4" above grade at its outer edge, as deck sheet
A-1 states, then eases down toward the back of the lot.
