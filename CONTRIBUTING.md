# Contributing to CHIP RUSH

Everyone is welcome to suggest improvements. Open an issue for a bug or idea, or fork the repository and open a pull request with a focused change. Include what changed and how you checked it. If a change affects play, describe the role and the result of a real playtest.

The editable game is in `dist/`. The order rail is informational: stock-bin interactions dispatch the earliest-due matching CAD-ready order, and the office dispatches or resumes the earliest-due CAD work. Keep that workflow and the Hold bench/ready-machine swap behavior covered when changing play. After changing it, rebuild the standalone `dist/CHIP-RUSH.html` and run the checks from the repository root:

```sh
node scripts/build-offline.mjs
node --test qa/*.test.mjs
node qa/balance.mjs --rush --ignore-calls --expert --assert
```

For a complete local preview with the shared-score API, run `node scripts/dev-server.mjs` (Node 24+) and open <http://127.0.0.1:4174/>. Its SQLite database stays in ignored `.local/`. Use `pnpm install` then `pnpm build` for the hosted Worker build. Add schema changes to `db/schema.ts`, generate new migrations with `pnpm db:generate`, and preserve previously applied migration files. The [start guide](ARNOLDAS-START-HERE.md) explains the controls and playtest questions.

Please keep the role targets and the three Owner calls intact unless a change explicitly proposes a new balance design. The optional Covari path is limited to Manager and Owner after two normal shipments, then receiving, QC, and a 300-point shipment. The automated Owner run should obey the same game rules as a player.
