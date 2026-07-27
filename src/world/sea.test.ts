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
});
