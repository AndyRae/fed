import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { SEA_LEVEL_Y } from "./layout.ts";

/** The whole open-water surface. Everything between trust zones is open water. */
const SEA_SIZE = 260;
/** Enough resolution for a gentle swell to read as curved rather than faceted, without paying for a mesh far denser than this backdrop deserves. */
const SEA_SEGMENTS = 64;

/**
 * A small gentle swell, not surface chop — the sea is the backdrop the
 * whole world sits in, so it must read as calm open water, not a
 * distraction. Two sine terms at different frequencies, directions, and
 * speeds are summed so the surface never looks like one obviously-repeating
 * ripple. Pure function of position and elapsed time — see CLAUDE.md "never
 * depend on... a GPU when the claim is pure" — so both the initial static
 * shape and every frame's animation call the same tested formula.
 */
const WAVE_AMPLITUDE = 0.4;

export function seaWaveHeight(x: number, z: number, t: number): number {
  const swellA = Math.sin(x * 0.05 + t * 0.6) * Math.cos(z * 0.04 + t * 0.4);
  const swellB = Math.sin((x + z) * 0.03 - t * 0.9);
  return WAVE_AMPLITUDE * (0.65 * swellA + 0.35 * swellB);
}

/**
 * Displaces every vertex of the sea's geometry to the current wave field at
 * time t, in place, and recomputes normals so lighting responds to the new
 * shape. Used both to bake the initial static surface and, every frame, by
 * the sea animator (src/engine/seaAnimator.ts) — see honesty rule 6's
 * neighbour in "Visual language": this is decorative ambient motion, never
 * reacting to SimState, and stays visually subordinate to anything that
 * does (ferries, containers, crates, gate pulses).
 */
export function applySeaWaves(geometry: THREE.BufferGeometry, t: number): void {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    // PlaneGeometry is authored flat in its own local XY plane, then
    // buildSea rotates it -90° about X so local Y becomes world-up and
    // local (pre-rotation) Y here plays the role of a second horizontal
    // axis — not literally world Z, but a stand-in for it that keeps the
    // wave field two-dimensional across the visible surface.
    const z = position.getY(i);
    position.setZ(i, seaWaveHeight(x, z, t));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function buildSea(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_SEGMENTS, SEA_SEGMENTS);
  applySeaWaves(geometry, 0);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: theme.untrusted.sea, roughness: 0.5, metalness: 0.2 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, SEA_LEVEL_Y, -10);
  mesh.userData.kind = "SEA";
  return mesh;
}
