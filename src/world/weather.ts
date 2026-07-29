import * as THREE from "three";
import { theme } from "../core/theme.ts";

/**
 * Mist and rain: purely decorative atmospheric variation, puppeteered by
 * engine/weatherController.ts — see IDEAS.md "Weather variety". Same
 * precedent as whale.ts: no `userData.kind`, so neither can ever be picked
 * or explained in the inspector; `userData.decoration` identifies each for
 * tests only. Both stay confined to open water, well clear of every
 * island's wall and the mainland's coastline (the controller's own
 * exclusion zones) — decorative motion must never cross a wall, the same
 * rule the whale and every wake/ferry-light already follow.
 */

/** One soft, flattened puff — several of these, clustered and drifting together, read as a low mist bank hugging the sea surface. */
export function buildMistPuff(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshStandardMaterial({
      color: theme.untrusted.mist,
      transparent: true,
      opacity: 0,
      roughness: 1,
      depthWrite: false,
    }),
  );
  mesh.userData.decoration = "MIST";
  return mesh;
}

/** One falling streak — a pool of these within a patch of open sea, each looping top-to-sea-level independently, reads as a passing rain shower. */
export function buildRainStreak(length: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, length, 4),
    new THREE.MeshBasicMaterial({ color: theme.untrusted.rain, transparent: true, opacity: 0 }),
  );
  mesh.userData.decoration = "RAIN";
  return mesh;
}
