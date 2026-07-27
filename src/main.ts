import "./ui/styles.css";

import type { SimState, TreId } from "./core/types.ts";
import { createCameraRig } from "./engine/cameraRig.ts";
import { createFlowController, type FlowController } from "./engine/flowController.ts";
import { createEngine } from "./engine/renderer.ts";
import { createRng } from "./sim/rng.ts";
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

const STUDY_NAMES = [
  "Cardiovascular Risk Study",
  "Diabetes Cohort Study",
  "Retinal Imaging Study",
  "Genomic Variant Survey",
  "Respiratory Outcomes Trial",
  "Maternal Health Registry",
];
const RESEARCHERS = [
  "Dr. Amara Osei",
  "Dr. Femi Adeyemi",
  "Dr. Priya Nair",
  "Dr. Liang Chen",
  "Dr. Sofia Marín",
  "Dr. Kwame Mensah",
];

let currentState = createInitialSimState({ seed: 1, tres: DEMO_TRES, pollIntervalTicks: 3 });

const engine = createEngine(container);
const cameraRig = createCameraRig(engine);
cameraRig.setPose({
  position: { x: 0, y: 50, z: 60 },
  target: { x: 0, y: 0, z: -5 },
});

engine.scene.add(buildWorld(currentState));

// Shared by the ambient demo's flow controller and every tour's camera
// resolver, so a TRE's rendered position always matches whichever one is
// currently addressing it — see world.ts's computeIslandGeometries doc.
const islandGeometries = computeIslandGeometries(DEMO_TRES);
let flowController: FlowController = createFlowController(engine, islandGeometries, () => currentState);

/**
 * The click-to-decide UI for Gate 1/Gate 2 doesn't exist yet — this
 * free-roam ambient demo stands in for it with a delayed timer, so the
 * queue still visibly holds rather than approving/releasing instantly
 * (honesty rule 3). The two flagship tours are where the refusal paths are
 * actually demonstrated — this demo is for proving the engine renders and
 * animates correctly outside a tour.
 */
function scheduleProjectApproval(projectId: string, treId: TreId, decidedBy: string, delayMs: number): void {
  setTimeout(() => {
    currentState = decideProjectApproval(currentState, {
      projectId,
      treId,
      decision: "APPROVED",
      decidedBy,
    });
  }, delayMs);
}

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

// All randomness in this ambient demo goes through this one seeded RNG —
// see CLAUDE.md "Simulation model". Purely cosmetic (which study/researcher
// name shows up), never used for protocol decisions.
const demoRng = createRng(7);
function pickFrom<T>(items: readonly T[]): T {
  return items[Math.floor(demoRng() * items.length)]!;
}

const MAX_DEMO_PROJECTS = 60;
let projectCounter = 0;

/**
 * Submits one new project to every island and schedules its approvals, so
 * ferries keep departing and returning indefinitely instead of the world
 * going static after the first round trip. Capped so an indefinitely open
 * tab doesn't grow SimState's arrays without bound.
 */
function spawnDemoProject(): void {
  if (projectCounter >= MAX_DEMO_PROJECTS) return;
  const id = `proj-demo-${projectCounter++}`;
  currentState = submitProject(currentState, {
    id,
    name: pickFrom(STUDY_NAMES),
    researcher: pickFrom(RESEARCHERS),
    targetTreIds: DEMO_TRES.map((t) => t.id),
  });
  DEMO_TRES.forEach((tre, index) => {
    currentState = submitTask(currentState, { id: `task-${id}-${tre.id}`, projectId: id, treId: tre.id });
    scheduleProjectApproval(id, tre.id, `Harbourmaster of ${tre.name}`, 1200 + index * 1200);
  });
}
spawnDemoProject();
window.setInterval(spawnDemoProject, 4500);

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

const CAMERA_FLIGHT_SECONDS = 1.5;

/**
 * Starts a tour: pauses the ambient demo and free-roam camera controls so
 * the tour card's cuts aren't fighting either one, and swaps the ambient
 * flow controller for one scoped to the tour's own precomputed timeline —
 * two flow controllers must never coexist, or the same TRE would get two
 * overlapping ferry meshes. `tourState` is set synchronously by
 * onStateChange during the tour card's first render, before this function
 * returns and before any animation frame can run the tour flow controller's
 * getState — see the comment below for why the `!` is safe.
 */
function startTour(tour: Tour): void {
  pauseAmbientDemo();
  cameraRig.controls.enabled = false;
  flowController.dispose();

  let tourState: SimState | null = null;
  const tourFlowController = createFlowController(engine, islandGeometries, () => tourState!);

  startTourCard(document.body, {
    tour,
    islands: islandGeometries,
    onCameraPose: (pose) => cameraRig.flyTo(pose, CAMERA_FLIGHT_SECONDS),
    onStateChange: (state) => {
      tourState = state;
    },
    onExit: () => {
      tourFlowController.dispose();
      cameraRig.controls.enabled = true;
      // Recreate against the ambient state's current history so it doesn't
      // replay every ferry/crate departure that already happened.
      flowController = createFlowController(engine, islandGeometries, () => currentState, {
        startFromCurrentEvents: true,
      });
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
      readonly flowController: FlowController;
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
  get flowController() {
    return flowController;
  },
  engine,
  tours: { journeyOfATaskTour, theResultThatNeverLeftTour, playTour },
};
