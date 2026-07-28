import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { decideOutputReview, decideProjectApproval, createInitialSimState, submitProject, submitTask, tick } from "../sim/sim.ts";
import { getCrateForTask } from "../sim/selectors.ts";
import { submissionPath } from "../world/layout.ts";
import { MAINLAND_GROUND_HEIGHT } from "../world/mainland.ts";
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

  it("casts shadows from every ferry mesh, so a moving ferry reads as a real object above the sea", () => {
    const { host } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    const state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    createFlowController(host, islands, () => state);

    let ferry: THREE.Object3D | undefined;
    host.scene.traverse((o) => {
      if (o.userData.kind === "FERRY") ferry = o;
    });
    expect(ferry).toBeInstanceOf(THREE.Mesh);
    expect((ferry as THREE.Mesh).castShadow).toBe(true);
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

  it("trails a fading wake behind a moving ferry, which clears again once it's back at rest", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
    ]);
    const state = twoIslandWorldWithCollectedTask();
    createFlowController(host, islands, () => state);

    function wakeDotsFor(treId: string): THREE.Mesh[] {
      const dots: THREE.Mesh[] = [];
      host.scene.traverse((o) => {
        if (o.userData.wakeTreId === treId) dots.push(o as THREE.Mesh);
      });
      return dots;
    }

    // Barely started: not even one sample interval has elapsed yet.
    frame(0.05);
    expect(wakeDotsFor("tre-a").every((d) => (d.material as THREE.MeshStandardMaterial).opacity === 0)).toBe(true);

    // Partway through the trip: at least one wake dot has become visible.
    for (let i = 0; i < 5; i++) frame(0.12);
    const visible = wakeDotsFor("tre-a").filter((d) => (d.material as THREE.MeshStandardMaterial).opacity > 0);
    expect(visible.length).toBeGreaterThan(0);

    // Long after the ferry is back home, the wake has fully faded again.
    for (let i = 0; i < 40; i++) frame(0.12);
    expect(wakeDotsFor("tre-a").every((d) => (d.material as THREE.MeshStandardMaterial).opacity === 0)).toBe(true);
  });

  it("spawns a crate at the workshop on CRATE_SEALED, holds it at this island's own customs hall until Gate 2 decides, then releases it to the quay", () => {
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

    // The hold leg (workshop -> this island's own customs hall) finishes
    // well before any decision — honesty rule 3: the crate must still be
    // there, visibly waiting on a human.
    for (let i = 0; i < 15; i++) frame(0.1);
    expect(countCrates()).toBe(1);

    state = decideOutputReview(state, { crateId: crate!.id, decision: "RELEASED" });
    for (let i = 0; i < 25; i++) frame(0.1);
    expect(countCrates()).toBe(0);
  });

  it("leaves a REFUSED crate parked at this island's own customs hall — retained, not deleted", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = twoIslandWorldWithCollectedTask();
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

    for (let i = 0; i < 15; i++) frame(0.1);
    expect(countCrates()).toBe(1);

    state = decideOutputReview(state, { crateId: crate!.id, decision: "REFUSED" });
    for (let i = 0; i < 40; i++) frame(0.1);
    expect(countCrates()).toBe(1);
  });

  it("carries the collected container from the dock to the workshop once the ferry that fetched it is back home", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([
      { id: "tre-a", name: "A" },
      { id: "tre-b", name: "B" },
    ]);
    const state = twoIslandWorldWithCollectedTask();
    createFlowController(host, islands, () => state);

    function findContainer(): THREE.Object3D | undefined {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "CONTAINER") found = o;
      });
      return found;
    }

    // While the ferry is still mid-trip, no container has appeared yet —
    // the container is what the ferry brought back, not something that
    // travels alongside it.
    frame(0.1);
    expect(findContainer()).toBeUndefined();

    // Let the ferry's whole round trip finish in one jump — a newly spawned
    // tween is never advanced within the same onBeforeRender call that
    // created it (see pushTween's doc comment), so the container appears
    // here still sitting at the dock, not partway to the workshop already.
    frame(2.5);
    const container = findContainer();
    expect(container).toBeDefined();
    const dock = islands.get("tre-a")!.dock;
    expect(Math.hypot(container!.position.x - dock.x, container!.position.z - dock.z)).toBeLessThan(2);

    // Let the container's own trip finish: it reaches the workshop and is removed.
    for (let i = 0; i < 15; i++) frame(0.1);
    expect(findContainer()).toBeUndefined();
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

  it("dispose also removes a REFUSED crate parked at the customs hall, not just active tweens", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = twoIslandWorldWithCollectedTask();
    state = tick(state, 4);
    const crate = getCrateForTask(state, "t1");
    expect(crate).toBeDefined();

    const controller = createFlowController(host, islands, () => state);
    for (let i = 0; i < 15; i++) frame(0.1);
    state = decideOutputReview(state, { crateId: crate!.id, decision: "REFUSED" });
    frame(0.1);

    controller.dispose();

    let crates = 0;
    host.scene.traverse((o) => {
      if (o.userData.kind === "CRATE") crates++;
    });
    expect(crates).toBe(0);
  });
});

