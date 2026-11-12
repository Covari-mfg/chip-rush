# Pocket Shift (`pocket-shift`) experiment record

Pocket Shift is a portrait, one-thumb way to play on a phone. It is a separate
mode, not a level and not a model submission: it has no entry in `SHIFTS`, no
legacy index, no server runs, no leaderboard and no challenge links. It started
as the hidden route `#/pocket`; since step 5 it is also the default home on
phones, with an opt-out. Step 1 was a feel
prototype on First Shift's rules. Step 2, recorded here, turns it into the
format the owner chose: **endless, three strikes**, ruleset `pocket-v1`, with a
local best only. This is a local development record; creator playtest on a real
phone, approval and release are open.

## Identity

| Field | Value |
| --- | --- |
| Mode | `pocket-shift` / Pocket Shift (Beta), ruleset `pocket-v1`, map `pocket-shop`, route `#/pocket`, game role −2 (never a `SHIFTS` index, never sent to a server) |
| Local save | `chip-rush-pocket-v1` only: `{v, bestPoints, bestShipped, longestSeconds, runs}` |
| Base commits | Prototype `c46de76` on `b755154` (main); seven playable entries in `SHIFTS` plus Open for Business |
| Model | To be supplied by the creator |
| Harness | To be supplied by the creator |
| Dates | Prototype 2026-11-10; endless rules 2026-11-11; declutter pass 2026-11-11 |
| Delegation | None reported for these runs |

## Conditions

| Condition | Offered / confirmed | Used |
| --- | --- | --- |
| Starting game | Full source, tests, docs; local server `scripts/dev-server.mjs` | Yes |
| Development | Linux container, Git 2.43, Node 22, Python 3; no `node_modules` at the start | Node for tests, simulation, builds and the server; Python for scripted edits |
| Playtesting | Preinstalled Playwright with headless Chromium and SwiftShader WebGL; no real phone, no manual play | Emulated iPhone 14 (user agent, touch) at 390×844 and 360×740 portrait, 844×390 landscape, desktop 1280×800. Software rendering runs the game clock well below wall time, so scripts wait on game state |
| 3D assets | Procedural Three.js in `dist/assets/models.js`; Blender not installed | The prototype's room shell, resized by its bounds; every station reuses its existing model |
| Music and sound | Existing loop and cues | No new audio |
| Research | Not needed | Not used |

## Intent

A phone held upright gets "Turn your phone to play" everywhere else. Pocket
Shift asks whether the shop can be played in portrait with one thumb, in short
runs that are fair to compare. The owner chose the format after the prototype:
no shift timer, orders that keep coming faster, and three misses to end a run.

## Rules as built (`pocket-v1`)

- **Endless, three strikes.** No timer. Each order that expires is a strike;
  the third strike ends the run at once (`finishReason: 'strikes'`), even when
  two orders expire in the same tick. Nothing else ends it.
- **Orders.** A deterministic stream (`pocketRecipeIndex(n)`, mulberry32 with
  the fixed seed `0x5eed2026`), counted by order number so every run sees the
  same sequence. Stages, using the existing recipes and values in `core.js`:
  1. orders 1–4: Pocket spacer (`lathe → inspect`) and Mounting plate
     (`mill → inspect`);
  2. from order 5: Bearing housing (`lathe → mill → inspect`, block stock)
     joins, and order 5 is always the housing;
  3. from order 11: Dial knob (`lathe → deburr → inspect`) and Valve body
     (`lathe → mill → deburr → inspect`) join; orders 11 and 12 are always the
     knob and the valve body.

  Otherwise each order is drawn evenly from its stage's parts, never the same
  part three times running. The first twelve are: spacer, plate, plate, spacer,
  housing, spacer, plate, plate, housing, housing, knob, valve body. No CAD, no
  customer calls. The shared four-active-order limit holds: a full board holds
  the next arrival back (retried every 2 s) without skipping it in the stream.
