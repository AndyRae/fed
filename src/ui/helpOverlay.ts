import { el } from "./dom.ts";

/**
 * The "?" help panel: what this world is, plus the controls that actually
 * exist — no walk mode, no fly camera, no WASD, none of that is
 * implemented here, so none of it is listed here either. Not unit tested —
 * DOM-only, browser-verified like inspectorPanel.ts and tourCard.ts.
 */
export interface HelpOverlayHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

const ABOUT =
  "Five Safes Archipelago models how the Five Safes TES weave performs federated analysis across Trusted Research Environments (TREs). Timings are compressed so you can watch the choreography happen — it's a model, not an emulator: no real TES tasks execute here, and no real data exists anywhere in this application.";

interface ControlRow {
  readonly keys: readonly string[];
  readonly description: string;
}

interface ControlSection {
  readonly title: string;
  readonly rows: readonly ControlRow[];
}

const SECTIONS: readonly ControlSection[] = [
  {
    title: "Camera",
    rows: [
      { keys: ["LMB drag"], description: "Pan — grab the ground and move it" },
      { keys: ["RMB drag"], description: "Orbit around the world" },
      { keys: ["MMB drag", "Ctrl + LMB drag"], description: "Zoom / orbit — for model-viewer habits" },
      { keys: ["Wheel"], description: "Zoom toward the cursor" },
      { keys: ["1 finger"], description: "Orbit around the world" },
      { keys: ["2 fingers"], description: "Pinch to zoom · drag to pan" },
    ],
  },
  {
    title: "Interaction",
    rows: [
      { keys: ["Click"], description: "Select an entity — open the inspector and see what it represents" },
      { keys: ["⚖"], description: "Take manual control of both gates — then click the harbourmaster or the customs inspector to decide a pending case yourself" },
      { keys: ["📝"], description: "Create your own project — pick a title, an area, and an analysis, then follow it on rails to a real result" },
    ],
  },
  {
    title: "Tours",
    rows: [
      { keys: ["→", "Space"], description: "Next stop" },
      { keys: ["←"], description: "Previous stop" },
      { keys: ["Esc"], description: "Exit the tour" },
    ],
  },
  {
    title: "General",
    rows: [
      { keys: ["Esc"], description: "Close the inspector, a tour, or this panel" },
      { keys: ["?"], description: "Toggle this panel" },
      { keys: ["🌐"], description: "Toggle the gently orbiting overview camera — on by default; dragging the camera yourself turns it off" },
      { keys: ["🌙"], description: "Toggle night mode — purely visual, changes nothing about the simulation" },
    ],
  },
];

function keyChip(key: string): HTMLElement {
  return el("kbd", { class: "fsa-help__key", text: key });
}

function controlRow(row: ControlRow): HTMLElement {
  const keys: (Node | string)[] = [];
  row.keys.forEach((key, index) => {
    if (index > 0) keys.push(el("span", { class: "fsa-help__key-or", text: "or" }));
    keys.push(keyChip(key));
  });
  return el(
    "div",
    { class: "fsa-help__row" },
    el("div", { class: "fsa-help__keys" }, ...keys),
    el("div", { class: "fsa-help__desc", text: row.description }),
  );
}

function controlSection(section: ControlSection): HTMLElement {
  return el(
    "div",
    { class: "fsa-help__section" },
    el("h3", { class: "fsa-help__section-title", text: section.title }),
    ...section.rows.map(controlRow),
  );
}

export function mountHelpOverlay(root: HTMLElement, sourceUrl: string): HelpOverlayHandle {
  const closeBtn = el("button", {
    class: "fsa-btn fsa-help__close",
    type: "button",
    text: "✕",
    "aria-label": "Close",
    on: { click: () => close() },
  });

  const panel = el(
    "div",
    { class: "fsa-help", role: "dialog", "aria-modal": "true", "aria-label": "Help" },
    closeBtn,
    el("h2", { class: "fsa-help__title", text: "Five Safes Archipelago" }),
    el("p", { class: "fsa-help__about", text: ABOUT }),
    ...SECTIONS.map(controlSection),
    el(
      "div",
      { class: "fsa-help__footer" },
      el("a", {
        class: "fsa-btn",
        href: sourceUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        text: "Source ↗",
      }),
    ),
  );

  const backdrop = el("div", {
    id: "fsa-help-overlay",
    class: "fsa-help-overlay",
    on: {
      click: (event: Event) => {
        if (event.target === backdrop) close();
      },
    },
  }, panel);
  root.append(backdrop);

  function setOpen(open: boolean): void {
    backdrop.classList.toggle("is-open", open);
  }
  setOpen(false);

  function open(): void {
    setOpen(true);
  }
  function close(): void {
    setOpen(false);
  }
  function toggle(): void {
    setOpen(!backdrop.classList.contains("is-open"));
  }
  function isOpen(): boolean {
    return backdrop.classList.contains("is-open");
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && isOpen()) close();
  }
  window.addEventListener("keydown", onKeydown);

  return {
    open,
    close,
    toggle,
    isOpen,
    dispose() {
      window.removeEventListener("keydown", onKeydown);
      backdrop.remove();
    },
  };
}
