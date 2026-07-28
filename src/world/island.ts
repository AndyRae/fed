import * as THREE from "three";
import type { Tre, TreId } from "../core/types.ts";
import { theme } from "../core/theme.ts";
import { createRng } from "../sim/rng.ts";
import type { IslandGeometry } from "./layout.ts";
import { SEA_LEVEL_Y } from "./layout.ts";

/** The land mesh's nominal extrude depth — see buildIslandLandGeometry. Not, by itself, the height of the terrain's actual flat top surface; see GROUND_HEIGHT below for that. */
export const ISLAND_HEIGHT = 1.4;
/** ExtrudeGeometry's bevel adds this much height again on top of `depth` (see buildIslandLandGeometry's bevelThickness) — the flat top face ends up at ISLAND_HEIGHT + LAND_BEVEL_THICKNESS, not ISLAND_HEIGHT. */
const LAND_BEVEL_THICKNESS = 0.35;
/**
 * The actual height of the island's flat, walkable terrain surface — what
 * every building, decoration, and the workflow road must sit on. Everyone
 * who used to reach for ISLAND_HEIGHT alone for ground-level positioning
 * was quietly floating 0.35 below the real surface; with generously tall
 * buildings that was never visible, but anything meant to lie flush on the
 * ground (the road, the terrain patches) would end up embedded in the
 * bevel and hidden. Exported for src/world/routes.ts and
 * src/engine/flowController.ts, which both place flat, ground-hugging
 * geometry.
 */
export const GROUND_HEIGHT = ISLAND_HEIGHT + LAND_BEVEL_THICKNESS;
// Thinner than the original 0.6 — feedback was that the wall ring read as
// too dominating a shape against the rest of the island.
const WALL_TUBE_RADIUS = 0.4;

/** A short, deterministic string hash — turns a TreId into an RNG seed so each island's shape is stable across reloads without needing to thread a seed through IslandGeometry. */
function hashTreId(treId: TreId): number {
  let hash = 0;
  for (let i = 0; i < treId.length; i++) {
    hash = (hash * 31 + treId.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * The island's coastline outline, shared by the grassy interior
 * (buildIslandLandGeometry) and the beach ring around it
 * (buildIslandBeachGeometry) — both must trace the exact same boundary, or
 * the beach's inner edge and the grass's outer edge would gap or overlap.
 * Points are placed at fixed angle steps with only the radius randomised,
 * so the outline can never self-intersect, and every radius stays within
 * [0.62, 0.78] of wallRadius — well inside the wall ring's own inner edge
 * (wallRadius - tube radius) so the coastline never pokes through the
 * wall, leaving a deliberate moat rather than a glitchy overlap. Still
 * always strictly inside the (circular, inviolable) wall — see honesty
 * rule 1 and the wall/non-overlap tests in layout.test.ts, which reason
 * about wallRadius as a hard circular bound.
 */
function generateIslandOutlinePoints(treId: TreId, wallRadius: number): THREE.Vector2[] {
  const rng = createRng(hashTreId(treId));
  const pointCount = 9 + Math.floor(rng() * 3);
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const radius = wallRadius * (0.62 + rng() * 0.16);
    points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return points;
}

/** A distinct, irregular island silhouette per TRE — every island looks like its own island, not a copy-pasted disc. */
function buildIslandLandGeometry(treId: TreId, wallRadius: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(generateIslandOutlinePoints(treId, wallRadius));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: ISLAND_HEIGHT,
    bevelEnabled: true,
    bevelThickness: LAND_BEVEL_THICKNESS,
    bevelSize: 0.35,
    bevelSegments: 2,
    curveSegments: 10,
  });
  // Lay the extrusion flat: shape's XY plane becomes XZ, extrusion (Z) becomes world-up (Y).
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

const BEACH_HEIGHT = 0.55;
/** How far the beach's outer edge flares out past the grass's own coastline, before being clamped safely inside the wall. */
const BEACH_OUTER_SCALE = 1.3;

/**
 * A sandy ring hugging the grass's own coastline, lower than the grass
 * (BEACH_HEIGHT < ISLAND_HEIGHT) so the island reads as a small raised,
 * grassy plateau with a real beach at its edge, not a flat green disc
 * dropped onto the sea. Built as a shape with a hole: the hole traces
 * exactly the grass's own outline, so there is never a gap or an overlap
 * between sand and grass, only the shared boundary.
 */
function buildIslandBeachGeometry(treId: TreId, wallRadius: number): THREE.BufferGeometry {
  const innerPoints = generateIslandOutlinePoints(treId, wallRadius);
  const outerPoints = innerPoints.map((p) => p.clone().setLength(Math.min(p.length() * BEACH_OUTER_SCALE, wallRadius * 0.94)));
  const shape = new THREE.Shape(outerPoints);
  shape.holes.push(new THREE.Path(innerPoints));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: BEACH_HEIGHT,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.15,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

interface TerrainPatchSpec {
  readonly material: THREE.Material;
  readonly count: number;
  readonly minSize: number;
  readonly maxSize: number;
}

/**
 * Loose, irregular patches of light grass, dark grass, and bare dirt,
 * scattered across the island's interior so the terrain reads as textured
 * ground rather than one flat colour — "more than a green shape". Kept
 * well inside the safe interior radius buildings already use (see
 * islandGeometry's own doc comment on why 0.5 × wallRadius stays clear of
 * the coastline), so a patch never pokes out over the beach or the sea.
 * Deterministic per island, from its own seed continued past the shape's
 * own RNG draws — never Math.random, matching every other seeded-random
 * use in this codebase (see CLAUDE.md "Simulation model").
 */
function buildTerrainPatches(treId: TreId, wallRadius: number): THREE.Mesh[] {
  const rng = createRng(hashTreId(`${treId}-terrain`));
  const grassLight = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.trust.island).offsetHSL(0, 0, 0.07),
    roughness: 0.9,
  });
  const grassDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.trust.island).offsetHSL(0, -0.04, -0.08),
    roughness: 0.9,
  });
  const dirt = new THREE.MeshStandardMaterial({ color: theme.trust.islandDirt, roughness: 1 });

  const specs: readonly TerrainPatchSpec[] = [
    { material: grassLight, count: 5, minSize: 0.9, maxSize: 1.7 },
    { material: grassDark, count: 5, minSize: 0.9, maxSize: 1.7 },
    { material: dirt, count: 4, minSize: 0.55, maxSize: 1.1 },
  ];

  const patches: THREE.Mesh[] = [];
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = rng() * wallRadius * 0.5;
      const size = spec.minSize + rng() * (spec.maxSize - spec.minSize);
      const patch = new THREE.Mesh(new THREE.CircleGeometry(size, 9), spec.material);
      patch.scale.set(1, 0.55 + rng() * 0.45, 1);
      patch.rotateX(-Math.PI / 2);
      patch.rotateZ(rng() * Math.PI * 2);
      patch.position.set(Math.cos(angle) * radius, GROUND_HEIGHT + 0.02, Math.sin(angle) * radius);
      patches.push(patch);
    }
  }
  return patches;
}

