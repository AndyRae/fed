import * as THREE from "three";
import { createRng, type Rng } from "../sim/rng.ts";
import { SEA_LEVEL_Y } from "../world/layout.ts";
import { buildMistPuff, buildRainStreak } from "../world/weather.ts";

/**
 * The minimal surface this needs from the renderer — same narrow-host
 * precedent as whaleController.ts's own WhaleHost.
 */
export interface WeatherHost {
  readonly scene: THREE.Scene;
  onBeforeRender(fn: (deltaSeconds: number) => void): () => void;
}

/**
 * Structurally identical to whaleController.ts's own WhaleExclusionZone —
 * a circular patch of open water this effect must never appear inside:
 * every island's wall footprint and the mainland's coastline, each with a
 * clearance margin. Declared separately, on purpose, so neither controller
 * imports the other's types; main.ts passes the same computed array to
 * both.
 */
export interface WeatherExclusionZone {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface WeatherControllerOptions {
  readonly exclusionZones: readonly WeatherExclusionZone[];
  /** How far from the world's centre a mist bank or rain shower is allowed to appear — same reasoning as whaleController's own roamRadius. */
  readonly roamRadius?: number;
  readonly seed?: number;
}

export interface WeatherControllerHandle {
  dispose(): void;
}

type WeatherKind = "MIST" | "RAIN";
type Phase = "WAITING" | "ACTIVE";

/**
 * A rare, purely decorative easter egg in the spirit of the whale — see
 * IDEAS.md "Weather variety". Two independent atmospheric variations, one
 * chosen at random each time: a mist bank drifting over a patch of open
 * sea, or a passing rain shower over another. Both are confined to open
 * water by the same exclusion-zone mechanism as the whale (and, within
 * that, to a bounded patch around a rejection-sampled centre, so the whole
 * effect — not just its centre point — stays clear of every wall). Reads
 * no SimState and stands for nothing in the protocol; motion here is
 * background weather, not a claim about federation.
 */
// Noticeably more frequent than a first pass had it (50-110s) — feedback
// was that watching for a while still showed very little weather. Active
// windows (16s mist, 11s rain) now make up something like 40% of the time,
// rather than being a rare footnote.
const MIN_WAIT_SECONDS = 12;
const MAX_WAIT_SECONDS = 28;
const FADE_SECONDS = 2.5;
const DEFAULT_ROAM_RADIUS = 55;
const MAX_PLACEMENT_ATTEMPTS = 30;

const MIST_ACTIVE_SECONDS = 16;
const MIST_PUFF_COUNT = 6;
const MIST_PATCH_RADIUS = 7;
const MIST_MIN_SCALE = 2.2;
const MIST_SCALE_RANGE = 1.6;
const MIST_FLATTEN = 0.35;
const MIST_DRIFT_SPEED = 0.35;
const MIST_MAX_OPACITY = 0.4;
const MIST_HEIGHT = SEA_LEVEL_Y + 0.6;

const RAIN_ACTIVE_SECONDS = 11;
const RAIN_STREAK_COUNT = 60;
const RAIN_STREAK_LENGTH = 1.4;
const RAIN_PATCH_RADIUS = 9;
const RAIN_FALL_SPEED = 9;
const RAIN_TOP_HEIGHT = SEA_LEVEL_Y + 6;
const RAIN_MAX_OPACITY = 0.55;

function isInsideAnyZone(x: number, z: number, zones: readonly WeatherExclusionZone[], extraClearance: number): boolean {
  return zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.radius + extraClearance);
}

/**
 * Rejection-samples a patch centre within the roam disc, keeping the whole
 * patch (centre plus `patchRadius`, not just the centre point) outside
 * every exclusion zone — falling back to the disc's own edge if it somehow
 * never finds one, same precedent as whaleController's own pickSurfacePoint.
 */
function pickPatchCenter(
  rng: Rng,
  zones: readonly WeatherExclusionZone[],
  roamRadius: number,
  patchRadius: number,
): { x: number; z: number } {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng()) * roamRadius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!isInsideAnyZone(x, z, zones, patchRadius)) return { x, z };
  }
  const angle = rng() * Math.PI * 2;
  return { x: Math.cos(angle) * roamRadius, z: Math.sin(angle) * roamRadius };
}

interface MistPuff {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
}

interface RainStreak {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  baseX: number;
  baseZ: number;
  fallOffset: number;
}

