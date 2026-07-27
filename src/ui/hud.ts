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
}

export interface HudHandle {
  dispose(): void;
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

  const bar = el(
    "div",
    { id: "fsa-hud-top", class: "fsa-hud-top" },
    el("div", { class: "fsa-hud-top__title", text: "Five Safes Archipelago" }),
    el("div", { class: "fsa-hud-top__disclosure", text: SCALED_TIME_DISCLOSURE }),
    el("div", { class: "fsa-hud-top__tours" }, ...tourButtons),
  );
  root.append(bar);

  return {
    dispose() {
      bar.remove();
    },
  };
}
