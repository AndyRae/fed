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

## Narrative payoff

### Discovery rewards

A quiet one-time toast the first time a visitor spots the whale, or finds
a refused project, or opens night mode — small delight, cheap to build,
rewards exploring free-roam instead of only tour-hopping.

### A project-centric view at the quay

The mirror image of the island ledger (now shipped — see CHANGELOG.md
"An island's own ledger"), from the researcher's side: click a project
(at the quay, or from a new researcher-facing list there) and see its
status across every island it targeted — pending/approved/refused per
island, released/refused per island, released count. This is the one
place in the model that's *allowed* to read across islands (honesty rule
6's own exception, already exercised by `releasedCratesForProject`), so
it dramatizes "aggregation only happens after release, and only at the
quay" as a real, inspectable view rather than a line in a tour's
narration. TRE-centric and project-centric views of the same underlying
`SimState`, from the two sides honesty rule 6 actually cares about
keeping apart.

## World & federation patterns

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
