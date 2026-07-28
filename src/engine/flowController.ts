import * as THREE from "three";
import { theme } from "../core/theme.ts";
import type { CrateId, SimState, TreId } from "../core/types.ts";
import { egressPath, ferryPath, type IslandGeometry, type Vec3 } from "../world/layout.ts";
import { GROUND_HEIGHT } from "../world/island.ts";
import { pointAlongPath } from "../world/pathInterpolation.ts";

const FERRY_TRIP_SECONDS = 2.2;
const CONTAINER_TRIP_SECONDS = 0.9;
const CRATE_HOLD_TRIP_SECONDS = 1.0;
const CRATE_RELEASE_TRIP_SECONDS = 1.6;
const FERRY_HEIGHT = 0.6;
const CONTAINER_HEIGHT = 0.55;
const CRATE_HEIGHT = 0.6;

const DECISION_PULSE_SECONDS = 1.0;
// GROUND_HEIGHT, not ISLAND_HEIGHT alone — see island.ts's own doc comment
// on GROUND_HEIGHT: the land mesh's bevel puts the real flat terrain
// surface 0.35 above the nominal extrude depth, and a ground-hugging ring
// measured from ISLAND_HEIGHT alone ends up embedded in that bevel,
// invisible from every normal camera angle (see routes.ts's road for the
// same bug, found and fixed the same session).
const DECISION_PULSE_HEIGHT = GROUND_HEIGHT + 0.08;
const COMPUTE_GLOW_HEIGHT_VAULT = GROUND_HEIGHT + 1.8;
const COMPUTE_GLOW_HEIGHT_WORKSHOP = GROUND_HEIGHT + 2.6;
const COMPUTE_GLOW_PULSE_HZ = 5;

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

/** A brief, stationary ring at a fixed point — never a waypoint on a path, so it can mark a human decision (honesty rule 3) without ever implying anything travelled to or from that point. */
interface DecisionPulse {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  elapsed: number;
}

/** A pair of stationary rings, one at the vault and one at the workshop, that glow together — never a beam or particle between them — while at least one of this island's tasks is RUNNING. */
interface ComputeGlow {
  readonly vaultMesh: THREE.Mesh;
  readonly vaultMaterial: THREE.MeshStandardMaterial;
  readonly workshopMesh: THREE.Mesh;
  readonly workshopMaterial: THREE.MeshStandardMaterial;
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

/**
 * The GA4GH TES task's container itself, carried from the dock to the
 * workshop once the ferry that collected it is back home — the one leg of
 * its journey that was previously invisible: the ferry's round trip showed
 * the fetch, but nothing showed the collected work actually reaching the
 * workshop to run. Shares the ferry's colour (the same "in transit inside
 * the wall" role, not a new semantic one) but is its own, smaller mesh, and
 * its own `userData.kind`, distinct from both FERRY and CRATE.
 */
function buildContainerMesh(treId: TreId): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.65, 1.3),
    new THREE.MeshStandardMaterial({ color: theme.trust.ferry, roughness: 0.6, metalness: 0.15 }),
  );
  mesh.userData.kind = "CONTAINER";
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

/** A flat ring, lying on the ground, that a pulse or a compute glow can scale/fade — untagged (not `userData.kind`), so it is decorative-only and never resolves to anything under the picker. */
function buildRingMesh(color: number, innerRadius: number, outerRadius: number): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(innerRadius, outerRadius, 32), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/**
 * Animates ferries, containers, crates, and two kinds of stationary light —
 * in response to real SimState events, never driving protocol state itself
 * (src/sim owns that). Watches state.events for:
 *  - TASK_COLLECTED: that island's ferry leaves its dock, travels to the
 *    mainland, and returns (honesty rule 1) — then the container it
 *    collected travels on, from the dock to the workshop, entirely inside
 *    the wall.
 *  - PROJECT_APPROVAL_DECIDED / OUTPUT_REVIEW_DECIDED: a brief ring pulses
 *    at the harbourmaster's office or this island's own customs hall — a
 *    visible marker that a human decision just landed there, for either
 *    outcome (honesty rule 5: refusal is a first-class, visible event too).
 *    The ring never travels anywhere; it only ever grows and fades in
 *    place.
 *  - CRATE_SEALED: a crate travels from the workshop to this island's own
 *    customs hall and stops there, visibly waiting — honesty rule 3, both
 *    gates have visible waiting.
 *  - OUTPUT_REVIEW_DECIDED: a RELEASED crate continues on from the customs
 *    hall, across the water, directly to the researcher's quay. A REFUSED
 *    crate is left exactly where it stopped — honesty rule 5, refusal is a
 *    first-class, visible path, not a disappearance.
 *
 * Every frame, independent of events: while any of an island's tasks is
 * RUNNING, the vault and the workshop glow together — a synchronised pair
 * of stationary rings, never a beam or a particle between them. This is the
 * honest rendering of what WORKSHOP's own explanation already says: the
 * workshop "sits beside the vault and computes on it in place — nothing the
 * vault holds ever leaves it." Honesty rule 2 forbids the vault ever being
 * a waypoint on any route, and CLAUDE.md's world-metaphor table states the
 * on-island workflow line is "purely informational, never a route anything
 * travels" — so nothing here ever moves between, to, or from the vault, or
 * rides along that line. Two things glowing at once, never a line drawn
 * between them, is the difference that keeps this honest.
 */
