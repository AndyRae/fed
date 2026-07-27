import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { customsGeometry } from "./layout.ts";
import { buildCustoms } from "./customs.ts";

function findByKind(root: THREE.Object3D, kind: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((obj) => {
    if (!found && obj.userData.kind === kind) found = obj;
  });
  return found;
}

describe("buildCustoms", () => {
  it("is positioned at the real customs geometry centre, outside every island", () => {
    const hall = findByKind(buildCustoms(), "CUSTOMS_HALL")!;
    expect(hall.position.x).toBeCloseTo(customsGeometry.center.x, 5);
    expect(hall.position.z).toBeCloseTo(customsGeometry.center.z, 5);
  });

  it("colours the hall itself distinctly from the amber gate marker inside it", () => {
    const customs = buildCustoms();
    const hall = findByKind(customs, "CUSTOMS_HALL") as THREE.Mesh;
    const hallMaterial = hall.material as THREE.MeshStandardMaterial;
    expect(hallMaterial.color.getHex()).toBe(theme.customs.hall);
    expect(hallMaterial.color.getHex()).not.toBe(theme.gate.amber);
  });

  it("places the Gate 2 output-review marker in the reserved amber colour", () => {
    const gate = findByKind(buildCustoms(), "GATE2_INSPECTOR") as THREE.Mesh;
    const material = gate.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.gate.amber);
  });
});
