import type { CameraPoseVec } from "../engine/cameraRig.ts";
import type { TreId } from "../core/types.ts";
import { customsGeometry, mainlandGeometry, type IslandGeometry, type Vec3 } from "../world/layout.ts";
import type { CameraPose } from "./tourTypes.ts";

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/** A camera parked `distance` back and `height` up, looking at `target` — a generic three-quarter framing, not tied to any particular island's orientation. */
function poseLookingAt(target: Vec3, distance: number, height: number): CameraPoseVec {
  return { position: { x: target.x, y: height, z: target.z + distance }, target };
}

function requireIsland(islands: ReadonlyMap<TreId, IslandGeometry>, treId: TreId): IslandGeometry {
  const island = islands.get(treId);
  if (!island) {
    throw new Error(`resolveCameraPose: no geometry for TRE "${treId}"`);
  }
  return island;
}

const OVERVIEW_POSE: CameraPoseVec = {
  position: { x: 0, y: 50, z: 60 },
  target: { x: 0, y: 0, z: -5 },
};

/**
 * Turns a tour stop's semantic CameraPose into a real position/target,
 * against whatever island-geometry map the caller is actually rendering —
 * tours stay data and portable; only the resolver needs to agree with the
 * rendered world.
 */
export function resolveCameraPose(pose: CameraPose, islands: ReadonlyMap<TreId, IslandGeometry>): CameraPoseVec {
  switch (pose.kind) {
    case "overview":
      return OVERVIEW_POSE;
    case "mainland":
      return poseLookingAt(mainlandGeometry.center, 16, 12);
    case "customs":
      return poseLookingAt(customsGeometry.center, 10, 8);
    case "sea": {
      const island = requireIsland(islands, pose.treId);
      const target = midpoint(island.dock, mainlandGeometry.quayDock);
      return poseLookingAt(target, 11, 10);
    }
    case "tre": {
      const island = requireIsland(islands, pose.treId);
      return poseLookingAt(island.center, 15, 11);
    }
    case "treGate1": {
      const island = requireIsland(islands, pose.treId);
      return poseLookingAt(island.harbourmasterOffice, 6, 5);
    }
    case "treWorkshop": {
      const island = requireIsland(islands, pose.treId);
      return poseLookingAt(island.workshop, 6, 5);
    }
    case "treVault": {
      const island = requireIsland(islands, pose.treId);
      return poseLookingAt(island.vault, 5, 4);
    }
  }
}
