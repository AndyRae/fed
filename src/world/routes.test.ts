import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { egressPath, ferryPath, islandGeometry } from "./layout.ts";
import { buildEgressRouteLine, buildFerryRouteLine } from "./routes.ts";

function vertexCount(line: THREE.Line): number {
  return line.geometry.getAttribute("position").count;
}

function vertexAt(line: THREE.Line, index: number): { x: number; z: number } {
  const attr = line.geometry.getAttribute("position");
  return { x: attr.getX(index), z: attr.getZ(index) };
}

describe("buildFerryRouteLine", () => {
  const island = islandGeometry("tre-a", 0, 3);

  it("traces exactly the real ferry path, point for point", () => {
    const line = buildFerryRouteLine(island);
    const path = ferryPath(island);
    expect(vertexCount(line)).toBe(path.length);
    path.forEach((point, i) => {
      const v = vertexAt(line, i);
      expect(v.x).toBeCloseTo(point.x, 5);
      expect(v.z).toBeCloseTo(point.z, 5);
    });
  });

  it("is tagged as a pickable route, with the island it belongs to", () => {
    const line = buildFerryRouteLine(island);
    expect(line.userData.kind).toBe("FERRY_ROUTE");
    expect(line.userData.treId).toBe("tre-a");
  });
});

describe("buildEgressRouteLine", () => {
  const island = islandGeometry("tre-b", 1, 3);

  it("traces exactly the real egress path, point for point", () => {
    const line = buildEgressRouteLine(island);
    const path = egressPath(island);
    expect(vertexCount(line)).toBe(path.length);
    path.forEach((point, i) => {
      const v = vertexAt(line, i);
      expect(v.x).toBeCloseTo(point.x, 5);
      expect(v.z).toBeCloseTo(point.z, 5);
    });
  });

  it("is tagged as a pickable route, with the island it belongs to", () => {
    const line = buildEgressRouteLine(island);
    expect(line.userData.kind).toBe("EGRESS_ROUTE");
    expect(line.userData.treId).toBe("tre-b");
  });
});