- **Pace** (`POCKET_PACE`), by run time *t* when an order arrives:
  - first order at 0 s, with First Shift's opening bonus (82 + 14 = 96 s);
  - arrivals every `18 → 9` s, easing linearly over the first 360 s;
  - deadlines `82 → 48` s for a two-step part, easing linearly over the first
    90 s, plus 10 s for each route step beyond two (Bearing housing and Dial
    knob +10, Valve body +20).
- **Scoring.** Points are `ShopGame.score`: every shipment uses the shared
  `scoreShipment` (part value, early-shipping speed, streak up to ×1.6), and a
  miss resets the streak, as in every shift. The HUD and result also show parts
  shipped and time survived.
- **Covari, a real capability gap.** The floor has no anodizing, heat
  treatment, powder coating or laser, so those jobs are outsourced. The pool is
  `FINISHING_SOURCE_JOBS` (Heat-treated pin, Powder-coated panel, Laser-marked
  plate), offered in rotation. The shared offer flow is reused unchanged:
  optional, 30 s to decide, delivery to Receiving after 22 s, then
  `inspect → ship` for 300 points, no order slot, no streak or shipment credit.
  **Deliberate differences for an endless mode:** the first offer comes after
  two normal shipments (without the shifts' 35 s and time-left checks, which
  have no meaning without a clock), and offers then recur, each one 60 s after
  the previous one resolves (declined, lapsed or shipped). A Covari job is never
  a strike, whether declined, ignored or left unfinished; it has no deadline.
  Recurrence keeps the outsourcing decision in every run instead of once; the
  no-strike rule keeps it optional, as in the shifts.
- **Controls.** Unchanged from the prototype: tap up to three stations in
  order (numbered badges); the machinist walks the plan and uses each stop;
  tapping a queued station drops it and the stops after it; a rejected stop
  drops the rest; a floor tap clears the plan. No Dash.

## Floor

`pocket-shop` (declutter pass) is walkable 8.4 × 11.1 units, drawn flush to the
screen edges: the slab ends 0.12 units outside the walkable bounds, there are
no side walls, and the back wall is a low (1.15 unit) wall broken by the
delivery door. It reads from the bottom of the screen to the top as the part's
journey:

| Row (camera → back) | Stations (drawn scale) | Used from |
| --- | --- | --- |
| 1 | Round, Plate, Block stock (1.0) | the aisle behind them |
| 2 | Lathe, Mill (0.78; 1.14 elsewhere) | the same aisle, in front of them |
| 3 | Deburr (0.8, from shortly before order 11), Hold bench (0.8) | the aisle in front |
| 4 | Covari crate spot (pallet, only while a delivery is due), Inspect (0.8), Shipping (0.8) | the aisle in front |

Every station faces the camera and is drawn at or below its usual size, with
aisles deep enough that a machine's top does not reach the station behind it
on screen. The bins are used from the aisle behind them, which they share with
the machines.

- **Deburr arrives.** It is first needed by order 11. Until then its spot is
  open floor (no model, no badge, no obstacle). It arrives when order 11 is
  8 s or less from arriving (`pocketDeburrInstalled`): a toast ("New machine ·
  Deburr is on the floor"), sparks, the bench grows in over 0.6 s and its badge
  pops in; with `prefers-reduced-motion` only the toast and the badge, without
  animation. Anyone standing in its footprint is stepped out of it.
- **The crate spot.** Receiving is no longer a bench. While a Covari delivery
  is on its way or waiting, a pallet with a painted landing square shows by the
  back door (`pocketCrateShown`); its badge counts the delivery down, then reads
  READY; it disappears once the crate is collected. The shared Receiving bench
  model is unchanged on every other map (the pallet is attached only here).
- Both are presentation only: `game.stations.deburr` and the Covari rules are
  untouched. Stations that come and go are kept in `absentStations`
  (`dist/main.js`), which the obstacle list, the models, the badges and the
  simulation all read.

**Walking.** Simulation, not play: First Shift's own rules and orders played by
the shared balance decisions (0.5 s reactions, production routes and speed) on
each room. Walking seconds over a 150 s shift:

| Room | Serial | Flow |
| --- | --- | --- |
| `first-shop` (First Shift) | 36.4 s | 49.8 s |
| prototype `pocket-shop` (`c46de76`) | 53.6 s | 76.8 s |
| `pocket-shop` as built | 35.8 s | 51.9 s |

The table above was measured on the previous layout. On the declutter layout
the same comparison gives 33.6 s serial and 48.7 s flow (24.2% and 35.8% of the
shift), slightly less walking than before. The step-2 layout alone brought walking back to First Shift's level (flow share of
shift time: 37.2% in First Shift's room, 51.2% in the prototype room, 37.9%
now), so this mode adds no walk-speed multiplier: the machinist walks at the
production 4.4 units/s. `qa/pocket-balance.mjs --rooms` prints this table; the
driver's `walk` option can explore a faster machinist if real play asks for
one.

