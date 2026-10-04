# Open for Business (`open-for-business`) experiment record

A separate game mode (shop manager), not a level: it has no entry in `SHIFTS`
and no legacy index, sits on its own card under the shift list, and is always
available. This is a local development record; creator playtest, approval and
release are open.

## Identity

| Field | Value |
| --- | --- |
| Mode | `open-for-business` / Open for Business, map `owner-shop`, server role −1 |
| Base commit | `fc64623` (main); four released levels |
| Model | Claude Opus 5.5 (`claude-opus-5-5`), as reported by the run's system context |
| Harness | Claude Code (CLI). Harness version not reported in the environment |
| Date | 2026-10-01 |
| Delegation | None. No other models or subagents contributed |

## Conditions

| Condition | Offered / confirmed | Used |
| --- | --- | --- |
| Starting game | Full source, tests, docs; local server via `scripts/dev-server.mjs` | Yes |
| Development | macOS 27.0, Git, pnpm 11.9.0 via corepack, Node 22.22.0 (tests, builds), Node 24.13.0 (local server), Python 3.14.3, FFmpeg | Node 22 and 24, Python for scripted edits |
| Playtesting | Google Chrome 154 driven two ways: the Claude in Chrome extension (its window was hidden, so `requestAnimationFrame` never ran and the game could not advance there), then headless Chrome via Playwright-core 1.x with SwiftShader WebGL | Headless Playwright for all play evidence. Software rendering runs the game at roughly 40% of real time |
| 3D assets | Procedural Three.js in `dist/assets/models.js`; Blender not installed | Two new procedural models (furnace, laser marker), a recolored staff character, floor bays |
| Music and sound | Existing loop and cues | No new audio; manager events reuse existing cues |
| Research | Web access available | Not used |
| Human iteration | The creator asked for the mode, chose "both" fixed-length and Endless runs, asked for a separate leaderboard, and asked for thorough testing because nobody would validate before release | See iteration log |

## Creative intent

The first four levels teach the player to work the shop. Open for Business hands
them the keys. The machinist is still on the floor, but now every customer is a
decision: take the job, turn it away, or send it to Covari, and decide what to
buy with the money that comes in. It answers the creator's brief directly:
buy machines and capabilities, turn away what the shop cannot make (accepting it
is costly), earn currency during play and spend it on staff who work the floor.

- **Run lengths:** 3, 5 or 7 days, or Endless. A day is 150 seconds. Rent grows
  30% a day so Endless always ends; the player can retire any evening.
- **World:** the same room on a new `owner-shop` map, with four empty taped bays
  and a doorway east between QC and Shipping; the `owner-wing` map adds the east
  wing. Light drifts from morning to dusk across each day.
- **From machinist to manager (round two):** as hires take over the floor, the
  player's decisions move to longer horizons rather than disappearing: bids and
  contracts, sales rules, where machines go and when to build, and keeping the
  floor running through wear and breakdowns, where the owner is the fastest
  fixer. These decisions happen on the floor itself (bay popovers, labels, quote
  cards and a sales strip), not in menus that hide the shop.
- **Covari:** the shared capability-gap rule, applied per quote. Covari is only
  offered for a job with a process the floor lacks, and three processes (powder
  coating, injection molding, wire EDM) can never be bought, so the gap never
  closes. Deliberate change from the shared offer rules: there is no single
  scheduled 300-point offer; the player pays 80% of the price up front and earns
  the full price after Receiving → QC → Shipping, with up to two jobs in flight.
- **Staff:** CAD programmers (seated at a CAD desk), shop runners, a shipping
  clerk, a maintenance tech and a sales manager, each a recolored machinist with
  a name tag, walking the same collision routes as the player and claiming tasks
  so they do not collide with each other.
- **Scoring and boards:** net worth (cash plus 70% resale of everything bought),
  never below zero. Stars count days survived (3 / 5 / 7). Four boards, one per
  run length (`manager-v1-d3`, `-d5`, `-d7`, `-endless`); Endless ranks days
  first. None of them mixes with the shift board.

