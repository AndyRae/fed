import { describe, expect, it } from "vitest";
import { easeInOutCubic, interpolatePose, lerpVec3 } from "./cameraTween.ts";
import type { CameraPoseVec } from "./cameraRig.ts";

describe("lerpVec3", () => {
  it("returns the start point at t = 0", () => {
    expect(lerpVec3({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("returns the end point at t = 1", () => {
    expect(lerpVec3({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }, 1)).toEqual({ x: 10, y: 20, z: 30 });
  });

  it("interpolates linearly in between", () => {
    expect(lerpVec3({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }, 0.5)).toEqual({ x: 5, y: 10, z: 15 });
  });
});

describe("easeInOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("is exactly 0.5 at the midpoint (symmetric easing)", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it("is monotonically non-decreasing across the range", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("eases in slower than linear near the start, and out slower near the end", () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe("interpolatePose", () => {
  const start: CameraPoseVec = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } };
  const end: CameraPoseVec = { position: { x: 10, y: 10, z: 10 }, target: { x: 4, y: 0, z: 0 } };

  it("returns the start pose exactly at t = 0", () => {
    expect(interpolatePose(start, end, 0)).toEqual(start);
  });

  it("returns the end pose exactly at t = 1", () => {
    expect(interpolatePose(start, end, 1)).toEqual(end);
  });

  it("eases both position and target together", () => {
    const mid = interpolatePose(start, end, 0.5);
    expect(mid.position).toEqual({ x: 5, y: 5, z: 5 });
    expect(mid.target).toEqual({ x: 2, y: 0, z: 0 });
  });
});
