# CHIP RUSH level design

This document describes the released starting scenarios and their current
implementation. For a new level, read [the model experiment brief](model-experiment.md)
first. Its creative freedom applies: current mechanics are not requirements for
future levels.

## Chapter: The First Shop

The current game is the beginning of an expandable journey through one small
shop. First Shift introduces the physical loop and remains exempt from the
one-main-level-per-model limit. Rush Hour is Astra’s retained main entry: CAD,
overlapping orders, and optional customer calls on the same map. Mixed Orders
is retired from the playable collection. Night Shift is now the third playable
level and adds a second map variant (see below).

Every playable shift is available immediately. First Shift is the recommended learning
route; later shifts are independent model-created challenges. Legacy unlock
values remain in saves for compatibility but no longer gate entry.

Stable level IDs identify scenarios permanently; display names can evolve. Legacy numeric role indices remain
compatible with saves, leaderboard records, and challenge links unless a
deliberate migration is announced. New levels append stable IDs and never
reorder the legacy indices. Mixed Orders keeps index 1 and its full historical
configuration, but the picker, briefings, direct starts, friend links, and new
server runs reject retired entries. Existing scores remain visible as
“Mixed Orders (retired)”; save arrays retain the slot. Display sequence numbers
count playable entries independently of these legacy identities.

| Legacy index | Stable ID | Level | Duration | Clear | Stars | Capability introduced |
| --- | --- | --- | ---: | ---: | --- | --- |
| 0 | `first-shift` | First Shift | 150s | 3 shipments | 3 / 4 / 5 | Stock, one machine route, inspection, shipping |
| 1 | `mixed-orders` | Mixed Orders (retired) | 180s | 4 shipments | 4 / 5 / 6 | Six seconds of attended CAD, overlapping orders, and optional outsourcing |
| 2 | `rush-hour` | Rush Hour | 180s | 5 shipments | 5 / 6 / 8 | Customer calls, optional rush promises |
| 3 | `night-shift` | Night Shift | 210s | 4 shipments | 4 / 5 / 6 | Deburr and Anodize finishing stations on the `night-shop` map; Covari offers a finishing process the floor lacks; no calls |
| 4 | `dawn-shift` | Blackout Shift | 180s | 5 shipments | 5 / 6 / 8 | Cellular `dawn-shop` floor around a central QC hub and 3D Backup Generator; zero CAD delay; 1.5× Harmonic Overdrive (2+ machines); 2.0× Office/Lightning Surges; 128 BPM storm-synth music; precision Covari capability gap |
| 5 | `launch-window` | Launch Window | 210s + 10s terminal count | 4 assemblies | 4 / 5 / 7 | Kits of parts joined in a robot assembly cell; each shipment is stacked onto a rocket on the pad; liftoff or scrub at T−10; `launch-pad` map; no CAD |
| 6 | `last-light` | Last Light | 220s | 6 deliveries | 6 / 9 / 12 | Three-slot quay and player-dispatched tender; rebuild the lighthouse and guide the harbor fleet home; optical grinding outsourced |

First Shift and Rush Hour use the `first-shop` map and the available Lathe, Mill,
Inspect, Office, Shipping, stock bins, Hold bench, and Receiving bench where
the scenario permits them. Deburring and Anodizing exist in the machine model
but are not available in those two playable scenarios. Night Shift is the first to use
them on the `night-shop` map; Blackout Shift (`dawn-shift`) reconfigures those
same five stations into West and East cells around a central Inspection hub and
a 3D Backup Generator on the `dawn-shop` map.

## Scenario briefs

### First Shift (`first-shift`)

The player learns the physical loop: collect the correct stock, follow the
ticket, wait for the machine, inspect, and ship. The route recipes are Pocket
spacer (`lathe → inspect`) and Mounting plate (`mill → inspect`). The fixed
sequence is Pocket spacer, Mounting plate, repeated through the shift. The
safe-arrival check commonly permits seven typical arrivals, but there is no
separate hard order cap. The opening order is
available at 0s; the second arrives after 18s and later arrivals use 19s
spacing.
The opening order receives the normal 82s deadline plus 14s; later orders use
the 82s deadline. CAD is already complete. There are no calls or outsourced
offers.

Clear means three shipments before the 150s timer ends. The three star levels
are 3, 4, and 5 shipments. Clearing is completion; mastery is the higher star
target. The timer is a maximum: the shift ends early when no work or eligible arrivals remain.

