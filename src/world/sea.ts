import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { SEA_LEVEL_Y } from "./layout.ts";

/** The whole open-water surface. Everything between trust zones is open water. */
const SEA_SIZE = 260;
/** Enough resolution for the swell below to read as a smooth curve rather than a faceted one. */
const SEA_SEGMENTS = 64;
/** Small and gentle — a perfectly flat plane has one normal everywhere, so under directional lighting it necessarily renders as a single uniform colour with no sense of a surface at all. This bakes just enough permanent, low-frequency undulation to catch light unevenly and read as a soft sea, without paying for (or risking) a per-frame animation loop. */
const SWELL_AMPLITUDE = 0.5;

function seaSwellHeight(x: number, z: number): number {
  return SWELL_AMPLITUDE * (Math.sin(x * 0.05) * Math.cos(z * 0.045) + 0.4 * Math.sin((x + z) * 0.03));
}

/**
 * A calm sea: a gentle, permanent swell, not surface chop or animated
 * motion — see CLAUDE.md "Visual language": the sea is the backdrop the
 * whole world sits in, so it must read as calm open water, not a
 * distraction. Baked once into the geometry rather than updated per frame,
 * so there is nothing that can behave differently across browsers.
 */
export function buildSea(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_SEGMENTS, SEA_SEGMENTS);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, seaSwellHeight(position.getX(i), position.getY(i)));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: theme.untrusted.sea, roughness: 0.85, metalness: 0 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, SEA_LEVEL_Y, -10);
  mesh.userData.kind = "SEA";
  return mesh;
}
