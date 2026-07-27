import { describe, expect, it } from "vitest";
import type { Vec3 } from "./layout.ts";
import { pointAlongPath } from "./pathInterpolation.ts";

describe("pointAlongPath", () => {
  const straight: readonly Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];

  it("returns the first point at t = 0", () => {
    expect(pointAlongPath(straight, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("returns the last point at t = 1", () => {
    expect(pointAlongPath(straight, 1)).toEqual({ x: 10, y: 0, z: 0 });
  });

  it("interpolates proportionally to arc length along a single segment", () => {
    const mid = pointAlongPath(straight, 0.5);
    expect(mid.x).toBeCloseTo(5, 5);
  });

  it("weights each segment by its own length, not by waypoint count", () => {
    // Two segments: a short one (length 1) then a long one (length 9). At
    // t = 0.5 (half the total arc length of 10), we should be exactly at
    // the boundary point (1, 0, 0), not halfway through the waypoint list.
    const uneven: readonly Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ];
    const midpoint = pointAlongPath(uneven, 0.1);
    expect(midpoint.x).toBeCloseTo(1, 5);
  });

  it("clamps t below 0 to the first point", () => {
    expect(pointAlongPath(straight, -1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("clamps t above 1 to the last point", () => {
    expect(pointAlongPath(straight, 2)).toEqual({ x: 10, y: 0, z: 0 });
  });

  it("handles a path with a single point", () => {
    const single: readonly Vec3[] = [{ x: 3, y: 1, z: 4 }];
    expect(pointAlongPath(single, 0)).toEqual({ x: 3, y: 1, z: 4 });
    expect(pointAlongPath(single, 1)).toEqual({ x: 3, y: 1, z: 4 });
  });

  it("interpolates through three dimensions and multiple segments correctly", () => {
    const path: readonly Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 10, z: 10 },
    ];
    // Total length 20; t = 0.75 -> 15 units in -> 5 units into the second segment.
    const point = pointAlongPath(path, 0.75);
    expect(point.x).toBeCloseTo(0, 5);
    expect(point.y).toBeCloseTo(10, 5);
    expect(point.z).toBeCloseTo(5, 5);
  });
});
