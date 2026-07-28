import * as THREE from "three";
import { applySeaWaves } from "../world/sea.ts";

/**
 * The minimal surface this needs from the renderer — narrow on purpose,
 * same precedent as flowController.ts's FlowSceneHost: a fake
 * onBeforeRender is enough to test the animation loop without a WebGL
 * context.
 */
export interface SeaAnimatorHost {
  onBeforeRender(fn: (deltaSeconds: number) => void): () => void;
}

export interface SeaAnimatorHandle {
  dispose(): void;
}

/**
 * Ambient decorative motion only — see CLAUDE.md "Visual language": waves
 * carry no protocol meaning, so this never reads SimState, only an elapsed-
 * time clock. It must stay visually subordinate to anything that does
 * (ferries, containers, crates, gate pulses) — see sea.ts's WAVE_AMPLITUDE.
 */
export function createSeaAnimator(host: SeaAnimatorHost, sea: THREE.Mesh): SeaAnimatorHandle {
  let elapsed = 0;
  const geometry = sea.geometry;
  const unsubscribe = host.onBeforeRender((deltaSeconds) => {
    elapsed += deltaSeconds;
    applySeaWaves(geometry, elapsed);
  });

  return {
    dispose() {
      unsubscribe();
    },
  };
}
