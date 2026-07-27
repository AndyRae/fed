# Simplifications

Material departures from the reference implementation and the GA4GH TES
specification, kept here per CLAUDE.md honesty rule 8. A simplification that
could change the lesson is also disclosed in-app at the point it is
relevant, not only here.

## TES executor states

The model uses six of the eleven GA4GH TES states — `QUEUED`,
`INITIALIZING`, `RUNNING`, `COMPLETE`, `EXECUTOR_ERROR`, `CANCELED` — plus
the governance states either side of them. Omitted: `UNKNOWN`, `PAUSED`,
`SYSTEM_ERROR`, `CANCELING` (the in-progress transition to `CANCELED`),
`PREEMPTED`. These represent operational edge cases (scheduler pause, host
failure, cluster preemption) that don't change the governance story this
model teaches. No omitted state is renamed or repurposed — see
`src/core/types.ts`.

## Single executor per task

Real TES tasks may declare multiple executors run in sequence. The model
gives each task exactly one execution stage (`INITIALIZING` → `RUNNING`).
Multi-executor tasks are not represented.

## No retry behaviour

A task that reaches `EXECUTOR_ERROR` or `CANCELED` is terminal in this
model. The reference implementation and real TRE operators may retry;
retry orchestration is not modelled.

## No authentication/authorisation flow

The model has no login, token, or credential exchange. "The harbourmaster
approves the project" and "the customs inspector reviews the crate" stand
in for identity-checked, audited decisions in the real system.

## Aggregation is a read, not a stage

The researcher's-quay aggregation of released results across TREs is
computed by reading released crates for a project; it is not a distinct
simulation stage with its own state machine.

## A sealed crate's journey is its own animation

A sealed crate travels from the workshop, through this island's own
customs hall, to the researcher's quay as its own mesh (`egressPath` in
`src/world/layout.ts`) rather than a person or vessel physically
carrying it. The crossing point (the customs hall, a fixed structure at
the wall — see the world-metaphor table) is honest; the fact that
nothing visibly "holds" the crate en route is a rendering
simplification. See `src/engine/flowController.ts`.

## This island's own customs hall is not a distinct protocol/state-machine stage

Gate 2's local review is depicted in the world/visual layer as a real
building on every island, with its own inspector marker and route, but
it is not modelled as a separate `TaskStatus` in `src/core/types.ts`. A
crate transitions directly from `COMPLETE` to `AWAITING_OUTPUT_REVIEW`
to `RELEASED`/`OUTPUT_REFUSED`; the customs hall is part of the crate's
geometry and journey, and the location of the existing `decideOutputReview`
decision, not an additional tracked simulation state.

## The egress pattern depicted is "Full Local Control"

docs.federated-analytics.ac.uk/federated_research_patterns/egress
describes four disclosure-control patterns. This model depicts **Full
Local Control**: "at least one person checks the results by eye and
approves the release" at each TRE, with "results flow to researchers
after individual TRE approval" and no additional central/federated-level
review modelled. This matches CLAUDE.md's own honesty rule 9, which
already names this weave's egress identity as **Manual** — a human
decision, not an automated one.

The reference implementation's documented Egress service
(`/five_safes_tes/reference_implementation/core_components`) is
described as a single centralized component rather than one per TRE.
Depicting Gate 2 as local to each island — one customs hall per TRE,
no shared facility, and no customs hall on the mainland — is therefore
a deliberate choice of *which* valid, documented egress pattern to
show, made because it demonstrates local governance control clearly to
governance readers; it is not a departure from the general Five Safes
framework, only from one specific reference deployment's architecture.
If a future weave models Full Central Control instead, it should be a
distinctly named alternative, not a silent change to this one.
