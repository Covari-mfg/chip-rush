# Blackout Shift (`dawn-shift`) experiment record

Legacy index 4. Fifth level, appended after Night Shift. This is a development
record; creator playtest, approval and release are open.

## Identity

| Field | Value |
| --- | --- |
| Level | `dawn-shift` / **Blackout Shift** (Iteration 2; Iteration 1 was titled *Dawn Shift*), map `dawn-shop` |
| Base commit | `5d01251` (`main`); four released levels (`first-shift`, `mixed-orders`, `rush-hour`, `night-shift`) plus `open-for-business` |
| Model | Gemini 4 (`Gemini 4 Argon`), as reported by the run's system context |
| Harness | Cursor Cloud Agent (cloud VM) |
| Date | 2026-10-14 |
| Delegation | None. All design, modeling, audio synthesis, simulation and verification performed directly in this run |

## Conditions

| Condition | Offered / confirmed | Used |
| --- | --- | --- |
| Starting game | Full source, tests, docs. Game served locally by `scripts/dev-server.mjs` | Yes |
| Development | Git, pnpm, Node 24.14.1, Python 3.12 | Yes |
| Playtesting | Headless Chromium via Playwright driving the live local dev server (`http://127.0.0.1:4174`). Software WebGL rendering | Yes; automated browser verification and screenshots captured |
| 3D assets | Procedural Three.js models in `dist/assets/models.js` | Built `createStormRig` in Iteration 2: a 3D Backup Generator & Capacitor Bank with spinning rotor, glowing cyan capacitor coils, and 5 radiating floor power conduits |
| Music and sound | Web Audio API in `dist/audio.js` | Built `buildStormBuffer(ctx)` in Iteration 2: a procedural 128 BPM stereo storm-synthwave soundtrack (`storm` track) plus `surge` and `overdrive` synth SFX |
| Research | Web / MCP tools available | Not needed |
| Human iteration | Creator feedback after Iteration 1 led to the Iteration 2 redesign below | Yes (1 creator feedback round) |

---

## Iteration 1: What we did first, and why it fell short

In **Iteration 1** (originally titled **Dawn Shift**), we pattern-matched the
previous levels (especially Night Shift):
- We kept the exact same perimeter machine layout and simply added **one more
  machine** (`grind` / `GRINDER`, a 6-second Surface Grinder) on the mid-floor
  island next to Deburr and Anodize.
- We kept the same 6-second attended CAD requirement at the Office before every
  part, added four grinding recipes (`Gauge block`, `Spindle shaft`,
  `Datum plate`, `Aero manifold`), turned customer phone calls back on at 40s
  and 120s, and reused the existing 104 BPM country/bluegrass audio loop.

### Creator feedback (Arnoldas) on Iteration 1

> *"I say that the model is clearly matching the pattern, like the pattern of
> what happened before and just adding a few details. That's what the game is
> like. And it doesn't recognize that this is a test. It can really change
> anything. It can do the different sounds. It can do different map. It can do
> all kinds of things. I want to kind of unlock it from the box that it's in...
> Do we need this to be an enjoyable experience? Just in the same universe of
> the game story itself... I'm okay to encourage it and maybe tweak something,
> but try not to give it ideas. That's the benchmark. And I also just don't want
> the same levels, just keep adding more machines and if every single level
> simply has more machines, then it's very boring, so I will not even publish it
> then."*

---

## Iteration 2: Creative intent — **Blackout Shift**

Instead of "Night Shift + one more machine", Iteration 2 removes the Surface
Grinder completely and reimagines how the shop floor, pacing, power grid, and
soundtrack work when a pre-dawn coastal storm knocks out the main utility grid:

1. **No new station—reconfigured cellular map (`dawn-shop`) & 3D Backup Generator:**
   - The shop runs on its existing five stations (`lathe`, `mill`, `deburr`,
     `anodize`, `inspect`), but the floor is physically rearranged into a
     high-flow cellular layout around a **3D Backup Generator & Capacitor Bank**
     (`BACKUP GENERATOR · OVERDRIVE BUS`) at the back-center bay (`x: -0.4, z: -4.65`)
     with a spinning turbine rotor, glowing cyan capacitor coils, and five
     glowing cyan floor conduits feeding the cells:
     - **Central QC Hub (`INSPECT`):** moved from the far right wall into the
       center of the shop floor (`x: 0, z: -1.75`, rotated forward) so every
       cell feeds directly into central inspection before shipping.
     - **West Cell:** pairs `LATHE` (`x: -3.3, z: -2.95`) and `DEBURR`
       (`x: -3.45, z: -0.1`) on the left side of the generator bus.
     - **East Cell:** pairs `MILL` (`x: 3.1, z: -2.85`) and `ANODIZE`
       (`x: 2.4, z: 0.85`) on the right side of the generator bus.
   - **Storm-dawn atmosphere (`THEMES.dawn`):** deep electric storm-slate sky,
     cool cyan generator light, warm amber emergency beacons, and visible
     lightning flashes across the shop during storm strikes.