### Mixed Orders (`mixed-orders`, retired)

Historical configuration retained for saved records and regression checks; this
scenario is unavailable for new play, friend challenges, or score runs.

The player adds attended CAD and learns to overlap office work with machines.
Every order requires six attended seconds of CAD before stock pickup. The scheduled
six-order sequence is Pocket spacer, Mounting plate, Bearing housing, then the
same three again. Bearing housing uses `lathe → mill → inspect`; the other two
routes remain the First Shift routes. The opening order is available at 0s; the
second arrives after 16s and later arrivals use 25s spacing. The opening deadline is 105s plus 14s; later orders
use 105s. The level uses the same four-active-order limit and closing-time
arrival check.

Clear means four shipments before the 180s timer ends. The three star levels
are 4, 5, and 6 shipments. CAD, machine overlap, and route planning are the
new decisions; a higher star is mastery of those decisions. The shift ends early
only after the remaining workload is resolved, not merely on reaching a star.

### Rush Hour (`rush-hour`)

The player manages mixed machining orders while customer calls and optional
outside capability compete for attention. The scheduled eight-order sequence is
Pocket spacer, Mounting plate, Bearing housing, Pocket spacer, Bearing housing,
Mounting plate, Bearing housing, Mounting plate. The opening order is available
at 0s; the second arrives after 12s and later arrivals use 18s spacing. The opening deadline is 105s plus 14s;
later orders use 105s. The level uses the same four-active-order limit and
closing-time arrival check.

Calls ring at 27s, 77s, and 127s when eligible. While ringing, CAD pauses and
the next Office interaction answers the call first. Floor handoffs,
inspection, shipping, sourcing, and receiving remain available. Answering
locks actions for the three-second conversation; the player may then accept or
decline the separate rush promise. A completed conversation earns 25 points;
an accepted rush can earn 100 bonus points and can lose up to 25 points if
missed. Ignoring or declining a call has no missed-rush penalty.

After two normal shipments, at least 35s elapsed, and at least 45s remaining,
the level may offer one outside-capability job. The current offers rotate among
Molded cover (Injection molding), Wire EDM insert, and Sheet-metal bracket.
Accepting starts a 22s delivery to Receiving; the delivered part follows
`inspect → ship` and earns 300 points without using a normal order slot or
shipment/star/streak credit. Declining has no penalty. This capability is
enabled for Rush Hour and Night Shift in this part of the collection. Night Shift
uses its own pool of finishing capabilities (see below); Rush Hour uses the
rotation above. Retired Mixed Orders retains its historical offer configuration.

Clear means five shipments before the 180s timer ends. The three star levels
are 5, 6, and 8 shipments. Rush acceptance and outsourcing are optional paths;
neither is required for clearing or the configured star target.

### Night Shift (`night-shift`)

The phones are off and the shop is quiet. The player has run Rush Hour; now the
shop takes finishing work. Deburr (4s) and the Anodize color bath (8s) join the
Lathe (8s), Mill (10s) and Inspect (4s). CAD uses the same six-second attended step as Rush Hour. There are
no customer calls, so the level is a calmer, craft-focused chapter rather than a
harder one. Covari stays: the floor still has no furnace, coating booth or laser.

The scheduled six-order sequence is Dial knob (`lathe → deburr → inspect`),
Ocean collar (`lathe → anodize → inspect`), Satin bracket
(`mill → deburr → anodize → inspect`), Valve body
(`lathe → mill → deburr → inspect`), Satin bracket, Dial knob. The opening order
is available at 0s; the second arrives after 20s and later arrivals use 28s
spacing. The opening deadline is 120s plus 14s; later orders use 120s. The
four-active-order limit and closing-time arrival check are shared with the other
levels. Every order needs six attended seconds of CAD before stock pickup.

Clear means four shipments before the 210s timer ends. The three star levels are
4, 5, and 6 shipments. Two orders need the single bath, so feeding it early and
using its eight seconds for CAD or another part is the new decision. Scoring uses
the shared formula (part value, 120 for CAD, early shipping, streak); values are
180 to 270 per part.

