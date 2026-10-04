# CHIP RUSH level design

This document describes the released starting scenarios and their current
implementation. For a new level, read [the model experiment brief](model-experiment.md)
first. Its creative freedom applies: current mechanics are not requirements for
future levels.

## Chapter: The First Shop

The current game is the beginning of an expandable journey through one small
shop. The first three levels are scenarios that teach a growing set of
decisions; they are not a fixed job hierarchy. They share one map, one machine
set, and one ruleset. Night Shift, the fourth level, keeps the same room and adds
a second map variant (see below). No further chapters, maps, or challenges
are defined here.

Stable level IDs identify scenarios permanently; display names can evolve. Legacy numeric role indices remain
compatible with saves, leaderboard records, and challenge links unless a
deliberate migration is announced. New levels append stable IDs and never
reorder the legacy indices.

| Legacy index | Stable ID | Level | Duration | Clear | Stars | Capability introduced |
| --- | --- | --- | ---: | ---: | --- | --- |
| 0 | `first-shift` | First Shift | 150s | 3 shipments | 3 / 4 / 5 | Stock, one machine route, inspection, shipping |
| 1 | `mixed-orders` | Mixed Orders | 180s | 4 shipments | 4 / 5 / 6 | Six seconds of attended CAD, overlapping orders, and optional outsourcing |
| 2 | `rush-hour` | Rush Hour | 180s | 5 shipments | 5 / 6 / 8 | Customer calls, optional rush promises |
| 3 | `night-shift` | Night Shift | 210s | 4 shipments | 4 / 5 / 6 | Deburr and Anodize finishing stations on the `night-shop` map; Covari offers a finishing process the floor lacks; no calls |

The first three scenarios use the `first-shop` map and the available Lathe, Mill,
Inspect, Office, Shipping, stock bins, Hold bench, and Receiving bench where
the scenario permits them. Deburring and Anodizing exist in the machine model
but are not available in those three scenarios. Night Shift is the first to use
them; its stations exist only on the `night-shop` map.

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

### Mixed Orders (`mixed-orders`)

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

The player manages the Mixed Orders workload while customer calls and optional
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
explicitly enabled only for Mixed Orders, Rush Hour and Night Shift. Night Shift
uses its own pool of finishing capabilities (see below); the other two use the
rotation above.

Clear means five shipments before the 180s timer ends. The three star levels
are 5, 6, and 8 shipments. Rush acceptance and outsourcing are optional paths;
neither is required for clearing or the configured star target.

### Night Shift (`night-shift`)

The phones are off and the shop is quiet. The player has run Rush Hour; now the
shop takes finishing work. Deburr (4s) and the Anodize color bath (8s) join the
Lathe (8s), Mill (10s) and Inspect (4s). CAD works as in Mixed Orders. There are
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

## Game mode: Open for Business (`open-for-business`)

A separate game mode, not a level. It is not in `SHIFTS`, has no legacy index,
and is always available from its own card on the welcome screen; it neither
needs nor grants shift unlocks. Its config is `MANAGER_MODE` and its rules live
in `dist/manager.js` (`ManagerGame` extends `ShopGame`); its record is
[experiments/open-for-business.md](experiments/open-for-business.md). The player
picks 3, 5 or 7 working days, or Endless. Each day is 150 seconds; the shop
starts with $1,500, a lathe, a mill and QC.

- **Quotes and bids.** A quote arrives three seconds into each day and then
  roughly every 6.5 to 15 seconds (faster on later days, with better
  reputation, and 25% faster once the east wing is open); at most three wait
  at once, each lapses after 18 seconds, and none arrive in the last 20
  seconds. Each names one of six fictional customers with a loyalty of 0 to 3
  (prices +4% per point; more frequent quotes). The card crosses out any step
  the floor cannot do. ◀ ▶ sets a bid from −10% to +30%: at or below list
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
  deliberately replaces the 300-point single offer.
- **Money.** Shipping pays the agreed price, plus a 10% tip if more than half
  the deadline remains (single in-house jobs only). Stock costs $30–45 once
  per part. An expired job costs 20% of its price, 0.4 reputation (0.8 if it
  was accepted while the floor lacked a process) and a point of the customer's
  loyalty. Reputation (1–5, starting at 3) scales prices and quote frequency.
- **The floor.** The shop opens with a lathe, mill and QC bench and four empty
  bays: two compact island bays (deburr, anodize, furnace, laser) and two small
  front-wall bays (furnace, laser). Clicking an empty bay opens a popover of the
  machines that fit; they install in 12 seconds during the day or are ready by
  morning. Several machines of one kind share the work. After closing, a
  machine can be sold for 70% from its label. On this map QC and Shipping part
  to leave a doorway east.
- **East wing.** $6,000 from the EXPAND sign or the Shop panel; builders open it
  the next morning (map `owner-wing`). It adds four large bays (any machine,
  including extra lathes, mills and QC benches), two small bays, a second CAD
  desk, higher staff limits, 25% more frequent quotes and 35% higher rent.
- **Wear and breakdowns.** Every finished cycle adds wear (4–11 by machine);
  worn machines run up to 40% slower. Above 55 wear a cycle may end in a
  breakdown that traps the finished part until someone repairs the machine.
  The owner repairs in 5 seconds and services an idle machine (empty hands,
  wear 15+) in 3, but only while standing there. A maintenance tech does both
  on their own (8 and 4 seconds) and services machines from 45 wear.
- **Staff.** CAD programmer (one per CAD desk), shop runners (2, or 4 with the
  wing), shipping clerk (1/2), maintenance tech (1/2) and a sales manager (1).
  Staff walk the production paths and claim tasks; runners pick the nearest free
  machine of the right kind and route around broken ones. Wages are paid each
  evening; staff can be let go only after closing.
- **Sales rules.** A strip at the start of the order rail holds the standing bid
  for new quotes, what to do with a missing process (turn away, Covari, accept),
  how many board slots to keep free and whether to take contracts. With a sales
  manager hired, every quote is answered by these rules after three seconds;
  the player can still act first.
- **Evenings and endings.** Rent (300 × 1.3^(day−1), ×1.35 with the wing) and
  wages are charged at closing; accepted work carries over, open quotes close.
  The evening ledger docks beside the floor, so bays stay clickable after
  hours. Cash below zero ends the run as bankrupt. Fixed runs end after their
  last day; Endless can retire any evening. Unfinished jobs at the very end are
  cancelled with their fees. Score is net worth: cash plus 70% resale of
  machines and upgrades and 50% of the wing, never below 0. Stars count days
  survived (3 / 5 / 7); they are shown, never used to unlock.
- **Data.** Same v8 save, with a `manager` record (best per length, longest
  Endless, last length) beside the untouched shift fields. Server runs use role
  `MANAGER_ROLE` (−1, never a level index) and rulesets `manager-v1-d3|d5|d7|endless`, each
  its own board; the `scores.days` column (migration 0002) ranks Endless by
  days then net worth. No challenge links. `validateManagerResult` bounds
  elapsed time, days, finish reason and net worth by the economy.

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