2. **Zero CAD delay (`programming: false`) + Generator Overdrive & Surge (`overdrive: true`):**
   - **Zero CAD delay:** emergency utility and turbine repair tickets arrive
     pre-programmed. You never sit at the desk for 6 seconds before picking up
     raw stock—you sprint straight to the stock bins on second 0.
   - **1.5× Harmonic Overdrive:** running **2 or more machines simultaneously**
     (`runningStations() >= 2`) locks the backup generator into Harmonic
     Overdrive, accelerating **all active machine cycles by 1.5×** and showering
     the machines and generator bus with cyan sparks. Playing one part at a time
     (`serial`) runs at 1.0× speed and only earns 1 star; keeping multiple
     machines humming in parallel is the core rhythm of the shift.
   - **2.0× Generator Surge (Office Surge Console + Storm Lightning):**
     - With CAD gone, the Office desk is repurposed into the **Surge Console**
       (`SURGE CONSOLE`, showing `⚡ BOOST 2×` when charged). Walking into the
       office or interacting with it discharges the capacitor bank for a
       **16-second `2.0×` Generator Surge** across the entire floor (22s
       capacitor recharge after the surge ends).
     - The shift opens with a 12-second `2.0×` initial capacitor boost, and
       scheduled **coastal lightning strikes** at **50s, 105s, and 148s**
       supercharge the floor with a free **10-second `2.0×` Lightning Surge**
       and a dramatic sky flash.

3. **Procedural 128 BPM Storm-Synth Soundtrack (`musicTrack: 'storm'`):**
   - While the menu and shifts `0..3` continue playing the original 104 BPM
     country/bluegrass loop (`country`), clocking into Blackout Shift switches
     `ShopAudio` to a procedurally synthesized **128 BPM stereo industrial
     synthwave loop** (`buildStormBuffer` in `dist/audio.js`: driving sawtooth +
     sub bassline, stereo-panned square-wave arpeggiator, dark minor pad, and
     four-on-the-floor electronic kick/snare/hi-hat) plus custom `surge` and
     `overdrive` synthesizer cues.

4. **Workload & Covari capability gap (`PRECISION_SOURCE_JOBS`):**
   - **Objective:** ship 5 orders in 3:00 (180s) to clear; stars at **5 / 6 / 8**
     shipments (`maxOrders: 8`, `firstArrival: 8`, `interval: 21`, `deadline: 112`).
   - **Emergency grid recipes (`RECIPES[7..10]` + `Ocean collar`):**
     - **Turbine coupling** (`lathe → mill → deburr → inspect`, Round stock, base value 280)
     - **Breaker busbar** (`mill → deburr → anodize → inspect`, Plate stock, base value 295)
     - **Surge manifold** (`lathe → mill → anodize → inspect`, Block stock, base value 325)
     - **Grid isolator** (`lathe → mill → deburr → anodize → inspect`, Block stock, base value 350)
   - **Covari capability gap:** even under generator overdrive, the floor has no
     wire EDM, heat-treat furnace, or laser marker. After two normal shipments,
     Blackout Shift offers one job from `PRECISION_SOURCE_JOBS`:
     - **Wire-cut flexure** (`Wire EDM`, `EDM` badge, `"No wire EDM on this floor"`)
     - **Case-hardened gear** (`Heat treatment`, `HT` badge, `"No furnace on this floor"`)
     - **Serialized optic mount** (`Laser marking`, `LM` badge, `"No laser on this floor"`)
     Reuses the shared offer rules: optional, after 2 normal shipments, ≥35s
     elapsed, ≥45s remaining, 30s decision window, 22s delivery to Receiving,
     `inspect → ship`, 300 points, no order slot or star credit.

## What changed in the codebase (Iteration 2)

- `dist/core.js`:
  - Removed `grind` from `OPS` so the game keeps the 5 existing shop stations.
  - Updated `RECIPES[7..10]` (`Turbine coupling`, `Breaker busbar`,
    `Surge manifold`, `Grid isolator`) to use multi-step combinations of
    `lathe`, `mill`, `deburr`, `anodize`, and `inspect`.
  - Updated `SHIFTS[4]` (`id: 'dawn-shift'` preserved for save/challenge/board
    compatibility, `name: 'Blackout Shift'`, `mapId: 'dawn-shop'`,
    `musicTrack: 'storm'`, `overdrive: true`, `programming: false`, `calls: false`,
    `duration: 180`, `maxOrders: 8`, `stars: [5, 6, 8]`).
  - Added `runningStations()`, `machineSpeed()`, `triggerSurge(source, duration)`,
    `surgeRemaining`, `surgeCooldown`, `overdriveActive`, and scheduled
    `stormStrikes` (`[50, 105, 148]`) in `ShopGame`.
