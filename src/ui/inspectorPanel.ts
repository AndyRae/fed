import type * as THREE from "three";
import { explanationForKind } from "../core/explanations.ts";
import type { SimState, TreId } from "../core/types.ts";
import { getCrate } from "../sim/selectors.ts";
import { clear, el, setText } from "./dom.ts";

/**
 * The click-to-explain panel: whatever the picker selects, this shows its
 * dual-register explanation — the technical reader's "open the inspector on
 * any entity" surface from CLAUDE.md's audience requirements. Not unit
 * tested — DOM-only, browser-verified like tourCard.ts.
 */
export interface InspectorPanelOptions {
  /** Real names for TRE ids, so a per-island entity reads "Isle of Ailsa" rather than "tre-a". */
  readonly treNames?: ReadonlyMap<TreId, string>;
  /** Optional live sim state accessor, for a little real context (e.g. a crate's current status). */
  readonly getState?: () => SimState;
  readonly onClose?: () => void;
}

export interface InspectorPanelHandle {
  show(object: THREE.Object3D): void;
  hide(): void;
  dispose(): void;
}

function contextLines(object: THREE.Object3D, options: InspectorPanelOptions): string[] {
  const lines: string[] = [];
  const treId = object.userData.treId as TreId | undefined;
  if (treId) {
    const name = options.treNames?.get(treId) ?? treId;
    lines.push(`Island: ${name}`);
  }
  const crateId = object.userData.crateId as string | undefined;
  if (crateId && options.getState) {
    const crate = getCrate(options.getState(), crateId);
    if (crate) lines.push(`Status: ${crate.status}`);
  }
  return lines;
}

export function mountInspectorPanel(root: HTMLElement, options: InspectorPanelOptions = {}): InspectorPanelHandle {
  const title = el("h2", { class: "fsa-inspector__title" });
  const plain = el("p", { class: "fsa-inspector__plain" });
  const context = el("p", { class: "fsa-inspector__context" });
  const detailBody = el("p");
  const detail = el(
    "details",
    { class: "fsa-inspector__detail" },
    el("summary", { text: "Technical detail" }),
    detailBody,
  );
  const closeBtn = el("button", {
    class: "fsa-btn fsa-inspector__close",
    type: "button",
    text: "✕",
    "aria-label": "Close",
    on: { click: () => hide() },
  });

  const panel = el(
    "div",
    { class: "fsa-inspector" },
    closeBtn,
    title,
    plain,
    context,
    detail,
  );
  const layer = el("div", { id: "fsa-inspector-layer" }, panel);
  root.append(layer);

  function setVisible(visible: boolean): void {
    if (visible) layer.classList.add("is-open");
    else layer.classList.remove("is-open");
  }
  setVisible(false);

  function show(object: THREE.Object3D): void {
    const kind = object.userData.kind as string | undefined;
    const explanation = kind ? explanationForKind(kind) : undefined;
    if (!explanation) {
      hide();
      return;
    }
    setText(title, explanation.title);
    setText(plain, explanation.plain);
    setText(detailBody, explanation.detail);
    clear(context);
    for (const line of contextLines(object, options)) {
      context.append(el("span", { class: "fsa-inspector__context-line", text: line }));
    }
    setVisible(true);
  }

  function hide(): void {
    setVisible(false);
    options.onClose?.();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && layer.classList.contains("is-open")) hide();
  }
  window.addEventListener("keydown", onKeydown);

  return {
    show,
    hide,
    dispose() {
      window.removeEventListener("keydown", onKeydown);
      layer.remove();
    },
  };
}
