# CHIP RUSH verification

## Night Shift (level 4) · 2026-09-29 (local source, not released)

Full record: [docs/experiments/night-shift.md](../docs/experiments/night-shift.md).

- 226 automated tests pass (32 new), plus `node qa/balance.mjs --rush --ignore-calls --expert --assert`, `pnpm build`, `pnpm deploy:dry-run` and `git diff --check`. Full simulation traces for First Shift, Mixed Orders and Rush Hour are identical to `main` (18 profiles).
- Covari (creator decision: every level has it): Night Shift offers one finishing job the floor has no station for (Heat-treated pin, Powder-coated panel or Laser-marked plate, with HT / PC / LM badges and a "no furnace / booth / laser on this floor" subtitle). Rules match the earlier levels: optional, after two shipments, 22s delivery to Receiving, QC, 300 points, no slot or star credit.
- Simulation (not player data): with 0.5s handoffs serial play ships 5 (2 stars) and concurrent play ships 6 (3 stars, 4,810 points, or 5,072 after accepting Covari). At 1.0s concurrent play keeps 3 stars whether it declines or accepts. At 1.5s accepting Covari costs a star (2 stars declining, 1 accepting). Expert dash routes ship 6 at 5,262 (5,558 with Covari).
- Browser (automated, headless Chrome 148, software WebGL, station-label clicks): a full shift accepted the Covari offer at 70.9 game seconds, received the crate at 93.6s, ran QC and shipped it, and finished with 6 shipped, 0 missed, 3 stars and 5,371 points (Covari 300 in the breakdown) at 178.1s. The score posted to the local board with `sourced: 1`. No console errors. A first attempt stalled because the script held the crate while QC was occupied; pressing Interact at QC swaps them, which is now a unit test. Software rendering runs the game slower than real time, so this proves the UI flow, not difficulty. No human has played it. The decline path was tested only by unit tests and simulation.
- Released levels render the same draw calls and triangles as `main`. Standalone `CHIP-RUSH.html` from `file://` starts Night Shift with the finishing stations. Save unlock behavior and a level-4 friend challenge were checked in the browser.
- Untested: real-display look of the night palette and new badges, touch and narrow screens, human difficulty, hosted D1 outside the local adapter.

## CAD and rush balance · 2026-09-27 (local source)

- Manager and Owner now require one six-second CAD step at the office before Material. Every delivered advanced-role job earns 120 CAD points before the ordinary streak multiplier. CAD progress survives walking away and completed CAD survives recycling. Operator timing, scoring, recipes, and 3/4/5 stars remain unchanged.
- Manager has at most six arrivals, with a 16-second second arrival, then 25-second spacing; stars are 4/5/6. Its sequence is spacer, plate, housing, spacer, plate, housing. Owner has at most eight arrivals, with a 12-second second arrival, then 18-second spacing; stars are 5/6/8. Its sequence is spacer, plate, housing, spacer, housing, plate, housing, plate. Both use the existing four-active-order cap and safe closing-time fallback.
- All three Owner calls remain scheduled at 27, 77, and 127 seconds. Any live offer can be accepted, including started, combined-route, or congested work. The separate promise is at most 45 seconds, bounded by the ordinary deadline and closing time. Success adds 100 points; an accepted promise missed through timeout, ordinary expiration, or closing deducts 25 once, clamped at zero. Declining adds no missed-promise penalty.
- **169 automated tests pass**, including 62 no-dash Operator timing profiles, full CAD → Material → machines → Inspection → Shipping traces, all rush failure exits, and legal Owner mastery under both decisions. `node qa/balance.mjs --expert --rush --assert` also passes.
- **The tables below are deterministic simulations, not browser playthroughs or measured human success rates. Browser verification is recorded separately below.** The harness uses production A* paths, collision boundaries, 4.4 walking speed, six attended CAD seconds, real machine durations, three-second conversations, and legal straight-segment dashes with the production cooldown. No sourcing bonus is taken in these profiles. No publication was performed for these checks.

### Reproducible outcomes

Reaction values below are the added delay after an interaction. Flow overlaps CAD, machines, and downstream work; serial finishes one order at a time. Final idle means the empty end of a shift after every remaining order has resolved; unfinished work reports zero final idle.

| Profile | Shipped / arrivals | Stars | Points | Missed / unfinished | Last shipment | Final idle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Operator, serial, 3s, walk | 5/7 | 3 | 1642 | 0 / 2 | 148.50s | 0.00s |
| Operator, serial, 0.5s, walk | 7/7 | 3 | 3533 | 0 / 0 | 141.44s | 8.56s |
| Manager, serial, 0.5s, walk | 5/6 | 2 | 3252 | 0 / 1 | 152.44s | 0.00s |
| Manager, flow, 0.5s, walk | 6/6 | 3 | 4376 | 0 / 0 | 160.24s | 19.76s |
| Manager, flow, 1s, walk | 6/6 | 3 | 4023 | 0 / 0 | 171.55s | 8.45s |
| Owner, flow, 0.5s, walk, decline | 5/8 | 1 | 3052 | 1 / 2 | 145.09s | 0.00s |
| Owner, flow, 0.5s, walk, accept all | 6/8 | 2 | 3961 | 1 / 1 | 170.20s | 0.00s |
| Owner, flow, 0.1s, dash, decline | 8/8 | 3 | 5903 | 0 / 0 | 168.91s | 11.09s |
| Owner, flow, 0.1s, dash, accept all | 8/8 | 3 | 6154 | 0 / 0 | 173.08s | 6.92s |
| Owner, flow, 0.3s, dash, decline | 8/8 | 3 | 5658 | 0 / 0 | 173.57s | 6.43s |
| Owner, flow, 0.3s, dash, accept all | 8/8 | 3 | 5922 | 0 / 0 | 169.92s | 10.08s |

