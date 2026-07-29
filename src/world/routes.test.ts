import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { egressPath, ferryPath, islandGeometry, type Vec3, workflowPath } from "./layout.ts";
import { buildEgressRouteLine, buildFerryRouteLine, buildWorkflowRouteLine } from "./routes.ts";
import { GROUND_HEIGHT } from "./island.ts";

/** The track's underlying CurvePath, straight-segment endpoints in order — see routes.ts's buildCurvePath. */
function curveEndpoints(mesh: THREE.Mesh): { v1: THREE.Vector3; v2: THREE.Vector3 }[] {
  const geometry = mesh.geometry as THREE.TubeGeometry;
  const curvePath = geometry.parameters.path as THREE.CurvePath<THREE.Vector3>;
  return curvePath.curves.map((curve) => {
    const lineCurve = curve as THREE.LineCurve3;
    return { v1: lineCurve.v1, v2: lineCurve.v2 };
  });
}

function expectTracesPath(mesh: THREE.Mesh, path: readonly Vec3[], height: number): void {
  const segments = curveEndpoints(mesh);
  expect(segments).toHaveLength(path.length - 1);
  path.forEach((point, i) => {
    if (i < path.length - 1) {
      expect(segments[i]!.v1.x).toBeCloseTo(point.x, 5);
      expect(segments[i]!.v1.y).toBeCloseTo(point.y + height, 5);
      expect(segments[i]!.v1.z).toBeCloseTo(point.z, 5);
    }
    if (i > 0) {
      expect(segments[i - 1]!.v2.x).toBeCloseTo(point.x, 5);
      expect(segments[i - 1]!.v2.y).toBeCloseTo(point.y + height, 5);
      expect(segments[i - 1]!.v2.z).toBeCloseTo(point.z, 5);
    }
  });
}

describe("buildFerryRouteLine", () => {
  const island = islandGeometry("tre-a", 0, 3);

  it("traces exactly the real ferry path, straight segment for straight segment", () => {
    const line = buildFerryRouteLine(island);
    expectTracesPath(line, ferryPath(island), 0.9);
  });

  it("is tagged as a pickable route, with the island it belongs to", () => {
    const line = buildFerryRouteLine(island);
    expect(line.userData.kind).toBe("FERRY_ROUTE");
    expect(line.userData.treId).toBe("tre-a");
  });

  it("renders as a real, solid tube — a visible track, not a hairline", () => {
    const line = buildFerryRouteLine(island);
    const geometry = line.geometry as THREE.TubeGeometry;
    expect(geometry.parameters.radius).toBeGreaterThan(0.08);
    const material = line.material as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(false);
  });
});

describe("buildEgressRouteLine", () => {
  const island = islandGeometry("tre-b", 1, 3);

  it("traces exactly the real egress path, straight segment for straight segment", () => {
    const line = buildEgressRouteLine(island);
    expectTracesPath(line, egressPath(island), 0.9);
  });

  it("is tagged as a pickable route, with the island it belongs to", () => {
    const line = buildEgressRouteLine(island);
    expect(line.userData.kind).toBe("EGRESS_ROUTE");
    expect(line.userData.treId).toBe("tre-b");
  });
});

describe("buildWorkflowRouteLine", () => {
  const island = islandGeometry("tre-c", 2, 3);

  function pads(road: THREE.Group): THREE.Mesh[] {
    return road.children.filter((c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.CircleGeometry) as THREE.Mesh[];
  }
  function strips(road: THREE.Group): THREE.Mesh[] {
    return road.children.filter((c) => c instanceof THREE.Mesh && !(c.geometry instanceof THREE.CircleGeometry)) as THREE.Mesh[];
  }

  it("is a group, tagged as a pickable route, with the island it belongs to", () => {
    const road = buildWorkflowRouteLine(island);
    expect(road).toBeInstanceOf(THREE.Group);
    expect(road.userData.kind).toBe("WORKFLOW_ROUTE");
    expect(road.userData.treId).toBe("tre-c");
  });

  it("places a round pad at every waypoint of the real workflow path, in order — a real road on the ground, not a floating line", () => {
    const road = buildWorkflowRouteLine(island);
    const path = workflowPath(island);
    const roadPads = pads(road);
    expect(roadPads).toHaveLength(path.length);
    path.forEach((point, i) => {
      expect(roadPads[i]!.position.x).toBeCloseTo(point.x, 5);
      expect(roadPads[i]!.position.z).toBeCloseTo(point.z, 5);
      expect(roadPads[i]!.position.y).toBeGreaterThan(GROUND_HEIGHT);
    });
  });

  it("builds one flat strip per leg of the path, connecting consecutive waypoints", () => {
    const road = buildWorkflowRouteLine(island);
    const path = workflowPath(island);
    expect(strips(road)).toHaveLength(path.length - 1);
  });

  it("renders above the island's own terrain surface — unlike the sea-crossing routes, this one runs entirely over land and would otherwise sit underneath it, invisible and unpickable", () => {
    const road = buildWorkflowRouteLine(island);
    for (const strip of strips(road)) {
      const position = strip.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        expect(position.getY(i)).toBeGreaterThan(GROUND_HEIGHT);
      }
    }
  });

  it("is a plain, matte earthy road, not the glowing style the ferry/egress tracks use for real motion", () => {
    const road = buildWorkflowRouteLine(island);
    for (const mesh of [...pads(road), ...strips(road)]) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.emissive.getHex()).toBe(0x000000);
      expect(material.color.getHex()).toBe(theme.trust.workflow);
    }
  });
});