The full rules are in [level-design.md](../level-design.md#game-mode-open-for-business-open-for-business).

## What changed

- `dist/manager.js` (new): `ManagerGame extends ShopGame` with quotes, cash,
  reputation, equipment, installs, staff AI, days, evenings, bankruptcy,
  retirement, net worth, and the catalogs (`JOBS`, `EQUIPMENT`, `STAFF`,
  `MANAGER_OPS`). Shift logic in `ShopGame` is untouched.
- `dist/core.js`: unchanged. The mode's config is `MANAGER_MODE` in `manager.js`.
- `dist/main.js`: `game` now points at either the shift game or the manager
  game. Per-map station placement (`MAPS[...].place`, `placed`, `accessOf`),
  furnace and laser stations, empty bays, the morning-to-dusk theme blend, quote
  cards with accept / Covari / decline, manager tickets, the Shop panel (M), the
  end-of-day ledger and store, staff rendering and name tags, manager results,
  run-length picker, and a `manager` record in the v8 save. `findPath` takes an
  optional origin for staff routes.
- `dist/assets/models.js`: `makeFurnace`, `makeLaser`, `createWorker`.
- `dist/index.html`, `dist/style.css`: shop drawer, evening panel, run lengths,
  staff tags, board tabs, help text.
- `dist/social.js`: manager runs register with their board ruleset, post days
  and net worth, and hide challenge links; the board dialog gains tabs. Manager
  roles never parse as challenges.
- `server/worker.js`, `db/schema.ts`, `drizzle/0002_*`: manager runs, the
  `validateManagerResult` bounds, `?board=` leaderboards, and a `days` column.
  The shift validator rejects the manager level.
- `scripts/build-offline.mjs`: bundles `manager.js` (core bound first because
  the class extends `ShopGame` at load time).
- Tests: new `qa/manager.test.mjs` (28 tests) and `qa/manager-balance.mjs`
  (simulator). The released levels' tests are unchanged from `main` except that
  the save test supplies `RUN_LENGTHS` and the map test now uses each map's real
  placement and checks the furnace and laser bays too. `qa/balance.mjs` exposes
  `layoutFor` / `accessesFor` and its CLI only simulates timed shifts.

Round two (machinist to manager):

- `dist/manager.js`: stations keyed by bay with a machine type (`MACHINES`,
  `BAYS`, `buyMachine`, `sellMachine`), the wing (`WING`, `buildWing`, map
  `owner-wing`), wear and breakdowns (`wearStation`, `startService`,
  `finishService`), customers and loyalty, bids (`BIDS`, `winChance`,
  `bidQuote`), contracts (`contracts`, `settleContract`), the sales policy and
  manager (`setPolicy`, `salesDecide`), the maintenance tech, seats for
  programmers, upgrades split from machines, and new jobs.
- `dist/main.js`: bays as live stations whose models swap on purchase; per-map
  bounds and a wider path grid for the wing, with the released maps' grid and
  search budget unchanged; floor popovers; wear bars and breakdown labels;
  the sales strip; bid controls and contract cards; seated programmers and the
  sales desk; the evening ledger docked beside the floor.
- `dist/assets/models.js`: `createAnnex` (wing and CAD nook) and `batchRig`,
  which merges each worker's static meshes (57 → 37 draws per worker).
- `qa/manager-balance.mjs`: bay purchases, the wing, technicians, sales,
  map-aware routes, and new strategies (full manager, never services).

## Iteration log

1. Proposal to the creator: a shop-manager mode with quotes, purchases, staff,
   rent, its own leaderboard. Creator: "I want the mode to be sort of endless
   rather, but I like the idea of a 5 day run. maybe we do both?" → selectable 3 /
   5 / 7 days or Endless, bankruptcy and retirement to end Endless.
2. Creator: "Leaderboard for this should be different as well" → one board per
   run length, Endless ranked by days.
3. Creator: "we wont validate any of this before deploying to users so do it
   well and test everything, live play it if you have to" → the verification
   below, including live UI play to the end of full runs.
4. Balance by simulation (`qa/manager-balance.mjs`):
   - First pass: a never-buying solo owner beat one who bought machines,
     because Covari kept 35% for little labor. Covari's share went from 65% to
     80% of the price.
   - Machines still did not pay back for a solo owner over five days, because
     50% resale wiped net worth on purchase. Resale went to 70%, basic jobs fade
     as days pass, and advanced jobs pay more.
   - The simulated owner overcommitted; it now accepts only what its team can
     work, which is also the intended lesson for players.
   - Endless lasted ~37 days for the best policy at 16% daily rent growth; 25%
     gave ~24; 30% gives ~20.
5. Creator, after the first build: "Separate open for business as a separate type
   of game mode, not level 5, and its not locked until the other levels are
   complete." The mode left `SHIFTS` (unreleased, so no saved data used index
   4): it now has its own config, its own welcome-screen card, briefing and
   restart path, and server role −1. `core.js` and the released levels' tests
   are back to `main`; the shift picker and unlock chain are untouched.
