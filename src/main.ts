import "./ui/styles.css";

import type * as THREE from "three";
import { explanationForKind } from "./core/explanations.ts";
import type { SimState, TreId } from "./core/types.ts";
import { createCameraRig } from "./engine/cameraRig.ts";
import { createFlowController, type FlowController } from "./engine/flowController.ts";
import { createLabels } from "./engine/labels.ts";
import { createNightModeController } from "./engine/nightMode.ts";
import { createPicker } from "./engine/picking.ts";
import { createEngine } from "./engine/renderer.ts";
import { createVaultShimmer } from "./engine/vaultShimmer.ts";
import { createWhaleController, type WhaleExclusionZone } from "./engine/whaleController.ts";
import { createRng } from "./sim/rng.ts";
import { createInitialSimState, decideOutputReview, decideProjectApproval, submitProject, submitTask, tick } from "./sim/sim.ts";
import { applyThemeCssVariables } from "./ui/cssTheme.ts";
import { mountHelpOverlay } from "./ui/helpOverlay.ts";
import { mountHud } from "./ui/hud.ts";
import { mountInspectorPanel } from "./ui/inspectorPanel.ts";
import { mountStatsPanel } from "./ui/statsPanel.ts";
import { startTourCard } from "./ui/tourCard.ts";
import { playTour } from "./ui/tourPlayer.ts";
import { journeyOfATaskTour, theResultThatNeverLeftTour } from "./ui/tours.ts";
import type { Tour } from "./ui/tourTypes.ts";
import { mainlandGeometry } from "./world/layout.ts";
import { MAINLAND_RADIUS } from "./world/mainland.ts";
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

// Ambient decorative motion, entirely independent of SimState — see
// CLAUDE.md "Visual language" and vaultShimmer.ts's own doc comment:
// rotation only, in place, never suggesting the vault emits or moves
// anything (honesty rule 2).
const vaultMeshes: THREE.Object3D[] = [];
worldGroup.traverse((object) => {
  if (object.userData.kind === "VAULT") vaultMeshes.push(object);
});
createVaultShimmer(engine, vaultMeshes);

// Shared by the ambient demo's flow controller and every tour's camera
// resolver, so a TRE's rendered position always matches whichever one is
// currently addressing it — see world.ts's computeIslandGeometries doc.
const islandGeometries = computeIslandGeometries(DEMO_TRES);
let flowController: FlowController = createFlowController(engine, islandGeometries, () => currentState);

// A rare easter egg, entirely independent of SimState — it reads no
// protocol state and stands for nothing in it. Kept well clear of the
// mainland's coastline and every island's wall (a margin beyond each
// one's real radius) so it only ever surfaces in open water, never
// anywhere that could read as crossing a boundary this world takes
// seriously.
const whaleExclusionZones: WhaleExclusionZone[] = [
  { x: mainlandGeometry.center.x, z: mainlandGeometry.center.z, radius: MAINLAND_RADIUS + 6 },
  ...Array.from(islandGeometries.values()).map((island) => ({ x: island.center.x, z: island.center.z, radius: island.wallRadius + 6 })),
];
createWhaleController(engine, { exclusionZones: whaleExclusionZones });

const treNames = new Map(DEMO_TRES.map((t) => [t.id, t.name]));

/**
 * Curated landmark subset for persistent floating labels — every named
 * "point of interest" per island (including that island's own customs
 * hall), plus the mainland's own equivalents (the quay dock, the
 * researcher quarter). Structural/background meshes (ISLAND_LAND,
 * ISLAND_WALL, MAINLAND_LAND, SEA, ...) stay clickable via the picker
 * below, but don't get their own always-on label — with this many of them
 * on screen at once, that would be clutter rather than explanation.
 */
