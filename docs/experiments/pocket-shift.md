# Pocket Shift (`pocket-shift`) experiment record

Pocket Shift is a portrait, one-thumb way to play on a phone. It is a separate
mode, not a level and not a model submission: it has no entry in `SHIFTS`, no
legacy index, no server runs, no leaderboard and no challenge links, and it is
reachable only through the hidden route `#/pocket`. Step 1 was a feel
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
| Dates | Prototype 2026-11-10; endless rules 2026-11-11 |
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

`pocket-shop` is rebuilt for these rules: walkable 8.9 × 11.8 units (the
prototype was 8.9 × 15.15), read from the bottom of the screen to the top as the
part's journey:

| Row (camera → back) | Stations | Used from |
| --- | --- | --- |
| 1 | Round, Plate, Block stock (drawn 1.55×) | the aisle behind them |
| 2 | Lathe, Mill | the same aisle, in front of them |
| 3 | Deburr (1.25×), Hold bench (1.45×) | the aisle in front |
| 4 | Receiving (1.35×), Inspect (1.1×), Shipping (1.05×) | the aisle in front |

Every station faces the camera. The bins are the one change of habit: the
machinist reaches them from the aisle behind, which they share with the
machines, so the room needs one aisle fewer and the trip from stock to a
machine is about half a unit to three units. A centre gap joins the aisles.
Deburr now lists `pocket-shop` among its maps; its Night Shift and Blackout
Shift places are unchanged. Stations that are not needed until later stages
(Block stock, Deburr) are present from the start.

**Walking.** Simulation, not play: First Shift's own rules and orders played by
the shared balance decisions (0.5 s reactions, production routes and speed) on
each room. Walking seconds over a 150 s shift:

| Room | Serial | Flow |
| --- | --- | --- |
| `first-shop` (First Shift) | 36.4 s | 49.8 s |
| prototype `pocket-shop` (`c46de76`) | 53.6 s | 76.8 s |
| `pocket-shop` as built | 35.8 s | 51.9 s |

The layout alone brings walking back to First Shift's level (flow share of
shift time: 37.2% in First Shift's room, 51.2% in the prototype room, 37.9%
now), so this mode adds no walk-speed multiplier: the machinist walks at the
production 4.4 units/s. `qa/pocket-balance.mjs --rooms` prints this table; the
driver's `walk` option can explore a faster machinist if real play asks for
one.

## HUD and screens

- **Status line** (replaces the shared one in this mode): three strike markers
  that fill red with a cross as orders are missed, parts shipped and points;
  no countdown. Pause button 44 × 44. Hiding the page pauses the run (shared).
- **Orders**: all active orders (up to four) in a two-by-two grid under the
  status line, no scrolling. Each ticket shows the stock icon, the part name,
  seconds left, the remaining route (stock, then each step, done steps removed)
  with the next step in gold (green while its machine runs), and a deadline bar
  that drains and turns red in the last quarter (or last 12 s). An empty slot
  shows when the next order arrives.
- **Covari**: a card in a band kept free at the bottom of the screen (120 px
  plus the safe area). The floor is fitted between the orders and that band, so
  the card never covers a station. Accept and Say no are 46 px tall.
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

### Untested

- Real phones, real touch latency, safe-area insets, browser chrome and real
  vibration.
- Human play: whether the pace, the strike rule, the three-stop plan or the
  recurring Covari offers are clear, comfortable or fun. The survival times
  above are simulation only; no player data exists.
- Performance on real devices over long runs.
- Pocket Shift in landscape: it runs, but the layout was designed for portrait.
