# CHIP RUSH: start here, Arnoldas

This package contains the playable game, its editable source, and the checks used to test it. It is a single-player 3D machine shop game about keeping work moving while responsibilities pile up.

## Play the downloaded game

1. Extract the ZIP into a normal folder first.
2. Open `dist/CHIP-RUSH.html` in a current browser. This is the self-contained version; it needs no account, installation, or internet connection.
3. Start with Operator. Clearing a role unlocks the next one.

Click a station to walk there and use it. Alternatively, move with WASD or the arrow keys and press E to interact. Shift dashes, Tab selects the next order, and Escape pauses. Machines keep working while you handle other jobs.

The standalone file was built and syntax checked. Full browser playtests used the local server below; if opening the file directly gives trouble, use that route. The browser needs WebGL 2 and hardware acceleration.

## Run locally and watch the Owner demonstration

With Python 3 installed, open a terminal in the extracted folder containing this document and run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

- Play: <http://127.0.0.1:4173/>
- Watch: <http://127.0.0.1:4173/?watch=owner>, then choose **Watch Owner run**.

Keep the terminal open while playing; Ctrl+C stops the server. The watch mode runs an automated expert live at normal speed, using the same movement, machine times, and rules as the game. It does not save scores or unlocks. It demonstrates a legal route, not a human success rate.

## What to review

Stars depend on shipped orders, not score or rush bonuses.

| Role | Shift | Clear / one star | Two stars | Three stars |
| --- | --- | ---: | ---: | ---: |
| Operator | 2½ minutes | 3 | 4 | 5 |
| Production Manager | 3 minutes | 4 | 6 | 7 |
| Owner | 3 minutes | 6 | 8 | 10 |

Operator should feel welcoming. Manager adds four seconds of attended programming per order and rewards overlapping work. Owner three stars should be an exceptional achievement worth replaying for.

Owner has three calls scheduled at 27, 77, and 127 seconds into the shift. Calls can queue behind an earlier call or rush. Ringing interrupts handoffs; answering requires three uninterrupted seconds while machines and deadlines keep running. Rush acceptance is checked for available capacity. Declining preserves the original promise without a score penalty.

- **Fairness:** Are failures understandable, and does retrying reward learning? Record role, shipments, stars, and roughly how many attempts you needed.
- **Controls and layout:** Can you see your carried part, the next operation, and ready machines? Does the shop stay readable in an ordinary window? Check sitting at the office and walking away.
- **Phones:** Are all three interruptions clear and meaningful? Can you understand the rush choice without losing track of existing orders?

## Continue in Codex

Open the extracted folder containing this document and `README.md` as a project in your Codex app. Keep the complete folder, including `dist`, `qa`, and `scripts`. No npm install is needed; Node.js is needed for the checks and standalone rebuild.

Copy this prompt into a new task in that project:

> Review this CHIP RUSH game. First read ARNOLDAS-START-HERE.md, README.md, and the latest section of qa/PLAYTEST.md. Run the baseline commands below, then play the game and the Owner demonstration. Start by reporting concrete issues and suggested improvements. Preserve the current work and keep changes focused. Keep star targets at Operator 3/4/5, Production Manager 4/6/7, and Owner 6/8/10, with three scheduled Owner calls. Do not lower targets or add hidden demonstration advantages to make tests pass. The demo must use ordinary movement, interactions, timings, and scoring. After any edits, rerun the relevant checks, playtest the affected flow, and rebuild the standalone file. Report exactly what was tested and any remaining limitations.

Baseline checks:

```sh
node --test qa/core.test.mjs qa/difficulty.test.mjs qa/demo.test.mjs
node qa/balance.mjs --rush --ignore-calls --expert --assert
```

After source changes, rebuild the standalone version:

```sh
node scripts/build-offline.mjs
```

See [README.md](README.md) for the source map and [qa/PLAYTEST.md](qa/PLAYTEST.md) for verification history. Sections below the latest version describe older builds.

The package has no existing hosted Site ID or repository history. Opening it in your Codex does not connect your copy to Josh’s published test site.

## Community update

Run `node scripts/dev-server.mjs` with Node 24+ and open http://127.0.0.1:4174/ to test the complete game and a local persistent score board. No dependency install is needed to play locally. `pnpm install && pnpm build` creates the hosted Worker + assets. See README for the D1 schema, player-reported score validation boundary, friend links, and optional Covari sourcing job. `CHIP-RUSH.html` remains fully playable offline; the shared board needs the hosted API.
