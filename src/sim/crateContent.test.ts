import { describe, expect, it } from "vitest";
import type { TaskAnalysis } from "../core/types.ts";
import { generateAnalysisCrateContent, generateCrateContent } from "./crateContent.ts";

describe("generateCrateContent", () => {
  it("is deterministic: the same seed key always produces the same content", () => {
    const a = generateCrateContent("7:crate-t1");
    const b = generateCrateContent("7:crate-t1");
    expect(a).toEqual(b);
  });

  it("produces different content for different seed keys (varies across crates)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seen.add(JSON.stringify(generateCrateContent(`1:crate-t${i}`)));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("produces both AGGREGATE and ROW_LEVEL kinds across a range of keys", () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      kinds.add(generateCrateContent(`42:crate-t${i}`).kind);
    }
    expect(kinds).toEqual(new Set(["AGGREGATE", "ROW_LEVEL"]));
  });

  it("every AGGREGATE example describes the cohort, never a single row-per-person listing", () => {
    for (let i = 0; i < 60; i++) {
      const content = generateCrateContent(`99:crate-t${i}`);
      if (content.kind !== "AGGREGATE") continue;
      expect(content.rows.length).toBeGreaterThan(0);
      for (const row of content.rows) {
        expect(row).not.toMatch(/^id=|^patient_ref=|^subject=/);
      }
    }
  });

  it("every ROW_LEVEL example reads as one line per identifiable individual", () => {
    for (let i = 0; i < 60; i++) {
      const content = generateCrateContent(`13:crate-t${i}`);
      if (content.kind !== "ROW_LEVEL") continue;
      expect(content.rows.some((row) => /^id=|^patient_ref=|^subject=/.test(row))).toBe(true);
    }
  });
});

describe("generateAnalysisCrateContent", () => {
  const pearson: TaskAnalysis = { type: "PEARSON_CORRELATION", variableA: "BMI", variableB: "systolic blood pressure" };
  const fishers: TaskAnalysis = { type: "FISHERS_EXACT", variableA: "inhaler use", variableB: "hospital admission" };
  const chiSquared: TaskAnalysis = { type: "CHI_SQUARED", variableA: "HbA1c", variableB: "medication adherence" };

  it("is deterministic: the same seed key and analysis always produce the same content", () => {
    const a = generateAnalysisCrateContent("7:task-1", pearson);
    const b = generateAnalysisCrateContent("7:task-1", pearson);
    expect(a).toEqual(b);
  });

  it("is always AGGREGATE, never ROW_LEVEL — a correlation, an exact test, and a chi-squared test are all cohort-level statistics", () => {
    for (const analysis of [pearson, fishers, chiSquared]) {
      for (let i = 0; i < 10; i++) {
        expect(generateAnalysisCrateContent(`${i}:task-x`, analysis).kind).toBe("AGGREGATE");
      }
    }
  });

  it("names the analysis's own two variables in the summary", () => {
    const content = generateAnalysisCrateContent("1:task-1", pearson);
    expect(content.summary).toContain("BMI");
    expect(content.summary).toContain("systolic blood pressure");
  });

  it("shapes rows differently per analysis type", () => {
    const pearsonRows = generateAnalysisCrateContent("1:task-1", pearson).rows.join(" ");
    const fishersRows = generateAnalysisCrateContent("1:task-1", fishers).rows.join(" ");
    const chiSquaredRows = generateAnalysisCrateContent("1:task-1", chiSquared).rows.join(" ");
    expect(pearsonRows).toMatch(/Pearson's r/);
    expect(fishersRows).toMatch(/Fisher's exact|contingency table/);
    expect(chiSquaredRows).toMatch(/χ² statistic/);
  });

  it("suppresses any Fisher's exact contingency cell below 5, rather than printing it", () => {
    for (let i = 0; i < 40; i++) {
      const content = generateAnalysisCrateContent(`${i}:task-x`, fishers);
      for (const row of content.rows) {
        const match = row.match(/outcome (present|absent): (.+)$/);
        if (!match) continue;
        const value = match[2]!;
        if (/^\d+$/.test(value)) {
          expect(Number(value)).toBeGreaterThanOrEqual(5);
        } else {
          expect(value).toBe("suppressed (<5)");
        }
      }
    }
  });

  it("produces different numbers for different seed keys", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seen.add(JSON.stringify(generateAnalysisCrateContent(`${i}:task-x`, pearson)));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
