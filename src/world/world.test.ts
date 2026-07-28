import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createInitialSimState } from "../sim/sim.ts";
import { islandGeometry } from "./layout.ts";
import { buildWorld, computeIslandGeometries } from "./world.ts";

function findAllByKind(root: THREE.Object3D, kind: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj.userData.kind === kind) found.push(obj);
  });
  return found;
}

describe("buildWorld", () => {
  it("builds sea and mainland exactly once regardless of TRE count", () => {
    const state = createInitialSimState({
      seed: 1,
      tres: [
        { id: "tre-a", name: "Isle of Ailsa" },
        { id: "tre-b", name: "Isle of Kessel" },
        { id: "tre-c", name: "Isle of Muck" },
      ],
    });
    const world = buildWorld(state);
    expect(findAllByKind(world, "SEA")).toHaveLength(1);
    expect(findAllByKind(world, "MAINLAND_LAND")).toHaveLength(1);
  });

  it("gives every island its own customs hall and Gate 2 inspector — there is no shared, central one", () => {
    const state = createInitialSimState({
      seed: 1,
      tres: [
        { id: "tre-a", name: "Isle of Ailsa" },
        { id: "tre-b", name: "Isle of Kessel" },
        { id: "tre-c", name: "Isle of Muck" },
      ],
    });
    const world = buildWorld(state);
    expect(findAllByKind(world, "CUSTOMS_HALL").map((h) => h.userData.treId).sort()).toEqual([
      "tre-a",
      "tre-b",
      "tre-c",
    ]);
    expect(findAllByKind(world, "GATE2_INSPECTOR").map((h) => h.userData.treId).sort()).toEqual([
      "tre-a",
      "tre-b",
      "tre-c",
    ]);
  });

  it("builds exactly one island per TRE in the sim state, no more, no fewer", () => {
    const state = createInitialSimState({
      seed: 1,
      tres: [
        { id: "tre-a", name: "Isle of Ailsa" },
        { id: "tre-b", name: "Isle of Kessel" },
      ],
    });
    const world = buildWorld(state);
    const vaults = findAllByKind(world, "VAULT");
    expect(vaults.map((v) => v.userData.treId).sort()).toEqual(["tre-a", "tre-b"]);
  });

  it("gives every island a distinct position — no two islands share a footprint", () => {
    const state = createInitialSimState({
      seed: 1,
      tres: [
        { id: "tre-a", name: "A" },
        { id: "tre-b", name: "B" },
        { id: "tre-c", name: "C" },
      ],
    });
    const world = buildWorld(state);
    const lands = findAllByKind(world, "ISLAND_LAND");
    expect(lands).toHaveLength(3);
    const positions = lands.map((l) => `${l.position.x.toFixed(2)},${l.position.z.toFixed(2)}`);
    expect(new Set(positions).size).toBe(3);
  });

  it("gives every island its own ferry, egress, and workflow route lines", () => {
    const state = createInitialSimState({
      seed: 1,
      tres: [
        { id: "tre-a", name: "A" },
        { id: "tre-b", name: "B" },
      ],
    });
    const world = buildWorld(state);
    expect(findAllByKind(world, "FERRY_ROUTE").map((l) => l.userData.treId).sort()).toEqual(["tre-a", "tre-b"]);
    expect(findAllByKind(world, "EGRESS_ROUTE").map((l) => l.userData.treId).sort()).toEqual(["tre-a", "tre-b"]);
    expect(findAllByKind(world, "WORKFLOW_ROUTE").map((l) => l.userData.treId).sort()).toEqual(["tre-a", "tre-b"]);
  });

  it("makes every mesh receive shadows, and cast them too except the flat sea", () => {
    const state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    const world = buildWorld(state);
    let meshCount = 0;
    world.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        meshCount++;
        expect(obj.receiveShadow).toBe(true);
        expect(obj.castShadow).toBe(obj.userData.kind !== "SEA");
      }
    });
    expect(meshCount).toBeGreaterThan(0);
  });

  it("never mutates the SimState it reads", () => {
    const state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    const before = JSON.parse(JSON.stringify(state));
    buildWorld(state);
    expect(state).toEqual(before);
  });
});

describe("computeIslandGeometries", () => {
  it("maps every TRE id to the same geometry islandGeometry would compute directly", () => {
    const tres = [
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
      { id: "tre-c", name: "C" },
    ];
    const geometries = computeIslandGeometries(tres);
    expect(geometries.size).toBe(3);
    for (let i = 0; i < tres.length; i++) {
      const tre = tres[i]!;
      expect(geometries.get(tre.id)).toEqual(islandGeometry(tre.id, i, tres.length));
    }
  });

  it("is what buildWorld itself uses — island footprints in the scene match this map exactly", () => {
    const tres = [
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
    ];
    const state = createInitialSimState({ seed: 1, tres });
    const geometries = computeIslandGeometries(state.tres);
    const world = buildWorld(state);
    const lands = findAllByKind(world, "ISLAND_LAND");
    for (const land of lands) {
      const geometry = geometries.get(land.userData.treId as string)!;
      expect(land.position.x).toBeCloseTo(geometry.center.x, 5);
      expect(land.position.z).toBeCloseTo(geometry.center.z, 5);
    }
  });
});
