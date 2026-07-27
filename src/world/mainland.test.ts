import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { mainlandGeometry } from "./layout.ts";
import { buildMainland } from "./mainland.ts";

function findByKind(root: THREE.Object3D, kind: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((obj) => {
    if (!found && obj.userData.kind === kind) found = obj;
  });
  return found;
}

describe("buildMainland", () => {
  it("is coloured with the untrusted palette — it is public-facing, not a trust zone", () => {
    const land = findByKind(buildMainland(), "MAINLAND_LAND") as THREE.Mesh;
    const material = land.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.untrusted.mainland);
  });

  it("is positioned at the mainland's real geometry centre", () => {
    const land = findByKind(buildMainland(), "MAINLAND_LAND")!;
    expect(land.position.x).toBeCloseTo(mainlandGeometry.center.x, 5);
    expect(land.position.z).toBeCloseTo(mainlandGeometry.center.z, 5);
  });

  it("has a quay dock at the real quay dock position", () => {
    const dock = findByKind(buildMainland(), "MAINLAND_DOCK")!;
    expect(dock.position.x).toBeCloseTo(mainlandGeometry.quayDock.x, 5);
    expect(dock.position.z).toBeCloseTo(mainlandGeometry.quayDock.z, 5);
  });

  it("gives the mainland a label anchor above its centre, with no geometry of its own to be picked", () => {
    const anchor = findByKind(buildMainland(), "MAINLAND_LABEL_ANCHOR")!;
    expect(anchor.position.x).toBeCloseTo(mainlandGeometry.center.x, 5);
    expect(anchor.position.z).toBeCloseTo(mainlandGeometry.center.z, 5);
    expect(anchor.position.y).toBeGreaterThan(0);
    expect(anchor).not.toBeInstanceOf(THREE.Mesh);
  });
});
