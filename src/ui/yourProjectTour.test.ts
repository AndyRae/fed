import { describe, expect, it } from "vitest";
import { getCrateForTask, getTask, releasedCratesForProject } from "../sim/selectors.ts";
import { playTour } from "./tourPlayer.ts";
import { buildYourProjectTour } from "./tours.ts";

function narrationIsDualRegister(tour: { stops: readonly { narration: { plain: string; detail: string } }[] }) {
  return tour.stops.every((stop) => stop.narration.plain.trim().length > 0 && stop.narration.detail.trim().length > 0);
}

const SAMPLE_INPUT = { title: "My Cardiovascular Study", areaId: "cardiovascular", analysisType: "PEARSON_CORRELATION" as const };

describe("buildYourProjectTour (the interactive create-your-own-project journey)", () => {
  it("has non-empty plain and technical narration at every stop", () => {
    expect(narrationIsDualRegister(buildYourProjectTour(SAMPLE_INPUT))).toBe(true);
  });

  it("walks the sim through submit -> approved -> collected -> run -> sealed -> released, always on rails", () => {
    const run = playTour(buildYourProjectTour(SAMPLE_INPUT));
    const taskId = "task-1";
    const statusByStopId = new Map(run.stops.map((s) => [s.stop.id, getTask(s.state, taskId)?.status]));

    expect(statusByStopId.get("submit-project")).toBeUndefined();
    expect(statusByStopId.get("submit-task")).toBe("AWAITING_PROJECT_APPROVAL");
    expect(statusByStopId.get("gate-1-approval")).toBe("AWAITING_PROJECT_APPROVAL");
    expect(statusByStopId.get("ferry-collects")).toBe("QUEUED");
    expect(statusByStopId.get("workshop-executes")).toBe("RUNNING");
    expect(statusByStopId.get("sealed-crate")).toBe("AWAITING_OUTPUT_REVIEW");
    expect(statusByStopId.get("gate-2-review")).toBe("RELEASED");
    expect(statusByStopId.get("results-at-the-quay")).toBe("RELEASED");
  });

  it("seals a crate shaped like the chosen analysis, always AGGREGATE", () => {
    const run = playTour(buildYourProjectTour(SAMPLE_INPUT));
    const finalState = run.finalState;
    const crate = getCrateForTask(finalState, "task-1");
    expect(crate?.status).toBe("RELEASED");
    expect(crate?.content.kind).toBe("AGGREGATE");
    expect(crate?.content.summary).toContain("BMI");
    expect(crate?.content.rows.join(" ")).toMatch(/Pearson's r/);
  });

  it("puts the exact same crate content into the final stop's narration as the sim actually sealed", () => {
    const run = playTour(buildYourProjectTour(SAMPLE_INPUT));
    const crate = getCrateForTask(run.finalState, "task-1");
    const finalStop = run.stops[run.stops.length - 1]!;
    expect(finalStop.stop.narration.plain).toContain(crate!.content.summary);
  });

  it("aggregates the released crate at the researcher's quay under the visitor's own project", () => {
    const run = playTour(buildYourProjectTour(SAMPLE_INPUT));
    const released = releasedCratesForProject(run.finalState, run.finalState.projects[0]!.id);
    expect(released).toHaveLength(1);
    expect(released[0]!.taskId).toBe("task-1");
  });

  it("is fully deterministic for the same input: replaying it twice produces identical final state", () => {
    const a = playTour(buildYourProjectTour(SAMPLE_INPUT));
    const b = playTour(buildYourProjectTour(SAMPLE_INPUT));
    expect(a.finalState).toEqual(b.finalState);
  });

  it("gives two different titles genuinely different illustrative numbers", () => {
    const a = playTour(buildYourProjectTour({ ...SAMPLE_INPUT, title: "Study Alpha" }));
    const b = playTour(buildYourProjectTour({ ...SAMPLE_INPUT, title: "Study Beta" }));
    const crateA = getCrateForTask(a.finalState, "task-1");
    const crateB = getCrateForTask(b.finalState, "task-1");
    expect(crateA?.content.rows).not.toEqual(crateB?.content.rows);
  });

  it("falls back to a sensible default project title when given an empty or blank one", () => {
    const tour = buildYourProjectTour({ ...SAMPLE_INPUT, title: "   " });
    expect(tour.stops[0]!.narration.plain.length).toBeGreaterThan(0);
    const run = playTour(tour);
    expect(run.finalState.projects[0]?.name).toBe("Untitled Study");
  });

  it("varies narration and crate shape by the chosen analysis type", () => {
    const fishers = playTour(buildYourProjectTour({ ...SAMPLE_INPUT, analysisType: "FISHERS_EXACT" }));
    const crate = getCrateForTask(fishers.finalState, "task-1");
    expect(crate?.content.rows.join(" ")).toMatch(/Fisher's exact|contingency table/);
  });
});
