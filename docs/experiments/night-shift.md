# Night Shift (`night-shift`) experiment record

Legacy index 3. Fourth level, appended after Rush Hour. This is a local
development record; creator playtest, approval and release are still open.

## Identity

| Field | Value |
| --- | --- |
| Level | `night-shift` / Night Shift, map `night-shop` |
| Base commit | `def8a24` (merge of PR #15); three released levels |
| Model | Claude Sonnet 5.5, as reported by the run's system context |
| Harness | Cursor Cloud Agent (cloud VM). Harness version unknown |
| Date | 2026-09-29 |
| Delegation | None. No other models or subagents contributed |

## Conditions

| Condition | Offered / confirmed | Used |
| --- | --- | --- |
| Starting game | Full source, tests, docs. Game served locally by `scripts/dev-server.mjs` | Yes |
| Development | Git, pnpm 11.9.0, Python 3.12.3 with NumPy 2.4.4, FFmpeg 6.1.1. System Node is 22.14.0 (CI uses 22). `scripts/dev-server.mjs` needs Node 24 for its SQLite adapter, so Node 24.21.0 was installed with nvm for the local server only | Node 22 for tests and builds, Node 24 for the local server |
| Playtesting | Headless Google Chrome 148 with software (SwiftShader) WebGL, driven by Playwright-core 1.63. No GPU. Input is the game's own station-label clicks (click-to-walk), not keyboard. The game runs at roughly 25-55% of real time in this setup | Yes; no human played it |
| 3D assets | Procedural Three.js models already in `dist/assets/models.js` (Deburr and Anodize existed but were unused). Blender is not installed | No new models |
| Music and sound | Existing loop and cues. Python, NumPy and FFmpeg are available | No new audio |
| Research | Web access available | Not used |
| Human iteration | None yet; the creator has not played this build | n/a |

## Creative intent

Rush Hour ended in noise: phones and promises. Night Shift is the quiet after:
the phones are off, the lights are low, and the shop has taken finishing work it
could not do before. The two stations the machine model always
had, Deburr and Anodize, finally go on the floor. The level is calmer and more
deliberate than Rush Hour by design, and is not meant to be harder.

- **World:** the same room in a night palette (darker sky and fog, cool fill,
  warm work light). A finishing island of Deburr and the Anodize color bath sits
  in the middle of the floor, clear of the Receiving bench.
- **Objective:** ship 4 orders in 3:30. Stars at 4 / 5 / 6 shipped.
- **Orders:** Dial knob (`lathe → deburr → inspect`), Ocean collar
  (`lathe → anodize → inspect`), Satin bracket (`mill → deburr → anodize → inspect`),
  Valve body (`lathe → mill → deburr → inspect`), Satin bracket, Dial knob.
  First arrival 20s, then every 28s. Deadline 120s (+14s for the first).
  Six attended CAD seconds per order as in Mixed Orders.
- **New decision:** two orders need the single 8 second color bath. Feeding it
  early and using the wait for CAD or the next part is what separates ordinary
  from efficient play.
- **Scoring:** the shared formula (part value 180 to 270, +120 CAD, early
  shipping, streak). No calls and no rush bonuses. A completed Covari job adds 300.
- **Covari (creator decision, iteration 2):** every level includes outsourcing,
  because there is always something the shop cannot do. Adding Deburr and Anodize
  moved the gap rather than closing it: the floor still has no furnace, coating
  booth or laser. After two normal shipments the level offers one finishing job
  from that pool: Heat-treated pin (Heat treatment), Powder-coated panel (Powder
  coating) or Laser-marked plate (Laser marking). The card names the gap ("No
  furnace on this floor") and carries its own HT / PC / LM badge. The rules are
  the earlier levels' exactly: optional, 30 seconds to decide, no penalty for
  declining, 22 second delivery to Receiving, `inspect → ship`, 300 points, no order
  slot, no shipment, star or streak credit. This is a real capability gap because
  no recipe on this level, and no station, can make those parts.
- **Controls, saves, board:** unchanged. Level 4 uses the existing v8 save,
  challenge links, ruleset `roles-v8-optional-calls` and the shared leaderboard.

## What changed

- `dist/core.js`: `SHIFTS[3]`, plus `FINISHING_SOURCE_JOBS` and an optional
  per-level `sourceJobs` pool. `tickSourcing` reads `config.sourceJobs`, falling
  back to the original `SOURCE_JOBS`, so the earlier levels' offers are untouched.
  Deburr and Anodize were already in `OPS` and the interaction code.
- `dist/technology.js`: HT, PC and LM badges (original 32x32 stroke icons) and the
  short code now shows for every non-machine technology. `dist/main.js` shows the
  offer's `gap` text as the card subtitle when a job has one.
- `dist/main.js`: a small map layer. `MAPS` (`first-shop`, `night-shop`) decides
  which stations exist and which are hidden; `activateMap` rebuilds collision
  obstacles; `applyMap` toggles station visibility and applies the theme in
  `THEMES`. Night Shift keeps the Receiving bench and moves the island right so
  Deburr's access point does not share a spot with Receiving. The camera frame ignores map-specific stations, so the released
  levels frame exactly as before. Progress loading also unlocks the successor of
  any cleared, unlocked level (`unlockCleared`), so players who had cleared Rush
  Hour see Night Shift unlocked. Stars from friend challenges on a locked level
  never unlock anything.
- `dist/index.html`: help-panel copy for Night Shift and its Covari offer.
- `qa/balance.mjs`: re-activates each level's map before routing. New
  `covari: 'accept'` driver option takes the offer (instant card click), collects
  the crate at Receiving, runs QC and ships. The default still declines, so the
  released levels' simulation traces are byte-identical to `main` (18 profiles
  compared, full logs).
- Tests: new `qa/night-shift.test.mjs`; updated legacy-count assertions in
  `qa/core.test.mjs`, `qa/workflow.test.mjs` (save migration), `qa/leaderboard.test.mjs`
  and `qa/challenges.test.mjs`. Role 3 was previously an invalid index. It now
  belongs to Night Shift and the invalid-role checks use `SHIFTS.length`. One
  fixture in the save test had stars on levels 2 and 3 with only level 2 unlocked,
  which is inconsistent under the new rule, so it now uses coherent grades.
- Docs: `docs/level-design.md`, `README.md`, `ARNOLDAS-START-HERE.md`, and this record.
- `dist/CHIP-RUSH.html` rebuilt with `node scripts/build-offline.mjs`.

## Iteration log

1. Proposal: finish the deferred Deburr and Anodize stations rather than add
   another interruption layer, and change the mood with lighting instead of new
   assets. No user feedback has been received yet.
2. Placement: the back row and right column are full, and a front-row machine
   would hide the machinist from the camera. Deburr and Anodize therefore form a
   mid-floor island with the operator side facing the camera, like Lathe and Mill.
3. Creator decision after the first build: "every level must always include Covari
   outsourcing, because there is always something the shop can't do." I reversed
   the first iteration's choice to skip it. Options considered: reuse the original
   molded, EDM and sheet-metal pool (works, but those parts have nothing to do
   with a finishing level); or a finishing pool. I chose the finishing pool
   because Deburr and Anodize make the missing finishing processes the natural
   gap. Receiving returns to the night map.
4. Tuning by simulation: an early guess of 210 seconds, 28 second spacing and
   4 / 5 / 6 stars gave the intended shape (below). A longer clock let
   fast serial play reach three stars, so the clock stayed at 210.

## Evidence

**Simulations** (`qa/balance.mjs` driver, production click routes, deterministic;
not player data). "Decline" is the default and lets the Covari offer lapse; "accept"
takes it, collects the crate, runs QC and ships:

| Profile | Shipped / stars, decline | Score | Shipped / stars, accept | Score |
| --- | --- | ---: | --- | ---: |
| serial, 0.5s handoffs | 5 / 2 | 3,661 | 5 / 2 | 3,653 |
| serial, 1.5s | 4 / 1 | 2,621 | 4 / 1 | 2,604 |
| flow, 0.5s | 6 / 3 | 4,810 | 6 / 3 | 5,072 |
| flow, 1.0s | 6 / 3 | 4,303 | 6 / 3 | 4,586 |
| flow, 1.5s | 5 / 2 | 3,254 | 4 / 1 | 2,874 |
| flow with dash, 0.1s | 6 / 3 | 5,262 | 6 / 3 | 5,558 |

Flow play at 0.5s and 1.0s finishes at 181.7s and 204.6s when declining, 184.8s and
209.8s when accepting, so outsourcing is tight but fits for ordinary concurrent
play. For a slower player (1.5s) it costs a star. That makes Covari an optional
trade: +300 points against the time for a trip, a QC slot and a carried crate.
Flow at 2.0s still clears (4 shipped) and serial at 2.0s does not (3). First
Shift, Mixed Orders and Rush Hour traces (18 profiles, full logs) are identical to
`main`.

**Automated checks:** `node --test qa/*.test.mjs` passes (226 tests, 32 more than
`main`), `node qa/balance.mjs --rush --ignore-calls --expert --assert`, `pnpm build`,
`pnpm deploy:dry-run` and `git diff --check` all pass. The new tests cover catalog
identity and unchanged legacy levels, finishing routes and the shared bath, the
Covari gap (no station, badge, gap text, shared gates, delivery, QC swap, decline,
timeout), per-map stations, reachability, non-overlap and distinct access points,
theme registration, balance bounds with and without outsourcing, score ceiling,
hosted validation with one Covari job, challenge links, and save migration.

**Browser (automated, software WebGL, Chrome 148, local server on Node 24):**

- Iteration 1 (no Covari): a scripted player shipped 6, 0 missed, 5,281 points, three
  stars at 169.0 game seconds. Superseded by the run below.
- Iteration 2, full shift with Covari: the offer appeared at 70.9 game seconds as
  "Heat-treated pin", HT badge, subtitle "No furnace on this floor". The script
  accepted it, the crate reached Receiving at 93.6s, and it went Receiving, QC,
  Shipping. Result: 6 shipped, 0 missed, three stars, 5,371 points at 178.1 game
  seconds. Breakdown: Parts 1,370, CAD 720, early shipping 1,695, streak 1,286,
  Covari 300. Posting to the local board returned "Posted. Nice shift." and the board
  entry showed `sourced: 1`. No console errors or warnings.
- A first attempt at the same run stalled: the script held the crate while QC
  held a finished part and waited. That was the script, not the game; pressing
  Interact at QC swaps a carried part with a ready output, which is now a unit test
  and a rule in the script. The stalled run finished with 2 shipped and 2 missed.
- Software rendering runs the game slowly, so the script's effective reaction time
  is faster than a person's. These runs show the UI flow works end to end. They are
  not a difficulty measurement.
- The Covari decline path was covered by unit tests and simulation only; no browser
  run took Say no.
- The released levels render the same number of draw calls and triangles as
  `main` (270 / 277 / 277 calls, 31,277 / 31,361 / 31,361 triangles) and the same
  station screen positions once the camera settles (measured before the Covari change,
  which does not touch those maps).
- The standalone `dist/CHIP-RUSH.html` opened from `file://` shows the four levels,
  starts Night Shift with the right stations, and logs no errors (checked before the
  Covari change and again for the final build).
- Save behavior in the browser: a fresh save shows Night Shift locked; a save
  with Rush Hour cleared shows it unlocked; a save with Rush Hour uncleared keeps
  it locked; a friend-challenge link to level 4 shows its briefing.

**Asset provenance:** no new music, fonts or third-party assets. The night palette
is code (`THEMES`).

**Asset note (iteration 2):** three new original stroke icons (HT, PC, LM) in
`dist/technology.js`; no third-party art.

**Known limitations, not tested:** no human has played it. The icon artwork for the
three finishing badges has not been judged at real sizes. The night palette has
not been judged on a real display, or on touch or narrow screens. Difficulty and
fun are unmeasured. Music is unchanged from the day levels. The hosted Worker and
D1 were exercised only through the local adapter and unit tests.

## Release

Not released. Awaiting creator playtest and approval. No PR, merge or deployment
has been made.
