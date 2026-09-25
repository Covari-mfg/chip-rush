# CHIP RUSH

A complete single-player 3D machine-shop game. Original procedural assets, short shifts, timed CNC operations, multiple orders, a carried part, and a shipping streak.

[Play the current hosted build](https://chip-rush-shop.parker-joshua179.chatgpt.site/) or use the source in this repository. The hosted build is maintained separately; GitHub changes do not automatically update it. See [CONTRIBUTING.md](CONTRIBUTING.md) to propose improvements.

## Play without installing anything

Open **dist/CHIP-RUSH.html** in a current Chrome, Edge, Firefox, or Safari browser. Everything is embedded, including the 3D renderer. No account, server, network, or build step is required. WebGL 2 and hardware acceleration must be available.

Three roles, one little shop:

| Role | Shift | Clear target | New responsibility | Stars |
| --- | --- | --- | --- | --- |
| Operator | 2½ minutes | 3 shipments | Material → turn or mill → inspect → ship | 3 / 4 / 5 |
| Production Manager | 3 minutes | 4 shipments | Program each order at the office before its first cut | 4 / 6 / 7 |
| Owner | 3 minutes | 6 shipments | Tighter arrivals, combined routes, interrupting customer calls | 6 / 8 / 10 |

Clearing a role unlocks the next. Operator is welcoming, Production Manager rewards practiced scheduling, and Owner separates clearing the shift from an exceptional three-star run. The intended experience is Operator mastery after a little practice, Manager mastery after several focused attempts, and rare Owner mastery. Those are goals to validate with players, not claims about measured success rates. Briefings show all three shipment targets before the clock starts; the live counter tracks the next star. Retries use the same job sequence.

Owner orders arrive every 15 seconds after the opening order and first 12-second gap, subject to the four-order cap and enough time left to finish. Its 105-second ordinary deadlines leave recovery room, while ten shipments in three minutes requires very precise routing, machine overlap, and well-timed dashes. Rush bonuses remain optional even for three stars.

Personal bests and unlocks use the `chip-rush-roles-v5` save in this browser. Upgrading from v4 keeps unlocked roles and stars but resets personal scores for the new scoring rules; older v3/v2 saves retain unlocks only. Previous saves remain intact. Some browsers isolate or disable storage for local files; the game still works for that session.

## Watch an Owner playthrough

Open `http://127.0.0.1:4174/?watch=owner` and choose **Watch Owner run**. This is an automated expert demonstration in the actual 3D game, using ordinary selection, station travel, dashes, programming, and customer-call inputs. It uses the normal 180-second clock and ten-shipment three-star target. The controller anticipates visible machine countdowns and overlaps work. It does not inject shipments, move the character directly, or alter the rules, and it never writes your best scores or unlocks. Pause and replay controls are available.

For a live review of every role and popup, open `http://127.0.0.1:4174/?watch=sequence`. Watch Operator, review its result, then choose **Next role** for Production Manager and Owner. This sequence also selects each Covari offer, walks to the office for approval, and shows partner delivery and customer replies. Each role uses its ordinary clock, travel and operations; the sequence never saves scores or posts to the leaderboard. Individual `?watch=operator` and `?watch=manager` demonstrations are also available.

The demonstration uses a 60ms decision interval to show a precise route; it is not a claim about human execution or completion rates. It runs live at normal speed rather than playing a prerecorded video.

## Review handoff

Start with `ARNOLDAS-START-HERE.md` for local play, the review checklist, and a Codex continuation prompt. Rebuild the complete source ZIP with `python3 scripts/package-handoff.py`; it also puts a downloadable copy in `dist/downloads/`. The ZIP includes a generic hosting manifest with no existing Site identity.

## Controls

| Action | Keyboard | Mouse / touch |
| --- | --- | --- |
| Move | WASD / arrow keys | Click floor; touch joystick on touch devices |
| Use station | E / Space | Click a machine or its label to walk over and interact |
| Dash | Shift | Touch dash button |
| Select order | Tab / 1–4 | Click ticket |
| Pause | Escape / P | Pause button |

Station clicks follow smooth collision-safe paths. Shift adds a short dash that stops at the next corner or station, so precise click-and-dash routing is available on desktop.

In desktop windows, active orders stay in a permanent left column, oldest first. Customer-call controls and the carrying panel share that column, giving the 3D shop the main area on the right. Essential game text stays at 13.5 CSS pixels or larger. The rail scrolls rather than shrinking cards; keyboard selection reveals the selected order. Narrow screens use a horizontal order list.

Select an order, collect its billet at **Material**, and follow its route. Machines work unattended. Collect the finished part when the station label says **READY**. Inspection must finish before Shipping accepts the part. The Hold bench stores one part. Return a carried part to Material to recycle it and restart that order if the shop gets jammed. Expired orders are canceled and their parts are cleared. The Hold Bench is optional storage, not a required operation. Deburring and anodizing equipment are omitted from these three roles to avoid unused stations. There is no collision damage or random machine failure.

Programming takes four attended seconds at the office. Select a ticket, then click Office or walk to the desk and press E. You can collect material first, but the first cut requires a completed program. Machines keep running while you program. The machinist sits in the office chair to type or answer the phone, and stands up when leaving. Walking away preserves your progress. The ticket and Office label show programming progress; there is no separate programming panel.

Owner has three customer calls scheduled at 27, 77, and 127 seconds. Busy machines do not suppress the ringing. The phone chatters and physical handoffs stop until you answer at the office or the caller hangs up. Answering starts a three-second conversation that you cannot walk away from. Programming pauses, but machines and deadlines keep running. A completed conversation earns 25 points once, even when you decline the rush. You then accept a separate 45-second delivery window worth 100 bonus points, or keep the original promise. Accept is only available when machine capacity and remaining time support a fair rush; the call still happens when there is no spare capacity. Declining has no score penalty. Calls never overlap, and a delayed call waits at least ten seconds after the preceding call or rush ends. Missing a bonus leaves the ordinary order and shipping streak intact.

The compact floor groups Material and optional Hold storage on the left, larger CNC machines across the back, and Inspection followed by Shipping in one right-side work area. Physical packing cartons and floor markings give that area a purpose while keeping the central aisle clear.

Fast shipping earns more points; consecutive on-time shipments build a streak up to five. Each role has its own star thresholds shown above. Closing ends all work immediately and reports unfinished orders separately from missed deadlines. Only shipment count determines clearing and stars; rush bonuses are optional. These are difficulty design targets, not measured human completion rates. The balance simulations establish attainability and separation between play styles; real-player testing is needed to measure how rare Owner three stars actually is.

## Community features

Every role receives one optional outside-capability job at 35 seconds. Offers rotate through Injection molding, Wire EDM insert and Sheet metal assembly across shifts and retries. The type changes the title and capability description only; timing, reward and workload stay the same. It uses no regular order slot. Choose **Outsource with Covari**, then click the Office computer and spend two attended seconds placing it. The real Covari logo appears on the bonus card and the computer while placing the job. The card uses the website’s Instrument Sans typeface, bundled locally with its SIL Open Font License; the single-file game embeds the font too. This bonus is available in Operator, Production Manager and Owner. A partner delivers 22 seconds later for 60 bonus points in any role, below normal machining rewards. Passing or ignoring the offer has no penalty. Sourcing never adds shipments, stars or streak credit, and calls pause approval. This is a game simulation; it does not submit a real sourcing request.

After a real shift, **Challenge a friend** opens the native share sheet or copies an invitation containing that run's role, score and shipments. A recipient can try the challenged role even before unlocking it; the link never imports scores or permanent unlocks. Share links contain no display name. Local previews copy a clearly labeled link for this computer; they never redirect to an older public release. File-based copies retain their local file path. A shared hosted address is required for friends on other computers. Challenge targets are self-reported.

**Post score / leaderboard** optionally publishes a display name and completed result to one shared top-30 board across all roles. There is no role filter or role label on entries. The HUD, results, personal bests, friend challenges and board all use the same earned score. There are no fixed role ceilings or role multipliers. Each shipment earns its recipe complexity value (120 for a pocket spacer, 140 for a mounting plate, 230 for a bearing housing), plus 60 for CAM work when required, plus `round(seconds left on the order × 4)` for early shipping. The ordinary shipping streak multiplies that subtotal by 1.00 / 1.15 / 1.30 / 1.45 / 1.60. A completed rush adds 100. Completed customer conversations add 25 each; the Covari bonus adds 60. CAM points are only credited when the part ships. Timing uses fractional seconds rather than rounding deadlines to whole seconds. More demanding roles provide more work and extra scoring opportunities, so an efficient lower-role run can still beat a poorly managed harder run. The closing screen explains the components. Shipment targets, deadlines, role unlocks and star requirements are unchanged. The board uses `roles-v5-performance`, keeping old entries intact but outside the current score season; the server stores the validated completed score directly and ignores client-supplied ranking points. Demo runs cannot post. Scores are player-reported: the server checks run ownership, elapsed time, bounds, role and duplicate submissions, but is not an authoritative anti-cheat system. Do not use it for prizes or verified competitions without server-side replay validation and moderation. A board outage does not block the game. Local personal records remain separate from public posting.

Cards now show **SELECTED** or **CLICK TO SELECT**, and the first machine operation prompts players to select a second card. Switching cards never changes a carried part.

## Run or host the modular version

Node 24 or newer runs the game plus a local persistent leaderboard without installing dependencies:

```sh
node scripts/dev-server.mjs
```

Open http://127.0.0.1:4174/. The local board lives in `.local/board.sqlite`, uses the same Worker routes, and applies the checked-in Drizzle migrations once. It is separate from the public board. `PORT=4175` can select another local port.

For the hosted build, install with `pnpm install`, then run `pnpm build`. Output is `dist/client/` for public assets and `dist/server/index.js` for a Cloudflare-compatible Worker. The generic `.openai/hosting.json` declares the logical D1 binding `DB`; Sites applies `drizzle/` migrations on publication. No runtime secrets are required. Keep the configured Site identity in the separate publishing checkout.

The self-contained `dist/CHIP-RUSH.html` still opens offline with all 3D assets. A plain static server can also serve `dist/`. Gameplay and challenge sharing work there; public score posting requires the hosted API. The portable ZIP includes source, migrations, checks and setup instructions, without the original Site identity or any local database.

## Structure

- `dist/index.html`, `style.css`: responsive game interface, tutorials, shift selection, and results.
- `dist/main.js`: Three.js scene, lighting, animations, collision, keyboard/touch input, A* click routing, and UI.
- `dist/core.js`: deterministic order, station, scoring, and shift logic.
- `dist/assets/models.js`: original dimensional asset constructors. Chamfered machine enclosures, machining internals, actual tools, storage, shipping rollers, office, articulated character, and staged parts. Static meshes are batched by material; machine pivots remain animated. This is actual 3D geometry, not a reference image or sprite background.
- `dist/social.js`: friend challenges, optional posting, and board UI.
- `server/worker.js`, `db/schema.ts`, `drizzle/`: shared leaderboard API and versioned D1 schema.
- `scripts/dev-server.mjs`: local Node/SQLite development server.
- `dist/audio.js`: locally synthesized feedback and light rhythm.
- `dist/vendor/`: pinned Three.js r169 and its MIT license.
- `scripts/build-offline.mjs`: reproducible standalone-file packaging, using Node and no build dependencies.
- `qa/core.test.mjs`: regression checks for the full simulation and recovery paths.
- `qa/balance.mjs`: reproducible movement-aware balance simulation with serial, concurrent, and expert dash strategies.
- `qa/difficulty.test.mjs`: checks accessible clears, separated mastery targets, and repeatable legal ten-shipment Owner routes.
- `dist/demo.js`, `qa/demo.test.mjs`: visible expert demonstration and checks using the real movement, collision, station, and game code at multiple frame rates.
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

Development currently stays local and in GitHub for collaboration. Do not publish or deploy unless explicitly requested.
