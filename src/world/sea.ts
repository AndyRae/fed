import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { SEA_LEVEL_Y } from "./layout.ts";

/** The whole open-water surface. Everything between trust zones is open water. */
const SEA_SIZE = 260;

export function buildSea(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.sea, roughness: 0.6, metalness: 0.1 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, SEA_LEVEL_Y, -10);
  mesh.userData.kind = "SEA";
  return mesh;
}
