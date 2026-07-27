import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createInitialSimState } from "../sim/sim.ts";
import { buildWorld } from "./world.ts";

function findAllByKind(root: THREE.Object3D, kind: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj.userData.kind === kind) found.push(obj);
  });
  return found;
}

describe("buildWorld", () => {
  it("builds sea, mainland, and customs exactly once regardless of TRE count", () => {
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
    expect(findAllByKind(world, "CUSTOMS_HALL")).toHaveLength(1);
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

  it("never mutates the SimState it reads", () => {
    const state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    const before = JSON.parse(JSON.stringify(state));
    buildWorld(state);
    expect(state).toEqual(before);
  });
});
