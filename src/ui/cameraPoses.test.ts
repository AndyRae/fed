import { describe, expect, it } from "vitest";
import { islandGeometry, mainlandGeometry } from "../world/layout.ts";
import { resolveCameraPose } from "./cameraPoses.ts";
import type { CameraPose } from "./tourTypes.ts";

const islands = new Map([
  ["tre-a", islandGeometry("tre-a", 0, 3)],
  ["tre-b", islandGeometry("tre-b", 1, 3)],
  ["tre-c", islandGeometry("tre-c", 2, 3)],
]);

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe("resolveCameraPose", () => {
  it("targets the island's real centre for a 'tre' pose", () => {
    const pose = resolveCameraPose({ kind: "tre", treId: "tre-a" }, islands);
    expect(pose.target).toEqual(islands.get("tre-a")!.center);
    expect(distance(pose.position, pose.target)).toBeGreaterThan(0);
  });

  it("targets the harbourmaster's office exactly for 'treGate1'", () => {
    const pose = resolveCameraPose({ kind: "treGate1", treId: "tre-b" }, islands);
    expect(pose.target).toEqual(islands.get("tre-b")!.harbourmasterOffice);
  });

  it("targets the workshop exactly for 'treWorkshop'", () => {
    const pose = resolveCameraPose({ kind: "treWorkshop", treId: "tre-a" }, islands);
    expect(pose.target).toEqual(islands.get("tre-a")!.workshop);
  });

  it("targets the vault exactly for 'treVault'", () => {
    const pose = resolveCameraPose({ kind: "treVault", treId: "tre-c" }, islands);
    expect(pose.target).toEqual(islands.get("tre-c")!.vault);
  });

  it("targets the mainland's real centre for 'mainland'", () => {
    const pose = resolveCameraPose({ kind: "mainland" }, islands);
    expect(pose.target).toEqual(mainlandGeometry.center);
  });

  it("targets this island's own customs hall exactly for 'treCustoms'", () => {
    const pose = resolveCameraPose({ kind: "treCustoms", treId: "tre-c" }, islands);
    expect(pose.target).toEqual(islands.get("tre-c")!.customsHall);
  });

  it("gives 'sea' a target between that island's dock and the mainland dock", () => {
    const pose = resolveCameraPose({ kind: "sea", treId: "tre-a" }, islands);
    const island = islands.get("tre-a")!;
    // Should sit roughly between the two docks, not coincide with either.
    expect(distance(pose.target, island.dock)).toBeGreaterThan(0);
    expect(distance(pose.target, mainlandGeometry.quayDock)).toBeGreaterThan(0);
  });

  it("gives a fixed wide shot for 'overview' that doesn't depend on islands", () => {
    const a = resolveCameraPose({ kind: "overview" }, islands);
    const b = resolveCameraPose({ kind: "overview" }, new Map());
    expect(a).toEqual(b);
  });

  it("throws a clear error for an unknown treId rather than silently mispositioning the camera", () => {
    const pose: CameraPose = { kind: "tre", treId: "tre-nonexistent" };
    expect(() => resolveCameraPose(pose, islands)).toThrow(/tre-nonexistent/);
  });

  it("is deterministic", () => {
    expect(resolveCameraPose({ kind: "tre", treId: "tre-a" }, islands)).toEqual(
      resolveCameraPose({ kind: "tre", treId: "tre-a" }, islands),
    );
  });
});