| Owner profile | Calls answered / received | Rushes accepted | Won | Missed | Penalty points |
| --- | ---: | ---: | ---: | ---: | ---: |
| Owner, flow, 0.5s, walk, decline | 3/3 | 0 | 0 | 0 | 0 |
| Owner, flow, 0.5s, walk, accept all | 3/3 | 3 | 2 | 1 | 25 |
| Owner, flow, 0.1s, dash, decline | 3/3 | 0 | 0 | 0 | 0 |
| Owner, flow, 0.1s, dash, accept all | 3/3 | 3 | 3 | 0 | 0 |
| Owner, flow, 0.3s, dash, decline | 3/3 | 0 | 0 | 0 | 0 |
| Owner, flow, 0.3s, dash, accept all | 3/3 | 3 | 2 | 1 | 25 |

Ordinary Manager flow clears all six jobs with 0.5–1 second decisions and no dash, while serial 0.5-second work finishes five. Owner flow with ordinary 0.5-second walking decisions clears with either rush choice but does not reach three stars. Practiced 0.1- and 0.3-second dash profiles ship all eight under both choices; slower 0.75- and 1-second dash profiles remain below mastery. This supports an accessible introduction and a distinct Owner challenge without claiming a human learning curve.

Under the same 0.1-second dash profile and declining every rush, score potential is Operator **3811**, Manager **4565**, Owner **5903**. Manager ships six versus Operator's seven but gains CAD and complex-route value. Owner also handles all three conversations. Bonuses are not required for its third star.

### Browser verification of the revised workflow

Completed shifts in the in-app browser using a local-only controller over the production game, renderer, movement, collisions, and station actions. Playback ran at 4× wall-clock speed through substeps no larger than 50 ms. It did not alter scores, rules, positions, machine durations, or order deadlines. No scores were posted. The controller and its controls remain outside the release folders.

| Browser run | Controls | Shipped | Stars | Score | Missed / unfinished | Calls / rushes won |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Production Manager | 0.5s decisions, walking only | 6 | 3 | 4,360 | 0 / 0 | n/a |
| Owner | 0.1s decisions, normal legal dashes | 8 | 3 | 6,220 | 0 / 0 | 3 / 3 |
| Owner recovery | 0.5s decisions, walk; first offer read for 8s | 6 | 2 | 3,549 | 1 / 0 | 3 / 2 |

- Every shipped order in both captured event logs completed CAD, then picked up material, then followed its cutting and inspection route before shipping. Manager's last shipment was 159.701s; Owner's was 169.791s.
- Owner accepted rush #102 at 32.327s while #102 was still running in the mill; #105 at 82.251s while the lathe and inspection were occupied; and #108 at 135.278s while both CNC machines were occupied. All three acceptance calls succeeded and all three rushes shipped within their promises.
- In the slower Owner recovery run, rush #105 timed out at 127.839s and deducted exactly 25 points, then shipped normally at 135.646s for 713 points. The player still cleared Owner with two stars; the results breakdown showed `Missed rushes -25`, with all three conversations answered. No browser warning/error logs were reported.
- Observed the expanded five-/six-step cards wrapping legibly, the office/material guidance, both closing result screens, and a subsequent new shift. Screenshots and full event logs were saved locally, excluded from release source.
- The rebuilt standalone HTML rendered and ran Operator through material pickup, lathe load, and completed machining. Its visible Material checkmark and next inspection step were correct; no warning/error logs were reported in that smoke check.
- These automated input playthroughs prove attainable outcomes. They do not establish human completion rates or guarantee that every routing strategy earns three stars.

### Per-order evidence

Times are seconds into the shift. CAD is its completion timestamp; machine columns are actual loads, followed by their real processing and collection. An n/a machine entry means it is not on that order's route. The checks require exactly one CAD completion, Material pickup, every declared machine in order, Inspection, and Shipping for each delivered job.

**Manager: ordinary 0.5-second concurrent walking, six shipments, 4376 points.**

| Order | CAD complete | Material pickup | Lathe load | Mill load | Inspection load | Shipped |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 101 Pocket spacer | 8.34 | 9.86 | 11.06 | n/a | 27.39 | 34.70 |
| 102 Mounting plate | 23.45 | 30.13 | n/a | 32.16 | 54.06 | 61.43 |
| 103 Bearing housing | 50.15 | 56.80 | 57.99 | 69.27 | 83.34 | 88.73 |
| 104 Pocket spacer | 77.94 | 79.47 | 80.66 | n/a | 93.09 | 107.16 |
| 105 Mounting plate | 102.48 | 109.88 | n/a | 111.91 | 128.29 | 135.66 |
| 106 Bearing housing | 124.38 | 131.03 | 132.22 | 143.50 | 154.85 | 160.24 |

**Owner: practiced 0.1-second dash, accept every rush, eight shipments, 6154 points, three conversations and three rushes won.**

| Order | CAD complete | Material pickup | Lathe load | Mill load | Inspection load | Shipped |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 101 Pocket spacer | 7.74 | 8.56 | 9.36 | n/a | 21.59 | 27.00 |
| 102 Mounting plate | 19.05 | 23.63 | n/a | 24.96 | 41.16 | 47.23 |
| 103 Bearing housing | 38.65 | 43.20 | 43.99 | 58.30 | 75.84 | 85.80 |
| 104 Pocket spacer | 56.48 | 59.63 | 60.43 | n/a | 88.77 | 101.97 |
| 105 Bearing housing | 73.33 | 90.80 | 91.30 | 104.22 | 115.78 | 121.28 |
| 106 Mounting plate | 98.69 | 117.51 | n/a | 118.85 | 139.28 | 144.69 |
| 107 Bearing housing | 112.19 | 113.01 | 113.81 | 156.75 | 168.39 | 173.08 |
| 108 Mounting plate | 129.74 | 141.32 | n/a | 142.65 | 154.30 | 159.78 |