export function createFlowController(
  host: FlowSceneHost,
  islands: ReadonlyMap<TreId, IslandGeometry>,
  getState: () => SimState,
  options: FlowControllerOptions = {},
): FlowController {
  const ferryMeshes = new Map<TreId, THREE.Object3D>();
  const computeGlows = new Map<TreId, ComputeGlow>();
  for (const [treId, geometry] of islands) {
    const ferry = buildFerryMesh(treId);
    ferry.position.set(geometry.dock.x, geometry.dock.y + FERRY_HEIGHT, geometry.dock.z);
    host.scene.add(ferry);
    ferryMeshes.set(treId, ferry);

    const vaultGlow = buildRingMesh(theme.vault.reserved, 1.5, 2.1);
    vaultGlow.position.set(geometry.vault.x, geometry.vault.y + COMPUTE_GLOW_HEIGHT_VAULT, geometry.vault.z);
    vaultGlow.visible = false;
    host.scene.add(vaultGlow);

    const workshopGlow = buildRingMesh(theme.trust.workshop, 1.7, 2.3);
    workshopGlow.position.set(geometry.workshop.x, geometry.workshop.y + COMPUTE_GLOW_HEIGHT_WORKSHOP, geometry.workshop.z);
    workshopGlow.visible = false;
    host.scene.add(workshopGlow);

    computeGlows.set(treId, {
      vaultMesh: vaultGlow,
      vaultMaterial: vaultGlow.material as THREE.MeshStandardMaterial,
      workshopMesh: workshopGlow,
      workshopMaterial: workshopGlow.material as THREE.MeshStandardMaterial,
    });
  }

  const tweens: Tween[] = [];
  const pulses: DecisionPulse[] = [];
  let elapsedTotal = 0;
  // A watermark, not a cursor: state sources that move non-monotonically
  // (a tour stepping backward, then forward again) must never re-fire an
  // event this has already seen, so this only ever increases.
  let lastEventCount = options.startFromCurrentEvents ? getState().events.length : 0;

  // Looked up by crateId when OUTPUT_REVIEW_DECIDED fires, so the release
  // leg can find the right mesh regardless of whether its hold-leg tween
  // has finished animating yet (a tour stepping several stops at once can
  // fire CRATE_SEALED and OUTPUT_REVIEW_DECIDED for the same crate inside
  // one handleNewEvents call, with zero real seconds elapsed between them).
  const crateMeshesByCrateId = new Map<CrateId, THREE.Object3D>();
  // Every crate mesh currently in the scene, tweening or parked — a
  // REFUSED crate is retained indefinitely (honesty rule 5), so unlike the
  // ferry/container it can outlive its tween and needs its own disposal
  // tracking rather than relying on the tweens array alone.
  const allCrateMeshes = new Set<THREE.Object3D>();

  /**
   * A mesh can only be on one journey at a time. If busier ambient traffic
   * means a new departure fires before the previous one reached the dock,
   * the new trip replaces the old one outright rather than leaving two
   * tweens both writing the same mesh's position every frame — without
   * this, the older (further-along) tween's write would win each frame
   * purely because of array iteration order, and the mesh would visibly
   * jump backward whichever tween finishes first.
   */
  function pushTween(tween: Tween): void {
    for (let i = tweens.length - 1; i >= 0; i--) {
      if (tweens[i]!.mesh === tween.mesh) tweens.splice(i, 1);
    }
    tweens.push(tween);
  }

  function spawnContainerTrip(geometry: IslandGeometry, treId: TreId): void {
    const container = buildContainerMesh(treId);
    container.position.set(geometry.dock.x, geometry.dock.y + CONTAINER_HEIGHT, geometry.dock.z);
    host.scene.add(container);
    pushTween({
      mesh: container,
      path: [geometry.dock, geometry.workshop],
      duration: CONTAINER_TRIP_SECONDS,
      elapsed: 0,
      heightOffset: CONTAINER_HEIGHT,
      onComplete: () => host.scene.remove(container),
    });
  }

  function spawnDecisionPulse(position: Vec3): void {
    const mesh = buildRingMesh(theme.gate.amber, 0.5, 0.85);
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.opacity = 0.85;
    mesh.position.set(position.x, position.y + DECISION_PULSE_HEIGHT, position.z);
    host.scene.add(mesh);
    pulses.push({ mesh, material, elapsed: 0 });
  }

  function handleNewEvents(state: SimState): void {
    for (let i = lastEventCount; i < state.events.length; i++) {
      const event = state.events[i]!;
      if (event.type === "TASK_COLLECTED") {
        const geometry = islands.get(event.treId);
        const ferry = ferryMeshes.get(event.treId);
        if (geometry && ferry) {
          pushTween({
            mesh: ferry,
            path: ferryPath(geometry),
            duration: FERRY_TRIP_SECONDS,
            elapsed: 0,
            heightOffset: FERRY_HEIGHT,
            onComplete: () => spawnContainerTrip(geometry, event.treId),
          });
        }
      } else if (event.type === "PROJECT_APPROVAL_DECIDED") {
        const geometry = islands.get(event.treId);
        if (geometry) spawnDecisionPulse(geometry.harbourmasterOffice);
      } else if (event.type === "CRATE_SEALED") {
        const task = state.tasks.find((t) => t.id === event.taskId);
        const geometry = task && islands.get(task.treId);
        if (task && geometry) {
          const crate = buildCrateMesh(task.treId);
          crate.userData.crateId = event.crateId;
          crate.position.set(geometry.workshop.x, geometry.workshop.y + CRATE_HEIGHT, geometry.workshop.z);
          host.scene.add(crate);
          crateMeshesByCrateId.set(event.crateId, crate);
          allCrateMeshes.add(crate);
          const holdPath = egressPath(geometry).slice(0, 2); // workshop -> this island's own customs hall
          pushTween({
            mesh: crate,
            path: holdPath,
            duration: CRATE_HOLD_TRIP_SECONDS,
            elapsed: 0,
            heightOffset: CRATE_HEIGHT,
          });
        }
      } else if (event.type === "OUTPUT_REVIEW_DECIDED") {
        const crate = crateMeshesByCrateId.get(event.crateId);
        crateMeshesByCrateId.delete(event.crateId);
        if (!crate) continue;
        const geometry = islands.get(crate.userData.treId as TreId);
        if (geometry) spawnDecisionPulse(geometry.customsHall);
        if (event.status === "RELEASED" && geometry) {
          const releasePath = egressPath(geometry).slice(1); // customs hall -> sea -> the researcher's quay
          pushTween({
            mesh: crate,
            path: releasePath,
            duration: CRATE_RELEASE_TRIP_SECONDS,
            elapsed: 0,
            heightOffset: CRATE_HEIGHT,
            onComplete: () => {
              host.scene.remove(crate);
              allCrateMeshes.delete(crate);
            },
          });
        }
        // REFUSED: leave the crate exactly where it stopped, at this
        // island's own customs hall — it is retained, not deleted.
      }
    }
    lastEventCount = Math.max(lastEventCount, state.events.length);
  }

  function updateComputeGlows(state: SimState): void {
    for (const [treId, glow] of computeGlows) {
      const running = state.tasks.some((t) => t.treId === treId && t.status === "RUNNING");
      glow.vaultMesh.visible = running;
      glow.workshopMesh.visible = running;
      if (!running) continue;
      const pulse = 0.55 + 0.45 * Math.sin(elapsedTotal * COMPUTE_GLOW_PULSE_HZ);
      const opacity = 0.25 + 0.45 * pulse;
      glow.vaultMaterial.opacity = opacity;
      glow.workshopMaterial.opacity = opacity;
    }
  }

  function updatePulses(deltaSeconds: number): void {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i]!;
      pulse.elapsed += deltaSeconds;
      const t = pulse.elapsed / DECISION_PULSE_SECONDS;
      if (t >= 1) {
        host.scene.remove(pulse.mesh);
        pulse.mesh.geometry.dispose();
        pulse.material.dispose();
        pulses.splice(i, 1);
        continue;
      }
      const scale = 1 + t * 4;
      pulse.mesh.scale.set(scale, scale, scale);
      pulse.material.opacity = 0.85 * (1 - t);
    }
  }

  const unsubscribe = host.onBeforeRender((deltaSeconds) => {
    elapsedTotal += deltaSeconds;
    const state = getState();
    handleNewEvents(state);
    updateComputeGlows(state);
    updatePulses(deltaSeconds);

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
      for (const mesh of allCrateMeshes) host.scene.remove(mesh);
      allCrateMeshes.clear();
      crateMeshesByCrateId.clear();
      for (const pulse of pulses) {
        host.scene.remove(pulse.mesh);
        pulse.mesh.geometry.dispose();
        pulse.material.dispose();
      }
      pulses.length = 0;
      for (const glow of computeGlows.values()) {
        host.scene.remove(glow.vaultMesh);
        host.scene.remove(glow.workshopMesh);
      }
      computeGlows.clear();
    },
  };
}
