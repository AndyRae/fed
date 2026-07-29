import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createWeatherController, type WeatherExclusionZone, type WeatherHost } from "./weatherController.ts";

function createFakeHost() {
  const scene = new THREE.Scene();
  let callback: ((dt: number) => void) | null = null;
  const host: WeatherHost = {
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

function mistPuffs(scene: THREE.Scene): THREE.Object3D[] {
  return scene.children.filter((c) => c.userData.decoration === "MIST");
}
function rainStreaks(scene: THREE.Scene): THREE.Object3D[] {
  return scene.children.filter((c) => c.userData.decoration === "RAIN");
}
function anyVisible(objects: readonly THREE.Object3D[]): boolean {
  return objects.some((o) => o.visible);
}
function anyOpaque(objects: readonly THREE.Object3D[]): boolean {
  return objects.some((o) => ((o as THREE.Mesh).material as THREE.Material & { opacity: number }).opacity > 0);
}

const ZONES: WeatherExclusionZone[] = [
  { x: 0, z: -32, radius: 20 },
  { x: 0, z: 26, radius: 15 },
];

/** Same precedent as whaleController.test.ts's own advanceUntil: frame-by-frame, not one giant jump, so accumulation is exercised the way the real renderer would drive it. */
function advanceUntil(frame: (dt: number) => void, predicate: () => boolean, stepSeconds = 0.5, maxSteps = 400): void {
  for (let i = 0; i < maxSteps && !predicate(); i++) {
    frame(stepSeconds);
  }
  if (!predicate()) throw new Error("condition never became true within the step budget");
}

describe("createWeatherController", () => {
  it("adds every mist puff and rain streak hidden and fully transparent immediately", () => {
    const { host, scene } = createFakeHost();
    createWeatherController(host, { exclusionZones: ZONES, seed: 1 });
    expect(mistPuffs(scene).length).toBeGreaterThan(0);
    expect(rainStreaks(scene).length).toBeGreaterThan(0);
    expect(anyVisible(mistPuffs(scene))).toBe(false);
    expect(anyVisible(rainStreaks(scene))).toBe(false);
  });

  it("eventually plays some weather, outside every exclusion zone", () => {
    const { host, scene, frame } = createFakeHost();
    createWeatherController(host, { exclusionZones: ZONES, seed: 1 });

    advanceUntil(frame, () => anyVisible(mistPuffs(scene)) || anyVisible(rainStreaks(scene)));
    frame(0.1); // let opacity ramp up off zero

    const active = [...mistPuffs(scene), ...rainStreaks(scene)].filter((o) => o.visible);
    expect(active.length).toBeGreaterThan(0);
    for (const object of active) {
      for (const zone of ZONES) {
        const distance = Math.hypot(object.position.x - zone.x, object.position.z - zone.z);
        expect(distance).toBeGreaterThanOrEqual(zone.radius);
      }
    }
  });

  it("fades out and hides again once its own active window ends", () => {
    const { host, scene, frame } = createFakeHost();
    createWeatherController(host, { exclusionZones: ZONES, seed: 7 });

    advanceUntil(frame, () => anyVisible(mistPuffs(scene)) || anyVisible(rainStreaks(scene)));
    // The whole active window (mist: 16s, rain: 11s) plus its fade, generously bounded.
    advanceUntil(frame, () => !anyVisible(mistPuffs(scene)) && !anyVisible(rainStreaks(scene)), 0.5, 60);
    expect(anyOpaque(mistPuffs(scene))).toBe(false);
    expect(anyOpaque(rainStreaks(scene))).toBe(false);
  });

  it("fades in rather than popping straight to full opacity", () => {
    const { host, scene, frame } = createFakeHost();
    createWeatherController(host, { exclusionZones: ZONES, seed: 3 });

    advanceUntil(frame, () => anyVisible(mistPuffs(scene)) || anyVisible(rainStreaks(scene)));
    const active = [...mistPuffs(scene), ...rainStreaks(scene)].find((o) => o.visible)!;
    const material = (active as THREE.Mesh).material as THREE.Material & { opacity: number };
    // Just switched visible: still ramping in from opacity 0.
    expect(material.opacity).toBeLessThan(0.1);
  });

  it("never plays inside an exclusion zone across many cycles", () => {
    const { host, scene, frame } = createFakeHost();
    createWeatherController(host, { exclusionZones: ZONES, seed: 42 });

    for (let cycle = 0; cycle < 3; cycle++) {
      advanceUntil(frame, () => anyVisible(mistPuffs(scene)) || anyVisible(rainStreaks(scene)));
      const active = [...mistPuffs(scene), ...rainStreaks(scene)].filter((o) => o.visible);
      for (const object of active) {
        for (const zone of ZONES) {
          const distance = Math.hypot(object.position.x - zone.x, object.position.z - zone.z);
          expect(distance).toBeGreaterThanOrEqual(zone.radius);
        }
      }
      advanceUntil(frame, () => !anyVisible(mistPuffs(scene)) && !anyVisible(rainStreaks(scene)), 0.5, 60);
    }
  });

  it("dispose removes every mist puff and rain streak from the scene and stops further updates", () => {
    const { host, scene, isSubscribed } = createFakeHost();
    const controller = createWeatherController(host, { exclusionZones: ZONES, seed: 1 });
    expect(isSubscribed()).toBe(true);

    controller.dispose();
    expect(isSubscribed()).toBe(false);
    expect(mistPuffs(scene)).toHaveLength(0);
    expect(rainStreaks(scene)).toHaveLength(0);
  });
});
