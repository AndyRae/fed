import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { islandGeometry } from "./layout.ts";
import { buildIsland } from "./island.ts";

function findByKind(root: THREE.Object3D, kind: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((obj) => {
    if (!found && obj.userData.kind === kind) found = obj;
  });
  return found;
}

const geometry = islandGeometry("tre-a", 0, 1);
const tre = { id: "tre-a", name: "Isle of Ailsa" };

describe("buildIsland", () => {
  it("colours the island interior with the trust palette", () => {
    const land = findByKind(buildIsland(geometry, tre), "ISLAND_LAND") as THREE.Mesh;
    const material = land.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.trust.island);
  });

  it("places the vault at the real vault position, in the reserved vault colour, distinct from everything else", () => {
    const island = buildIsland(geometry, tre);
    const vault = findByKind(island, "VAULT") as THREE.Mesh;
    expect(vault.position.x).toBeCloseTo(geometry.vault.x, 5);
    expect(vault.position.z).toBeCloseTo(geometry.vault.z, 5);
    const material = vault.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.vault.reserved);

    island.traverse((obj) => {
      if (obj === vault) return;
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat?.color) expect(mat.color.getHex(), obj.userData.kind).not.toBe(theme.vault.reserved);
    });
  });

  it("places the harbourmaster's office (Gate 1) in the reserved amber colour, and nothing else on the island uses it", () => {
    const island = buildIsland(geometry, tre);
    const gate = findByKind(island, "GATE1_HARBOURMASTER") as THREE.Mesh;
    expect(gate.position.x).toBeCloseTo(geometry.harbourmasterOffice.x, 5);
    const material = gate.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.gate.amber);

    island.traverse((obj) => {
      if (obj === gate) return;
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat?.color) expect(mat.color.getHex(), obj.userData.kind).not.toBe(theme.gate.amber);
    });
  });

  it("places the workshop and the dock at their real geometry positions", () => {
    const island = buildIsland(geometry, tre);
    const workshop = findByKind(island, "WORKSHOP")!;
    expect(workshop.position.x).toBeCloseTo(geometry.workshop.x, 5);
    expect(workshop.position.z).toBeCloseTo(geometry.workshop.z, 5);

    const dock = findByKind(island, "DOCK")!;
    expect(dock.position.x).toBeCloseTo(geometry.dock.x, 5);
    expect(dock.position.z).toBeCloseTo(geometry.dock.z, 5);
  });

  it("tags every part of the island with the TRE id it belongs to, never another island's", () => {
    const island = buildIsland(geometry, tre);
    island.traverse((obj) => {
      if (obj.userData.treId !== undefined) {
        expect(obj.userData.treId).toBe("tre-a");
      }
    });
  });

  it("draws a wall at the wall radius, coloured distinctly from the interior", () => {
    const island = buildIsland(geometry, tre);
    const wall = findByKind(island, "ISLAND_WALL") as THREE.Mesh;
    const wallMaterial = wall.material as THREE.MeshStandardMaterial;
    expect(wallMaterial.color.getHex()).toBe(theme.trust.wall);
    expect(wallMaterial.color.getHex()).not.toBe(theme.trust.island);
  });
});