/**
 * One island (TRE): a separate trust zone with a hard perimeter. The
 * wall is inviolable inward — nothing here ever suggests otherwise; the
 * dock is the one point where the island's own ferry may cross it.
 */
export function buildIsland(geometry: IslandGeometry, tre: Tre): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.kind = "TRE";
  group.userData.treId = tre.id;

  // The sandy coastline, lower and wider than the grass — see
  // buildIslandBeachGeometry's own doc comment. Added before the grass so
  // the grass's raised plateau reads as sitting on top of it.
  const beach = new THREE.Mesh(
    buildIslandBeachGeometry(tre.id, geometry.wallRadius),
    new THREE.MeshStandardMaterial({ color: theme.trust.islandBeach, roughness: 0.92 }),
  );
  beach.position.set(geometry.center.x, SEA_LEVEL_Y, geometry.center.z);
  beach.userData.kind = "ISLAND_BEACH";
  beach.userData.treId = tre.id;
  group.add(beach);

  const land = new THREE.Mesh(
    buildIslandLandGeometry(tre.id, geometry.wallRadius),
    new THREE.MeshStandardMaterial({ color: theme.trust.island, roughness: 0.85 }),
  );
  land.position.set(geometry.center.x, SEA_LEVEL_Y, geometry.center.z);
  land.userData.kind = "ISLAND_LAND";
  land.userData.treId = tre.id;

  // Light/dark grass and bare-dirt patches — untagged children of the
  // tagged land mesh, so a click on any of them still resolves to
  // ISLAND_LAND via findPickableAncestor's parent walk.
  for (const patch of buildTerrainPatches(tre.id, geometry.wallRadius)) {
    land.add(patch);
  }

  group.add(land);

  const wall = new THREE.Mesh(
    new THREE.TorusGeometry(geometry.wallRadius, WALL_TUBE_RADIUS, 8, 48),
    new THREE.MeshStandardMaterial({ color: theme.trust.wall, roughness: 0.9 }),
  );
  wall.rotation.x = Math.PI / 2;
  wall.position.set(geometry.center.x, SEA_LEVEL_Y + GROUND_HEIGHT + WALL_TUBE_RADIUS, geometry.center.z);
  wall.userData.kind = "ISLAND_WALL";
  wall.userData.treId = tre.id;
  group.add(wall);

  // The vault reads as a secured, contained thing, not a loose gem sitting
  // on the grass: a stone plinth beneath it and a containment ring around
  // it. Plinth and ring are untagged children of the tagged gem mesh, in
  // the same reserved vault colour (varied only in finish, never hue) —
  // honesty rule 2 reserves that colour exclusively for the vault itself,
  // and nothing here is "derived from" its contents, only decorating its
  // fixed, unmoving location. A click on either still resolves to VAULT
  // via findPickableAncestor's parent walk.
  const vaultPlinthHeight = 0.7;
  const vaultGemY = GROUND_HEIGHT + vaultPlinthHeight + 1.4;
  const vault = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4, 0),
    new THREE.MeshStandardMaterial({ color: theme.vault.reserved, roughness: 0.4, metalness: 0.25 }),
  );
  vault.position.set(geometry.vault.x, SEA_LEVEL_Y + vaultGemY, geometry.vault.z);
  vault.userData.kind = "VAULT";
  vault.userData.treId = tre.id;

  const vaultPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 2.1, vaultPlinthHeight, 6),
    new THREE.MeshStandardMaterial({ color: theme.vault.reserved, roughness: 0.85, metalness: 0.1 }),
  );
  vaultPlinth.position.set(0, GROUND_HEIGHT + vaultPlinthHeight / 2 - vaultGemY, 0);
  vault.add(vaultPlinth);

  const vaultRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.1, 8, 28),
    new THREE.MeshStandardMaterial({ color: theme.vault.reserved, roughness: 0.3, metalness: 0.6 }),
  );
  vaultRing.rotation.x = Math.PI / 2;
  vaultRing.position.set(0, -0.3, 0);
  vault.add(vaultRing);

  group.add(vault);

  // The workshop reads as an industrial shed, not a bare block: a low
  // overhanging roof cap (like a loading-dock canopy) plus a vent stack —
  // the machinery that runs the container, not an office. Roof and vent are
  // untagged children of the tagged base mesh, so a click on either still
  // resolves to WORKSHOP via findPickableAncestor's parent walk.
  const workshopHeight = 2.2;
  const workshop = new THREE.Mesh(
    new THREE.BoxGeometry(3, workshopHeight, 3),
    new THREE.MeshStandardMaterial({ color: theme.trust.workshop, roughness: 0.7 }),
  );
  workshop.position.set(geometry.workshop.x, SEA_LEVEL_Y + GROUND_HEIGHT + workshopHeight / 2, geometry.workshop.z);
  workshop.userData.kind = "WORKSHOP";
  workshop.userData.treId = tre.id;

  const workshopRoofCap = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.3, 3.5),
    new THREE.MeshStandardMaterial({ color: theme.trust.workshop, roughness: 0.6 }),
  );
  workshopRoofCap.position.set(0, workshopHeight / 2 + 0.15, 0);
  workshop.add(workshopRoofCap);

  const workshopVent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 1.1, 10),
    new THREE.MeshStandardMaterial({ color: theme.trust.workshop, roughness: 0.55, metalness: 0.15 }),
  );
  workshopVent.position.set(0.9, workshopHeight / 2 + 0.3 + 0.55, 0.9);
  workshop.add(workshopVent);

  group.add(workshop);

  // A real small office, not a bare beacon: amber walls topped with the
  // same peaked-roof silhouette the marker always had, now sitting on a
  // proper base rather than floating at ground level. The roof stays an
  // untagged child of the tagged base, so a click on either resolves to
  // GATE1_HARBOURMASTER via findPickableAncestor's parent walk. Every part
  // stays the reserved gate amber — see theme.ts: it is a single Gate 1
  // marker assembly, not a building plus a separate decoration.
  const officeBaseHeight = 1.3;
  const harbourmasterOffice = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, officeBaseHeight, 1.7),
    new THREE.MeshStandardMaterial({ color: theme.gate.amber, roughness: 0.65 }),
  );
  harbourmasterOffice.position.set(
    geometry.harbourmasterOffice.x,
    SEA_LEVEL_Y + GROUND_HEIGHT + officeBaseHeight / 2,
    geometry.harbourmasterOffice.z,
  );
  harbourmasterOffice.userData.kind = "GATE1_HARBOURMASTER";
  harbourmasterOffice.userData.treId = tre.id;

  const officeRoofHeight = 1.6;
  const officeRoof = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, officeRoofHeight, 6),
    new THREE.MeshStandardMaterial({ color: theme.gate.amber, roughness: 0.45 }),
  );
  officeRoof.position.set(0, officeBaseHeight / 2 + officeRoofHeight / 2, 0);
  harbourmasterOffice.add(officeRoof);

  group.add(harbourmasterOffice);

  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.4, 4),
    new THREE.MeshStandardMaterial({ color: theme.trust.ferry, roughness: 0.7 }),
  );
  dock.position.set(geometry.dock.x, SEA_LEVEL_Y + 0.2, geometry.dock.z);
  dock.userData.kind = "DOCK";
  dock.userData.treId = tre.id;

  // Four bollard posts read as a real jetty, not a floating slab —
  // untagged children of the tagged deck, so a click on any of them still
  // resolves to DOCK.
  const bollardGeometry = new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8);
  const bollardMaterial = new THREE.MeshStandardMaterial({ color: theme.trust.ferry, roughness: 0.5, metalness: 0.2 });
  for (const [bx, bz] of [
    [-0.8, 1.7],
    [0.8, 1.7],
    [-0.8, -1.7],
    [0.8, -1.7],
  ] as const) {
    const bollard = new THREE.Mesh(bollardGeometry, bollardMaterial);
    bollard.position.set(bx, 0.2 + 0.25, bz);
    dock.add(bollard);
  }

  group.add(dock);

  // This island's own customs hall — Gate 2, a human decision made
  // locally by this TRE, not a shared/central facility. Paired the same
  // way Gate 1 pairs the harbourmaster's office with amber: the hall
  // building itself is a neutral colour, and the inspector marker beside
  // it — set back slightly toward the island's interior, never exactly
  // coincident with the hall — carries the reserved gate amber. Built as a
  // real customs house rather than a plain block: a hipped roof and a
  // lookout cupola, echoing a harbourside customs building rather than a
  // generic shed. Roof and cupola are untagged children of the tagged base
  // mesh, so a click anywhere on the building still resolves to
  // CUSTOMS_HALL via findPickableAncestor's parent walk.
  const hallHeight = 2.0;
  const customsHall = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, hallHeight, 3.6),
    new THREE.MeshStandardMaterial({ color: theme.customs.hall, roughness: 0.8 }),
  );
  customsHall.position.set(geometry.customsHall.x, SEA_LEVEL_Y + GROUND_HEIGHT + hallHeight / 2, geometry.customsHall.z);
  customsHall.userData.kind = "CUSTOMS_HALL";
  customsHall.userData.treId = tre.id;

  const hallRoofHeight = 1.5;
  const hallRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.7, hallRoofHeight, 4),
    new THREE.MeshStandardMaterial({ color: theme.customs.hall, roughness: 0.6 }),
  );
  hallRoof.rotation.y = Math.PI / 4;
  hallRoof.position.set(0, hallHeight / 2 + hallRoofHeight / 2, 0);
  customsHall.add(hallRoof);

  const hallCupola = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: theme.customs.hall, roughness: 0.5, metalness: 0.1 }),
  );
  hallCupola.position.set(0, hallHeight / 2 + hallRoofHeight + 0.45, 0);
  customsHall.add(hallCupola);

  group.add(customsHall);

  // Gate 1 is depicted as an office (a place); Gate 2 is depicted as the
  // inspector themself (a person) standing on a small dais beside the hall
  // — matching the world-metaphor table's own language, and giving the
  // human-decision marker (honesty rule 3) real visual footing rather than
  // a cone floating at ground level. The dais is an untagged child of the
  // tagged cone, so a click on either resolves to GATE2_INSPECTOR.
  const towardCenterX = geometry.center.x - geometry.customsHall.x;
  const towardCenterZ = geometry.center.z - geometry.customsHall.z;
  const towardCenterLen = Math.hypot(towardCenterX, towardCenterZ) || 1;
  const inspectorDaisHeight = 0.4;
  const inspector = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: theme.gate.amber, roughness: 0.5 }),
  );
  inspector.position.set(
    geometry.customsHall.x + (towardCenterX / towardCenterLen) * 2.4,
    SEA_LEVEL_Y + GROUND_HEIGHT + 1.1 + inspectorDaisHeight,
    geometry.customsHall.z + (towardCenterZ / towardCenterLen) * 2.4,
  );
  inspector.userData.kind = "GATE2_INSPECTOR";
  inspector.userData.treId = tre.id;

  const inspectorDais = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.25, inspectorDaisHeight, 10),
    new THREE.MeshStandardMaterial({ color: theme.gate.amber, roughness: 0.7 }),
  );
  inspectorDais.position.set(0, -1.1 - inspectorDaisHeight / 2, 0);
  inspector.add(inspectorDais);

  group.add(inspector);

  // Invisible — no geometry, so it's never raycast-pickable itself — just an
  // elevated anchor point for this island's own floating name label, well
  // above the vault/workshop/gate markers so it reads as "the whole island".
  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(geometry.center.x, SEA_LEVEL_Y + GROUND_HEIGHT + 7, geometry.center.z);
  labelAnchor.userData.kind = "TRE_LABEL_ANCHOR";
  labelAnchor.userData.treId = tre.id;
  group.add(labelAnchor);

  return group;
}
