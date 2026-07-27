import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Vec3 } from "../world/layout.ts";
import { interpolatePose } from "./cameraTween.ts";
import type { Engine } from "./renderer.ts";

export interface CameraPoseVec {
  readonly position: Vec3;
  readonly target: Vec3;
}

/**
 * Wraps the camera and its controls behind a pose-based API. Free-roam uses
 * the underlying OrbitControls; there is no auto-rotate — motion carries
 * meaning, and idle camera drift is not part of the protocol. See CLAUDE.md
 * "Visual language".
 */
export interface CameraRig {
  readonly controls: OrbitControls;
  getPose(): CameraPoseVec;
  /** Instant cut. Used for the initial pose; flyTo falls back to this under prefers-reduced-motion. */
  setPose(pose: CameraPoseVec): void;
  /**
   * Animates from the current pose to `pose` over `durationSeconds` of real
   * time, easing position and target together. Falls back to an instant
   * setPose when the viewer has requested reduced motion, or when duration
   * is 0 — tours must stay completable with instant cuts either way, per
   * CLAUDE.md "Visual language".
   */
  flyTo(pose: CameraPoseVec, durationSeconds: number): void;
}

function vec3From(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function createCameraRig(engine: Engine): CameraRig {
  const controls = new OrbitControls(engine.camera, engine.renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false;
  controls.minDistance = 4;
  controls.maxDistance = 110;
  controls.maxPolarAngle = Math.PI * 0.49;

  engine.onBeforeRender(() => controls.update());

  function getPose(): CameraPoseVec {
    return { position: vec3From(engine.camera.position), target: vec3From(controls.target) };
  }

  function setPose(pose: CameraPoseVec): void {
    engine.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    controls.target.set(pose.target.x, pose.target.y, pose.target.z);
    controls.update();
  }

  let cancelFlight: (() => void) | null = null;

  function flyTo(pose: CameraPoseVec, durationSeconds: number): void {
    cancelFlight?.();
    cancelFlight = null;

    if (durationSeconds <= 0 || prefersReducedMotion()) {
      setPose(pose);
      return;
    }

    const start = getPose();
    let elapsed = 0;
    const unsubscribe = engine.onBeforeRender((deltaSeconds) => {
      elapsed += deltaSeconds;
      const t = Math.min(1, elapsed / durationSeconds);
      setPose(interpolatePose(start, pose, t));
      if (t >= 1) {
        unsubscribe();
        cancelFlight = null;
      }
    });
    cancelFlight = unsubscribe;
  }

  return { controls, getPose, setPose, flyTo };
}
