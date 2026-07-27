import * as THREE from "three";
import { theme } from "../core/theme.ts";
import type { TreId } from "../core/types.ts";
import { egressPath, ferryPath, type IslandGeometry, type Vec3, workflowPath } from "./layout.ts";
import { ISLAND_HEIGHT } from "./island.ts";

/**
 * Above the sea surface — reads like a shipping lane marked on a chart,
 * not the exact altitude a ferry or crate travels at. High enough that a
 * ray toward the line and a ray toward the sea plane underneath it
 * resolve to clearly different hit distances, so the line is reliably
 * the nearer (and thus pickable) hit rather than a coin-flip against the
 * sea a hair's-width beneath it. Only clears sea level (y = 0) — fine for
 * the ferry and egress routes, which spend almost their entire length
 * over open water.
 */
const SEA_ROUTE_HEIGHT = 0.9;

/**
 * The workflow route runs entirely over an island's own landmass, whose
 * terrain surface sits at ISLAND_HEIGHT, not sea level — SEA_ROUTE_HEIGHT
 * alone would render (and raycast) this line underneath the ground,
 * invisible and unpickable. Clears the terrain with the same margin
 * SEA_ROUTE_HEIGHT gives above the sea.
 */
const ISLAND_ROUTE_HEIGHT = ISLAND_HEIGHT + SEA_ROUTE_HEIGHT;

function buildRouteLine(path: readonly Vec3[], color: number, treId: TreId, kind: string, height: number): THREE.Line {
  const points = path.map((p) => new THREE.Vector3(p.x, p.y + height, p.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 0.9, transparent: true, opacity: 0.75 });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  line.userData.kind = kind;
  line.userData.treId = treId;
  return line;
}

/** A visible, clickable outline of this island's ferry route — the physical claim of honesty rule 1, drawn as a line you can inspect. */
export function buildFerryRouteLine(island: IslandGeometry): THREE.Line {
  return buildRouteLine(ferryPath(island), theme.trust.ferry, island.treId, "FERRY_ROUTE", SEA_ROUTE_HEIGHT);
}

/** A visible, clickable outline of this island's egress route, coloured to match the crate that travels it. */
export function buildEgressRouteLine(island: IslandGeometry): THREE.Line {
  return buildRouteLine(egressPath(island), theme.crate.body, island.treId, "EGRESS_ROUTE", SEA_ROUTE_HEIGHT);
}

/**
 * A visible, clickable outline of how a task actually moves through this
 * island: Gate 1 → the workshop → this island's own Gate 2. Purely
 * informational — nothing rides along it — so it gets its own neutral
 * colour rather than reusing a role tied to a thing that actually moves
 * (the ferry, the crate). The vault is deliberately not on this path — see
 * `workflowPath` in layout.ts. Unlike the other two routes, this one runs
 * entirely over the island's own landmass, so it needs ISLAND_ROUTE_HEIGHT
 * rather than SEA_ROUTE_HEIGHT to clear the terrain.
 */
export function buildWorkflowRouteLine(island: IslandGeometry): THREE.Line {
  return buildRouteLine(workflowPath(island), theme.trust.workflow, island.treId, "WORKFLOW_ROUTE", ISLAND_ROUTE_HEIGHT);
}
