import * as THREE from "three";
import type { Vec3 } from "../world/layout.ts";

/**
 * The pure spherical-coordinate math behind cameraRig.ts's own orbitBy/
 * dollyBy — factored out so it can be unit tested without a WebGL context,
 * same precedent as cameraTween.ts: three.js's Vector3/Spherical are plain
 * math, not renderer state. Mirrors what OrbitControls itself does
 * internally for RMB-drag rotate and wheel zoom, so a keyboard nudge is
 * clamped to the exact same bounds a drag already is.
 */

function offsetFrom(position: Vec3, target: Vec3): THREE.Vector3 {
  return new THREE.Vector3(position.x - target.x, position.y - target.y, position.z - target.z);
}

function positionFrom(target: Vec3, offset: THREE.Vector3): Vec3 {
  return { x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z };
}

/** Rotates `position` around `target` by the given azimuth/polar deltas (radians), clamping the resulting polar angle to `[minPolarAngle, maxPolarAngle]` — never changes the distance from `target`. */
export function orbitPosition(
  position: Vec3,
  target: Vec3,
  deltaAzimuth: number,
  deltaPolar: number,
  minPolarAngle: number,
  maxPolarAngle: number,
): Vec3 {
  const offset = offsetFrom(position, target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += deltaAzimuth;
  spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi + deltaPolar));
  spherical.makeSafe();
  offset.setFromSpherical(spherical);
  return positionFrom(target, offset);
}

/** Moves `position` toward or away from `target` by a multiplicative `scaleFactor` (>1 zooms out, <1 zooms in), clamping the resulting distance to `[minDistance, maxDistance]` — never changes direction, only distance. */
export function dollyPosition(position: Vec3, target: Vec3, scaleFactor: number, minDistance: number, maxDistance: number): Vec3 {
  const offset = offsetFrom(position, target);
  const nextDistance = Math.max(minDistance, Math.min(maxDistance, offset.length() * scaleFactor));
  offset.setLength(nextDistance);
  return positionFrom(target, offset);
}
