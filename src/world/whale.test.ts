import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { buildWhale } from "./whale.ts";

describe("buildWhale", () => {
  it("is tagged as decoration, not a pickable protocol entity", () => {
    const whale = buildWhale();
    expect(whale.userData.decoration).toBe("WHALE");
    expect(whale.userData.kind).toBeUndefined();
    whale.traverse((obj) => {
      expect(obj.userData.kind, "no descendant may be pickable either").toBeUndefined();
    });
  });

  it("is built from a body, a tail fluke, and a dorsal fin", () => {
    const whale = buildWhale();
    const meshes = whale.children.filter((c) => c instanceof THREE.Mesh);
    expect(meshes.length).toBe(3);
  });

  it("uses the reserved whale colour for every part", () => {
    const whale = buildWhale();
    whale.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const material = obj.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(theme.untrusted.whale);
    });
  });
});