## HUD and screens

The screen budget (declutter pass), as built: a status row and one ticket row
take the top 113 px; a 60 px strip (plus the safe-area inset) at the bottom
holds the hint line or the Covari card; the floor spans the column between
them and is width-limited at 360 × 640, 390 × 664, 412 × 780 and 390 × 844. The
strip is there whether or not a card is, so the floor never refits.

- **Status line**: three strike markers that fill red with a cross as orders
  are missed, parts shipped and points; no countdown. Pause button 44 × 44.
  Hiding the page pauses the run (shared).
- **Orders**: up to four tickets in one row, each a quarter of the width (84 px
  at 360). A ticket shows the part's stock icon in the part's colour, its short
  name only when it fits whole (Spacer, Plate, Housing, Knob, Valve), seconds
  left, the next station as a chip filled in that station's colour with its icon
  and word (striped while its machine runs), the stations after it as small
  icons, and a deadline bar that turns red in the last quarter (or 12 s). The
  ticket's accessible name gives the full part name and route. An empty slot
  shows when the next order arrives.
- **Station badges** replace the name pills: a small nameplate (icon over a
  short word, 40–52 × 37 px) at the front-left foot of each station, under the
  front edge for the bins. The word is the station's own (ROUND, PLATE, BLOCK,
  LATHE, MILL, DEBURR, HOLD, INSPECT, SHIP, CRATE) and the ticket chips use the
  same icon, colour and word (`POCKET_BADGES` in `dist/pocket-floor.js`). A
  running station shows its countdown and a progress line, a finished one READY
  on green, the next step for the held part (or the most urgent order) a gold
  ring, and planned stops a number (the first in mint). Accessible names give
  the full station name and state.
- **Taps**: a canvas tap counts for the station whose drawn footprint or badge
  is nearest, within 46 px (`pocketTapTarget`, ties to the nearer centre);
  further away it is a bare-floor tap and clears the plan. Badges also have an
  8 px larger hit area than their drawing.
- **Covari**: a card that fills the bottom strip (52 px): the job's technology
  badge, its name, why it is outsourced, the countdown, Earn 300 and No (both
  44 px tall). Once accepted it shows the delivery countdown, then the crate's
  remaining stations in the ticket chip language.
- **Toasts** sit under the ticket row, over the back wall, clear of the badges.
- **Desktop browsers**: the route always uses the touch interface, so a
  desktop user agent in a phone-sized window gets the same HUD, tickets and
  badges, no brand, no Interact or Dash buttons and no keyboard guide; mouse
  clicks are taps. In a window wider than 460 px the game is a centred 460 px
  column with shaded sides. Leaving the route restores the desktop interface.
- **Misses**: the marker pops, the screen edge flashes red, a toast says
  "Order missed · 2 of 3", and `navigator.vibrate(70)` where the API exists.
  The third miss holds a stronger red wash for 1.5 s ("Third miss. Run over.",
  vibrate `[90, 60, 220]`) before the result card. With
  `prefers-reduced-motion` there is no vibration and nothing animates: the
  markers fill and the red edge shows still for 0.8 s (held after the third
  miss).
