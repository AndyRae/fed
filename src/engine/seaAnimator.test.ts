import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildSea } from "../world/sea.ts";
import { createSeaAnimator, type SeaAnimatorHost } from "./seaAnimator.ts";

function createFakeHost() {
  let callback: ((dt: number) => void) | null = null;
  const host: SeaAnimatorHost = {
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

describe("createSeaAnimator", () => {
  it("moves the sea surface forward each frame", () => {
    const { host, frame } = createFakeHost();
    const sea = buildSea();
    const before = (sea.geometry.getAttribute("position") as THREE.BufferAttribute).getZ(0);

    createSeaAnimator(host, sea);
    for (let i = 0; i < 10; i++) frame(0.1);

    const after = (sea.geometry.getAttribute("position") as THREE.BufferAttribute).getZ(0);
    expect(after).not.toBe(before);
  });

  it("dispose stops further animation", () => {
    const { host, frame, isSubscribed } = createFakeHost();
    const sea = buildSea();
    const controller = createSeaAnimator(host, sea);
    expect(isSubscribed()).toBe(true);

    controller.dispose();
    expect(isSubscribed()).toBe(false);

    const frozen = (sea.geometry.getAttribute("position") as THREE.BufferAttribute).getZ(0);
    frame(1); // no-op: unsubscribed
    expect((sea.geometry.getAttribute("position") as THREE.BufferAttribute).getZ(0)).toBe(frozen);
  });
});
