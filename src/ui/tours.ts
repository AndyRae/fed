import { createInitialSimState } from "../sim/sim.ts";
import type { Tour } from "./tourTypes.ts";

const TRE_A = { id: "tre-a", name: "Isle of Ailsa" };
const TRE_B = { id: "tre-b", name: "Isle of Kessel" };

/**
 * The flagship tour: submit → Gate 1 approval → ferry collects → workshop
 * executes → sealed crate → Gate 2 review → release → aggregation at the
 * quay. See CLAUDE.md "Tour mechanism" > "Launch tours" #1.
 *
 * The world has two TREs (Trusted Research Environments). The tour's
 * directives only drive Isle of Ailsa's task — Isle of Kessel's
 * harbourmaster and ferry would run the identical protocol for their own
 * copy of the project, completely independently; that parallel run is a
 * free-roam/rendering concern, not this headless model's job to animate.
 */
export const journeyOfATaskTour: Tour = {
  id: "journey-of-a-task",
  title: "The journey of a task",
  createInitialState: () =>
    createInitialSimState({ seed: 1, tres: [TRE_A, TRE_B], pollIntervalTicks: 2 }),
  stops: [
    {
      id: "submit-project",
      cameraPose: { lookAtZoneId: "mainland" },
      focusEntity: { kind: "project", projectId: "proj-diabetes-cohort" },
      narration: {
        plain:
          "A researcher submits a project proposal to two island TREs (Trusted Research Environments) at once, from the quay.",
        detail:
          "submitProject creates a Project and a PENDING ProjectApproval per targeted TRE. Each approval is Gate 1, decided independently by that island's harbourmaster — approving here says nothing about approval anywhere else.",
      },
      simDirective: {
        kind: "submitProject",
        params: {
          id: "proj-diabetes-cohort",
          name: "Diabetes Cohort Study",
          researcher: "Dr. Amara Osei",
          targetTreIds: ["tre-a", "tre-b"],
        },
      },
    },
    {
      id: "submit-task",
      cameraPose: { lookAtZoneId: "mainland" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain:
          "The researcher also hands over the actual piece of work — a container that will run inside the island, if it's approved.",
        detail:
          "submitTask creates a TES task in AWAITING_PROJECT_APPROVAL. No TRE agent can collect it until Gate 1 approves this project for that specific island.",
      },
      simDirective: {
        kind: "submitTask",
        params: { id: "task-1", projectId: "proj-diabetes-cohort", treId: "tre-a" },
      },
    },
    {
      id: "gate-1-approval",
      cameraPose: { lookAtZoneId: "tre-a-interior" },
      focusEntity: { kind: "tre", treId: "tre-a" },
      narration: {
        plain: "The harbourmaster of the island decides: yes, this project may run here.",
        detail:
          "decideProjectApproval(APPROVED) — a human decision, never automatic. The task itself doesn't move yet: it's still AWAITING_PROJECT_APPROVAL until the island's own ferry next polls.",
      },
      simDirective: {
        kind: "decideProjectApproval",
        params: {
          projectId: "proj-diabetes-cohort",
          treId: "tre-a",
          decision: "APPROVED",
          decidedBy: "Harbourmaster of Isle of Ailsa",
        },
      },
    },
    {
      id: "ferry-collects",
      cameraPose: { lookAtZoneId: "sea" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain:
          "The island's own ferry leaves the island, collects the approved container from the mainland, and returns. Nothing ever enters the island by any other route.",
        detail:
          "tick() advances until the TRE agent's poll interval elapses. The task transitions AWAITING_PROJECT_APPROVAL → QUEUED and a TASK_COLLECTED event fires — the outbound-only fetch, rendered as physics later, asserted as a state change now.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "workshop-executes",
      cameraPose: { lookAtZoneId: "tre-a-interior" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "Inside the wall, the workshop starts the container and runs it.",
        detail: "Two further ticks: QUEUED → INITIALIZING → RUNNING, the GA4GH TES executor states, verbatim.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "sealed-crate",
      cameraPose: { lookAtZoneId: "tre-a-interior" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "The work finishes and is sealed into a crate. Nothing is released yet.",
        detail:
          "Two ticks: RUNNING → COMPLETE → AWAITING_OUTPUT_REVIEW. A Crate is sealed in HELD status and a CRATE_SEALED event fires. The crate now sits at customs, outside any island, waiting for a human decision.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "gate-2-review",
      cameraPose: { lookAtZoneId: "customs" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "A person at the customs hall inspects the sealed crate and decides to release it.",
        detail:
          "decideOutputReview(RELEASED) — Gate 2, the output/egress review. This is a decision, not a transformation: the crate's contents are never altered, only its status.",
      },
      simDirective: {
        kind: "decideOutputReview",
        params: { crateId: "crate-task-1", decision: "RELEASED" },
      },
    },
    {
      id: "release",
      cameraPose: { lookAtZoneId: "customs" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "The crate is released and can now travel back to the researcher.",
        detail: "The task and its crate both now carry RELEASED. This is the only path a result can leave customs by.",
      },
      simDirective: { kind: "none" },
    },
    {
      id: "aggregation-at-the-quay",
      cameraPose: { lookAtZoneId: "mainland" },
      focusEntity: { kind: "project", projectId: "proj-diabetes-cohort" },
      narration: {
        plain:
          "Back at the researcher's quay, released results are gathered together with results from every other island that approved the project.",
        detail:
          "releasedCratesForProject reads across every TRE's released crates for this project — the one point in the model that looks across islands, and only over crates that already cleared Gate 2.",
      },
      simDirective: { kind: "none" },
    },
  ],
};

/**
 * "The result that never left": Gate 2 refuses. See CLAUDE.md "Tour
 * mechanism" > "Launch tours" #4. The crate is retained, not deleted, and
 * the researcher sees an explicit refusal rather than silence.
 */
export const theResultThatNeverLeftTour: Tour = {
  id: "the-result-that-never-left",
  title: "The result that never left",
  createInitialState: () => createInitialSimState({ seed: 2, tres: [TRE_A], pollIntervalTicks: 2 }),
  stops: [
    {
      id: "submit-project",
      cameraPose: { lookAtZoneId: "mainland" },
      focusEntity: { kind: "project", projectId: "proj-imaging-study" },
      narration: {
        plain: "A researcher submits a project proposal to a single island TRE (Trusted Research Environment).",
        detail: "submitProject creates a Project and a PENDING ProjectApproval for the one targeted TRE.",
      },
      simDirective: {
        kind: "submitProject",
        params: {
          id: "proj-imaging-study",
          name: "Retinal Imaging Study",
          researcher: "Dr. Femi Adeyemi",
          targetTreIds: ["tre-a"],
        },
      },
    },
    {
      id: "submit-task",
      cameraPose: { lookAtZoneId: "mainland" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "The researcher hands over the container that will run inside the island, if approved.",
        detail: "submitTask creates a TES task in AWAITING_PROJECT_APPROVAL.",
      },
      simDirective: {
        kind: "submitTask",
        params: { id: "task-1", projectId: "proj-imaging-study", treId: "tre-a" },
      },
    },
    {
      id: "gate-1-approval",
      cameraPose: { lookAtZoneId: "tre-a-interior" },
      focusEntity: { kind: "tre", treId: "tre-a" },
      narration: {
        plain: "The harbourmaster approves the project. It will be allowed to run.",
        detail: "decideProjectApproval(APPROVED) — Gate 1 passes; Gate 2 still lies ahead, undecided.",
      },
      simDirective: {
        kind: "decideProjectApproval",
        params: {
          projectId: "proj-imaging-study",
          treId: "tre-a",
          decision: "APPROVED",
          decidedBy: "Harbourmaster of Isle of Ailsa",
        },
      },
    },
    {
      id: "ferry-collects",
      cameraPose: { lookAtZoneId: "sea" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "The island's ferry leaves, collects the approved container, and returns.",
        detail: "tick() reaches the TRE agent's poll boundary: AWAITING_PROJECT_APPROVAL → QUEUED.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "workshop-executes",
      cameraPose: { lookAtZoneId: "tre-a-interior" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "The workshop runs the container to completion.",
        detail: "QUEUED → INITIALIZING → RUNNING over two ticks.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "sealed-crate",
      cameraPose: { lookAtZoneId: "tre-a-interior" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "The finished work is sealed into a crate and held at customs, awaiting a decision.",
        detail: "RUNNING → COMPLETE → AWAITING_OUTPUT_REVIEW; a Crate is sealed in HELD status.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "gate-2-refuses",
      cameraPose: { lookAtZoneId: "customs" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "The customs inspector examines the crate and refuses it. It will not leave.",
        detail:
          "decideOutputReview(REFUSED) — Gate 2 can say no. The task moves to OUTPUT_REFUSED and the crate to REFUSED; neither is deleted.",
      },
      simDirective: {
        kind: "decideOutputReview",
        params: { crateId: "crate-task-1", decision: "REFUSED" },
      },
    },
    {
      id: "crate-retained",
      cameraPose: { lookAtZoneId: "customs" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain:
          "The crate stays exactly where it was refused. The researcher sees a clear refusal, not silence and not a missing result.",
        detail:
          "The Crate record persists with status REFUSED and its original id; it is never removed from state and never appears in any project's released aggregation.",
      },
      simDirective: { kind: "none" },
    },
  ],
};
