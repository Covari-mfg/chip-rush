# Bellweather

## Third edition · The Turning Room (local candidate)

**Status, 18 November 2026:** local candidate for review. The released public game remains Downhill Express until the candidate is approved and released. The creator corrected the brief after the railway: machining must be part of play, while the genre remains open. This revision moves the challenge to hands-on turning rather than a delivery race.

| | This edition |
| --- | --- |
| Catalog | `bellweather`, stable index 8; map `turning-room`, engine `bells`; ruleset and speed-record ID `bellweather-v3-turning`. |
| Credit | The catalog retains the established GPT-6.2 Astra / Codex slot attribution. GPT-6.1 Terra contributed the lathe scene, server validation and deterministic turning QA. |
| Implementation | Original in-game lathe scene, turning console and sound, built in the existing game. |

Eight 32 mm blanks become three-section components for the bell works. Select a section with 1–3 or A/D, hold Space to cut, toggle rough/fine feed with F, and inspect with E. Pointer and touch controls provide the same actions. Rough feed removes 8 mm diameter per second; fine removes 2.4. Later drawings mark sections that require a final 0.30 mm cut using fine feed. A useful practice is to rough to roughly 1 mm above target, then finish slowly. Changing sections takes 0.15 seconds. An oversized or unfinished component stays for rework; an undersized section scraps the blank. All sections in tolerance and with any required finish pass inspection.

Four accepted parts clear; six and eight earn higher stars. Resolve all eight blanks or reach 100 seconds; unfinished blanks count as missed. An accepted part earns 320 base points, up to 480 for precision and a streak of up to 200. A cleared batch earns 40 points per second under 60, rounded down. After two accepted parts, C or the on-screen offer obtains a Covari-engraved maker’s plate for 300 points. There is no engraver in this shop, and the plate adds no part or star.

### Third-edition evidence and compatibility

- **Deterministic engine simulation, not player data.** A driver using the ordinary selection, feed and inspection inputs accepted eight parts in 28.11 s for 7,200 points with fast/fine feed. Fine-only accepted eight in 73.12 s for 5,930 points. Both include the optional 300-point plate. Idle play timed out at 100 s with zero accepted and zero points.
- **Desktop keyboard.** The local browser driver used section selection, held feed, rough/fine changes and inspection to ship eight parts. Paused and resumed, exercised rework, sourced the plate and restarted. A separate deliberate overcut scrapped section B, advanced to a fresh 32 mm blank and awarded zero shipments. Returning to First Shift restored its shop controls.
- **Touch and offline.** An 844 × 390 landscape touch-emulated run accepted eight in 39.87 s for 8,323 points. A standalone file run accepted eight in 33.88 s for 7,816 points. Both opened the inspection sheet with eight measured parts and retried. These were scripted inputs. Physical-device and human difficulty are unmeasured.
- **Verification.** 471 automated tests passed, including a nominal-diameter journal that fails inspection until it receives a fine pass. Inspection uses the hundredth-millimetre reading on the instrument. The shared test suite, both builds, standalone syntax, deployment dry run and whitespace check passed. The lathe scene uses original geometry, procedural textures, and Web Audio. [Lathe during a cut](bellweather/turning-room.jpg).
- **Records.** The stable index remains 8. Local scores and clear times remain edition-specific. The community board retains first-edition rows and labels v2 rows Downhill Express. Old-edition challenges and new score submissions are checked against the current ruleset; the Worker applies conservative plausibility bounds rather than replaying a run.

## Second edition · Downhill Express

The creator rejected the terrace version after playing it. The shop loop felt basic and lacked speed or risk. This iteration keeps the setting and the bells, and sends an alpine delivery trolley down the valley.

| | This edition |
| --- | --- |
| Date and base | 18 November 2026, local first-edition commit `5c6710f`. |
| Catalog | `bellweather`, index 8, map `downhill-line`, engine `bells`. |
| Author and harness | GPT-6.2 Astra, Codex desktop. Astra chose the race concept and owned the implementation and integration. GPT-6.1 Terra built the first railway render, cab prototype, compatibility changes and deterministic driving tests. GPT-6.1 Sol independently reviewed the integrated race and save behavior. |
| Tools | The course and its structures are original procedural Three.js geometry. Web Audio supplies the bells and race cues. |

