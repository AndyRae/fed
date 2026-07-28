import * as THREE from "three";
import type { Engine } from "./renderer.ts";

/** How subtle the hover wireframe is, relative to a selected one — see CLAUDE.md "Visual language": motion and emphasis carry meaning, so hover previews the same drawing selection uses, just dimmer. */
const HOVER_OPACITY = 0.35;
const SELECT_OPACITY = 0.9;
const HIGHLIGHT_COLOR = 0xffffff;
const HIGHLIGHT_SCALE = 1.02;

/** Pointer travel that still counts as a click rather than a camera drag, in CSS px. */
const CLICK_PX = 6;
/** Press-to-release time that still counts as a click, in ms. */
const CLICK_MS = 400;
/** Raycast hover at most this often. */
const HOVER_THROTTLE_MS = 33;

/**
 * Walks up from `object` to the nearest ancestor (inclusive) carrying a
 * `userData.kind` tag — every mesh `src/world`'s builders create is tagged
 * directly, but this is a defensive net for anything that isn't. Pure: no
 * three.js scene traversal beyond `.parent`, so it's testable with plain
 * constructed object trees.
 */
export function findPickableAncestor(object: THREE.Object3D | null): THREE.Object3D | null {
  let current = object;
  while (current) {
    if (typeof current.userData.kind === "string") return current;
    current = current.parent;
  }
  return null;
}

export interface PickerOptions {
  readonly engine: Engine;
  readonly root: THREE.Object3D;
  /** Fired when the hovered entity changes (null when nothing is hovered). */
  readonly onHoverChange?: (object: THREE.Object3D | null) => void;
  /** Fired on a genuine click (not a camera-drag release) — null if the click hit nothing pickable. */
  readonly onSelect?: (object: THREE.Object3D | null) => void;
}

export interface PickerHandle {
  /** Programmatically sets or clears the persistent selection highlight. */
  setSelected(object: THREE.Object3D | null): void;
  /** Turns pointer handling on/off — e.g. disabled while a tour has taken over the camera and narration. Disabling clears any current hover/selection. */
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

/**
 * Every pickable object in this world — including route tracks, see
 * src/world/routes.ts — is a real Mesh, so a bright EdgesGeometry duplicate
 * of its silhouette is enough; the highlight owns its own geometry (cloned
 * from EdgesGeometry, never a shared reference), so disposing it later can
 * never affect the original object.
 */
function buildWireframe(object: THREE.Object3D, opacity: number): THREE.LineSegments | null {
  let highlight: THREE.LineSegments | null = null;
  if (object instanceof THREE.Mesh && object.geometry) {
    const edges = new THREE.EdgesGeometry(object.geometry, 25);
    const material = new THREE.LineBasicMaterial({ color: HIGHLIGHT_COLOR, transparent: true, opacity, depthTest: false });
    highlight = new THREE.LineSegments(edges, material);
    highlight.scale.multiplyScalar(HIGHLIGHT_SCALE);
  }
  if (!highlight) return null;

  highlight.renderOrder = 999;
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  object.updateWorldMatrix(true, false);
  object.matrixWorld.decompose(position, quaternion, scale);
  highlight.position.copy(position);
  highlight.quaternion.copy(quaternion);
  if (object instanceof THREE.Mesh) highlight.scale.multiply(scale);
  return highlight;
}

/**
 * Raycasts pointer events against `root`, reporting hover/click on the
 * nearest tagged ancestor and drawing a subtle wireframe outline for both —
 * the "architect's blueprint" treatment: hover previews at low intensity,
 * a click's selection stays lit until something else is picked. Impure
 * (DOM events, three.js raycasting) — verified in the browser, same
 * precedent as renderer.ts and cameraRig.ts.
 */
export function createPicker(options: PickerOptions): PickerHandle {
  const { engine, root } = options;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const highlightGroup = new THREE.Group();
  engine.scene.add(highlightGroup);

  let hoverWireframe: THREE.LineSegments | null = null;
  let selectWireframe: THREE.LineSegments | null = null;
  let hovered: THREE.Object3D | null = null;
  let selected: THREE.Object3D | null = null;
  let lastHoverCheck = 0;
  let enabled = true;

  let downX = 0;
  let downY = 0;
  let downAt = 0;

  function pick(clientX: number, clientY: number): THREE.Object3D | null {
    const rect = engine.renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, engine.camera);
    const hits = raycaster.intersectObject(root, true);
    for (const hit of hits) {
      const ancestor = findPickableAncestor(hit.object);
      if (ancestor) return ancestor;
    }
    return null;
  }

  function setHoverWireframe(object: THREE.Object3D | null): void {
    if (hoverWireframe) {
      highlightGroup.remove(hoverWireframe);
      hoverWireframe.geometry.dispose();
      (hoverWireframe.material as THREE.Material).dispose();
      hoverWireframe = null;
    }
    if (object && object !== selected) {
      hoverWireframe = buildWireframe(object, HOVER_OPACITY);
      if (hoverWireframe) highlightGroup.add(hoverWireframe);
    }
  }

  function setSelectWireframe(object: THREE.Object3D | null): void {
    if (selectWireframe) {
      highlightGroup.remove(selectWireframe);
      selectWireframe.geometry.dispose();
      (selectWireframe.material as THREE.Material).dispose();
      selectWireframe = null;
    }
    if (object) {
      selectWireframe = buildWireframe(object, SELECT_OPACITY);
      if (selectWireframe) highlightGroup.add(selectWireframe);
    }
  }

  function setSelected(object: THREE.Object3D | null): void {
    selected = object;
    setSelectWireframe(object);
    // Selecting the currently-hovered object should not leave a dim hover
    // outline doubled up under the bright selection outline.
    if (hovered === object) setHoverWireframe(null);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!enabled) return;
    const now = performance.now();
    if (now - lastHoverCheck < HOVER_THROTTLE_MS) return;
    lastHoverCheck = now;
    const picked = pick(event.clientX, event.clientY);
    if (picked === hovered) return;
    hovered = picked;
    setHoverWireframe(picked);
    options.onHoverChange?.(picked);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!enabled) return;
    downX = event.clientX;
    downY = event.clientY;
    downAt = performance.now();
  }

  function onPointerUp(event: PointerEvent): void {
    if (!enabled) return;
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    const travelled = Math.hypot(dx, dy);
    const held = performance.now() - downAt;
    if (travelled > CLICK_PX || held > CLICK_MS) return; // a camera drag, not a click
    const picked = pick(event.clientX, event.clientY);
    setSelected(picked);
    options.onSelect?.(picked);
  }

  const dom = engine.renderer.domElement;
  dom.addEventListener("pointermove", onPointerMove);
  dom.addEventListener("pointerdown", onPointerDown);
  dom.addEventListener("pointerup", onPointerUp);

  function setEnabled(next: boolean): void {
    enabled = next;
    if (!enabled) {
      hovered = null;
      setHoverWireframe(null);
      setSelected(null);
      options.onSelect?.(null);
    }
  }

  return {
    setSelected,
    setEnabled,
    dispose() {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointerup", onPointerUp);
      setHoverWireframe(null);
      setSelectWireframe(null);
      engine.scene.remove(highlightGroup);
    },
  };
}
