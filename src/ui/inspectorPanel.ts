import type * as THREE from "three";
import { explanationForKind } from "../core/explanations.ts";
import type { CrateId, ProjectId, SimState, TreId } from "../core/types.ts";
import { getCrate, heldCratesForTre, pendingApprovalsForTre } from "../sim/selectors.ts";
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
  /** Whether the visitor currently has manual control of the gates — see main.ts's manual-gates toggle. Gates the decision UI below; when false, clicking a gate with something pending explains that it's still deciding on its own. */
  readonly isManualGatesEnabled?: () => boolean;
  readonly onDecideProjectApproval?: (params: { projectId: ProjectId; treId: TreId; decision: "APPROVED" | "REFUSED" }) => void;
  readonly onDecideOutputReview?: (params: { crateId: CrateId; decision: "RELEASED" | "REFUSED" }) => void;
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

const AUTOMATIC_DECISION_HINT = "This decision is automatic right now — toggle ⚖ in the top bar to make it yourself.";

export function mountInspectorPanel(root: HTMLElement, options: InspectorPanelOptions = {}): InspectorPanelHandle {
  const title = el("h2", { class: "fsa-inspector__title" });
  const plain = el("p", { class: "fsa-inspector__plain" });
  const decision = el("div", { class: "fsa-inspector__decision" });
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
    decision,
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

  /** Gate 1's own inbox: the oldest project still awaiting this TRE's decision, if any. Re-invoked after every Approve/Refuse click so the panel immediately shows the next one waiting, without requiring a fresh click on the gate. */
  function renderGate1Decision(treId: TreId): void {
    clear(decision);
    if (!options.getState) return;
    const pending = pendingApprovalsForTre(options.getState(), treId);
    if (pending.length === 0) return;

    if (!options.isManualGatesEnabled?.()) {
      decision.append(el("p", { class: "fsa-inspector__decision-hint", text: AUTOMATIC_DECISION_HINT }));
      return;
    }

    const next = pending[0]!;
    const project = options.getState().projects.find((p) => p.id === next.projectId);
    const decide = (outcome: "APPROVED" | "REFUSED") => {
      options.onDecideProjectApproval?.({ projectId: next.projectId, treId, decision: outcome });
      renderGate1Decision(treId);
    };
    decision.append(
      el(
        "div",
        { class: "fsa-inspector__decision-card" },
        el("p", { class: "fsa-inspector__decision-lead", text: project ? `Pending: ${project.name}` : "A project is pending" }),
        project ? el("p", { class: "fsa-inspector__decision-sub", text: `Submitted by ${project.researcher}` }) : null,
        el(
          "div",
          { class: "fsa-inspector__decision-actions" },
          el("button", { class: "fsa-btn fsa-btn--approve", type: "button", text: "Approve", on: { click: () => decide("APPROVED") } }),
          el("button", { class: "fsa-btn fsa-btn--refuse", type: "button", text: "Refuse", on: { click: () => decide("REFUSED") } }),
        ),
        pending.length > 1 ? el("p", { class: "fsa-inspector__decision-queue", text: `+${pending.length - 1} more waiting` }) : null,
      ),
    );
  }

  /** Gate 2's own inbox: the oldest sealed crate still awaiting this TRE's decision, if any. Same re-render-in-place pattern as renderGate1Decision. */
  function renderGate2Decision(treId: TreId): void {
    clear(decision);
    if (!options.getState) return;
    const held = heldCratesForTre(options.getState(), treId);
    if (held.length === 0) return;

    if (!options.isManualGatesEnabled?.()) {
      decision.append(el("p", { class: "fsa-inspector__decision-hint", text: AUTOMATIC_DECISION_HINT }));
      return;
    }

    const next = held[0]!;
    const project = options.getState().projects.find((p) => p.id === next.projectId);
    const decide = (outcome: "RELEASED" | "REFUSED") => {
      options.onDecideOutputReview?.({ crateId: next.id, decision: outcome });
      renderGate2Decision(treId);
    };
    decision.append(
      el(
        "div",
        { class: "fsa-inspector__decision-card" },
        el("p", { class: "fsa-inspector__decision-lead", text: project ? `Pending: a result from ${project.name}` : "A result is pending" }),
        el(
          "div",
          { class: `fsa-inspector__content fsa-inspector__content--${next.content.kind.toLowerCase()}` },
          el("p", { class: "fsa-inspector__content-summary", text: next.content.summary }),
          el(
            "ul",
            { class: "fsa-inspector__content-rows" },
            ...next.content.rows.map((row) => el("li", { text: row })),
          ),
          el("p", { class: "fsa-inspector__content-note", text: "Illustrative example — no real data exists in this simulation." }),
        ),
        el(
          "div",
          { class: "fsa-inspector__decision-actions" },
          el("button", { class: "fsa-btn fsa-btn--approve", type: "button", text: "Release", on: { click: () => decide("RELEASED") } }),
          el("button", { class: "fsa-btn fsa-btn--refuse", type: "button", text: "Refuse", on: { click: () => decide("REFUSED") } }),
        ),
        held.length > 1 ? el("p", { class: "fsa-inspector__decision-queue", text: `+${held.length - 1} more waiting` }) : null,
      ),
    );
  }

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

    clear(decision);
    const treId = object.userData.treId as TreId | undefined;
    if (treId && kind === "GATE1_HARBOURMASTER") renderGate1Decision(treId);
    else if (treId && kind === "GATE2_INSPECTOR") renderGate2Decision(treId);

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
