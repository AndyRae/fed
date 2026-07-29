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
 * the underlying OrbitControls. `controls.autoRotate` drives the gentle
 * orbiting overview camera (main.ts's HUD toggle, on by default) — a
 * presentation choice about how the viewer looks at the world, not motion
 * inside it, so it sits outside CLAUDE.md "Visual language"'s rule that
 * protocol motion carries meaning: it never touches a ferry, a crate, or
 * any SimState. main.ts is responsible for turning it off the moment the
 * viewer takes the camera themselves, and for suspending it during tours,
 * which drive the camera their own way.
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
  // A full orbit takes about two minutes — gentle enough to read as ambient
  // background motion, not a ride. main.ts toggles `autoRotate` itself;
  // this is only the speed it moves at once that's on.
  controls.autoRotateSpeed = 0.5;
  controls.minDistance = 4;
  // Room enough for main.ts's overviewPoseForRingRadius to pull the camera
  // back far enough to frame the widest island crescent (see IDEAS.md
  // "Toggle how many islands there are") without this clamping it back in.
  controls.maxDistance = 140;
  controls.maxPolarAngle = Math.PI * 0.49;

  // Google Maps convention, not CAD convention — see PGSimCity's own
  // camera.ts (https://github.com/NikolayS/PGSimCity), the source this is
  // ported from. This reads as a world seen from above, so left-drag grabs
  // the ground and moves it — the thing every map does — rather than
  // orbiting around a fixed point, which feels backwards for exploring a
  // place. Right-drag rotates; middle-drag still dollies. OrbitControls
  // already swaps left-drag to rotate whenever shift/ctrl/meta is held (see
  // its onMouseDown), so that alias comes for free and needs no extra code.
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  // Dolly toward the cursor ray, not toward whatever `target` happens to be
  // — PGSimCity's own comment calls this "the single biggest quality-of-
  // life difference from a plain distance zoom", and it is: without it,
  // scrolling to zoom in on something off-centre instead zooms in on the
  // middle of the screen and drags the thing you wanted further away.
  controls.zoomToCursor = true;

  // Passing deltaSeconds makes autoRotate's own speed frame-rate
  // independent; damping (above) already applies its factor per call
  // regardless of dt, so this doesn't change existing damping feel.
  engine.onBeforeRender((deltaSeconds) => controls.update(deltaSeconds));

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
