import type { TreId } from "../core/types.ts";

/**
 * Stub route model for the honesty-rule tests (CLAUDE.md "Agentic
 * engineering rules" > "Honesty rules are testable"). This is a
 * topological description of what may move where, with no coordinates —
 * real geometry (island positions, wall bounds, dock anchors) is a later
 * session's work. `src/world` may read `SimState` but never mutates it;
 * this file is the single source of truth for geography once it exists.
 */
export type ZoneKind = "SEA" | "MAINLAND" | "ISLAND_INTERIOR" | "VAULT";

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
 * A sealed crate's one-way trip from the workshop that produced it, through
 * this island's own customs hall (Gate 2 — a local human decision), and
 * directly to the researcher's quay. It never enters another island, never
 * returns inward, and never touches a shared/central facility: there is no
 * customs hall on the mainland.
 */
export function egressRoute(treId: TreId): Route {
  return {
    id: `egress-${treId}`,
    description: `a sealed crate travels from ${treId}'s own customs hall to the researcher's quay`,
    waypoints: [islandInteriorZone(treId), seaZone, mainlandZone],
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
// A touch bigger than the original 9 — more room for each island's
// elements to breathe — while staying safely under the ~11.1 ceiling a
// 3-island layout needs to keep adjacent walls from overlapping (see
// layout.test.ts "never overlaps another island's wall": at
// ISLAND_RING_RADIUS 24 with a 110° spread across 3 islands, adjacent
// centres sit ~22.16 apart, so 2 × wallRadius must stay under that).
export const ISLAND_WALL_RADIUS = 10;
export const ISLAND_RING_RADIUS = 24;

export interface MainlandGeometry {
  readonly center: Vec3;
  readonly quayDock: Vec3;
  /**
   * The submission layer's own building, right beside the dock — see
   * CLAUDE.md's world-metaphor table row for "The mainland port". Where a
   * researcher's submission is actually received and an approved result is
   * actually handed back, made concrete as a real structure rather than an
   * implied capability of the bare dock platform.
   */
  readonly quayOffice: Vec3;
  /**
   * Where researchers and their institutions are, collectively — the
   * visual origin of a submitted task's own trip to the quay (see
   * `submissionPath`). Decorative and collective, not a new gate: the
   * quay itself is still the only place a task "begins" in protocol terms
   * — see CLAUDE.md's world-metaphor table.
   */
  readonly researcherQuarter: Vec3;
}

export const mainlandGeometry: MainlandGeometry = {
  center: { x: 0, y: SEA_LEVEL_Y, z: -32 },
  quayDock: { x: 0, y: SEA_LEVEL_Y, z: -24 },
  // Tight against the dock's own side, at exactly the dock's z — not set
  // back inland — so every route that ends at quayDock (the ferry, a
  // released crate, a submission) visibly arrives at this building, not at
  // an empty platform with an unconnected office somewhere behind it. Clear
  // of the dock's own footprint (half-width 1.5) by only a small gap.
  quayOffice: { x: 2.5, y: SEA_LEVEL_Y, z: -24 },
  // On the inland side, away from the quay's own sea-facing edge, so the
  // submission's trip to the dock reads as a real crossing of the
  // mainland. Previously (6, -40) — 10 units from centre — which left no
  // room for the researcher quarter's own plaza (radius up to 8.5) before
  // hitting the mainland's actual coastline, which sits as close as ~13.4
  // at this angle: the plaza and several buildings genuinely hung off the
  // edge into the sea. See mainland.ts's MAINLAND_SAFE_INTERIOR_RADIUS —
  // this point's own distance from centre, plus the researcher quarter's
  // largest radius (the plaza), must stay under that bound.
  researcherQuarter: { x: 3, y: SEA_LEVEL_Y, z: -35.5 },
};

export interface IslandGeometry {
  readonly treId: TreId;
  readonly center: Vec3;
  readonly wallRadius: number;
  /** Where the island's own ferry departs from and returns to. The one point where anything crosses the wall inward. */
  readonly dock: Vec3;
  /**
   * This TRE's own customs hall — Gate 2, a human decision made locally by
   * this island about whether it is comfortable releasing a given crate
   * beyond its own control. Sits at the wall, a different point than the
   * ferry's dock — see CLAUDE.md's world-metaphor table. There is no
   * shared or central customs hall anywhere in the model.
   */
  readonly customsHall: Vec3;
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
  const sideways: Vec3 = { x: -towardMainland.z, y: 0, z: towardMainland.x };
  const awayFromMainland = vecScale(towardMainland, -1);

  // Both wall-anchored gates sit on the mainland-facing half, at different
  // points of the wall so a straight-line sea route from either one never
  // clips back across the island's own landmass.
  const dock = vecAdd(center, vecScale(towardMainland, ISLAND_WALL_RADIUS));
  const towardCustomsHall = vecNormalize(vecAdd(towardMainland, vecScale(sideways, 0.6)));
  const customsHall = vecAdd(center, vecScale(towardCustomsHall, ISLAND_WALL_RADIUS));

  // The harbourmaster's office sits inland from the dock, on the wall's
  // opposite lateral side from the customs hall — the first governance stop
  // a task's paperwork reaches, close to where the ferry itself departs.
  // Kept well under the island land silhouette's minimum radius (0.62 ×
  // wallRadius, see buildIslandLandGeometry) so it never floats past the
  // coastline into the moat, whichever way this island's irregular shape
  // happens to randomise.
  const towardHarbourmaster = vecNormalize(vecAdd(vecScale(towardMainland, 0.75), vecScale(sideways, -0.6)));
  const harbourmasterOffice = vecAdd(center, vecScale(towardHarbourmaster, ISLAND_WALL_RADIUS * 0.45));

  // The workshop sits on the far side of the island, away from the
  // mainland-facing gates and loosely circling the vault rather than
  // crowding next to it — it is the one landmark with no route leaving the
  // wall, so it is free to use the half of the island the two gates don't
  // touch. This makes the on-island workflow (harbourmaster -> workshop ->
  // customs hall) sweep across the whole footprint instead of sitting in
  // one corner, which is the point: it should read as a real cycle, not a
  // cluster.
  const towardWorkshop = vecNormalize(vecAdd(awayFromMainland, vecScale(sideways, 0.25)));
  const workshop = vecAdd(center, vecScale(towardWorkshop, ISLAND_WALL_RADIUS * 0.5));

  return { treId, center, wallRadius: ISLAND_WALL_RADIUS, dock, customsHall, vault: center, workshop, harbourmasterOffice };
}

/** The ferry's round trip in real coordinates: island dock → open water → mainland dock → open water → the same island dock. */
export function ferryPath(island: IslandGeometry): readonly Vec3[] {
  const seaMidpoint = vecLerp(island.dock, mainlandGeometry.quayDock, 0.5);
  return [island.dock, seaMidpoint, mainlandGeometry.quayDock, seaMidpoint, island.dock];
}

/**
 * A sealed crate's path from the workshop to the researcher's quay, real
 * coordinates. It leaves through this island's own customs hall — Gate 2,
 * a local human decision — not through the ferry's dock; the two are
 * different, fixed points on the same wall. Once released, it travels
 * directly to the mainland: there is no shared or central customs stop
 * anywhere in the model. See CLAUDE.md's world-metaphor table.
 */
export function egressPath(island: IslandGeometry): readonly Vec3[] {
  const seaMidpoint = vecLerp(island.customsHall, mainlandGeometry.quayDock, 0.5);
  return [island.workshop, island.customsHall, seaMidpoint, mainlandGeometry.quayDock];
}

/**
 * The order a task actually moves through this island once it's here:
 * approved at the harbourmaster's office (Gate 1), executed at the
 * workshop, then checked at this island's own customs hall (Gate 2)
 * before it may leave. The vault is deliberately absent — honesty rule 2:
 * nothing whose origin is the vault ever travels anywhere.
 */
export function workflowPath(island: IslandGeometry): readonly Vec3[] {
  return [island.harbourmasterOffice, island.workshop, island.customsHall];
}

/**
 * A submitted task's own one-way trip from the researcher quarter to the
 * quay, real coordinates. Entirely on the mainland — no sea crossing, no
 * island involved — since submission happens before any TRE has agreed to
 * anything. See CLAUDE.md's world-metaphor table.
 */
export function submissionPath(): readonly Vec3[] {
  return [mainlandGeometry.researcherQuarter, mainlandGeometry.quayDock];
}
