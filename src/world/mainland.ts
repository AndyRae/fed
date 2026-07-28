import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { createRng } from "../sim/rng.ts";
import { mainlandGeometry, SEA_LEVEL_Y } from "./layout.ts";

export const MAINLAND_RADIUS = 16;
/** The land mesh's nominal extrude depth — see buildMainlandLandGeometry. Not, by itself, the height of the terrain's actual flat top surface; see MAINLAND_GROUND_HEIGHT below for that. */
const MAINLAND_HEIGHT = 1.2;
/** ExtrudeGeometry's bevel adds this much height again on top of `depth` (see buildMainlandLandGeometry's bevelThickness) — same bug class as ISLAND_HEIGHT/GROUND_HEIGHT in island.ts, fixed here the same way. */
const LAND_BEVEL_THICKNESS = 0.4;
/**
 * The actual height of the mainland's flat, walkable surface — what the
 * plaza and every building must sit on to avoid ending up embedded in the
 * bevel and invisible. Exported for src/engine/flowController.ts: the
 * submission's own trip from the researcher quarter crosses this same
 * raised plateau (unlike the dock, which is a separate, low jetty out at
 * sea level), so it needs to clear this height too.
 */
export const MAINLAND_GROUND_HEIGHT = MAINLAND_HEIGHT + LAND_BEVEL_THICKNESS;
const MAINLAND_SEED = 4200;

/**
 * The largest radius any decoration may extend from the mainland's own
 * centre and be guaranteed to stay on solid ground, whatever the random
 * coastline's exact shape turns out to be. `0.82` is the hard minimum
 * multiplier buildMainlandLandGeometry ever draws for one of its 12 sample
 * points; two adjacent points at exactly that minimum, 30° apart, connect
 * with a straight edge whose closest point to the centre is `cos(15°)`
 * closer still — that's the true worst case, not just the sample points
 * themselves. Exported so mainland.test.ts can hold every decoration to
 * this bound directly, rather than the bound and the decorations' own
 * radii silently drifting apart the way they did the first time (see the
 * commit that added this constant).
 */
export const MAINLAND_SAFE_INTERIOR_RADIUS = MAINLAND_RADIUS * 0.82 * Math.cos(Math.PI / 12) - 0.5;

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
    bevelThickness: LAND_BEVEL_THICKNESS,
    bevelSize: 0.4,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// Both radii, plus researcherQuarter's own distance from the mainland
// centre (see layout.ts) and each building's own footprint, must stay
// within MAINLAND_SAFE_INTERIOR_RADIUS — see mainland.test.ts's coastline
// bound tests, which measure the actual built geometry rather than trust
// these numbers by inspection.
const QUARTER_RADIUS = 4;
const PLAZA_RADIUS = 6;

/**
 * A paved plaza under the researcher quarter — stone, not grass, so even
 * the ground itself reads as urban here, distinct from the sandy coastline
 * ringing every island. An untagged child of the land mesh, same
 * precedent as an island's own terrain patches: a click anywhere on it
 * still resolves to MAINLAND_LAND via findPickableAncestor's parent walk.
 * Positioned relative to the land mesh's own origin, not world space — the
 * land mesh itself already sits at mainlandGeometry.center, so a child
 * must offset from *that*, not repeat the same absolute coordinates.
 */
function buildPlaza(): THREE.Mesh {
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(PLAZA_RADIUS, PLAZA_RADIUS, 0.16, 28),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.plaza, roughness: 0.92 }),
  );
  plaza.position.set(
    mainlandGeometry.researcherQuarter.x - mainlandGeometry.center.x,
    MAINLAND_GROUND_HEIGHT + 0.08,
    mainlandGeometry.researcherQuarter.z - mainlandGeometry.center.z,
  );
  return plaza;
}

/**
 * The researcher quarter: where researchers and their institutions are,
 * collectively — a small, varied skyline rather than one flat-coloured
 * box repeated, so the mainland reads as a real place with its own
 * character. One building — the tallest, dead centre on
 * `mainlandGeometry.researcherQuarter` — is the tagged RESEARCHER_QUARTER
 * landmark itself (the visual origin of a submitted task's own trip to
 * the quay, see engine/flowController.ts); the rest are plain
 * MAINLAND_BUILDING scenery, same role they always had. The landmark's
 * own colour (mainlandAccent2) is never reused by the scenery around it,
 * so it stays visually first among equals even without being singled out
 * any other way.
 */
