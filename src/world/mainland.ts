import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { createRng } from "../sim/rng.ts";
import { mainlandGeometry, SEA_LEVEL_Y } from "./layout.ts";

const MAINLAND_RADIUS = 16;
const MAINLAND_HEIGHT = 1.2;
const MAINLAND_SEED = 4200;

/** An irregular coastline, gentler than an island's — a broad shore, not a jagged isle. */
function buildMainlandLandGeometry(): THREE.BufferGeometry {
  const rng = createRng(MAINLAND_SEED);
  const pointCount = 12;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const radius = MAINLAND_RADIUS * (0.82 + rng() * 0.18);
    points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  const shape = new THREE.Shape(points);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: MAINLAND_HEIGHT,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.4,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** A handful of quay buildings, so the mainland reads as a small port rather than an empty disc. */
function buildQuayBuildings(): THREE.Object3D {
  const group = new THREE.Group();
  const rng = createRng(MAINLAND_SEED + 1);
  const buildingCount = 5;
  for (let i = 0; i < buildingCount; i++) {
    const angle = rng() * Math.PI * 2;
    const distance = MAINLAND_RADIUS * (0.25 + rng() * 0.45);
    const width = 1.6 + rng() * 1.4;
    const depth = 1.6 + rng() * 1.4;
    const height = 2 + rng() * 3.5;
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: theme.untrusted.mainlandAccent, roughness: 0.75 }),
    );
    building.position.set(
      mainlandGeometry.center.x + Math.cos(angle) * distance,
      SEA_LEVEL_Y + MAINLAND_HEIGHT + height / 2,
      mainlandGeometry.center.z + Math.sin(angle) * distance,
    );
    building.userData.kind = "MAINLAND_BUILDING";
    group.add(building);
  }
  return group;
}

/** The mainland: public-facing, untrusted, where the researcher submits work. Colour matches the sea's family, not the islands'. */
export function buildMainland(): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.kind = "MAINLAND";

  const land = new THREE.Mesh(
    buildMainlandLandGeometry(),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.mainland, roughness: 0.8 }),
  );
  land.position.set(mainlandGeometry.center.x, SEA_LEVEL_Y, mainlandGeometry.center.z);
  land.userData.kind = "MAINLAND_LAND";
  group.add(land);

  group.add(buildQuayBuildings());

  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.4, 7),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.mainland, roughness: 0.7 }),
  );
  dock.position.set(mainlandGeometry.quayDock.x, SEA_LEVEL_Y + 0.2, mainlandGeometry.quayDock.z);
  dock.userData.kind = "MAINLAND_DOCK";
  group.add(dock);

  // Invisible — no geometry, so it's never raycast-pickable itself — just
  // an elevated anchor for the mainland's own floating label.
  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(mainlandGeometry.center.x, SEA_LEVEL_Y + MAINLAND_HEIGHT + 8, mainlandGeometry.center.z);
  labelAnchor.userData.kind = "MAINLAND_LABEL_ANCHOR";
  group.add(labelAnchor);

  return group;
}
