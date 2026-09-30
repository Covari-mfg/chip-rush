# CHIP RUSH: an evolving model experiment

## The experiment

Each new level is a new model-and-harness collaboration. Start from the released
game, continue its machine-shop story, and let the next model express its own
creativity and engineering. The first three levels form The First Shop; they
are a starting point, not a specification for everything that follows.

This is an iterative, human-directed experiment, not a one-shot benchmark or a
controlled ranking of model intelligence. The creator plays, gives feedback,
and iterates with the model until the level feels ready to release. Record
that process rather than hiding it. Later runs inherit earlier work, and tool
access, human feedback, time, and other models can affect the outcome.

## The reusable prompt

> Here's CHIP RUSH. Read AGENTS.md and docs/model-experiment.md, then play and
> understand the current game. Continue its arc by creating the next playable
> level. You can evolve the map, visuals, music, pacing, and gameplay in your
> own direction; the existing levels are context, not a template. Make it feel
> like the next chapter of this game and show your creative and engineering
> judgment. Check and record the tools available to you before starting. Build
> a playable local version for us to iterate on together. Keep earlier levels
> working, credit the model and harness used, and document what you changed
> and how you tested it. We will iterate until I approve the level for release.

Supply the actual model and harness if they are not reliably available from
the environment. Never guess them from this document or copy a prior credit.

## Creative freedom

You may create a different shop layout or setting, art direction, camera,
music, soundscape, machines, order flow, interactions, objectives, and difficulty.
You may introduce mechanics, reinterpret existing ones, or omit mechanics that
do not suit the new level. A level need not be harder than the last one. You
may refactor or extend the engine when your design needs it.

Keep a recognizable connection to the world and the player's journey. Explain
that connection briefly; no predetermined plot, map sequence, visual style,
machine list, or future mechanic is prescribed here. Prefer a playable idea to
a speculative framework for many unbuilt levels. Build the next level; leave
later authors room to take the story somewhere else.

Covari belongs in this world as an option for outsourcing a customer's work,
not as the customer placing the order. You may find a new way to express that
idea when it fits. Decision (2026-09-29): every new level includes Covari
outsourcing, because there is always something the shop cannot do. Build a real
capability gap, meaning a process or step with no station on that level's floor,
so outsourcing is the way to fulfil it. Reuse the shared offer rules (optional,
after two normal shipments, delivery to Receiving, QC, 300 points, no order slot
or star credit) or document any deliberate change. First Shift predates the
decision and is unchanged.

## Shared starting conditions

Aim to offer every run the same categories of access. Confirm actual access at
the start and record any differences; listing a tool here does not install it
or grant credentials. A missing tool is an experiment condition to report,
not a reason to invent evidence or silently require a paid service.

| Condition | Shared starting offer | Record for this run |
| --- | --- | --- |
| Starting game | Full source, existing assets, tests, documentation, and a playable local preview of the latest released game | Base commit and starting level count |
| Development | Filesystem, terminal, Git, compatible Node, package manager, Python, and project build tools | Relevant versions and limitations |
| Playtesting | A WebGL-capable browser; manual play, screenshots, and browser automation when supported by the harness | Browser, viewport, input method, and automation access |
| 3D assets | Existing procedural Three.js geometry; Blender is an optional offered asset-creation tool | Whether Blender is installed and usable, version if used, or chosen alternative |
| Music and sound | Existing audio, its procedural generator, and Python/NumPy plus FFmpeg where available | Available tools, tools used, and asset provenance |
| Research and assets | Documentation/web access and additional asset tools where available | Tools/services used, licenses, costs, and access differences |
| Assistance | Human playtesting and iteration; delegation if supported and agreed for the run | Other models/agents, assigned work, and human interventions |
| Completion | Local review and iteration until the creator approves release | Iteration history, approval, and released commit |

Tool choice is free: access to Blender does not mean every model must use it.
Harnesses will expose different interfaces. Offer comparable capabilities and
record deviations rather than claiming identical conditions. Paid services,
new credentials, deployments, and external communications require the usual
user authorization; this brief supplies none of those by itself.

The reference implementation uses procedural Three.js geometry in
`dist/assets/models.js` and original synthesized music generated by
`scripts/music/generate_country_music.py`. That is evidence of its production
method, not evidence that Blender was used. The first three levels display
`GPT-6 Astra - Codex` at the creator's request. Their development predates this
run-record format and included delegated implementation, so that display
credit must not be presented as proof of exclusive, unaided model authorship.

## Boundaries that protect the released game

- Keep earlier released levels playable with their intended behavior. Shared
  improvements are welcome when tested; changing an old level's design needs
  an explicit decision, not an accidental side effect of adding a new one.
- Preserve existing saves, stable level IDs, challenge links, and historical
  scores, or design and document a migration. Append new levels to the legacy
  numeric index list rather than reordering it.
- Existing timers, CAD, calls, routes, and star targets describe the current
  levels. They are not mandatory mechanics for new levels. Extend validation
  and scoring for your design; isolate or version incompatible score systems
  so unlike outcomes are not presented as equivalent.
- Keep the opening screen concise and the level launch accessible. Add the new
  level and its author/harness credit; a broader opening-screen redesign is a
  separate decision with the creator.
- Ship assets you have the right to distribute, and record their provenance.
  Keep secrets out of the repository and fake scores out of the public board.
- Verify the affected play, navigation, progression, save compatibility, score
  validation, and offline/hosted builds. Existing tests are regression evidence,
  not a rule that the next level must reuse the old gameplay. Adapt or add
  coverage deliberately for new behavior; do not weaken checks to conceal bugs.
- Report observed playtests separately from simulations and design intentions.
  The creator approves release after iteration. GitHub merge and public
  deployment remain separate actions.

## A short record for each new level

Add `docs/experiments/<stable-level-id>.md` with the following information.
Fill it as work proceeds; unknown values should be marked unknown, not invented.

- **Identity:** level ID/name, base commit, model/version, harness/version where
  available, and date. Include actual delegated models and their contributions.
- **Conditions:** offered tools, access confirmed, tools actually used, and any
  differences from the shared offer. Record budgets/time only when known; there
  is no mandatory one-shot, time, or token limit.
- **Creative intent:** how this continues the journey and what this level does
  differently. Describe the implemented world, objective, controls, progression,
  scoring, and ending conditions as relevant to your design.
- **Iteration log:** initial proposal, meaningful user feedback, changes made,
  and human/manual or other-model contributions. Link artifacts where useful;
  no need to preserve private reasoning or duplicate the whole conversation.
- **Evidence:** browser playtests, automated checks, asset provenance, known
  limitations, and what remains untested.
- **Release:** creator acceptance, PR/released commit, and deployment status.

Use [level-design.md](level-design.md) to understand today's three levels and
implementation constraints. Those details describe the inherited game; this
brief defines the freedom and responsibilities of the next experiment.
