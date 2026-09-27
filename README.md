# CHIP RUSH

A complete single-player 3D machine-shop game. Original procedural assets, short shifts, timed CNC operations, multiple orders, a carried part, and a shipping streak.

[Play the current hosted build](https://chip-rush-shop.parker-joshua179.chatgpt.site/) or use the source in this repository. The hosted build is maintained separately; GitHub changes do not automatically update it. See [CONTRIBUTING.md](CONTRIBUTING.md) to propose improvements.

## Play without installing anything

Open **dist/CHIP-RUSH.html** in a current Chrome, Edge, Firefox, or Safari browser. Everything is embedded, including the 3D renderer. No account, server, network, or build step is required. WebGL 2 and hardware acceleration must be available.

Three roles, one little shop:

| Role | Shift | Clear target | New responsibility | Stars |
| --- | --- | --- | --- | --- |
| Operator | 2½ minutes | 3 shipments | Material → turn or mill → inspect → ship | 3 / 4 / 5 |
| Production Manager | 3 minutes | 4 shipments | CAD → material → turn or mill (sometimes both) → inspect → ship | 4 / 5 / 6 |
| Owner | 3 minutes | 5 shipments | CAD and combined routes, plus interrupting customer calls | 5 / 6 / 8 |

Clearing a role unlocks the next. Operator is welcoming, Production Manager rewards practiced scheduling, and Owner separates clearing the shift from an exceptional three-star run. The intended experience is Operator mastery after a little practice, Manager mastery after several focused attempts, and rare Owner mastery. Those are goals to validate with players, not claims about measured success rates. Briefings show all three shipment targets before the clock starts; the live counter tracks the next star. Retries use the same job sequence.

Operator opens with one order, then waits 18 seconds before the second and spaces later arrivals 19 seconds apart. This gives the first part more breathing room while keeping the existing seventh order eligible before the late-order safety cutoff. The job values, deadlines, score formula, and star targets stay the same.

Manager has at most six orders: an opening order, a 16-second gap, then 25-second intervals. Its sequence includes two bearing housings that need both turning and milling. Owner has at most eight orders, a first 12-second gap, then 18-second intervals, with three bearing housings in its sequence. Both roles retain the four-active-order limit and the closing-time check, which can substitute a shorter route or stop arrivals if work cannot reasonably finish. Ordinary deadlines are 105 seconds, plus 14 seconds for the opening order. Owner mastery requires planning, machine overlap, and practiced routing; rush bonuses remain optional even for three stars.

Personal bests and unlocks use the `chip-rush-roles-v6` save in this browser. Upgrading from v5 keeps unlocked roles and the unchanged Operator's score and stars; Manager and Owner records restart for the revised workload and CAD rules. Older v4/v3/v2 saves retain unlocks only. Previous saves remain intact. Some browsers isolate or disable storage for local files; the game still works for that session.

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

Small technology badges connect each order to its machine: turning and milling use matching icons on the card and station label, and orders needing both show both. Covari cards have distinct EDM, IM and SM badges for wire EDM, injection molding and sheet metal assembly. Each badge also has a full technology name for assistive text and its tooltip.

Select an order and follow its ticket from left to right. Operator starts at **Material**. Manager and Owner first complete **CAD** at the office, then collect a billet at **Material** and follow the machine route. Machines work unattended. Collect the finished part when the station label says **READY**. Inspection must finish before Shipping accepts the part. The Hold bench stores one part. Return a carried part to Material to recycle it and restart that order if the shop gets jammed. Expired orders are canceled and their parts are cleared. The Hold Bench is optional storage, not a required operation. Deburring and anodizing equipment are omitted from these three roles to avoid unused stations. There is no collision damage or random machine failure.

CAD takes six attended seconds at the office. Select a ticket, then click Office or walk to the desk and press E. Material pickup stays blocked until that order's CAD is complete. Machines keep running while you work at the desk. The machinist sits in the office chair to type or answer the phone, and stands up when leaving. Walking away preserves your progress; recycling the physical part preserves completed CAD. The ticket and Office label show CAD progress. There is one office preparation step before Material, with no second office step between Material and the machines.

Owner has three customer calls scheduled at 27, 77, and 127 seconds. Busy machines do not suppress the ringing. The phone chatters and physical handoffs stop until you answer at the office or the caller hangs up. Answering starts a three-second conversation that you cannot walk away from. CAD pauses, but machines and deadlines keep running. A completed conversation earns 25 points once, even when you decline the rush. You can accept a separate delivery promise for 100 bonus points, or decline and keep the original promise. Every live offer is selectable, including started jobs, combined routes, and a busy shop; the player judges whether to take that risk. The rush window is at most 45 seconds, shortened when the ordinary deadline or shift ends sooner. Missing an accepted promise deducts 25 points once, clamped at zero; the ordinary order and shipping streak remain intact unless the ordinary order itself expires. Declining or leaving a call unanswered has no missed-rush penalty. Calls never overlap, and a delayed call waits at least ten seconds after the preceding call or rush ends.

The compact floor groups Material and optional Hold storage on the left, larger CNC machines across the back, and Inspection followed by Shipping in one right-side work area. Physical packing cartons and floor markings give that area a purpose while keeping the central aisle clear.

Fast shipping earns more points; consecutive on-time shipments build a streak up to five. Each role has its own star thresholds shown above. Closing ends all work immediately and reports unfinished orders separately from missed deadlines. Only shipment count determines clearing and stars; rush bonuses are optional. These are difficulty design targets, not measured human completion rates. The balance simulations establish attainability and separation between play styles; real-player testing is needed to measure how rare Owner three stars actually is.

## Community features

Every role receives one optional outside-capability job at 35 seconds. Offers rotate through Injection molding, Wire EDM insert and Sheet metal assembly across shifts and retries. The type changes the title and capability description only; timing, reward and workload stay the same. It uses no regular order slot. Choose **Outsource with Covari**, then click the Office computer and spend two attended seconds placing it. The real Covari logo appears on the bonus card and the computer while placing the job. The card uses the website’s Instrument Sans typeface, bundled locally with its SIL Open Font License; the single-file game embeds the font too. This bonus is available in Operator, Production Manager and Owner. A partner delivers 22 seconds later for 60 bonus points in any role, below normal machining rewards. Passing or ignoring the offer has no penalty. Sourcing never adds shipments, stars or streak credit, and calls pause approval. This is a game simulation; it does not submit a real sourcing request.

After a real shift, **Challenge a friend** opens the native share sheet or copies an invitation containing that run's role, score and shipments. A recipient can try the challenged role even before unlocking it; the link never imports scores or permanent unlocks. Share links contain no display name. Local previews copy a clearly labeled link for this computer; they never redirect to an older public release. File-based copies retain their local file path. A shared hosted address is required for friends on other computers. Challenge targets are self-reported.

**Post score / leaderboard** optionally publishes a display name and completed result to one shared top-30 board across all roles. There is no role filter or role label on entries. The HUD, results, personal bests, friend challenges and board all use the same earned score. There are no fixed role ceilings or role multipliers. Each shipment earns its recipe complexity value (120 for a pocket spacer, 140 for a mounting plate, 230 for a bearing housing), plus 120 for CAD when required, plus `round(seconds left on the order × 4)` for early shipping. The ordinary shipping streak multiplies that subtotal by 1.00 / 1.15 / 1.30 / 1.45 / 1.60. A completed rush adds 100; a missed accepted rush deducts up to 25 once. Completed customer conversations add 25 each; the Covari bonus adds 60. CAD points are only credited when the part ships. Timing uses fractional seconds rather than rounding deadlines to whole seconds. CAD, more complex routes, and customer calls preserve higher-role score potential despite the bounded workloads, while efficient lower-role play can still beat a poorly managed harder run. The closing screen explains the components.

The board uses `roles-v6-cad-rush`. Comparable Operator entries from `roles-v5-performance` remain in the rankings; older Manager and Owner entries remain stored under their original ruleset. The server stores the validated completed score directly and ignores client-supplied ranking points. Scores are player-reported: the server checks run ownership, elapsed time, bounds, role and duplicate submissions, but is not an authoritative anti-cheat system. Do not use it for prizes or verified competitions without server-side replay validation and moderation. A board outage does not block the game. Local personal records remain separate from public posting.

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
- `dist/technology.js`: shared manufacturing-technology icons for order cards, Covari offers and machine labels.
- `dist/assets/models.js`: original dimensional asset constructors. Chamfered machine enclosures, machining internals, actual tools, storage, shipping rollers, office, articulated character, and staged parts. Static meshes are batched by material; machine pivots remain animated. This is actual 3D geometry, not a reference image or sprite background.
- `dist/social.js`: friend challenges, optional posting, and board UI.
- `server/worker.js`, `db/schema.ts`, `drizzle/`: shared leaderboard API and versioned D1 schema.
- `scripts/dev-server.mjs`: local Node/SQLite development server.
- `dist/audio.js`: original 104 BPM country/bluegrass background loop, call ducking, and synthesized shop cues. The track is bundled and embedded in the standalone build; there are no external audio services.
- `dist/vendor/`: pinned Three.js r169 and its MIT license.
- `scripts/build-offline.mjs`: reproducible standalone-file packaging, using Node and no build dependencies.
- `qa/core.test.mjs`: regression checks for the full simulation and recovery paths.
- `qa/balance.mjs`: reproducible movement-aware balance simulation with serial, concurrent, and expert dash strategies.
- `qa/difficulty.test.mjs`: checks accessible clears, CAD/material step order, distinct mastery targets, rush penalties, and repeatable legal eight-shipment Owner routes with either rush choice.
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

## Release and local review boundary

The GitHub source, hosted game and standalone download contain the playable game only. Automated watch controllers and sample-score previews are kept in a separate local review folder and are not part of these releases. Historical watch-mode notes in the playtest log describe local verification, not a shipped feature.

The start page shows the top 10 submitted scores. The centered full leaderboard opens from the start page or a completed shift; posting is optional and shows the exact finished result. Empty boards invite the first real score. Sample players are never seeded into the public database.
