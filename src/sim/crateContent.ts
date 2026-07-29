import type { CrateContent } from "../core/types.ts";
import { createRng } from "./rng.ts";

/**
 * Illustrative examples of what a crate might hold, for the customs
 * inspector's inspector-panel decision — see CLAUDE.md's Gate 2 honesty
 * rules and SIMPLIFICATIONS.md. Every value here is synthetic and invented
 * for teaching; no real data exists anywhere in this application.
 *
 * The AGGREGATE pool is the shape output review is meant to see: values
 * that describe the cohort, not a person. The ROW_LEVEL pool is what a
 * badly-written analysis can still accidentally produce: one line per
 * identifiable individual. Gate 2 exists to catch exactly that difference
 * by eye, so both pools must look like real output-review material, not
 * an obviously-labelled quiz.
 */
const AGGREGATE_EXAMPLES: readonly CrateContent[] = [
  {
    kind: "AGGREGATE",
    summary: "Aggregate statistics only — every value describes the whole cohort, not one person.",
    rows: [
      "Cohort size (n): 1,248",
      "Mean age: 54.2 years",
      "Median length of stay: 4 days",
      "30-day readmission rate: 12.3%",
    ],
  },
  {
    kind: "AGGREGATE",
    summary: "Aggregate statistics only — every value describes the whole cohort, not one person.",
    rows: [
      "Total patients: 3,402",
      "Diabetes prevalence: 18.6%",
      "Mean HbA1c: 58 mmol/mol (SD 9.1)",
      "Patients meeting the small-cell threshold (<5): suppressed",
    ],
  },
  {
    kind: "AGGREGATE",
    summary: "Aggregate statistics only — every value describes the whole cohort, not one person.",
    rows: [
      "Records analysed: 926",
      "Mean systolic BP: 132 mmHg",
      "Count by decade: 20s=41, 30s=88, 40s=203, 50s=311, 60s+=283",
      "Correlation (BMI, BP): r = 0.34",
    ],
  },
  {
    kind: "AGGREGATE",
    summary: "Aggregate statistics only — every value describes the whole cohort, not one person.",
    rows: [
      "Total admissions: 5,014",
      "Mean waiting time: 38 minutes",
      "Discharge outcome counts: home=4,102, transfer=612, other=300",
      "95% CI on mean waiting time: [35.9, 40.1]",
    ],
  },
] as const;

const ROW_LEVEL_EXAMPLES: readonly CrateContent[] = [
  {
    kind: "ROW_LEVEL",
    summary: "Row-level records — each line identifies one individual person, not a cohort total.",
    rows: [
      "id=00147, dob=2013-05-02, postcode=SW1A 1AA, diagnosis=T2DM",
      "id=00148, dob=1987-11-19, postcode=EH8 9YL, diagnosis=T1DM",
      "id=00149, dob=1955-02-27, postcode=G3 6RB, diagnosis=T2DM",
      "… 1,245 further rows, one per patient",
    ],
  },
  {
    kind: "ROW_LEVEL",
    summary: "Row-level records — each line identifies one individual person, not a cohort total.",
    rows: [
      "patient_ref=A2201, name=\"Patient A2201\", age=63, admitted=2026-02-11",
      "patient_ref=A2202, name=\"Patient A2202\", age=41, admitted=2026-02-11",
      "patient_ref=A2203, name=\"Patient A2203\", age=77, admitted=2026-02-12",
      "… every admission listed individually",
    ],
  },
  {
    kind: "ROW_LEVEL",
    summary: "Row-level records — each line identifies one individual person, not a cohort total.",
    rows: [
      "subject=0091, postcode=NE1 4PL, bp_systolic=118, bmi=24.1",
      "subject=0092, postcode=CF10 3AT, bp_systolic=146, bmi=31.4",
      "subject=0093, postcode=BT1 5GS, bp_systolic=129, bmi=27.0",
      "… full unaggregated export, one row per subject",
    ],
  },
] as const;

function hashSeedKey(seedKey: string): number {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Deterministically picks one illustrative crate content example for the
 * given seed key (typically `${state.seed}:${crateId}`, mirroring the
 * `hashTreId` + `createRng` pattern in `src/world`). Same key, same result
 * — every run stays reproducible per CLAUDE.md's determinism requirement.
 */
export function generateCrateContent(seedKey: string): CrateContent {
  const rng = createRng(hashSeedKey(seedKey));
  const pool = rng() < 0.5 ? AGGREGATE_EXAMPLES : ROW_LEVEL_EXAMPLES;
  const index = Math.floor(rng() * pool.length);
  return pool[Math.min(index, pool.length - 1)]!;
}
