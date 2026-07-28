import * as THREE from "three";

/**
 * The minimal surface this needs from the renderer — same narrow-host
 * precedent as flowController.ts's FlowSceneHost: a fake onBeforeRender is
 * enough to test the rotation without a WebGL context.
 */
export interface VaultShimmerHost {
  onBeforeRender(fn: (deltaSeconds: number) => void): () => void;
}

export interface VaultShimmerHandle {
  dispose(): void;
}

const SHIMMER_SPEED_RAD_PER_SEC = 0.4;

/**
 * A slow, contained spin on each vault gem — decorative motion only, never
 * reading SimState. Rotation in place, nothing else: honesty rule 2 forbids
 * anything whose origin is the vault ever moving, boarding a ferry, or
 * crossing a wall, so this must never touch position, only rotation.
 */
export function createVaultShimmer(host: VaultShimmerHost, vaults: readonly THREE.Object3D[]): VaultShimmerHandle {
  const unsubscribe = host.onBeforeRender((deltaSeconds) => {
    for (const vault of vaults) {
      vault.rotation.y += deltaSeconds * SHIMMER_SPEED_RAD_PER_SEC;
    }
  });

  return {
    dispose() {
      unsubscribe();
    },
  };
}