## Historical verification

Entries below describe their named older builds. Their ten-shipment targets, four-second programming, capacity-gated rushes, and earlier browser results do not describe the CAD/rush revision above.

## Release recheck for coworker review

- Re-ran all 65 core, difficulty, and production-controller runtime tests: passed. All four frame profiles shipped ten, answered all three calls, missed zero, and won at least one rush. Full balance assertions passed with star targets unchanged.
- Executed the production save/results functions with stub storage: demonstration mode produced zero storage writes and preserved existing best scores, grades, and role unlocks; the normal-play control saved correctly.
- This recheck is accelerated automated simulation, not a new human success-rate measurement. The observed browser three-star result is recorded below.

## Version 2.4: compact shop, three Owner calls, seated office work

- Compacted the physical floor to 17.4 × 10.1, enlarged both CNC machines 14%, turned Material toward the aisle, and grouped west-facing Inspection and Shipping along the right side. Packing cartons, floor markings, and relocated props fill purposeful edge space. All seven access points and all 42 directed station routes are clear; station model bounds do not overlap.
- Removed the redundant office programming panel. Programming remains on the ticket and Office label. The sidebar only opens a phone panel during ringing, the mandatory conversation, and the offer decision.
- Owner calls are scheduled at 27, 77, and 127 seconds, regardless of spare rush capacity. Calls queue behind an active call/rush, with ten seconds of recovery. Rush acceptance remains capacity checked, and declining preserves ordinary deadlines and score.
- Completed a full normal-speed browser demonstration with the compact layout: **10 shipped, 4,173 points, 0 missed, 0 unfinished, 3 calls answered, 1 rush bonus, three stars**. The result panel confirmed every count. No timing, shipment, score, or position overrides.
- Browser-checked the new layout at the ordinary 1591 × 1107 window and 900 × 600. Shop stays to the right of the orders and the whole floor remains visible. Restored the normal viewport.
- Added a smooth sit/stand animation for office programming and calls, bent knees, typing arms, a seated phone pose, and a fitted chair/footrest. Sitting changes presentation only; movement/collision, office presence, and all operation times remain unchanged. Browser-observed seated programming, then standing at the lathe. Hips meet the cushion, thighs clear the desk, and the chair base clears the raised office floor.
- **65 checks passed** across core, difficulty, and live-controller runtime tests. All four runtime frame profiles earn ten shipments, zero missed orders, answer all three calls, and win a rush. Balance assertions passed without weakening targets: expert decline 10 at 172.80s; expert accept 10 at 177.19s; ordinary flow 6 decline / 7 accept; serial 5; ignoring calls 4.
- Historical observations below describe prior versions. The same local-file validation boundary remains: the observed full browser run used HTTP; the standalone bundle is rebuilt and syntax checked.

## Version 2.3: watchable three-star Owner demonstration

- Added `?watch=owner`, a visible automated expert demonstration using the existing station, selection, phone, and dash actions. It reads live machine countdowns and anticipates when an output will be ready by arrival. No score, shipment, position, timer, or rule overrides. No saved score/grade/unlock writes in watch mode.
- Completed an uninterrupted, normal-speed run in the actual browser/3D renderer: **10 shipped, 4,091 points, 0 missed, 0 unfinished, 1 rush bonus, three stars**. The result panel showed “You run this shop” and `3 out of 3 stars`. All ten orders were already shipped when the HUD showed three seconds left.
- Observed opening programming, accepted rush, machine overlap, the sixth shipment, the tenth shipment, and the final result. Browser error/warning log was empty.
- The demonstration was replayed after the completed run; a fresh Owner shift showed score/shipped reset and normal machine progress. Left the replay available in the visible browser.
- The demonstration is explicitly labeled automated, uses a 60ms decision interval, and is a live replayable run rather than a prerecorded video. It demonstrates a legal winning route, not a human-completion-rate estimate.
- **61 tests passed**: existing 57 checks plus four demo checks using actual production movement/core code at 60, 30, 20 fps and uneven rendering frames. Each naturally ends after 180 game seconds with ten shipments, zero misses, and a successful rush.
- Standalone build regenerated and syntax checked. The previous local-file browser-policy validation boundary still applies; the full observed run used HTTP.

## Version 2.2: accessible clears, distinct mastery targets

