import * as THREE from "three";
import { createRng, type Rng } from "../sim/rng.ts";
import { SEA_LEVEL_Y } from "../world/layout.ts";
import { buildWhale } from "../world/whale.ts";

/**
 * The minimal surface this needs from the renderer — same narrow-host
 * precedent as flowController.ts's FlowSceneHost: a fake scene + a fake
 * onBeforeRender is enough to test the whole surface/swim/dive cycle
 * without a WebGL context.
 */
export interface WhaleHost {
  readonly scene: THREE.Scene;
  onBeforeRender(fn: (deltaSeconds: number) => void): () => void;
}

/** A circular patch of open water the whale must never surface inside — every island's wall footprint and the mainland's coastline, each with a clearance margin. */
export interface WhaleExclusionZone {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface WhaleControllerOptions {
  readonly exclusionZones: readonly WhaleExclusionZone[];
  /** How far from the world's centre the whale is allowed to surface — keeps it somewhere a roaming camera is likely to actually pass, rather than lost out in the sea's full 260-unit extent. */
  readonly roamRadius?: number;
  readonly seed?: number;
}

export interface WhaleControllerHandle {
  dispose(): void;
}

/**
 * A rare, purely decorative easter egg: an island's wall and the
 * mainland's own coastline are the only boundaries this world takes
 * seriously, and the whale never comes near either — it only ever
 * surfaces in open water, well clear of every exclusion zone. It never
 * suggests anything about the protocol (no route, no cargo, nothing that
 * could be mistaken for a ferry or a crate), so it carries no
 * `userData.kind` and reads SimState never.
 */
const MIN_WAIT_SECONDS = 25;
const MAX_WAIT_SECONDS = 55;
const VISIBLE_SECONDS = 3;
const POP_TRANSITION_SECONDS = 0.45;
const DRIFT_SPEED = 1.1;
const BOB_AMPLITUDE = 0.08;
const BOB_HZ = 0.7;
const DEFAULT_ROAM_RADIUS = 55;
const MAX_PLACEMENT_ATTEMPTS = 30;

type Phase = "WAITING" | "VISIBLE";

function isInsideAnyZone(x: number, z: number, zones: readonly WhaleExclusionZone[]): boolean {
  return zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.radius);
}

/** Rejection-samples a point within the roam disc that falls outside every exclusion zone, falling back to the disc's own edge (always outside a layout's exclusion zones in practice) if it somehow never finds one. */
function pickSurfacePoint(rng: Rng, zones: readonly WhaleExclusionZone[], roamRadius: number): { x: number; z: number } {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng()) * roamRadius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!isInsideAnyZone(x, z, zones)) return { x, z };
  }
  const angle = rng() * Math.PI * 2;
  return { x: Math.cos(angle) * roamRadius, z: Math.sin(angle) * roamRadius };
}

export function createWhaleController(host: WhaleHost, options: WhaleControllerOptions): WhaleControllerHandle {
  const rng = createRng(options.seed ?? 90125);
  const roamRadius = options.roamRadius ?? DEFAULT_ROAM_RADIUS;
  const zones = options.exclusionZones;

  const whale = buildWhale();
  whale.visible = false;
  host.scene.add(whale);

  let phase: Phase = "WAITING";
  let phaseTimer = MIN_WAIT_SECONDS + rng() * (MAX_WAIT_SECONDS - MIN_WAIT_SECONDS);
  let visibleElapsed = 0;
  let drift = { x: 0, z: 0 };

  function surface(): void {
    const point = pickSurfacePoint(rng, zones, roamRadius);
    const heading = rng() * Math.PI * 2;
    whale.position.set(point.x, SEA_LEVEL_Y, point.z);
    whale.rotation.y = heading;
    whale.scale.setScalar(0.001);
    whale.visible = true;
    drift = { x: Math.cos(heading) * DRIFT_SPEED, z: Math.sin(heading) * DRIFT_SPEED };
    phase = "VISIBLE";
    phaseTimer = VISIBLE_SECONDS;
    visibleElapsed = 0;
  }

  function dive(): void {
    whale.visible = false;
    phase = "WAITING";
    phaseTimer = MIN_WAIT_SECONDS + rng() * (MAX_WAIT_SECONDS - MIN_WAIT_SECONDS);
  }

  const unsubscribe = host.onBeforeRender((deltaSeconds) => {
    phaseTimer -= deltaSeconds;

    if (phase === "WAITING") {
      if (phaseTimer <= 0) surface();
      return;
    }

    visibleElapsed += deltaSeconds;
    whale.position.x += drift.x * deltaSeconds;
    whale.position.z += drift.z * deltaSeconds;
    whale.position.y = SEA_LEVEL_Y + Math.sin(visibleElapsed * BOB_HZ * Math.PI * 2) * BOB_AMPLITUDE;

    const fadeIn = Math.min(visibleElapsed / POP_TRANSITION_SECONDS, 1);
    const fadeOut = Math.min(Math.max(phaseTimer, 0) / POP_TRANSITION_SECONDS, 1);
    whale.scale.setScalar(Math.max(Math.min(fadeIn, fadeOut), 0.001));

    if (phaseTimer <= 0) dive();
  });

  return {
    dispose() {
      unsubscribe();
      host.scene.remove(whale);
    },
  };
}
