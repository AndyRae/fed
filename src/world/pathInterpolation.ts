import type { Vec3 } from "./layout.ts";

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/**
 * A point t (0 to 1) of the way along a polyline, by arc length — not by
 * waypoint index, so uneven segment lengths (e.g. a short dock hop next to
 * a long open-water crossing) don't distort the pacing. Used to move
 * ferry/crate meshes along the real paths from `layout.ts`. Pure, no
 * three.js: this is geometry, not rendering.
 */
export function pointAlongPath(path: readonly Vec3[], t: number): Vec3 {
  if (path.length === 0) {
    throw new Error("pointAlongPath requires at least one waypoint");
  }
  if (path.length === 1) {
    return path[0]!;
  }

  const clampedT = Math.max(0, Math.min(1, t));

  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const length = distance(path[i]!, path[i + 1]!);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0) {
    return path[0]!;
  }

  let targetLength = clampedT * totalLength;
  for (let i = 0; i < segmentLengths.length; i++) {
    const length = segmentLengths[i]!;
    if (targetLength <= length || i === segmentLengths.length - 1) {
      const segmentT = length === 0 ? 0 : targetLength / length;
      return lerp(path[i]!, path[i + 1]!, Math.min(1, segmentT));
    }
    targetLength -= length;
  }

  return path[path.length - 1]!;
}
