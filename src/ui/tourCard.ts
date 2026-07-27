import type { TreId } from "../core/types.ts";
import type { CameraPoseVec } from "../engine/cameraRig.ts";
import type { IslandGeometry } from "../world/layout.ts";
import { resolveCameraPose } from "./cameraPoses.ts";
import { clear, el, setClass, setText } from "./dom.ts";
import {
  currentStop,
  isAtEnd,
  isAtStart,
  nextStop,
  prevStop,
  startTour,
  stopCount,
  type TourPosition,
} from "./tourRunner.ts";
import type { Tour } from "./tourTypes.ts";

/**
 * The lower-third narration card: one chapter at a time, dual register
 * (plain always visible, technical detail behind a native <details>
 * disclosure), auto-advancing but always interruptible — see CLAUDE.md
 * "Tour mechanism". Camera cuts are instant, which is also the correct
 * `prefers-reduced-motion` behaviour, not just the simplest one to build
 * first; animated camera flight between stops is a later addition.
 */
const STOP_DURATION_MS = 9000;

export interface TourCardOptions {
  readonly tour: Tour;
  readonly islands: ReadonlyMap<TreId, IslandGeometry>;
  readonly onCameraPose: (pose: CameraPoseVec) => void;
  readonly onExit: () => void;
}

export interface TourCardHandle {
  dispose(): void;
}

export function startTourCard(root: HTMLElement, options: TourCardOptions): TourCardHandle {
  let position: TourPosition = startTour(options.tour);
  let playing = true;
  let timer: number | null = null;

  const idxN = el("div", { class: "fsa-tour-card__n" });
  const idxOf = el("div", { class: "fsa-tour-card__of" });
  const title = el("h2", { class: "fsa-tour-card__title" });
  const plain = el("p", { class: "fsa-tour-card__plain" });
  const detailBody = el("p");
  const detail = el(
    "details",
    { class: "fsa-tour-card__detail" },
    el("summary", { text: "Technical detail" }),
    detailBody,
  );
  const progress = el("div", { class: "fsa-tour-card__progress" });
  const prevBtn = el("button", {
    class: "fsa-btn",
    type: "button",
    text: "‹ Prev",
    on: { click: () => manualGo(prevStop(position)) },
  });
  const playPauseBtn = el("button", { class: "fsa-btn", type: "button", on: { click: () => togglePlay() } });
  const nextBtn = el("button", {
    class: "fsa-btn",
    type: "button",
    text: "Next ›",
    on: { click: () => manualGo(nextStop(position)) },
  });
  const exitBtn = el("button", { class: "fsa-btn", type: "button", text: "Exit tour (Esc)", on: { click: exit } });

  const card = el(
    "div",
    { class: "fsa-tour-card" },
    el(
      "div",
      { class: "fsa-tour-card__grid" },
      el("div", { class: "fsa-tour-card__idx" }, idxN, idxOf),
      el("div", {}, title, plain, detail),
    ),
    el("div", { class: "fsa-tour-card__controls" }, prevBtn, playPauseBtn, nextBtn, progress, exitBtn),
  );
  const layer = el("div", { id: "fsa-tour-layer" }, card);
  root.append(layer);
  document.body.classList.add("fsa-touring");

  function renderProgress(): void {
    clear(progress);
    for (let i = 0; i < stopCount(position); i++) {
      const dot = el("div", { class: "fsa-tour-card__dot" });
      setClass(dot, "is-current", i === position.index);
      setClass(dot, "is-done", i < position.index);
      progress.append(dot);
    }
  }

  function render(): void {
    const { stop } = currentStop(position);
    setText(idxN, String(position.index + 1));
    setText(idxOf, `/ ${stopCount(position)}`);
    setText(title, stop.title);
    setText(plain, stop.narration.plain);
    setText(detailBody, stop.narration.detail);
    renderProgress();
    prevBtn.disabled = isAtStart(position);
    nextBtn.disabled = isAtEnd(position);
    setText(playPauseBtn, playing ? "⏸ Pause" : "▶ Play");
    options.onCameraPose(resolveCameraPose(stop.cameraPose, options.islands));
  }

  function clearTimer(): void {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleAutoAdvance(): void {
    clearTimer();
    if (!playing || isAtEnd(position)) return;
    timer = window.setTimeout(() => {
      position = nextStop(position);
      render();
      scheduleAutoAdvance();
    }, STOP_DURATION_MS);
  }

  /** Any explicit prev/next click or key press pauses auto-advance — the viewer took the wheel. */
  function manualGo(next: TourPosition): void {
    playing = false;
    clearTimer();
    position = next;
    render();
  }

  function togglePlay(): void {
    playing = !playing;
    render();
    scheduleAutoAdvance();
  }

  function exit(): void {
    dispose();
    options.onExit();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowRight" || event.key === " ") {
      manualGo(nextStop(position));
      event.preventDefault();
    } else if (event.key === "ArrowLeft") {
      manualGo(prevStop(position));
      event.preventDefault();
    } else if (event.key === "Escape") {
      exit();
    }
  }
  window.addEventListener("keydown", onKeydown);

  render();
  scheduleAutoAdvance();

  function dispose(): void {
    clearTimer();
    window.removeEventListener("keydown", onKeydown);
    document.body.classList.remove("fsa-touring");
    layer.remove();
  }

  return { dispose };
}
