import * as THREE from "three";
import type { Tre } from "../core/types.ts";
import { theme } from "../core/theme.ts";
import type { IslandGeometry } from "./layout.ts";
import { SEA_LEVEL_Y } from "./layout.ts";

const ISLAND_HEIGHT = 1.4;
const WALL_TUBE_RADIUS = 0.6;

/**
 * One island (TRE): a separate trust zone with a hard perimeter. The
 * wall is inviolable inward — nothing here ever suggests otherwise; the
 * dock is the one point where the island's own ferry may cross it.
 */
export function buildIsland(geometry: IslandGeometry, tre: Tre): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.kind = "TRE";
  group.userData.treId = tre.id;

  const land = new THREE.Mesh(
    new THREE.CylinderGeometry(geometry.wallRadius * 0.92, geometry.wallRadius, ISLAND_HEIGHT, 32),
    new THREE.MeshStandardMaterial({ color: theme.trust.island, roughness: 0.85 }),
  );
  land.position.set(geometry.center.x, SEA_LEVEL_Y + ISLAND_HEIGHT / 2, geometry.center.z);
  land.userData.kind = "ISLAND_LAND";
  land.userData.treId = tre.id;
  group.add(land);

  const wall = new THREE.Mesh(
    new THREE.TorusGeometry(geometry.wallRadius, WALL_TUBE_RADIUS, 8, 48),
    new THREE.MeshStandardMaterial({ color: theme.trust.wall, roughness: 0.9 }),
  );
  wall.rotation.x = Math.PI / 2;
  wall.position.set(geometry.center.x, SEA_LEVEL_Y + ISLAND_HEIGHT + WALL_TUBE_RADIUS, geometry.center.z);
  wall.userData.kind = "ISLAND_WALL";
  wall.userData.treId = tre.id;
  group.add(wall);

  const vault = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4, 0),
    new THREE.MeshStandardMaterial({ color: theme.vault.reserved, roughness: 0.5, metalness: 0.2 }),
  );
  vault.position.set(geometry.vault.x, SEA_LEVEL_Y + ISLAND_HEIGHT + 1.4, geometry.vault.z);
  vault.userData.kind = "VAULT";
  vault.userData.treId = tre.id;
  group.add(vault);

  const workshop = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2.4, 3),
    new THREE.MeshStandardMaterial({ color: theme.trust.workshop, roughness: 0.7 }),
  );
  workshop.position.set(geometry.workshop.x, SEA_LEVEL_Y + ISLAND_HEIGHT + 1.2, geometry.workshop.z);
  workshop.userData.kind = "WORKSHOP";
  workshop.userData.treId = tre.id;
  group.add(workshop);

  const harbourmasterOffice = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 2.6, 6),
    new THREE.MeshStandardMaterial({ color: theme.gate.amber, roughness: 0.5 }),
  );
  harbourmasterOffice.position.set(
    geometry.harbourmasterOffice.x,
    SEA_LEVEL_Y + ISLAND_HEIGHT + 1.3,
    geometry.harbourmasterOffice.z,
  );
  harbourmasterOffice.userData.kind = "GATE1_HARBOURMASTER";
  harbourmasterOffice.userData.treId = tre.id;
  group.add(harbourmasterOffice);

  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.4, 4),
    new THREE.MeshStandardMaterial({ color: theme.trust.ferry, roughness: 0.7 }),
  );
  dock.position.set(geometry.dock.x, SEA_LEVEL_Y + 0.2, geometry.dock.z);
  dock.userData.kind = "DOCK";
  dock.userData.treId = tre.id;
  group.add(dock);

  return group;
}
