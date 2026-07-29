import { describe, expect, it } from "vitest";
import {
  createInitialSimState,
  decideOutputReview,
  decideProjectApproval,
  submitProject,
  submitTask,
  tick,
} from "./sim.ts";
import {
  computeActivityStats,
  computeIslandLedger,
  computeProjectLedger,
  heldCratesForTre,
  pendingApprovalsForTre,
  releasedIslandCountForProject,
} from "./selectors.ts";

function freshState() {
  return createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }], pollIntervalTicks: 1 });
}

function twoIslandState() {
  return createInitialSimState({
    seed: 1,
    tres: [
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
    ],
    pollIntervalTicks: 1,
  });
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

describe("releasedIslandCountForProject", () => {
  it("is zero before any crate is released", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    expect(releasedIslandCountForProject(state, "p1")).toBe(0);
  });

  it("counts one island's own released crate, even if it releases more than one", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "t2", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);
    for (const crate of state.crates) {
      state = decideOutputReview(state, { crateId: crate.id, decision: "RELEASED" });
    }
    expect(releasedIslandCountForProject(state, "p1")).toBe(1);
  });

  it("reaches 2 only once both islands have each released their own result for the same project", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "t2", projectId: "p1", treId: "tre-b" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-b", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);

    const crateA = state.crates.find((c) => c.treId === "tre-a")!;
    const crateB = state.crates.find((c) => c.treId === "tre-b")!;

    state = decideOutputReview(state, { crateId: crateA.id, decision: "RELEASED" });
    expect(releasedIslandCountForProject(state, "p1")).toBe(1);

    state = decideOutputReview(state, { crateId: crateB.id, decision: "RELEASED" });
    expect(releasedIslandCountForProject(state, "p1")).toBe(2);
  });

  it("never counts a refused crate's island", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "t2", projectId: "p1", treId: "tre-b" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-b", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);

    const crateA = state.crates.find((c) => c.treId === "tre-a")!;
    const crateB = state.crates.find((c) => c.treId === "tre-b")!;
    state = decideOutputReview(state, { crateId: crateA.id, decision: "RELEASED" });
    state = decideOutputReview(state, { crateId: crateB.id, decision: "REFUSED" });
    expect(releasedIslandCountForProject(state, "p1")).toBe(1);
  });

  it("never counts a different project's released islands", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P1", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitProject(state, { id: "p2", name: "P2", researcher: "R", targetTreIds: ["tre-b"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "t2", projectId: "p2", treId: "tre-b" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p2", treId: "tre-b", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);
    for (const crate of state.crates) {
      state = decideOutputReview(state, { crateId: crate.id, decision: "RELEASED" });
    }
    expect(releasedIslandCountForProject(state, "p1")).toBe(1);
    expect(releasedIslandCountForProject(state, "p2")).toBe(1);
  });
});

describe("computeIslandLedger", () => {
  it("is all zeros for an island that has seen nothing", () => {
    expect(computeIslandLedger(freshState(), "tre-a")).toEqual({
      treId: "tre-a",
      projectsSeen: 0,
      gate1Approved: 0,
      gate1Refused: 0,
      tasksInFlight: 0,
      analysesRun: 0,
      gate2Released: 0,
      gate2Refused: 0,
    });
  });

  it("never counts a project that targeted only the other island — honesty rule 6, concretely", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-b"] });
    expect(computeIslandLedger(state, "tre-a").projectsSeen).toBe(0);
    expect(computeIslandLedger(state, "tre-b").projectsSeen).toBe(1);
  });

  it("counts each island's own Gate 1 decision separately, even for the same project", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-b", decision: "REFUSED", decidedBy: "H" });

    const ledgerA = computeIslandLedger(state, "tre-a");
    expect(ledgerA.projectsSeen).toBe(1);
    expect(ledgerA.gate1Approved).toBe(1);
    expect(ledgerA.gate1Refused).toBe(0);

    const ledgerB = computeIslandLedger(state, "tre-b");
    expect(ledgerB.projectsSeen).toBe(1);
    expect(ledgerB.gate1Approved).toBe(0);
    expect(ledgerB.gate1Refused).toBe(1);
  });

  it("never counts another island's own tasks or crates", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = submitTask(state, { id: "ta", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "tb", projectId: "p1", treId: "tre-b" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-b", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);

    const crateA = state.crates.find((c) => c.treId === "tre-a")!;
    state = decideOutputReview(state, { crateId: crateA.id, decision: "RELEASED" });
    // tre-b's own crate is left HELD.

    const ledgerA = computeIslandLedger(state, "tre-a");
    expect(ledgerA.analysesRun).toBe(1);
    expect(ledgerA.gate2Released).toBe(1);
    expect(ledgerA.gate2Refused).toBe(0);

    const ledgerB = computeIslandLedger(state, "tre-b");
    expect(ledgerB.analysesRun).toBe(1);
    expect(ledgerB.gate2Released).toBe(0);
    expect(ledgerB.gate2Refused).toBe(0);
    expect(ledgerB.tasksInFlight).toBe(0); // it reached AWAITING_OUTPUT_REVIEW, not in-flight
  });
});

