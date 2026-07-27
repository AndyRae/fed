import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Vec3 } from "../world/layout.ts";
import type { Engine } from "./renderer.ts";

export interface CameraPoseVec {
  readonly position: Vec3;
  readonly target: Vec3;
}

/**
 * Wraps the camera and its controls behind a pose-based API, so tours can
 * later drive the camera by calling setPose rather than reaching into
 * three.js directly. Free-roam uses the underlying OrbitControls; there is
 * no auto-rotate — motion carries meaning, and idle camera drift is not
 * part of the protocol. See CLAUDE.md "Visual language".
 */
export interface CameraRig {
  readonly controls: OrbitControls;
  getPose(): CameraPoseVec;
  /** Instant cut for now; smooth cinematic transitions between tour stops are a later addition. */
  setPose(pose: CameraPoseVec): void;
}

function vec3From(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function createCameraRig(engine: Engine): CameraRig {
  const controls = new OrbitControls(engine.camera, engine.renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false;
  controls.minDistance = 8;
  controls.maxDistance = 220;
  controls.maxPolarAngle = Math.PI * 0.49;

  engine.onBeforeRender(() => controls.update());

  return {
    controls,
    getPose() {
      return { position: vec3From(engine.camera.position), target: vec3From(controls.target) };
    },
    setPose(pose: CameraPoseVec) {
      engine.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      controls.target.set(pose.target.x, pose.target.y, pose.target.z);
      controls.update();
    },
  };
}
