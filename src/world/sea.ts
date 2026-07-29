import * as THREE from "three";
import { theme } from "../core/theme.ts";
import { SEA_LEVEL_Y } from "./layout.ts";

/** The whole open-water surface. Everything between trust zones is open water. */
const SEA_SIZE = 260;
/** Wave wavelengths below are all well over 100 units; this resolution keeps per-vertex interpolation smooth without any per-pixel cost. */
const SEA_SEGMENTS = 64;

/**
 * Three low, gentle travelling swells, summed — vertical displacement
 * only, never a horizontal/Gerstner term, so the surface can never read
 * as "choppy" however it's tuned: that's a property of the shape, not a
 * dial. Kept slow and low-amplitude ("low wind") on purpose. Animated by
 * engine/seaController.ts advancing `uTime`, not by anything in this
 * file — same split as vaultShimmer.ts's "what it looks like" vs "how it
 * moves". See CLAUDE.md "Visual language": waves are named there as an
 * example of decorative ambient motion that's allowed, provided it stays
 * visually subordinate.
 *
 * Injected into MeshStandardMaterial's own vertex shader via
 * onBeforeCompile, rather than a bespoke ShaderMaterial, so the sea keeps
 * every bit of the ordinary lighting/shadow/fog pipeline the rest of the
 * world already uses.
 */
const WAVE_GLSL_FUNCTION = /* glsl */ `
uniform float uTime;

float fsaWave(vec2 p, float t, out vec3 waveNormal) {
  float h = 0.0;
  vec2 dh = vec2(0.0);

  vec2 k1 = vec2(0.045, 0.02);
  float phase1 = dot(k1, p) + t * 0.10;
  h += 0.9 * sin(phase1);
  dh += 0.9 * cos(phase1) * k1;

  vec2 k2 = vec2(-0.02, 0.05);
  float phase2 = dot(k2, p) + t * 0.07;
  h += 0.6 * sin(phase2);
  dh += 0.6 * cos(phase2) * k2;

  vec2 k3 = vec2(0.03, -0.035);
  float phase3 = dot(k3, p) + t * 0.14;
  h += 0.35 * sin(phase3);
  dh += 0.35 * cos(phase3) * k3;

  waveNormal = normalize(vec3(-dh.x, -dh.y, 1.0));
  return h;
}
`;

/**
 * Hooks the wave function above into the material's own compiled shader.
 * beginnormal_vertex runs before begin_vertex in three.js's own vertex
 * shader template (see meshphysical.glsl.js), so the height computed
 * while overriding the normal is still in scope — computed once, not
 * twice — by the time begin_vertex needs it.
 */
function installWaveShader(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", `${WAVE_GLSL_FUNCTION}\nvoid main() {`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        vec3 fsaNormal;
        float fsaWaveHeight = fsaWave(position.xy, uTime, fsaNormal);
        objectNormal = fsaNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        transformed.z += fsaWaveHeight;`,
      );
    material.userData.shader = shader;
  };
  // onBeforeCompile mutations aren't reflected in three.js's default
  // program-cache key; only one sea material ever exists at a time, but
  // this keeps that assumption from silently breaking later.
  material.customProgramCacheKey = () => "fsa-sea-wave-v1";
}

/**
 * A calm sea: a gentle, always-animated swell — see CLAUDE.md "Visual
 * language": the sea is the backdrop the whole world sits in, so it must
 * read as calm open water, not a distraction.
 */
export function buildSea(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_SEGMENTS, SEA_SEGMENTS);
  const material = new THREE.MeshStandardMaterial({ color: theme.untrusted.sea, roughness: 0.85, metalness: 0 });
  installWaveShader(material);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, SEA_LEVEL_Y, -10);
  mesh.userData.kind = "SEA";
  return mesh;
}
