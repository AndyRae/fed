import { describe, expect, it } from "vitest";
import {
  createInitialSimState,
  decideOutputReview,
  decideProjectApproval,
  submitProject,
  submitTask,
  tick,
} from "./sim.ts";
import { getApproval, getCrateForTask, getTask } from "./selectors.ts";

function twoIslandWorld() {
  return createInitialSimState({
    seed: 1,
    tres: [
      { id: "tre-a", name: "Island A" },
      { id: "tre-b", name: "Island B" },
    ],
    pollIntervalTicks: 3,
  });
}

describe("createInitialSimState", () => {
  it("starts at tick 0 with no projects, tasks, or crates", () => {
    const state = twoIslandWorld();
    expect(state.tick).toBe(0);
    expect(state.projects).toEqual([]);
    expect(state.tasks).toEqual([]);
    expect(state.crates).toEqual([]);
    expect(state.tres.map((t) => t.id)).toEqual(["tre-a", "tre-b"]);
  });
});

describe("submitProject", () => {
  it("creates a PENDING approval per targeted TRE and a submission event", () => {
    let state = twoIslandWorld();
    state = submitProject(state, {
      id: "proj-1",
      name: "Diabetes cohort study",
      researcher: "Dr. Okoye",
      targetTreIds: ["tre-a", "tre-b"],
    });

    expect(state.projects).toHaveLength(1);
    const approvals = state.approvals.filter((a) => a.projectId === "proj-1");
    expect(approvals).toHaveLength(2);
    for (const approval of approvals) {
      expect(approval.status).toBe("PENDING");
      expect(approval.decidedAtTick).toBeNull();
    }
    expect(state.events).toContainEqual({ type: "PROJECT_SUBMITTED", tick: 0, projectId: "proj-1" });
  });

  it("throws if the project id already exists", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "proj-1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    expect(() =>
      submitProject(state, { id: "proj-1", name: "B", researcher: "R", targetTreIds: ["tre-a"] }),
    ).toThrow();
  });
});

describe("decideProjectApproval", () => {
  it("approves a project for one island independently of the other", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = decideProjectApproval(state, {
      projectId: "p1",
      treId: "tre-a",
      decision: "APPROVED",
      decidedBy: "Harbourmaster A",
    });

    expect(getApproval(state, "p1", "tre-a")?.status).toBe("APPROVED");
    expect(getApproval(state, "p1", "tre-b")?.status).toBe("PENDING");
    expect(state.events).toContainEqual({
      type: "PROJECT_APPROVAL_DECIDED",
      tick: 0,
      projectId: "p1",
      treId: "tre-a",
      status: "APPROVED",
    });
  });

  it("throws when deciding an approval that has already been decided", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = decideProjectApproval(state, {
      projectId: "p1",
      treId: "tre-a",
      decision: "APPROVED",
      decidedBy: "H",
    });
    expect(() =>
      decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "REFUSED", decidedBy: "H" }),
    ).toThrow();
  });

  it("cascades a refusal to any task still awaiting that project's approval, so the ferry never collects it", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, {
      projectId: "p1",
      treId: "tre-a",
      decision: "REFUSED",
      decidedBy: "Harbourmaster A",
    });

    expect(getTask(state, "t1")?.status).toBe("PROJECT_REFUSED");

    state = tick(state, 50);
    expect(getTask(state, "t1")?.status).toBe("PROJECT_REFUSED");
  });
});

describe("submitTask", () => {
  it("starts a task in AWAITING_PROJECT_APPROVAL", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    expect(getTask(state, "t1")?.status).toBe("AWAITING_PROJECT_APPROVAL");
  });

  it("throws if the task targets a TRE the project was not submitted to", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    expect(() => submitTask(state, { id: "t1", projectId: "p1", treId: "tre-b" })).toThrow();
  });

  it("carries an optional analysis through to the task it creates", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    const analysis = { type: "PEARSON_CORRELATION" as const, variableA: "BMI", variableB: "blood pressure" };
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a", analysis });
    expect(getTask(state, "t1")?.analysis).toEqual(analysis);
  });
});

describe("the queue holds until a decision lands (honesty rule 3)", () => {
  it("never collects a task while its project approval is still PENDING, no matter how many ticks pass", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = tick(state, 100);
    expect(getTask(state, "t1")?.status).toBe("AWAITING_PROJECT_APPROVAL");
  });
});