- **Stage changes** show a toast when the housing and the deburr parts arrive.
- **Start card**: title, Beta tag, three short lines on how to play, the local
  best, Play. **Result card**: parts shipped, points, time survived, "New best"
  when the points beat the stored best, the stored best, a large Play again and
  Back to home. On phones the shared overlay is solid, so the cards keep the
  plain background.
- **Local best only**: `recordPocketRun` writes `chip-rush-pocket-v1` once per
  finished run; `readPocketBest` accepts missing, malformed or blocked storage.
  This mode never writes the shared save `chip-rush-roles-v8`, the speed
  records or the Open for Business run save (the game still reads them when
  the page loads, as on any route).

## Tuning and simulation

`qa/pocket-balance.mjs` plays the real `PocketGame` rules on the production
`pocket-shop` floor with production A* collision routes and walking speed. Its
decisions follow the shared balance driver, plus swapping a held part for a
finished one at its next station and using the Hold bench (the shared driver
could stall holding a Covari crate at a busy Inspect). `--assert` checks the
targets; `qa/pocket.test.mjs` runs the same check under `node --test`.

| Player (simulated) | Play | Reaction | Covari | Survived | Shipped | Points | Covari jobs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slow | one job at a time | 1 s | declines | 165 s | 5 | 1,978 | 0 |
| ordinary | overlaps machines | 0.5 s | accepts | 273 s | 13 | 5,374 | 2 |
| expert | overlaps machines, Hold bench, swaps | 0.1 s | accepts | 356 s | 19 | 8,120 | 3 |

On the declutter layout (step 4; the simulation now also keeps Deburr and the
crate spot off the floor while they are absent in play), with the pace
unchanged:

| Player (simulated) | Survived | Shipped | Points | Covari jobs | Walking share |
| --- | --- | --- | --- | --- | --- |
| slow | 165 s (was 165) | 5 (5) | 2,008 (1,978) | 0 (0) | 21.1% (21.6%) |
| ordinary | 292 s (was 273) | 14 (13) | 5,985 (5,374) | 3 (2) | 53.4% (56.5%) |
| expert | 356 s (was 356) | 19 (19) | 8,452 (8,120) | 4 (3) | 60.8% (64.6%) |

All targets still hold; the shallower walking helps the middle player most.

Targets (simulation targets, **not** claims about people): every run ends on
three strikes and none passes 12 minutes; slow 90–180 s; expert 240–480 s;
better play lasts longer. The pace was chosen by sweeping arrival and deadline
floors and ramps; slow play barely depended on the floors and mostly on how
soon deadlines tighten and the longer parts appear, which is why the deadline
ramp (90 s) is much shorter than the arrival ramp (360 s) and the stages begin
at orders 5 and 11. With the chosen values the slow player lasts 165 s for
reactions of 0.7–1.5 s, the ordinary player 219–292 s for 0.3–0.7 s and the
expert 356–357 s for 0.05–0.2 s. In
endless play the busy players walk for 56–65% of the run, against 22% for the
serial player, because they keep walking while machines run; the room
comparison above is the like-for-like measure.

## Iteration log

1. **Prototype** (`c46de76`, 2026-11-10): First Shift's rules on a tall
   two-column room with the three-stop plan; no scores. Simulated walking was
   about 50% higher than in First Shift's room.
2. **Owner decision**: the real format is endless with three strikes, a fixed
   order stream, a local best and a Beta tag, still behind `#/pocket`.
3. **This step** (2026-11-11): `pocket-v1` rules and their simulation; a
   four-row room with shared aisles (walking back to First Shift's level
   without a speed change); a portrait HUD with strike markers and a 2 × 2 order
   grid; a reserved band for Covari; start and result cards with the local best.
   Emulated checks found the first Covari card taller than its band (buttons cut
   at the screen edge), the shipping float text running off the right edge,
   tickets not filling their grid rows (empty slots collapsed to a line), and
   result numbers nearly touching at 360 px; the card was compacted, pocket
   float text is kept on screen, the grid stretches its cells and the result
   numbers scale with the width.
