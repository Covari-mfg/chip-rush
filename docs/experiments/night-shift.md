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

Rush Hour ended in noise: phones, promises, Covari offers. Night Shift is the
quiet after: the phones are off, the lights are low, and the shop has taken
finishing work it could not do before. The two stations the machine model always
had, Deburr and Anodize, finally go on the floor. The level is calmer and more
deliberate than Rush Hour by design, and is not meant to be harder.

- **World:** the same room in a night palette (darker sky and fog, cool fill,
  warm work light). A finishing island of Deburr and the Anodize color bath sits
  in the middle of the floor. The unused Receiving bench is cleared away.
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
  shipping, streak). No calls, no rush bonuses, no Covari points.
- **Covari:** no outsourcing on this level. The results card keeps its normal
  Covari message. The optional-outsourcing idea fits later levels better; on this
  one the point is that the shop now has the capability itself.
- **Controls, saves, board:** unchanged. Level 4 uses the existing v8 save,
  challenge links, ruleset `roles-v8-optional-calls` and the shared leaderboard.

## What changed

- `dist/core.js`: `SHIFTS[3]`. No engine rules changed; Deburr and Anodize were
  already in `OPS` and the interaction code.
- `dist/main.js`: a small map layer. `MAPS` (`first-shop`, `night-shop`) decides
  which stations exist and which are hidden; `activateMap` rebuilds collision
  obstacles; `applyMap` toggles station visibility and applies the theme in
  `THEMES`. The camera frame ignores map-specific stations, so the released
  levels frame exactly as before. Progress loading also unlocks the successor of
  any cleared, unlocked level (`unlockCleared`), so players who had cleared Rush
  Hour see Night Shift unlocked. Stars from friend challenges on a locked level
  never unlock anything.
- `dist/index.html`: one sentence in the help panel.
- `qa/balance.mjs`: re-activates each level's map before routing (the released
  levels' simulation output is byte-identical to `main`).
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
3. Tuning by simulation: an early guess of 210 seconds, 28 second spacing and
   4 / 5 / 6 stars gave the intended shape (below). A longer clock let
   fast serial play reach three stars, so the clock stayed at 210.

## Evidence

**Simulations** (`qa/balance.mjs` driver, production click routes, deterministic;
not player data):

| Profile | Shipped | Stars | Score | Note |
| --- | ---: | ---: | ---: | --- |
| serial, 0.5s handoffs | 5 | 2 | 3,654 | clears; ends at the clock |
| serial, 1.5s | 4 | 1 | 2,619 | clears |
| flow, 0.5s | 6 | 3 | 4,811 | finishes at 182.1s |
| flow, 1.0s | 6 | 3 | 4,299 | finishes at 205.1s |
| flow, 1.5s | 5 | 2 | | clears |
| flow, 2.0s / serial, 2.0s | 4 / 3 | 1 / 0 | | flow clears, serial does not |
| flow with dash, 0.1s | 6 | 3 | 5,264 | finishes at 167.6s |

Rush Hour, Mixed Orders and First Shift simulation rows are unchanged from `main`
(diffed before and after).

**Automated checks:** `node --test qa/*.test.mjs` passes (218 tests, 24 more than
`main`), `node qa/balance.mjs --rush --ignore-calls --expert --assert`, `pnpm build`,
`pnpm deploy:dry-run` and `git diff --check` all pass. The new tests cover catalog
identity and unchanged legacy levels, finishing routes and the shared bath, per-map
stations, reachability and non-overlap, theme registration, balance bounds,
score ceiling, hosted validation, challenge links, and save migration.

**Browser (automated, software WebGL, Chrome 148):**

- A scripted player clicked station labels for one full Night Shift on the local
  server: 6 shipped, 0 missed, score 5,281, three stars, results at 169.0 game
  seconds, no console errors or warnings. Score breakdown: Parts 1,370, CAD 720,
  early shipping 1,830, streak 1,361. Because software rendering runs the game
  slowly, the script's effective reaction time is faster than a person's, so this
  shows the UI flow works end to end. It is not a difficulty measurement.
- The released levels render the same number of draw calls and triangles as
  `main` (270 / 277 / 277 calls, 31,277 / 31,361 / 31,361 triangles) and the same
  station screen positions once the camera settles.
- The standalone `dist/CHIP-RUSH.html` opened from `file://` shows the four levels,
  starts Night Shift with the right stations, and logs no errors.
- Save behavior in the browser: a fresh save shows Night Shift locked; a save
  with Rush Hour cleared shows it unlocked; a save with Rush Hour uncleared keeps
  it locked; a friend-challenge link to level 4 shows its briefing.

**Asset provenance:** no new art, music, fonts or third-party assets. The night
palette is code (`THEMES`).

**Known limitations, not tested:** no human has played it. The night palette has
not been judged on a real display, or on touch or narrow screens. Difficulty and
fun are unmeasured. Music is unchanged from the day levels. The hosted Worker and
D1 were exercised only through the local adapter and unit tests.

## Release

Not released. Awaiting creator playtest and approval. No PR, merge or deployment
has been made.
