import * as THREE from "three";

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
  scene.background = new THREE.Color(0x0a0e14);
  scene.fog = new THREE.Fog(0x0a0e14, 120, 260);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 500);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xdfe9f0, 0x14202c, 1.1);
  scene.add(hemiLight);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
  sunLight.position.set(60, 90, 40);
  scene.add(sunLight);

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
