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

  it("is a flat plane — every vertex sits at the same height", () => {
    const sea = buildSea() as THREE.Mesh;
    const position = sea.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      expect(position.getZ(i)).toBe(0);
    }
  });

  it("is a soft matte surface, not a reflective one", () => {
    const sea = buildSea() as THREE.Mesh;
    const material = sea.material as THREE.MeshStandardMaterial;
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThan(0.5);
  });
});
