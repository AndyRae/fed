import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { decideProjectApproval, createInitialSimState, submitProject, submitTask, tick } from "../sim/sim.ts";
import { getCrateForTask } from "../sim/selectors.ts";
import { computeIslandGeometries } from "../world/world.ts";
import { createFlowController, type FlowSceneHost } from "./flowController.ts";

function createFakeHost() {
  const scene = new THREE.Scene();
  let callback: ((dt: number) => void) | null = null;
  const host: FlowSceneHost = {
    scene,
    onBeforeRender(fn) {
      callback = fn;
      return () => {
        callback = null;
      };
    },
  };
  return {
    host,
    frame(dt: number) {
      callback?.(dt);
    },
    isSubscribed: () => callback !== null,
  };
}

function twoIslandWorldWithCollectedTask() {
  let state = createInitialSimState({
    seed: 1,
    tres: [
      { id: "tre-a", name: "Isle A" },
      { id: "tre-b", name: "Isle B" },
    ],
    pollIntervalTicks: 1,
  });
  state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
  state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
  state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
  state = tick(state, 1); // ferry collects: TASK_COLLECTED fires
  return state;
}

describe("createFlowController", () => {
  it("docks a ferry mesh at each island's real dock position on creation", () => {
    const { host } = createFakeHost();
    const islands = computeIslandGeometries([
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
    ]);
    let state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }, { id: "tre-b", name: "B" }] });
    createFlowController(host, islands, () => state);

    const ferries: THREE.Object3D[] = [];
    host.scene.traverse((o) => {
      if (o.userData.kind === "FERRY") ferries.push(o);
    });
    expect(ferries).toHaveLength(2);
    for (const ferry of ferries) {
      const geometry = islands.get(ferry.userData.treId as string)!;
      expect(ferry.position.x).toBeCloseTo(geometry.dock.x, 5);
      expect(ferry.position.z).toBeCloseTo(geometry.dock.z, 5);
    }
  });

  it("animates a ferry away from its dock and back when TASK_COLLECTED appears, over the whole trip never entering another island's wall", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
    ]);
    let state = twoIslandWorldWithCollectedTask();
    createFlowController(host, islands, () => state);

    const ferryA = (() => {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "FERRY" && o.userData.treId === "tre-a") found = o;
      });
      return found!;
    })();
    const dockA = islands.get("tre-a")!.dock;
    const otherIsland = islands.get("tre-b")!;

    // First frame after the event: the tween has barely started.
    frame(0.01);
    expect(Math.hypot(ferryA.position.x - dockA.x, ferryA.position.z - dockA.z)).toBeLessThan(2);

    // Sample across the whole trip: never inside tre-b's wall.
    for (let i = 0; i < 60; i++) {
      frame(0.1);
      const dx = ferryA.position.x - otherIsland.center.x;
      const dz = ferryA.position.z - otherIsland.center.z;
      expect(Math.hypot(dx, dz)).toBeGreaterThan(otherIsland.wallRadius);
    }

    // After the full trip duration, the ferry is back home.
    expect(ferryA.position.x).toBeCloseTo(dockA.x, 5);
    expect(ferryA.position.z).toBeCloseTo(dockA.z, 5);
  });

  it("spawns a crate at the workshop on CRATE_SEALED, moves it to customs, then removes it", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = twoIslandWorldWithCollectedTask();
    // advance to COMPLETE -> AWAITING_OUTPUT_REVIEW, sealing a crate
    state = tick(state, 4);
    const crate = getCrateForTask(state, "t1");
    expect(crate).toBeDefined();

    createFlowController(host, islands, () => state);

    function countCrates(): number {
      let n = 0;
      host.scene.traverse((o) => {
        if (o.userData.kind === "CRATE") n++;
      });
      return n;
    }

    frame(0.01);
    expect(countCrates()).toBe(1);

    for (let i = 0; i < 40; i++) frame(0.1);
    expect(countCrates()).toBe(0);
  });

  it("dispose removes ferries from the scene and stops updating on further frames", () => {
    const { host, frame, isSubscribed } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    const state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    const controller = createFlowController(host, islands, () => state);

    expect(isSubscribed()).toBe(true);
    controller.dispose();
    expect(isSubscribed()).toBe(false);

    let ferries = 0;
    host.scene.traverse((o) => {
      if (o.userData.kind === "FERRY") ferries++;
    });
    expect(ferries).toBe(0);

    frame(1); // no-op: unsubscribed
  });
});
