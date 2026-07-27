import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { mainlandGeometry, SEA_LEVEL_Y } from "./layout.ts";

const MAINLAND_RADIUS = 16;
const MAINLAND_HEIGHT = 1.2;

/** The mainland: public-facing, untrusted, where the researcher submits work. Colour matches the sea's family, not the islands'. */
export function buildMainland(): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.kind = "MAINLAND";

  const land = new THREE.Mesh(
    new THREE.CylinderGeometry(MAINLAND_RADIUS, MAINLAND_RADIUS * 1.1, MAINLAND_HEIGHT, 24),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.mainland, roughness: 0.8 }),
  );
  land.position.set(mainlandGeometry.center.x, SEA_LEVEL_Y + MAINLAND_HEIGHT / 2, mainlandGeometry.center.z);
  land.userData.kind = "MAINLAND_LAND";
  group.add(land);

  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.mainland, roughness: 0.7 }),
  );
  dock.position.set(mainlandGeometry.quayDock.x, SEA_LEVEL_Y + 0.2, mainlandGeometry.quayDock.z);
  dock.userData.kind = "MAINLAND_DOCK";
  group.add(dock);

  return group;
}