The fixed three-track course runs past timber trestles, mountains, a stone gallery and eight hooped delivery stations. Switch with A/D or Left/Right. Throw with Space, hold S or Down to brake, and press R to retry. On the target track, green sleepers mark the throw window. Gold rewards tighter timing with points and speed. Exactly one track over, gold is the window to bank a throw. Cyan speed rails shorten the time available to make those decisions. A striped barrier drops speed and the delivery streak. The ghost follows the local personal best, ordered by deliveries and then finish time, with splits at each station. Stars still count four, six and eight regular deliveries. Finishing a cleared run under 45 seconds pays 60 points per second saved, rounded down.

A trolley cannot laser-engrave a dedication plate. After two successful deliveries, the Covari pickup unlocks if it is still ahead. A pass through the left-track pickup earns 300 points. The trackside handoff replaces the workshop's acceptance, Receiving and inspection interactions. It adds zero regular orders or stars.

The new ruleset and speed-record ID are both `bellweather-v2-downhill`. The prior edition's local points and stars archive under its prior identity, and its speed records remain distinct. At its release, the ruleset gated challenges and score submissions, and the community board distinguished first-edition rows from Downhill Express. Existing score columns covered both editions.

### Second-edition evidence

[Watch the recorded browser run](bellweather/downhill-run.mp4)

- **Desktop browser.** A Playwright driver used the steering and throw keys in the real-time Chrome build. It finished in 27.08 s with eight cross-track bullseyes, 15 express pads, zero impacts and 8,575 points. The next run loaded the ghost. Holding the brake let it pull ahead. R reset the clock. A separate run exercised pause, resume, a missed delivery and return to First Shift.
- **Offline.** Opened the bundled HTML directly from disk. The same keyboard route finished with eight deliveries and 8,575 points, saved its ghost and restarted.
- **Landscape touch emulation, 844 × 390.** The driver tapped the cab controls, collected the engraved plate and finished with six deliveries, six impacts and 3,446 points in 40.57 s. Retried from results, saw the saved ghost time, then returned through the menu to First Shift. Physical-device handling and human difficulty are unmeasured.
- **Repeatable engine simulation.** Holding the brake and taking direct throws delivered eight in 78.40 s for 3,220 points. Direct gold throws finished in 34.60 s for 5,924. Taking the speed rails and banking the throws finished in 27.08 s for 8,575. Coasting without input finished in 34.22 s with zero deliveries and zero points.
- **Checks.** All 469 automated tests passed, including old challenge and save formats, current leaderboard bounds, course completion, optional sourcing and ghost replacement. The Rush Hour expert balance check, hosted and standalone builds, standalone syntax check, Worker deployment dry run and whitespace check passed.
- **Visual iteration.** The first race render had stark cone mountains and a dashboard that hid the trolley. The final art has patchy snow on connected ridges, an iron suspension span and named station signs. The cab keeps the centre of the track clear. The finish bonus was added after the first runs so carrying speed also counts toward the shared scoreboard.
- **Production.** The full course, shader sky, structures and sounds are original to the project. Chrome and Playwright supplied browser evidence, and FFmpeg encoded the local run recording. Tests used local storage and a local community-board database.

## First edition · Terrace workshop

An evening on a mountain terrace. The shop that helped put a telescope in orbit comes home to rebuild something people can hear from their kitchens.

[The terrace](bellweather/terrace.jpg) · [The village answering](bellweather/valley.jpg) · [Hear the playtest recording](bellweather/evening-peal.mp3)

### The instrument

Each bronze blank goes through a lathe or mill, then onto the tuning bench. Four seconds later the bench cycles through three pitches. Pick up the bell when the pitch sounds right, press 1, 2 or 3, or tap one of the three marked keys. The bench accepts every choice. The voices come from D major pentatonic, so a first-time player can build a phrase without knowing music.

Delivery order writes the rhythm onto the eight-hook tower. The score strip shows the pitches and the beat, and each bell has a diameter to match its note. The tower plays the phrase as the player works. Four bells bring an octave-high response from the village across the river. A short closing performance gives each side a turn. The result screen can render the player's own performance as a stereo WAV, entirely offline.

The shop has no laser engraver. After two ordinary shipments, a customer may ask for an engraved dedication plate. The player can outsource it to Covari, receive it, inspect it and ship it for 300 points. It adds no pitch, slot, shipment or star. Stars require four, six and eight bells. The shared rules for streaks, clear time, expiry and closing apply. A missed bell costs a possible note. Unfilled slots sound as rests.

### Identity and conditions

