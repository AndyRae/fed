import { describe, expect, it } from "vitest";
import { hexToCssColor, themeCssVariables } from "./cssTheme.ts";

describe("hexToCssColor", () => {
  it("formats a numeric hex colour as a lowercase CSS hex string", () => {
    expect(hexToCssColor(0x2f6f5e)).toBe("#2f6f5e");
  });

  it("pads short values to six digits", () => {
    expect(hexToCssColor(0x0000ff)).toBe("#0000ff");
    expect(hexToCssColor(0x0)).toBe("#000000");
  });
});

describe("themeCssVariables", () => {
  it("produces one --fsa- custom property per theme colour, derived from the same theme.ts values", () => {
    const vars = themeCssVariables();
    expect(vars["--fsa-gate-amber"]).toBe("#d99a2b");
    expect(vars["--fsa-vault-reserved"]).toBe("#7a2048");
    expect(Object.keys(vars).length).toBeGreaterThan(5);
  });

  it("every value is a valid CSS hex colour", () => {
    const vars = themeCssVariables();
    for (const value of Object.values(vars)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
