import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { applySeaWaves, buildSea, seaWaveHeight } from "./sea.ts";

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

  it("bakes an undulating surface rather than a perfectly flat plane", () => {
    const sea = buildSea() as THREE.Mesh;
    const position = sea.geometry.getAttribute("position");
    let anyDisplaced = false;
    for (let i = 0; i < position.count; i++) {
      if (position.getZ(i) !== 0) anyDisplaced = true;
    }
    expect(anyDisplaced).toBe(true);
  });
});

describe("seaWaveHeight", () => {
  it("is deterministic for the same position and time", () => {
    expect(seaWaveHeight(12, -7, 3.4)).toBe(seaWaveHeight(12, -7, 3.4));
  });

  it("stays a small, subordinate amplitude — decorative motion must not dominate the scene", () => {
    for (let i = 0; i < 40; i++) {
      const height = seaWaveHeight(i * 5.3, -i * 3.1, i * 0.7);
      expect(Math.abs(height)).toBeLessThan(0.6);
    }
  });

  it("changes over time at a fixed point — the sea is not frozen", () => {
    expect(seaWaveHeight(20, 20, 0)).not.toBe(seaWaveHeight(20, 20, 5));
  });
});

describe("applySeaWaves", () => {
  it("displaces vertices and recomputes normals in place", () => {
    const geometry = new THREE.PlaneGeometry(20, 20, 6, 6);
    applySeaWaves(geometry, 1.5);
    const position = geometry.getAttribute("position");
    let anyDisplaced = false;
    for (let i = 0; i < position.count; i++) {
      if (position.getZ(i) !== 0) anyDisplaced = true;
    }
    expect(anyDisplaced).toBe(true);
    expect(geometry.getAttribute("normal")).toBeDefined();
  });

  it("re-applying at a later time moves the surface again", () => {
    const geometry = new THREE.PlaneGeometry(20, 20, 6, 6);
    applySeaWaves(geometry, 0);
    const first = geometry.getAttribute("position").getZ(0);
    applySeaWaves(geometry, 4);
    const second = geometry.getAttribute("position").getZ(0);
    expect(second).not.toBe(first);
  });
});
