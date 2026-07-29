import { createInitialSimState } from "../sim/sim.ts";
import type { Tour } from "./tourTypes.ts";

const TRE_A = { id: "tre-a", name: "Isle of Mingulay" };

/**
 * The flagship tour: submit → safe people/safe project approval → ferry
 * collects → workshop executes → sealed crate → safe output review →
 * release → aggregation at the quay. See CLAUDE.md "Tour mechanism" >
 * "Launch tours" #1.
 *
 * The demo world currently renders one TRE (Trusted Research Environment)
 * while its on-island layout and choreography are being reworked for
 * clarity — see main.ts's DEMO_TRES. In the full model a project can target
 * several islands at once, each running the identical protocol completely
 * independently (honesty rule 6: islands are mutually invisible); this tour
 * targets just the one island so what it submits always has somewhere to
 * render.
 */
export const journeyOfATaskTour: Tour = {
  id: "journey-of-a-task",
  title: "The journey of a task",
  createInitialState: () => createInitialSimState({ seed: 1, tres: [TRE_A], pollIntervalTicks: 2 }),
  stops: [
    {
      id: "submit-project",
      title: "The researcher submits",
      cameraPose: { kind: "mainland" },
      focusEntity: { kind: "project", projectId: "proj-diabetes-cohort" },
      narration: {
        plain: "A researcher submits a project proposal to an island TRE (Trusted Research Environment), from the quay.",
        detail:
          "submitProject creates a Project and a PENDING ProjectApproval per targeted TRE. Each approval is that island's own safe people/safe project check (Gate 1, internally), decided independently by that island's harbourmaster — approving here says nothing about approval anywhere else, on any other island that might later target the same project.",
      },
      simDirective: {
        kind: "submitProject",
        params: {
          id: "proj-diabetes-cohort",
          name: "Diabetes Cohort Study",
          researcher: "Dr. Amara Osei",
          targetTreIds: ["tre-a"],
        },
      },
    },
    {
      id: "submit-task",
      title: "The work travels too",
      cameraPose: { kind: "mainland" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain:
          "The researcher also hands over the actual piece of work — a container that will run inside the island, if it's approved.",
        detail:
          "submitTask creates a TES task in AWAITING_PROJECT_APPROVAL. No TRE agent can collect it until the safe people/safe project check (Gate 1, internally) approves this project for that specific island.",
      },
      simDirective: {
        kind: "submitTask",
        params: { id: "task-1", projectId: "proj-diabetes-cohort", treId: "tre-a" },
      },
    },
    {
      id: "gate-1-approval",
      title: "Safe people, safe project",
      cameraPose: { kind: "treGate1", treId: "tre-a" },
      focusEntity: { kind: "tre", treId: "tre-a" },
      narration: {
        plain: "The harbourmaster of the island checks the people and the project together, and decides: yes, this may run here.",
        detail:
          "decideProjectApproval(APPROVED) — the safe people/safe project check (this project's own shorthand: Gate 1), a human decision, never automatic. The task itself doesn't move yet: it's still AWAITING_PROJECT_APPROVAL until the island's own ferry next polls.",
      },
      simDirective: {
        kind: "decideProjectApproval",
        params: {
          projectId: "proj-diabetes-cohort",
          treId: "tre-a",
          decision: "APPROVED",
          decidedBy: "Harbourmaster of Isle of Mingulay",
        },
      },
    },
    {
      id: "ferry-collects",
      title: "The ferry collects",
      cameraPose: { kind: "sea", treId: "tre-a" },
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
      title: "The workshop executes",
      cameraPose: { kind: "treWorkshop", treId: "tre-a" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "Inside the wall, the workshop starts the container and runs it.",
        detail: "Two further ticks: QUEUED → INITIALIZING → RUNNING, the GA4GH TES executor states, verbatim.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "sealed-crate",
      title: "A crate is sealed",
      cameraPose: { kind: "treWorkshop", treId: "tre-a" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "The work finishes and is sealed into a crate. Nothing is released yet.",
        detail:
          "Two ticks: RUNNING → COMPLETE → AWAITING_OUTPUT_REVIEW. A Crate is sealed in HELD status and a CRATE_SEALED event fires — it now waits at this island's own customs hall for a human decision, never anywhere shared with another TRE.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "gate-2-review",
      title: "Safe output",
      cameraPose: { kind: "treCustoms", treId: "tre-a" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "A person at this island's own customs hall checks whether this is a safe output, and decides to release it.",
        detail:
          "decideOutputReview(RELEASED) — the safe output check (this project's own shorthand: Gate 2), the output/egress review, made locally by this TRE. This is a decision, not a transformation: the crate's contents are never altered, only its status.",
      },
      simDirective: {
        kind: "decideOutputReview",
        params: { crateId: "crate-task-1", decision: "RELEASED" },
      },
    },
    {
      id: "release",
      title: "Released",
      cameraPose: { kind: "treCustoms", treId: "tre-a" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "The crate is released and can now travel directly to the researcher — no further check awaits it.",
        detail:
          "The task and its crate both now carry RELEASED. This is the only path a result can leave this island's own customs hall by; there is no additional central review.",
      },
      simDirective: { kind: "none" },
    },
    {
      id: "aggregation-at-the-quay",
      title: "Aggregation at the quay",
      cameraPose: { kind: "mainland" },
      focusEntity: { kind: "project", projectId: "proj-diabetes-cohort" },
      narration: {
        plain:
          "Back at the researcher's quay, released results are gathered together with results from every other island that approved the project.",
        detail:
          "releasedCratesForProject reads across every TRE's released crates for this project. With more than one island targeted, this is the one point in the model that looks across islands, and only over crates that already cleared that island's own safe output check (Gate 2, internally).",
      },
      simDirective: { kind: "none" },
    },
  ],
};

/**
 * "The result that never left": the safe output check refuses. See
 * CLAUDE.md "Tour mechanism" > "Launch tours" #4. The crate is retained,
 * not deleted, and the researcher sees an explicit refusal rather than
 * silence.
 */
export const theResultThatNeverLeftTour: Tour = {
  id: "the-result-that-never-left",
  title: "The result that never left",
  createInitialState: () => createInitialSimState({ seed: 2, tres: [TRE_A], pollIntervalTicks: 2 }),
  stops: [
    {
      id: "submit-project",
      title: "The researcher submits",
      cameraPose: { kind: "mainland" },
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
      title: "The work travels too",
      cameraPose: { kind: "mainland" },
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
      title: "Safe people, safe project — approved",
      cameraPose: { kind: "treGate1", treId: "tre-a" },
      focusEntity: { kind: "tre", treId: "tre-a" },
      narration: {
        plain: "The harbourmaster approves the project. It will be allowed to run.",
        detail: "decideProjectApproval(APPROVED) — the safe people/safe project check passes (Gate 1, internally); the safe output check (Gate 2, internally) still lies ahead, undecided.",
      },
      simDirective: {
        kind: "decideProjectApproval",
        params: {
          projectId: "proj-imaging-study",
          treId: "tre-a",
          decision: "APPROVED",
          decidedBy: "Harbourmaster of Isle of Mingulay",
        },
      },
    },
    {
      id: "ferry-collects",
      title: "The ferry collects",
      cameraPose: { kind: "sea", treId: "tre-a" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "The island's ferry leaves, collects the approved container, and returns.",
        detail: "tick() reaches the TRE agent's poll boundary: AWAITING_PROJECT_APPROVAL → QUEUED.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "workshop-executes",
      title: "The workshop executes",
      cameraPose: { kind: "treWorkshop", treId: "tre-a" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain: "The workshop runs the container to completion.",
        detail: "QUEUED → INITIALIZING → RUNNING over two ticks.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "sealed-crate",
      title: "A crate is sealed",
      cameraPose: { kind: "treWorkshop", treId: "tre-a" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "The finished work is sealed into a crate and held at this island's own customs hall, awaiting a decision.",
        detail: "RUNNING → COMPLETE → AWAITING_OUTPUT_REVIEW; a Crate is sealed in HELD status.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "gate-2-refuses",
      title: "Safe output — refused",
      cameraPose: { kind: "treCustoms", treId: "tre-a" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "This island's own customs inspector examines the crate, decides it isn't a safe output, and refuses it. It will not leave.",
        detail:
          "decideOutputReview(REFUSED) — the safe output check (this project's own shorthand: Gate 2), local to this TRE, can say no. The task moves to OUTPUT_REFUSED and the crate to REFUSED; neither is deleted.",
      },
      simDirective: {
        kind: "decideOutputReview",
        params: { crateId: "crate-task-1", decision: "REFUSED" },
      },
    },
    {
      id: "crate-retained",
      title: "The crate is retained",
      cameraPose: { kind: "treCustoms", treId: "tre-a" },
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

/**
 * "The five safes": one stop per safe, each anchored to a place — people
 * (the quay), projects (the harbourmaster's office), settings (the
 * island), data (the vault), outputs (the customs hall). See CLAUDE.md
 * "Tour mechanism" > "Launch tours" #2 and "Terminology and language"'s
 * own fixed mapping. Two extra, unbranded stops (submitting the task,
 * sealing the crate) sit between the "safe" stops purely because the
 * model requires them before the next safe's own moment can be real —
 * same precedent as the flagship tour splitting "submit project" from
 * "submit task". Every safe still gets its own single dedicated stop.
 */
export const theFiveSafesTour: Tour = {
  id: "the-five-safes",
  title: "The five safes",
  createInitialState: () => createInitialSimState({ seed: 3, tres: [TRE_A], pollIntervalTicks: 2 }),
  stops: [
    {
      id: "safe-people",
      title: "Safe people",
      cameraPose: { kind: "mainland" },
      focusEntity: { kind: "project", projectId: "proj-five-safes" },
      narration: {
        plain:
          "The first safe is safe people: is everyone in this story who they say they are, and allowed to be here? A researcher — a real, named person — submits a project proposal from the quay.",
        detail:
          "submitProject creates a Project with a named researcher field. This model has no login, token, or credential exchange anywhere in it (see SIMPLIFICATIONS.md, \"No authentication/authorisation flow\") — the harbourmaster and customs inspector met later stand in for identity-checked, audited decisions in a genuine deployment.",
      },
      simDirective: {
        kind: "submitProject",
        params: {
          id: "proj-five-safes",
          name: "Community Health Survey",
          researcher: "Dr. Priya Nair",
          targetTreIds: ["tre-a"],
        },
      },
    },
    {
      id: "submit-task",
      title: "The work travels too",
      cameraPose: { kind: "mainland" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain:
          "The researcher also hands over the actual piece of work — a container that will run inside the island, if it's approved.",
        detail: "submitTask creates a TES task in AWAITING_PROJECT_APPROVAL. Safe people alone doesn't let it run — that's the next safe.",
      },
      simDirective: {
        kind: "submitTask",
        params: { id: "task-1", projectId: "proj-five-safes", treId: "tre-a" },
      },
    },
    {
      id: "safe-projects",
      title: "Safe projects",
      cameraPose: { kind: "treGate1", treId: "tre-a" },
      focusEntity: { kind: "tre", treId: "tre-a" },
      narration: {
        plain:
          "The second safe is safe projects: is this specific piece of work, for this specific reason, something this island should agree to? The harbourmaster's decision actually covers the first two safes together — is this a safe project, brought by safe people — before anything is allowed to run.",
        detail:
          "decideProjectApproval(APPROVED) — this project's own shorthand for it is Gate 1. A human decision, never automatic. See CLAUDE.md's world-metaphor table: \"the harbourmaster's decision judges safe people and safe projects together.\"",
      },
      simDirective: {
        kind: "decideProjectApproval",
        params: {
          projectId: "proj-five-safes",
          treId: "tre-a",
          decision: "APPROVED",
          decidedBy: "Harbourmaster of Isle of Mingulay",
        },
      },
    },
    {
      id: "safe-settings",
      title: "Safe settings",
      cameraPose: { kind: "tre", treId: "tre-a" },
      focusEntity: { kind: "task", taskId: "task-1" },
      narration: {
        plain:
          "The third safe is safe settings: is the technical environment itself trustworthy? This island is the safe setting — a sealed, walled place. Now that the project is approved, the island's own ferry has collected the work, and it's running inside the wall.",
        detail:
          "tick(4): the TRE agent's poll boundary fires (TASK_COLLECTED), then QUEUED → INITIALIZING → RUNNING, the GA4GH TES executor states verbatim. Nothing crosses this wall inward except the island's own ferry, departing and returning — honesty rule 1.",
      },
      simDirective: { kind: "tick", ticks: 4 },
    },
    {
      id: "safe-data",
      title: "Safe data",
      cameraPose: { kind: "treVault", treId: "tre-a" },
      focusEntity: { kind: "tre", treId: "tre-a" },
      narration: {
        plain:
          "The fourth safe is safe data: is the sensitive information itself protected? The vault is safe data. It never moves — the workshop, right beside it, computes on it in place, and nothing it holds ever leaves.",
        detail:
          "No new sim action at this stop: the task the previous stop started is still RUNNING, so the vault and the workshop are genuinely glowing together right now (see engine/flowController.ts's compute glow) — never a beam or a particle between them, honesty rule 2.",
      },
      simDirective: { kind: "none" },
    },
    {
      id: "crate-sealed",
      title: "A crate is sealed",
      cameraPose: { kind: "treWorkshop", treId: "tre-a" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain: "The work finishes and is sealed into a crate. Nothing is released yet.",
        detail: "Two ticks: RUNNING → COMPLETE → AWAITING_OUTPUT_REVIEW. A Crate is sealed in HELD status.",
      },
      simDirective: { kind: "tick", ticks: 2 },
    },
    {
      id: "safe-outputs",
      title: "Safe outputs",
      cameraPose: { kind: "treCustoms", treId: "tre-a" },
      focusEntity: { kind: "crate", crateId: "crate-task-1" },
      narration: {
        plain:
          "The fifth safe is safe outputs: could this specific result, on its way out, reveal something it shouldn't? A person at this island's own customs hall checks whether this is a safe output, and decides to release it.",
        detail:
          "decideOutputReview(RELEASED) — this project's own shorthand for it is Gate 2. A decision, not a transformation: the crate's contents are never altered, only its status. All five safes — people, projects, settings, data, outputs — have each now had their own real moment in this one journey.",
      },
      simDirective: {
        kind: "decideOutputReview",
        params: { crateId: "crate-task-1", decision: "RELEASED" },
      },
    },
  ],
};
