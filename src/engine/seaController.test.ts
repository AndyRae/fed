import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createSeaController, type SeaHost } from "./seaController.ts";

function createFakeHost() {
  let callback: ((dt: number) => void) | null = null;
  const host: SeaHost = {
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

function fakeSeaMesh(shader: { uniforms: { uTime: { value: number } } } | undefined) {
  const material = new THREE.MeshStandardMaterial();
  material.userData.shader = shader;
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
}

describe("createSeaController", () => {
  it("advances uTime by real elapsed seconds each frame", () => {
    const { host, frame } = createFakeHost();
    const shader = { uniforms: { uTime: { value: 0 } } };
    const sea = fakeSeaMesh(shader);

    createSeaController(host, sea);
    frame(0.5);
    expect(shader.uniforms.uTime.value).toBe(0.5);
    frame(0.25);
    expect(shader.uniforms.uTime.value).toBe(0.75);
  });

  it("is a no-op before the material has actually compiled a shader yet", () => {
    const { host, frame } = createFakeHost();
    const sea = fakeSeaMesh(undefined);

    expect(() => createSeaController(host, sea)).not.toThrow();
    expect(() => frame(1)).not.toThrow();
  });

  it("dispose stops advancing uTime", () => {
    const { host, frame, isSubscribed } = createFakeHost();
    const shader = { uniforms: { uTime: { value: 0 } } };
    const sea = fakeSeaMesh(shader);

    const controller = createSeaController(host, sea);
    expect(isSubscribed()).toBe(true);

    controller.dispose();
    expect(isSubscribed()).toBe(false);

    frame(1);
    expect(shader.uniforms.uTime.value).toBe(0);
  });
});