- `dist/assets/models.js`:
  - Replaced `makeGrinder` with `createStormRig()`: a 3D Backup Generator &
    Capacitor Bank (`BACKUP GENERATOR · OVERDRIVE BUS`) with animated rotor,
    glowing cyan capacitor rings, and 5 glowing floor power conduits.
- `dist/audio.js`:
  - Added `buildStormBuffer(ctx)` to synthesize a seamless 8-bar, 15.0s stereo
    128 BPM synthwave soundtrack in memory, `setTrack(track)` to switch between
    `'country'` and `'storm'`, and `surge` / `overdrive` synth SFX cues.
- `dist/main.js`:
  - Reconfigured `MAPS['dawn-shop']` into West/East machining cells around a
    central `inspect` station (`x: 0, z: -1.75, rotationY: 0`) and the backup
    generator collider (`minX: -1.55, maxX: 0.75, minZ: -5.35, maxZ: -3.95`).
  - Applied per-map station rotation in `applyMap()`, animated the generator
    rotor/conduits, lightning sky flashes, cyan overdrive sparks, live HUD
    multiplier pill (`⚡ SURGE 2.0×` / `⚡ OVERDRIVE 1.5×`), and `SURGE CONSOLE`
    office label + sidebar panel.
- `qa/balance.mjs`, `qa/dawn-shift.test.mjs`, `qa/audio.test.mjs`,
  `qa/technology-mapping.test.mjs`, `qa/workflow.test.mjs`:
  - Updated `Driver.pathTo(id)` in `qa/balance.mjs` to use `navigation.accessesFor(this.game.config.mapId)[id]` so per-map station placements work in deterministic simulations.
  - Updated `qa/dawn-shift.test.mjs` and `qa/audio.test.mjs` to test Harmonic Overdrive, Office/Lightning 2.0× Surges, cellular `dawn-shop` routing, and the 128 BPM `storm` audio track.

## Evidence (Iteration 2)

**Simulations** (`qa/balance.mjs` driver, production A* click routes and collision obstacles, deterministic; not human player data):

| Profile | Shipped / arrivals | Stars | Missed / unfinished | Score | Finish time / reason |
| --- | ---: | ---: | ---: | ---: | --- |
| serial, 0.5s handoffs, decline | 5 / 8 | 1 (clear) | 0 / 3 | 3,126 | 180.00s (`time-up`) |
| flow, 1.0s handoffs, decline | 7 / 8 | 2 (clear) | 0 / 1 | 4,857 | 180.00s (`time-up`) |
| flow, 0.5s handoffs, decline | 8 / 8 | 3 | 0 / 0 | 6,186 | 161.46s (`work-complete`) |
| flow, 0.5s handoffs, accept Covari | 8 / 8 (+1 Covari) | 3 | 0 / 0 | 6,407 | 162.25s (`work-complete`) |
| expert dash, 0.1s, decline | 8 / 8 | 3 | 0 / 0 | 6,684 | 154.55s (`work-complete`) |
| expert dash, 0.1s, accept Covari | 8 / 8 (+1 Covari) | 3 | 0 / 0 | 6,978 | 154.39s (`work-complete`) |

Released levels (`first-shift`, `mixed-orders`, `rush-hour`, `night-shift`) produce identical simulation results to `main`.

**Automated checks:**
- `pnpm test` (`node --test qa/*.test.mjs`): **322 passed, 0 failed**.
- `node qa/balance.mjs --rush --ignore-calls --expert --assert`: passes all assertions.
- `pnpm run build`: regenerates `dist/CHIP-RUSH.html` and builds `dist/client/` and `dist/server/index.js` cleanly.
- `pnpm deploy:dry-run`: Wrangler dry-run bundle upload succeeds.
- `git diff --check`: clean.

**Browser verification (Playwright + Chromium against `http://127.0.0.1:4174`):**
- Verified shift picker card `05 Blackout Shift` (`"Grid down. Generator overdrive. Zero CAD delay."`, `"Created with Cursor + Gemini 4"`).
- Clocked into Blackout Shift and verified the reconfigured `dawn-shop` cellular layout (central `INSPECT`, West `LATHE` + `DEBURR`, East `MILL` + `ANODIZE`, back-center `BACKUP GENERATOR · OVERDRIVE BUS` with glowing cyan floor conduits, and `SURGE CONSOLE` at the office) plus the live `⚡ SURGE 2.0×` / `⚡ OVERDRIVE 1.5×` HUD status and 128 BPM `storm` synth soundtrack with zero console or page errors.
- Saved Iteration 2 screenshots to `/cursor/stores/bc-62f02f3b-a3de-469f-aecd-4416a877a33b/media/gemini-4-r2-picker.png` and `/cursor/stores/bc-62f02f3b-a3de-469f-aecd-4416a877a33b/media/gemini-4-r2-floor.png`.
