import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { customsGeometry, SEA_LEVEL_Y } from "./layout.ts";

const HALL_HEIGHT = 2.2;

/**
 * The customs hall: outside every island, where sealed crates are held
 * until Gate 2 decides. The building itself is a neutral colour; the
 * amber marker is reserved for the human decision that happens inside it.
 */
export function buildCustoms(): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.kind = "CUSTOMS";

  const hall = new THREE.Mesh(
    new THREE.BoxGeometry(6, HALL_HEIGHT, 6),
    new THREE.MeshStandardMaterial({ color: theme.customs.hall, roughness: 0.8 }),
  );
  hall.position.set(customsGeometry.center.x, SEA_LEVEL_Y + HALL_HEIGHT / 2, customsGeometry.center.z);
  hall.userData.kind = "CUSTOMS_HALL";
  group.add(hall);

  const inspector = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: theme.gate.amber, roughness: 0.5 }),
  );
  inspector.position.set(customsGeometry.dock.x, SEA_LEVEL_Y + 1.1, customsGeometry.dock.z);
  inspector.userData.kind = "GATE2_INSPECTOR";
  group.add(inspector);

  return group;
}
