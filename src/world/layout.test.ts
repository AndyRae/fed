import { describe, expect, it } from "vitest";
import {
  buildRoutes,
  connectsTwoIslands,
  customsGeometry,
  egressPath,
  egressRoute,
  ferryPath,
  ferryRoute,
  islandGeometry,
  isLegalRoute,
  mainlandGeometry,
  vaultZone,
  type Vec3,
} from "./layout.ts";

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe("ferryRoute", () => {
  it("starts and ends at the same island's interior — the ferry only ever returns home", () => {
    const route = ferryRoute("tre-a");
    const first = route.waypoints[0]!;
    const last = route.waypoints[route.waypoints.length - 1]!;
    expect(first.kind).toBe("ISLAND_INTERIOR");
    expect(first.treId).toBe("tre-a");
    expect(last.kind).toBe("ISLAND_INTERIOR");
    expect(last.treId).toBe("tre-a");
  });

  it("passes through the sea and mainland but never another island's interior", () => {
    const route = ferryRoute("tre-a");
    const kinds = route.waypoints.map((w) => w.kind);
    expect(kinds).toContain("SEA");
    expect(kinds).toContain("MAINLAND");
    for (const w of route.waypoints) {
      if (w.kind === "ISLAND_INTERIOR") expect(w.treId).toBe("tre-a");
    }
  });

  it("is a legal route: it never crosses a wall inward except returning to its own departure island", () => {
    expect(isLegalRoute(ferryRoute("tre-a"))).toBe(true);
  });
});

describe("egressRoute", () => {
  it("leaves the island for customs and never re-enters an island", () => {
    const route = egressRoute("tre-a");
    const last = route.waypoints[route.waypoints.length - 1]!;
    expect(last.kind).toBe("CUSTOMS");
    const interiorWaypoints = route.waypoints.filter((w) => w.kind === "ISLAND_INTERIOR");
    expect(interiorWaypoints).toHaveLength(1);
    expect(interiorWaypoints[0]!.treId).toBe("tre-a");
  });

  it("is a legal route", () => {
    expect(isLegalRoute(egressRoute("tre-a"))).toBe(true);
  });
});

describe("honesty rule 1: no motion ever crosses an island wall inward", () => {
  it("flags a fabricated route that enters an island the vessel did not depart from", () => {
    const illegal = {
      id: "illegal-cross-dock",
      description: "a route that docks at tre-b without ever having departed from it",
      waypoints: [
        { id: "sea", kind: "SEA" as const },
        { id: "tre-b-interior", kind: "ISLAND_INTERIOR" as const, treId: "tre-b" },
      ],
    };
    expect(isLegalRoute(illegal)).toBe(false);
  });

  it("every route produced for the world is legal", () => {
    for (const route of buildRoutes(["tre-a", "tre-b", "tre-c"])) {
      expect(isLegalRoute(route)).toBe(true);
    }
  });
});

describe("honesty rule 2: the vault emits nothing", () => {
  it("the vault is a fixed zone, distinct from the island interior it sits within", () => {
    const vault = vaultZone("tre-a");
    expect(vault.kind).toBe("VAULT");
    expect(vault.treId).toBe("tre-a");
  });

  it("no route generated for the world ever includes a vault waypoint", () => {
    for (const route of buildRoutes(["tre-a", "tre-b"])) {
      expect(route.waypoints.some((w) => w.kind === "VAULT")).toBe(false);
    }
  });

  it("a route touching the vault is rejected as illegal, even a one-hop one", () => {
    const illegal = {
      id: "illegal-vault-leak",
      description: "a route that lets vault contents reach the mainland",
      waypoints: [
        { id: "tre-a-vault", kind: "VAULT" as const, treId: "tre-a" },
        { id: "mainland", kind: "MAINLAND" as const },
      ],
    };
    expect(isLegalRoute(illegal)).toBe(false);
  });
});

describe("honesty rule 6: islands are mutually invisible", () => {
  it("no generated route connects two different islands", () => {
    for (const route of buildRoutes(["tre-a", "tre-b", "tre-c"])) {
      expect(connectsTwoIslands(route)).toBe(false);
    }
  });

  it("flags a fabricated route that links two islands directly", () => {
    const illegal = {
      id: "illegal-inter-island-bridge",
      description: "a route that would let two islands coordinate directly",
      waypoints: [
        { id: "tre-a-interior", kind: "ISLAND_INTERIOR" as const, treId: "tre-a" },
        { id: "tre-b-interior", kind: "ISLAND_INTERIOR" as const, treId: "tre-b" },
      ],
    };
    expect(connectsTwoIslands(illegal)).toBe(true);
  });
});

describe("real geometry: islandGeometry", () => {
  const islands = ["tre-a", "tre-b", "tre-c"].map((id, i, all) => islandGeometry(id, i, all.length));

  it("places the vault exactly at the island's centre — honesty rule 2", () => {
    for (const island of islands) {
      expect(island.vault).toEqual(island.center);
    }
  });

  it("places the dock exactly on the wall boundary", () => {
    for (const island of islands) {
      expect(distance(island.dock, island.center)).toBeCloseTo(island.wallRadius, 5);
    }
  });

  it("keeps the workshop and harbourmaster's office inside the wall", () => {
    for (const island of islands) {
      expect(distance(island.workshop, island.center)).toBeLessThan(island.wallRadius);
      expect(distance(island.harbourmasterOffice, island.center)).toBeLessThan(island.wallRadius);
    }
  });

  it("never overlaps another island's wall", () => {
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const a = islands[i]!;
        const b = islands[j]!;
        expect(distance(a.center, b.center)).toBeGreaterThan(a.wallRadius + b.wallRadius);
      }
    }
  });

  it("is deterministic for the same id, index, and total", () => {
    expect(islandGeometry("tre-a", 0, 3)).toEqual(islandGeometry("tre-a", 0, 3));
  });
});

describe("real geometry: ferryPath", () => {
  const islands = ["tre-a", "tre-b", "tre-c"].map((id, i, all) => islandGeometry(id, i, all.length));

  it("starts and ends at the departing island's own dock", () => {
    for (const island of islands) {
      const path = ferryPath(island);
      expect(path[0]).toEqual(island.dock);
      expect(path[path.length - 1]).toEqual(island.dock);
    }
  });

  it("passes through the mainland's dock", () => {
    for (const island of islands) {
      expect(ferryPath(island)).toContainEqual(mainlandGeometry.quayDock);
    }
  });

  it("never passes through another island's wall — honesty rule 1", () => {
    for (const island of islands) {
      const others = islands.filter((i) => i.treId !== island.treId);
      for (const point of ferryPath(island)) {
        for (const other of others) {
          expect(distance(point, other.center)).toBeGreaterThan(other.wallRadius);
        }
      }
    }
  });
});

describe("real geometry: egressPath", () => {
  const islands = ["tre-a", "tre-b", "tre-c"].map((id, i, all) => islandGeometry(id, i, all.length));

  it("starts at the island's workshop and ends at customs, never re-entering an island", () => {
    for (const island of islands) {
      const path = egressPath(island);
      expect(path[0]).toEqual(island.workshop);
      expect(path[path.length - 1]).toEqual(customsGeometry.dock);
    }
  });

  it("never passes through another island's wall — honesty rule 1 and 6", () => {
    for (const island of islands) {
      const others = islands.filter((i) => i.treId !== island.treId);
      for (const point of egressPath(island)) {
        for (const other of others) {
          expect(distance(point, other.center)).toBeGreaterThan(other.wallRadius);
        }
      }
    }
  });
});
