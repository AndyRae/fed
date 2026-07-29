import { describe, expect, it } from "vitest";
import { getCrateForTask, getTask, releasedCratesForProject } from "../sim/selectors.ts";
import { journeyOfATaskTour, theFiveSafesTour, theResultThatNeverLeftTour } from "./tours.ts";
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
    expect(statusByStopId.get("the-vault-holds-still")).toBe("RUNNING");
    expect(statusByStopId.get("sealed-crate")).toBe("AWAITING_OUTPUT_REVIEW");
    expect(statusByStopId.get("gate-2-review")).toBe("RELEASED");
    expect(statusByStopId.get("release")).toBe("RELEASED");
    expect(statusByStopId.get("aggregation-at-the-quay")).toBe("RELEASED");
  });

  it("holds the camera on the vault specifically while the workshop is running — a dedicated moment, not incidental", () => {
    const vaultStop = journeyOfATaskTour.stops.find((s) => s.id === "the-vault-holds-still")!;
    expect(vaultStop.cameraPose).toEqual({ kind: "treVault", treId: "tre-a" });
    expect(vaultStop.narration.plain.toLowerCase()).toContain("vault");
    expect(vaultStop.narration.plain).toMatch(/has not moved|never will/);
    expect(vaultStop.narration.detail).toMatch(/honesty rule 2/i);

    const run = playTour(journeyOfATaskTour);
    const vaultStopState = run.stops.find((s) => s.stop.id === "the-vault-holds-still")!.state;
    expect(getTask(vaultStopState, "task-1")?.status).toBe("RUNNING");
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

describe("the five safes", () => {
  it("has non-empty plain and technical narration at every stop", () => {
    expect(narrationIsDualRegister(theFiveSafesTour)).toBe(true);
  });

  it("gives each of the five safes its own dedicated stop, in the fixed order (people, projects, settings, data, outputs)", () => {
    const titles = theFiveSafesTour.stops.map((s) => s.title);
    expect(titles).toEqual([
      "Safe people",
      "The work travels too",
      "Safe projects",
      "Safe settings",
      "Safe data",
      "A crate is sealed",
      "Safe outputs",
    ]);
  });

  it("walks the sim through the expected task state sequence, stop by stop", () => {
    const run = playTour(theFiveSafesTour);
    const taskId = "task-1";
    const statusByStopId = new Map(run.stops.map((s) => [s.stop.id, getTask(s.state, taskId)?.status]));

    expect(statusByStopId.get("safe-people")).toBeUndefined(); // task doesn't exist yet
    expect(statusByStopId.get("submit-task")).toBe("AWAITING_PROJECT_APPROVAL");
    expect(statusByStopId.get("safe-projects")).toBe("AWAITING_PROJECT_APPROVAL"); // approved, but the ferry hasn't polled yet
    expect(statusByStopId.get("safe-settings")).toBe("RUNNING");
    expect(statusByStopId.get("safe-data")).toBe("RUNNING"); // unchanged: no new sim action, the same real RUNNING state
    expect(statusByStopId.get("crate-sealed")).toBe("AWAITING_OUTPUT_REVIEW");
    expect(statusByStopId.get("safe-outputs")).toBe("RELEASED");
  });

  it("the safe-data stop never advances the tick, so its RUNNING state is the same one safe-settings actually produced — the compute glow it describes is real, not asserted", () => {
    const run = playTour(theFiveSafesTour);
    const settingsStop = run.stops.find((s) => s.stop.id === "safe-settings")!;
    const dataStop = run.stops.find((s) => s.stop.id === "safe-data")!;
    expect(dataStop.state).toBe(settingsStop.state);
  });

  it("seals exactly one HELD crate before the safe-outputs decision, then releases it", () => {
    const run = playTour(theFiveSafesTour);
    const sealedStop = run.stops.find((s) => s.stop.id === "crate-sealed")!;
    expect(getCrateForTask(sealedStop.state, "task-1")?.status).toBe("HELD");

    const finalStop = run.stops[run.stops.length - 1]!;
    expect(getCrateForTask(finalStop.state, "task-1")?.status).toBe("RELEASED");
  });

  it("is fully deterministic: replaying it twice produces identical final state", () => {
    expect(playTour(theFiveSafesTour).finalState).toEqual(playTour(theFiveSafesTour).finalState);
  });
});