- Shipment targets are now Operator **3 / 4 / 5**, Production Manager **4 / 6 / 7**, and Owner **6 / 8 / 10**. First-star targets also clear each role. Score and rush bonuses never substitute for shipments.
- Owner supplies work at 15-second intervals after its first 12-second arrival, retaining the four-order cap and closing-time feasibility check. Ordinary deadlines are 105 seconds, giving room to recover while ten shipments still requires an exceptional sustained pace.
- All targets are shown before clock-in, the HUD advances to the next star, and results report the next target. Owner three stars has distinct result copy and styling.
- Save v3 keeps existing role unlocks and starts fresh scores/ratings for the new balance. The v2 record remains intact. Browser migration notice appeared; earned Operator three stars and Owner two stars survived reload.
- Full Operator browser playtest: **6 shipped, 2,021 points, 0 missed, 0 unfinished, three stars**. Finished and restarted to a clean shift.
- Full revised Owner browser playtest: **8 shipped, 2,777 points, 0 missed, 1 unfinished, two stars**. No rush bonuses, normal visible controls, real walking/programming/machine cycles, one initial desktop Shift dash. Paused between tool batches; no clock acceleration, teleports, or score injection. Result said “2 more shipped orders for 3 stars (10 total).” Restart reset the clock to 3:00 and all counters/machines.
- Browser error/warning log was empty. Owner briefing was inspected at 390 × 844 and 320 × 740 with no page-width overflow. Fixed autofocus scrolling the narrow briefing past its heading; it now opens at scrollTop 0. Viewport override was reset after testing.
- Click routes now remove unnecessary A* grid waypoints using the real collision rules. A dash stops at the next corner/destination and consumes exactly 0.2 seconds of boost even across uneven frames. This makes the mastery proof usable with desktop station clicks plus timed Shift, as well as directional controls.

### Current automated checks and balance boundary

`node --test qa/core.test.mjs qa/difficulty.test.mjs`: **57 passed, 0 failed**. Includes 46 core regressions, difficulty separation and repeatability, all spawn/station route pairs, and actual production movement at 60 Hz, 37 ms, and 50 ms frames.

`node qa/balance.mjs --expert --assert` uses production paths, collision boundaries, real operation/program/call times, 4.4 walking speed, and legal 11-speed/0.2-second dashes with 1.3-second cooldown. Expert profile allows 0.1 seconds per decision; normal flow allows 0.5 seconds and does not dash.

| Owner profile | Shipped | Missed | Last shipment | Stars |
| --- | ---: | ---: | ---: | ---: |
| Normal concurrent flow, decline | 7 | 0 | 170.76s | 1 |
| Precise click routes and dash, decline | 10 | 0 | 178.58s | 3 |
| Precise click routes and dash, accept | 10 | 0 | 177.06s | 3 |

Slower expert execution at 0.3 and 0.5 seconds per decision remains below three stars. Deliberate serial Operator play can earn three stars; Manager mastery requires overlapping work in the tested profiles. These are reproducible simulations establishing attainability and separation, **not measured human completion rates**. Real players are needed to validate the intended learning curve and rarity. The ten-shipment proof is simulated; the browser Owner run above earned two stars.

The standalone file was rebuilt and syntax checked with all assets embedded. Direct local-file browser launch remains unverified because of the earlier browser policy boundary; HTTP playtests use the same game source. Older observations below describe previous tuning, not the current star targets.

## Previous 2.1 role edition: orders, larger shop, interrupting calls

- Permanent desktop rail: oldest order first, office controls and carry panel on the left, shop in the main right area. Full miniature shell is framed without cutting off the floor. Removed deburring/anodizing models, labels, and collision obstacles. Shipping replaces Dispatch throughout gameplay. Hold Bench remains a usable one-part buffer.
- Essential card, office, carrying-detail, and station text uses at least 13.5 CSS pixels. Four orders were verified in ascending sequence `[101,102,103,104]`; keyboard 4 revealed the fourth card fully in the 900 × 600 rail (scrollTop 415).
- Zero visible card/station-label or footer/station-label intersections and no horizontal page overflow at 1300 × 900, 900 × 600, 390 × 844, and 320 × 740. Visually inspected the large desktop shop, compact desktop rail, mobile call/offer, and the active Hold Bench. Narrow-screen ticket height was increased to contain wrapped route labels and rush badges at the fixed readable font size.
- Verified Hold Bench by parking programmed order #101, observing empty hands and its parked status, retrieving that same part, and loading it into the lathe.
- Owner call blocked a deliberate attempt to walk back to the lathe; the UI said to finish the customer call first. The character stayed at the desk with the phone, the three-second call completed, and the offer appeared. Pausing froze the conversation with the other game clocks.
- Full revised Owner browser run: **8 shipped, 2,796 points, 0 missed, 0 unfinished, 1 rush accepted and won, three stars, Owner cleared**. Normal visible controls, real walking and machining, no acceleration, score injection, teleport, or hidden unlocks. Paused between inspection/tool batches.
- Retried after the completed shift and verified the role selection/save. These are browser observations; the simulation below is separate.

### Final regression and balance results

`node --test qa/core.test.mjs`: **46 passed, 0 failed**. Additional checks cover blocked handoffs, exactly three seconds of conversation, continuing machine/deadline clocks, suspended programming, timeout recovery, and accepting a rush without silently resuming an old program.

`node qa/balance.mjs --rush --ignore-calls --assert` uses actual production A* routes and collision/access points, 4.4-unit walking, attended programming/calls, no dash, and a 0.5-second interaction allowance:

| Owner strategy | Shipped | Result |
| --- | --- | --- |
| One job at a time, answer/decline | 4 | Fail |
| Concurrent work, answer/decline | 7 | Clear |
| Concurrent work, accept rush | 7 | Clear, one rush bonus |
| Ignore calls | 5 | Fail |

The target remains six shipments; a rush bonus is not required to clear. Ignoring a call blocks work until it lapses, so it has a real time cost. Operator and Manager concurrent simulations shipped six and seven respectively. These scripted results establish feasibility, not a claim that all new players will achieve the same result.


## Initial role edition, before the final phone and layout changes

Normal controls, real walking and machine cycles, no clock acceleration, teleporting, score injection, or hidden unlock changes. Paused between review/tool batches; all game clocks freeze together.

### Observed browser progression

