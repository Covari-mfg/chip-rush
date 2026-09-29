# CHIP RUSH

A complete single-player 3D machine-shop game. Original procedural assets, short shifts, timed CNC operations, multiple orders, a carried part, and a shipping streak.

[Play CHIP RUSH](https://play.covari.io/) or use the source in this repository. The public game runs from this repository; source changes appear there after a reviewed release. See [CONTRIBUTING.md](CONTRIBUTING.md) to propose improvements.

## Play without installing anything

Open **dist/CHIP-RUSH.html** in a current Chrome, Edge, Firefox, or Safari browser. Everything is embedded, including the 3D renderer. No account, server, network, or build step is required. WebGL 2 and hardware acceleration must be available.

The First Shop chapter has four scenarios in one little shop:

| Level | Shift | Clear target | New responsibility | Stars |
| --- | --- | --- | --- | --- |
| First Shift | 2½ minutes | 3 shipments | Material → turn or mill → inspect → ship | 3 / 4 / 5 |
| Mixed Orders | 3 minutes | 4 shipments | CAD → material → turn or mill (sometimes both) → inspect → ship | 4 / 5 / 6 |
| Rush Hour | 3 minutes | 5 shipments | CAD and combined routes, plus optional customer calls | 5 / 6 / 8 |
| Night Shift | 3½ minutes | 4 shipments | Deburr and Anodize finishing after hours; no calls | 4 / 5 / 6 |

Clearing a scenario unlocks the next. Night Shift is the fourth level (Claude Sonnet 5.5, Cursor Cloud Agent): the phones are off, the lights are low, and deburr and color-bath finishing join the machining routes. See [docs/experiments/night-shift.md](docs/experiments/night-shift.md). First Shift teaches the physical loop, Mixed Orders rewards practiced scheduling, and Rush Hour separates clearing the shift from an exceptional three-star run. The intended experience is mastery after focused practice, not a measured success-rate claim. See [docs/level-design.md](docs/level-design.md) for the current chapter contract and level details. Briefings show all three shipment targets before the clock starts; the live counter tracks the next star. Retries use the same job sequence.

First Shift opens with one order, then waits 18 seconds before the second and spaces later arrivals 19 seconds apart. This gives the first part more breathing room while keeping the existing seventh order eligible before the late-order safety cutoff. The job values, deadlines, score formula, and star targets stay the same.

Mixed Orders has at most six orders: an opening order, a 16-second gap, then 25-second intervals. Its sequence includes two bearing housings that need both turning and milling. Rush Hour has at most eight orders, a first 12-second gap, then 18-second intervals, with three bearing housings in its sequence. Both scenarios retain the four-active-order limit and the closing-time check, which can substitute a shorter route or stop arrivals if work cannot reasonably finish. Ordinary deadlines are 105 seconds, plus 14 seconds for the opening order. Rush Hour mastery requires planning, machine overlap, and practiced routing; rush bonuses remain optional even for three stars.

Personal bests and unlocks use the `chip-rush-roles-v8` save in this browser. Upgrading from v7/v6/v5/v4/v3/v2 keeps unlocked scenarios and starts fresh scores and stars for the updated call rules. Previous saves remain intact. A cleared, unlocked level unlocks its successor when a save is loaded, so players who had already cleared Rush Hour find Night Shift unlocked; stars from friend challenges on a locked level never unlock anything. Some browsers isolate or disable storage for local files; the game still works for that session.

## Add the next level

Read [the model experiment brief](docs/model-experiment.md) for the reusable
prompt, creative freedom, shared tool access, and iteration record. Each new
model/harness can continue the story with its own map, art, music, and gameplay.
The [current level guide](docs/level-design.md) describes the starting three
scenarios, not a fixed template for future ones.

## Review handoff

Start with `ARNOLDAS-START-HERE.md` for local play, the review checklist, and a Codex continuation prompt. Rebuild the complete source ZIP with `python3 scripts/package-handoff.py`; it also puts a downloadable copy in `dist/downloads/`. The ZIP includes a generic hosting manifest with no existing Site identity.

## Controls

| Action | Keyboard | Mouse / touch |
| --- | --- | --- |
| Move | WASD / arrow keys | Click floor; touch joystick on touch devices |
| Use station | E / Space | Click a machine or its label to walk over and interact |
| Dash | Shift | Visible Dash button |
| Pause | Escape / P | Pause button |

Station clicks follow smooth collision-safe paths. Shift adds a short dash that stops at the next corner or station, so precise click-and-dash routing is available on desktop.

Active orders occupy a horizontal strip at the top. The front-aligned shop fills the space below; score and time sit in the bottom corner beside persistent Interact and Dash controls. Cards scroll horizontally when needed. A small job number follows the carried part; there is no separate hands panel. Detailed help remains available on demand.

Small technology badges connect each order to its machine: turning and milling use matching icons on the card and station label, and orders needing both show both. Covari cards have distinct EDM, IM and SM badges for wire EDM, injection molding and sheet metal assembly. Each badge also has a full technology name for assistive text and its tooltip.

Collect stock from the bin matching an order's pictogram: **Round**, **Plate**, or (in later scenarios) **Block**. Pickup starts the earliest-due CAD-ready, unstarted job of that stock type, with lower order number breaking a tie. Tickets are informational; no selection is needed. The carried part retains its customer order and unique machining route all the way to shipping.

Follow the ticket's machine route. Machines work unattended, including the four-second inspection. Collect the finished part when the station label says **READY**. Inspection must finish before Shipping accepts the part. The Hold bench stores one part; using it while both hands and bench are occupied swaps them. A compatible new part can replace a ready machine's output in one interaction. Return an ordinary carried part to any stock bin to recycle it and restart its physical route. Outsourced parts cannot be recycled. Expired orders and their parts are cleared. Deburring and anodizing are omitted from the first three shifts and available in Night Shift, where Deburr takes four seconds and the Anodize color bath eight. There is no collision damage or random machine failure.

Mixed Orders and Rush Hour require six attended seconds of CAD before stock pickup. Use the Office to resume its unfinished drawing, or start the earliest-due unprepared job. Machines keep running while you work. Leaving pauses CAD without losing progress; recycling preserves completed CAD. The ticket and Office label show CAD progress. CAD is required only before stock pickup, with no second office step between machines.

Rush Hour has three customer calls scheduled at 27, 77, and 127 seconds. Busy machines do not suppress the ringing. While the phone rings, CAD pauses and the next office interaction answers the call. Machine handoffs, inspection, shipping, and deliveries continue normally. Answering starts a three-second conversation that you cannot walk away from. CAD pauses, but machines and deadlines keep running. A completed conversation earns 25 points once, even when you decline the rush. You can accept a separate delivery promise for 100 bonus points, or decline and keep the original promise. Every live offer is selectable, including started jobs, combined routes, and a busy shop; the player judges whether to take that risk. The rush window is at most 45 seconds, shortened when the ordinary deadline or shift ends sooner. Missing an accepted promise deducts 25 points once, clamped at zero; the ordinary order and shipping streak remain intact unless the ordinary order itself expires. Declining or leaving a call unanswered has no missed-rush penalty. Calls never overlap, and a delayed call waits at least ten seconds after the preceding call or rush ends.

The compact floor groups stock bins and optional Hold storage on the left, larger CNC machines across the back, and Inspection followed by Shipping in one right-side work area. Physical packing cartons and floor markings give that area a purpose while keeping the central aisle clear.

Fast shipping earns more points; consecutive on-time shipments build a streak up to five. Each shift has its own star thresholds shown above. The shift ends early when all jobs are resolved and no further orders can arrive; unresolved Covari offers and deliveries remain playable. An empty gap between arrivals or reaching a star target does not end it. The timer remains the upper limit and reports unfinished orders separately from missed deadlines. Early finishes can post their scores immediately and award no extra time bonus. Only shipment count determines clearing and stars; rush bonuses are optional. These are difficulty design targets, not measured human completion rates. The balance simulations establish attainability and separation between play styles; real-player testing is needed to measure how rare Rush Hour three stars actually is.

## Community features

Mixed Orders and Rush Hour can receive one outside-capability customer order after two normal shipments, at least 35 seconds into the shift, with at least 45 seconds left. First Shift has no outsourcing. Offers rotate between molded covers, Wire EDM inserts and sheet-metal brackets. Choose **Outsource with Covari · Earn 300** directly on the ticket, or **Say no** without penalty. Covari delivers a crate 22 seconds later to a permanent Receiving bench at the front edge of the shop. Collect it, use the existing QC station, then ship it to earn exactly 300 points. Delivery alone earns nothing. The order uses no normal order slot and adds no shipment/star/streak credit. Ringing calls pause CAD and take priority at the office, but floor handoffs and deliveries remain available. Answered conversations pause player actions; pause freezes production and delivery. Covari branding identifies the supplier and delivery, not the customer. This is a game simulation; it does not submit a real sourcing request.

After a real shift, **Challenge a friend** opens the native share sheet or copies an invitation containing that run's role, score and shipments. A recipient can try the challenged role even before unlocking it; the link never imports scores or permanent unlocks. Share links contain no display name. Local previews copy a clearly labeled link for this computer; they never redirect to an older public release. File-based copies retain their local file path. A shared hosted address is required for friends on other computers. Challenge targets are self-reported.

**Post score / leaderboard** optionally publishes a display name and completed result to one shared top-30 board across all shifts. There is no role filter or role label on entries. The HUD, results, personal bests, friend challenges and board all use the same earned score. There are no fixed role ceilings or role multipliers. Each shipment earns its recipe complexity value (120 for a pocket spacer, 140 for a mounting plate, 230 for a bearing housing), plus 120 for CAD when required, plus `round(seconds left on the order × 4)` for early shipping. The ordinary shipping streak multiplies that subtotal by 1.00 / 1.15 / 1.30 / 1.45 / 1.60. A completed rush adds 100; a missed accepted rush deducts up to 25 once. Completed customer conversations add 25 each; a completed outsourced order adds 300. CAD points are only credited when the part ships. Timing uses fractional seconds rather than rounding deadlines to whole seconds. CAD, more complex routes, and customer calls preserve later-shift score potential despite the bounded workloads, while efficient earlier-shift play can still beat a poorly managed harder run. The closing screen explains the components.

The board uses `roles-v8-optional-calls`. Previous results remain stored under their original ruleset and are excluded from the new rankings. Challenge links from previous seasons are ignored because their score opportunities differ. The server stores the validated completed score directly and ignores client-supplied ranking points. Scores are player-reported: the server checks run ownership, elapsed time, bounds, role and duplicate submissions, but is not an authoritative anti-cheat system. Do not use it for prizes or verified competitions without server-side replay validation and moderation. A board outage does not block the game. Local personal records remain separate from public posting.


## Run or host the modular version

Node 24 or newer runs the game plus a local persistent leaderboard without installing dependencies:

```sh
node scripts/dev-server.mjs
```

Open http://127.0.0.1:4174/. The local board lives in `.local/board.sqlite`, uses the same Worker routes, and applies the checked-in Drizzle migrations once. It is separate from the public board. `PORT=4175` can select another local port.

For the hosted build, install with `pnpm install --frozen-lockfile`, then run `pnpm build`. Output is `dist/client/` for public assets and `dist/server/index.js` for the Cloudflare Worker. `wrangler.jsonc` binds the dedicated `chip-rush` D1 database as `DB` and routes the Worker to `play.covari.io`. No runtime secrets are required. The portable `.openai/hosting.json` is for other hosting providers and is not the production configuration.

### Release to play.covari.io

Release a reviewed `main` commit with an authorized Covari Cloudflare login:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm deploy:dry-run
pnpm db:migrate:remote
pnpm deploy
```

The D1 migrations are additive and apply only to the dedicated game database. Do not seed fictional scores. Verify the homepage, `/api/leaderboard`, an actual completed shift, and the results link after deployment. The source in GitHub, a merged commit, and the public deployment are separate states; verify the public site before announcing an update.

On the public domain, the game sends anonymous shift-start, shift-completion, and Covari-link-click events to Covari's PostHog project. It sends no leaderboard name or email in those events and sends nothing from local or offline copies. The results link carries a campaign parameter so a later inquiry on `covari.io` can be attributed to the game. Those campaign-level counts do not prove that an individual visitor who played submitted an inquiry.

The self-contained `dist/CHIP-RUSH.html` still opens offline with all 3D assets. A plain static server can also serve `dist/`. Gameplay and challenge sharing work there; public score posting requires the hosted API. The portable ZIP includes source, migrations, checks and setup instructions, without the original Site identity or any local database.

## Structure

- `dist/index.html`, `style.css`: responsive game interface, tutorials, shift selection, and results.
- `dist/main.js`: Three.js scene, lighting, animations, collision, keyboard/touch input, A* click routing, and UI.
- `dist/core.js`: deterministic order, station, scoring, and shift logic.
- `dist/technology.js`: shared manufacturing-technology icons for order cards, Covari offers and machine labels.
- `dist/assets/models.js`: original dimensional asset constructors. Chamfered machine enclosures, machining internals, actual tools, storage, shipping rollers, office, articulated character, and staged parts. Static meshes are batched by material; machine pivots remain animated. This is actual 3D geometry, not a reference image or sprite background.
- `dist/social.js`: friend challenges, optional posting, and board UI.
- `server/worker.js`, `db/schema.ts`, `drizzle/`: shared leaderboard API and versioned D1 schema.
- `scripts/dev-server.mjs`: local Node/SQLite development server.
- `dist/audio.js`: original 104 BPM country/bluegrass background loop, call ducking, and synthesized shop cues. The track is bundled and embedded in the standalone build; there are no external audio services.
- `dist/vendor/`: pinned Three.js r169 and its MIT license.
- `scripts/build-offline.mjs`: reproducible standalone-file packaging, using Node and no build dependencies.
- `qa/core.test.mjs`: regression checks for the full simulation and recovery paths.
- `qa/stock.test.mjs`: stock dispatch, CAD priority and selection independence.
- `qa/sourcing.test.mjs`: offer, delivery, receiving, QC, shipment and sourcing cleanup.
- `qa/balance.mjs`: reproducible movement-aware balance simulation with serial, concurrent, and expert dash strategies.
- `qa/difficulty.test.mjs`: checks accessible clears, CAD/material step order, distinct mastery targets, rush penalties, and repeatable legal eight-shipment Rush Hour routes with either rush choice.
- `qa/PLAYTEST.md`: observed browser playtest results and validation boundaries.

To regenerate the standalone file after editing:

```sh
node scripts/build-offline.mjs
node --test qa/*.test.mjs
node qa/balance.mjs --rush --ignore-calls --expert --assert
```

The optional WebMCP enhancement exposes a read-only shop snapshot and a start-walking action in browsers that support `document.modelContext`; the game does not depend on it.

## Art and dependencies

The supplied workshop reference informed the teal/cream palette, miniature cutaway perspective, and layout details. It is not bundled or used as a flat background. All game art, interface, logic, and synthesized sound were made for this project. Three.js is used under its MIT license; see `dist/vendor/THREE-LICENSE.txt`. Renderer API reference: https://threejs.org/docs/.

The public release is deployed from a reviewed `main` commit using the steps above. Local previews and portable ZIPs remain separate from the public leaderboard.

## Release and local review boundary

The GitHub source, hosted game and standalone download contain the playable game only. Automated watch controllers and sample-score previews are kept in a separate local review folder and are not part of these releases. Historical watch-mode notes in the playtest log describe local verification, not a shipped feature.

The start page shows the top 10 submitted scores. The centered full leaderboard opens from the start page or a completed shift; posting is optional and shows the exact finished result. Empty boards invite the first real score. Sample players are never seeded into the public database.
