# Changelog

Historical narration of material features and departures, in the spirit
of [Keep a Changelog](https://keepachangelog.com/). See CLAUDE.md's own
"Terminology and language" note: this file is where historical framing
belongs, so the rest of the docs can stay written for a reader arriving
today.

## Vim-style camera keybindings

`hjkl` now orbit the free-roam camera left/down/up/right, and `+`/`-` zoom
in/out — a keyboard-only path to the exact same orbit (RMB-drag) and zoom
(wheel) `OrbitControls` already offers, not a new fly/walk mode (see
`helpOverlay.ts`'s own long-standing "no walk mode, no fly camera, no WASD"
line, which stays true). The math is pure and unit-tested independently of
any WebGL context — `src/engine/cameraOrbitMath.ts`'s `orbitPosition`/
`dollyPosition`, same "pure math, no renderer" precedent as
`cameraTween.ts` — and `cameraRig.ts` gained thin `orbitBy`/`dollyBy`
wrappers around it, clamped to the exact same min/max polar angle and
distance a drag or wheel already respects. Held keys move the camera
continuously frame-by-frame rather than jumping per keypress, and pressing
any of them turns off the gently orbiting overview camera exactly like a
real drag already does ("real interaction always wins"). Guarded against
typing in a text field (the project-title input, chiefly) the same way the
existing `?` help shortcut already is, and against fighting a tour's own
camera control. `helpOverlay.ts`'s Camera section documents the new keys.

## Give the vault a real moment in the flagship tour

*The journey of a task*'s "workshop executes" stop is now "the vault holds
still": the camera moves from the workshop to the vault beside it for the
same two ticks (QUEUED → INITIALIZING → RUNNING) that stop already advanced
— a camera-dwell and narration change to `tours.ts`, not a new tick or new
geometry. The plain register says outright that the vault has not moved and
never will; the technical register names honesty rule 2 and points at
`flowController.ts`'s compute glow, the synchronised vault/workshop ring
pair that's real for this entire stop's dwell, not asserted by the caption.
"The data never moves" is the single most load-bearing claim this whole
world makes, and previously no tour actually lingered on it — the flagship
tour passed the vault only incidentally on the way to the workshop, and
*the five safes* touched it for one stop among five. This gives it a
genuine, dedicated moment in the tour most visitors actually take.

## Create your own project

A new HUD button, "📝 Create your own project", opens a form asking a
visitor for three real choices — a project title, one of three study areas
(Cardiovascular, Diabetes, Respiratory), and one of three named analyses
(Pearson's correlation, Fisher's exact test, chi-squared test) — then builds
a fresh tour from those choices and hands it to the same tour player every
fixed launch tour already runs on (`buildYourProjectTour` in
`src/ui/tours.ts`, form in `src/ui/projectForm.ts`). The journey itself is
otherwise on rails, same precedent as *the journey of a task*: submit,
Gate 1 approves, the ferry collects, the workshop runs, a crate seals,
Gate 2 releases, and a final stop shows the visitor's own result arriving at
the quay.

The payoff is real, not decorative: `TesTask` gained an optional `analysis`
field (`{ type, variableA, variableB }`, threaded through `submitTask` and
carried to seal time in `tick()`), and `generateAnalysisCrateContent` (`src/
sim/crateContent.ts`) invents a plausible-looking result shaped like the
chosen test — a Pearson's r and p-value, a 2×2 contingency table with any
cell under 5 suppressed, a χ² statistic and degrees of freedom — always
`AGGREGATE`, since all three tests are themselves cohort-level statistics.
The tour builder computes this content once, with the exact seed key `tick()`
will independently derive, and quotes it verbatim in the final stop's
narration, so what a visitor reads always matches what the sim actually
sealed. The numbers are seeded from the visitor's own title (not a fixed
constant like the other tours), so two different titles genuinely see
different results while the same title always replays identically.

Both gates always say yes in this journey specifically so a visitor can see
the whole path in one sitting — refusal remains real and first-class
elsewhere (*the result that never left*, and the ambient demo's own refusal
rate), and both gate stops' technical detail says so explicitly rather than
leaving a visitor to conclude gates are theatrical from this one experience
alone. See SIMPLIFICATIONS.md for the full disclosure.

## A calmer, animated sea

The sea's static baked swell is now a gentle, always-animated one: three
low-amplitude travelling waves summed in a vertex shader (`world/sea.ts`,
animated by `engine/seaController.ts`), rather than a shape frozen once
at load. Inspired by a much older, much heavier WebGL ocean demo, but
deliberately simplified rather than ported: vertical displacement only,
never a horizontal/Gerstner term, so the surface can never read as
"choppy" — that's a property of the shape, not a tuned-down dial. Same
blue as before; no reflections, no foam, no skybox. Injected into the
existing `MeshStandardMaterial` via `onBeforeCompile` rather than a
bespoke shader material, so the sea keeps the ordinary lighting/shadow/
fog pipeline the rest of the world already uses.

CLAUDE.md's own "Visual language" section already names waves as an
example of decorative ambient motion that's allowed, provided it stays
visually subordinate — no doctrine change needed here, unlike the
orbiting camera. Verified live that the shader compiles without error and
`uTime` genuinely advances frame to frame, not just that the code typechecks.

## A project-centric view at the quay

Click the researcher's quay and its inspector panel now shows the
mirror image of the island ledger: a small list of the most recently
submitted projects (up to 8, newest first), one of them expanded into
its own status across every island it targeted — Gate 1 decision per
island (pending/approved/refused), Gate 2 crate tally per island
(released/refused/still held), and a released count gathered across all
of them. Clicking a different project in the list swaps the detail view
in place, no fresh click on the quay needed. `computeProjectLedger`
(`src/sim/selectors.ts`).

