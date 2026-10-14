# CHIP RUSH: start here, Arnoldas

This package contains the playable game, its editable source, and the checks used to test it. It is a single-player 3D machine shop game about keeping work moving while responsibilities pile up.

## Play the downloaded game

1. Extract the ZIP into a normal folder first.
2. Open `dist/CHIP-RUSH.html` in a current browser. This is the self-contained version; it needs no account, installation, or internet connection.
3. Start with First Shift. Once you have played it, cleared or not, every shift is open.

Click a station to walk there and use it. Alternatively, move with WASD or the arrow keys and press E to interact. Shift dashes and Escape pauses. The top order rail is a read-only dispatch view; you do not need to select a ticket. Machines keep working while you handle other jobs.

See the latest entry in qa/PLAYTEST.md for current build and browser verification. Browser playtests use the local server below; if opening the file directly gives trouble, use that route. The browser needs WebGL 2 and hardware acceleration.

## Run locally

With Python 3 installed, open a terminal in the extracted folder containing this document and run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

- Play: <http://127.0.0.1:4173/>

Keep the terminal open while playing; Ctrl+C stops the server.

## What to review

For the current three levels, stars depend on shipped orders, not score or rush bonuses. Shifts finish early when all jobs are resolved and no more can arrive; an empty queue between arrivals does not end a shift. Outstanding Covari work must also resolve.

| Level | Time limit | Clear / one star | Two stars | Three stars |
| --- | --- | ---: | ---: | ---: |
| First Shift | 2½ minutes | 3 | 4 | 5 |
| Mixed Orders | 3 minutes | 4 | 5 | 6 |
| Rush Hour | 3 minutes | 5 | 6 | 8 |
| Night Shift | 3½ minutes | 4 | 5 | 6 |
| Blackout Shift | 3 minutes | 5 | 6 | 8 |
| Launch Window | T−3:40 countdown | 4 | 5 | 7 |

Night Shift (level 4) is a calmer after-hours chapter: no calls, a darker shop, a Covari offer for finishing work the floor cannot do (heat treatment, powder coating or laser marking), and two new stations, DEBURR and ANODIZE, in the middle of the floor. Its routes run up to four steps between stock and inspection, and two orders share the single color bath. Worth checking: is the finishing island readable, and do the dial-knob, ocean-collar, satin-bracket and valve-body routes feel fair?

Blackout Shift (level 5, `dawn-shift`) breaks out of the "add another machine" pattern: a pre-dawn storm knocks out the grid, the existing 5 stations rearrange into West (`LATHE` + `DEBURR`) and East (`MILL` + `ANODIZE`) cells around a central `INSPECT` hub and a 3D `BACKUP GENERATOR · OVERDRIVE BUS`, emergency orders need zero CAD delay, running 2+ machines triggers 1.5× Harmonic Overdrive, the Office `SURGE CONSOLE` and scheduled lightning strikes unleash 2.0× Generator Surges, a synthesized 128 BPM storm-synth soundtrack plays, and Covari offers precision capability-gap jobs (Wire EDM, Heat treatment, Laser marking). See `docs/experiments/dawn-shift.md`.

Launch Window (level 6) is the morning after Blackout Shift and the shop's big break: the storm also scrubbed a launch down the coast, and the rescheduled dawn window needs flight hardware for the rocket on the pad next to the hangar, against a countdown from blue hour to sunrise. Every order is a kit of two or three parts; machine each one, drop it at the robot assembly cell, which joins the kit on its own, then inspect the assembly and send it TO PAD. A crane stacks every shipment onto the rocket. At T−10 it lifts off with four or more sections, or the launch scrubs. Worth checking: are kit tickets readable at a glance, does the cell (drop parts any time, collect when ready) feel natural, is the liftoff worth the work, and is the full seven-section stack hard but fair? See `docs/experiments/launch-window.md`.

Open for Business is a separate game mode with its own start-screen tab, always open (stars at 3 / 5 / 7 days survived; it does not unlock or require shifts). It is a shop-manager mode: keep the shop running, take or refuse quotes, buy machines and hire staff, and survive rent and wages each evening. Worth checking: do quotes with crossed-out steps read clearly, is the Shop panel (M) quick enough mid-day, do staff feel useful rather than in the way, and once south halls open, does zooming and dragging around the bigger floor feel natural? Its economy is simulated with `node qa/manager-balance.mjs`; see docs/experiments/open-for-business.md.

