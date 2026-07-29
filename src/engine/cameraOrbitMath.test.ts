import { describe, expect, it } from "vitest";
import { dollyPosition, orbitPosition } from "./cameraOrbitMath.ts";

const TARGET = { x: 0, y: 0, z: 0 };

function distanceFromTarget(p: { x: number; y: number; z: number }): number {
  return Math.hypot(p.x - TARGET.x, p.y - TARGET.y, p.z - TARGET.z);
}

function polarAngle(position: { x: number; y: number; z: number }): number {
  const offset = { x: position.x - TARGET.x, y: position.y - TARGET.y, z: position.z - TARGET.z };
  return Math.acos(offset.y / Math.hypot(offset.x, offset.y, offset.z));
}

describe("orbitPosition", () => {
  it("preserves distance from target — orbiting never zooms", () => {
    const position = { x: 0, y: 5, z: 10 };
    const before = distanceFromTarget(position);
    const after = orbitPosition(position, TARGET, 0.4, 0, 0, Math.PI * 0.49);
    expect(distanceFromTarget(after)).toBeCloseTo(before, 8);
  });

  it("actually moves the camera when given a nonzero azimuth delta", () => {
    const position = { x: 0, y: 5, z: 10 };
    const after = orbitPosition(position, TARGET, 0.4, 0, 0, Math.PI * 0.49);
    expect(after.x).not.toBeCloseTo(position.x, 5);
  });

  it("azimuth deltas in opposite directions move the camera in opposite directions", () => {
    const position = { x: 0, y: 5, z: 10 };
    const left = orbitPosition(position, TARGET, -0.3, 0, 0, Math.PI * 0.49);
    const right = orbitPosition(position, TARGET, 0.3, 0, 0, Math.PI * 0.49);
    expect(left.x).not.toBeCloseTo(right.x, 5);
  });

  it("clamps the polar angle at the maximum, however large the nudge", () => {
    const position = { x: 0, y: 1, z: 10 };
    const maxPolarAngle = Math.PI * 0.49;
    const after = orbitPosition(position, TARGET, 0, 10, 0, maxPolarAngle);
    expect(polarAngle(after)).toBeLessThanOrEqual(maxPolarAngle + 1e-6);
  });

  it("clamps the polar angle at the minimum, however large the nudge", () => {
    const position = { x: 0, y: 10, z: 0.001 };
    const after = orbitPosition(position, TARGET, 0, -10, 0.1, Math.PI * 0.49);
    expect(polarAngle(after)).toBeGreaterThanOrEqual(0.1 - 1e-6);
  });

  it("a small nudge stays within bounds and actually changes the polar angle", () => {
    const position = { x: 0, y: 5, z: 10 };
    const before = polarAngle(position);
    const after = orbitPosition(position, TARGET, 0, 0.2, 0, Math.PI * 0.49);
    expect(polarAngle(after)).not.toBeCloseTo(before, 5);
    expect(polarAngle(after)).toBeLessThanOrEqual(Math.PI * 0.49 + 1e-6);
  });
});

describe("dollyPosition", () => {
  it("zooms out when scaleFactor > 1", () => {
    const position = { x: 0, y: 5, z: 10 };
    const before = distanceFromTarget(position);
    const after = dollyPosition(position, TARGET, 1.5, 1, 200);
    expect(distanceFromTarget(after)).toBeCloseTo(before * 1.5, 6);
  });

  it("zooms in when scaleFactor < 1", () => {
    const position = { x: 0, y: 5, z: 10 };
    const before = distanceFromTarget(position);
    const after = dollyPosition(position, TARGET, 0.5, 1, 200);
    expect(distanceFromTarget(after)).toBeCloseTo(before * 0.5, 6);
  });

  it("never zooms in past minDistance", () => {
    const position = { x: 0, y: 0, z: 5 };
    const after = dollyPosition(position, TARGET, 0.01, 4, 200);
    expect(distanceFromTarget(after)).toBeCloseTo(4, 6);
  });

  it("never zooms out past maxDistance", () => {
    const position = { x: 0, y: 0, z: 50 };
    const after = dollyPosition(position, TARGET, 100, 1, 140);
    expect(distanceFromTarget(after)).toBeCloseTo(140, 6);
  });

  it("preserves direction from target — dolly changes only distance, never viewing angle", () => {
    const position = { x: 3, y: 4, z: 0 }; // distance 5
    const after = dollyPosition(position, TARGET, 2, 1, 200);
    const afterDistance = distanceFromTarget(after);
    expect(after.x / afterDistance).toBeCloseTo(position.x / 5, 6);
    expect(after.y / afterDistance).toBeCloseTo(position.y / 5, 6);
    expect(after.z / afterDistance).toBeCloseTo(position.z / 5, 6);
  });
});
