# CHIP RUSH verification

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
