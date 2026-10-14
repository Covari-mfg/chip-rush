# Shop-first entry and speed records

The start screen keeps the 3D workshop visible behind a compact shift rail,
with a bottom strip for small windows. Shifts and Open for Business have
separate tabs. All six shifts are available immediately, each with a bold
gold model credit and a smaller harness credit. One Play or Continue action
starts the game; briefings remain available through How to play.

The corner High scores dock defaults to business net worth. Shift Records
combines shift points and identifies the level behind each result. Business
ranking still uses completed or retired runs; active shops are not published.

Clear time records the first ordinary shipment reaching the existing target.
Outsourced jobs add points but do not advance that target. The clock freezes
at clear while the run continues for points. Pause time and the Launch Window
cinematic are excluded. Results show points, clear time and full run time.
Fastest clears save independently by stable level ID in `chip-rush-speed-v1`.
Existing scores, saves, friend links and numeric catalog order remain compatible.
Legacy unlock values are retained but no longer gate the picker.

## Database rollout

Apply additive migration `0003_colossal_giant_girl.sql` before deploying the
updated Worker. It adds nullable end/clear timing columns; existing rows keep
their scores and unknown times. Timing remains bounded self-reporting under
the existing leaderboard trust model, rather than replay verification.

## Verification

All 350 automated tests passed, together with the Rush Hour expert balance
assertion, standalone and hosted builds, Worker dry run and diff whitespace
check.
Browser review covered desktop and narrow layouts, direct Launch Window entry,
saved-business continuation, hash navigation and both leaderboard tabs.
A real local First Shift run showed 1,167 points, a 1:48.2 clear and a 2:30.0
end; its independent clear record survived reload. Full mobile-device play
has not been checked. No playtest score was posted publicly, and no deployment
or production database migration was performed.
