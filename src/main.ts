import "./ui/styles.css";

import type * as THREE from "three";
import { explanationForKind } from "./core/explanations.ts";
import type { SimState, TreId } from "./core/types.ts";
import { createCameraRig } from "./engine/cameraRig.ts";
import { createFlowController, type FlowController } from "./engine/flowController.ts";
import { createLabels } from "./engine/labels.ts";
import { createPicker } from "./engine/picking.ts";
import { createEngine } from "./engine/renderer.ts";
import { createSeaAnimator } from "./engine/seaAnimator.ts";
import { createRng } from "./sim/rng.ts";
import { createInitialSimState, decideOutputReview, decideProjectApproval, submitProject, submitTask, tick } from "./sim/sim.ts";
import { applyThemeCssVariables } from "./ui/cssTheme.ts";
import { mountHud } from "./ui/hud.ts";
import { mountInspectorPanel } from "./ui/inspectorPanel.ts";
import { mountStatsPanel } from "./ui/statsPanel.ts";
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

// Kept to one island for faster iteration during active development —
// buildWorld/computeIslandGeometries/the flow controller are all already
// generic over an arbitrary TRE count, so restoring more islands later is
// just growing this list. See CLAUDE.md's world metaphor table.
const DEMO_TRES = [{ id: "tre-a", name: "Isle of Ailsa" }];

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

let currentState = createInitialSimState({ seed: 1, tres: DEMO_TRES, pollIntervalTicks: 2 });

const engine = createEngine(container);
const cameraRig = createCameraRig(engine);
cameraRig.setPose({
  position: { x: 0, y: 50, z: 60 },
  target: { x: 0, y: 0, z: -5 },
});

const worldGroup = buildWorld(currentState);
engine.scene.add(worldGroup);

// Ambient decorative motion, entirely independent of SimState and of
// whether a tour or free-roam owns the camera right now — see CLAUDE.md
// "Visual language": it never pauses/swaps the way flowController does.
let seaMesh: THREE.Mesh | undefined;
worldGroup.traverse((object) => {
  if (object.userData.kind === "SEA") seaMesh = object as THREE.Mesh;
});
if (seaMesh) createSeaAnimator(engine, seaMesh);

// Shared by the ambient demo's flow controller and every tour's camera
// resolver, so a TRE's rendered position always matches whichever one is
// currently addressing it — see world.ts's computeIslandGeometries doc.
const islandGeometries = computeIslandGeometries(DEMO_TRES);
let flowController: FlowController = createFlowController(engine, islandGeometries, () => currentState);

const treNames = new Map(DEMO_TRES.map((t) => [t.id, t.name]));

/**
 * Curated landmark subset for persistent floating labels — every named
 * "point of interest" per island (including that island's own customs
 * hall), plus the mainland's equivalent. Structural/background meshes
 * (ISLAND_LAND, ISLAND_WALL, MAINLAND_LAND,
 * SEA, ...) stay clickable via the picker below, but don't get their own
 * always-on label — with this many of them on screen at once, that would
 * be clutter rather than explanation.
 */
const LABELLED_KINDS = new Set([
  "VAULT",
  "WORKSHOP",
  "GATE1_HARBOURMASTER",
  "GATE2_INSPECTOR",
  "CUSTOMS_HALL",
  "MAINLAND_DOCK",
]);
const labelTargets: { object: typeof worldGroup; text: string }[] = [];
worldGroup.traverse((object) => {
  const kind = object.userData.kind as string | undefined;
  if (!kind) return;

  // The whole-island and whole-mainland labels use each TRE's real name
  // rather than explanations.ts's generic title, so "Isle of Ailsa" reads
  // above the island itself and "The mainland" above the mainland.
  if (kind === "TRE_LABEL_ANCHOR") {
    const treId = object.userData.treId as TreId;
    labelTargets.push({ object, text: treNames.get(treId) ?? treId });
    return;
  }
  if (kind === "MAINLAND_LABEL_ANCHOR") {
    labelTargets.push({ object, text: explanationForKind("MAINLAND_LAND")?.title ?? "The mainland" });
    return;
  }

  if (!LABELLED_KINDS.has(kind)) return;
  const explanation = explanationForKind(kind);
  if (!explanation) return;
  labelTargets.push({ object, text: explanation.title });
});
createLabels(engine, container, labelTargets);

const inspector = mountInspectorPanel(document.body, {
  treNames,
  getState: () => currentState,
});

const statsPanel = mountStatsPanel(document.body, {
  getState: () => currentState,
});

const picker = createPicker({
  engine,
  root: worldGroup,
  onHoverChange: (object) => {
    engine.renderer.domElement.style.cursor = object ? "pointer" : "";
  },
  onSelect: (object) => {
    if (object) inspector.show(object);
    else inspector.hide();
  },
});

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
    // Long enough that the crate has already visibly arrived and parked at
    // this island's own customs hall (the flow controller's hold leg is
    // well under a second) before "a human" decides — honesty rule 3, the
    // queue must visibly hold, not just skip straight to the outcome.
    setTimeout(() => {
      currentState = decideOutputReview(currentState, { crateId: crate.id, decision: "RELEASED" });
    }, 1600);
  }
}

// All randomness in this ambient demo goes through this one seeded RNG —
// see CLAUDE.md "Simulation model". Purely cosmetic (which study/researcher
// name shows up), never used for protocol decisions.
const demoRng = createRng(7);
function pickFrom<T>(items: readonly T[]): T {
  return items[Math.floor(demoRng() * items.length)]!;
}

const MAX_DEMO_PROJECTS = 110;
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
    scheduleProjectApproval(id, tre.id, `Harbourmaster of ${tre.name}`, 700 + index * 700);
  });
}
spawnDemoProject();
window.setInterval(spawnDemoProject, 2400);

let ambientTimer: number | null = null;
function resumeAmbientDemo(): void {
  if (ambientTimer != null) return;
  ambientTimer = window.setInterval(() => {
    currentState = tick(currentState, 1);
    scheduleNewOutputReviews();
    statsPanel.update();
  }, 260);
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
  picker.setEnabled(false);
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
      picker.setEnabled(true);
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

/** The browser debugging surface — see CLAUDE.md "Architecture". Event bus is still the one piece not built yet. */
declare global {
  interface Window {
    ARCHIPELAGO: {
      readonly sim: typeof currentState;
      readonly cameraRig: typeof cameraRig;
      readonly flowController: FlowController;
      readonly engine: typeof engine;
      readonly picker: typeof picker;
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
  picker,
  tours: { journeyOfATaskTour, theResultThatNeverLeftTour, playTour },
};
