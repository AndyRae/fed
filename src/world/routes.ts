import * as THREE from "three";
import { theme } from "../core/theme.ts";
import type { TreId } from "../core/types.ts";
import { egressPath, ferryPath, type IslandGeometry, type Vec3, workflowPath } from "./layout.ts";
import { GROUND_HEIGHT } from "./island.ts";

/**
 * Above the sea surface — reads like a shipping lane marked on a chart,
 * not the exact altitude a ferry or crate travels at. High enough that a
 * ray toward the track and a ray toward the sea plane underneath it
 * resolve to clearly different hit distances, so the track is reliably
 * the nearer (and thus pickable) hit rather than a coin-flip against the
 * sea a hair's-width beneath it. Only clears sea level (y = 0) — fine for
 * the ferry and egress routes, which spend almost their entire length
 * over open water.
 */
const SEA_ROUTE_HEIGHT = 0.9;

const TRACK_RADIAL_SEGMENTS = 8;
const TUBULAR_SEGMENTS_PER_LEG = 6;
// A little more gentle than a first pass had it (0.22) — thin enough that
// the ferry and egress tracks read as lanes on a chart rather than
// dominating the view between mainland and island.
const PHYSICAL_TRACK_RADIUS = 0.14;

function toVector3(point: Vec3, height: number): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y + height, point.z);
}

/** A CurvePath of straight segments through every waypoint, in order — the tube follows the exact polyline, never bowing away from it the way a smoothed spline would. */
function buildCurvePath(path: readonly Vec3[], height: number): THREE.CurvePath<THREE.Vector3> {
  const curvePath = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < path.length - 1; i++) {
    curvePath.add(new THREE.LineCurve3(toVector3(path[i]!, height), toVector3(path[i + 1]!, height)));
  }
  return curvePath;
}

/**
 * A real tube with visible thickness, not a hairline — modelled on
 * PGSimCity's data tracks. The ferry and egress routes are things a ferry
 * or a crate actually rides, so they render solid and lit from within (a
 * bit of emissive glow) to read as "live conduits".
 */
function buildTrack(path: readonly Vec3[], height: number, color: number, kind: string, treId: TreId): THREE.Mesh {
  const curvePath = buildCurvePath(path, height);
  const tubularSegments = Math.max(1, path.length - 1) * TUBULAR_SEGMENTS_PER_LEG;
  const geometry = new THREE.TubeGeometry(curvePath, tubularSegments, PHYSICAL_TRACK_RADIUS, TRACK_RADIAL_SEGMENTS, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.kind = kind;
  mesh.userData.treId = treId;
  return mesh;
}

/** A visible, clickable track of this island's ferry route — the physical claim of honesty rule 1, drawn as a track you can inspect. */
export function buildFerryRouteLine(island: IslandGeometry): THREE.Mesh {
  return buildTrack(ferryPath(island), SEA_ROUTE_HEIGHT, theme.trust.ferry, "FERRY_ROUTE", island.treId);
}

/** A visible, clickable track of this island's egress route, coloured to match the crate that travels it. */
export function buildEgressRouteLine(island: IslandGeometry): THREE.Mesh {
  return buildTrack(egressPath(island), SEA_ROUTE_HEIGHT, theme.crate.body, "EGRESS_ROUTE", island.treId);
}

// --- The on-island workflow road ----------------------------------------
//
// Ferries and crates are real things travelling real routes, so they get
// glowing "tracks" above the ground. The workflow path is different in
// kind, not just in emphasis: honesty rule 4 and workflowPath's own doc
// comment are explicit that nothing ever rides it. A flat dirt road lying
// on the terrain says that plainly — it is a real place on the island (you
// could draw it on a map, walk it between the office, the workshop, and
// the customs hall), but it has never been rendered as a conduit anything
// moves along. The vault is deliberately not on this path — see
// `workflowPath` in layout.ts.

const ROAD_WIDTH = 1.3;
/**
 * Just above the terrain's real flat surface (GROUND_HEIGHT — not
 * ISLAND_HEIGHT alone, which is the land mesh's nominal extrude depth
 * before its bevel adds another 0.35 on top; see island.ts). Getting this
 * wrong once already: a first pass measured from ISLAND_HEIGHT and the
 * road ended up entirely beneath the terrain's actual bevelled top,
 * invisible from every normal camera angle. 0.08 clears that real surface
 * with enough margin that the two don't z-fight at this world's usual
 * viewing distances, while still reading as "on the ground", not floating.
 */
const ROAD_HEIGHT = GROUND_HEIGHT + 0.08;
const ROAD_PAD_SEGMENTS = 16;

/** One straight, flat quad from `a` to `b`, `width` wide, lying at a fixed height — a paved-strip building block, not a tube. */
function buildRoadSegment(a: Vec3, b: Vec3, width: number, height: number, material: THREE.Material): THREE.Mesh | null {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return null;
  const nx = (-dz / length) * (width / 2);
  const nz = (dx / length) * (width / 2);
  const positions = new Float32Array([
    a.x + nx, height, a.z + nz,
    a.x - nx, height, a.z - nz,
    b.x - nx, height, b.z - nz,
    b.x + nx, height, b.z + nz,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  // Wound so the computed normal faces +Y (up) — verified by hand: with a
  // segment heading +X, this order gives a cross product of (0,1,0), not
  // (0,-1,0). Getting this backwards silently culls the whole road from
  // every normal, above-looking camera angle.
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

/**
 * A visible, clickable road tracing how a task actually moves through this
 * island: Gate 1 → the workshop → this island's own Gate 2. A flat strip
 * per leg, with a small round pad at each waypoint so the road reads as one
 * continuous path through the turn at the workshop rather than two strips
 * that merely meet at a point. Every part shares one untagged-children
 * pattern with the rest of this island's buildings: the group itself
 * carries `userData.kind`, so a click anywhere on the road resolves to
 * WORKFLOW_ROUTE via findPickableAncestor's parent walk.
 */
export function buildWorkflowRouteLine(island: IslandGeometry): THREE.Group {
  const path = workflowPath(island);
  // DoubleSide as a safety net: a flat ground-hugging strip should never
  // depend on being viewed from exactly one side to stay visible.
  const material = new THREE.MeshStandardMaterial({ color: theme.trust.workflow, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const group = new THREE.Group();

  for (let i = 0; i < path.length - 1; i++) {
    const segment = buildRoadSegment(path[i]!, path[i + 1]!, ROAD_WIDTH, ROAD_HEIGHT, material);
    if (segment) group.add(segment);
  }

  const padGeometry = new THREE.CircleGeometry(ROAD_WIDTH * 0.55, ROAD_PAD_SEGMENTS);
  for (const point of path) {
    const pad = new THREE.Mesh(padGeometry, material);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(point.x, ROAD_HEIGHT, point.z);
    group.add(pad);
  }

  group.userData.kind = "WORKFLOW_ROUTE";
  group.userData.treId = island.treId;
  return group;
}