- Operator completed at 3 shipments / 545 points and unlocked Production Manager. That initial automation used slow agent-tool round trips; it is a controls/progression check, not a human timing benchmark.
- Production Manager completed at 6 shipments / 2,130 points / 0 missed / 1 unfinished, earning two stars. Programmed at the actual desk, carried physical parts, ran machines concurrently, and completed the new turn → mill → inspect route. The Owner unlock persisted after reload.
- First Owner attempt completed at 5 shipments / 1,184 points / 1 missed, correctly failed the 6-order target, and offered a clean retry.
- Improved Owner retry prepared queued programs during machine cycles: 7 shipments / 2,261 points / 0 missed / 1 unfinished, two stars, Owner cleared. One rush was accepted and its bonus missed; the ordinary RFQ still shipped.
- A separate Owner replay answered the #103 call, accepted the offer at the desk, programmed and machined it, shipped an older order in between, and then won the rush bonus. Snapshot: 3 shipments / 951 points / 0 missed / streak 3 / 1 rush accepted / 1 rush won.
- Accepted rush selects its RFQ in the UI. Separate normal and bonus deadlines remain visible. Role help returns to the briefing even after repeated Help clicks. Programming pauses while away and resumes with preserved progress. Returning to role selection leaves a fresh start available.
- No browser console errors or warnings observed after the completed Owner run.

### Responsive checks

- Visually inspected Manager gameplay at 900 × 600 and the live Owner offer at 800 × 500 and 390 × 844.
- Measured zero visible ticket/station-label and footer/station-label overlaps at 800 × 500, 390 × 844, and 320 × 740; no horizontal document overflow. The offer strip reserves space through the existing camera-fit and footer observer.
- Disabled deburr/anodize labels are hidden during these roles. Their dimensional equipment remains in the workshop.
- Restored the browser viewport and left role selection ready for the user.

### Deterministic simulation

`node --test qa/core.test.mjs`: **41 passed, 0 failed**. Covers programming presence/progress/selection, raw stock gating, recycling, calls, exactly-once bonus, decline/miss fairness, all clock pauses, cancellation, closing, reset, ownership, safe arrivals, and role pass targets.

`node qa/balance.mjs --rush --assert` uses production A* paths, collision/access points, 4.4-unit walking, no dash, real machine/program times, and 0.5 seconds per interaction:

| Role | Serial shipments | Concurrent shipments |
| --- | --- | --- |
| Operator | 6 | 6 |
| Production Manager | 5 | 7 |
| Owner | 5 (fail) | 7 (clear) |

Owner concurrent play with rush acceptance also shipped 7 and earned one bonus. At a 1-second action allowance, concurrent Owner reached 6 versus serial 4. With practiced 0.15-second input allowance, all three-star targets were reached by at least one strategy, including Owner at 8. These are reproducible simulations, not browser observations or a substitute for broader player testing.

## Earlier version verification (historical)

The notes below cover the original manufacturing-process progression, which the role edition replaces.

## Follow-up: ticket clearance in smaller windows

- Reproduced tickets covering the lathe at 900 × 600 as additional RFQs arrived.
- Added a dedicated scrolling ticket column for short landscape windows and fitted the orthographic camera to the available gameplay area. Other layouts reserve space beneath the ticket row. Camera orientation, movement axes, and full-canvas pointer coordinates remain unchanged.
- Measured zero visible ticket/station-label intersections and no page overflow at 900 × 600, 800 × 500, 1440 × 900, and 390 × 844. Four simultaneous tickets were checked in both compact landscape sizes.
- Verified keyboard selection of the fourth ticket scrolls it fully into view at 800 × 500 (rail scrollTop 187).
- Completed an Ocean collar through turning, anodizing, inspection, and shipping while resizing between 900 × 600 and 800 × 500: one shipment, 328 points. Console inspection returned no errors or warnings.
- Regenerated the standalone HTML and complete source ZIP; JavaScript syntax and archive integrity checks passed.

Verified September 25, 2026. Browser playtests used the actual rendered game and its normal visible controls. No teleporting, score injection, accelerated shift clock, or completion shortcut was used.

## Live play

- Finished the full 150-second first shift: **6 shipped, 1,626 points, 0 missed deadlines, 1 unfinished order, 2 stars**.
- Ran the lathe and mill simultaneously and moved parts into inspection and dispatch while other machines worked.
- Clicked **Next shift** from the results. Shift two began at 3:00 with empty hands, empty stations, and zero score.
- Paused during lathe operation. The shift remained at 2:50 and lathe at 8 seconds during unrelated work; resume continued the same operation.
- Completed and shipped a shift-two Dial knob through turning, deburring, holding, retrieval, inspection, and dispatch.
- Observed canceled orders being removed and the shop continuing to accept new RFQs. Let shift two close and verified the third shift unlocked and persisted through page reload.
- In shift three, completed and shipped an Ocean collar through turning, anodizing, inspection, and dispatch, and a Satin bracket through milling, deburring, anodizing, inspection, and dispatch. These two shipments scored 649 combined in that playtest.
- Used the keyboard E action at Material to recycle a carried part, then collected a new billet for the same RFQ and completed its route.
- Verified a Shift dash changes the player position and Escape opens the pause screen.
- All eight station access points were reached through the real pathfinding and collision system.
- Browser console inspection after these flows returned no warnings or errors.

## Layout and assets

- Visually inspected desktop title, active shop, animated machining, finished outputs, carried parts, and results.
- Inspected 390 × 844 gameplay and 320 × 740 title/gameplay layouts.
- Fixed clipping on five-step RFQs. At 320px, the four-step and five-step route rows had equal client/scroll widths (156/156 and 210/210); document width did not overflow.
- Static geometry constructors checked for finite dimensions. The rendered scene reported approximately 34,480 triangles and 254 draw calls at idle.
- Original geometry is used for the shop, machine internals, office, tools, parts, and articulated character. Machine lights and process pivots animate independently of static batches.

