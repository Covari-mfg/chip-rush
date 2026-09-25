# Contributing to CHIP RUSH

Everyone is welcome to suggest improvements. Open an issue for a bug or idea, or fork the repository and open a pull request with a focused change. Include what changed and how you checked it. If a change affects play, describe the role and the result of a real playtest.

The editable game is in `dist/`. After changing it, rebuild the standalone `dist/CHIP-RUSH.html` and run the checks from the repository root:

```sh
node scripts/build-offline.mjs
node --test qa/core.test.mjs qa/difficulty.test.mjs qa/demo.test.mjs
node qa/balance.mjs --rush --ignore-calls --expert --assert
```

For a local browser preview, run `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` and open <http://127.0.0.1:4173/>. The [start guide](ARNOLDAS-START-HERE.md) explains the controls and playtest questions.

Please keep the role targets and the three Owner calls intact unless a change explicitly proposes a new balance design. The automated Owner run should obey the same game rules as a player.