| | This run |
| --- | --- |
| Date and base | 18 November 2026, `176167e`, confirmed against origin's HEAD. Seven released playable shifts plus Open for Business and Pocket Shift. |
| Catalog | `bellweather`, index 8, map `bell-terrace`, engine `bells`. Released indices 0–7 retain their identities. |
| Model and harness | GPT-6.2 Astra in Codex desktop. Model identity came from this run's session metadata. The installed Codex CLI reported 0.167.1. |
| Delegation | GPT-6.1 Terra built the terrace, tower, landscape geometry and initial village, and updated the catalog, save and validation fixtures. GPT-6.2 Astra chose the concept and built the playable rules, pitch controls, final presentation, painted horizon, fixtures, responsive bell geometry, village belfry, synthesized peal and WAV export. GPT-6.1 Sol independently reviewed the material changes and checked the return to First Shift before accepting the local candidate. |
| Tools | Git, Node 24.22.1, pnpm 11.9.0, Python 3.14.4, FFmpeg, Three.js from the game, Web Audio, Canvas, Chrome 157 and Playwright. Blender was unavailable on PATH. All new geometry, art and music were made for this chapter. FFmpeg compressed the playtest's exported WAV for the listening sample above. |
| Starting tree | The supplied checkout held another author's uncommitted Daybreak draft on an older base. This candidate used a separate worktree of current main. The draft and the released First Light slot were preserved. |
| Human input | “Check the repo for instructions. Impress me!” supplied the brief. The concept, implementation and tests preceded creator playtesting. |

### Iteration

1. Played the opening of First Light, then chose to bring the player back down to one of the villages below. The new interaction gives the player authorship of a tune.
2. The first browser render put the workshop above the town at a steep angle. The copper roof obscured the clock and the village lacked a recognizable voice. Lowered the camera, painted the mountain horizon, raised the clock, built a second belfry across the river and gave sounding bells a visible pulse. Earlier maps restore their own camera and station models.
3. Timed pickup became one way to choose a pitch. Direct note keys made the same choice available by sight, touch or keyboard. The landscape phone test exposed a collision with the next-station hint, so the score strip moved to the right.
4. A finished melody originally ended with the shift. The WAV export now lets a player keep it. The live bells and the recording share their overtones and stereo placement.
5. Returning through Pocket Shift on a landscape phone revealed that the fixed header covered the full-game mode tabs. Adjusted the small landscape menu spacing and high-score link position. Verified a touch round-trip from Bellweather through Pocket Shift's full-game button, the Shifts tab and First Shift to picking up round stock. The bell UI disappeared on the earlier floor.

### First-edition evidence

- **Desktop browser, 1440 × 900.** Played with real station-label clicks from clock-in to results on the local server. The first complete run hung eight bells for 3,243 points, cleared at 1:27.1 and ended at 2:54.2. The tower and village performances ran without advancing the score clock. A final pass after the scenery changes also hung eight, cleared at 1:27.2 and ended at 2:54.3 with 3,234 points.
- **Standalone file, 1440 × 900.** Completed all eight bells by alternating number keys and note buttons. Paused and resumed at the tuning bench. Cleared at 1:23.4, ended at 2:45.7 and earned 3,469 points. Saved the WAV through the result button. It contained 12.20 seconds of stereo PCM at 32 kHz. The opening note was louder on the right, the village response louder on the left. The phrase was D, A, high D, D, F♯, B, F♯, A. No browser exceptions in either run.
- **Emulated landscape phone, 915 × 412.** A touch-only run chose two pitches, accepted the Covari offer, collected the plate at Receiving, put it through QC and delivered it to the Belfry. The score increased by 300 while the tune remained A, B. Physical-device play and listening through phone speakers remain untested.
- **Movement simulations.** Serial routing with 1.5-second handoffs hung seven, scored 2,311 and ran to 3:00. Concurrent routing at 0.8 seconds hung eight and finished at 2:19.49 with 4,073. Dash routing at 0.1 seconds hung eight and finished at 2:11.98 with 4,379. These are deterministic routes without human judgments about the music.
- **Automated verification.** 467 tests passed. Focused coverage includes all three pitches, direct input, pause, recycling, bench swaps, Covari credit and movement-based completion. Catalog, historical saves, challenge limits and server bounds cover the appended slot. The Rush Hour expert assertion, standalone and hosted builds, standalone syntax check, Worker deployment dry run and whitespace check passed.
- **Compatibility.** Ordinary points and bounded self-reported times use the existing shift competition. Pitch choices affect the composition. The standard save stores stars and points, and the speed save uses the stable ID. The tune belongs to the current run and its optional audio download. No schema migration.

## Earlier release

The first edition was a local review candidate at `5c6710f`. The creator rejected it after playing. On 18 November 2026 the creator authorized merging and deploying Downhill Express after the release checks. The reviewed gameplay commit is `a755ff7`. [Production level](https://play.covari.io/#/challenges/bellweather).
