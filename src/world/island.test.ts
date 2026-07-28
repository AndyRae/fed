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

/** True if `obj` is `ancestor` itself or nested anywhere under it — used so a reserved colour's exclusivity check can allow a tagged marker's own decorative children (e.g. the vault's plinth) without allowing it anywhere else in the island. */
function isWithin(obj: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
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
      if (isWithin(obj, vault)) return;
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat?.color) expect(mat.color.getHex(), obj.userData.kind).not.toBe(theme.vault.reserved);
    });
  });

  it("places the harbourmaster's office (Gate 1) in the reserved amber colour, and nothing outside the two gate markers shares it", () => {
    const island = buildIsland(geometry, tre);
    const gate = findByKind(island, "GATE1_HARBOURMASTER") as THREE.Mesh;
    const inspector = findByKind(island, "GATE2_INSPECTOR") as THREE.Mesh;
    expect(gate.position.x).toBeCloseTo(geometry.harbourmasterOffice.x, 5);
    const material = gate.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.gate.amber);

    island.traverse((obj) => {
      if (isWithin(obj, gate) || isWithin(obj, inspector)) return;
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

  it("places this island's own customs hall at the real customs-hall position, in the customs colour — distinct from the amber gate marker beside it", () => {
    const island = buildIsland(geometry, tre);
    const hall = findByKind(island, "CUSTOMS_HALL") as THREE.Mesh;
    expect(hall.position.x).toBeCloseTo(geometry.customsHall.x, 5);
    expect(hall.position.z).toBeCloseTo(geometry.customsHall.z, 5);
    const material = hall.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.customs.hall);
    expect(material.color.getHex()).not.toBe(theme.gate.amber);
  });

  it("places this island's own Gate 2 inspector in the reserved amber colour, tagged with this island's id", () => {
    const island = buildIsland(geometry, tre);
    const inspector = findByKind(island, "GATE2_INSPECTOR") as THREE.Mesh;
    const material = inspector.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.gate.amber);
    expect(inspector.userData.treId).toBe("tre-a");
  });

  it("places the customs hall at a different point than the ferry's dock", () => {
    const island = buildIsland(geometry, tre);
    const hall = findByKind(island, "CUSTOMS_HALL")!;
    const dock = findByKind(island, "DOCK")!;
    const dx = hall.position.x - dock.position.x;
    const dz = hall.position.z - dock.position.z;
    expect(Math.hypot(dx, dz)).toBeGreaterThan(0.5);
  });

  it("gives the island a sandy beach ring at its centre, distinct from the grass", () => {
    const island = buildIsland(geometry, tre);
    const beach = findByKind(island, "ISLAND_BEACH") as THREE.Mesh;
    expect(beach.position.x).toBeCloseTo(geometry.center.x, 5);
    expect(beach.position.z).toBeCloseTo(geometry.center.z, 5);
    const material = beach.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.trust.islandBeach);
    expect(material.color.getHex()).not.toBe(theme.trust.island);
  });

  it("gives the island a foam ring blending its beach into the open sea, distinct from both", () => {
    const island = buildIsland(geometry, tre);
    const foam = findByKind(island, "ISLAND_FOAM") as THREE.Mesh;
    expect(foam.position.x).toBeCloseTo(geometry.center.x, 5);
    expect(foam.position.z).toBeCloseTo(geometry.center.z, 5);
    const material = foam.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.untrusted.foam);
    expect(material.color.getHex()).not.toBe(theme.trust.islandBeach);
    expect(material.color.getHex()).not.toBe(theme.untrusted.sea);
  });

  it("scatters textured grass and dirt patches across the land, as children of ISLAND_LAND", () => {
    const island = buildIsland(geometry, tre);
    const land = findByKind(island, "ISLAND_LAND") as THREE.Mesh;
    const patches = land.children.filter((c) => c instanceof THREE.Mesh) as THREE.Mesh[];
    expect(patches.length).toBeGreaterThan(0);

    const colors = new Set(patches.map((p) => (p.material as THREE.MeshStandardMaterial).color.getHex()));
    // At least one patch uses the dedicated dirt tone, and none reuse the
    // flat base green exactly — the whole point is tonal variety.
    expect(colors.has(theme.trust.islandBeach)).toBe(false);
    expect([...colors].some((c) => c === theme.trust.island)).toBe(false);
    const dirtPatches = patches.filter((p) => (p.material as THREE.MeshStandardMaterial).color.getHex() === theme.trust.islandDirt);
    expect(dirtPatches.length).toBeGreaterThan(0);
  });

  it("is deterministic: the same island id always scatters the same terrain patches", () => {
    const a = buildIsland(geometry, tre);
    const b = buildIsland(geometry, tre);
    const landA = findByKind(a, "ISLAND_LAND") as THREE.Mesh;
    const landB = findByKind(b, "ISLAND_LAND") as THREE.Mesh;
    expect(landA.children.length).toBe(landB.children.length);
    landA.children.forEach((childA, i) => {
      const childB = landB.children[i]!;
      expect(childA.position.x).toBeCloseTo(childB.position.x, 5);
      expect(childA.position.z).toBeCloseTo(childB.position.z, 5);
    });
  });

  it("gives the island a label anchor above its centre, with no geometry of its own to be picked", () => {
    const island = buildIsland(geometry, tre);
    const anchor = findByKind(island, "TRE_LABEL_ANCHOR")!;
    expect(anchor.position.x).toBeCloseTo(geometry.center.x, 5);
    expect(anchor.position.z).toBeCloseTo(geometry.center.z, 5);
    expect(anchor.position.y).toBeGreaterThan(0);
    expect(anchor).not.toBeInstanceOf(THREE.Mesh);
    expect(anchor.userData.treId).toBe("tre-a");
  });
});
