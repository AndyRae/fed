import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createVaultShimmer, type VaultShimmerHost } from "./vaultShimmer.ts";

function createFakeHost() {
  let callback: ((dt: number) => void) | null = null;
  const host: VaultShimmerHost = {
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

describe("createVaultShimmer", () => {
  it("slowly rotates a vault mesh in place, never moving its position", () => {
    const { host, frame } = createFakeHost();
    const vault = new THREE.Object3D();
    const before = vault.rotation.y;

    createVaultShimmer(host, [vault]);
    frame(1);

    expect(vault.rotation.y).not.toBe(before);
    expect(vault.position.x).toBe(0);
    expect(vault.position.y).toBe(0);
    expect(vault.position.z).toBe(0);
  });

  it("dispose stops further rotation", () => {
    const { host, frame, isSubscribed } = createFakeHost();
    const vault = new THREE.Object3D();
    const controller = createVaultShimmer(host, [vault]);
    expect(isSubscribed()).toBe(true);

    controller.dispose();
    expect(isSubscribed()).toBe(false);

    const frozen = vault.rotation.y;
    frame(1);
    expect(vault.rotation.y).toBe(frozen);
  });

  it("rotates every vault it's given, by the same amount each frame", () => {
    const { host, frame } = createFakeHost();
    const vaultA = new THREE.Object3D();
    const vaultB = new THREE.Object3D();

    createVaultShimmer(host, [vaultA, vaultB]);
    frame(1);

    expect(vaultA.rotation.y).not.toBe(0);
    expect(vaultA.rotation.y).toBeCloseTo(vaultB.rotation.y, 10);
  });
});
