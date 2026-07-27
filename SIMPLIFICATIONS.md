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

A sealed crate travels from the workshop to customs as its own mesh
(`egressPath` in `src/world/layout.ts`), through the island's egress
airlock rather than a person or vessel physically carrying it. The
crossing point (the airlock, a fixed structure in the wall — see the
world-metaphor table) is honest; the fact that nothing visibly "holds"
the crate en route is a rendering simplification. See
`src/engine/flowController.ts`.

## The egress airlock is not a distinct protocol/state-machine stage

The TRE's local disclosure-control check (the egress airlock — see
CLAUDE.md's world-metaphor table, added after a correction sourced from
docs.federated-analytics.ac.uk) is depicted in the world/visual layer as
a real checkpoint on every crate's route, but it is not modelled as a
separate `TaskStatus` in `src/core/types.ts`. A crate transitions
directly from `COMPLETE` to `AWAITING_OUTPUT_REVIEW`; the airlock is
part of the crate's geometry and journey, not a tracked simulation
state. The sole disclosure *decision* remains the human customs
inspector's, at Gate 2 — matching honesty rules 3 and 4.
