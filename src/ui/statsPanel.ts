import type { SimState } from "../core/types.ts";
import { computeActivityStats } from "../sim/selectors.ts";
import { el, setText } from "./dom.ts";

/**
 * The live activity panel: a compact tally of the whole funnel — the
 * PGSimCity-style "instrument readout" corner, scoped to what this model
 * actually tracks instead of database metrics — plus, PGSimCity-style
 * again, the one live control this demo has: how fast it runs. Every
 * number here is a straight read of `computeActivityStats(getState())`;
 * the panel never drives protocol state itself, only displays it and
 * reports the speed control's own value back to main.ts, which owns what
 * "speed" actually does. Not unit tested — DOM-only, same precedent as
 * hud.ts and inspectorPanel.ts.
 */
export interface SpeedControlOptions {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
  readonly onChange: (speed: number) => void;
}

export interface StatsPanelOptions {
  readonly getState: () => SimState;
  readonly speed: SpeedControlOptions;
}

export interface StatsPanelHandle {
  /** Re-reads the latest state and repaints. Call this on the same cadence the ambient demo ticks — the panel has no timer of its own. */
  update(): void;
  dispose(): void;
}

interface Row {
  readonly label: string;
  readonly valueEl: HTMLElement;
}

function statRow(label: string): Row {
  const valueEl = el("span", { class: "fsa-stats__value", text: "0" });
  return { label, valueEl };
}

export function mountStatsPanel(root: HTMLElement, options: StatsPanelOptions): StatsPanelHandle {
  const projects = statRow("Projects submitted");
  const gate1 = statRow("Safe project decided");
  const inFlight = statRow("Tasks in flight");
  const analyses = statRow("Analyses run");
  const gate2 = statRow("Safe output decided");

  const rows = [projects, gate1, inFlight, analyses, gate2];

  const speedValue = el("span", { class: "fsa-stats__speed-value", text: `${options.speed.initial}×` });
  const speedSlider = el("input", {
    type: "range",
    id: "fsa-stats-speed",
    min: String(options.speed.min),
    max: String(options.speed.max),
    step: "1",
    value: String(options.speed.initial),
    "aria-label": "Simulation speed",
    on: {
      input: (event: Event) => {
        const speed = Number((event.target as HTMLInputElement).value);
        setText(speedValue, `${speed}×`);
        options.speed.onChange(speed);
      },
    },
  });
  const speedRow = el(
    "div",
    { class: "fsa-stats__speed" },
    el("label", { for: "fsa-stats-speed", text: "Speed" }),
    speedSlider,
    speedValue,
  );

  const panel = el(
    "div",
    { id: "fsa-stats-panel", class: "fsa-stats" },
    el("div", { class: "fsa-stats__title", text: "Live activity" }),
    speedRow,
    ...rows.map((row) =>
      el("div", { class: "fsa-stats__row" }, el("span", { class: "fsa-stats__label", text: row.label }), row.valueEl),
    ),
  );
  root.append(panel);

  function update(): void {
    const stats = computeActivityStats(options.getState());
    setText(projects.valueEl, String(stats.projectsSubmitted));
    setText(gate1.valueEl, `${stats.gate1Approved} approved · ${stats.gate1Refused} refused`);
    setText(inFlight.valueEl, String(stats.tasksInFlight));
    setText(analyses.valueEl, String(stats.analysesRun));
    setText(gate2.valueEl, `${stats.gate2Released} released · ${stats.gate2Refused} refused`);
  }
  update();

  return {
    update,
    dispose() {
      panel.remove();
    },
  };
}