4. **Owner playtest and declutter pass** (2026-11-11).
   - *Observed by the owner* on a real iPhone (Safari with both bars, visible
     page about 390 × 664), a real Android phone (Chrome, about 412 × 810) and a
     desktop browser's device emulator: it is fun and the mechanics and pace
     feel right, but everything feels far too crammed. On the iPhone the floor
     was height-limited (about 277 px wide, blank space below it) between the
     2 × 2 order grid and the 120 px Covari band, and station name pills touched
     each other and sat on the machines. On Android stations and benches nearly
     touched each other and the walls, pills covered Deburr and the benches, and
     the Bearing housing ticket's route wrapped with SHIP cut off. In the
     emulator (desktop user agent) the desktop interface leaked in: the brand
     overlapped the strike markers, Interact and Dash covered the lower floor,
     and tickets were tall cards with a third column clipped.
   - *Cause on the brief's side*: the previous brief asked for every station
     to be at least about 110 px wide, so bins, Hold bench, Inspect and
     Shipping were drawn 1.05–1.55× larger. That target was withdrawn: tap area
     and drawn size are now separate.
   - *Changed* (rules, pace, scoring, Covari flow, the plan queue, the save
     key and the route untouched): one ticket row of four icon-first tickets
     and a 60 px bottom strip instead of the 2 × 2 grid and 120 px band, so the
     floor is width-limited at every target size; a full-bleed room with no
     side walls, a low back wall with a delivery door, stations at or below
     their normal size and aisles deep enough to keep machine tops off the
     station behind; small station badges (icon and word) at each station's
     front-left foot instead of name pills, with the same icon, colour and word
     on the ticket chips (LATHE and INSPECT on both, no more TURN / QC); a tap
     resolves to the nearest station within 46 px; Deburr arrives shortly
     before order 11 instead of standing idle from the start; Receiving
     becomes a crate pallet by the back door, shown only while a delivery is
     due; toasts moved under the ticket row; the route always uses the touch
     interface, in a centred 460 px column on a wide desktop window.
   - *Found and fixed in emulated checks during this step*: the Covari card's
     grid rule overrode its `hidden` attribute (an empty card covered the
     hint); a part name could be measured as fitting before its seconds were
     filled in, then clip ("Spacer" at 360 px), so the countdown is rendered
     first and the name font is 9.5 px; the deburr-arrival toast covered the
     stock bins' badges at the bottom, so pocket toasts sit under the tickets;
     the hidden Receiving pallet widened Receiving's bounding box on other maps
     (pixels unchanged, QA footprint changed), so the pallet and the bench are
     now attached only on their own maps.
5. **Phone default and lathe spacing** (2026-11-12).
   - *Decided by the owner* after launch: Pocket Shift becomes the default on
     mobile, with an opt-out. *Observed by the owner*: the Lathe may be too
     close to the Round stock bin.
   - *Changed*: on a phone (`isPhoneDevice`; tablets keep the full game) the
     plain home URL opens Pocket Shift (`opensPocket` in `dist/device.js`).
     The card's link reads "Play the full game instead" on a phone and sets
     `chip-rush-pocket-opt-out`; the portrait rotate prompt gains "Or play
     Pocket Shift upright", which clears it. `#/pocket` always opens the mode;
     challenge links and `#/open-for-business` never do. The pocket route is
     marked before the shop loads, so a portrait phone no longer flashes the
     rotate prompt while loading.
   - *Changed on the floor*: Lathe and Mill move from z 2.42 to 1.8 (Lathe
     also x −2.3 → −2.15, mirroring the Mill), and Deburr and the Hold bench
     from z −1.05 to −1.4 to keep the machine tops off Deburr's badge. The
     Lathe's standing spot is now about 1 m from the Round bin's (was 0.34 m)
     and its badge no longer sits on the bin. `qa/pocket-balance.mjs --assert`
     still holds (slow 165 s, ordinary 273 s, expert 343 s; was 165 / 292 /
     356 s): simulation only.

