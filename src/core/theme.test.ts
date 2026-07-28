import { describe, expect, it } from "vitest";
import { theme } from "./theme.ts";

/** Every semantically distinct role's colour, flattened, paired with a label for failure messages. */
function semanticColorEntries(): [string, number][] {
  return [
    ["trust.island", theme.trust.island],
    ["trust.wall", theme.trust.wall],
    ["trust.ferry", theme.trust.ferry],
    ["trust.workshop", theme.trust.workshop],
    ["trust.workflow", theme.trust.workflow],
    ["trust.islandDirt", theme.trust.islandDirt],
    ["trust.islandBeach", theme.trust.islandBeach],
    ["untrusted.sea", theme.untrusted.sea],
    ["untrusted.mainland", theme.untrusted.mainland],
    ["untrusted.mainlandAccent", theme.untrusted.mainlandAccent],
    ["gate.amber", theme.gate.amber],
    ["vault.reserved", theme.vault.reserved],
    ["crate.body", theme.crate.body],
    ["customs.hall", theme.customs.hall],
  ];
}

describe("theme", () => {
  it("never reuses a colour across two different semantic roles", () => {
    const entries = semanticColorEntries();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [labelA, colorA] = entries[i]!;
        const [labelB, colorB] = entries[j]!;
        expect(colorA, `${labelA} and ${labelB} must not share a colour`).not.toBe(colorB);
      }
    }
  });

  it("reserves the gate amber colour for the two human gates only — it is not used by any other role", () => {
    const nonGateRoles = semanticColorEntries().filter(([label]) => label !== "gate.amber");
    for (const [label, color] of nonGateRoles) {
      expect(color, `${label} must not use the reserved gate amber colour`).not.toBe(theme.gate.amber);
    }
  });

  it("keeps the vault colour distinct from the crate colour — honesty rule 2", () => {
    expect(theme.vault.reserved).not.toBe(theme.crate.body);
  });

  it("keeps the trust palette distinct from the untrusted palette", () => {
    expect(theme.trust.island).not.toBe(theme.untrusted.sea);
    expect(theme.trust.island).not.toBe(theme.untrusted.mainland);
  });

  it("every colour is a valid 24-bit hex value", () => {
    for (const [label, color] of semanticColorEntries()) {
      expect(color, label).toBeGreaterThanOrEqual(0);
      expect(color, label).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(color), label).toBe(true);
    }
  });
});
