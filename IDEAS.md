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

## Navigation

### Vim-style camera keybindings

There's currently no keyboard camera control at all — `helpOverlay.ts`
says so explicitly ("no walk mode, no fly camera, no WASD, none of that is
implemented here"), and the camera is mouse-only `OrbitControls` (drag to
orbit, wheel to zoom, right-drag to pan). `hjkl` for orbit (left/down/up/
right), plus a couple of keys for zoom, would give a keyboard-only path to
the same orbit/zoom the mouse already does — not a new fly/walk mode, just
an alternate input for the existing one. Cheap, self-contained
(`cameraRig.ts` already owns the `OrbitControls` instance), and doubles as
a real accessibility win alongside being one visitor's own preference.
Would need `helpOverlay.ts`'s controls list updated in the same change,
since its "none of it is implemented" line would otherwise go stale.

## The vault deserves more presence

### Give the vault a real moment in the flagship tour

"The data never moves" is the single most important claim this whole world
makes, and honesty rule 2 already requires the vault to emit nothing — but
no tour actually lingers on it. *The journey of a task* passes near the
vault only incidentally on the way to the workshop; *the five safes* touches
it for one stop among five. The vault should be a genuine focal point of the
flagship tour, not a scenic backdrop: a stop that holds the camera on it
specifically *while the ferry is out and the workshop is running*, so the
contrast is the point — everything else in frame is moving (ferry crossing
the wall outward, containers boarding, the workshop's own compute glow) and
the vault, deliberately, is the one thing that visibly never does. The
narration's plain register can say this outright ("data has not moved this
whole time"); the detail register can point at honesty rule 2 by name. Worth
doing without a new tour or new geometry — this is a stop re-ordering and a
camera-dwell change to `tours.ts`, not a new feature.

## Characters

### Cuddly characters for the four human roles

The researcher, the harbourmaster, the customs inspector, and an island
citizen are already named roles the world depicts (a person, or "an
unambiguous human-decision marker," per honesty rule 3) but currently read
as abstract markers rather than anyone a visitor empathises with. Simple,
friendly, distinct character designs for each — approachable enough that a
governance reader forms a mental "who" for each decision rather than a
"what" — could make the two human gates (rule 3) and the researcher's own
stake in a result land emotionally, not just procedurally.

Needs careful design before any geometry: this project's two audiences are
real TRE managers and RSEs deciding whether to trust an architecture, and
"cuddly" risks reading as unserious to that audience if it tips into
mascot territory — PGSimCity's own character work (if any) is worth
checking for precedent before designing from scratch. Also has to stay
inside honesty rule 3's own requirement that both gates are humans with
visible waiting: a character redesign must make the decision-makers more
legible, not decorate over the fact that a queue is genuinely holding for
a person to choose.

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