This is the one view in the whole app allowed to read across islands —
honesty rule 6's own stated exception ("aggregation of results happens
at the researcher's quay, after release"), the same one
`releasedCratesForProject` already exercises for the aggregation-payoff
flourish. Paired with the island ledger, these are the two sides honesty
rule 6 cares about keeping apart: what one island can see of its own
record, and what the quay is allowed to see across all of them.
Verified live: two different projects at the same quay showed genuinely
different per-island Gate 1 outcomes and crate tallies, not a shared or
averaged view.

## An island's own ledger

Click an island's own land (not a specific landmark on it) and its
inspector panel now shows a read-only tally: projects seen, safe project
decided (approved/refused), tasks in flight, analyses run, safe output
decided (released/refused) — `computeIslandLedger` (`src/sim/
selectors.ts`), the same shape as the existing observer-only
`computeActivityStats` but scoped to one `treId` instead of the whole
world. `projectsSeen` deliberately reads the approvals table rather than
`state.projects`, so a project that never targeted this island doesn't
appear in its ledger even if it targeted some other one.

The point isn't the numbers so much as the shape of the claim they make:
this card can only ever show one island's own record, never a shared or
combined view — honesty rule 6 ("islands are mutually invisible") made
into something clickable, rather than a claim CLAUDE.md's prose asks a
reader to take on faith. Verified live that two islands' own ledgers
genuinely diverge over time (different Gate 1 refusals, different
analysis counts) rather than coincidentally tracking each other.

## A gently orbiting overview camera

A 🌐 toggle next to night mode: the default view on load is a slow,
continuous orbit of the whole archipelago from a medium distance
(`cameraRig.ts`'s `controls.autoRotate`, ~2 minutes per full turn) rather
than a static shot. Dragging, zooming, or panning the camera yourself
turns it off immediately — real interaction always wins, it's never
fought — and the button reflects that. A tour suspends it rather than
turning it off outright, so it resumes correctly afterwards if it was on
before; changing the island count re-frames it the same way a manual
overview re-fly already did.

This is a deliberate change from this project's earlier stance (still
visible in git history) that free-roam should never auto-rotate, on the
reasoning that "motion carries meaning" and idle camera drift wasn't part
of the protocol. That honesty rule is about what moves *in* the world —
ferries, crates, decorative motion that must never cross a wall — not
about how a viewer is shown that world. An orbiting *camera* never
touches a ferry, a crate, or any SimState, so it doesn't dilute that rule;
it's a presentation choice, made because the project owner wanted a
better first impression than a static shot.

## Weather variety

A rare, purely decorative easter egg in the spirit of the whale
(`src/engine/whaleController.ts`, which this mirrors closely): every so
often, a mist bank drifts over a patch of open sea, or a rain shower
passes over another — one or the other, chosen at random, confined the
same way the whale is to well clear of every island's wall and the
mainland's coastline. Reads no SimState and stands for nothing in the
protocol; motion here is background weather, not a claim about
federation. See `src/engine/weatherController.ts` and
`src/world/weather.ts`.

(Tuned noticeably more frequent shortly after shipping — the first pass's
50-110 second wait between occurrences read as "almost never" in
practice; see `MIN_WAIT_SECONDS`/`MAX_WAIT_SECONDS` in
`weatherController.ts`.)

## A visible moment when aggregation actually happens

The instant a project's released results first converge from more than
one island, a one-time flourish plays at the researcher's quay: a ring
pulse (reusing the same mechanics as a gate decision's ring, just bigger
and in the crate's own colour rather than gate amber) and a burst of
small motes rising and drifting apart — the honest rendering of what
CLAUDE.md's own honesty rules already promised but nothing used to show:
"aggregation of results happens at the researcher's quay, after release."
Timed to the crate's own visual arrival at the quay, not the moment its
release is decided, and never repeated for the same project once a third
(or further) island's result arrives afterwards — it's the moment the
story lands, not a running tally. See
`releasedIslandCountForProject` (`src/sim/selectors.ts`) and
`src/engine/flowController.ts`'s `AGGREGATION_*` constants.

Needed a world with more than one island actually running by default to
be reachable without a visitor first finding the slider — see the next
entry.

## Toggle how many islands there are

A live slider in the Live Activity panel (`src/ui/statsPanel.ts`) lets a
visitor choose how many islands the ambient demo renders, from 1 up to a
6-island roster (Mingulay, Scarp, Taransay, Gometra, Oronsay, Sandray —
deliberately the obscure end of the Hebrides, not the famous ones),
defaulting to 2. Previously `src/main.ts` hardcoded a single island "for
faster iteration during active development"; `src/world/layout.ts`'s
`islandGeometry` was already generic over TRE count but only verified
non-overlapping up to 3.

Islands still fan out in a crescent facing the mainland — never a full
ring, and never wrapping toward or behind it, so every island keeps a
straight, unobstructed line to the researcher's quay dock (the ferry's
and a crate's own routes). The crescent's angular spread stays capped
well short of a half-circle; once that cap is reached, the ring radius
itself grows just enough to keep adjacent islands' walls from ever
overlapping, at any count from 1 to 6 (see `layout.test.ts`'s
"crescent scaling" suite).

Changing the count is a full reset of the ambient demo — a fresh
`SimState`, geometry, flow controller, and picker for the new roster —
not a live migration of in-flight projects, since there's no sensible
mapping from "N islands' worth of state" onto "M islands' worth". The
free-roam camera flies to a wider overview automatically so a larger
crescent doesn't leave its outer islands off-screen. The slider is
disabled while a tour has taken over the camera and world, so a mid-tour
drag can't fight the tour's own choreography.
