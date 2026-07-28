import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createWhaleController, type WhaleExclusionZone, type WhaleHost } from "./whaleController.ts";

function createFakeHost() {
  const scene = new THREE.Scene();
  let callback: ((dt: number) => void) | null = null;
  const host: WhaleHost = {
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
    scene,
    frame(dt: number) {
      callback?.(dt);
    },
    isSubscribed: () => callback !== null,
  };
}

function findWhale(scene: THREE.Scene): THREE.Object3D {
  const whale = scene.children.find((c) => c.userData.decoration === "WHALE");
  if (!whale) throw new Error("whale not found in scene");
  return whale;
}

const ZONES: WhaleExclusionZone[] = [
  { x: 0, z: -32, radius: 20 },
  { x: 0, z: 26, radius: 15 },
];

/** Advances the fake host in small steps until `predicate` is true or a generous iteration budget runs out — used instead of one giant frame() call so the whale's own frame-by-frame accumulation is exercised the same way the real renderer would drive it. */
function advanceUntil(frame: (dt: number) => void, predicate: () => boolean, stepSeconds = 0.5, maxSteps = 400): void {
  for (let i = 0; i < maxSteps && !predicate(); i++) {
    frame(stepSeconds);
  }
  if (!predicate()) throw new Error("condition never became true within the step budget");
}

describe("createWhaleController", () => {
  it("adds a hidden whale to the scene immediately", () => {
    const { host, scene } = createFakeHost();
    createWhaleController(host, { exclusionZones: ZONES, seed: 1 });
    const whale = findWhale(scene);
    expect(whale.visible).toBe(false);
  });

  it("eventually surfaces, outside every exclusion zone", () => {
    const { host, scene, frame } = createFakeHost();
    createWhaleController(host, { exclusionZones: ZONES, seed: 1 });
    const whale = findWhale(scene);

    advanceUntil(frame, () => whale.visible);

    for (const zone of ZONES) {
      const distance = Math.hypot(whale.position.x - zone.x, whale.position.z - zone.z);
      expect(distance).toBeGreaterThanOrEqual(zone.radius);
    }
  });

  it("moves while surfaced, then dives again after ~3 seconds", () => {
    const { host, scene, frame } = createFakeHost();
    createWhaleController(host, { exclusionZones: ZONES, seed: 2 });
    const whale = findWhale(scene);

    advanceUntil(frame, () => whale.visible);
    const startX = whale.position.x;
    const startZ = whale.position.z;

    frame(1);
    expect(whale.position.x !== startX || whale.position.z !== startZ).toBe(true);

    advanceUntil(frame, () => !whale.visible, 0.5, 20);
  });

  it("fades in and back out rather than popping abruptly to full scale", () => {
    const { host, scene, frame } = createFakeHost();
    createWhaleController(host, { exclusionZones: ZONES, seed: 3 });
    const whale = findWhale(scene);

    advanceUntil(frame, () => whale.visible);
    // Just surfaced: still ramping in, not yet at full scale.
    expect(whale.scale.x).toBeLessThan(1);

    // Midway through the visible window it should be at (or very near) full scale.
    frame(1.2);
    expect(whale.scale.x).toBeCloseTo(1, 1);
  });

  it("never surfaces inside an exclusion zone across many cycles", () => {
    const { host, scene, frame } = createFakeHost();
    createWhaleController(host, { exclusionZones: ZONES, seed: 42 });
    const whale = findWhale(scene);

    for (let cycle = 0; cycle < 5; cycle++) {
      advanceUntil(frame, () => whale.visible);
      for (const zone of ZONES) {
        const distance = Math.hypot(whale.position.x - zone.x, whale.position.z - zone.z);
        expect(distance).toBeGreaterThanOrEqual(zone.radius);
      }
      advanceUntil(frame, () => !whale.visible, 0.5, 20);
    }
  });

  it("dispose removes the whale from the scene and stops further updates", () => {
    const { host, scene, frame, isSubscribed } = createFakeHost();
    const controller = createWhaleController(host, { exclusionZones: ZONES, seed: 1 });
    expect(isSubscribed()).toBe(true);

    controller.dispose();
    expect(isSubscribed()).toBe(false);
    expect(scene.children.some((c) => c.userData.decoration === "WHALE")).toBe(false);
  });
});
