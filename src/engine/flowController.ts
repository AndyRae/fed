import * as THREE from "three";
import { theme } from "../core/theme.ts";
import type { SimState, TreId } from "../core/types.ts";
import { egressPath, ferryPath, type IslandGeometry, type Vec3 } from "../world/layout.ts";
import { pointAlongPath } from "../world/pathInterpolation.ts";

const FERRY_TRIP_SECONDS = 3;
const CRATE_TRIP_SECONDS = 2.5;
const FERRY_HEIGHT = 0.6;
const CRATE_HEIGHT = 0.6;

/**
 * The minimal surface the flow controller needs from the renderer. Narrow
 * on purpose: `Engine` (src/engine/renderer.ts) satisfies this
 * structurally, but a plain THREE.Scene + a fake onBeforeRender is enough
 * to test the tween logic without a WebGL context.
 */
export interface FlowSceneHost {
  readonly scene: THREE.Scene;
  onBeforeRender(fn: (deltaSeconds: number) => void): () => void;
}

export interface FlowController {
  dispose(): void;
}

export interface FlowControllerOptions {
  /**
   * If true, treats the state source's event count at construction time as
   * the starting watermark instead of 0, so pre-existing history isn't
   * replayed. Used when recreating a flow controller against a state that
   * already has a past — e.g. resuming the ambient demo after a tour.
   */
  readonly startFromCurrentEvents?: boolean;
}

interface Tween {
  readonly mesh: THREE.Object3D;
  readonly path: readonly Vec3[];
  readonly duration: number;
  readonly heightOffset: number;
  elapsed: number;
  readonly onComplete?: () => void;
}

function buildFerryMesh(treId: TreId): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.2, 4),
    new THREE.MeshStandardMaterial({ color: theme.trust.ferry, roughness: 0.6 }),
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.userData.kind = "FERRY";
  mesh.userData.treId = treId;
  return mesh;
}

function buildCrateMesh(treId: TreId): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.8, 1),
    new THREE.MeshStandardMaterial({ color: theme.crate.body, roughness: 0.8 }),
  );
  mesh.userData.kind = "CRATE";
  mesh.userData.treId = treId;
  return mesh;
}

/**
 * Animates ferries and crates in response to real SimState events, never
 * driving protocol state itself (src/sim owns that). Watches
 * state.events for TASK_COLLECTED (that island's ferry leaves its dock,
 * travels to the mainland, and returns — honesty rule 1) and CRATE_SEALED
 * (a crate travels from the workshop to customs via the same dock
 * corridor the ferry uses, rather than literally riding inside the ferry
 * mesh — see SIMPLIFICATIONS.md).
 */
export function createFlowController(
  host: FlowSceneHost,
  islands: ReadonlyMap<TreId, IslandGeometry>,
  getState: () => SimState,
  options: FlowControllerOptions = {},
): FlowController {
  const ferryMeshes = new Map<TreId, THREE.Object3D>();
  for (const [treId, geometry] of islands) {
    const ferry = buildFerryMesh(treId);
    ferry.position.set(geometry.dock.x, geometry.dock.y + FERRY_HEIGHT, geometry.dock.z);
    host.scene.add(ferry);
    ferryMeshes.set(treId, ferry);
  }

  const tweens: Tween[] = [];
  // A watermark, not a cursor: state sources that move non-monotonically
  // (a tour stepping backward, then forward again) must never re-fire an
  // event this has already seen, so this only ever increases.
  let lastEventCount = options.startFromCurrentEvents ? getState().events.length : 0;

  function handleNewEvents(state: SimState): void {
    for (let i = lastEventCount; i < state.events.length; i++) {
      const event = state.events[i]!;
      if (event.type === "TASK_COLLECTED") {
        const geometry = islands.get(event.treId);
        const ferry = ferryMeshes.get(event.treId);
        if (geometry && ferry) {
          tweens.push({ mesh: ferry, path: ferryPath(geometry), duration: FERRY_TRIP_SECONDS, elapsed: 0, heightOffset: FERRY_HEIGHT });
        }
      } else if (event.type === "CRATE_SEALED") {
        const task = state.tasks.find((t) => t.id === event.taskId);
        const geometry = task && islands.get(task.treId);
        if (task && geometry) {
          const crate = buildCrateMesh(task.treId);
          crate.userData.crateId = event.crateId;
          crate.position.set(geometry.workshop.x, geometry.workshop.y + CRATE_HEIGHT, geometry.workshop.z);
          host.scene.add(crate);
          tweens.push({
            mesh: crate,
            path: egressPath(geometry),
            duration: CRATE_TRIP_SECONDS,
            elapsed: 0,
            heightOffset: CRATE_HEIGHT,
            onComplete: () => host.scene.remove(crate),
          });
        }
      }
    }
    lastEventCount = Math.max(lastEventCount, state.events.length);
  }

  const unsubscribe = host.onBeforeRender((deltaSeconds) => {
    handleNewEvents(getState());

    for (let i = tweens.length - 1; i >= 0; i--) {
      const tween = tweens[i]!;
      tween.elapsed += deltaSeconds;
      const t = tween.elapsed / tween.duration;
      const point = pointAlongPath(tween.path, t);
      tween.mesh.position.set(point.x, point.y + tween.heightOffset, point.z);
      if (t >= 1) {
        tweens.splice(i, 1);
        tween.onComplete?.();
      }
    }
  });

  return {
    dispose() {
      unsubscribe();
      for (const ferry of ferryMeshes.values()) host.scene.remove(ferry);
      for (const tween of tweens) host.scene.remove(tween.mesh);
      tweens.length = 0;
    },
  };
}
