import { el } from "./dom.ts";
import type { Tour } from "./tourTypes.ts";

/**
 * The top instrument bar: identity, the scaled-time disclosure required by
 * CLAUDE.md honesty rule 7, and the tour launch buttons. Dims while a tour
 * is running (see styles.css `body.fsa-touring`) but never hides — the
 * disclosure has to stay readable, and tours must stay interruptible.
 */
export interface HudOptions {
  readonly tours: readonly Tour[];
  readonly onStartTour: (tour: Tour) => void;
  readonly onToggleHelp: () => void;
  readonly onToggleNight: () => void;
  readonly onToggleManualGates: () => void;
}

export interface HudHandle {
  dispose(): void;
  /** Reflects the toggle's own visual pressed state — night mode's actual on/off state lives in engine/nightMode.ts, not here. */
  setNightActive(active: boolean): void;
  /** Same pattern as setNightActive — the manual/automatic state itself lives in main.ts. */
  setManualGatesActive(active: boolean): void;
}

const SCALED_TIME_DISCLOSURE =
  "Time is compressed for clarity — a real Gate 1 or Gate 2 decision can take days; this world shows the same choreography in seconds.";

export function mountHud(root: HTMLElement, options: HudOptions): HudHandle {
  const tourButtons = options.tours.map((tour) =>
    el(
      "button",
      {
        class: "fsa-btn",
        type: "button",
        text: `▶ ${tour.title}`,
        on: { click: () => options.onStartTour(tour) },
      },
    ),
  );

  const nightButton = el("button", {
    class: "fsa-btn fsa-hud-top__night",
    type: "button",
    text: "🌙",
    "aria-label": "Toggle night mode",
    "aria-pressed": "false",
    on: { click: () => options.onToggleNight() },
  });

  const gatesButton = el("button", {
    class: "fsa-btn fsa-hud-top__gates",
    type: "button",
    text: "⚖",
    "aria-label": "Toggle manual control of the gates",
    "aria-pressed": "false",
    on: { click: () => options.onToggleManualGates() },
  });

  const helpButton = el("button", {
    class: "fsa-btn fsa-hud-top__help",
    type: "button",
    text: "?",
    "aria-label": "Help — controls and about this world",
    on: { click: () => options.onToggleHelp() },
  });

  const bar = el(
    "div",
    { id: "fsa-hud-top", class: "fsa-hud-top" },
    el("div", { class: "fsa-hud-top__title", text: "Five Safes Archipelago" }),
    el("div", { class: "fsa-hud-top__disclosure", text: SCALED_TIME_DISCLOSURE }),
    el("div", { class: "fsa-hud-top__tours" }, ...tourButtons, gatesButton, nightButton, helpButton),
  );
  root.append(bar);

  return {
    dispose() {
      bar.remove();
    },
    setNightActive(active) {
      nightButton.classList.toggle("is-active", active);
      nightButton.setAttribute("aria-pressed", String(active));
    },
    setManualGatesActive(active) {
      gatesButton.classList.toggle("is-active", active);
      gatesButton.setAttribute("aria-pressed", String(active));
    },
  };
}
