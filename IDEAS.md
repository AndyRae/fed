# Ideas

A backlog of things discussed but not committed to. Nothing here is
promised or scheduled — it's a catch-all so a good idea doesn't get lost
between sessions. When one of these gets built, move its section into
`CHANGELOG.md` (or `SIMPLIFICATIONS.md`, if it turns out to require a
documented departure) and delete it from here.

## Atmosphere

### Sound

There is currently no audio anywhere in the app. PGSimCity leans on sound
a lot (see its own `M` mute toggle). A handful of small, procedurally
synthesized cues via WebAudio — no audio files, no new dependency — could
make the world feel alive: a soft chime on a release, a duller thud on a
refusal, a low ambient sea hum, a ferry horn on departure. Needs its own
mute control and to default to off, matching PGSimCity's "audio starts off
and remembers your choice" precedent and this project's general low-spec
autoplay caution.

### Weather variety

Occasional atmospheric variation beyond the existing static swell and
gradient sky/fog — a rain shower, mist rolling in — as another rare,
purely decorative easter egg in the spirit of the whale
(`src/engine/whaleController.ts`). Lower priority than sound; mostly worth
doing if the whale pattern proves popular and a second one is wanted.

## Narrative payoff

### A visible moment when aggregation actually happens

The stats panel shows running totals, but there's no single moment where
the story lands. A brief visual flourish at the researcher's quay when a
project's results from multiple TREs actually combine — something that
briefly makes felt what `SIMPLIFICATIONS.md`'s "aggregation is a read, not
a stage" describes abstractly — would cash out "isolated + summary" as an
experienced moment instead of an explained fact. Needs at least two
islands approving the same project to be meaningful (see "toggle island
count" below).

### Discovery rewards

A quiet one-time toast the first time a visitor spots the whale, or finds
a refused project, or opens night mode — small delight, cheap to build,
rewards exploring free-roam instead of only tour-hopping.

## World & federation patterns

### Toggle how many islands there are

`src/world/layout.ts`'s `islandGeometry`/`computeIslandGeometries` are
already generic over TRE count (index/total spread, non-overlap tested up
to 3). `src/main.ts` currently hardcodes `DEMO_TRES` to a single island
"for faster iteration during active development" — the comment there
already flags this as provisional. A HUD control to add/remove islands at
runtime would let a visitor see the isolation claim (honesty rules 1 and
6) at a scale closer to a real multi-TRE deployment, and would make the
aggregation-payoff idea above land harder. Mostly wiring, not new
geometry work — the layout math and honesty-rule tests already assume an
arbitrary count.

### Other federation patterns, as a genuinely separate mode

CLAUDE.md is explicit that Five Safes Archipelago depicts one weave —
isolated analytical type, summary data movement, Manual/Full Local
Control egress — and that "if a future weave with connected/shared
patterns is ever added, it is a different sea, not new bridges in this
one." A comparison mode showing what a **connected** or **centralised**
pattern looks like would be genuinely valuable for technical readers
deciding between architectures, but per that constraint it cannot be a
toggle that adds bridges to the existing archipelago — it has to be an
entirely separate world/scene, clearly labelled as a different weave, that
the current one is never silently modified to resemble. Biggest-scope idea
on this list; treat as its own project, not a feature flag.

## Higher-risk / needs careful design

### A deliberate "the wrong way" counterexample

Governance readers respond well to contrast. A dedicated tour stop (never
the ambient or free-roam state) that shows a crossed-out, unambiguously
labelled line drawn directly between two islands — "this is what a naive
shared-database model would look like, and it is exactly what never
happens here" — could be one of the most persuasive things a skeptical TRE
manager sees. It has to be built without ever tripping honesty rule 1 even
by accident: never in free-roam, never ambiguous that it's a labelled
counterexample rather than real geometry, ideally rendered in a visually
distinct "diagram" register (dashed, desaturated, an explicit strikethrough
icon) rather than the same solid tracks real routes use. Needs its
guardrails designed before any geometry gets written.