function buildResearcherQuarter(): THREE.Object3D {
  const group = new THREE.Group();
  const rng = createRng(MAINLAND_SEED + 1);
  const buildingCount = 7;
  const decorativeAccents = [theme.untrusted.mainlandAccent, theme.untrusted.mainlandAccent3];

  for (let i = 0; i < buildingCount; i++) {
    const isLandmark = i === 0;
    const angle = isLandmark ? 0 : rng() * Math.PI * 2;
    const distance = isLandmark ? 0 : QUARTER_RADIUS * (0.35 + rng() * 0.65);
    const width = 1.6 + rng() * 1.6;
    const depth = 1.6 + rng() * 1.6;
    const height = isLandmark ? 7 + rng() * 1.5 : 2.2 + rng() * 4.5;
    const color = isLandmark ? theme.untrusted.mainlandAccent2 : decorativeAccents[i % decorativeAccents.length]!;

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    building.position.set(
      mainlandGeometry.researcherQuarter.x + Math.cos(angle) * distance,
      SEA_LEVEL_Y + MAINLAND_GROUND_HEIGHT + height / 2,
      mainlandGeometry.researcherQuarter.z + Math.sin(angle) * distance,
    );
    building.userData.kind = isLandmark ? "RESEARCHER_QUARTER" : "MAINLAND_BUILDING";

    // A consistent roofline material across every building (peaked for the
    // landmark, so it silhouettes as an institute rather than a plain
    // block; flat caps for the rest) — varied walls, one shared roof
    // colour, the same "real mixed skyline" technique real cities use.
    if (isLandmark) {
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(width, depth) * 0.75, 2.2, 4),
        new THREE.MeshStandardMaterial({ color: theme.untrusted.roof, roughness: 0.6 }),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, height / 2 + 1.1, 0);
      building.add(roof);
    } else {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.08, 0.25, depth * 1.08),
        new THREE.MeshStandardMaterial({ color: theme.untrusted.roof, roughness: 0.6 }),
      );
      roof.position.set(0, height / 2 + 0.12, 0);
      building.add(roof);
    }

    group.add(building);
  }
  return group;
}

const OFFICE_BASE_HEIGHT = 1.6;
const OFFICE_ROOF_HEIGHT = 1.4;

/**
 * The submission layer's own building — see CLAUDE.md's world-metaphor
 * table row for "The mainland port". Where a researcher's submission is
 * actually received and an approved result is actually handed back, made
 * concrete as a real structure beside the dock rather than an implied
 * capability of the bare jetty. Coloured with mainlandAccent3 (the same
 * "official" grey-blue the dock's own bollards already use) and the
 * shared roof colour — deliberately not the researcher quarter's own
 * landmark colour (this isn't researchers or their institutions) and
 * never the reserved gate amber (this is a place, not a human decision).
 */
function buildQuayOffice(): THREE.Object3D {
  const office = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, OFFICE_BASE_HEIGHT, 1.8),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.mainlandAccent3, roughness: 0.7 }),
  );
  office.position.set(
    mainlandGeometry.quayOffice.x,
    SEA_LEVEL_Y + MAINLAND_GROUND_HEIGHT + OFFICE_BASE_HEIGHT / 2,
    mainlandGeometry.quayOffice.z,
  );
  office.userData.kind = "QUAY_OFFICE";

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, OFFICE_ROOF_HEIGHT, 4),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.roof, roughness: 0.6 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, OFFICE_BASE_HEIGHT / 2 + OFFICE_ROOF_HEIGHT / 2, 0);
  office.add(roof);

  return office;
}

/** Small bollard posts around the quay dock, same detail treatment an island's own dock got — a real jetty, not a floating slab. */
function buildDockBollards(): THREE.Mesh[] {
  const bollardGeometry = new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8);
  const bollardMaterial = new THREE.MeshStandardMaterial({
    color: theme.untrusted.mainlandAccent3,
    roughness: 0.5,
    metalness: 0.2,
  });
  return (
    [
      [-1.1, 3],
      [1.1, 3],
      [-1.1, -3],
      [1.1, -3],
    ] as const
  ).map(([bx, bz]) => {
    const bollard = new THREE.Mesh(bollardGeometry, bollardMaterial);
    bollard.position.set(bx, 0.2 + 0.25, bz);
    return bollard;
  });
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
  land.add(buildPlaza());
  group.add(land);

  group.add(buildResearcherQuarter());

  // Sits at MAINLAND_GROUND_HEIGHT, not sea level — quayDock is out at the
  // coastline (see layout.ts), so most of the dock's own footprint still
  // overlaps solid raised ground, and a low sea-level dock would render
  // buried under that terrain exactly the way the plaza once did. The
  // seaward tip, past the actual coastline, reads as a jetty raised on
  // pilings rather than resting flush with the water — a normal look for
  // a real pier.
  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.4, 7),
    new THREE.MeshStandardMaterial({ color: theme.untrusted.mainland, roughness: 0.7 }),
  );
  dock.position.set(mainlandGeometry.quayDock.x, SEA_LEVEL_Y + MAINLAND_GROUND_HEIGHT + 0.1, mainlandGeometry.quayDock.z);
  dock.userData.kind = "MAINLAND_DOCK";
  for (const bollard of buildDockBollards()) dock.add(bollard);
  group.add(dock);

  group.add(buildQuayOffice());

  // Invisible — no geometry, so it's never raycast-pickable itself — just
  // an elevated anchor for the mainland's own floating label.
  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(mainlandGeometry.center.x, SEA_LEVEL_Y + MAINLAND_GROUND_HEIGHT + 8, mainlandGeometry.center.z);
  labelAnchor.userData.kind = "MAINLAND_LABEL_ANCHOR";
  group.add(labelAnchor);

  return group;
}
