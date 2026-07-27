import "./ui/styles.css";

import type { TreId } from "./core/types.ts";
import { createCameraRig } from "./engine/cameraRig.ts";
import { createFlowController } from "./engine/flowController.ts";
import { createEngine } from "./engine/renderer.ts";
import { createInitialSimState, decideOutputReview, decideProjectApproval, submitProject, submitTask, tick } from "./sim/sim.ts";
import { applyThemeCssVariables } from "./ui/cssTheme.ts";
import { mountHud } from "./ui/hud.ts";
import { startTourCard } from "./ui/tourCard.ts";
import { playTour } from "./ui/tourPlayer.ts";
import { journeyOfATaskTour, theResultThatNeverLeftTour } from "./ui/tours.ts";
import type { Tour } from "./ui/tourTypes.ts";
import { buildWorld, computeIslandGeometries } from "./world/world.ts";

applyThemeCssVariables();

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) {
  throw new Error("#app root element is missing");
}

const DEMO_TRES = [
  { id: "tre-a", name: "Isle of Ailsa" },
  { id: "tre-b", name: "Isle of Kessel" },
  { id: "tre-c", name: "Isle of Muck" },
];
const DEMO_PROJECT_ID = "proj-demo";

let currentState = createInitialSimState({ seed: 1, tres: DEMO_TRES, pollIntervalTicks: 3 });
currentState = submitProject(currentState, {
  id: DEMO_PROJECT_ID,
  name: "Cardiovascular Risk Study",
  researcher: "Dr. Amara Osei",
  targetTreIds: DEMO_TRES.map((t) => t.id),
});
for (const tre of DEMO_TRES) {
  currentState = submitTask(currentState, { id: `task-${tre.id}`, projectId: DEMO_PROJECT_ID, treId: tre.id });
}

const engine = createEngine(container);
const cameraRig = createCameraRig(engine);
cameraRig.setPose({
  position: { x: 0, y: 110, z: 130 },
  target: { x: 0, y: 0, z: -10 },
});

engine.scene.add(buildWorld(currentState));

// Shared by the ambient demo's flow controller and every tour's camera
// resolver, so a TRE's rendered position always matches whichever one is
// currently addressing it — see world.ts's computeIslandGeometries doc.
const islandGeometries = computeIslandGeometries(DEMO_TRES);
const flowController = createFlowController(engine, islandGeometries, () => currentState);

/**
 * The click-to-decide UI for Gate 1/Gate 2 doesn't exist yet — this
 * free-roam ambient demo stands in for it with a delayed timer, so the
 * queue still visibly holds rather than approving/releasing instantly
 * (honesty rule 3). The two flagship tours are where the refusal paths are
 * actually demonstrated — this demo is for proving the engine renders and
 * animates correctly outside a tour.
 */
function scheduleProjectApproval(treId: TreId, decidedBy: string, delayMs: number): void {
  setTimeout(() => {
    currentState = decideProjectApproval(currentState, {
      projectId: DEMO_PROJECT_ID,
      treId,
      decision: "APPROVED",
      decidedBy,
    });
  }, delayMs);
}
DEMO_TRES.forEach((tre, index) => {
  scheduleProjectApproval(tre.id, `Harbourmaster of ${tre.name}`, 1500 + index * 1800);
});

const scheduledForReview = new Set<string>();
function scheduleNewOutputReviews(): void {
  for (const crate of currentState.crates) {
    if (crate.status !== "HELD" || scheduledForReview.has(crate.id)) continue;
    scheduledForReview.add(crate.id);
    setTimeout(() => {
      currentState = decideOutputReview(currentState, { crateId: crate.id, decision: "RELEASED" });
    }, 2000);
  }
}

let ambientTimer: number | null = null;
function resumeAmbientDemo(): void {
  if (ambientTimer != null) return;
  ambientTimer = window.setInterval(() => {
    currentState = tick(currentState, 1);
    scheduleNewOutputReviews();
  }, 400);
}
function pauseAmbientDemo(): void {
  if (ambientTimer == null) return;
  window.clearInterval(ambientTimer);
  ambientTimer = null;
}
resumeAmbientDemo();

/**
 * Starts a tour: pauses the ambient demo and free-roam camera controls so
 * the tour card's cuts aren't fighting either one, and hands the camera to
 * the tour card until it's dismissed. Live ferry/crate motion driven by a
 * tour's own events (rather than the ambient demo's) is a follow-up — this
 * pass wires the camera and narration.
 */
function startTour(tour: Tour): void {
  pauseAmbientDemo();
  cameraRig.controls.enabled = false;
  startTourCard(document.body, {
    tour,
    islands: islandGeometries,
    onCameraPose: (pose) => cameraRig.setPose(pose),
    onExit: () => {
      cameraRig.controls.enabled = true;
      resumeAmbientDemo();
    },
  });
}

mountHud(document.body, {
  tours: [journeyOfATaskTour, theResultThatNeverLeftTour],
  onStartTour: startTour,
});

/** The browser debugging surface — see CLAUDE.md "Architecture". Event bus lands with the inspector pass. */
declare global {
  interface Window {
    ARCHIPELAGO: {
      readonly sim: typeof currentState;
      readonly cameraRig: typeof cameraRig;
      readonly flowController: typeof flowController;
      readonly engine: typeof engine;
      readonly tours: {
        journeyOfATaskTour: typeof journeyOfATaskTour;
        theResultThatNeverLeftTour: typeof theResultThatNeverLeftTour;
        playTour: typeof playTour;
      };
    };
  }
}

window.ARCHIPELAGO = {
  get sim() {
    return currentState;
  },
  cameraRig,
  flowController,
  engine,
  tours: { journeyOfATaskTour, theResultThatNeverLeftTour, playTour },
};