const LABELLED_KINDS = new Set([
  "VAULT",
  "WORKSHOP",
  "GATE1_HARBOURMASTER",
  "GATE2_INSPECTOR",
  "CUSTOMS_HALL",
  "MAINLAND_DOCK",
  "QUAY_OFFICE",
  "RESEARCHER_QUARTER",
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

// --- Simulation speed ----------------------------------------------------
//
// A live control on how fast the ambient demo's clock runs — not a
// protocol concept, just a UI knob layered on top of the already-scaled
// time the HUD discloses (honesty rule 7: the choreography is compressed
// either way; this only changes by how much). Every interval this demo
// schedules is one of the BASE_*_MS constants below divided by simSpeed,
// so 1x — the default — reproduces exactly the pacing this demo always
// ran at. setSimSpeed (defined near the timers it rebuilds) is the only
// place simSpeed is ever assigned.
const BASE_SPAWN_INTERVAL_MS = 2400;
const BASE_TICK_INTERVAL_MS = 260;
const BASE_GATE1_DELAY_MS = 700;
const BASE_GATE2_DELAY_MS = 1600;
const MIN_SPEED = 1;
const MAX_SPEED = 6;
let simSpeed = MIN_SPEED;

/**
 * A real approved project runs many analyses over its lifetime, not one —
 * "projects submitted" and "analyses run" should read as very different
 * numbers, not track each other 1:1. Each project's own tasks are spread
 * out over time rather than all submitted in the same instant, so the
 * demo reads as a project's ongoing work rather than a single burst.
 */
const MIN_TASKS_PER_PROJECT = 3;
const MAX_TASKS_PER_PROJECT = 9;
const BASE_TASK_STAGGER_MS = 900;

const statsPanel = mountStatsPanel(document.body, {
  getState: () => currentState,
  speed: { min: MIN_SPEED, max: MAX_SPEED, initial: simSpeed, onChange: setSimSpeed },
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

// All randomness in this ambient demo goes through this one seeded RNG —
// see CLAUDE.md "Simulation model". Drives cosmetic choices (which study/
// researcher name shows up) and, below, the two human gates' decisions —
// never anything about how a task mechanically executes.
const demoRng = createRng(7);
function pickFrom<T>(items: readonly T[]): T {
  return items[Math.floor(demoRng() * items.length)]!;
}

/**
 * Rough, made-up rates — not sourced from any real approval statistic —
 * just high enough that a refusal is a genuine, regular sight in the
 * ambient demo, not a rare footnote you'd only ever see in a tour. Honesty
 * rule 5: refusal is a first-class path, and a world that only ever says
 * yes teaches that the gates are theatrical.
 */
const GATE1_REFUSAL_RATE = 0.15;
const GATE2_REFUSAL_RATE = 0.12;

/**
 * The click-to-decide UI for Gate 1/Gate 2 doesn't exist yet — this
 * free-roam ambient demo stands in for it with a delayed timer, so the
 * queue still visibly holds rather than deciding instantly (honesty rule
 * 3). The decision itself is drawn now, before the timer, so the queue's
 * wait is the only place its outcome is hidden — not a coin flip at reveal
 * time.
 */
function scheduleProjectApproval(projectId: string, treId: TreId, decidedBy: string, delayMs: number): void {
  const decision: "APPROVED" | "REFUSED" = demoRng() < GATE1_REFUSAL_RATE ? "REFUSED" : "APPROVED";
  setTimeout(() => {
    currentState = decideProjectApproval(currentState, {
      projectId,
      treId,
      decision,
      decidedBy,
    });
  }, delayMs);
}

const scheduledForReview = new Set<string>();
function scheduleNewOutputReviews(): void {
  for (const crate of currentState.crates) {
    if (crate.status !== "HELD" || scheduledForReview.has(crate.id)) continue;
    scheduledForReview.add(crate.id);
    const decision: "RELEASED" | "REFUSED" = demoRng() < GATE2_REFUSAL_RATE ? "REFUSED" : "RELEASED";
    // Long enough that the crate has already visibly arrived and parked at
    // this island's own customs hall (the flow controller's hold leg is
    // well under a second) before "a human" decides — honesty rule 3, the
    // queue must visibly hold, not just skip straight to the outcome.
    setTimeout(() => {
      currentState = decideOutputReview(currentState, { crateId: crate.id, decision });
    }, BASE_GATE2_DELAY_MS / simSpeed);
  }
}

// Generous enough that even the top of the speed range takes a long, real
// session to exhaust — see spawnDemoProject's own doc comment on why a cap
// exists at all.
const MAX_DEMO_PROJECTS = 2000;
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
    scheduleProjectApproval(id, tre.id, `Harbourmaster of ${tre.name}`, (BASE_GATE1_DELAY_MS + index * BASE_GATE1_DELAY_MS) / simSpeed);
    scheduleProjectTasks(id, tre.id);
  });
}

/**
 * Submits this project's own run of analyses at this island, staggered
 * over time rather than all at once. Tasks can be submitted whether or not
 * Gate 1 has decided yet — an already-AWAITING_PROJECT_APPROVAL task just
 * waits for the next poll after approval, same as a researcher queuing up
 * more work under a project that's already running.
 */
function scheduleProjectTasks(projectId: string, treId: TreId): void {
  const taskCount = MIN_TASKS_PER_PROJECT + Math.floor(demoRng() * (MAX_TASKS_PER_PROJECT - MIN_TASKS_PER_PROJECT + 1));
  for (let i = 0; i < taskCount; i++) {
    setTimeout(() => {
      currentState = submitTask(currentState, { id: `task-${projectId}-${treId}-${i}`, projectId, treId });
    }, (i * BASE_TASK_STAGGER_MS) / simSpeed);
  }
}
spawnDemoProject();

let spawnTimer: number | null = null;
/** Torn down and rebuilt by setSimSpeed whenever the speed changes. */
function restartSpawnTimer(): void {
  if (spawnTimer != null) window.clearInterval(spawnTimer);
  spawnTimer = window.setInterval(spawnDemoProject, BASE_SPAWN_INTERVAL_MS / simSpeed);
}
restartSpawnTimer();

let ambientTimer: number | null = null;
function resumeAmbientDemo(): void {
  if (ambientTimer != null) return;
  ambientTimer = window.setInterval(() => {
    currentState = tick(currentState, 1);
    scheduleNewOutputReviews();
    statsPanel.update();
  }, BASE_TICK_INTERVAL_MS / simSpeed);
}
function pauseAmbientDemo(): void {
  if (ambientTimer == null) return;
  window.clearInterval(ambientTimer);
  ambientTimer = null;
}
resumeAmbientDemo();

/**
 * Applies a new speed from the stats panel's slider: rebuilds the spawn
 * timer immediately, and rebuilds the ambient tick timer only if it's
 * currently running — rebuilding a paused one would incorrectly resume it
 * while a tour has the world (see pauseAmbientDemo/resumeAmbientDemo).
 * Already-scheduled Gate 1/Gate 2 decisions keep the delay they were given
 * when scheduled; only decisions scheduled after this point use the new
 * speed.
 */
function setSimSpeed(next: number): void {
  simSpeed = next;
  restartSpawnTimer();
  if (ambientTimer != null) {
    pauseAmbientDemo();
    resumeAmbientDemo();
  }
}

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

const SOURCE_URL = "https://github.com/andyrae/fed";

const helpOverlay = mountHelpOverlay(document.body, SOURCE_URL);
const nightMode = createNightModeController(engine);

const hud = mountHud(document.body, {
  tours: [journeyOfATaskTour, theResultThatNeverLeftTour],
  onStartTour: startTour,
  onToggleHelp: () => helpOverlay.toggle(),
  onToggleNight: () => {
    nightMode.toggle();
    hud.setNightActive(nightMode.isEnabled());
  },
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "?") return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
  helpOverlay.toggle();
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
