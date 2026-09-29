# CHIP RUSH level design

This document describes the released starting scenarios and their current
implementation. For a new level, read [the model experiment brief](model-experiment.md)
first. Its creative freedom applies: current mechanics are not requirements for
future levels.

## Chapter: The First Shop

The current game is the beginning of an expandable journey through one small
shop. The three playable levels are scenarios that teach a growing set of
decisions; they are not a fixed job hierarchy. The current chapter has one
map, one machine set, and one ruleset. No specific future chapters, maps, or challenges
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

All three scenarios use the current shop map and the available Lathe, Mill,
Inspect, Office, Shipping, stock bins, Hold bench, and Receiving bench where
the scenario permits them. Deburring and Anodizing exist in the machine model
but are not available in these three scenarios.

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
explicitly enabled only for Mixed Orders and Rush Hour.

Clear means five shipments before the 180s timer ends. The three star levels
are 5, 6, and 8 shipments. Rush acceptance and outsourcing are optional paths;
neither is required for clearing or the configured star target.

## Design and release rules

- Describe each new level's implemented design and verification in its experiment
  record. Include its identity, world, objective, controls, progression, scoring,
  and ending conditions. Document machines, recipes, timers, or stars if the
  level uses them; these are not mandatory ingredients.
- Map identity is separate from scenario identity. The current implementation has one map; `mapId` is
  metadata and there is no map dispatcher yet. Do not describe an unimplemented
  map as available or invent future challenges.
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
- A different map requires renderer and navigation work in `dist/main.js` and
  `dist/assets/models.js`; changing `mapId` alone does not load a new map.
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
