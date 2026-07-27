import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { findPickableAncestor } from "./picking.ts";

describe("findPickableAncestor", () => {
  it("returns the object itself when it carries a kind tag", () => {
    const mesh = new THREE.Object3D();
    mesh.userData.kind = "VAULT";
    expect(findPickableAncestor(mesh)).toBe(mesh);
  });

  it("walks up to the nearest tagged ancestor", () => {
    const group = new THREE.Object3D();
    group.userData.kind = "TRE";
    const child = new THREE.Object3D();
    group.add(child);
    expect(findPickableAncestor(child)).toBe(group);
  });

  it("returns null when nothing in the chain is tagged", () => {
    const root = new THREE.Object3D();
    const child = new THREE.Object3D();
    root.add(child);
    expect(findPickableAncestor(child)).toBeNull();
  });

  it("returns null for a null input", () => {
    expect(findPickableAncestor(null)).toBeNull();
  });

  it("prefers the closest tagged ancestor over a further one", () => {
    const outer = new THREE.Object3D();
    outer.userData.kind = "TRE";
    const inner = new THREE.Object3D();
    inner.userData.kind = "VAULT";
    outer.add(inner);
    const leaf = new THREE.Object3D();
    inner.add(leaf);
    expect(findPickableAncestor(leaf)).toBe(inner);
  });
});