describe("the journey of a task", () => {
  it("moves one stage per tick once collected, sealing a crate on completion, without ever skipping a state", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });

    // Poll interval is 3; the agent has not polled yet at tick 0.
    expect(getTask(state, "t1")?.status).toBe("AWAITING_PROJECT_APPROVAL");

    state = tick(state); // tick 1
    expect(getTask(state, "t1")?.status).toBe("AWAITING_PROJECT_APPROVAL");
    state = tick(state); // tick 2
    expect(getTask(state, "t1")?.status).toBe("AWAITING_PROJECT_APPROVAL");
    state = tick(state); // tick 3: poll boundary, ferry collects
    expect(getTask(state, "t1")?.status).toBe("QUEUED");
    expect(state.events).toContainEqual({ type: "TASK_COLLECTED", tick: 3, taskId: "t1", treId: "tre-a" });

    state = tick(state); // tick 4
    expect(getTask(state, "t1")?.status).toBe("INITIALIZING");
    state = tick(state); // tick 5
    expect(getTask(state, "t1")?.status).toBe("RUNNING");
    state = tick(state); // tick 6
    expect(getTask(state, "t1")?.status).toBe("COMPLETE");
    state = tick(state); // tick 7
    expect(getTask(state, "t1")?.status).toBe("AWAITING_OUTPUT_REVIEW");

    const crate = getCrateForTask(state, "t1");
    expect(crate).toBeDefined();
    expect(crate?.status).toBe("HELD");
    expect(state.events).toContainEqual({ type: "CRATE_SEALED", tick: 7, crateId: crate!.id, taskId: "t1" });
    expect(["AGGREGATE", "ROW_LEVEL"]).toContain(crate?.content.kind);
    expect(crate?.content.rows.length).toBeGreaterThan(0);
  });

  it("holds a completed crate at AWAITING_OUTPUT_REVIEW indefinitely until a decision lands", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 7); // through to AWAITING_OUTPUT_REVIEW, per the journey above
    expect(getTask(state, "t1")?.status).toBe("AWAITING_OUTPUT_REVIEW");

    state = tick(state, 200);
    expect(getTask(state, "t1")?.status).toBe("AWAITING_OUTPUT_REVIEW");
  });

  it("seals a crate shaped like the task's own analysis, when one is given", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, {
      id: "t1",
      projectId: "p1",
      treId: "tre-a",
      analysis: { type: "CHI_SQUARED", variableA: "HbA1c", variableB: "adherence" },
    });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 7);

    const crate = getCrateForTask(state, "t1");
    expect(crate?.content.kind).toBe("AGGREGATE");
    expect(crate?.content.summary).toContain("HbA1c");
    expect(crate?.content.rows.join(" ")).toMatch(/χ² statistic/);
  });
});

describe("decideOutputReview", () => {
  function completedTaskState() {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 7);
    return state;
  }

  it("releases a crate and the underlying task on RELEASED", () => {
    let state = completedTaskState();
    const crate = getCrateForTask(state, "t1")!;
    state = decideOutputReview(state, { crateId: crate.id, decision: "RELEASED" });
    expect(getTask(state, "t1")?.status).toBe("RELEASED");
    expect(getCrateForTask(state, "t1")?.status).toBe("RELEASED");
  });

  it("never alters a crate's content when deciding it — a decision, not a transformation (honesty rule 4)", () => {
    let state = completedTaskState();
    const crate = getCrateForTask(state, "t1")!;
    state = decideOutputReview(state, { crateId: crate.id, decision: "RELEASED" });
    expect(getCrateForTask(state, "t1")?.content).toEqual(crate.content);
  });

  it("refuses a crate and the underlying task on REFUSED, and the crate is retained rather than deleted", () => {
    let state = completedTaskState();
    const crate = getCrateForTask(state, "t1")!;
    state = decideOutputReview(state, { crateId: crate.id, decision: "REFUSED" });
    expect(getTask(state, "t1")?.status).toBe("OUTPUT_REFUSED");
    const decidedCrate = getCrateForTask(state, "t1");
    expect(decidedCrate?.status).toBe("REFUSED");
    expect(decidedCrate?.id).toBe(crate.id);
  });

  it("throws when the crate has already been decided", () => {
    let state = completedTaskState();
    const crate = getCrateForTask(state, "t1")!;
    state = decideOutputReview(state, { crateId: crate.id, decision: "RELEASED" });
    expect(() => decideOutputReview(state, { crateId: crate.id, decision: "REFUSED" })).toThrow();
  });
});

describe("islands are mutually invisible", () => {
  it("polling one TRE's agent never touches another TRE's tasks", () => {
    let state = twoIslandWorld();
    state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = submitTask(state, { id: "t-a", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "t-b", projectId: "p1", treId: "tre-b" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    // tre-b's approval is left PENDING.

    state = tick(state, 3); // tre-a's agent polls and collects; tre-b's agent polls but finds nothing eligible
    expect(getTask(state, "t-a")?.status).toBe("QUEUED");
    expect(getTask(state, "t-b")?.status).toBe("AWAITING_PROJECT_APPROVAL");
  });

  it("determinism: the same seed and directive script produce identical resulting state", () => {
    function run() {
      let state = createInitialSimState({
        seed: 99,
        tres: [{ id: "tre-a", name: "Island A" }],
        pollIntervalTicks: 2,
      });
      state = submitProject(state, { id: "p1", name: "A", researcher: "R", targetTreIds: ["tre-a"] });
      state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
      state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
      state = tick(state, 6);
      return state;
    }
    expect(run()).toEqual(run());
  });
});
