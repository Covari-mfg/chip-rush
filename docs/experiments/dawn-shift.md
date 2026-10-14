# Dawn Shift (`dawn-shift`) experiment record

Legacy index 4. Fifth level, appended after Night Shift. This is a development
record; creator playtest, approval and release are open.

## Identity

| Field | Value |
| --- | --- |
| Level | `dawn-shift` / Dawn Shift, map `dawn-shop` |
| Base commit | `5d01251` (`main`); four released levels (`first-shift`, `mixed-orders`, `rush-hour`, `night-shift`) plus `open-for-business` |
| Model | Gemini 4 (`Gemini 4 Argon`), as reported by the run's system context |
| Harness | Cursor Cloud Agent (cloud VM) |
| Date | 2026-10-14 |
| Delegation | None. All design, modeling, simulation and verification performed directly in this run |

## Conditions

| Condition | Offered / confirmed | Used |
| --- | --- | --- |
| Starting game | Full source, tests, docs. Game served locally by `scripts/dev-server.mjs` | Yes |
| Development | Git, pnpm, Node 24.14.1, Python 3.12 | Yes |
| Playtesting | Headless Chromium via Playwright driving the live local dev server (`http://127.0.0.1:4174`). Software WebGL rendering | Yes; automated browser verification and screenshots captured |
| 3D assets | Procedural Three.js models in `dist/assets/models.js` | Built a new procedural `makeGrinder` 3D surface grinder model with reciprocating magnetic chuck, wheelhead column, spinning abrasive wheel, spark guard, handwheels and coolant nozzle |
| Music and sound | Existing loop and cues | Reused existing audio cues and loop |
| Research | Web / MCP tools available | Not needed |
| Human iteration | None yet; awaiting creator review on PR | n/a |

## Creative intent

Night Shift brought quiet after-hours finishing to the shop. Dawn Shift opens the
roll-up doors at daybreak: golden-hour light pours across the floor, a precision
**Surface Grinder** (`GRINDER`, 6s cycle) joins the mid-floor island alongside
Deburr and the Anodize bath, and the morning phone lines come back online with
two customer rush calls.

- **World (`dawn-shop` / `THEMES.dawn`):** warm golden-hour skylight, soft amber
  directional sun, and cool morning shadows. The mid-floor precision island pairs
  the new Surface Grinder on the left (`x: -3.25, z: -0.45`) with Deburr
  (`x: -0.45, z: 0.85`) and Anodize (`x: 2.4, z: 0.85`), keeping all 11 station
  access points distinct and collision-free. While running, the grinder's wheel
  spins at high RPM, its magnetic table reciprocates beneath the spindle, and
  orange-gold grinding sparks fly off the workpiece.
- **Objective:** ship 5 orders in 4:00 (240s). Stars at 5 / 6 / 7 shipped.
- **Orders & precision routes:** four new precision recipes (`RECIPES[7..10]`),
  each requiring the Surface Grinder before final inspection:
  - **Gauge block** (`mill → grind → inspect`, Block stock, base value 195)
  - **Spindle shaft** (`lathe → grind → deburr → inspect`, Round stock, base value 215)
  - **Datum plate** (`mill → deburr → grind → inspect`, Plate stock, base value 220)
  - **Aero manifold** (`lathe → mill → grind → anodize → inspect`, Block stock, base value 232)
  - Scheduled 7-order sequence: Spindle shaft, Gauge block, Datum plate,
    Aero manifold, Datum plate, Spindle shaft, Gauge block (`[8, 7, 9, 10, 9, 8, 7]`).
    Opening order at 0s, second at 18s, then every 26s. Ordinary deadline 132s
    (+14s for the opening order). Six attended CAD seconds per order.
- **New decision:** every order passes through the single 6-second Surface
  Grinder, while Spindle shaft and Datum plate cross in opposite directions
  between Grinder and Deburr (`grind → deburr` vs. `deburr → grind`), and Aero
  manifold chains four processes (`lathe → mill → grind → anodize → inspect`).
  Two morning customer calls at 40s and 120s test whether the player has staged
  enough buffer at the grinder and Hold bench to take a rush promise.
