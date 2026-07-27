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