## Simulation checks

`node --test qa/core.test.mjs`: **29 passed, 0 failed**.

Coverage includes every available recipe in each shift; part ownership; wrong-operation and locked-station rejection; repeated input; pause; expiration from raw material, hands, buffer, processing and output; recycling at every route stage; recovery from the full-hands/occupied-bench jam; late-arrival recipe substitution; ticket limits; single end-of-shift emission; and clean reset.

## Optional agent tools

The browser registered `get_shop_state` and `start_walk_to_station` with the expected schemas and annotations. The read action returned live state. A valid material-station walk caused normal movement and visible pickup. Invalid station input was intentionally rejected with `Choose a valid workshop station` without changing the game.

## Delivery boundaries

- The modular game was browser-tested on the local HTTP server. It has not been published to an external host.
- `dist/CHIP-RUSH.html` is a generated single-file edition, with CSS, Three.js, models, logic, and audio embedded. Its JavaScript syntax and asset references were checked. The automated browser blocks direct `file://` navigation, so direct double-click launch was not verified in that browser. No browser-policy workaround was attempted.
- Small-screen layouts were tested using viewport overrides. Physical mobile touch hardware and every browser/GPU combination were not tested.

## Community update · 2026-09-25

- Real browser playtest completed an Operator shift with the optional Wire EDM job. The two-second office approval and partner delivery awarded exactly 60 points and no shipment or star credit. Regular work still accepted lathe loads. The closing screen showed that actual result and a second shift started normally. This run tested UI and sourcing rather than a high-scoring route.
- Posted that result as Local QA to the local SQLite board, observed the saved 60-point entry and disabled repeat-post button. Nothing was posted to the public board during QA.
- Opened a valid Owner challenge (10 shipped, 4,173 points), saw its target and Owner briefing, then returned to ordinary selection and verified Operator remained selected with Manager/Owner locked.
- Visually checked the live layout at 1000×700 and 390×844. Selection badges and instructions are visible; desktop keeps the shop to the right and narrow screens scroll cards above it.
- The complete 103-test suite includes sourcing, challenge parsing, social async/cancellation flows, API ownership/validation/idempotence, and four actual-movement Owner demo profiles. Full difficulty assertions retain the normal ten-shipment, three-call Owner proof.
- Public scores are player-reported with server-side bounds/ownership checks, not verified anti-cheat results. Native sharing is OS-dependent; a visible challenge link and explicit Copy button remain available when sharing is cancelled or unsupported.


## Unified performance scoring and Covari review · 2026-09-25

- One top-30 leaderboard now combines all roles, without a role filter or role labels. Actual earned points are posted unchanged; the game has no fixed score ceiling or role multiplier. More complex parts, early shipping, CAM, streaks, completed calls and rush deliveries supply the points. Results show the component totals.
- All 124 automated tests pass. New scoring checks cover quarter-second speed differences, complexity, CAM credited only on shipment, call rewards credited once, score totals beyond the discarded role caps, and reset/breakdown consistency. Unified API and challenge tests include validation, preserved migrations, sorting, cross-role comparisons and local-only links.
- Full difficulty assertions remain green. Expert Owner simulations ship ten orders, answer all three calls and earn three stars with zero missed deadlines: 6,503 points with declined rushes and 6,654 when accepting available rushes. Operator flow scores 3,654 and Manager flow scores 4,688. Four actual-movement demo profiles also pass. These demonstrate attainability, not measured human completion rates.
- Browser review verified the actual Covari logo, all-role bonus card, selecting Outsource with Covari before clicking the office computer, seated office approval, partner delivery, and a 60-point bonus. Challenge a friend exposed a copyable local invitation with an explicit same-computer notice; it did not silently redirect to the older public build.
- The new score season preserves earlier board data outside the current rankings. Local v4 unlocks and stars are carried forward, while personal scores reset for the changed formula. No deployment was performed.
- A fresh browser run under `roles-v5-performance` completed one ordinary part and finished the full shift. Results showed 177 points = Parts 120 + Early shipping 57; the friend link carried exactly 177, and the local board accepted and displayed exactly 177. The board had no role picker or role label and the repeat-post button was disabled. Browser console showed no warnings or errors. This was a UI/scoring check, not a mastery run.


## Covari brand and live sequential review · 2026-09-25

- Compared the live Covari website header: its C uses `/brand/covari-logo.png`, and its wordmark uses Instrument Sans at weight 700. The game now uses that canonical C with a locally bundled Instrument Sans font, a clean light brand header, and the font’s SIL Open Font License. Browser checks confirmed the font and logo loaded and the brand header had no horizontal overflow. The standalone edition embeds the font.
- Added `?watch=sequence` for ordinary-input Operator → Production Manager → Owner review. It shows the Covari offer, selection, office approval, partner delivery and customer replies. Each results screen waits before starting the next role. It does not record video, alter clocks/positions/scores, save personal records, or post scores. Individual role review links remain available.
- Live browser Operator review finished its full normal-speed shift: 7 shipments, 3,882 points, three stars, zero missed, zero unfinished, and Covari delivered.
- Live browser Production Manager review then finished: 7 shipments, 5,131 points, three stars, zero missed, zero unfinished, and Covari delivered. Its result breakdown included Parts 1,100 + CAM 420 + Early shipping 2,126 + Streak 1,425 + Covari 60.
- Live browser Owner review finished third: 10 shipments, 6,760 points, three stars, zero missed or unfinished, all three calls answered, one rush bonus, and Covari delivered. Its breakdown was Parts 1,500 + CAM 600 + Early shipping 2,443 + Streak 1,982 + Rush 100 + Calls 75 + Covari 60. These were visible automated normal-input playthroughs at normal speed, not recordings or score injections.
- Added three cosmetic Covari order types during the live review: Injection molding, Wire EDM insert and Sheet metal assembly. The current run was allowed to finish before reloading these names. All 144 automated tests pass, including variant rotation in every role, no rotation before an actual offer, identical timing/rewards/ordinary-work traces, and all-role sequential demos.
- After reloading the new variant build, the first actual offer displayed Injection molding with the Covari font/logo and proceeded through office approval into the partner-delivery countdown. The live card remained legible and contained within its sidebar.

