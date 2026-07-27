import { playTour, type TourRun, type TourStopResult } from "./tourPlayer.ts";
import type { Tour } from "./tourTypes.ts";

/**
 * A tour's playback position. Immutable, like the rest of this codebase's
 * state — advancing never mutates, it returns a new position. The whole
 * run is precomputed once by `playTour` (deterministic, per CLAUDE.md
 * "Simulation model"), so stepping is just moving an index: no sim logic
 * re-runs, and stepping backward is exact rather than approximated.
 */
export interface TourPosition {
  readonly run: TourRun;
  readonly index: number;
}

export function startTour(tour: Tour): TourPosition {
  return { run: playTour(tour), index: 0 };
}

export function currentStop(position: TourPosition): TourStopResult {
  return position.run.stops[position.index]!;
}

export function stopCount(position: TourPosition): number {
  return position.run.stops.length;
}

export function isAtStart(position: TourPosition): boolean {
  return position.index === 0;
}

export function isAtEnd(position: TourPosition): boolean {
  return position.index === position.run.stops.length - 1;
}

function clampIndex(position: TourPosition, index: number): number {
  return Math.max(0, Math.min(position.run.stops.length - 1, index));
}

export function goToStop(position: TourPosition, index: number): TourPosition {
  return { run: position.run, index: clampIndex(position, index) };
}

export function nextStop(position: TourPosition): TourPosition {
  return goToStop(position, position.index + 1);
}

export function prevStop(position: TourPosition): TourPosition {
  return goToStop(position, position.index - 1);
}
