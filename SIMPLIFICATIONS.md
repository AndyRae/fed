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

## A sealed crate's journey is its own animation, not literally inside the ferry mesh

The world-metaphor table says the ferry is "the only vessel that touches
an island." A sealed crate leaving the workshop is, in the reference
story, carried out by that same ferry on a later departure. This model
animates the crate as its own mesh travelling from the workshop through
the island's dock to customs (`egressPath` in `src/world/layout.ts`) —
the same single wall-crossing point the ferry uses — rather than
simulating the ferry picking the crate up and carrying it. The crossing
point is honest; which mesh visibly carries the box is a rendering
simplification. See `src/engine/flowController.ts`.