- **Covari capability gap (`PRECISION_SOURCE_JOBS`):** even with turning,
  milling, surface grinding, deburring, and anodizing on the floor, the shop
  still cannot cut internal profiles by wire EDM, harden steel in a furnace, or
  laser-serialize optics. After two normal shipments, Dawn Shift offers one job
  from `PRECISION_SOURCE_JOBS`:
  - **Wire-cut flexure** (`Wire EDM`, `EDM` badge, `"No wire EDM on this floor"`)
  - **Case-hardened gear** (`Heat treatment`, `HT` badge, `"No furnace on this floor"`)
  - **Serialized optic mount** (`Laser marking`, `LM` badge, `"No laser on this floor"`)
  The offer reuses the shared rules: optional, after 2 normal shipments, ≥35s
  elapsed, ≥45s remaining, 30s decision window, 22s delivery to Receiving,
  `inspect → ship`, 300 points, no order slot, and no shipment/star/streak credit.
- **Compatibility:** appended at `SHIFTS[4]` (`id: 'dawn-shift'`, legacy role
  index `4`). Saves (`chip-rush-roles-v8`), `unlockCleared` migration from a
  cleared Night Shift, challenge links (`?challenge=...` with `r: 4`), and score
  validation (`server/worker.js` and `dist/social.js`) preserve all released
  levels (`0..3`) and Open for Business (`MANAGER_ROLE = -1`).

## What changed

- `dist/core.js`:
  - Added `grind: {name: 'Grinder', short: 'GRIND', duration: 6, color: '#ff9b6a'}` to `OPS`.
  - Appended recipes `7..10` (`Gauge block`, `Spindle shaft`, `Datum plate`, `Aero manifold`) to `RECIPES`.
  - Added `PRECISION_SOURCE_JOBS` for Dawn Shift's capability-gap offers.
  - Appended `SHIFTS[4]` (`dawn-shift`, `mapId: 'dawn-shop'`, `author: 'Gemini 4'`, `harness: 'Cursor Cloud Agent'`).
  - Kept `this.stations` keys on `ShopGame` limited to the 5 baseline stations for shifts `0..3` while adding `grind` when unlocked on `dawn-shift`, and checked `!this.config.unlocks.includes(key)` first in `interact(key)` so `game.interact('grind')` emits `"Grinder is not needed in this shift."` on earlier shifts.
- `dist/assets/models.js`:
  - Added `makeGrinder(g)` procedural 3D model and registered `grind: makeGrinder` in `createMachine`.
- `dist/main.js`:
  - Added `{id: 'grind', name: 'GRINDER', x: -3.25, z: -0.45, height: 2.12, w: 2.04, d: 1.31, map: 'dawn-shop'}` to `STATION_LAYOUT` and enabled `deburr` and `anodize` on `'dawn-shop'`.
  - Added `'dawn-shop'` to `MAPS` with repositioned island coordinates (`deburr: {x: -0.45, z: 0.85}`, `anodize: {x: 2.4, z: 0.85}`) and `THEMES.dawn` golden-hour lighting.
  - Added grinder wheel rotation, reciprocating magnetic chuck motion, and `0xffa85c` spark particles in `animateShop`.
  - Added `'dawn-shift': 'Created with Cursor + Gemini 4'` to `SHIFT_CREDIT`.
- `dist/index.html`: updated Quick Start help copy to mention Dawn Shift and the Surface Grinder.
- Tests & docs: added `qa/dawn-shift.test.mjs`, updated legacy shift-count assertions in `qa/core.test.mjs`, `qa/night-shift.test.mjs`, `qa/shift-credit.test.mjs`, `qa/workflow.test.mjs`, `qa/technology-mapping.test.mjs`, and `qa/manager.test.mjs`, and documented the level in `docs/level-design.md`, `README.md`, `ARNOLDAS-START-HERE.md`, `qa/PLAYTEST.md`, and this file.
- Rebuilt `dist/CHIP-RUSH.html` and `dist/client/` + `dist/server/` via `pnpm run build`.

## Iteration log

1. **Map & station geometry check:** initially placed `grind` at `{x: -2.9, z: 0.85}` with `deburr` at `{x: -0.2, z: 0.85}` and `anodize` at `{x: 2.45, z: 0.85}`. Automated station-layout and navigation tests caught two issues:
   - `grind` (`w: 2.04`) and `deburr` (`w: 1.78`) had a 0.59m gap, slightly below the 0.65m minimum clearance between station bounding boxes.
   - `grind` at `z: 0.85` had its front access point at `(x: -2.9, z: 2.36)`, which fell inside the `receiving` bench's padded collision box (`x: -2.6, z: 3.15`).
   Moving `grind` to `{x: -3.25, z: -0.45}`, `deburr` to `{x: -0.45, z: 0.85}`, and `anodize` to `{x: 2.4, z: 0.85}` gave every station ≥0.75m clearance and clear A* paths between all 11 stations and spawn.
