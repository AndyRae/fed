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

function findAllByKind(root: THREE.Object3D, kind: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj.userData.kind === kind) found.push(obj);
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

  it("places exactly one researcher quarter landmark, at the real researcher quarter position", () => {
    const landmarks = findAllByKind(buildMainland(), "RESEARCHER_QUARTER");
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]!.position.x).toBeCloseTo(mainlandGeometry.researcherQuarter.x, 5);
    expect(landmarks[0]!.position.z).toBeCloseTo(mainlandGeometry.researcherQuarter.z, 5);
  });

  it("makes the researcher quarter landmark the tallest building in its own cluster", () => {
    const mainland = buildMainland();
    const landmark = findByKind(mainland, "RESEARCHER_QUARTER") as THREE.Mesh;
    const others = findAllByKind(mainland, "MAINLAND_BUILDING") as THREE.Mesh[];
    expect(others.length).toBeGreaterThan(0);
    const landmarkHeight = (landmark.geometry as THREE.BoxGeometry).parameters.height;
    for (const building of others) {
      const height = (building.geometry as THREE.BoxGeometry).parameters.height;
      expect(height).toBeLessThan(landmarkHeight);
    }
  });

  it("gives the researcher quarter's buildings more than one wall colour, so it reads as a mixed skyline", () => {
    const mainland = buildMainland();
    const buildings = [
      findByKind(mainland, "RESEARCHER_QUARTER") as THREE.Mesh,
      ...(findAllByKind(mainland, "MAINLAND_BUILDING") as THREE.Mesh[]),
    ];
    const colors = new Set(buildings.map((b) => (b.material as THREE.MeshStandardMaterial).color.getHex()));
    expect(colors.size).toBeGreaterThan(1);
  });

  it("never gives any mainland building the trust-zone green — the mainland must stay visually distinct from the islands", () => {
    const mainland = buildMainland();
    const trustGreens = new Set<number>([theme.trust.island, theme.trust.wall, theme.trust.ferry, theme.trust.workshop]);
    mainland.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat?.color) expect(trustGreens.has(mat.color.getHex()), obj.userData.kind).toBe(false);
    });
  });

  it("places the plaza at the real researcher quarter position in world space, not offset by the land mesh's own position", () => {
    const mainland = buildMainland();
    mainland.updateMatrixWorld(true);
    let plaza: THREE.Mesh | undefined;
    mainland.traverse((obj) => {
      // Distinguish from the dock's own (much smaller) bollards, which are also cylinders.
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry && obj.geometry.parameters.radiusTop > 5) {
        plaza = obj;
      }
    });
    expect(plaza).toBeDefined();
    const worldPos = new THREE.Vector3();
    plaza!.getWorldPosition(worldPos);
    expect(worldPos.x).toBeCloseTo(mainlandGeometry.researcherQuarter.x, 5);
    expect(worldPos.z).toBeCloseTo(mainlandGeometry.researcherQuarter.z, 5);
  });

  it("sits the plaza above the land's own true flat surface, not embedded in its extrude bevel", () => {
    const mainland = buildMainland();
    const land = findByKind(mainland, "MAINLAND_LAND") as THREE.Mesh;
    land.geometry.computeBoundingBox();
    const trueSurfaceY = land.position.y + land.geometry.boundingBox!.max.y;

    let plaza: THREE.Mesh | undefined;
    mainland.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry && obj.geometry.parameters.radiusTop > 5) {
        plaza = obj;
      }
    });
    mainland.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    plaza!.getWorldPosition(worldPos);
    expect(worldPos.y).toBeGreaterThan(trueSurfaceY);
  });

  it("is deterministic: building the mainland twice scatters the same researcher quarter", () => {
    const a = findAllByKind(buildMainland(), "MAINLAND_BUILDING");
    const b = findAllByKind(buildMainland(), "MAINLAND_BUILDING");
    expect(a.length).toBe(b.length);
    a.forEach((buildingA, i) => {
      expect(buildingA.position.x).toBeCloseTo(b[i]!.position.x, 5);
      expect(buildingA.position.z).toBeCloseTo(b[i]!.position.z, 5);
    });
  });
});
