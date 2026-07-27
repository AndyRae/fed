import * as THREE from "three";
import type { SimState } from "../core/types.ts";
import { buildCustoms } from "./customs.ts";
import { buildIsland } from "./island.ts";
import { islandGeometry } from "./layout.ts";
import { buildMainland } from "./mainland.ts";
import { buildSea } from "./sea.ts";

/**
 * Builds the whole static world from a SimState: sea, mainland, customs,
 * and one island per TRE. Reads SimState, never mutates it. See CLAUDE.md
 * "Architecture": `src/world` may read `SimState` but never mutates it.
 */
export function buildWorld(state: SimState): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.kind = "WORLD";

  group.add(buildSea());
  group.add(buildMainland());
  group.add(buildCustoms());

  state.tres.forEach((tre, index) => {
    const geometry = islandGeometry(tre.id, index, state.tres.length);
    group.add(buildIsland(geometry, tre));
  });

  return group;
}
