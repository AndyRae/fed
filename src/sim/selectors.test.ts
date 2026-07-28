import { describe, expect, it } from "vitest";
import {
  createInitialSimState,
  decideOutputReview,
  decideProjectApproval,
  submitProject,
  submitTask,
  tick,
} from "./sim.ts";
import { computeActivityStats, heldCratesForTre, pendingApprovalsForTre } from "./selectors.ts";

function freshState() {
  return createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }], pollIntervalTicks: 1 });
}

describe("computeActivityStats", () => {
  it("is all zeros for a state with nothing submitted yet", () => {
    const stats = computeActivityStats(freshState());
    expect(stats).toEqual({
      projectsSubmitted: 0,
      gate1Approved: 0,
      gate1Refused: 0,
      tasksInFlight: 0,
      analysesRun: 0,
      gate2Released: 0,
      gate2Refused: 0,
    });
  });

  it("counts a submitted project once, before any decision", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    expect(computeActivityStats(state).projectsSubmitted).toBe(1);
    expect(computeActivityStats(state).gate1Approved).toBe(0);
    expect(computeActivityStats(state).gate1Refused).toBe(0);
  });

  it("counts a Gate 1 approval and a Gate 1 refusal separately", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    expect(computeActivityStats(state).gate1Approved).toBe(1);
    expect(computeActivityStats(state).gate1Refused).toBe(0);

    state = submitProject(state, { id: "p2", name: "P2", researcher: "R", targetTreIds: ["tre-a"] });
    state = decideProjectApproval(state, { projectId: "p2", treId: "tre-a", decision: "REFUSED", decidedBy: "H" });
    expect(computeActivityStats(state).gate1Approved).toBe(1);
    expect(computeActivityStats(state).gate1Refused).toBe(1);
  });

  it("counts a task as in flight once queued, and no longer once it completes", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    expect(computeActivityStats(state).tasksInFlight).toBe(0); // still AWAITING_PROJECT_APPROVAL until the next poll

    state = tick(state, 1); // ferry collects: -> QUEUED
    expect(computeActivityStats(state).tasksInFlight).toBe(1);
    expect(computeActivityStats(state).analysesRun).toBe(0);

    state = tick(state, 2); // QUEUED -> INITIALIZING -> RUNNING
    expect(computeActivityStats(state).tasksInFlight).toBe(1);

    state = tick(state, 1); // RUNNING -> COMPLETE
    expect(computeActivityStats(state).tasksInFlight).toBe(0);
    expect(computeActivityStats(state).analysesRun).toBe(1);
  });

  it("keeps a completed analysis counted through output review, whichever way Gate 2 decides", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5); // -> COMPLETE -> AWAITING_OUTPUT_REVIEW
    expect(computeActivityStats(state).analysesRun).toBe(1);
    expect(computeActivityStats(state).gate2Released).toBe(0);
    expect(computeActivityStats(state).gate2Refused).toBe(0);

    const crateId = state.crates[0]!.id;
    state = decideOutputReview(state, { crateId, decision: "RELEASED" });
    expect(computeActivityStats(state).analysesRun).toBe(1);
    expect(computeActivityStats(state).gate2Released).toBe(1);
    expect(computeActivityStats(state).gate2Refused).toBe(0);
  });

  it("counts a refused result separately from a released one", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);
    const crateId = state.crates[0]!.id;
    state = decideOutputReview(state, { crateId, decision: "REFUSED" });
    expect(computeActivityStats(state).gate2Released).toBe(0);
    expect(computeActivityStats(state).gate2Refused).toBe(1);
  });
});

describe("pendingApprovalsForTre", () => {
  it("is empty before any project is submitted", () => {
    expect(pendingApprovalsForTre(freshState(), "tre-a")).toEqual([]);
  });

  it("lists a project awaiting this TRE's own Gate 1 decision", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    const pending = pendingApprovalsForTre(state, "tre-a");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.projectId).toBe("p1");
  });

  it("drops off the list the moment Gate 1 decides, whichever way", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "REFUSED", decidedBy: "H" });
    expect(pendingApprovalsForTre(state, "tre-a")).toEqual([]);
  });

  it("never lists another TRE's own pending approval", () => {
    let state = createInitialSimState({
      seed: 1,
      tres: [{ id: "tre-a", name: "A" }, { id: "tre-b", name: "B" }],
      pollIntervalTicks: 1,
    });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    expect(pendingApprovalsForTre(state, "tre-a")).toHaveLength(1);
    expect(pendingApprovalsForTre(state, "tre-b")).toHaveLength(1);
    expect(pendingApprovalsForTre(state, "tre-a")[0]!.treId).toBe("tre-a");
  });
});

describe("heldCratesForTre", () => {
  it("is empty before any crate is sealed", () => {
    expect(heldCratesForTre(freshState(), "tre-a")).toEqual([]);
  });

  it("lists a crate awaiting this TRE's own Gate 2 decision", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);
    const held = heldCratesForTre(state, "tre-a");
    expect(held).toHaveLength(1);
    expect(held[0]!.taskId).toBe("t1");
  });

  it("drops off the list the moment Gate 2 decides, whichever way", () => {
    let state = freshState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);
    const crateId = state.crates[0]!.id;
    state = decideOutputReview(state, { crateId, decision: "RELEASED" });
    expect(heldCratesForTre(state, "tre-a")).toEqual([]);
  });
});
