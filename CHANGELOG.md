# Changelog

Historical narration of material features and departures, in the spirit
of [Keep a Changelog](https://keepachangelog.com/). See CLAUDE.md's own
"Terminology and language" note: this file is where historical framing
belongs, so the rest of the docs can stay written for a reader arriving
today.

## Toggle how many islands there are

A live slider in the Live Activity panel (`src/ui/statsPanel.ts`) lets a
visitor choose how many islands the ambient demo renders, from 1 up to a
6-island roster (Ailsa, Barra, Coll, Eigg, Foula, Gigha). Previously
`src/main.ts` hardcoded a single island "for faster iteration during
active development"; `src/world/layout.ts`'s `islandGeometry` was already
generic over TRE count but only verified non-overlapping up to 3.

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
