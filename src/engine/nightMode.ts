import * as THREE from "three";
import { createVerticalGradientTexture } from "./renderer.ts";

/**
 * The minimal surface this needs from the renderer — same narrow-host
 * precedent as flowController.ts's FlowSceneHost and vaultShimmer.ts's own
 * host: real `Engine` satisfies this structurally, but plain constructed
 * three.js objects are enough to test it without a WebGL context. No
 * `onBeforeRender` here — unlike the other engine/ controllers, this one
 * is a single instantaneous toggle, not a per-frame animation.
 */
export interface NightModeHost {
  readonly scene: THREE.Scene;
  readonly hemiLight: THREE.HemisphereLight;
  readonly sunLight: THREE.DirectionalLight;
}

export interface NightModeHandle {
  toggle(): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

export interface NightModeOptions {
  /**
   * Defaults to a baked gradient texture built via `document.createElement`
   * — override in tests (a plain `new THREE.Texture()` is enough) so the
   * rest of this controller's logic stays testable without a DOM, the same
   * reasoning `src/ui`'s DOM-only modules are exempt from unit tests for.
   */
  readonly nightSky?: THREE.Texture;
}

// Structurally the same technique as renderer.ts's own day sky — lighter
// near the horizon, deeper toward the top of frame — just recoloured for a
// clear night. A dark backdrop is what makes the island glow (below) read
// as "lit up at night" rather than merely tinted.
const NIGHT_SKY_STOPS: readonly [number, string][] = [
  [0, "#040711"],
  [0.55, "#0b1330"],
  [1, "#1b2b4d"],
];
const NIGHT_FOG_COLOR = 0x0b1330;

const NIGHT_HEMI_SKY_COLOR = 0x223257;
const NIGHT_HEMI_GROUND_COLOR = 0x0a0d16;
const NIGHT_HEMI_INTENSITY = 0.35;
const NIGHT_SUN_COLOR = 0xaebfe8;
const NIGHT_SUN_INTENSITY = 0.45;

// Every island-owned material glows in its own colour at night — the same
// "more vibrant" effect a lit window or a lantern gets against a dark sky.
// Uniform across every part on purpose: this is one effect applied evenly,
// not a hand-tuned lighting design, so it can never accidentally suggest a
// new semantic meaning for any one colour.
const ISLAND_GLOW_INTENSITY = 0.45;

/** True if `object` or any ancestor belongs to a specific island — every top-level mesh `src/world/island.ts` and `src/engine/flowController.ts` build carries `userData.treId`, but most of their decorative children (a roof, a tree, a wake dot's own ferry) don't carry it themselves, so this walks up rather than checking `object` alone. Deliberately excludes the sea, the mainland, and the whale, none of which are ever tagged with a treId — night mode must only make islands glow, not everything in the scene. */
function belongsToAnIsland(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.treId !== undefined) return true;
    current = current.parent;
  }
  return false;
}

function setMaterialNightGlow(material: THREE.MeshStandardMaterial, enabled: boolean): void {
  if (enabled) {
    if (material.userData.dayEmissive === undefined) {
      material.userData.dayEmissive = material.emissive.getHex();
      material.userData.dayEmissiveIntensity = material.emissiveIntensity;
    }
    material.emissive.copy(material.color);
    material.emissiveIntensity = ISLAND_GLOW_INTENSITY;
  } else if (material.userData.dayEmissive !== undefined) {
    material.emissive.setHex(material.userData.dayEmissive as number);
    material.emissiveIntensity = material.userData.dayEmissiveIntensity as number;
  }
}

function applyIslandGlow(scene: THREE.Scene, enabled: boolean): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!belongsToAnIsland(object)) return;
    if (object.material instanceof THREE.MeshStandardMaterial) setMaterialNightGlow(object.material, enabled);
  });
}

/**
 * A purely cosmetic day/night toggle: it darkens the sky and the two
 * lights, and makes every island's own material glow softly in its own
 * colour — including gate markers, the vault, and any island-owned ferry
 * or crate. It reads no SimState and changes no protocol geometry, motion,
 * or timing; CLAUDE.md's honesty rules govern what things do and where
 * they go, not how brightly they're lit.
 */
export function createNightModeController(host: NightModeHost, options: NightModeOptions = {}): NightModeHandle {
  const daySky = host.scene.background;
  const dayFog = host.scene.fog instanceof THREE.Fog ? host.scene.fog.color.getHex() : undefined;
  const nightSky = options.nightSky ?? createVerticalGradientTexture(NIGHT_SKY_STOPS);

  const dayHemi = { color: host.hemiLight.color.getHex(), groundColor: host.hemiLight.groundColor.getHex(), intensity: host.hemiLight.intensity };
  const daySun = { color: host.sunLight.color.getHex(), intensity: host.sunLight.intensity };

  let enabled = false;

  function setEnabled(next: boolean): void {
    enabled = next;

    host.scene.background = enabled ? nightSky : daySky;
    if (host.scene.fog instanceof THREE.Fog) {
      host.scene.fog.color.setHex(enabled ? NIGHT_FOG_COLOR : (dayFog ?? NIGHT_FOG_COLOR));
    }

    host.hemiLight.color.setHex(enabled ? NIGHT_HEMI_SKY_COLOR : dayHemi.color);
    host.hemiLight.groundColor.setHex(enabled ? NIGHT_HEMI_GROUND_COLOR : dayHemi.groundColor);
    host.hemiLight.intensity = enabled ? NIGHT_HEMI_INTENSITY : dayHemi.intensity;

    host.sunLight.color.setHex(enabled ? NIGHT_SUN_COLOR : daySun.color);
    host.sunLight.intensity = enabled ? NIGHT_SUN_INTENSITY : daySun.intensity;

    applyIslandGlow(host.scene, enabled);
  }

  function toggle(): void {
    setEnabled(!enabled);
  }

  return {
    toggle,
    setEnabled,
    isEnabled: () => enabled,
  };
}
