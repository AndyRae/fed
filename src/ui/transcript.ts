import type { SimState } from "../core/types.ts";
import { getCrate, getTask, releasedCratesForProject } from "../sim/selectors.ts";
import { playTour } from "./tourPlayer.ts";
import type { FocusEntity, Tour } from "./tourTypes.ts";

/**
 * Transcript mode: every tour readable end-to-end as linear text, with no
 * WebGL — the accessibility path, the low-spec-machine path, and the
 * copy-into-a-governance-pack path. See CLAUDE.md "Tour mechanism".
 */
export interface TranscriptStop {
  readonly stopId: string;
  readonly plain: string;
  readonly detail: string;
  /** Stands in for "a still": a text description of the real sim state this stop left behind, not canned copy. */
  readonly stateDescription: string;
}

export interface Transcript {
  readonly tourId: string;
  readonly title: string;
  readonly stops: readonly TranscriptStop[];
}

function describeFocus(focus: FocusEntity, state: SimState): string {
  switch (focus.kind) {
    case "none":
      return "No entity in focus.";
    case "tre": {
      const tre = state.tres.find((t) => t.id === focus.treId);
      return `TRE in focus: ${tre?.name ?? focus.treId}.`;
    }
    case "project": {
      const project = state.projects.find((p) => p.id === focus.projectId);
      if (!project) return `Project in focus: ${focus.projectId} (not yet submitted).`;
      const releasedCount = releasedCratesForProject(state, focus.projectId).length;
      return `Project in focus: "${project.name}", submitted by ${project.researcher}. Released results gathered at the quay so far: ${releasedCount} (status RELEASED).`;
    }
    case "task": {
      const task = getTask(state, focus.taskId);
      return task
        ? `Task in focus: ${task.id}, status ${task.status}.`
        : `Task in focus: ${focus.taskId} (not yet submitted).`;
    }
    case "crate": {
      const crate = getCrate(state, focus.crateId);
      return crate
        ? `Crate in focus: ${crate.id}, status ${crate.status}.`
        : `Crate in focus: ${focus.crateId} (not yet sealed).`;
    }
  }
}

/** Plays the tour headlessly and turns each stop's narration plus the real resulting sim state into one transcript stop. */
export function buildTranscript(tour: Tour): Transcript {
  const run = playTour(tour);
  return {
    tourId: tour.id,
    title: tour.title,
    stops: run.stops.map(({ stop, state }) => ({
      stopId: stop.id,
      plain: stop.narration.plain,
      detail: stop.narration.detail,
      stateDescription: describeFocus(stop.focusEntity, state),
    })),
  };
}

/** Renders a transcript as plain, linear text — no markup, no rendered scene implied. */
export function renderTranscriptText(transcript: Transcript): string {
  const lines: string[] = [transcript.title, "=".repeat(transcript.title.length), ""];
  transcript.stops.forEach((stop, index) => {
    lines.push(`${index + 1}. ${stop.stopId}`);
    lines.push(stop.plain);
    lines.push(`Technical detail: ${stop.detail}`);
    lines.push(stop.stateDescription);
    lines.push("");
  });
  return lines.join("\n");
}
