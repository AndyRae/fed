import type { TreId } from "../core/types.ts";

/**
 * Stub route model for the honesty-rule tests (CLAUDE.md "Agentic
 * engineering rules" > "Honesty rules are testable"). This is a
 * topological description of what may move where, with no coordinates —
 * real geometry (island positions, wall bounds, dock anchors) is a later
 * session's work. `src/world` may read `SimState` but never mutates it;
 * this file is the single source of truth for geography once it exists.
 */
export type ZoneKind = "SEA" | "MAINLAND" | "ISLAND_INTERIOR" | "VAULT" | "CUSTOMS";

export interface Zone {
  readonly id: string;
  readonly kind: ZoneKind;
  /** Set for ISLAND_INTERIOR and VAULT zones: which island this belongs to. */
  readonly treId?: TreId;
}

export interface Route {
  readonly id: string;
  readonly description: string;
  readonly waypoints: readonly Zone[];
}

export function islandInteriorZone(treId: TreId): Zone {
  return { id: `${treId}-interior`, kind: "ISLAND_INTERIOR", treId };
}

/** Fixed at the island's centre. Never a waypoint on any route — see honesty rule 2. */
export function vaultZone(treId: TreId): Zone {
  return { id: `${treId}-vault`, kind: "VAULT", treId };
}

export const seaZone: Zone = { id: "sea", kind: "SEA" };
export const mainlandZone: Zone = { id: "mainland", kind: "MAINLAND" };
export const customsZone: Zone = { id: "customs", kind: "CUSTOMS" };

/**
 * The TRE agent's round trip: departs the island, crosses open water to the
 * mainland submission layer, collects an approved task, and returns to the
 * same island. The outbound-only claim rendered as a route — see honesty
 * rule 1.
 */
export function ferryRoute(treId: TreId): Route {
  const home = islandInteriorZone(treId);
  return {
    id: `ferry-${treId}`,
    description: `${treId}'s ferry departs, collects an approved task from the mainland, and returns`,
    waypoints: [home, seaZone, mainlandZone, seaZone, home],
  };
}

/**
 * A sealed crate's one-way trip from the workshop that produced it to the
 * neutral customs hall, where it waits for Gate 2. It never enters another
 * island and never returns inward.
 */
export function egressRoute(treId: TreId): Route {
  return {
    id: `egress-${treId}`,
    description: `a sealed crate travels from ${treId}'s workshop to customs`,
    waypoints: [islandInteriorZone(treId), seaZone, customsZone],
  };
}

/** Every route in the world: one ferry route and one egress route per island. There is no route-constructing function that takes two TRE ids — inter-island routes are structurally absent, not merely unused. */
export function buildRoutes(treIds: readonly TreId[]): Route[] {
  return treIds.flatMap((treId) => [ferryRoute(treId), egressRoute(treId)]);
}

/**
 * A route is legal if it never crosses into an island's interior from
 * outside unless that same route departed from that island, and never
 * touches the vault at all.
 */
export function isLegalRoute(route: Route): boolean {
  if (route.waypoints.some((w) => w.kind === "VAULT")) return false;

  const start = route.waypoints[0];
  for (let i = 1; i < route.waypoints.length; i++) {
    const prev = route.waypoints[i - 1]!;
    const cur = route.waypoints[i]!;
    if (cur.kind === "ISLAND_INTERIOR" && prev.kind !== "ISLAND_INTERIOR") {
      const departedFromThisIsland = start?.kind === "ISLAND_INTERIOR" && start.treId === cur.treId;
      if (!departedFromThisIsland) return false;
    }
  }
  return true;
}

/** True if a single route's waypoints touch the interiors of more than one island — see honesty rule 6. */
export function connectsTwoIslands(route: Route): boolean {
  const islandIds = new Set(
    route.waypoints.filter((w) => w.kind === "ISLAND_INTERIOR").map((w) => w.treId),
  );
  return islandIds.size > 1;
}

// --- Real geometry -----------------------------------------------------
//
// Positions for actual rendering, additive to the symbolic Zone/Route
// model above (which stays coordinate-free and is what the honesty tests
// check topological legality against). Y is up; the sea sits at y = 0.

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function vecSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function vecScale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
function vecLength(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}
function vecNormalize(a: Vec3): Vec3 {
  const len = vecLength(a);
  return len === 0 ? { x: 0, y: 0, z: 0 } : vecScale(a, 1 / len);
}
function vecLerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export const SEA_LEVEL_Y = 0;
export const ISLAND_WALL_RADIUS = 9;
export const ISLAND_RING_RADIUS = 24;

