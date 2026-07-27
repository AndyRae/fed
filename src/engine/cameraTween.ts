import type { Vec3 } from "../world/layout.ts";
import type { CameraPoseVec } from "./cameraRig.ts";

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Symmetric ease in/out: slow at both ends, fastest through the middle. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Eases both position and target together, so a camera flight never has its look point arrive before (or after) the camera itself. */
export function interpolatePose(start: CameraPoseVec, end: CameraPoseVec, t: number): CameraPoseVec {
  const eased = easeInOutCubic(t);
  return {
    position: lerpVec3(start.position, end.position, eased),
    target: lerpVec3(start.target, end.target, eased),
  };
}