describe("a submission's own trip from the researcher quarter to the quay", () => {
  it("spawns at the researcher quarter on TASK_SUBMITTED and arrives at the quay dock, entirely on the mainland", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });

    createFlowController(host, islands, () => state);

    function findSubmission(): THREE.Object3D | undefined {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "SUBMISSION") found = o;
      });
      return found;
    }

    expect(findSubmission()).toBeUndefined();
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });

    frame(0.01);
    const submission = findSubmission();
    expect(submission).toBeDefined();
    const origin = submissionPath()[0]!;
    expect(Math.hypot(submission!.position.x - origin.x, submission!.position.z - origin.z)).toBeLessThan(1);

    for (let i = 0; i < 20; i++) frame(0.1);
    // The trip finished and the mesh was removed — never orphaned sitting at the quay.
    expect(findSubmission()).toBeUndefined();
  });

  it("clears the mainland's own raised terrain for the whole crossing, not just its low dock endpoint", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    createFlowController(host, islands, () => state);
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });

    function findSubmission(): THREE.Object3D | undefined {
      let found: THREE.Object3D | undefined;
      host.scene.traverse((o) => {
        if (o.userData.kind === "SUBMISSION") found = o;
      });
      return found;
    }

    for (let i = 0; i < 10; i++) {
      frame(0.1);
      const submission = findSubmission();
      if (!submission) continue;
      expect(submission.position.y).toBeGreaterThan(MAINLAND_GROUND_HEIGHT);
    }
  });

  it("never visits any island — submission happens before any TRE is involved", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    createFlowController(host, islands, () => state);
    state = submitTask(state, { id: "t1", projectId: "p1", treId: "tre-a" });

    let submission: THREE.Object3D | undefined;
    const island = islands.get("tre-a")!;
    for (let i = 0; i < 10; i++) {
      frame(0.1);
      host.scene.traverse((o) => {
        if (o.userData.kind === "SUBMISSION") submission = o;
      });
      if (!submission) continue;
      const dx = submission.position.x - island.center.x;
      const dz = submission.position.z - island.center.z;
      expect(Math.hypot(dx, dz)).toBeGreaterThan(island.wallRadius);
    }
  });
});

/** Every currently-visible flat ring in the scene — decision pulses and, while a task runs, the vault/workshop compute glow, none of which carry a `userData.kind`. */
function visibleRingCount(scene: THREE.Scene): number {
  let n = 0;
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.RingGeometry && o.visible) n++;
  });
  return n;
}