## What was built

| File | Change |
| --- | --- |
| `dist/pocket.js` | `POCKET_RULESET`, `POCKET_PACE`, `POCKET_STAGES`, the seeded stream, `PocketGame` (endless tick, strikes, recurring Covari, snapshot), `readPocketBest` / `recordPocketRun` |
| `dist/main.js` | `pocket-shop` rebuilt (Block, Deburr, Receiving added; Deburr's map list gains `pocket-shop`); pocket HUD, 2 × 2 tickets, strike feedback, finale, start/result cards and local best; pocket play frame between the orders and the band; pocket float text kept on screen |
| `dist/index.html` | Pocket HUD, band and flash layers; new start/result card |
| `dist/mobile.css` | Pocket-only HUD, ticket grid, band, Covari card, flash and card styles, all scoped to `html[data-mode="pocket"]` or pocket-only elements |
| `qa/pocket-balance.mjs` (new) | Deterministic pocket simulation, room comparison, `--assert` |
| `qa/pocket.test.mjs` | Rewritten for `pocket-v1` (see below) |
| `dist/CHIP-RUSH.html` | Standalone build regenerated |

Declutter pass (step 4):

| File | Change |
| --- | --- |
| `dist/pocket-floor.js` (new) | `POCKET_BADGES` (word, name, colour per station) and their icons (new pictograms for Deburr, Inspect, Shipping, Hold bench and the crate), short part names, remaining-route stations, `pocketTapTarget` (nearest footprint or badge within `POCKET_TAP_RADIUS` 46 px), `pocketDeburrInstalled`, `pocketCrateShown`, `pocketAbsentStations`; pure, covered by `qa/pocket.test.mjs` |
| `dist/main.js` | `pocket-shop` relaid (8.4 × 11.1, stations at 0.78–1.0 scale, crate spot by the back door); `absentStations` read by obstacles, models and badges, with the Deburr arrival moment and a step-out for anyone in a new footprint; the Receiving model has separate bench and pallet parts, one attached per map; badges, four-across tickets, nearest-station taps, the Covari card's chips, toasts and float text inside the column; the floor fit uses the column and the always-present strip; `syncInterface` switches a desktop browser to the touch interface on the pocket route only; QA `__chipRush.floorBox()` |
| `dist/assets/models.js` | `createPocketShop` rebuilt: flush slab, no side walls, low back wall with a delivery door. Shared station models unchanged |
| `dist/mobile.css` | Pocket section rewritten: column and strip variables, status row, ticket row and chips, station badges and their states, bottom strip with column shading, Covari card grid, toasts. Still scoped to `html[data-mode="pocket"]` or pocket-only classes |
| `qa/balance.mjs` | Exposes `absentStations` from the extracted layout section and `navigation.setAbsent()`; empty by default, so every existing level's simulation is unchanged (identical output before and after) |
| `qa/pocket-balance.mjs` | Routes on the pocket floor respect Deburr and the crate spot being absent, as in play |
| `qa/pocket.test.mjs` | Tests for the tap rule, the shared badge language, Deburr's arrival and the crate spot, routes without the late fixtures, no enlarged stations |
| `qa/technology-mapping.test.mjs` | Its sandbox gains `pocketing` and `removeAttribute`, which the shared Covari card now uses |
| `scripts/build-offline.mjs` | Bundles `pocket-floor.js` |

## Evidence

### Automated checks

- `node --test qa/*.test.mjs`: 422 tests pass (415 before this step). The
  rewritten `qa/pocket.test.mjs` (16 tests) covers the plan queue; identity
  (not in `SHIFTS`, role −2, ruleset `pocket-v1`, no clock); the fixed order
  stream (two games agree, a golden prefix, never three in a row); stage
  progression; the pace curves and their floors; three strikes ending the run
  and nothing else; the four-order limit; scoring through `scoreShipment` with
  the streak; Covari after two shipments, recurring after the gap, rotating
  jobs, never a strike whether ignored, declined or held unfinished, 300 points
  without shipment or streak credit; the rebuilt floor (stations, facing,
  access spots, collision-free routes between every pair, other maps
  unchanged); the simulation targets; the local best (defensive reads, only its
  key written, blocked storage tolerated); a production-code run that writes
  only `chip-rush-pocket-v1` and calls no save, record, social, fetch or
  analytics; and the hidden route.
- `node qa/balance.mjs --rush --ignore-calls --expert --assert` passes (its
  extracted movement and routing sections still load); `node
  qa/pocket-balance.mjs --assert` passes.
- CI steps from `.github/workflows/check.yml`: `pnpm install --frozen-lockfile`,
  `pnpm test`, `pnpm build`, `pnpm deploy:dry-run` and `git diff --check` all
  succeed locally. `dist/CHIP-RUSH.html` is regenerated and opens `#/pocket`
  from a file URL with the `pocket-v1` rules.

### Emulated-browser observation

Playwright, iPhone 14 user agent with touch, deviceScaleFactor 1, scripts and
screenshots outside the repository. A scripted player read the game state and
tapped station labels (usually two stops per plan).

- **390 × 844**, fresh storage: no rotate prompt; four orders shipped with 33
  taps; the first Covari offer (Heat-treated pin) appeared after two shipments
  with Accept 250 × 46 px and Say no 96 × 46 px in a card whose top (728 px)
  is below the lowest station (666 px); accepted, it was collected at
  Receiving, inspected and shipped (+300). With play stopped, four orders were
  on screen at once in the 2 × 2 grid, each 185 × 58 px, no name truncated, no
  route overflowing, no horizontal scroll. Orders then expired: markers filled,
  the edge flashed, the toast read "Order missed · 2 of 3", vibrate was called
  with 70, 70 and `[90, 60, 220]`; the third miss ended the run at 2:29 with
  `finishReason: 'strikes'`. The result card showed 4 shipped, 1,899 points,
  2:29 and "New best"; Play again started a fresh run (0 strikes, 0 points, one
  order); after a reload the start card showed the stored best. The only
  localStorage key afterwards was `chip-rush-pocket-v1`; of 47 requests none
  went off the local origin or to `/api/`; no page errors.
- **360 × 740**, shorter pass: the same flow (Covari carried through, four
  shipped, third strike at 2:29, result card, Play again, best kept after
  reload, only the pocket key, no off-origin or `/api/` requests). Accept and
  Say no are 220 × 46 and 96 × 46 px; the card's top (624 px) is below the
  lowest station (590 px).
- **Station widths on screen** (projected model boxes, CSS px), 390 × 844:
  Round, Plate, Block 100; Lathe 121; Mill 138; Deburr 112; Hold bench 104;
  Receiving 108; Inspect 105; Shipping 103. 360 × 740: bins 89; Lathe 108;
  Mill 123; Deburr 99; Hold bench 92; Receiving 96; Inspect 93; Shipping 91.
  The floor fits between the order grid and the Covari band with no page
  scroll at both sizes; the pause button is 44 × 44.
- A result card filled with long values (123,456 points, 12:34) fits at 360
  and 390 px.
- **Regression**, against `c46de76` served side by side with the same local
  board: phone portrait on the plain home URL shows the rotate prompt and is
  pixel-identical; phone landscape 844 × 390 First Shift starts with Dash, the
  same spawn and the same first order, differing only by the running clear
  clock (3,662 of 329,160 pixels); the desktop 1280 × 800 home differs by 34 of
  1,024,000 pixels.
- **Reduced motion** (emulated `prefers-reduced-motion: reduce`, 390 × 844):
  the first miss filled its marker, called no vibration, showed the red edge
  still (opacity 0.85, no animation) and cleared it within 1.5 s.

### Declutter pass (step 4): emulated browser and tests

Playwright with SwiftShader, scripts and screenshots outside the repository.
Phone: iPhone 14 user agent with touch, deviceScaleFactor 1. These are
measurements of an emulated browser, not of the owner's phones.

- `node --test qa/*.test.mjs`: 425 pass (422 before). `node qa/balance.mjs
  --rush --ignore-calls --expert --assert` passes with output byte-identical to
  the previous commit; `node qa/pocket-balance.mjs --assert` passes; the CI
  steps (`pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, `pnpm
  deploy:dry-run`, `git diff --check`) succeed; the standalone build opens
  `#/pocket` from a file URL with `pocket-v1` and the new badges.
- **Measured** at 390 × 664, 412 × 780, 360 × 640 and 390 × 844, in five states
  each (one order; four orders with Deburr present; Covari offer; crate on its
  way; crate waiting), and with a desktop user agent at 390 × 844 and
  1280 × 800: zero badge-to-badge overlaps, zero badges over another station's
  drawn box and zero clipped or overflowing ticket text in all 30 states; no
  horizontal or vertical page scroll. The walkable floor spans 96–97% of the
  screen width (the slab the rest), width-limited at every size. The smallest
  gap between two stations' projected model boxes is 14 px at 360 × 640 and
  15–16 px at the other sizes (previous layout: boxes overlapping by up to
  35 px). Badges are 40–52 × 37 px; tickets 84 × 62 px at 360 and 92 × 62 at
  390; the floor sits between the ticket row (ends at 113 px) and the strip.
  Before, at 390 × 664 with four orders: three pill-to-pill overlaps, nine
  pills over other stations and two overflowing tickets.
- **Played with real taps** at 390 × 664 on the dev server: one run of 7:01
  (simulated touch, scripted decisions): 24 shipped, 9,167 points, a planned
  two-stop plan, two near-miss taps 18 px above a stock bin's drawn box (the
  one above the Plate bin queued the Plate bin; the one above the Round bin
  queued the Lathe, whose box was nearer there, as the rule says), Deburr
  arriving at spawn index 10 (run time 153 s), before order 11, and then
  deburring the Dial knob and Valve body; three strikes, the result
  card (New best), Play again (0 strikes, one order, Deburr gone again). A
  second real-tap run accepted a Covari offer (the trigger, two shipments, was
  set directly), saw the crate badge count 22 s down and read READY, collected
  the crate from the pallet, inspected and shipped it: +300, `sourced` 1, no
  shipment credit, the pallet gone once collected. The only storage key
  afterwards is `chip-rush-pocket-v1`; no request left the local origin and
  none went to `/api` (the page's own `analytics.js` module file is loaded on
  every route, as before; it sent nothing).
- **Reduced motion**: the Deburr arrival shows the toast and the badge with no
  animation and no grow.
- **Desktop user agent** on `#/pocket`: the touch interface (no brand, no
  Interact or Dash, no keyboard guide), the same tickets and badges; clicks
  play; at 1280 × 800 a centred 460 px column. Going home restores the desktop
  interface.
- **Regression** against the previous commit, served side by side: phone
  portrait on the plain home URL shows the rotate prompt and is
  pixel-identical; the desktop 1280 × 800 home differs by 0–17 of 1,024,000
  pixels; phone landscape 844 × 390 First Shift has the same labels, Dash and
  first order, the screenshots differing only by the running clock and idle
  animation; Night Shift on desktop has identical station boxes and labels
  (a few hundred pixels of animation noise).

### Untested

- The declutter pass on the owner's real phones; real touch latency,
  safe-area insets and real vibration.
- Human play: whether the pace, the strike rule, the three-stop plan or the
  recurring Covari offers are clear, comfortable or fun. The survival times
  above are simulation only; no player data exists.
- Performance on real devices over long runs.
- Pocket Shift in landscape: it runs, but the layout was designed for portrait.
