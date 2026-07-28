import * as THREE from "three";
import { findPickableAncestor } from "./picking.ts";
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

// The *objects* glow at night, not the ground they stand on — real
// buildings and vehicles on both the mainland and every island, the same
// "lit window" effect a real settlement gets against a dark sky. Ground,
// beach, the wall, the dock's own jetty, and route lines darken along with
// the sea instead, exactly like the mainland's own terrain already did:
// this is the same rule applied uniformly to both, not an island-only
// effect and not a mainland-only exemption.
const GLOWING_KINDS = new Set<string>([
  "QUAY_OFFICE",
  "MAINLAND_BUILDING",
  "RESEARCHER_QUARTER",
  "VAULT",
  "WORKSHOP",
  "GATE1_HARBOURMASTER",
  "GATE2_INSPECTOR",
  "CUSTOMS_HALL",
  "FERRY",
  "CONTAINER",
  "CRATE",
  "SUBMISSION",
]);

const GLOW_INTENSITY = 0.45;

/**
 * True if `object` is, or is nested under, one of `GLOWING_KINDS` — reuses
 * picking.ts's own "walk up to the nearest `userData.kind`-tagged ancestor"
 * rule, since a building's roof or a vault's plinth never carries its own
 * kind tag, only the structure itself does. A grass patch's nearest tagged
 * ancestor is `ISLAND_LAND`, not in the set, so it's correctly excluded;
 * a workshop's roof cap's nearest tagged ancestor is `WORKSHOP`, so it's
 * correctly included.
 */
function isGlowingStructure(object: THREE.Object3D): boolean {
  const kind = findPickableAncestor(object)?.userData.kind as string | undefined;
  return kind !== undefined && GLOWING_KINDS.has(kind);
}

function setMaterialNightGlow(material: THREE.MeshStandardMaterial, enabled: boolean): void {
  if (enabled) {
    if (material.userData.dayEmissive === undefined) {
      material.userData.dayEmissive = material.emissive.getHex();
      material.userData.dayEmissiveIntensity = material.emissiveIntensity;
    }
    material.emissive.copy(material.color);
    material.emissiveIntensity = GLOW_INTENSITY;
  } else if (material.userData.dayEmissive !== undefined) {
    material.emissive.setHex(material.userData.dayEmissive as number);
    material.emissiveIntensity = material.userData.dayEmissiveIntensity as number;
  }
}

function applyStructureGlow(scene: THREE.Scene, enabled: boolean): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!isGlowingStructure(object)) return;
    if (object.material instanceof THREE.MeshStandardMaterial) setMaterialNightGlow(object.material, enabled);
  });
}

/**
 * A purely cosmetic day/night toggle: it darkens the sky, the two lights,
 * and every stretch of ground and water, while every building and vehicle
 * — on the mainland and on every island alike — glows softly in its own
 * colour, the two gates and the vault included. It reads no SimState and
 * changes no protocol geometry, motion, or timing; CLAUDE.md's honesty
 * rules govern what things do and where they go, not how brightly they're
 * lit.
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

    applyStructureGlow(host.scene, enabled);
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