export function createWeatherController(host: WeatherHost, options: WeatherControllerOptions): WeatherControllerHandle {
  const rng = createRng(options.seed ?? 71104);
  const roamRadius = options.roamRadius ?? DEFAULT_ROAM_RADIUS;
  const zones = options.exclusionZones;

  const mistPuffs: MistPuff[] = [];
  for (let i = 0; i < MIST_PUFF_COUNT; i++) {
    const mesh = buildMistPuff();
    mesh.visible = false;
    host.scene.add(mesh);
    mistPuffs.push({ mesh, material: mesh.material as THREE.MeshStandardMaterial });
  }

  const rainStreaks: RainStreak[] = [];
  for (let i = 0; i < RAIN_STREAK_COUNT; i++) {
    const mesh = buildRainStreak(RAIN_STREAK_LENGTH);
    mesh.visible = false;
    host.scene.add(mesh);
    rainStreaks.push({ mesh, material: mesh.material as THREE.MeshBasicMaterial, baseX: 0, baseZ: 0, fallOffset: 0 });
  }

  let phase: Phase = "WAITING";
  let activeKind: WeatherKind | null = null;
  let phaseTimer = MIN_WAIT_SECONDS + rng() * (MAX_WAIT_SECONDS - MIN_WAIT_SECONDS);
  let activeElapsed = 0;
  let activeDuration = 0;
  let mistWind = { x: 0, z: 0 };

  function activateMist(): void {
    const center = pickPatchCenter(rng, zones, roamRadius, MIST_PATCH_RADIUS);
    const windAngle = rng() * Math.PI * 2;
    mistWind = { x: Math.cos(windAngle) * MIST_DRIFT_SPEED, z: Math.sin(windAngle) * MIST_DRIFT_SPEED };
    for (const puff of mistPuffs) {
      const offsetAngle = rng() * Math.PI * 2;
      const offsetRadius = rng() * MIST_PATCH_RADIUS;
      puff.mesh.position.set(center.x + Math.cos(offsetAngle) * offsetRadius, MIST_HEIGHT, center.z + Math.sin(offsetAngle) * offsetRadius);
      const scale = MIST_MIN_SCALE + rng() * MIST_SCALE_RANGE;
      puff.mesh.scale.set(scale, scale * MIST_FLATTEN, scale);
      puff.mesh.visible = true;
      puff.material.opacity = 0;
    }
  }

  function activateRain(): void {
    const center = pickPatchCenter(rng, zones, roamRadius, RAIN_PATCH_RADIUS);
    for (const streak of rainStreaks) {
      const offsetAngle = rng() * Math.PI * 2;
      const offsetRadius = Math.sqrt(rng()) * RAIN_PATCH_RADIUS;
      streak.baseX = center.x + Math.cos(offsetAngle) * offsetRadius;
      streak.baseZ = center.z + Math.sin(offsetAngle) * offsetRadius;
      streak.fallOffset = rng();
      streak.mesh.visible = true;
      streak.mesh.position.set(streak.baseX, RAIN_TOP_HEIGHT, streak.baseZ);
      streak.material.opacity = 0;
    }
  }

  function activate(): void {
    activeKind = rng() < 0.5 ? "MIST" : "RAIN";
    activeElapsed = 0;
    activeDuration = activeKind === "MIST" ? MIST_ACTIVE_SECONDS : RAIN_ACTIVE_SECONDS;
    phase = "ACTIVE";
    phaseTimer = activeDuration;
    if (activeKind === "MIST") activateMist();
    else activateRain();
  }

  function deactivate(): void {
    for (const puff of mistPuffs) puff.mesh.visible = false;
    for (const streak of rainStreaks) streak.mesh.visible = false;
    activeKind = null;
    phase = "WAITING";
    phaseTimer = MIN_WAIT_SECONDS + rng() * (MAX_WAIT_SECONDS - MIN_WAIT_SECONDS);
  }

  const unsubscribe = host.onBeforeRender((deltaSeconds) => {
    phaseTimer -= deltaSeconds;

    if (phase === "WAITING") {
      if (phaseTimer <= 0) activate();
      return;
    }

    activeElapsed += deltaSeconds;
    const fadeIn = Math.min(activeElapsed / FADE_SECONDS, 1);
    const fadeOut = Math.min(Math.max(phaseTimer, 0) / FADE_SECONDS, 1);
    const envelope = Math.max(Math.min(fadeIn, fadeOut), 0);

    if (activeKind === "MIST") {
      for (const puff of mistPuffs) {
        puff.mesh.position.x += mistWind.x * deltaSeconds;
        puff.mesh.position.z += mistWind.z * deltaSeconds;
        puff.material.opacity = MIST_MAX_OPACITY * envelope;
      }
    } else if (activeKind === "RAIN") {
      const fallSpan = RAIN_TOP_HEIGHT - SEA_LEVEL_Y;
      for (const streak of rainStreaks) {
        streak.fallOffset = (streak.fallOffset + (deltaSeconds * RAIN_FALL_SPEED) / fallSpan) % 1;
        streak.mesh.position.y = RAIN_TOP_HEIGHT - streak.fallOffset * fallSpan;
        streak.material.opacity = RAIN_MAX_OPACITY * envelope;
      }
    }

    if (phaseTimer <= 0) deactivate();
  });

  return {
    dispose() {
      unsubscribe();
      for (const puff of mistPuffs) host.scene.remove(puff.mesh);
      for (const streak of rainStreaks) host.scene.remove(streak.mesh);
    },
  };
}
