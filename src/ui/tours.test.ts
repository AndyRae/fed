import { describe, expect, it } from "vitest";
import { getCrateForTask, getTask, releasedCratesForProject } from "../sim/selectors.ts";
import { journeyOfATaskTour, theResultThatNeverLeftTour } from "./tours.ts";
import { playTour } from "./tourPlayer.ts";

function narrationIsDualRegister(tour: { stops: readonly { narration: { plain: string; detail: string } }[] }) {
  return tour.stops.every(
    (stop) => stop.narration.plain.trim().length > 0 && stop.narration.detail.trim().length > 0,
  );
}

describe("the journey of a task (flagship tour)", () => {
  it("has non-empty plain and technical narration at every stop", () => {
    expect(narrationIsDualRegister(journeyOfATaskTour)).toBe(true);
  });

  it("walks the sim through the expected task state sequence, stop by stop", () => {
    const run = playTour(journeyOfATaskTour);
    const taskId = "task-1";

    const statusByStopId = new Map(run.stops.map((s) => [s.stop.id, getTask(s.state, taskId)?.status]));

    expect(statusByStopId.get("submit-project")).toBeUndefined(); // task doesn't exist yet
    expect(statusByStopId.get("submit-task")).toBe("AWAITING_PROJECT_APPROVAL");
    expect(statusByStopId.get("gate-1-approval")).toBe("AWAITING_PROJECT_APPROVAL"); // approved, but the ferry hasn't polled yet
    expect(statusByStopId.get("ferry-collects")).toBe("QUEUED");
    expect(statusByStopId.get("workshop-executes")).toBe("RUNNING");
    expect(statusByStopId.get("sealed-crate")).toBe("AWAITING_OUTPUT_REVIEW");
    expect(statusByStopId.get("gate-2-review")).toBe("RELEASED");
    expect(statusByStopId.get("release")).toBe("RELEASED");
    expect(statusByStopId.get("aggregation-at-the-quay")).toBe("RELEASED");
  });

  it("seals exactly one HELD crate before Gate 2, then releases it", () => {
    const run = playTour(journeyOfATaskTour);
    const sealedStop = run.stops.find((s) => s.stop.id === "sealed-crate")!;
    expect(getCrateForTask(sealedStop.state, "task-1")?.status).toBe("HELD");

    const finalStop = run.stops[run.stops.length - 1]!;
    expect(getCrateForTask(finalStop.state, "task-1")?.status).toBe("RELEASED");
  });

  it("aggregates the released crate at the researcher's quay, by project", () => {
    const run = playTour(journeyOfATaskTour);
    const released = releasedCratesForProject(run.finalState, "proj-diabetes-cohort");
    expect(released).toHaveLength(1);
    expect(released[0]!.taskId).toBe("task-1");
  });

  it("is fully deterministic: replaying it twice produces identical final state", () => {
    expect(playTour(journeyOfATaskTour).finalState).toEqual(playTour(journeyOfATaskTour).finalState);
  });
});

describe("the result that never left (refusal tour)", () => {
  it("has non-empty plain and technical narration at every stop", () => {
    expect(narrationIsDualRegister(theResultThatNeverLeftTour)).toBe(true);
  });

  it("reaches OUTPUT_REFUSED at Gate 2, never RELEASED", () => {
    const run = playTour(theResultThatNeverLeftTour);
    expect(getTask(run.finalState, "task-1")?.status).toBe("OUTPUT_REFUSED");
  });

  it("retains the refused crate rather than deleting it — the researcher sees a refusal, not silence", () => {
    const run = playTour(theResultThatNeverLeftTour);
    const crate = getCrateForTask(run.finalState, "task-1");
    expect(crate).toBeDefined();
    expect(crate?.status).toBe("REFUSED");
  });

  it("never appears in the released aggregation for its project", () => {
    const run = playTour(theResultThatNeverLeftTour);
    expect(releasedCratesForProject(run.finalState, "proj-imaging-study")).toHaveLength(0);
  });
});