## Manufacturing technology badges · 2026-09-25

- Added matching turning and milling icons to order cards and the Lathe/Mill station labels. Orders with both operations display both badges; Covari cards identify wire EDM, injection molding and sheet metal assembly with distinct icons and EDM / IM / SM labels. Full technology names remain available through assistive text and tooltips.
- Browser review confirmed the turning/milling card-to-machine pairing and the Injection molding card with its IM badge. At 1000 × 700, the document and cards had no horizontal overflow, and the Lathe/Mill label rectangles did not overlap. Restored the normal viewport after this check.
- All **148 automated tests pass**, including technology mapping and source-badge update caching. The three full normal-speed browser playthroughs recorded above remain the gameplay evidence; the subsequent icon previews were partial shifts, not additional completion runs. Icon artwork changes do not change operations, timing or scoring.

## Game-only release and leaderboard layout · 2026-09-25

- Preserved the automated review in a separate local-only checkout, then removed the controller, watch UI and demo bundling from the GitHub/runtime source and handoff documentation. Old watch query parameters now open the ordinary playable game. Earlier demonstration records above remain historical local playtest evidence.
- Added a start-page top 10 and enlarged the centered end-of-shift leaderboard. Both render actual server scores as text, and empty boards remain empty. A finished result appears with the optional posting form.
- Created clearly labeled local-only icon and sample-score previews outside the release repository. The user approved both EDM and sheet metal icons. Neither sample scores nor preview pages are shipped or added to the public database.
- 139 automated tests pass, including normal scoring on old watch URLs, top-10 slicing, complete-board retention and empty-state behavior.
- The headless balance check still reaches three stars in all roles; expert Owner ships ten orders with zero misses and answers all three calls. These are QA simulations, not a shipped watch mode.
- Checked game-only modular, standalone, hosted and portable ZIP outputs for removed controller code and local preview/sample assets. The 44-file handoff ZIP passed integrity checks.
- Browser verification of an old `?watch=owner` link showed normal role selection and player-driven material collection. Both sample leaderboard views were reviewed locally; sample API replies exist only in that separate preview copy.

## Country music release · 2026-09-25

- Replaced the light synthesized rhythm with the selected original 104 BPM country/bluegrass arrangement. The 16-bar MP3 loop is bundled locally and embedded into the standalone HTML. No external music service is used.
- Background gain is 0.156 of the audition (about 16 dB lower), dropping to 0.04368 during ringing, answering and rush-offer states. Existing machine and feedback cues keep their own levels.
- Music transport stops synchronously for pause, help, menu and results, including background-tab pauses; resume retains loop position. Delayed decoding cannot start a paused track, and failed music loading does not prevent gameplay or cues.
- Removed the sound button and binding. The clock-in and resume gestures initialize audio.
- Browser audio verification decoded the MP3 as two channels and 36.92308333 seconds, matching the intended loop within one output sample, and observed a running source beyond its first loop boundary. Pause/resume and phone ducking were checked. This is playback/transport verification, not a claim of subjective listening quality.
- 145 automated tests pass, including six audio lifecycle checks and the existing scoring, sourcing, leaderboard, and difficulty tests. The earlier gameplay balance results remain applicable: no rules, timing or scoring changed.

## Operator arrival pacing · 2026-09-25

- Moved Operator's second order from 12 to 18 seconds and its subsequent interval from 21 to 19 seconds. This gentler opening leaves enough late-shift headroom for the existing seventh order to pass the shared safe-arrival check. It does not add an eighth order, change recipes or alter shipment scoring/star targets. Manager and Owner settings are unchanged.
- Baseline ordinary serial no-dash play (0.5s handoffs) received six jobs and ended with 28.11 empty seconds. The adjusted run receives and ships seven, leaving 8.56 seconds. Ordinary concurrent play ships seven with 15.96 seconds left. Very efficient players can still finish early; this does not promise zero idle time.
- Across 62 serial/concurrent no-dash profiles with 0–3s handoff delays, every adjusted run receives seven orders, ships at least five and misses no deadlines. The longest genuinely empty ending is 18.61s, compared with 31.02s before. These are deterministic simulations using production walking routes, not human completion-rate estimates.
- 146 automated tests pass. Movement-aware all-role balance assertions and both legal ten-shipment, three-call Owner mastery routes pass unchanged.
# October 1, 2026: automatic mobile interface selection and thumb controls

