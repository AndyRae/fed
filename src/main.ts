import { createCameraRig } from "./engine/cameraRig.ts";
import { createEngine } from "./engine/renderer.ts";
import { createInitialSimState } from "./sim/sim.ts";
import { playTour } from "./ui/tourPlayer.ts";
import { journeyOfATaskTour, theResultThatNeverLeftTour } from "./ui/tours.ts";
import { buildWorld } from "./world/world.ts";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) {
  throw new Error("#app root element is missing");
}

const demoSimState = createInitialSimState({
  seed: 1,
  tres: [
    { id: "tre-a", name: "Isle of Ailsa" },
    { id: "tre-b", name: "Isle of Kessel" },
    { id: "tre-c", name: "Isle of Muck" },
  ],
});

const engine = createEngine(container);
const cameraRig = createCameraRig(engine);
cameraRig.setPose({
  position: { x: 0, y: 110, z: 130 },
  target: { x: 0, y: 0, z: -10 },
});

engine.scene.add(buildWorld(demoSimState));

/**
 * The browser debugging surface — see CLAUDE.md "Architecture". Event bus
 * and flow controller land with ferry/crate animation in a later pass.
 */
declare global {
  interface Window {
    ARCHIPELAGO: {
      sim: typeof demoSimState;
      cameraRig: typeof cameraRig;
      tours: {
        journeyOfATaskTour: typeof journeyOfATaskTour;
        theResultThatNeverLeftTour: typeof theResultThatNeverLeftTour;
        playTour: typeof playTour;
      };
    };
  }
}

window.ARCHIPELAGO = {
  sim: demoSimState,
  cameraRig,
  tours: { journeyOfATaskTour, theResultThatNeverLeftTour, playTour },
};
