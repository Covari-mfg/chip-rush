# Pocket Shift (`pocket-shift`) experiment record

Pocket Shift is a **prototype**: step 1 of a portrait, one-thumb way to play on
a phone. It is a separate mode, not a level and not a model submission. It has
no entry in `SHIFTS`, no legacy index, **no scores, no records and no
leaderboard**, and it is reachable only through the hidden route `#/pocket`.
This is a local development record; creator playtest on a real phone, approval
and release are open.

## Identity

| Field | Value |
| --- | --- |
| Mode | `pocket-shift` / Pocket Shift, map `pocket-shop`, route `#/pocket`, game role −2 (never a `SHIFTS` index, never sent to a server) |
| Base commit | `b755154` (main); seven playable entries in `SHIFTS` plus Open for Business |
| Model | To be supplied by the creator |
| Harness | To be supplied by the creator |
| Date | 2026-11-10 |
| Delegation | None reported for this run |

## Conditions

| Condition | Offered / confirmed | Used |
| --- | --- | --- |
| Starting game | Full source, tests, docs; local server `scripts/dev-server.mjs` | Yes |
| Development | Linux container, Git 2.43, Node 22.23, Python 3.13, FFmpeg; no `node_modules` at the start | Node for tests, builds and the server; Python for scripted edits |
| Playtesting | Preinstalled Playwright 1.63 with headless Chromium 153 and SwiftShader WebGL; no real phone, no manual play | Emulated iPhone 14 (user agent, touch) at 390×844 and 360×740 portrait, 844×390 landscape, desktop 1280×800. Software rendering runs the game clock at roughly 0.4× wall time |
| 3D assets | Procedural Three.js in `dist/assets/models.js`; Blender not installed | One new procedural room shell; every station reuses its existing model |
| Music and sound | Existing loop and cues | No new audio; plan taps reuse the existing `select` and `hint` cues |
| Research | Not needed | Not used |

## Intent

Today a phone held upright gets "Turn your phone to play". Pocket Shift asks
whether the shop can be played in portrait with one thumb. It keeps First
Shift's rules unchanged so that only the room and the controls are being tried.

- **Controls: you plan, the machinist runs.** Tapping a station (its model or
  its label) adds it to a plan of at most three stops, shown as numbered badges
  (1, 2, 3) on the station labels; the first stop's badge is green and pulses.
  The machinist walks to stop 1, uses it on arrival through the normal
  interaction, and continues. Tapping a queued station removes it and every
  stop after it. Tapping bare floor clears the plan and stops him. A rejected
  interaction shows the normal message and drops the rest of the plan. A fourth
  tap while three are queued is ignored, with a short shake and toast. There is
  no Dash button.
- **Floor.** `pocket-shop` is a narrow, deep room (walkable 8.9 × 15.15 units)
  with stations two across, read from the bottom of the screen to the top as the
  part's journey: Round and Plate stock, Lathe and Mill, the Hold bench, then
  Inspect and Shipping. Every station faces the camera and is used from a spot
  in front of it. The stock bins, Hold bench, Inspect and Shipping are drawn
  1.2–1.8× larger than in the workshop so each is about a thumb wide. The day
  theme is reused; the shell is a plain cut-down copy of the workshop's slab,
  tiles, walls and lights.
- **Rules.** First Shift's recipes, schedule, deadlines, 150 s timer, clear
  target (3) and star targets (3 / 4 / 5), with no CAD, calls or Covari offer.
  The Covari capability-gap rule in `AGENTS.md` applies to levels; this mode is
  a control experiment on First Shift and deliberately has none.
- **Screens.** `#/pocket` shows a start card (title, Prototype tag, one line of
  how to play, Play) and after a run a result card (shipped, missed, Play
  again, Back to home). The HUD reuses the mobile status line and order strip,
  without the score and clear clock; the pause button is 44 × 44 px.

## What was built

