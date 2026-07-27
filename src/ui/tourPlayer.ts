import type { SimState } from "../core/types.ts";
import { decideOutputReview, decideProjectApproval, submitProject, submitTask, tick } from "../sim/sim.ts";
import type { SimDirective, Tour, TourStop } from "./tourTypes.ts";

export interface TourStopResult {
  readonly stop: TourStop;
  readonly state: SimState;
}

export interface TourRun {
  readonly tour: Tour;
  readonly stops: readonly TourStopResult[];
  readonly finalState: SimState;
}

function applyDirective(state: SimState, directive: SimDirective): SimState {
  switch (directive.kind) {
    case "none":
      return state;
    case "submitProject":
      return submitProject(state, directive.params);
    case "submitTask":
      return submitTask(state, directive.params);
    case "decideProjectApproval":
      return decideProjectApproval(state, directive.params);
    case "decideOutputReview":
      return decideOutputReview(state, directive.params);
    case "tick":
      return tick(state, directive.ticks);
  }
}

/**
 * Headless: drives `src/sim` stop by stop with no rendering. If the tour
 * shows it, the model did it — see CLAUDE.md "Tour mechanism". This is what
 * both free-roam playback and transcript mode replay against.
 */
export function playTour(tour: Tour): TourRun {
  let state = tour.createInitialState();
  const stops: TourStopResult[] = [];
  for (const stop of tour.stops) {
    state = applyDirective(state, stop.simDirective);
    stops.push({ stop, state });
  }
  return { tour, stops, finalState: state };
}
