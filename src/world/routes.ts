import * as THREE from "three";
import { theme } from "../core/theme.ts";
import type { TreId } from "../core/types.ts";
import { egressPath, ferryPath, type IslandGeometry, type Vec3 } from "./layout.ts";

/** Just above the sea surface — reads like a shipping lane marked on a chart, not the exact altitude a ferry or crate flies at. */
const ROUTE_HEIGHT = 0.15;

function buildRouteLine(path: readonly Vec3[], color: number, treId: TreId, kind: string): THREE.Line {
  const points = path.map((p) => new THREE.Vector3(p.x, p.y + ROUTE_HEIGHT, p.z));
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
  return buildRouteLine(ferryPath(island), theme.trust.ferry, island.treId, "FERRY_ROUTE");
}

/** A visible, clickable outline of this island's egress route, coloured to match the crate that travels it. */
export function buildEgressRouteLine(island: IslandGeometry): THREE.Line {
  return buildRouteLine(egressPath(island), theme.crate.body, island.treId, "EGRESS_ROUTE");
}
