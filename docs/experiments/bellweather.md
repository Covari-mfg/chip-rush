# Bellweather

An evening on a mountain terrace. The shop that helped put a telescope in orbit comes home to rebuild something people can hear from their kitchens.

[The terrace](bellweather/terrace.jpg) · [The village answering](bellweather/valley.jpg) · [Hear the playtest recording](bellweather/evening-peal.mp3)

## The instrument

Each bronze blank goes through a lathe or mill, then onto the tuning bench. Four seconds later the bench cycles through three pitches. Pick up the bell when the pitch sounds right, press 1, 2 or 3, or tap one of the three marked keys. The bench accepts every choice. The voices come from D major pentatonic, so a first-time player can build a phrase without knowing music.

Delivery order writes the rhythm onto the eight-hook tower. The score strip shows the pitches and the beat, and each bell has a diameter to match its note. The tower plays the phrase as the player works. Four bells bring an octave-high response from the village across the river. A short closing performance gives each side a turn. The result screen can render the player's own performance as a stereo WAV, entirely offline.

The shop has no laser engraver. After two ordinary shipments, a customer may ask for an engraved dedication plate. The player can outsource it to Covari, receive it, inspect it and ship it for 300 points. It adds no pitch, slot, shipment or star. Stars require four, six and eight bells. The shared rules for streaks, clear time, expiry and closing apply. A missed bell costs a possible note. Unfilled slots sound as rests.

## Identity and conditions

| | This run |
| --- | --- |
| Date and base | 18 November 2026, `176167e`, confirmed against origin's HEAD. Seven released playable shifts plus Open for Business and Pocket Shift. |
| Catalog | `bellweather`, index 8, map `bell-terrace`, engine `bells`. Released indices 0–7 retain their identities. |
| Model and harness | GPT-6.2 Astra in Codex desktop. Model identity came from this run's session metadata. The installed Codex CLI reported 0.167.1. |
| Delegation | GPT-6.1 Terra built the terrace, tower, landscape geometry and initial village, and updated the catalog, save and validation fixtures. GPT-6.2 Astra chose the concept and built the playable rules, pitch controls, final presentation, painted horizon, fixtures, responsive bell geometry, village belfry, synthesized peal and WAV export. GPT-6.1 Sol independently reviewed the material changes and checked the return to First Shift before accepting the local candidate. |
| Tools | Git, Node 24.22.1, pnpm 11.9.0, Python 3.14.4, FFmpeg, Three.js from the game, Web Audio, Canvas, Chrome 157 and Playwright. Blender was unavailable on PATH. All new geometry, art and music were made for this chapter. FFmpeg compressed the playtest's exported WAV for the listening sample above. |
| Starting tree | The supplied checkout held another author's uncommitted Daybreak draft on an older base. This candidate used a separate worktree of current main. The draft and the released First Light slot were preserved. |
| Human input | “Check the repo for instructions. Impress me!” supplied the brief. The concept, implementation and tests preceded creator playtesting. |

## Iteration

1. Played the opening of First Light, then chose to bring the player back down to one of the villages below. The new interaction gives the player authorship of a tune.
2. The first browser render put the workshop above the town at a steep angle. The copper roof obscured the clock and the village lacked a recognizable voice. Lowered the camera, painted the mountain horizon, raised the clock, built a second belfry across the river and gave sounding bells a visible pulse. Earlier maps restore their own camera and station models.
3. Timed pickup became one way to choose a pitch. Direct note keys made the same choice available by sight, touch or keyboard. The landscape phone test exposed a collision with the next-station hint, so the score strip moved to the right.
4. A finished melody originally ended with the shift. The WAV export now lets a player keep it. The live bells and the recording share their overtones and stereo placement.
5. Returning through Pocket Shift on a landscape phone revealed that the fixed header covered the full-game mode tabs. Adjusted the small landscape menu spacing and high-score link position. Verified a touch round-trip from Bellweather through Pocket Shift's full-game button, the Shifts tab and First Shift to picking up round stock. The bell UI disappeared on the earlier floor.

## Evidence

- **Desktop browser, 1440 × 900.** Played with real station-label clicks from clock-in to results on the local server. The first complete run hung eight bells for 3,243 points, cleared at 1:27.1 and ended at 2:54.2. The tower and village performances ran without advancing the score clock. A final pass after the scenery changes also hung eight, cleared at 1:27.2 and ended at 2:54.3 with 3,234 points.
- **Standalone file, 1440 × 900.** Completed all eight bells by alternating number keys and note buttons. Paused and resumed at the tuning bench. Cleared at 1:23.4, ended at 2:45.7 and earned 3,469 points. Saved the WAV through the result button. It contained 12.20 seconds of stereo PCM at 32 kHz. The opening note was louder on the right, the village response louder on the left. The phrase was D, A, high D, D, F♯, B, F♯, A. No browser exceptions in either run.
- **Emulated landscape phone, 915 × 412.** A touch-only run chose two pitches, accepted the Covari offer, collected the plate at Receiving, put it through QC and delivered it to the Belfry. The score increased by 300 while the tune remained A, B. Physical-device play and listening through phone speakers remain untested.
- **Movement simulations.** Serial routing with 1.5-second handoffs hung seven, scored 2,311 and ran to 3:00. Concurrent routing at 0.8 seconds hung eight and finished at 2:19.49 with 4,073. Dash routing at 0.1 seconds hung eight and finished at 2:11.98 with 4,379. These are deterministic routes without human judgments about the music.
- **Automated verification.** 467 tests passed. Focused coverage includes all three pitches, direct input, pause, recycling, bench swaps, Covari credit and movement-based completion. Catalog, historical saves, challenge limits and server bounds cover the appended slot. The Rush Hour expert assertion, standalone and hosted builds, standalone syntax check, Worker deployment dry run and whitespace check passed.
- **Compatibility.** Ordinary points and bounded self-reported times use the existing shift competition. Pitch choices affect the composition. The standard save stores stars and points, and the speed save uses the stable ID. The tune belongs to the current run and its optional audio download. No schema migration.

## Release

Local review candidate on `codex/bellweather`. Creator acceptance, a public release and a deployment are pending.
