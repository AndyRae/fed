import * as THREE from "three";
import type { SimState, Tre, TreId } from "../core/types.ts";
import { buildIsland } from "./island.ts";
import { islandGeometry, type IslandGeometry } from "./layout.ts";
import { buildMainland } from "./mainland.ts";
import { buildEgressRouteLine, buildFerryRouteLine, buildWorkflowRouteLine } from "./routes.ts";
import { buildSea } from "./sea.ts";

/**
 * The single source of truth for where each TRE's island actually sits,
 * derived from an ordered TRE list. buildWorld and anything else that
 * needs island positions (the flow controller, for instance) must call
 * this rather than re-deriving index-based placement separately, so they
 * can never drift apart.
 */
export function computeIslandGeometries(tres: readonly Tre[]): ReadonlyMap<TreId, IslandGeometry> {
  const geometries = new Map<TreId, IslandGeometry>();
  tres.forEach((tre, index) => {
    geometries.set(tre.id, islandGeometry(tre.id, index, tres.length));
  });
  return geometries;
}

/**
 * Builds the whole static world from a SimState: sea, mainland, and one
 * island per TRE — each island carrying its own customs hall, since there
 * is no shared or central one. Reads SimState, never mutates it. See
 * CLAUDE.md "Architecture": `src/world` may read `SimState` but never
 * mutates it.
 */
export function buildWorld(state: SimState): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.kind = "WORLD";

  group.add(buildSea());
  group.add(buildMainland());

  const islandGeometries = computeIslandGeometries(state.tres);
  for (const tre of state.tres) {
    const geometry = islandGeometries.get(tre.id)!;
    group.add(buildIsland(geometry, tre));
    group.add(buildFerryRouteLine(geometry));
    group.add(buildEgressRouteLine(geometry));
    group.add(buildWorkflowRouteLine(geometry));
  }

  return group;
}
