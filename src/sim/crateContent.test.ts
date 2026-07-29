import { describe, expect, it } from "vitest";
import { generateCrateContent } from "./crateContent.ts";

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
