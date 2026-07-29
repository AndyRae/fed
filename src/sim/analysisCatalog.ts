import type { AnalysisType } from "../core/types.ts";

/**
 * The catalog behind the interactive "create your own project" journey (see
 * `src/ui/projectForm.ts` and `buildYourProjectTour` in `src/ui/tours.ts`):
 * three illustrative study areas and the three analyses offered for them.
 * Pure data, no three.js, same as the rest of `src/sim` — this is the single
 * source of truth both the form and the tour builder read from, so the two
 * never drift out of sync with each other.
 */
export interface StudyArea {
  readonly id: string;
  readonly label: string;
  readonly variableA: string;
  readonly variableB: string;
}

export const STUDY_AREAS: readonly StudyArea[] = [
  { id: "cardiovascular", label: "Cardiovascular", variableA: "BMI", variableB: "systolic blood pressure" },
  { id: "diabetes", label: "Diabetes", variableA: "HbA1c", variableB: "medication adherence" },
  { id: "respiratory", label: "Respiratory", variableA: "inhaler use", variableB: "hospital admission" },
] as const;

export interface AnalysisTypeInfo {
  readonly id: AnalysisType;
  readonly label: string;
  /** One plain-register sentence for the form — no unexpanded acronyms, matching CLAUDE.md's dual-register rule even in a UI control. */
  readonly plain: string;
}

export const ANALYSIS_TYPES: readonly AnalysisTypeInfo[] = [
  {
    id: "PEARSON_CORRELATION",
    label: "Pearson's correlation",
    plain: "Tests whether two measurements rise and fall together.",
  },
  {
    id: "FISHERS_EXACT",
    label: "Fisher's exact test",
    plain: "Tests whether two categories are linked, in a smaller sample.",
  },
  {
    id: "CHI_SQUARED",
    label: "Chi-squared test",
    plain: "Tests whether two categories are linked, in a larger sample.",
  },
] as const;
