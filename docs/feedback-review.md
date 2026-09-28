# Feedback review — September 28, 2026

Reviewed all eight open issues (#2–#9), merged PR #1, and the local game based on `cb8d306`. PR #1 has no review comments. The observations describe real player friction; the proposed mechanical solutions still need testing. The sections below record the successive local review batches. The final integration status is recorded at the end.

## Suggested order

| Batch | Issues | Evaluation and next step |
| --- | --- | --- |
| 1. Start screen | #2, #3 | Clear usability improvements. Decorative copy and the large introduction bury the primary action. Simplify the screen, keep Play the Game outside its scroll area, and retain role goals in the briefing and controls in Help. Implemented locally for review. |
| 2. In-game readability | #8, #9 | Dash is hidden by the desktop layout; Interact also disappears at short heights. Implemented locally: persistent Interact and Dash buttons with keyboard hints, explicit touch labels, and tighter desktop camera padding. The camera still fits the full shop; a blanket zoom would risk clipping stations. |
| 3. Recovering from mistakes | #6 | One bench slot creates a genuine hands-full problem. Recycling at Material is an existing escape, but loses physical progress. Prototype exchanging the held part with the benched part before increasing storage capacity. This preserves the space constraint; its effect on routing still needs playtesting. |
| 4. Outsourcing presentation | #5 | The merged version already uses an outside-capability job and office approval. The offer appears once per shift, does not stop the clock, and can be declined. The toast, branded card, and automatic scrolling plausibly cause the intrusive feeling. First test quieter presentation and whether Operator needs this extra task; a separate station is a larger change. |
| 5. Core workflow experiments | #4 | Ticket selection identifies the job for CAD and material; it does not change a carried part's identity. Multiple CAD jobs can already be prepared ahead. Removing selection requires another clear way to choose which job to start. Attended QC (#7) was dropped by user decision on September 28; keep the existing four-second unattended inspection. |

## Why some constraints matter

These are inferences from the current rules, not claims about the author's intent:

- **Order selection:** CAD and material use the selected job. Machines use the carried part. This separates planning from physical handling. An automatic choice could reduce clicks but also start the wrong job for a player following a plan.
- **Storage:** One carried part and one bench slot force scheduling decisions. A swap could improve recovery without adding a second slot; unlimited floor storage would substantially weaken the constraint.
- **Inspection:** Its current four-second unattended cycle provides time to do another task. Attended QC could still be a good mechanic, but higher realism alone does not establish that it will be more fun.
- **Camera:** Isometric corners can look empty even when the shop fills the available height. At 1280×720 the local play view already reaches near the bottom edge. Judge readability and clipping together.

Relevant code: `dist/core.js` (order selection, sourcing, buffer and station timers), `dist/main.js` (`measurePlayFrame`, `updateCamera`, `processEvents`, ticket controls), and `dist/style.css` (desktop/sidebar control visibility). The current regression and balance tests provide a baseline, not proof of human enjoyment.

## First local batch

- Replaced the large opening slogan and paragraph with “Choose your role.”
- Removed the menu welcome tagline, edition label, floor caption, and duplicate starting instructions/targets.
- Renamed the primary action to “Play the Game.” Its role options scroll independently, keeping the button in view.
- Role duration, clear goals and star targets remain in the pre-shift briefing. Controls remain available through Help. During play, the role/status header still appears.
- Rebuilt the standalone HTML. Changes are local and ready for visual review.

Verification: all 169 automated tests passed; the existing expert balance assertions passed. Browser checks covered role selection → briefing → Help → start → pause → return, plus primary-button visibility at 1366×650, 1024×600, 390×844 and 844×390. No full human playthrough or mechanical rebalance is claimed for this UI-only batch.

## Second local batch — controls and framing (#8, #9)

- Added persistent Interact and Dash buttons with E and Shift hints outside the order list. Pointer activation fires once; keyboard activation also works. Touch buttons now spell out their actions.
- Reduced desktop camera padding below the status bar from 30 to 8 pixels and at the bottom from 12 to 8 pixels. This makes height-limited laptop views about 4–6% larger while preserving the shop bounds. Narrow-screen framing is unchanged.
- Kept the existing geometric bounds: inspecting actual mesh extents found less than 1% extra space in the bounding approximation, so a more expensive geometry scan would add little value.
- Rebuilt standalone HTML. No mechanics, targets, or deadlines changed.

Verification: 169 automated tests and expert balance assertions passed; syntax and whitespace checks passed. In-browser checks verified Dash movement, one Interact action per pointer click, keyboard Space activation, and all station labels/action buttons inside 1024×600 and 390×844 viewports. The latter is a narrow desktop-pointer check, not a physical touchscreen test.

## Camera angle follow-up

User clarified that diagonal orientation, not padding, causes the uncomfortable empty corners. Changed camera offset from (11,19,17) to (0,23,17): front-aligned, about 54 degrees down toward the floor. Movement axes derive from the camera direction so keyboard/touch movement stays aligned with the screen. This supersedes the padding-only treatment of #9.

Verified 1280×720 view and direct click on the Material mesh → walk → pickup. Checked the right/down movement vectors project in the expected screen directions. Rebuilt the standalone HTML.

## Top order queue experiment

At the user's request, compared the supplied Overcooked reference with the official PlayStation Season Pass screenshot gallery. Moved desktop orders to a horizontal strip at the top, with score/time and carried-part controls along the bottom. Removed the redundant per-card click instruction on desktop; selection remains marked by a check and border. Cards retain job identity, deadline, routing, status and rush information. Overflow scrolls horizontally; the optional sourcing card keeps its own vertical scroll.

Camera fitting now uses the area between orders and footer across the full screen width. This is a placement experiment: no changes to assignment, selection rules, CAD, machining, inspection, storage or difficulty. Four cards and a selected multi-machine job were checked in-browser; longest visible cards had no content overflow. Customer-call controls remain at the bottom. All 169 tests passed and standalone HTML was rebuilt.

## Quiet gameplay HUD

Removed the coaching overlay, per-card selection instructions, carried-part next-step prose, persistent interaction sentence, and routine arrival/start/CAD-complete announcement toasts. Job cards retain their short route labels, pictograms, deadline bars and rush state; detailed job status remains available to screen readers. Interact exposes contextual help through a tooltip and accessible label. The hands display now reports the actual held part or Empty instead of repeating the selected card.

Shortened call and sourcing copy while retaining decision deadlines, rewards, penalties and paused-handoff state. Kept Help and briefings, short station names, and action-failure feedback. Reduced card height so the shop gains space. No timing or simulation mechanics changed. All 169 tests passed; local browser confirmed quiet shift start, selected route, material pickup, and carried-part updates. Standalone HTML rebuilt.

## Hands panel removal

Removed the hands panel from the shared markup for every viewport. A small job-number marker now follows the carried part and disappears when hands are empty, the part is set down, or play ends. The marker is non-interactive so station/floor clicks pass through. Rebuilt standalone HTML; syntax and whitespace checks passed.

## Part exchanges (#6)

Implemented occupied Hold bench swaps and finished-machine exchanges. A valid held part replaces a completed part in one interaction; the player carries the completed output away. Busy machines, wrong operations, CAD requirements and phone/pause guards still apply. Job identity, progress, deadlines, scoring and the one-part capacity are preserved. Interaction hints describe the swap.

Verification: 177 automated tests passed, including exchanges through Lathe, Mill and Inspect, retained progress, exact cycle durations and rejected handoffs. Existing movement-aware balance assertions passed; these establish regression coverage, not human difficulty after adopting swaps. Browser play verified an incompatible milling billet leaves the finished lathe part untouched, then a fresh run exchanged #103 into the lathe for #101 and swapped carried #101 with benched #102. Standalone HTML rebuilt. Changes remain local.

## Covari customer-order loop (#5)

Removed outsourcing from Operator. Manager and Owner can receive one ordinary-looking outside-capability customer ticket after two normal shipments and 35 elapsed seconds, provided at least 45 seconds remain. The choice is “Outsource with Covari · Earn 300” or “Say no.” Declining or ignoring it has no penalty. Accepting requires one click, with no office visit or interruption to ongoing CAD.

Covari delivers after 22 seconds to a dedicated receiving pad. A short branded van animation and arrival cue announce the crate without moving the camera. The player collects it, uses the existing QC station, and ships it for exactly 300 points. Delivery alone earns nothing. This separate optional job does not consume regular ticket capacity or change shipment/star/streak targets. Source parts support existing bench and station exchanges. Pausing freezes delivery; shift end and restart clear unfulfilled source work.

Validation: 174 automated tests passed, including 19 sourcing tests, score validation, and challenge bounds; the existing movement-aware balance assertions passed. A real Manager browser playtest shipped two normal jobs, accepted customer Order #201 away from the office, received it with score unchanged at 1,017, inspected and shipped it, and finished that transaction at 1,317 with two ordinary shipments. No browser errors or warnings. A temporary delivery-layout fixture verified the 24px action remains inside the 124px card, no inner overflow, and a clean receiving label; fixture files were removed. Standalone rebuilt and syntax/whitespace checks passed.

This remains a local gameplay prototype. Before publication, revisit score-season/save compatibility for the changed outsourcing reward and compare human playthroughs; existing balance simulations do not evaluate the new optional route's effect on player strategy.

## Inspection decision — September 28, 2026

User decided to skip attended inspection as not sufficiently relevant. Closed issue #7 as not planned. QC remains a four-second unattended step, including for outsourced parts. No gameplay code changed.


## Stock dispatch and PR integration — September 28, 2026 (#4)

Replaced required ticket selection with physical Round and Plate bins, plus Block stock in advanced roles. A bin dispatches the earliest-due programmed, unstarted matching ordinary job; ties use the lower order number. Each part remains tied to its customer order and machining route. Office interaction resumes its unfinished drawing or prepares the earliest-due unprepared job. Tickets are informational, with stock pictograms and automatic carried-job emphasis. Tab and number keys no longer select tickets.

Bin recycling, Hold bench swaps, ready-machine exchanges, unattended QC, Owner calls, role targets and operation durations remain in place. Operator has no outsourcing or Block bin. This deliberately limits automatic choice to jobs of the stock type the player physically chooses; it does not add inventory, fixturing or future-level systems.

The movement-aware driver now uses the actual stock bins and automatic CAD, with no ticket-selection calls. This checks the changed physical route as well as core assignment logic.

### Score compatibility

New ruleset `roles-v7-stock-outsourcing` and local save `chip-rush-roles-v7`. Every previous season retains its stored records. Role unlocks migrate; personal scores/stars start fresh. The board filters to the current ruleset, and old challenge links are ignored. This prevents comparing scores earned under different dispatch, movement and outsourcing opportunities.

### Issue disposition

- #2: simplified start/briefing/gameplay copy, informational top tickets, removed Hands panel.
- #3: Play the Game stays outside the role picker’s scroll area.
- #4: automatic dispatch through physical stock bins and automatic CAD priority.
- #5: optional advanced-role customer order, Covari as supplier, physical receipt/QC/shipping and 300-point reward.
- #6: Hold bench swaps and compatible ready-machine exchanges.
- #7: closed as not planned at the user’s request; inspection remains unattended.
- #8: persistent Interact and Dash controls.
- #9: front-aligned camera and wider usable floor framing, plus corner scoreboard.

Changes are prepared as separate review commits in one PR. GitHub source changes do not deploy the separately maintained hosted game.


Final checks: 180 automated tests passed. Movement-aware normal/expert balance assertions passed; eight Owner shipments remain attainable with either rush choice. Offline and hosted builds, standalone JavaScript syntax and whitespace checks passed. The live browser completed an Operator stock → lathe → QC → shipping cycle with no ticket selection. Advanced-role browser observation showed all three bins, prepared CAD, two ordinary shipments and the optional Covari offer; no console warnings/errors were recorded. This is not a complete human playthrough of every role or proof of player enjoyment.
