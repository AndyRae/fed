import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { buildSea } from "./sea.ts";

describe("buildSea", () => {
  it("is coloured with the untrusted palette", () => {
    const sea = buildSea() as THREE.Mesh;
    const material = sea.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.untrusted.sea);
  });

  it("sits at sea level", () => {
    const sea = buildSea();
    expect(sea.position.y).toBe(0);
  });

  it("is tagged for picking as the sea, not mistakable for a trust zone", () => {
    const sea = buildSea();
    expect(sea.userData.kind).toBe("SEA");
  });

  it("bakes a gentle, permanent swell rather than a perfectly flat plane", () => {
    const sea = buildSea() as THREE.Mesh;
    const position = sea.geometry.getAttribute("position");
    let anyDisplaced = false;
    let maxAbs = 0;
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i);
      if (z !== 0) anyDisplaced = true;
      maxAbs = Math.max(maxAbs, Math.abs(z));
    }
    expect(anyDisplaced).toBe(true);
    // Gentle and subordinate — see CLAUDE.md "Visual language": decorative
    // motion (and, by the same logic, decorative shape) must not dominate.
    // Bound is generous around the current amplitude's theoretical max
    // (SWELL_AMPLITUDE * 1.4 ≈ 2.1), not a tight pin to one exact value.
    expect(maxAbs).toBeLessThan(2.5);
  });

  it("recomputes normals so the swell actually catches light", () => {
    const sea = buildSea() as THREE.Mesh;
    expect(sea.geometry.getAttribute("normal")).toBeDefined();
  });

  it("is a soft matte surface, not a reflective one", () => {
    const sea = buildSea() as THREE.Mesh;
    const material = sea.material as THREE.MeshStandardMaterial;
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThan(0.5);
  });
});