6. Layout: the shared map test caught the furnace and laser operator points
   within 1.3 m of the anodize bath and Shipping. The owner map now moves the
   finishing island back and places the bays where every access point is
   distinct.
7. Bugs found by tests and review and fixed: Endless-only retirement was not
   enforced in the engine; runners could not clear the Hold bench; a corrupted
   save holding an array was read as the Endless setting; the shift simulator's
   CLI crashed by iterating the manager level; the home board refresh had
   stopped filling the full board list.

8. Creator, after playing round one ("It works so well! The game is very fun"):
   buy several machines of the same type through a floor expansion that raises
   rent; Ada should sit in the CAD chair; the expansion should allow more staff;
   orders should get more complex; and, the main issue, with full staff and
   every machine there was nothing left to do but decide on orders, which
   should also be hireable. Asked what else could move the player into a
   manager role, the creator chose all four proposals (sales policies, layout
   planning, breakdowns and maintenance, contracts and bidding) with the
   constraint "I don't want to take the player away from watching the shop
   floor to having to manage menus."
   - Built: bays on the floor (compact, small, large) with machines bought from
     a popover anchored at the bay; duplicates of any machine; selling after
     closing; the east wing (four large bays, two small, a CAD nook, more staff,
     more customers, higher rent); wear, slowdowns, breakdowns that trap parts,
     owner repairs and services in person, a maintenance tech; customers with
     loyalty; bids with visible odds; multi-day contracts as one card; a sales
     strip with standing bid and rules, applied automatically by a sales
     manager; complex jobs (repeat visits to a machine, five-step chains,
     tight-tolerance QC); programmers seated in the office chair and the
     wing's nook; the evening ledger docked beside the floor; no office trip
     needed to buy anything.
   - Balance by simulation: the wing first paid off only in fixed runs because
     demand, not capacity, limits Endless. The wing now brings 25% more quotes
     and raises rent 35% (first tried 60%).
   - Bugs found by tests, live runs and comparison with `main`, all fixed:
     - a technician ignored a broken lathe while a runner waited at it
     - the owner could hold two services at once
     - three `undefined`-as-boolean cases leaked manager visuals into the shift
       levels: bays drawn, label classes flipping, staff left visible
     - manager label classes left on hidden bay labels in shifts

## Evidence

### Round one


**Simulations** (`node qa/manager-balance.mjs --seeds=8 --days=N`; scripted
owner on the production collision routes, 0.6 s reactions, deterministic; not
player data). Median net worth:

| Policy | 3 days | 5 days | 7 days | Endless days (median) |
| --- | ---: | ---: | ---: | ---: |
| Solo, never buys | $5,375 | $8,025 | $10,705 | 14 |
| Machines only | $4,610 | $9,885 | $16,060 | 16 |
| Machines + staff | $7,850 | $20,485 | $39,335 | 20 |
| Staff first | $7,620 | $19,730 | $34,850 | 20 |
| Accepts everything | $0 (6/8 bankrupt) | $0 (8/8) | $0 (8/8) | 2 |
| No Covari | $5,110 | $9,685 | $14,800 | 15 |

Growing the shop pays over 5 and 7 days. Over 3 days, machines without staff do
not pay back; short runs favor a lean shop. Accepting work the floor cannot make
bankrupts the shop in every 5- and 7-day seed. Endless always ends; the best
simulated policy lasts about 20 days (~50 minutes). These are an upper bound from
a fast scripted owner, not a prediction for people.

**Automated checks:** `node --test qa/*.test.mjs` (258 tests: 229 existing,
29 new), `node qa/balance.mjs --rush --ignore-calls --expert --assert`,
`pnpm build`, `pnpm deploy:dry-run` and `git diff --check` pass. The released
levels' simulation traces are byte-identical to `main` for six profile sets
(`--trace` with default, 1, 1.5 and 2 second reactions, `--rush`, and
`--ignore-calls --expert`).

The new tests cover:

- catalog identity and untouched shift data
- seeded quotes, their cap, lapsing and closing cutoff
- accepting, a full board and declining
- a complete in-house job with stock, tip and reputation
- stock billing and recycling
- the cost of accepting impossible work
- Covari gaps, payment, slots and the QC route
- purchases, installs, upgrades and resale
- ads, hiring, wages and firing
- staff completing jobs with the owner idle
- clerks, runner swaps and the Hold bench
- staff never starting impossible work
- after-hours purchases on the closed day's ledger
- day end, carry-over and the next morning
- fixed-run completion and cancellations
- bankruptcy and Endless retirement
- a randomized four-seed stress run asserting after every tick that each part
  is in exactly one place, ending with a postable result
