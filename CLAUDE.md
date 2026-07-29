# CLAUDE.md — Five Safes Archipelago

## Project

Five Safes Archipelago is an explorable 3D world that teaches how the Five
Safes TES weave performs federated analysis across Trusted Research
Environments (TREs). The geography and motion represent the real protocol; the
timings are deliberately scaled so people can watch the choreography happen. It
is a model, not an emulator: no real TES tasks execute in the browser and no
real data exists anywhere in the application.

 Use **Five
Safes Archipelago** in prose and `fivesafes-archipelago` for package-style
names.

There are two intended readers, and both matter on every change:

1. **Governance readers** — TRE managers, information governance officers,
   data custodians. They decide whether to trust this architecture. They must
   be able to complete a tour without touching a keyboard control scheme and
   without meeting an unexplained acronym.
2. **Technical readers** — research software engineers and TRE operators.
   They must be able to open the inspector on any entity and see the real
   thing it stands for: the GA4GH TES task document, the state transition, the
   component name from the reference implementation.

Every explanatory surface is written in dual register: one plain-language
sentence first, expandable technical detail second. Never sacrifice the first
audience to impress the second.

The canonical source of truth for all protocol and governance claims is
<https://docs.federated-analytics.ac.uk>. When this file and those docs
disagree, the docs win and this file gets a PR.

## World metaphor

The world is an archipelago. This mapping is fixed; do not improvise
alternatives per-feature, because the geography *is* the argument:

