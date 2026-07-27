import { describe, expect, it } from "vitest";
import { buildRoutes, connectsTwoIslands, egressRoute, ferryRoute, isLegalRoute, vaultZone } from "./layout.ts";

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