First Shift should feel welcoming. The current three levels follow **matching stock bin → turn or mill (sometimes both) → Inspection → Shipping**; Mixed Orders and Rush Hour add six seconds of attended CAD before stock and reward overlapping work. The office automatically starts the earliest-due unprogrammed order and resumes a partial CAD job. After CAD is ready, walk to ROUND, PLATE, or BLOCK stock; each bin automatically gives you the earliest-due matching order. Material pickup requires completed CAD in levels that use programming. Mixed Orders has at most six jobs, with a 16-second opening gap and 25-second later spacing. Rush Hour has at most eight jobs, with a 12-second opening gap and 18-second later spacing. Both retain the four-active-order limit and closing-time safety check. Rush Hour three stars should reward practiced scheduling and routing.

The Hold bench is a working part of the flow: use it to park a carried part, collect another, or swap the carried and parked parts in one interaction. Ready machine outputs also swap with a compatible carried part, preserving both jobs’ progress.

Rush Hour has three calls scheduled at 27, 77, and 127 seconds into the shift. Calls can queue behind an earlier call or rush. Ringing blocks CAD, and the next Office interaction answers first. Floor work, inspection, shipping, sourcing, and receiving remain available. Answering locks actions for three seconds while machines and deadlines keep running. A live offer can always be accepted, even for a started or complex job while machines are busy. The separate rush window is at most 45 seconds and cannot outlast the ordinary deadline or closing time. Success earns 100 points. Missing an accepted promise costs 25 points once, clamped at zero. Declining preserves the original promise without a penalty. Both choices can still earn three stars.

- **Fairness:** Are failures understandable, and does retrying reward learning? Record level, shipments, stars, and roughly how many attempts you needed.
- **Controls and layout:** Can you see your carried part, the next operation, and ready machines? Does the shop stay readable in an ordinary window? Check sitting at the office and walking away.
- **Phones:** Are all three interruptions clear and meaningful? Can you understand the rush choice without losing track of existing orders?

## Continue in Codex

Open the extracted folder containing this document and `README.md` as a project in your Codex app. Keep the complete folder, including `dist`, `qa`, and `scripts`. No npm install is needed; Node.js is needed for the checks and standalone rebuild.

Copy this prompt into a new task in that project:

> Here's CHIP RUSH. Read AGENTS.md and docs/model-experiment.md, then play and understand the current game. Continue its arc by creating the next playable level. You can evolve the map, visuals, music, pacing, and gameplay in your own direction; the existing levels are context, not a template. Make it feel like the next chapter of this game and show your creative and engineering judgment. Check and record the tools available to you before starting. Build a playable local version for us to iterate on together. Keep earlier levels working, credit the model and harness used, and document what you changed and how you tested it. We will iterate until I approve the level for release.

Baseline checks:

```sh
node --test qa/core.test.mjs qa/difficulty.test.mjs
node qa/balance.mjs --rush --ignore-calls --expert --assert
```

After source changes, rebuild the standalone version:

```sh
node scripts/build-offline.mjs
```

See [README.md](README.md) for the source map and [qa/PLAYTEST.md](qa/PLAYTEST.md) for verification history. Sections below the latest version describe older builds.

The package has no existing hosted Site ID or repository history. Opening it in your Codex does not connect your copy to Josh’s published test site.

## Community update

Run `node scripts/dev-server.mjs` with Node 24+ and open http://127.0.0.1:4174/ to test the complete game and a local persistent score board. No dependency install is needed to play locally. `pnpm install && pnpm build` creates the hosted Worker + assets. See README for the D1 schema, player-reported score validation boundary, and friend links. `CHIP-RUSH.html` remains fully playable offline; the shared board needs the hosted API.

Publication is coordinated separately from GitHub collaboration. The optional Covari flow is available in Mixed Orders, Rush Hour and Night Shift after two normal shipments: select **Outsource with Covari**, receive the delivery, run QC, then ship for 300 points.