describe("gate decision pulses", () => {
  it("spawns a brief ring at the harbourmaster's office when Gate 1 approves, which fades away on its own", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    createFlowController(host, islands, () => state);

    frame(0.01);
    expect(visibleRingCount(host.scene)).toBe(0);

    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "APPROVED", decidedBy: "H" });
    frame(0.01);
    expect(visibleRingCount(host.scene)).toBe(1);

    for (let i = 0; i < 15; i++) frame(0.1);
    expect(visibleRingCount(host.scene)).toBe(0);
  });

  it("also pulses when Gate 1 refuses — refusal is a first-class, visible event too", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = createInitialSimState({ seed: 1, tres: [{ id: "tre-a", name: "A" }] });
    state = submitProject(state, { id: "p1", name: "P", researcher: "R", targetTreIds: ["tre-a"] });
    createFlowController(host, islands, () => state);

    state = decideProjectApproval(state, { projectId: "p1", treId: "tre-a", decision: "REFUSED", decidedBy: "H" });
    frame(0.01);
    expect(visibleRingCount(host.scene)).toBe(1);
  });

  it("pulses at this island's own customs hall on a Gate 2 decision, released or refused alike", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = twoIslandWorldWithCollectedTask();
    state = tick(state, 4);
    const crate = getCrateForTask(state, "t1");
    expect(crate).toBeDefined();
    createFlowController(host, islands, () => state);

    for (let i = 0; i < 15; i++) frame(0.1); // let the hold leg settle first
    expect(visibleRingCount(host.scene)).toBe(0);

    state = decideOutputReview(state, { crateId: crate!.id, decision: "REFUSED" });
    frame(0.01);
    expect(visibleRingCount(host.scene)).toBe(1);
  });
});

describe("the vault/workshop compute glow", () => {
  it("glows at both the vault and the workshop while a task is RUNNING, and stops once it isn't", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = twoIslandWorldWithCollectedTask(); // task is QUEUED

    createFlowController(host, islands, () => state);
    // Let the Gate 1 decision pulse from setup (replayed on construction,
    // since it already happened before the controller existed) finish
    // fading before establishing the baseline.
    for (let i = 0; i < 15; i++) frame(0.1);
    expect(visibleRingCount(host.scene)).toBe(0);

    state = tick(state, 2); // QUEUED -> INITIALIZING -> RUNNING
    frame(0.01);
    expect(visibleRingCount(host.scene)).toBe(2); // vault + workshop

    state = tick(state, 1); // RUNNING -> COMPLETE
    frame(0.01);
    expect(visibleRingCount(host.scene)).toBe(0);
  });

  it("never places anything at the vault other than the vault's own fixed position — no route, no travelling mesh", () => {
    const { host, frame } = createFakeHost();
    const islands = computeIslandGeometries([{ id: "tre-a", name: "A" }]);
    let state = twoIslandWorldWithCollectedTask();
    state = tick(state, 2); // -> RUNNING

    createFlowController(host, islands, () => state);
    for (let i = 0; i < 20; i++) frame(0.1);

    const vault = islands.get("tre-a")!.vault;
    let glowingAtVault = 0;
    host.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !(o.geometry instanceof THREE.RingGeometry) || !o.visible) return;
      const dx = o.position.x - vault.x;
      const dz = o.position.z - vault.z;
      if (Math.hypot(dx, dz) < 0.5) glowingAtVault++;
    });
    // Exactly the stationary vault glow ring — nothing else is ever near
    // the vault's (x, z), since nothing ever travels there.
    expect(glowingAtVault).toBe(1);
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

    // First tween well under way (elapsed 0.5s of a 2.2s trip — noticeably off the dock).
    frame(0.5);

    // A second departure fires on the same island while the first is still
    // mid-flight, and this same frame both processes the new event and
    // advances by a tiny 0.01s.
    current = tick(current, 1); // t2 collected
    frame(0.01);

    // If the fix is working, only the brand-new tween (elapsed 0.01s of 2.2s)
    // is driving the mesh, so it has barely left the dock. If the old,
    // further-along tween (elapsed 0.51s) were still also writing this
    // mesh's position every frame, it would be several units further out
    // — this is the concrete, measurable difference the fix produces.
    const displacementFromDock = Math.hypot(ferry.position.x - dock.x, ferry.position.z - dock.z);
    expect(displacementFromDock).toBeLessThan(1);
  });
});
