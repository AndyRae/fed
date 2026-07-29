import type { AnalysisType } from "../core/types.ts";
import { ANALYSIS_TYPES, STUDY_AREAS } from "../sim/analysisCatalog.ts";
import { el, setText } from "./dom.ts";
import type { YourProjectInput } from "./tours.ts";

/**
 * The form behind the interactive "create your own project" journey: pick a
 * title, one of three study areas, and one of three analyses, then follow
 * that exact project on rails through submission, both gates, and a real
 * result — see `buildYourProjectTour` in `src/ui/tours.ts`. A one-shot modal
 * like `tourCard.ts`'s card, not a persistent toggle like `inspectorPanel.ts`
 * — it exists only until submitted or cancelled. Not unit tested — DOM-only,
 * browser-verified like the rest of `src/ui`'s chrome.
 */
export interface ProjectFormOptions {
  readonly onSubmit: (input: YourProjectInput) => void;
  readonly onCancel: () => void;
}

export interface ProjectFormHandle {
  dispose(): void;
}

interface RadioItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly plain: string;
}

export function mountProjectForm(root: HTMLElement, options: ProjectFormOptions): ProjectFormHandle {
  let selectedAreaId: string = STUDY_AREAS[0]!.id;
  let selectedAnalysisType: AnalysisType = ANALYSIS_TYPES[0]!.id;

  function radioGroup<T extends string>(name: string, items: readonly RadioItem<T>[], selected: T, onPick: (id: T) => void): HTMLElement {
    const group = el("div", { class: "fsa-project-form__options", role: "radiogroup", "aria-label": name });
    for (const item of items) {
      const inputId = `${name}-${item.id}`;
      const radio = el("input", {
        type: "radio",
        name,
        id: inputId,
        checked: item.id === selected,
        on: { change: () => onPick(item.id) },
      });
      group.append(
        el(
          "label",
          { class: "fsa-project-form__option", for: inputId },
          radio,
          el(
            "span",
            { class: "fsa-project-form__option-text" },
            el("span", { class: "fsa-project-form__option-label", text: item.label }),
            el("span", { class: "fsa-project-form__option-plain", text: item.plain }),
          ),
        ),
      );
    }
    return group;
  }

  const titleInput = el("input", {
    type: "text",
    id: "fsa-project-form-title",
    class: "fsa-project-form__title-input",
    placeholder: "e.g. Diabetes Cohort Study",
    maxlength: "60",
  });
  const errorText = el("p", { class: "fsa-project-form__error", "aria-live": "polite" });

  const areaGroup = radioGroup(
    "fsa-project-form-area",
    STUDY_AREAS.map((a) => ({ id: a.id, label: a.label, plain: `${a.variableA} and ${a.variableB}` })),
    selectedAreaId,
    (id) => {
      selectedAreaId = id;
    },
  );

  const analysisGroup = radioGroup(
    "fsa-project-form-analysis",
    ANALYSIS_TYPES.map((a) => ({ id: a.id, label: a.label, plain: a.plain })),
    selectedAnalysisType,
    (id) => {
      selectedAnalysisType = id;
    },
  );

  const submitBtn = el("button", { class: "fsa-btn fsa-btn--approve", type: "submit", text: "Submit project" });
  const cancelBtn = el("button", { class: "fsa-btn", type: "button", text: "Cancel", on: { click: () => close() } });

  const form = el(
    "form",
    {
      class: "fsa-project-form__body",
      on: {
        submit: (event: Event) => {
          event.preventDefault();
          const title = titleInput.value.trim();
          if (title.length === 0) {
            setText(errorText, "Give your project a title first.");
            titleInput.focus();
            return;
          }
          const input: YourProjectInput = { title, areaId: selectedAreaId, analysisType: selectedAnalysisType };
          dispose();
          options.onSubmit(input);
        },
      },
    },
    el("label", { class: "fsa-project-form__field-label", for: "fsa-project-form-title", text: "Project title" }),
    titleInput,
    errorText,
    el("p", { class: "fsa-project-form__field-label", text: "Area" }),
    areaGroup,
    el("p", { class: "fsa-project-form__field-label", text: "Analysis" }),
    analysisGroup,
    el("div", { class: "fsa-project-form__actions" }, cancelBtn, submitBtn),
  );

  const closeBtn = el("button", {
    class: "fsa-btn fsa-project-form__close",
    type: "button",
    text: "✕",
    "aria-label": "Close",
    on: { click: () => close() },
  });

  const panel = el(
    "div",
    { class: "fsa-project-form", role: "dialog", "aria-modal": "true", "aria-label": "Create your own project" },
    closeBtn,
    el("h2", { class: "fsa-project-form__heading", text: "Create your own project" }),
    el("p", {
      class: "fsa-project-form__intro",
      text: "Submit a project as a researcher would, then follow it on rails through both gates to a real result.",
    }),
    form,
  );

  const backdrop = el(
    "div",
    {
      id: "fsa-project-form-layer",
      class: "fsa-project-form-overlay",
      on: {
        click: (event: Event) => {
          if (event.target === backdrop) close();
        },
      },
    },
    panel,
  );
  root.append(backdrop);
  titleInput.focus();

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") close();
  }
  window.addEventListener("keydown", onKeydown);

  function close(): void {
    dispose();
    options.onCancel();
  }

  function dispose(): void {
    window.removeEventListener("keydown", onKeydown);
    backdrop.remove();
  }

  return { dispose };
}
