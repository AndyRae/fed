# Changelog

Historical narration of material features and departures, in the spirit
of [Keep a Changelog](https://keepachangelog.com/). See CLAUDE.md's own
"Terminology and language" note: this file is where historical framing
belongs, so the rest of the docs can stay written for a reader arriving
today.

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
