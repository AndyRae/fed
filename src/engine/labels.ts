import * as THREE from "three";
import type { Engine } from "./renderer.ts";

/**
 * Labels beyond this distance from the camera fade out — legible up close,
 * uncluttered from an overview. ~18% further than the original 55/90: from
 * over the mainland, the islands sat just past the old fade-out, so their
 * labels vanished right when they'd be most useful for orienting.
 */
const FADE_START = 65;
const FADE_END = 105;

export interface LabelTarget {
  readonly object: THREE.Object3D;
  readonly text: string;
}

export interface LabelsHandle {
  dispose(): void;
}

/**
 * Persistent floating titles over the world's landmarks, PGSimCity-style —
 * but without its collision/placement engine, which exists to arbitrate
 * ~80 competing chips. This world has a couple dozen at most, so a plain
 * per-frame world-to-screen projection onto absolutely-positioned DOM
 * elements is enough; no second three.js renderer (CSS2DRenderer) needed.
 * Impure (DOM + camera projection each frame) — browser-verified.
 */
export function createLabels(engine: Engine, container: HTMLElement, targets: readonly LabelTarget[]): LabelsHandle {
  const layer = document.createElement("div");
  layer.className = "fsa-label-layer";
  container.appendChild(layer);

  const entries = targets.map((target) => {
    const el = document.createElement("div");
    el.className = "fsa-label";
    el.textContent = target.text;
    layer.appendChild(el);
    return { target, el };
  });

  const worldPos = new THREE.Vector3();

  const unsubscribe = engine.onBeforeRender(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    for (const { target, el } of entries) {
      target.object.getWorldPosition(worldPos);
      const distance = worldPos.distanceTo(engine.camera.position);
      worldPos.project(engine.camera);

      const behindCamera = worldPos.z > 1;
      if (behindCamera) {
        el.style.display = "none";
        continue;
      }

      const opacity = 1 - Math.min(1, Math.max(0, (distance - FADE_START) / (FADE_END - FADE_START)));
      if (opacity <= 0.02) {
        el.style.display = "none";
        continue;
      }

      const x = (worldPos.x * 0.5 + 0.5) * width;
      const y = (-worldPos.y * 0.5 + 0.5) * height;
      el.style.display = "";
      el.style.opacity = String(opacity);
      el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    }
  });

  return {
    dispose() {
      unsubscribe();
      layer.remove();
    },
  };
}