- strategy ranking
- server bounds
- the real Worker and SQLite migrations keeping boards separate
- challenge rejection
- save loading with corrupt data
- bay reachability

**Browser (headless Chrome 154, SwiftShader, Playwright-core, local server on
Node 24).** These are scripted runs on software rendering, not human playtests.

- **Live play, UI only (no access to game internals):** a script played whole
  runs by clicking station labels (walk and interact), quote buttons and the
  evening store, then posted through the leaderboard dialog. It took a quote
  when the floor could make it and the team had room, used Covari for gaps, and
  declined otherwise.
  - **3-day run:** 13.6 wall minutes, 103 station clicks. 24 shipped (9
    through Covari), 0 expired, 6 turned away, 2 cancelled at closing. Net worth
    $6,390, posted, and listed on the 3-day board.
  - **5-day run:** 23.6 wall minutes, 198 clicks. 55 shipped (21 through
    Covari), 0 expired, 7 turned away. Net worth $17,125, posted, and listed on
    the 5-day board. No page errors.
- **Scenario script, 34 checks, all passing.** A QA-only hook injected into the
  served `main.js` let it skip clocks and set cash. It covered:
  - shop panel opening, disabled away from the office, Walk to office, a
    mid-day purchase with its install timer and the live station afterwards
  - hiring with a name tag, Escape closing the panel before pausing
  - restart keeping the run length and clearing staff
  - bankruptcy results; the server rejecting a post whose day skipped its clock
  - Endless retirement, and no retire button on fixed runs
  - board tabs, with the shift board excluding manager runs
  - returning to Night Shift: shift HUD, labels and results, no Shop button,
    staff, bays or for-sale labels
  - a 390×844 phone layout: no horizontal scroll, evening panel fits
  - the standalone `dist/CHIP-RUSH.html` from `file://` with the four shifts and the mode card, a
    working manager run and no errors
- **Touch emulation** (`pointer: coarse`, 390×844):
  - the level picker fits
  - quote buttons sit fully inside the rail and their text fits
  - a dedicated Shop button opens the drawer; quote taps work
- **Regression against `main`:** `main` was served from a worktree on a second
  port. The menu and all four shift levels matched exactly on draw calls,
  triangles, settled station screen positions, and visible label classes and
  text. They still matched after a fully staffed manager run. A fully built
  manager shop renders 465 draw calls / 44,054 triangles (Night Shift: 324 /
  35,294).
- **Bugs found by these runs and fixed:**
  - evening purchases were missing from every day's ledger
  - a detached-button error when choosing a run length
  - staff name tags survived a restart
  - three `undefined`-as-boolean cases leaked into the shift levels:
    every station label flipped a for-sale class each frame, the empty bays
    were drawn as flat geometry, and staff models could stay drawn after a
    manager run
  - quote buttons were clipped on phones, and touch devices had no Shop button
  - shift results kept the manager labels after a manager run
  - tickets said "Complete CAD at the office" while a hired programmer was
    doing it

### Round two

**Simulations** (`node qa/manager-balance.mjs --seeds=8 --days=N`; scripted
owner on the production collision routes of each map; not player data).

Median net worth:

| Policy | 3 days | 5 days | 7 days | Endless days (median) |
| --- | ---: | ---: | ---: | ---: |
| Solo, never buys | $5,065 | $8,250 | $12,300 | 14 |
| Machines only | $5,465 | $12,335 | $18,315 | 17 |
| Machines + staff | $8,190 | $25,220 | $48,495 | 22 |
| Full manager (wing, extra machines, sales, techs) | $9,665 | $26,515 | $61,935 | 22 |
| Never services (no tech, owner skips maintenance) | $9,030 | $23,285 | $41,520 | 21 |
| Accepts everything | $0 (4/8 bankrupt) | $0 (8/8) | $0 (8/8) | 3 |
| No Covari | $4,880 | $11,110 | $17,460 | 17 |

- **Growth and the wing:** growing the shop pays at every length. The wing
  pays back over 7 days ($62k against $48k). Over 5 days it roughly breaks
  even. In Endless it is neutral, where exponential rent is the wall.
- **Maintenance:** skipping it costs 16 breakdowns and about $7k over 7 days,
  and 71 breakdowns over an Endless run.

