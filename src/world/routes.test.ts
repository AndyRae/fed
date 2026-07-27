import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { egressPath, ferryPath, islandGeometry, workflowPath } from "./layout.ts";
import { buildEgressRouteLine, buildFerryRouteLine, buildWorkflowRouteLine } from "./routes.ts";
import { ISLAND_HEIGHT } from "./island.ts";

function vertexCount(line: THREE.Line): number {
  return line.geometry.getAttribute("position").count;
}

function vertexAt(line: THREE.Line, index: number): { x: number; z: number } {
  const attr = line.geometry.getAttribute("position");
  return { x: attr.getX(index), z: attr.getZ(index) };
}

function vertexY(line: THREE.Line, index: number): number {
  return line.geometry.getAttribute("position").getY(index);
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

describe("buildWorkflowRouteLine", () => {
  const island = islandGeometry("tre-c", 2, 3);

  it("traces exactly the real workflow path, point for point", () => {
    const line = buildWorkflowRouteLine(island);
    const path = workflowPath(island);
    expect(vertexCount(line)).toBe(path.length);
    path.forEach((point, i) => {
      const v = vertexAt(line, i);
      expect(v.x).toBeCloseTo(point.x, 5);
      expect(v.z).toBeCloseTo(point.z, 5);
    });
  });

  it("is tagged as a pickable route, with the island it belongs to", () => {
    const line = buildWorkflowRouteLine(island);
    expect(line.userData.kind).toBe("WORKFLOW_ROUTE");
    expect(line.userData.treId).toBe("tre-c");
  });

  it("renders above the island's own terrain surface — unlike the sea-crossing routes, this one runs entirely over land and would otherwise sit underneath it, invisible and unpickable", () => {
    const line = buildWorkflowRouteLine(island);
    for (let i = 0; i < vertexCount(line); i++) {
      expect(vertexY(line, i)).toBeGreaterThan(ISLAND_HEIGHT);
    }
  });
});
