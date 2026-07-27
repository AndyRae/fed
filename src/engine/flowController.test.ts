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

  it("spawns a crate at the workshop on CRATE_SEALED, routes it through this island's own customs hall to the quay, then removes it", () => {
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

describe("scrubbing through precomputed states (tour stepping)", () => {
  it("never re-fires an already-seen event when the state source moves backward then forward again", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);

    let before = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }], pollIntervalTicks: 1 });
    before = submitProject(before, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    before = submitTask(before, { id: "t1", projectId: "p1", treId: "tre-a" });
    before = decideProjectApproval(before, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    const after = tick(before, 1); // TASK_COLLECTED fires; strictly more events than `before`

    let current = after;
    const controller = createFlowController(host, islands, () => current);
    const ferry = (() => {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "FERRY") found = o;
      });
      return found!;
    })();
    const dock = islands.get("tre-a")!.dock;

    // Let the one real departure finish and return home.
    for (let i = 0; i < 40; i++) frame(0.1);
    expect(ferry.position.x).toBeCloseTo(dock.x, 5);
    expect(ferry.position.z).toBeCloseTo(dock.z, 5);

    // Step back to a state with fewer events (as a tour's "prev" would)...
    current = before;
    frame(0.1);
    // ...then forward again to the same later state — must not restart the trip.
    current = after;
    for (let i = 0; i < 5; i++) frame(0.1);
    expect(ferry.position.x).toBeCloseTo(dock.x, 5);
    expect(ferry.position.z).toBeCloseTo(dock.z, 5);

    controller.dispose();
  });
});

describe("startFromCurrentEvents", () => {
  it("skips animating events that already happened before construction, but still animates new ones after", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
    ]);

    let state = createInitialSimState({
      seed: 1,
      tres: [
        { id: "tre-a", name: "A" },
        { id: "tre-b", name: "B" },
      ],
      pollIntervalTicks: 1,
    });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a", "tre-b"] });
    state = submitTask(state, { id: "ta", projectId: "p1", treId: "tre-a" });
    state = submitTask(state, { id: "tb", projectId: "p1", treId: "tre-b" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    // tre-a already collected before the flow controller exists.
    state = tick(state, 1);

    let current = state;
    createFlowController(host, islands, () => current, { startFromCurrentEvents: true });

    const ferryA = (() => {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "FERRY" && o.userData.treId === "tre-a") found = o;
      });
      return found!;
    })();
    const ferryB = (() => {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "FERRY" && o.userData.treId === "tre-b") found = o;
      });
      return found!;
    })();
    const dockA = islands.get("tre-a")!.dock;
    const dockB = islands.get("tre-b")!.dock;

    // tre-a's pre-existing collection must not be replayed.
    for (let i = 0; i < 10; i++) frame(0.1);
    expect(ferryA.position.x).toBeCloseTo(dockA.x, 5);
    expect(ferryA.position.z).toBeCloseTo(dockA.z, 5);

    // A genuinely new event (tre-b's approval + collection) after construction still animates.
    current = decideProjectApproval(current, { projectId: "p1", treId: "tre-b", decision: "APPROVED", decidedBy: "H2" });
    current = tick(current, 1);
    frame(0.1);
    expect(Math.hypot(ferryB.position.x - dockB.x, ferryB.position.z - dockB.z)).toBeGreaterThan(0);
  });
});

describe("an island's ferry departing again before its previous trip finished", () => {
  it("follows only the newest departure — an older, further-along tween must not keep overwriting the newer one's position", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);

    let state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }], pollIntervalTicks: 1 });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });
    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    state = tick(state, 1); // t1 collected
    // t2 is submitted only now, after t1's poll — otherwise the same poll
    // would collect both at once and there would be nothing left to test.
    state = submitTask(state, { id: "t2", projectId: "p1", treId: "tre-a" });

    let current = state;
    createFlowController(host, islands, () => current);
    const ferry = (() => {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "FERRY") found = o;
      });
      return found!;
    })();
    const dock = islands.get("tre-a")!.dock;

    // First tween well under way (elapsed 0.5s of a 3s trip — noticeably off the dock).
    frame(0.5);

    // A second departure fires on the same island while the first is still
    // mid-flight, and this same frame both processes the new event and
    // advances by a tiny 0.01s.
    current = tick(current, 1); // t2 collected
    frame(0.01);

    // If the fix is working, only the brand-new tween (elapsed 0.01s of 3s)
    // is driving the mesh, so it has barely left the dock. If the old,
    // further-along tween (elapsed 0.51s) were still also writing this
    // mesh's position every frame, it would be several units further out
    // — this is the concrete, measurable difference the fix produces.
    const displacementFromDock = Math.hypot(ferry.position.x - dock.x, ferry.position.z - dock.z);
    expect(displacementFromDock).toBeLessThan(1);
  });
});
