import { describe, expect, it } from "vitest";
import { ENTITY_KINDS, explanationForKind, explanations } from "./explanations.ts";

describe("explanations", () => {
  it("has a non-empty title, plain, and detail for every entity kind", () => {
    for (const kind of ENTITY_KINDS) {
      const entry = explanations[kind];
      expect(entry.title.trim().length, `${kind}.title`).toBeGreaterThan(0);
      expect(entry.plain.trim().length, `${kind}.plain`).toBeGreaterThan(0);
      expect(entry.detail.trim().length, `${kind}.detail`).toBeGreaterThan(0);
    }
  });

  it("never reuses the exact same title across two different kinds", () => {
    const titles = ENTITY_KINDS.map((kind) => explanations[kind].title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("grounds the vault's explanation in honesty rule 2", () => {
    expect(explanations.VAULT.detail.toLowerCase()).toContain("vault");
    expect(explanations.VAULT.detail.toLowerCase()).toMatch(/emits nothing|nothing.*leaves|never.*leave/);
  });

  it("grounds the wall's explanation in honesty rule 1 (inward crossing)", () => {
    expect(explanations.ISLAND_WALL.detail.toLowerCase()).toContain("boundary");
    expect(explanations.ISLAND_WALL.plain.toLowerCase()).toContain("cross");
  });

  it("names Gate 1 and Gate 2 correctly on the two human-decision entities", () => {
    expect(explanations.GATE1_HARBOURMASTER.detail).toMatch(/Gate 1/);
    expect(explanations.GATE2_INSPECTOR.detail).toMatch(/Gate 2/);
  });

  it("names the real GA4GH TES executor states on the workshop, verbatim", () => {
    expect(explanations.WORKSHOP.detail).toMatch(/QUEUED/);
    expect(explanations.WORKSHOP.detail).toMatch(/RUNNING/);
  });
});

describe("explanationForKind", () => {
  it("returns the matching entry for a known kind", () => {
    expect(explanationForKind("VAULT")).toBe(explanations.VAULT);
  });

  it("returns undefined for an unknown kind rather than throwing", () => {
    expect(explanationForKind("NOT_A_REAL_KIND")).toBeUndefined();
  });
});
