import type * as THREE from "three";
import { explanationForKind } from "../core/explanations.ts";
import type { CrateId, ProjectId, SimState, TreId } from "../core/types.ts";
import { computeIslandLedger, computeProjectLedger, getCrate, heldCratesForTre, pendingApprovalsForTre } from "../sim/selectors.ts";
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
/** How many of the most recently submitted projects the quay's own list shows at once — a queue-style "+N more" cap, same reasoning as pendingApprovalsForTre/heldCratesForTre only ever showing the one at the front. */
const QUAY_PROJECT_LIST_LIMIT = 8;

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

  /** Which project's own per-island detail is expanded within the quay's list — reset to the default (the most recent project) every time show() opens a fresh entity; re-clicking a different row within an already-open quay view just re-renders in place, same pattern as the rest of this panel. */
  let selectedProjectId: ProjectId | null = null;

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

  /** A row of this island's own ledger — see IDEAS.md "An island's own ledger". Read-only: unlike renderGate1Decision/renderGate2Decision there's nothing to decide here, so it never re-renders itself; re-clicking the island refreshes it via a fresh show(), same as everything else in this panel. */
  function ledgerRow(label: string, value: string): HTMLElement {
    return el(
      "div",
      { class: "fsa-inspector__ledger-row" },
      el("span", { class: "fsa-inspector__ledger-label", text: label }),
      el("span", { class: "fsa-inspector__ledger-value", text: value }),
    );
  }

  /** This island's own tally — computeIslandLedger scoped to this one treId. The point isn't the numbers so much as the shape of the claim: this card can only ever show one island's own record, never a shared or combined one — honesty rule 6, made clickable. */
  function renderIslandLedger(treId: TreId): void {
    clear(decision);
    if (!options.getState) return;
    const ledger = computeIslandLedger(options.getState(), treId);
    decision.append(
      el(
        "div",
        { class: "fsa-inspector__decision-card" },
        el("p", { class: "fsa-inspector__decision-lead", text: "This island's own ledger" }),
        el(
          "div",
          { class: "fsa-inspector__ledger-rows" },
          ledgerRow("Projects seen", String(ledger.projectsSeen)),
          ledgerRow("Safe project decided", `${ledger.gate1Approved} approved · ${ledger.gate1Refused} refused`),
          ledgerRow("Tasks in flight", String(ledger.tasksInFlight)),
          ledgerRow("Analyses run", String(ledger.analysesRun)),
          ledgerRow("Safe output decided", `${ledger.gate2Released} released · ${ledger.gate2Refused} refused`),
        ),
        el("p", {
          class: "fsa-inspector__ledger-note",
          text: "This island's own record — no other island's ledger is visible from here.",
        }),
      ),
    );
  }

  /** One targeted island's own status within a project's own card at the quay — a name/Gate 1 line, then a Gate 2 summary line, stacked rather than a three-column row so it stays legible at this panel's own width. */
  function projectIslandBlock(status: { treId: TreId; gate1Status: string; cratesHeld: number; cratesReleased: number; cratesRefused: number }): HTMLElement {
    const treName = options.treNames?.get(status.treId) ?? status.treId;
    const outputTotal = status.cratesHeld + status.cratesReleased + status.cratesRefused;
    const outputSummary =
      outputTotal === 0
        ? "no results yet"
        : `${status.cratesReleased} released · ${status.cratesRefused} refused · ${status.cratesHeld} pending`;
    return el(
      "div",
      { class: "fsa-inspector__project-island-block" },
      el("p", { class: "fsa-inspector__project-island-name", text: `${treName} — ${status.gate1Status}` }),
      el("p", { class: "fsa-inspector__project-island-gate2", text: outputSummary }),
    );
  }

  /**
   * The researcher's own view at the quay — the mirror image of
   * renderIslandLedger, and the one place in this panel allowed to read
   * across islands (honesty rule 6's own stated exception, the same one
   * releasedCratesForProject already exercises). See IDEAS.md "A
   * project-centric view at the quay". A small list of the most recently
   * submitted projects; clicking one expands its own per-island status
   * below, without needing a fresh click on the quay itself.
   */
  function renderProjectsAtQuay(): void {
    clear(decision);
    if (!options.getState) return;
    const state = options.getState();
    if (state.projects.length === 0) return;

    const recent = [...state.projects].sort((a, b) => b.submittedAtTick - a.submittedAtTick).slice(0, QUAY_PROJECT_LIST_LIMIT);
    if (!selectedProjectId || !recent.some((p) => p.id === selectedProjectId)) {
      selectedProjectId = recent[0]!.id;
    }
    const ledger = computeProjectLedger(state, selectedProjectId);
    if (!ledger) return;

    const listItems = recent.map((p) =>
      el("button", {
        class: `fsa-btn fsa-inspector__project-item${p.id === selectedProjectId ? " is-selected" : ""}`,
        type: "button",
        text: p.name,
        on: {
          click: () => {
            selectedProjectId = p.id;
            renderProjectsAtQuay();
          },
        },
      }),
    );

    decision.append(
      el(
        "div",
        { class: "fsa-inspector__decision-card" },
        el("p", { class: "fsa-inspector__decision-lead", text: "Projects at the quay" }),
        el("div", { class: "fsa-inspector__project-list" }, ...listItems),
        el("p", { class: "fsa-inspector__project-detail-lead", text: `${ledger.name} — submitted by ${ledger.researcher}` }),
        el("div", { class: "fsa-inspector__project-island-rows" }, ...ledger.perIsland.map(projectIslandBlock)),
        el("p", { class: "fsa-inspector__ledger-note", text: `Released and gathered here so far: ${ledger.releasedCount}.` }),
        state.projects.length > recent.length
          ? el("p", { class: "fsa-inspector__decision-queue", text: `+${state.projects.length - recent.length} earlier projects not shown` })
          : null,
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
    selectedProjectId = null;
    const treId = object.userData.treId as TreId | undefined;
    if (treId && kind === "GATE1_HARBOURMASTER") renderGate1Decision(treId);
    else if (treId && kind === "GATE2_INSPECTOR") renderGate2Decision(treId);
    else if (treId && kind === "ISLAND_LAND") renderIslandLedger(treId);
    else if (kind === "MAINLAND_DOCK") renderProjectsAtQuay();

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