2. **Legacy station key compatibility:** existing unit tests (`qa/night-shift.test.mjs`) assert `Object.keys(new ShopGame().stations)` equals `['lathe', 'mill', 'deburr', 'anodize', 'inspect']` on default shift 0. Scoping `grind` in `this.stations` to shifts that unlock `grind` while checking `this.config.unlocks` before `this.stations[key]` in `interact()` preserved exact backwards compatibility with all existing tests.
3. **Timing & score ceiling tuning:** initial recipe base values (`210..310`) pushed the theoretical maximum score (`7902`) above the 7,500 server/social score ceiling (`validateScorePayload`). Tuning the precision recipe base values to `195 / 215 / 220 / 232` with `duration: 240`, `firstArrival: 18`, `interval: 26`, and `deadline: 132` kept the theoretical ceiling under 7,300 while separating serial play (4 shipped, 0 stars) from ordinary concurrent play (6–7 shipped, 2–3 stars) and expert play (7 shipped, 3 stars).

## Evidence

**Simulations** (`qa/balance.mjs` driver, production A* click routes and collision obstacles, deterministic; not human player data):

| Profile | Shipped / arrivals | Stars | Missed / unfinished | Score | Finish time / reason |
| --- | ---: | ---: | ---: | ---: | --- |
| serial, 0.5s handoffs, decline | 4 / 7 | 0 (fail) | 1 / 2 | 2,694 | 240.00s (`time-up`) |
| flow, 1.0s handoffs, decline | 6 / 7 | 2 (clear) | 0 / 1 | 3,844 | 240.00s (`time-up`) |
| flow, 0.5s handoffs, decline | 7 / 7 | 3 | 0 / 0 | 5,104 | 224.96s (`work-complete`) |
| flow, 0.5s handoffs, accept Covari | 7 / 7 (+1 Covari) | 3 | 0 / 0 | 5,266 | 231.93s (`work-complete`) |
| expert dash, 0.1s, decline | 7 / 7 | 3 | 0 / 0 | 6,216 | 191.71s (`work-complete`) |
| expert dash, 0.1s, accept calls | 7 / 7 (2/2 rushes) | 3 | 0 / 0 | 6,378 | 195.62s (`work-complete`) |
| expert dash, 0.1s, accept calls + Covari | 7 / 7 (2/2 rushes + Covari) | 3 | 0 / 0 | 6,594 | 197.86s (`work-complete`) |

Released levels (`first-shift`, `mixed-orders`, `rush-hour`, `night-shift`) produce identical simulation results to `main`.

**Automated checks:**
- `pnpm test` (`node --test qa/*.test.mjs`): **320 passed, 0 failed** (including 15 new tests in `qa/dawn-shift.test.mjs`).
- `pnpm run build`: regenerates `dist/CHIP-RUSH.html` and builds `dist/client/` and `dist/server/index.js` cleanly.
- `pnpm deploy:dry-run`: Wrangler dry-run bundle upload succeeds (`dist/server/index.js`, 42.19 KiB / gzip 10.67 KiB).
- `git diff --check`: clean.

**Browser verification (Playwright + headless Chromium against `http://127.0.0.1:4174`):**
- Verified the shift picker displays card `05` **Dawn Shift** (`"Grind to tolerance. Field morning calls."`, `"Created with Cursor + Gemini 4"`), and unlocks Dawn Shift when Night Shift is cleared in `chip-rush-roles-v8`.
- Clocked into Dawn Shift and verified the `dawn-shop` 3D floor renders the new `GRINDER` alongside `DEBURR`, `ANODIZE`, `LATHE`, `MILL`, `INSPECT`, `SHIPPING`, `RECEIVING`, `HOLD BENCH`, and `OFFICE / CAD` under the golden-hour `dawn` theme with zero console or page errors.
- Captured and verified screenshots at `/cursor/stores/bc-62f02f3b-a3de-469f-aecd-4416a877a33b/media/gemini-4-picker.png` and `/cursor/stores/bc-62f02f3b-a3de-469f-aecd-4416a877a33b/media/gemini-4-floor.png`.

**Known limitations:** no human has playtested Dawn Shift yet. The simulation table proves route feasibility, station reachability, and play-style separation, not human completion rates or subjective fun.
