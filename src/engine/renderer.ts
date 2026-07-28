import * as THREE from "three";

/**
 * A soft vertical gradient, lighter near the horizon and deeper toward the
 * top of frame — replaces a flat solid colour with something that reads as
 * open sky. Baked once into a tiny texture (no shader, no per-frame cost),
 * consistent with this codebase's preference for static, cheap effects over
 * anything that could behave differently across browsers or GPUs.
 */
function createSkyGradientTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#bfe7f7");
  gradient.addColorStop(0.6, "#a9defa");
  gradient.addColorStop(1, "#8fcdf0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Scene/camera/renderer bootstrap. No protocol logic lives here — this is
 * rendering infrastructure, verified in the browser rather than by unit
 * test (a WebGL context doesn't exist in the Node test environment; see
 * CLAUDE.md "Verify the deliverable, not a nearby state").
 */
export interface Engine {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** Registers a callback run once per frame before rendering (e.g. camera controls, flow animation). Returns an unsubscribe function. */
  onBeforeRender(fn: (deltaSeconds: number) => void): () => void;
  dispose(): void;
}

export function createEngine(container: HTMLElement): Engine {
  const scene = new THREE.Scene();
  scene.background = createSkyGradientTexture();
  scene.fog = new THREE.Fog(0xbfe7f7, 70, 200);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 500);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  // PCFSoftShadowMap for a gentle penumbra rather than a hard-edged cutout;
  // a modest 1024 shadow map (set below, per-light) keeps this affordable on
  // the low-spec, sometimes-software-rendered machines this must run on —
  // see CLAUDE.md "Stack" and "Limit parallel browser rendering".
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcab98a, 1.25);
  scene.add(hemiLight);
  const sunLight = new THREE.DirectionalLight(0xfff2d6, 1.7);
  sunLight.position.set(50, 80, 35);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  // A generous, symmetric orthographic frustum around the world's origin —
  // comfortably covers the mainland-plus-island extent (the whole world sits
  // within roughly ±50 units of the origin) at any light-space orientation,
  // rather than a tightly hand-fitted box that would need re-tuning every
  // time geography changes. Costs a little shadow resolution; worth it for
  // not having a shadow silently clip off-frustum after a future layout.ts
  // tweak.
  sunLight.shadow.camera.left = -70;
  sunLight.shadow.camera.right = 70;
  sunLight.shadow.camera.top = 70;
  sunLight.shadow.camera.bottom = -70;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 220;
  sunLight.shadow.bias = -0.0015;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const beforeRenderCallbacks = new Set<(deltaSeconds: number) => void>();
  function onBeforeRender(fn: (deltaSeconds: number) => void): () => void {
    beforeRenderCallbacks.add(fn);
    return () => beforeRenderCallbacks.delete(fn);
  }

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener("resize", onResize);

  let running = true;
  let lastTime = performance.now();
  function frame(now: number) {
    if (!running) return;
    const deltaSeconds = (now - lastTime) / 1000;
    lastTime = now;
    for (const fn of beforeRenderCallbacks) fn(deltaSeconds);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    scene,
    camera,
    renderer,
    onBeforeRender,
    dispose() {
      running = false;
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}