- Built from Arnie's latest `main` at `da76e8c`, on the local `codex/mobile-device-interface` branch.
- Phones and tablets select mobile controls and device-scoped layouts; desktop computers, including touch laptops, retain keyboard/mouse controls. Resizing, rotation, and attached input devices do not change device mode.
- 235 automated tests pass, including phone/tablet identification, Android tablets, iPadOS desktop identification, touch laptops, stable selection across window sizes, and simultaneous joystick/action pointer handling. Releasing another finger does not stop movement; lost joystick capture does stop movement. Standalone and hosted builds pass.
- Browser fixtures using the actual production assets verified phone portrait at 390 × 844, phone landscape at 844 × 390, iPadOS at 820 × 1180, and a touch laptop at 390 × 844. Mobile fixtures showed touch controls, hid desktop actions, and retained positioned, scrolling orders. The laptop fixture retained desktop actions with touch controls hidden. Fixtures live outside the repository and are excluded from releases.
- Added a compact mobile status line/order rail, a left joystick and larger right-side contextual Interact/Dash buttons, and selective station labels. Landscape retains the full shop; portrait phones zoom closer and follow the machinist horizontally. Office and Covari decision buttons retain at least 44px height.
- Browser checks collected a finished lathe part and inspected part using the contextual thumb button, used Dash during station routing, and shipped that order. Rush Hour's thumb button answered a call, disabled floor actions during the conversation, and the visible mobile panel accepted a rush. A static fixture using production styles verified the longest seven-step completed route expands its card to contain SHIP and scrolls in portrait without clipping.
- The ordinary local preview also selected desktop mode correctly. These are simulated device identities and viewport checks; physical phone/tablet hardware has not been tested. Browser joystick dragging moved the machinist using normal movement and collision. Human comfort and performance on physical phones still need a device playtest.


# October 1, 2026: phone playtest feedback, tap navigation and landscape requirement

- Mobile menus now use an opaque background and hide the shop, station labels and carried-part overlays while a menu is visible. Phones require landscape; portrait shows a solid rotate prompt. Tablets retain both orientations and desktop computers keep keyboard/mouse controls.
- Removed visible joystick and corner actions. Tap a station/model or its label to walk and interact; tap the floor to walk anywhere. Double-tap the same destination to dash. Rapid extra taps cannot repeat a station interaction, including recycling freshly collected stock.
- Landscape phones have a 200px scrolling order column on the left. The camera fits the full shop into the remaining space. Long routes wrap and customer-call/Covari buttons retain 44px height.
- 258 automated tests pass. Added production-function checks for taps, dash pairing, phone conversation restrictions, preserved desktop repeated clicks, portrait pause, guarded start/resume, and closing help after rotation. Device tests distinguish phones from tablets and touch laptops. Standalone output builds and passes a JavaScript syntax check; the portable ZIP includes current mobile assets and tests.
- Browser fixtures loaded actual production assets at 390 x 650 portrait, 844 x 390 landscape and 844 x 320 short landscape. Confirmed the opaque rotate prompt and menu, absence of joystick/actions, tap stock pickup, double-tap machine routing, finished-part collection, inspection and shipping. One normal First Shift order shipped for 304 points using only taps.
- Turning to portrait paused the shift and displayed the paused message. Turning back kept the game paused until Resume. A Rush Hour challenge used tap routing to program CAD, answered a normal customer call, and accepted its rush through visible sidebar buttons. Both response buttons measured 184 x 44px and fit inside the 320px-high viewport.
- iPadOS fixture at 820 x 1180 retained the mobile interface without a rotate gate. A touch-laptop fixture at 390 x 650 retained desktop mode without a rotate gate. Fixtures and preview screenshots remain outside release source. These are browser/device-identity checks; this revision still needs the user's physical-phone comfort playtest.


# October 1, 2026: explicit mobile Dash button

- Replaced double-tap dash after physical-phone feedback about zoom and unreliable activation. A 100 x 44px Dash button sits at the bottom left; the phone order column reserves its row. Tap a destination, then press Dash to boost the same route. Its recharge bar and disabled idle/call/cooldown state are visible; desktop dash stays unchanged.
- Repeated mobile taps now only suppress repeated actions. They never trigger dash or repeat a nearby station interaction. Game canvas, station labels and Dash use touch-action: manipulation to suppress browser double-tap zoom while leaving pinch zoom and menu/order scrolling available.
- 261 automated tests pass. Production-function tests cover no gesture dash, preserved routes, explicit boost, idle/cooldown/call/pause restrictions and status text. Button binding tests verify one activation per pointer/assistive action and no action from a disabled button.
- Browser checks at 844 x 390 confirmed immediate route activation, a working Dash press, visible recharge progress and stock collection. At 844 x 320 the button remained bottom-left, 100 x 44px, with no overlap with orders. Pause hides it; resume restores the correct idle disabled appearance. This is simulated browser/device-layout verification; the revised control still needs a physical iPhone retry.


# October 1, 2026: GitHub mobile handoff integration

- Rebased the mobile interface on Arnie's latest `main` at `fc64623`, preserving the new per-run Skip leaderboard button and its saved-name behavior. The generated standalone was rebuilt from the combined sources.
- All 261 automated tests pass, along with the required movement-aware balance assertions, standalone syntax check, hosted build and 68-file handoff package verification. Expert Rush Hour with all three accepted rushes remains attainable in simulation: eight shipments, three stars, no missed deadlines and no rush penalties. Simulations establish attainability, not human completion rates.
- An ordinary desktop browser run selected desktop mode with the mobile Dash hidden. Keyboard movement/Shift dash, station clicks and E collection worked; one stock → lathe → inspection → shipping order completed for 217 points. Escape pause and button resume both worked. No browser errors or warnings were captured. This was a desktop regression check, not a full-shift mastery run.
- The user approved the latest mobile experience and confirmed the browser version works normally. Local device fixtures, sample/review pages and automated playthrough controllers remain outside the release repository.
