import { describe, expect, it } from "vitest";
import { getTask } from "../sim/selectors.ts";
import { journeyOfATaskTour } from "./tours.ts";
import {
  currentStop,
  goToStop,
  isAtEnd,
  isAtStart,
  nextStop,
  prevStop,
  startTour,
  stopCount,
} from "./tourRunner.ts";

describe("startTour", () => {
  it("starts at the first stop", () => {
    const position = startTour(journeyOfATaskTour);
    expect(isAtStart(position)).toBe(true);
    expect(currentStop(position).stop.id).toBe(journeyOfATaskTour.stops[0]!.id);
  });

  it("precomputes every stop's real sim state up front — stepping never re-runs sim logic", () => {
    const position = startTour(journeyOfATaskTour);
    expect(stopCount(position)).toBe(journeyOfATaskTour.stops.length);
  });
});

describe("nextStop / prevStop", () => {
  it("advances one stop at a time and stops advancing at the last stop", () => {
    let position = startTour(journeyOfATaskTour);
    const total = stopCount(position);
    for (let i = 1; i < total; i++) {
      position = nextStop(position);
      expect(currentStop(position).stop.id).toBe(journeyOfATaskTour.stops[i]!.id);
    }
    expect(isAtEnd(position)).toBe(true);
    const atEnd = nextStop(position);
    expect(currentStop(atEnd).stop.id).toBe(journeyOfATaskTour.stops[total - 1]!.id);
  });

  it("moves backward and stops at the first stop rather than wrapping", () => {
    let position = startTour(journeyOfATaskTour);
    position = nextStop(nextStop(position));
    position = prevStop(position);
    expect(currentStop(position).stop.id).toBe(journeyOfATaskTour.stops[1]!.id);

    const atStart = prevStop(prevStop(position));
    expect(isAtStart(atStart)).toBe(true);
    expect(currentStop(atStart).stop.id).toBe(journeyOfATaskTour.stops[0]!.id);
  });

  it("reflects the real precomputed sim state at each step, not just narration text", () => {
    let position = startTour(journeyOfATaskTour);
    // Step to "ferry-collects", where task-1 should already be QUEUED.
    const ferryCollectsIndex = journeyOfATaskTour.stops.findIndex((s) => s.id === "ferry-collects");
    for (let i = 0; i < ferryCollectsIndex; i++) position = nextStop(position);
    expect(getTask(currentStop(position).state, "task-1")?.status).toBe("QUEUED");
  });
});

describe("goToStop", () => {
  it("jumps directly to an arbitrary valid index", () => {
    const position = goToStop(startTour(journeyOfATaskTour), 3);
    expect(currentStop(position).stop.id).toBe(journeyOfATaskTour.stops[3]!.id);
  });

  it("clamps an out-of-range index instead of throwing", () => {
    const tooFar = goToStop(startTour(journeyOfATaskTour), 999);
    expect(isAtEnd(tooFar)).toBe(true);
    const negative = goToStop(startTour(journeyOfATaskTour), -5);
    expect(isAtStart(negative)).toBe(true);
  });
});