**Covari capability gap.** After two normal shipments, at least 35s in and with
at least 45s left, the level offers one finishing job that no station on this
floor can do. The pool is Heat-treated pin (Heat treatment, "No furnace on this
floor"), Powder-coated panel (Powder coating, "No coating booth on this floor")
and Laser-marked plate (Laser marking, "No laser on this floor"), each with its
own HT / PC / LM badge (`FINISHING_SOURCE_JOBS`, selected by the level's
`sourceJobs`). The offer card shows the reason as its subtitle. Everything else
follows the earlier levels: **Outsource with Covari** or **Say no** (30s to decide,
no penalty), delivery to Receiving after 22s, `inspect → ship`, exactly 300 points,
no order slot and no shipment, star or streak credit. The Receiving bench is on
this map, beside the finishing island. Outsourcing is an optional trade: it costs
a trip and a QC slot for slow players (in simulation, concurrent play at 1.5s
handoffs drops from two stars to one), and it never gates clearing or three stars
for ordinary concurrent play.

The `night-shop` map places Deburr and Anodize as a finishing island in the
middle of the same room, clear of the Receiving bench. The
lighting switches to a night palette. Deburr and Anodize are hidden, and not
obstacles, on `first-shop`. Every level's `mapId` must be a key of `MAPS` in
`dist/main.js`; `MAPS` lists the stations a map adds (`def.map`) or hides
(`hide`) and names a theme in `THEMES`.

### Blackout Shift (`dawn-shift`)

A pre-dawn coastal storm knocks out the main utility grid (`docs/experiments/dawn-shift.md`).
Instead of adding another machine to the line, Blackout Shift reconfigures the
existing five stations (`lathe`, `mill`, `deburr`, `anodize`, `inspect`) on the
`dawn-shop` map into a West Cell (`lathe` + `deburr`) and an East Cell (`mill` +
`anodize`) around a central **Inspection hub** (`x: 0, z: -1.75`) and a 3D
**Backup Generator & Capacitor Bank** (`BACKUP GENERATOR · OVERDRIVE BUS`) with
radiating cyan power conduits and a procedural **128 BPM storm-synthwave
soundtrack** (`musicTrack: 'storm'`).

Emergency utility and turbine repair tickets arrive pre-programmed (`programming: false`),
so the player sprints straight to raw stock without sitting at CAD. Running **2
or more machines simultaneously** locks the generator into **1.5× Harmonic
Overdrive**, accelerating all active machine timers by 1.5×. Walking to the
Office (`SURGE CONSOLE`) when its capacitor bank is charged triggers a **16s
2.0× Generator Surge** (22s recharge), and scheduled coastal lightning strikes
at **50s, 105s, and 148s** unleash a **10s 2.0× Lightning Surge**.

The scheduled eight-order sequence is Turbine coupling
(`lathe → mill → deburr → inspect`), Breaker busbar
(`mill → deburr → anodize → inspect`), Ocean collar
(`lathe → anodize → inspect`), Surge manifold
(`lathe → mill → anodize → inspect`), Grid isolator
(`lathe → mill → deburr → anodize → inspect`), Turbine coupling, Breaker busbar,
Surge manifold. The opening order arrives at 0s, the second at 8s, and later
arrivals every 21s. The ordinary deadline is 112s (+14s for the opening order).
Clear means five shipments before the 180s timer ends; stars are 5, 6, and 8
shipments.

**Covari capability gap.** Even under generator overdrive, the floor has no wire
EDM, heat-treat furnace, or laser marker. After two normal shipments, at least
35s in and with at least 45s left, Blackout Shift offers one job from
`PRECISION_SOURCE_JOBS`: Wire-cut flexure (`Wire EDM`, `"No wire EDM on this floor"`),
Case-hardened gear (`Heat treatment`, `"No furnace on this floor"`), or
Serialized optic mount (`Laser marking`, `"No laser on this floor"`). It follows
the shared offer rules: optional, 30s decision window, 22s delivery to Receiving,
`inspect → ship`, 300 points, and no order slot or shipment/star/streak credit.
### Launch Window (`launch-window`)

The morning after Blackout Shift: the storm that knocked out the grid also
scrubbed a launch down the coast, and the shop builds flight hardware in the
hangar beside the pad for the rescheduled dawn window.
Every order is a kit of two or three parts. Each part has its own stock and a
short lathe/mill route and ends at the robot assembly cell, which takes parts
at any time and assembles a kit (6s) as soon as its last part arrives. The
assembly then goes through Inspection to the pad, where a crane stacks it onto
the rocket. Stock bins dispatch the earliest-due part of their type; a ready
cell hands over its assembly when a part is dropped. An expired kit removes its
parts everywhere and counts one miss. There is no CAD and there are no calls.

Seven kits at most (0s, 16s, then every 23s; deadline 115s, +14 for the first).
Clear and stars count shipped assemblies: 4 / 5 / 7. The clock shows T−minus,
and the shift's end, early or on time, starts a ten-second terminal count: at
the clear target the rocket lifts off, below it the launch scrubs. Covari
offers metal 3D printing, carbon fiber layup or friction stir welding
(`LAUNCH_SOURCE_JOBS`) on the shared rules.

The rules are `LaunchGame` in `dist/launch.js` (`engine:'launch'` in the
catalog); `shiftGame(index)` creates the right rules for any level. Kit parts
are child orders of their kit, so ShopGame's stock, machine, Hold bench and
recycling rules apply to them unchanged. The `launch-pad` map replaces the
workshop shell with `createHangar()` and adds `createLaunchComplex()` east of
it (`MAPS[...].shell`, `fixed` props and landmark framing). Full record:
[experiments/launch-window.md](experiments/launch-window.md).

## Game mode: Open for Business (`open-for-business`)

A separate game mode, not a level. It is not in `SHIFTS`, has no legacy index,
and is always available from its own card on the welcome screen; it neither
needs nor grants shift unlocks. Its config is `MANAGER_MODE` and its rules live
in `dist/manager.js` (`ManagerGame` extends `ShopGame`); its record is
[experiments/open-for-business.md](experiments/open-for-business.md). The player
runs the shop until they stop. Each day is 150 seconds; the shop
starts with $1,500, a lathe, a mill and QC.

- **Quotes and bids.** A quote arrives three seconds into each day and then
  roughly every 6.5 to 15 seconds (faster on later days, with better
  reputation, 25% faster once the east wing is open and 12% faster again per
  south hall); at most three wait at once (one more per two open halls), each
  lapses after 18 seconds, and none arrive in the last 20 seconds. Each names one of six fictional customers with a loyalty of 0 to 3
  (prices +4% per point; more frequent quotes). The card crosses out any step
  the floor cannot do. ◀ ▶ sets a bid from −10% to +50%: at or below list
  the customer always says yes; above it the chance falls (1 − 2 × markup,
  plus reputation and loyalty). A lost bid simply goes elsewhere.
- **Contracts.** From day 2 (never on a fixed run's last day) about one quote in
  six is a contract: 3 to 8 identical parts at list +10% each, due at the end
  of tomorrow. It takes one order-board slot and one CAD program; parts pay as
  they ship. Delivering all of them adds reputation and loyalty; the first
  missed part costs 0.6 reputation and 1.5 loyalty, and each missed part costs
  25% of its price.
- **Covari capability gap.** The shared rule, expressed per quote. Covari only
  takes single jobs that need a process the floor lacks: deburr, anodize,
  heat treatment or laser marking until a machine for it is bought, and powder
  coating, injection molding and wire EDM, which can never be bought. The
  player pays 80% of the base price up front; the crate reaches Receiving after
  20 seconds; QC and Shipping pay the bid price. At most two in flight. This
  deliberately replaces the 300-point single offer. One further, deliberate
  exception at the creator's request: the owner can set a Covari limit, and
  single jobs listed below it may go to Covari even when the floor could make
  them (the sales manager sends them automatically; off by default).
- **Money.** Shipping pays the agreed price, plus a 10% tip if more than half
  the deadline remains (single in-house jobs that were never delayed). Stock costs $30–45 once
  per part. An expired job costs 20% of its price, 0.4 reputation (0.8 if it
  was accepted while the floor lacked a process) and a point of the customer's
  loyalty. Reputation (1–5, starting at 3) scales prices and quote frequency.
- **The floor.** The shop opens with a lathe, mill and QC bench and four empty
  bays: two compact island bays (deburr, anodize, furnace, laser) and two small
  front-wall bays (furnace, laser). Clicking an empty bay opens a popover of the
  machines that fit; they install in 12 seconds during the day or are ready by
  morning. Several machines of one kind share the work. A machine's ⋯ sells it
  for 70% (clicking it after closing does the same). The starting lathe and
  mill stand in large bays and the QC bench in a bench bay (QC, deburr,
  anodize, furnace or laser), so they can be sold, moved or replaced like any
  machine. On this map QC and Shipping part to leave a doorway east.
- **East wing.** $6,000 from the EXPAND sign or the Shop panel; builders open it
  the next morning (map `owner-wing`). It adds four large bays (any machine,
  including extra lathes, mills and QC benches), two small bays, a second CAD
  desk, higher staff limits, 25% more frequent quotes and 35% higher rent.
- **South halls.** After the wing, six halls (A–F, two columns, three rows)
  can be built below the main building and wing, each the next morning, for
  $6,000 (row 1), $8,000 (row 2) or $10,000 (row 3). A hall must touch floor
  the shop owns or has ordered: row 1 touches the main building. Each adds six
  large bays and two small ones, one more order-board slot, a runner (and a
  clerk and a technician per two halls), 12% more frequent quotes and 10% of
  the base rent. Main building, wing and halls together are about ten times the
  original room. Rows connect through doorways in low partitions. Scroll,
  pinch or + / − zoom the view (0 or ⤢ fits it); dragging the floor pans; while
  zoomed in, the view follows the machinist near its edges.
- **Moving machines.** Buying any hall lets the owner move an idle, working
  machine from its ⋯ to any open empty bay it fits, across rooms. It keeps its
  wear and installs again: 12 seconds during the day, at once after closing.
- **Wear and breakdowns.** Every finished cycle adds wear (4–11 by machine);
  worn machines run up to 40% slower. Above 55 wear a cycle may end in a
  breakdown that traps the finished part until someone repairs the machine.
  The owner repairs in 5 seconds and services an idle machine (empty hands,
  wear 15+) in 3, but only while standing there. A maintenance tech does both
  on their own (8 and 4 seconds) and services machines from 45 wear.
- **Expedite and delay.** Every accepted job and contract card has ⚡ Expedite,
  which puts it first in every staff queue (CAD, stock, collection, Covari
  crates), and +1 day, which asks the customer for one more working day (150
  seconds) before the job expires. The card shows the chance they refuse: 25%
  for a first ask, 25% more for each further ask, 5% less per loyalty point
  (5–90%). A refusal expires the job at once with the usual fee and reputation
  hit, and its part is scrapped wherever it is. A contract is delayed or lost
  as a whole.
- **Staff.** CAD programmer (one per CAD desk), shop runners (2, or 4 with the
  wing), shipping clerk (1/2), maintenance tech (1/2) and a sales manager (1);
  south halls raise the runner, clerk and technician limits.
  Staff walk the production paths and claim tasks; runners pick the nearest free
  machine of the right kind and route around broken ones. Wages are paid each
  evening; staff can be let go only after closing.
- **Sales rules.** A strip at the start of the order rail holds the standing bid
  for new quotes, what to do with a missing process (turn away, Covari, accept),
  how many board slots to keep free and whether to take contracts, plus a
  review line (quotes priced at or above it wait for the owner), a Covari bid
  (Same follows the standing bid) and the Covari limit for small jobs. With a
  sales manager hired, every other quote is answered by these rules after three
  seconds; the player can still act first.
- **Evenings and endings.** Rent (300 × 1.3^(day−1), ×1.35 with the wing, ×(1 + 0.1 per hall)) and
  wages are charged at closing; accepted work carries over, open quotes close.
  The evening ledger docks beside the floor, so bays stay clickable after
  hours. Cash below zero ends the run as bankrupt. A new run is limitless:
  any evening the player can retire and post that result. A run already saved
  at 3, 5, or 7 days can still finish that length. Unfinished jobs at the very end are
  cancelled with their fees. Score is net worth: cash plus 70% resale of
  machines (the starting three included, $5,110) and upgrades and 50% of the
  wing and halls, never below 0. Stars count days
  survived (3 / 5 / 7); they are shown, never used to unlock.
- **Data.** Same v8 save, with a `manager` record (best net worth, including
  older per-length bests, longest run, last length) beside the untouched shift
  fields. Server runs use role `MANAGER_ROLE` (−1, never a level index). New
  runs post to `manager-v1-endless`. Scores already stored on `manager-v1-d3`,
  `-d5`, and `-d7` stay in the table and appear on that one board, ranked by
  net worth (points), then days, then time. The `scores.days` column
  (migration 0002) is unchanged. No challenge links. `validateManagerResult` bounds
  elapsed time, days, finish reason and net worth by the economy. The run in
  progress also saves to `chip-rush-manager-run-v1` (the whole `ManagerGame`
  state, the board run id and the machinist's spot) every few seconds while
  playing, on pause, at closing and when the page hides; the mode card and
  briefing offer Continue, mid-day saves resume paused, and a finished run
  clears it.

## Design and release rules

- Describe each new level's implemented design and verification in its experiment
  record. Include its identity, world, objective, controls, progression, scoring,
  and ending conditions. Document machines, recipes, timers, or stars if the
  level uses them; these are not mandatory ingredients.
- Map identity is separate from scenario identity. `MAPS` in `dist/main.js`
  currently holds `first-shop` and `night-shop`: a map picks which stations exist
  (adding or hiding stations relative to the shared layout), its collision
  obstacles, and its lighting theme. Other geometry (the room shell, office and
  props) is shared. Do not describe an unimplemented map as available or invent
  future challenges.
- Every new level includes Covari outsourcing as a real capability gap: a
  process or step with no station on that level's floor. Night Shift is the model.
  First Shift, released earlier, has none and is unchanged.
- New mechanics may differ from the current timers, routes, CAD, calls, and
  sourcing. Preserve earlier levels' intended behavior and explicitly handle
  compatibility for saves, leaderboard records, and challenge links.
- New levels append to the legacy index list. Numeric compatibility is retained
  unless a migration is deliberately designed and documented.
- Balance claims must come from reproducible simulations or observed playtests.
  Do not claim measured player difficulty from a target or a simulation alone.
- Keep score validation appropriate to each level. A new scoring system may
  need a separate or versioned leaderboard; do not equate incompatible scores.
- The release process is development cadence, not story canon: ship a tested
  scenario when it is ready, without inventing a fictional roadmap for the
  player.

## Where the next model should work

- `dist/core.js` → `SHIFTS` is the level catalog. Each entry owns its `id`,
  `mapId`, author and harness credits (`author`, `harness`), visible descriptions (`subtitle`, `brief`, `tip`, `retryTip`),
  recipe schedule, station unlocks, stock types, CAD/sourcing/call flags,
  call times, timer, clear target, and star thresholds. Read the core methods
  for shared rules such as the four-order limit and late-arrival safety check.
- A level with its own rules sets `engine` in its catalog entry; `shiftGame()`
  in `dist/launch.js` creates its game for the renderer, server and balance
  driver. Launch Window is the example.
- `dist/main.js` renders the catalog into selection, briefings, and progression.
  The “More shifts coming” row in `dist/index.html` is informational, never a
  playable entry. Keep the opening screen concise and its Play button reachable.
- A new map entry in `MAPS` can add or hide stations and choose a theme
  (`activateMap`, `applyMap`). A different room needs renderer and navigation work
  in `dist/main.js` and `dist/assets/models.js`; changing `mapId` alone does not
  load new geometry. `qa/balance.mjs` re-activates each level's map before routing.
- `dist/social.js` and `server/worker.js` validate challenges and scores. Both
  use catalog capabilities, but retain shared score bounds (20,000 total,
  1,600 per normal shipment plus allowed support points) and an eight-order
  fallback for uncapped scenarios. Review those bounds for any new scenario.
- `qa/balance.mjs` and `qa/difficulty.test.mjs` prove repeatable routes and
  timing bounds. Test the new scenario, existing scenarios, saved progression,
  and public challenge/score validation. Observe real players before making
  claims about whether a level is easy, hard, or fun.

A new release can add a scenario when explicitly requested. It need not raise
the maximum difficulty or add a mechanic. Do not change the existing three
scenarios' balance as an incidental consequence of adding the next one.

## Ending a shift

The clock is a time limit. A shift also ends on the next game tick once every
normal job is shipped or expired, no carried/parked/machine part remains, and
the existing arrival rules cannot admit another job. An empty queue between
arrivals and reaching a star target do not end the shift. Unresolved Covari
offers keep their accept/decline choice until timeout; accepted deliveries,
inspection, and shipment must resolve before an early finish. The time limit
still ends unfinished work normally. Early finishes preserve actual elapsed
and remaining time and award no additional time bonus. Score posting carries
completion metadata and validates elapsed time, outcome counts, and remaining
arrival eligibility; it no longer requires an already-finished shift to wait
for the full clock. Scores remain self-reported rather than replay-verified.

## Shop-first entry and speed records

The home keeps the 3D shop visible behind a compact shift rail, or a bottom
strip in small windows. Shifts and Open for Business have separate tabs.
Every existing shift is selectable immediately and displays its model/harness
credit, with the model name highlighted in gold. Play starts directly;
How to play opens an optional briefing. Saved business runs continue directly.

Offline-compatible hash routes select the collection (`#/challenges`), a stable
challenge briefing (`#/challenges/launch-window`) or the shop-manager choice
(`#/open-for-business`). Home is the empty hash. Browser back/forward follows
these entries. An in-progress manager run still saves and resumes normally.

A shift's **clear time** is the first ordinary shipment reaching its existing
`passTarget`; outsourced jobs add points but never advance that split. Paused
time and the Launch Window cinematic do not count. The clock freezes at clear
while the run continues for more points. Results show clear time, full shift
end time, points, shipments and stars. The fastest clear is stored separately
by stable level ID in `chip-rush-speed-v1`, so improving time does not require
improving score. Previous runs have no invented timing records.

High scores is one surface with Open for Business and Shift Records tabs.
Home defaults to the business board and shows five records; the full board
retains thirty. Shift points rank all shifts together, with shift identity,
clear time and end time shown where known. New rows persist nullable timing
columns through additive migration 0003; historical rows retain their scores
and unknown times. Timing remains self-reported and bounded, not replay-verified.
Times across different shifts are descriptive, not an overall speed ranking.
Business ranking remains net worth from completed or retired runs; active
shops are not auto-published. Migration 0003 must be applied before deploying the updated Worker.


## Last Light (`last-light`)

GPT-6.1 Sol / Codex's submission continues the coastal setting after the launch:
the shop moves to a pier to repair the harbor lighthouse before dusk. Its
`harbor-pier` map has a bespoke timber platform, corrugated workshop, catenary
lamps, open water, a lighthouse island, an animated tender and fishing boats.
An original 92 BPM procedural harbor piece accompanies the work.

The new decision is batch dispatch. Machined and inspected parts load onto a
three-slot quay. With empty hands, use the quay again to send all staged parts.
Swell permits departure for 12 seconds every 36, starting at 0:20. The crossing is 12 seconds, followed by a 12-second empty return. Making the
next batch while the tender sails keeps the shop productive. Quay deadlines
continue; aboard the tender, they stop, fixing the early-delivery bonus at
departure. Points, stars and clear time are awarded only at arrival. The
player's currently carried part is preserved across autonomous deliveries.

Lantern spindles use the lathe, Fresnel carriers the mill, and gimbal cradles
both, followed by inspection. No attended CAD or calls. Up to twelve orders
use a 10-second first gap, then 12-second arrivals, with 65-second
deadlines (+14 for the first), the shared four-order limit, and a late-arrival
check that reserves time for the next safe crossing after machining. Six
deliveries clear, nine and twelve earn the higher stars. The clock is 220 seconds. The run can finish early after all eligible work
is resolved; a closing-time arrival counts, an unfinished crossing does not.

After two ordinary deliveries, the customer may need a ground Fresnel optic.
There is no optical-grinding machine on the pier: Covari supplies it, Receiving
and QC remain required, and it also travels on the tender. Its 300 points do
not count toward the lighthouse's six-part target. Stable index 6 appends to
the catalog, leaving all historical IDs and slots intact. Existing score bounds
apply; no extra schema migration is needed beyond PR #31's timing migration.

Every ordinary delivery adds a visible rib to the lantern and brings a fishing
boat past the quay during play. Six progress lamps inside the workshop show the
objective; at six, the full beacon turns. The camera fits the shop throughout.
The ending briefly pans toward the light without zooming out;
it is skippable, does not run the shift clock and cannot award extra work.
See [the experiment record](experiments/last-light.md) for actual conditions,
delegation, verification and release status.

Last Light uses edition `last-light-v2-crossings`. First-edition points and
stars are archived inside existing local saves; clear times use a new record
key while retaining the old one. The shared board labels old rows as first
edition and derives their original 4/6/8 stars. Current runs and challenge
links require the new edition. No additional database migration is required.