**Automated checks:** `node --test qa/*.test.mjs` passes 263 tests. They break
down as 229 for the released levels (two of them now check each map's real
placements), 31 for the manager mode and 3 for performance. Also passing:

- `node qa/balance.mjs --rush --ignore-calls --expert --assert`
- `pnpm build`, `pnpm deploy:dry-run` and `git diff --check`
- the released levels' traces, byte-identical to `main` for the six profile
  sets

The manager tests cover:

- bays, sizes and duplicates
- selling, including the ledger refund
- the wing: overnight opening, rent, staff limits and the second CAD seat
- wear slowdowns and breakdowns that trap a part
- owner repair and service in person, including starting a second job
- technicians, including a runner waiting at the broken machine
- runners rerouting to a second machine
- bids and win chances
- customer loyalty
- contracts: one slot, one CAD program, per-part pay, a single reputation hit
- sales rules
- complex jobs and tight QC
- a four-seed stress run over the full floor asserting every part is in
  exactly one place after every tick
- strategy ranking

**Browser (headless Chrome 154, SwiftShader):**

- **Scenario checks:** 52 pass, covering:
  - bay popovers and size rules
  - buying mid-shift with no office trip
  - bid controls and odds
  - sales-strip rules
  - hiring, Escape handling and restarts
  - a DOWN label, then a repair done in person
  - the EXPAND sign, the wing opening with six bays, and a second lathe
  - selling after closing from the docked evening ledger
  - bankruptcy, retirement and the boards
  - phone layout and the offline file
- **Live play, UI only, on the final code:** the same click-only script
  played a full 5-day run from an empty save, in 37 wall minutes and 216
  clicks. The time includes a second copy running at once on the same machine.
  The script made 8 bids and lost 2, and did 1 repair in person. It shipped
  44 jobs (18 through Covari), delivered 1 contract and broke none. Nothing
  expired, 20 jobs were turned away and 3 were cancelled at closing. Net worth
  was $21,440, posted to the 5-day board, with no page errors.
- **Touch emulation:** passes.
- **Against `main`:** world positions, draw calls, triangles and labels are
  identical. Screen projections differ by up to 1 px, matching the camera-ease
  jitter `main` shows between two of its own levels with the same layout. This
  holds for the menu and all four shifts, before and after a fully staffed
  manager run.
- **Visual walkthrough:** seated programmers in the office chair and the wing's
  nook, the technician fixing a broken lathe, and the wing at full build.

**Performance (creator report: an M4 Pro's fans at 100% while playing):**

- **Cause:** the game redrew the whole scene and its 2048 px shadow map on
  every display frame (120 Hz on ProMotion) in every mode, menus and pause
  included. A CPU profile of the full manager shop showed the cost was
  Three.js draw submission (`uniformMatrix4fv` 154 ms against about 4 ms of
  game code over 8 s), scaling with draw calls × frame rate.
- **Fixes:**
  - a frame budget: 60 fps playing, 30 in menus and evenings, 10 paused, in
    help or on results
  - the shadow map redrawn at most 30 times a second while playing
  - shared spark geometry and materials
  - staff rigs merged per limb, from 57 to 37 meshes each
- **Measured in headless Chrome:**
  - menu renders 28/s (uncapped: 46, limited only by software rendering)
  - paused renders 9/s (uncapped: 50)
  - the full manager shop's script time per rendered frame fell from about
    5 ms to about 2.3 ms
- **Expected on a 120 Hz display:** half the rendering while playing, a
  quarter in menus and roughly a twelfth when paused. That is not measured on
  real hardware.

## Known limitations, not tested

The creator has played round one; round two is unplayed by a human. Difficulty and fun are unmeasured. Fan noise and frame rate after the performance work have not been measured on the creator's MacBook. The extension-driven Chrome could not run the game (hidden window), so all browser evidence is headless software rendering. A fully built wing with ten staff renders about 770 to 920 draw calls (shift levels: 277 to 324), now at most 60 frames a second; it is untested on low-end GPUs. Station labels crowd on phone screens, as in Night Shift. Software rendering
means the scripted player reacts faster relative to game time than a person.
The new models and the Shop panel have not been judged on a real GPU display,
on touch devices or by the creator. No new music. The hosted Worker and D1 were
exercised only through SQLite in tests and the local adapter. Scores remain
self-reported, bounded but not replay-verified.

## Release

Not released. Awaiting creator playtest and approval. No PR, merge or deployment
has been made.
