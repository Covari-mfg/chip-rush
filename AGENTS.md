# Agent guidance

- Before adding a level, read [docs/model-experiment.md](docs/model-experiment.md).
  It defines the creative experiment, shared access conditions, iteration record,
  and reusable prompt. New levels may evolve maps, art, music, and gameplay.
- Read [docs/level-design.md](docs/level-design.md) for the current levels and
  implementation. It describes existing behavior, not a template for new levels.
- Preserve released levels and data compatibility. New mechanics may differ;
  review saves, stable IDs, legacy numeric indices, scoring, leaderboards,
  challenge links, and migrations explicitly. Append rather than reorder indices.
- Do not invent future maps or challenges during unrelated work. When a new
  level is requested, make the next playable chapter and record its actual
  design, tools, model/harness credits, iterations, and verification.
- Use proportional gates. Run focused tests for copy or metadata changes; use
  the full test, build, and browser evidence required by the affected behavior.
- Separate observed evidence, reproducible simulation results, and design
  intent. Do not present unverified difficulty claims as player data.