describe("computeProjectLedger", () => {
  it("is undefined for a project that doesn't exist", () => {
    expect(computeProjectLedger(freshState(), "no-such-project")).toBeUndefined();
  });

  it("shows PENDING for every targeted island before any Gate 1 decision, with nothing released yet", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "Dr. R", targetTreIds: ["tre-a", "tre-b"] });
    const ledger = computeProjectLedger(state, "p1")!;
    expect(ledger.name).toBe("P");
    expect(ledger.researcher).toBe("Dr. R");
    expect(ledger.releasedCount).toBe(0);
    expect(ledger.perIsland).toEqual([
      { treId: "tre-a", gate1Status: "PENDING", cratesHeld: 0, cratesReleased: 0, cratesRefused: 0 },
      { treId: "tre-b", gate1Status: "PENDING", cratesHeld: 0, cratesReleased: 0, cratesRefused: 0 },
    ]);
  });

  it("never lists an island the project didn't target", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    const ledger = computeProjectLedger(state, "p1")!;
    expect(ledger.perIsland.map((s) => s.treId)).toEqual(["tre-a"]);
  });

  it("tracks each island's own Gate 1 decision independently, for the same project", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-b", decision: "REFUSED", decidedBy: "H" });

    const ledger = computeProjectLedger(state, "p1")!;
    const byIsland = new Map(ledger.perIsland.map((s) => [s.treId, s]));
    expect(byIsland.get("tre-a")?.gate1Status).toBe("APPROVED");
    expect(byIsland.get("tre-b")?.gate1Status).toBe("REFUSED");
  });

  it("tallies held/released/refused crates separately per island, and releasedCount across all of them", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = submitTask(state, { id: "ta", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "tb", projectId: "p1", treId: "tre-b" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-b", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 5);

    const crateA = state.crates.find((c) => c.treId === "tre-a")!;
    const crateB = state.crates.find((c) => c.treId === "tre-b")!;
    state = decideOutputReview(state, { crateId: crateA.id, decision: "RELEASED" });
    state = decideOutputReview(state, { crateId: crateB.id, decision: "REFUSED" });

    const ledger = computeProjectLedger(state, "p1")!;
    const byIsland = new Map(ledger.perIsland.map((s) => [s.treId, s]));
    expect(byIsland.get("tre-a")).toEqual({ treId: "tre-a", gate1Status: "APPROVED", cratesHeld: 0, cratesReleased: 1, cratesRefused: 0 });
    expect(byIsland.get("tre-b")).toEqual({ treId: "tre-b", gate1Status: "APPROVED", cratesHeld: 0, cratesReleased: 0, cratesRefused: 1 });
    expect(ledger.releasedCount).toBe(1);
  });

  it("never counts a different project's crates or approvals", () => {
    let state = twoIslandState();
    state = submitProject(state, { id: "p1", name: "P1", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitProject(state, { id: "p2", name: "P2", researcher: "R", targetTreIds: ["tre-a"] });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = decideProjectApproval(state, { projectId: "p2", treId: "tre-a", decision: "REFUSED", decidedBy: "H" });

    expect(computeProjectLedger(state, "p1")!.perIsland[0]!.gate1Status).toBe("APPROVED");
    expect(computeProjectLedger(state, "p2")!.perIsland[0]!.gate1Status).toBe("REFUSED");
  });
});