export interface MainlandGeometry {
  readonly center: Vec3;
  readonly quayDock: Vec3;
}

export interface CustomsGeometry {
  readonly center: Vec3;
  readonly dock: Vec3;
}

export const mainlandGeometry: MainlandGeometry = {
  center: { x: 0, y: SEA_LEVEL_Y, z: -32 },
  quayDock: { x: 0, y: SEA_LEVEL_Y, z: -24 },
};

/** Customs sits near the mainland but is its own footprint, outside every island — see the world-metaphor table. */
export const customsGeometry: CustomsGeometry = {
  center: { x: 14, y: SEA_LEVEL_Y, z: -29 },
  dock: { x: 12, y: SEA_LEVEL_Y, z: -24 },
};

export interface IslandGeometry {
  readonly treId: TreId;
  readonly center: Vec3;
  readonly wallRadius: number;
  /** Where the island's own ferry departs from and returns to. The one point where anything crosses the wall inward. */
  readonly dock: Vec3;
  /**
   * The TRE's own local disclosure-control checkpoint, built into the
   * wall — see CLAUDE.md's world-metaphor table. Every sealed crate
   * passes through here on its way out; it is a fixed structure, not a
   * vessel, and a different point on the wall than the ferry's dock.
   */
  readonly egressAirlock: Vec3;
  /** Fixed exactly at the centre — honesty rule 2: the vault emits nothing, so it is never a waypoint on any path. */
  readonly vault: Vec3;
  readonly workshop: Vec3;
  readonly harbourmasterOffice: Vec3;
}

/** Deterministic placement: same id/index/total always yields the same island. Islands fan out toward the mainland so no two walls overlap. */
export function islandGeometry(treId: TreId, index: number, total: number): IslandGeometry {
  const spreadDeg = total > 1 ? 110 : 0;
  const angleDeg = total > 1 ? -spreadDeg / 2 + (spreadDeg * index) / (total - 1) : 0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const center: Vec3 = {
    x: Math.sin(angleRad) * ISLAND_RING_RADIUS,
    y: SEA_LEVEL_Y,
    z: Math.cos(angleRad) * ISLAND_RING_RADIUS,
  };

  const towardMainland = vecNormalize(vecSub(mainlandGeometry.center, center));
  const towardCustoms = vecNormalize(vecSub(customsGeometry.center, center));
  const sideways: Vec3 = { x: -towardMainland.z, y: 0, z: towardMainland.x };
  const dock = vecAdd(center, vecScale(towardMainland, ISLAND_WALL_RADIUS));
  const egressAirlock = vecAdd(center, vecScale(towardCustoms, ISLAND_WALL_RADIUS));
  const workshop = vecAdd(
    center,
    vecAdd(vecScale(towardMainland, ISLAND_WALL_RADIUS * 0.3), vecScale(sideways, ISLAND_WALL_RADIUS * 0.35)),
  );
  const harbourmasterOffice = vecAdd(
    center,
    vecAdd(vecScale(towardMainland, ISLAND_WALL_RADIUS * 0.6), vecScale(sideways, -ISLAND_WALL_RADIUS * 0.3)),
  );

  return { treId, center, wallRadius: ISLAND_WALL_RADIUS, dock, egressAirlock, vault: center, workshop, harbourmasterOffice };
}

/** The ferry's round trip in real coordinates: island dock → open water → mainland dock → open water → the same island dock. */
export function ferryPath(island: IslandGeometry): readonly Vec3[] {
  const seaMidpoint = vecLerp(island.dock, mainlandGeometry.quayDock, 0.5);
  return [island.dock, seaMidpoint, mainlandGeometry.quayDock, seaMidpoint, island.dock];
}

/**
 * A sealed crate's path from the workshop to customs, real coordinates.
 * It leaves through the island's own egress airlock — the TRE's local
 * disclosure-control checkpoint — not through the ferry's dock; the two
 * are different, fixed points on the same wall. See CLAUDE.md's
 * world-metaphor table.
 */
export function egressPath(island: IslandGeometry): readonly Vec3[] {
  const seaMidpoint = vecLerp(island.egressAirlock, customsGeometry.dock, 0.5);
  return [island.workshop, island.egressAirlock, seaMidpoint, customsGeometry.dock];
}