| File | Change |
| --- | --- |
| `dist/pocket.js` (new) | `POCKET_MODE` (First Shift's rule values, its own `id` and `mapId`), `PocketGame extends ShopGame`, `POCKET_ROLE = -2` |
| `dist/pocket-queue.js` (new) | Pure plan queue: `tap`, `arrived`, `clear`, `head`, `position` |
| `dist/main.js` | `pocket-shop` map; a Pocket section (route, start/result cards, plan driving, badges); hooks in station/floor taps and arrival; `phonePortrait()` is false while the route is open; per-map spawn; `MAP_SCALED` lets a map draw a station at another size; `findPath` uses the existing wide search when a room is deeper than the fixed grid (only Pocket Shift's); `useStation` returns the rule result; a QA-only `__chipRush.footprints()` |
| `dist/assets/models.js` | `createPocketShop` room shell |
| `dist/index.html`, `dist/mobile.css` | Pocket panel; the rotate-gate rules exempt `html[data-mode="pocket"]`; pocket-only HUD, label and badge styles |
| `scripts/build-offline.mjs`, `dist/CHIP-RUSH.html` | New modules bundled; standalone build regenerated |
| `qa/pocket.test.mjs` (new), `qa/mobile-navigation.test.mjs` | Queue, identity, rules, routes, no-writes and route tests; the phone-gate fixture gains the pocket hooks and a pocket case |

`html[data-mode="pocket"]` is the explicit hook: set while `#/pocket` is open
(start card, play, result), removed when the route is left. `core.js` is not
changed.

## Evidence

### Automated checks

- `node --test qa/*.test.mjs`: the whole suite passes, including
  `qa/pocket.test.mjs` (queue rules; Pocket Shift absent from `SHIFTS` with
  First Shift's rule values; a Pocket run and a First Shift run stay
  state-identical under the same actions; every pocket-shop station has a
  walkable access spot and a collision-free route to every other; a run through
  start, a shipment, the result and a restart makes no save, record, server-run
  or analytics call; the route appears only in its own panel and hash).
- `node qa/balance.mjs --rush --ignore-calls --expert --assert` passes; its
  extracted movement and routing sections are unchanged for existing maps.
- Simulation, not play: the shared balance driver (0.5 s reactions, production
  walking speed and routes) clears Pocket Shift on `pocket-shop`. It walks about
  50% longer than on `first-shop` because the room is deeper (serial: 6 shipped,
  53.6 s walking vs 7 shipped, 36.4 s; flow: 7 shipped, 76.8 s vs 7 shipped,
  49.8 s). This says nothing about how hard it feels to a person.

### Emulated-browser observation

Playwright, iPhone 14 user agent with touch, deviceScaleFactor 1. Scripts and
screenshots stayed outside the repository.

- 390 × 844 portrait on `#/pocket`: no rotate prompt and the game was not
  `inert` on the start card, in play or on the result card. Real touch taps on
  labels and models planned and shipped complete orders (stock → machine →
  inspect → ship), including a plan of three stops queued at once (collect from
  Inspect, Shipping, Plate stock). A fourth tap left the plan unchanged with a
  toast; re-tapping a queued station removed it and the stops after it; a
  rejected interaction (Shipping with empty hands) showed the normal message
  and cleared the plan; a floor tap cleared the plan and stopped him.
- Station footprints on screen (projected model boxes, CSS px wide) at
  390 × 844: Round 115, Plate 115, Lathe 120, Mill 136–137, Hold bench 113,
  Inspect 115, Shipping 116. At 360 × 740 the same run worked with Round 105,
  Plate 105, Lathe 110, Mill 125, Hold bench 104, Inspect 106, Shipping 106.
  No horizontal page scroll; pause button 44 × 44 at the top right.
- A full 390 × 844 run reached the result card (2 shipped, 2 missed, time up;
  the script stopped playing after two shipments). Pause and resume worked, and
  hiding the page paused the run with the pause panel. Back to home cleared the
  route and restored the normal home, with the rotate prompt back in portrait.
- The standalone `dist/CHIP-RUSH.html` opened `#/pocket` from a file URL and
  started a run without errors.
- localStorage was byte-identical before and after a full run; no request went
  to `/api/` or to analytics.
- Regression, compared with the base commit served side by side: phone
  portrait on the plain home URL still shows the rotate prompt and is
  pixel-identical; a portrait `#/challenges/first-shift` link is still gated;
  phone landscape First Shift starts with Dash at the same spawn and looks the
  same (pixel differences only from the clock and camera settling); the desktop
  1280 × 800 home has the same picker, tabs and label positions (28 differing
  pixels of 1,024,000).

### Untested

- Real phones, real touch latency, safe-area insets and browser chrome.
- Human play: whether planning three stops is clear, comfortable or fun, and
  how the longer walks feel. No player data exists.
- Performance on real devices (the 3D scene is unchanged in cost; the room is
  smaller than the workshop).
- Pocket Shift in landscape: it runs, but the layout was designed for portrait.
