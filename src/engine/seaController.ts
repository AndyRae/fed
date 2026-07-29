import type * as THREE from "three";

/**
 * The minimal surface this needs from the renderer — same narrow-host
 * precedent as vaultShimmer.ts's own VaultShimmerHost: a fake
 * onBeforeRender is enough to test the timer without a WebGL context.
 */
export interface SeaHost {
  onBeforeRender(fn: (deltaSeconds: number) => void): () => void;
}

export interface SeaControllerHandle {
  dispose(): void;
}

interface CompiledSeaShader {
  readonly uniforms: { readonly uTime: { value: number } };
}

/**
 * Advances the animated swell's own `uTime` uniform every frame — see
 * world/sea.ts's own doc comment for why the wave shape and its motion
 * live in two different files (mirrors vaultShimmer.ts/whaleController.ts's
 * same split between "what it looks like" and "how it moves"). Purely
 * decorative: reads no SimState, never drives protocol state. Reads the
 * compiled shader from `material.userData.shader`, which sea.ts's own
 * onBeforeCompile hook populates; a no-op until the material has actually
 * compiled once.
 */
export function createSeaController(host: SeaHost, sea: THREE.Mesh): SeaControllerHandle {
  const material = sea.material as THREE.Material & { userData: { shader?: CompiledSeaShader } };
  const unsubscribe = host.onBeforeRender((deltaSeconds) => {
    const shader = material.userData.shader;
    if (shader) shader.uniforms.uTime.value += deltaSeconds;
  });

  return {
    dispose() {
      unsubscribe();
    },
  };
}