| World element | System element | The claim the geometry makes |
| --- | --- | --- |
| The sea | The untrusted network | Everything between trust zones is open water |
| The mainland port | Submission layer | Public-facing; where researchers hand over work |
| The researcher's quay | Researcher / submitter | Where tasks begin and approved results end |
| The quay office | The submission layer's own building | Makes "Submission layer" concrete as a real structure beside the dock, rather than an implied capability of the bare jetty — no protocol role beyond that |
| The researcher quarter | Researchers and their institutions, collectively | Decorative and collective, not a new gate — where a submitted task's own trip to the quay visibly begins. "Researcher / submitter" in protocol terms is still the quay itself |
| A researcher's submission | A submitted GA4GH TES task, before any TRE has agreed to it | Travels from the researcher quarter to the quay, entirely on the mainland; visually distinct from the container it becomes once an island's ferry has collected it |
| An island | A TRE | A separate trust zone with a hard perimeter — this island **is** the safe setting |
| The island wall | The TRE network boundary | Nothing crosses it inward, ever |
| The harbourmaster's office (per island) | TRE manager + project approval | The **safe people, safe project** check (this project's own shorthand: Gate 1): a human decides whether this island works with this project — and the people behind it — at all |
| The ferry (per island) | TRE agent | Departs *from* the island, collects containers, returns; the only vessel that touches an island |
| A shipping container | A GA4GH TES task | The researcher's code travels; this is nearly literal — TES executes containers |
| The workshop | TES runner (Funnel in the reference implementation) | Where containers execute, inside the wall |
| The vault | The sensitive data | Fixed at the island's centre; nothing originating here ever boards a ferry — this **is** safe data |
| A sealed crate | A result awaiting review | Produced by the workshop; sealed until a human decision |
| The island's own customs hall (per island) | The TRE's own local disclosure-control check | The **safe output** check (this project's own shorthand: Gate 2): a human at this TRE decides whether they are comfortable with this crate leaving their control. Built on the island itself, a different point on the wall than the ferry's dock. There is no shared or central customs hall anywhere in the model, and none on the mainland |
| The customs inspector (per island) | Egress manager / output review | The human who makes the safe output decision — local to this TRE, not a shared or central role; the stamp is the event |
| The on-island workflow (per island) | A task's real path through the TRE | Purely informational, never a route anything travels: connects the harbourmaster's office, the workshop, and this island's own customs hall, in the order a task's governance states actually follow. The vault is never on it |

There are **no bridges, causeways, cables, or boats between islands**. Five
Safes TES supports isolated analysis only; islands never communicate with each
other, and the world must make that absence conspicuous rather than merely
omitting it. If a future weave with connected/shared patterns is ever added,
it is a different sea, not new bridges in this one.

## Architecture

Static browser bundle with five layers, mirroring the discipline that worked
for [PGSimCity](https://github.com/NikolayS/PGSimCity), an explorable 3D
city that teaches how PostgreSQL works — the sibling project this one's
whole approach (dual-register narration, tours-as-data, honesty rules,
worktree isolation, the five-layer split below) is modelled on. When a
task references "how PGSimCity did X" — camera feel, UI chrome, a specific
pattern — go read its actual source at that URL rather than guessing from
memory; it is a real, separate codebase, not a shared module.

```
src/
  core/           shared contracts, event bus, registry, theme, utilities
  sim/            pure TypeScript model of the Five Safes TES protocol
  world/          three.js geometry, one module per zone (sea, mainland, island — each island builds its own customs hall)
  engine/         renderer, camera rig, ferry/flow animation, labels, picking
  ui/             HUD, tour player, inspector, narration panel, transcript
```

- `src/core/types.ts` defines `SimState`, the contract between simulation and
  presentation.
- `src/sim` never imports three.js. It owns and mutates simulation state. It
  models: projects, project approvals per TRE, TES tasks and their state
  machine, agent polling cycles, execution, egress queues, and review
  decisions.
- `src/world` may read `SimState` but never mutates it.
- `src/world/layout.ts` is the single source of truth for geography: island
  positions, wall bounds, ferry routes, dock anchors, and each island's own
  customs hall (the crate's own crossing point and Gate 2's location,
  distinct from the ferry's dock). Cross-zone coordinates live nowhere
  else.
- `src/ui/tours.ts` is the single source of truth for tours (see Tour
  mechanism). Tours are data, not code.
- The browser debugging surface is `window.ARCHIPELAGO`: simulation, event
  bus, camera rig, tour player, flow controller.

## Stack

- TypeScript in strict mode, targeting ES2022
- three.js for 3D and WebGL2 (pin the version in package.json and this file
  when chosen)
- Vite for development and the static production bundle
- Vitest for deterministic unit and characterization tests
- Node.js 20 or newer for local development

three.js is the only runtime dependency. Do not add another runtime
dependency, a framework, a CDN, remote fonts, telemetry, or analytics. The
shipped application must remain a static bundle with no server, no database,
and no runtime network calls. This is not just hygiene: the artifact
advertises an outbound-only, minimal-surface architecture, and it should
practice what it depicts. It must deploy as static files (GitHub Pages) and
run inside an NHS network from a file share if it has to.

## Honesty rules

This section outranks every other consideration except safety. PGSimCity's
rule is "the model must be honest" because a misleading building teaches a
falsehood. Here the stakes are higher: this application makes governance
claims to the people who decide whether federated research happens. A
misleading animation is not a docs bug; it is a misrepresentation of a
security architecture. Geometry, motion, and timing are factual claims and get
the same review as prose.

1. **No motion ever crosses an island wall inward.** No ferry docks at an
   island it did not depart from, no particle, arc, line, or camera-implied
   flow enters over the wall. The fetch of a task must visibly originate
   inside the island: the ferry leaves, collects, returns. This is the
   outbound-only claim rendered as physics, and it is the single most common
   misdrawing in federation diagrams. Any change that violates it is a
   release blocker regardless of how good it looks.
2. **The vault emits nothing.** Nothing whose origin is the vault ever boards
   a ferry, crosses a wall, or appears on the mainland. Sealed crates
   originate at the workshop and are visually distinct from vault contents.
   "The data never moves" must be checkable by watching, not asserted by a
   caption.
3. **Both gates are humans with visible waiting.** There are exactly two
   gates, and both are local to each TRE: the safe people/safe project check
   (Gate 1, at the harbourmaster's office) and the safe output check (Gate 2,
   at that island's own customs hall). Both are decisions made by a person,
   depicted as a person (or an unambiguous human-decision marker), with a
   queue that visibly holds until the decision lands. Never depict either
   gate as an automatic scanner, filter, or conveyor. Speeding through the
   wait for pacing is allowed only in scaled time that the UI discloses.
   There is no shared or central gate anywhere in the model, and no customs
   hall or inspector exists on the mainland — once an island's own safe
   output check approves a crate, it travels directly to the researcher's
   quay.
4. **Output review is a decision, not a transformation.** A crate is approved
   or refused. It is never "cleaned", shrunk, or laundered by that island's
   own customs hall. If a tour wants to explain disclosure control
   heuristics, it does so in narration, not by animating the crate changing.
5. **Refusal is a first-class path.** The simulation must include projects
   that the safe people/safe project check rejects and results that the safe
   output check refuses, and tours must show them. A world that only ever
   says yes teaches that the gates are theatrical.
6. **Islands are mutually invisible.** No shared queues, no synchronized
   pulses implying coordination, no inter-island traffic. Aggregation of
   results happens at the researcher's quay, after release, and is shown
   there.
7. **Scaled values are disclosed.** Polling intervals, execution times, and
   review latencies are compressed by orders of magnitude. The UI states this
   once, plainly, in the HUD and in every tour that depends on timing.
8. **Simplifications are enumerated.** Keep a `SIMPLIFICATIONS.md` listing
   every material departure from the reference implementation
   (authentication flows, retry behaviour, multi-executor tasks, error
   states not modelled). A simplification that could change the lesson is
   disclosed in-app at the point it is relevant, not only in the repo.
9. **Protocol claims match the docs.** Component names, responsibilities,
   the weave identity (Isolated / Summary / Manual egress / TES), and TES
   task states must match <https://docs.federated-analytics.ac.uk> and the
   GA4GH TES specification. A claim that cannot be sourced to either does
   not ship.

## Terminology and language

- Say **TRE (Trusted Research Environment)**, expanded on first use in every
  tour. Never "enclave". Do not substitute "SDE" — if the relationship to NHS
  England Secure Data Environments needs stating, state it in narration as a
  relationship, not a synonym.
- Say **TES task**, and **container** for the executable unit. The GA4GH TES
  state names (QUEUED, INITIALIZING, RUNNING, COMPLETE, EXECUTOR_ERROR,
  CANCELED) appear verbatim in the inspector's technical register and are
  never invented or renamed.
- Say **output review** or **egress review** for the safe output check,
  matching the docs. "Disclosure control" may appear in narration as the
  discipline; the event is a review decision. "Gate 2" is this project's own
  informal shorthand for the same check, not a docs term — keep it out of
  plain-register prose; it's fine in code identifiers and technical asides.
- The Five Safes are **safe people, safe projects, safe settings, safe data,
  safe outputs** — sentence case, always all five, in that order. This is
  the primary vocabulary for every explanatory surface; lead with it, not
  with this project's own internal shorthand ("Gate 1", "Gate 2"), which may
  still appear parenthetically for readers cross-referencing code. The
  mapping is fixed, same as the world metaphor table:
  - The harbourmaster's decision judges **safe people** and **safe
    projects** together (Gate 1, internally).
  - An island itself — wall, ferry, and all — **is** the **safe setting**.
  - The vault **is safe data**; see honesty rule 2.
  - The customs inspector's decision is the **safe output** check (Gate 2,
    internally).
  The Five Safes tour visits each of the five in turn, anchored to these
  same places.
- Pattern vocabulary is exactly the docs': analytical types **isolated /
  connected / centralised**; data movement **summary / model parameters /
  row-level data**. Five Safes Archipelago depicts isolated + summary only
  and says so.
- Write docs for a reader arriving today. Historical narration goes in
  `CHANGELOG.md`.

## Visual language

- Colour is semantic and fixed: the trust palette (island interiors), the
  untrusted palette (sea, mainland), an amber-family accent reserved
  exclusively for the two human gates, and a distinct reserved colour for the
  vault and anything derived from it. Do not reuse a semantic colour because
  it looks good elsewhere.
- Motion carries meaning: the only things that move are things that move in
  the protocol (ferries, containers, crates, state pulses). Decorative
  ambient motion (birds, waves) must be visually subordinate and must never
  cross a wall, to avoid diluting rule 1 by habituation.
- Judge visible work at the scale and camera angle a user will encounter.
  Review screenshots, not only source coordinates.
- Respect `prefers-reduced-motion`: tours must be completable with instant
  cuts instead of animated camera moves and with flows shown as static
  annotated states.

## Tour mechanism

Tours are the primary interface for governance readers and the reason this
project exists. Free-roam is the reward after a tour, not the entry point.

- **Tours are data.** Each tour is an ordered list of stops in
  `src/ui/tours.ts`: `{ cameraPose, focusEntity, narration: { plain, detail },
  simDirective }`. The tour player interprets stops; adding a tour must not
  require touching engine code.
- **Tours drive the real simulation.** A stop's `simDirective` advances or
  configures `src/sim` (submit this task, have the safe people/safe project
  check refuse, deliver this crate). Tours never play canned animations
  divorced from `SimState`. If the tour shows it, the model did it — this is
  what makes the tour honest.
- **Launch tours:**
  1. *The journey of a task* — flagship. Submit → safe people/safe project
     approval → ferry collects → workshop executes → sealed crate → safe
     output review → release → aggregation at the quay. One island in
     focus, the others visibly running the same choreography.
  2. *The five safes* — one stop per safe, each anchored to a place: people
     (the quay and named roles), projects (the harbourmaster's office),
     settings (the island wall and workshop), data (the vault), outputs (the
     customs hall).
  3. *The project that was refused* — the safe people/safe project check
     says no; the ferry never collects for that project.
  4. *The result that never left* — the safe output check refuses; the
     crate is retained and the researcher sees a refusal, not silence.
- Narration is dual register per stop: `plain` is one or two sentences with
  no unexpanded acronyms; `detail` is expandable and may name components,
  states, and spec sections. Both are content, both get editorial review.
- **Transcript mode is mandatory.** Every tour is readable end-to-end as
  linear text (narration + a still or description per stop) without WebGL.
  This is the accessibility path, the low-spec-NHS-machine path, and the
  copy-into-a-governance-pack path, and it ships with the flagship tour, not
  later.
- Tours are interruptible (pause, step back, leave to free-roam, resume) and
  keyboard-navigable throughout.

## Simulation model

- The protocol lives in `src/sim` as an explicit state machine per task,
  mirroring GA4GH TES states plus the governance states around them
  (awaiting project approval, awaiting output review, released, refused).
  Illegal transitions throw in development and are unrepresentable in types
  where practical.
- Time is a scaled tick owned by the sim; the world renders whatever the sim
  says. Never advance protocol state from `src/world` or `src/engine`.
- All randomness goes through a seeded RNG. Given a seed and a directive
  script, a run is fully deterministic; tours depend on this.
- Prefer exact assertions for state-machine behaviour and durable directional
  properties for scaled timing (the review queue holds until a decision;
  order of gate events is invariant).

## Agentic engineering rules

These are inherited from hard-won PGSimCity experience; treat them as
load-bearing, not folklore.

### Red/green TDD is mandatory

Every bug fix starts with the smallest deterministic test that reproduces the
defect. Confirm it fails for the expected reason, make it green, refactor
with the suite green. Do not weaken assertions to accommodate a bug. Tests
assert behaviour and properties, not symbol existence or opaque snapshots.
Never depend on wall-clock timing, unseeded randomness, a browser, or a GPU
when the claim is pure — and in this codebase, every protocol claim is pure.

### Honesty rules are testable

Rules 1, 2, 5, and 6 in the Honesty section have geometric or state-machine
expressions: no flow path may have a wall-crossing inbound segment; no flow's
origin may be the vault; refusal states must be reachable; no route may
connect two islands. Encode these as tests over `layout.ts` routes and sim
reachability, so a well-meaning visual change cannot silently break a
governance claim.

### Verify the deliverable, not a nearby state

- Run `npm test`, `npm run typecheck`, and `npm run build` before handing off.
- Exercise visible changes in the browser and read the resulting screenshots.
  A successful render command is not visual verification.
- Verify new code is imported, constructed, and called. Presence in the tree
  is not delivery; grep for the construction site.
- Before a commit, confirm `git status --porcelain` shows nothing untracked
  that the feature needs. Partial commits have broken static deployments
  before.

### Isolate cross-cutting work

Anything touching `src/engine/renderer.ts`, `src/main.ts`,
`src/world/layout.ts`, `src/core/types.ts`, or `src/ui/tours.ts` goes in a
dedicated git worktree. Do not use `git stash` to isolate work in shared
trees. Keep one logical change per PR.

### Limit parallel browser rendering

Software WebGL rasterisation is memory-hungry. Route visual verification
through a single screenshot tool with a small concurrency semaphore (three
slots), and queue rather than collide.

### Treat visual work as engineering

- Geometry is a factual claim: measure routes, bounds, containment, and
  origin points with tests where possible, then inspect the render.
- Build a fast feedback loop before visual iteration; do not judge geometry
  through slow full-scene renders when a plotter over `layout.ts` answers
  the question in milliseconds.
- Capture before/after screenshots for visible fixes and report what the
  image actually shows.

### Git history

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`),
  subject under 50 characters, present tense.
- A commit message must describe what the diff actually did; inspect before
  naming.
- Never amend or force-push unless the project owner explicitly asks.

## Key design rules

1. **The architecture boundary is hard.** `sim` owns state, `world` presents
   it, and both meet at `SimState`.
2. **Geography has one owner.** Positions and routes live in
   `src/world/layout.ts`; tours live in `src/ui/tours.ts`.
3. **The model must be honest, and here honesty is governance.** The nine
   honesty rules outrank aesthetics, pacing, and scope.
4. **The wall is inviolable inward.** No exceptions, including decorative
   motion and camera-implied flows.
5. **Tours are data and tours drive the sim.** No canned animation ever
   stands in for model state.
6. **Refusal paths ship with approval paths.** The gates are real because
   they can say no.
7. **Both audiences on every surface.** Plain register first, technical
   register one interaction away, transcript always available.
8. **The dependency boundary stays small.** three.js only; static, offline,
   telemetry-free — the artifact practices the architecture it depicts.

## Attribution and trademarks

Choose and declare a licence before first public commit (Apache-2.0 suggested
for consistency with adjacent tooling; owner's call). Keep third-party
notices with distributions.

Five Safes Archipelago is an independent educational model. Do not imply
affiliation with, sponsorship by, or endorsement from GA4GH, ELIXIR, DARE UK,
the Federated Analytics programme, NHS England, or the originators of the
Five Safes framework. Credit the Five Safes framework and link
<https://docs.federated-analytics.ac.uk> as the protocol source in the README
and in-app about panel.
