import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { SEA_LEVEL_Y } from "./layout.ts";

/** The whole open-water surface. Everything between trust zones is open water. */
const SEA_SIZE = 260;

/**
 * A calm, flat expanse of open water — the sea is the backdrop the whole
 * world sits in, so it must read as a plain, uncluttered surface, not a
 * distraction. High roughness and no metalness keep it a soft matte plane
 * rather than a hard reflective one.
 */
export function buildSea(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: theme.untrusted.sea, roughness: 0.85, metalness: 0 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, SEA_LEVEL_Y, -10);
  mesh.userData.kind = "SEA";
  return mesh;
}
