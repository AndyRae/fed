import "./ui/styles.css";

import type * as THREE from "three";
import { explanationForKind } from "./core/explanations.ts";
import type { SimState, TreId } from "./core/types.ts";
import { createCameraRig, type CameraPoseVec } from "./engine/cameraRig.ts";
import { createFlowController, type FlowController } from "./engine/flowController.ts";
import { createLabels } from "./engine/labels.ts";
import { createNightModeController } from "./engine/nightMode.ts";
import { createPicker, type PickerHandle } from "./engine/picking.ts";
import { createEngine } from "./engine/renderer.ts";
import { createVaultShimmer } from "./engine/vaultShimmer.ts";
import { createWeatherController } from "./engine/weatherController.ts";
import { createWhaleController, type WhaleExclusionZone } from "./engine/whaleController.ts";
import { createRng } from "./sim/rng.ts";
import { getApproval, getCrate } from "./sim/selectors.ts";
import { createInitialSimState, decideOutputReview, decideProjectApproval, submitProject, submitTask, tick } from "./sim/sim.ts";
import { applyThemeCssVariables } from "./ui/cssTheme.ts";
import { mountHelpOverlay } from "./ui/helpOverlay.ts";
import { mountHud } from "./ui/hud.ts";
import { mountInspectorPanel } from "./ui/inspectorPanel.ts";
import { mountStatsPanel } from "./ui/statsPanel.ts";
import { startTourCard } from "./ui/tourCard.ts";
import { playTour } from "./ui/tourPlayer.ts";
import { journeyOfATaskTour, theFiveSafesTour, theResultThatNeverLeftTour } from "./ui/tours.ts";
import type { Tour } from "./ui/tourTypes.ts";
import { mainlandGeometry, type IslandGeometry } from "./world/layout.ts";
import { MAINLAND_RADIUS } from "./world/mainland.ts";
import { buildWorld, computeIslandGeometries } from "./world/world.ts";

applyThemeCssVariables();

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) {
  throw new Error("#app root element is missing");
}

// The full roster a visitor's islands slider can draw from (see
// rebuildIslandCount below and IDEAS.md "Toggle how many islands there
// are") — buildWorld/computeIslandGeometries/the flow controller are all
// already generic over an arbitrary TRE count. DEMO_TRES is always a
// front slice of this list, so "tre-a" is present at every count. Named
// for genuinely obscure Hebridean islands rather than the famous ones —
// Mingulay and Scarp were both abandoned by their last residents (1912
// and 1971), Taransay only reads as familiar because of a reality show,
// and Gometra, Oronsay, and Sandray stay off most people's map entirely.
const ISLAND_ROSTER: readonly { id: TreId; name: string }[] = [
  { id: "tre-a", name: "Isle of Mingulay" },
  { id: "tre-b", name: "Isle of Scarp" },
  { id: "tre-c", name: "Isle of Taransay" },
  { id: "tre-d", name: "Isle of Gometra" },
  { id: "tre-e", name: "Isle of Oronsay" },
  { id: "tre-f", name: "Isle of Sandray" },
];
const MIN_ISLANDS = 1;
const MAX_ISLANDS = ISLAND_ROSTER.length;
// Two, not one: the aggregation payoff (see IDEAS.md/CHANGELOG.md "A
// visible moment when aggregation actually happens") only ever has
// anything to show once a project has been approved on more than one
// island, so the default world should already be able to show it without
// the visitor needing to touch the slider first.
const DEFAULT_ISLAND_COUNT = 2;

let DEMO_TRES = ISLAND_ROSTER.slice(0, DEFAULT_ISLAND_COUNT);

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
// The gently orbiting overview is the default view on load — see the HUD's
// 🌐 toggle (setOrbitEnabled, defined further down) for where a visitor's
// own drag turns this back off, and startTour/onExit for how a tour
// suspends and restores it.
cameraRig.controls.autoRotate = true;

let worldGroup = buildWorld(currentState);
engine.scene.add(worldGroup);

// Ambient decorative motion, entirely independent of SimState — see
// CLAUDE.md "Visual language" and vaultShimmer.ts's own doc comment:
// rotation only, in place, never suggesting the vault emits or moves
// anything (honesty rule 2). Extracted into a function, not just inline at
// startup, because rebuildIslandCount below needs to redo this against a
// freshly built worldGroup every time the islands slider changes.
function collectVaultMeshes(root: THREE.Object3D): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object.userData.kind === "VAULT") meshes.push(object);
  });
  return meshes;
}
let vaultShimmerHandle = createVaultShimmer(engine, collectVaultMeshes(worldGroup));

// Shared by the ambient demo's flow controller and every tour's camera
// resolver, so a TRE's rendered position always matches whichever one is
// currently addressing it — see world.ts's computeIslandGeometries doc.
let islandGeometries = computeIslandGeometries(DEMO_TRES);
let flowController: FlowController = createFlowController(engine, islandGeometries, () => currentState);

// Shared by every rare, purely decorative easter egg that must stay
// confined to open water — the whale, and now the weather (mist/rain) —
// entirely independent of SimState, reading no protocol state and
// standing for nothing in it. Kept well clear of the mainland's coastline
// and every island's wall (a margin beyond each one's real radius) so
// nothing ever appears anywhere that could read as crossing a boundary
// this world takes seriously. Extracted into a function for
// rebuildIslandCount's sake.
function computeSeaExclusionZones(geometries: ReadonlyMap<TreId, IslandGeometry>): WhaleExclusionZone[] {
  return [
    { x: mainlandGeometry.center.x, z: mainlandGeometry.center.z, radius: MAINLAND_RADIUS + 6 },
    ...Array.from(geometries.values()).map((island) => ({ x: island.center.x, z: island.center.z, radius: island.wallRadius + 6 })),
  ];
}
let whaleHandle = createWhaleController(engine, { exclusionZones: computeSeaExclusionZones(islandGeometries) });
let weatherHandle = createWeatherController(engine, { exclusionZones: computeSeaExclusionZones(islandGeometries) });

const treNames = new Map<TreId, string>();
/** Keeps treNames in sync with DEMO_TRES — mutates the same Map instance in place (never reassigned) so inspectorPanel.ts, which was handed this exact Map once at mount, always sees the current roster without needing to be remounted. */
function syncTreNames(): void {
  treNames.clear();
  for (const t of DEMO_TRES) treNames.set(t.id, t.name);
}
syncTreNames();

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
/** Extracted (rather than a one-off traversal) so rebuildIslandCount can redo it against a freshly built worldGroup — reads the live treNames Map, so it always reflects the current roster. */
function collectLabelTargets(root: THREE.Object3D): { object: THREE.Object3D; text: string }[] {
  const targets: { object: THREE.Object3D; text: string }[] = [];
  root.traverse((object) => {
    const kind = object.userData.kind as string | undefined;
    if (!kind) return;

    // The whole-island and whole-mainland labels use each TRE's real name
    // rather than explanations.ts's generic title, so "Isle of Ailsa" reads
    // above the island itself and "The mainland" above the mainland.
    if (kind === "TRE_LABEL_ANCHOR") {
      const treId = object.userData.treId as TreId;
      targets.push({ object, text: treNames.get(treId) ?? treId });
      return;
    }
    if (kind === "MAINLAND_LABEL_ANCHOR") {
      targets.push({ object, text: explanationForKind("MAINLAND_LAND")?.title ?? "The mainland" });
      return;
    }

    if (!LABELLED_KINDS.has(kind)) return;
    const explanation = explanationForKind(kind);
    if (!explanation) return;
    targets.push({ object, text: explanation.title });
  });
  return targets;
}
let labelsHandle = createLabels(engine, container, collectLabelTargets(worldGroup));

// Whether the visitor currently has manual control of both gates — see the
// HUD's ⚖ toggle below. Declared this early so the inspector's decision UI
// (which reads it on every click, long before the toggle itself is wired
// up further down) always sees a real value rather than a forward
// reference to an uninitialised binding.
let manualGatesEnabled = false;

// Bumped by rebuildIslandCount every time the ambient world resets for a
// new island count. A setTimeout scheduled against the old world (a
// staggered task submission, a delayed gate decision) captures this value
// at schedule time and checks it again when it fires — since
// rebuildIslandCount also resets projectCounter back to 0, a stale timer's
// captured projectId/treId could otherwise coincidentally match a
// same-named project or approval in the *new* world and corrupt it,
// rather than just erroring on one that's plainly gone.
let ambientGeneration = 0;

const inspector = mountInspectorPanel(document.body, {
  treNames,
  getState: () => currentState,
  isManualGatesEnabled: () => manualGatesEnabled,
  onDecideProjectApproval: ({ projectId, treId, decision }) => decideProjectApprovalManually(projectId, treId, decision),
  onDecideOutputReview: ({ crateId, decision }) => decideOutputReviewManually(crateId, decision),
});

// --- Simulation speed ----------------------------------------------------
//
// A live control on how fast the ambient demo's clock runs — not a
// protocol concept, just a UI knob layered on top of the already-scaled
// time the HUD discloses (honesty rule 7: the choreography is compressed
// either way; this only changes by how much). Every interval this demo
// schedules is one of the BASE_*_MS constants below divided by simSpeed.
// setSimSpeed (defined near the timers it rebuilds) is the only place
// simSpeed is ever assigned.
//
// Doubled across the board (2400/260/700/1600/900 before) — feedback was
// that even the slowest (1×) speed still moved fast enough to read as
// urgent rather than considered, and a real safe-project or safe-output
// decision should never feel like it's racing the visitor. Halving the
// pace like this keeps the whole 1×-6× range's relative shape, just
// slower throughout.
const BASE_SPAWN_INTERVAL_MS = 4800;
const BASE_TICK_INTERVAL_MS = 520;
const BASE_GATE1_DELAY_MS = 1400;
const BASE_GATE2_DELAY_MS = 3200;
const MIN_SPEED = 1;
const MAX_SPEED = 6;
let simSpeed = MIN_SPEED;

/**
 * A real approved project runs many analyses over its lifetime, not one —
 * "projects submitted" and "analyses run" should read as very different
 * numbers, not track each other 1:1. Each project's own tasks are spread
 * out over time rather than all submitted in the same instant, so the
 * demo reads as a project's ongoing work rather than a single burst.
 * Tuned so one project's own analyses, summed across every island it
 * targets, land around 100× its own count at the default island count
 * (see DEFAULT_ISLAND_COUNT) — feedback was that a real research
 * programme runs far more analyses per approved project than the
 * previous 3-9 (worth roughly 10× once multiplied across islands), not
 * a number close to 1:1.
 */
const MIN_TASKS_PER_PROJECT = 35;
const MAX_TASKS_PER_PROJECT = 65;
const BASE_TASK_STAGGER_MS = 1800;

const statsPanel = mountStatsPanel(document.body, {
  getState: () => currentState,
  speed: { min: MIN_SPEED, max: MAX_SPEED, initial: simSpeed, onChange: setSimSpeed },
  islands: { min: MIN_ISLANDS, max: MAX_ISLANDS, initial: DEFAULT_ISLAND_COUNT, onChange: rebuildIslandCount },
});

/** Extracted so rebuildIslandCount can recreate the picker bound to a freshly built worldGroup — createPicker captures `root` once at construction, so a replaced world needs a replaced picker, not a mutated one. */
function buildPicker(root: THREE.Object3D): PickerHandle {
  return createPicker({
    engine,
    root,
    onHoverChange: (object) => {
      engine.renderer.domElement.style.cursor = object ? "pointer" : "";
    },
    onSelect: (object) => {
      if (object) inspector.show(object);
      else inspector.hide();
    },
  });
}
let picker = buildPicker(worldGroup);

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
 * The default, unattended behaviour: a delayed timer stands in for a human
 * gate, so the queue still visibly holds rather than deciding instantly
 * (honesty rule 3). The decision itself is drawn now, before the timer, so
 * the queue's wait is the only place its outcome is hidden — not a coin
 * flip at reveal time. Skipped entirely once the visitor takes manual
 * control of the gates (the HUD's ⚖ toggle) — see inspectorPanel.ts's own
 * decision UI for that path. Both the scheduling check and the check
 * inside the timer itself matter: manual mode can be switched on *after*
 * this was already scheduled, and the visitor can decide this exact item
 * themselves before the timer fires — decideProjectApproval throws on an
 * already-decided approval, so the second guard keeps that a no-op instead
 * of an unhandled error.
 */
function scheduleProjectApproval(projectId: string, treId: TreId, decidedBy: string, delayMs: number): void {
  const decision: "APPROVED" | "REFUSED" = demoRng() < GATE1_REFUSAL_RATE ? "REFUSED" : "APPROVED";
  const generation = ambientGeneration;
  setTimeout(() => {
    // rebuildIslandCount resets projectCounter, so a stale timer from a
    // world that's since been reset could otherwise fire against a
    // same-named project in the *new* one — the generation guard rejects
    // it outright rather than relying on id equality alone.
    if (generation !== ambientGeneration) return;
    if (manualGatesEnabled) return;
    if (getApproval(currentState, projectId, treId)?.status !== "PENDING") return;
    currentState = decideProjectApproval(currentState, {
      projectId,
      treId,
      decision,
      decidedBy,
    });
  }, delayMs);
}

/** Every TRE's own pending approval gets exactly one auto-decision scheduled, the moment it's first seen — never re-scheduled once it's in this set, whichever way (a timer firing or the visitor deciding it manually) resolves it. */
const scheduledForApproval = new Set<string>();
function scheduleNewProjectApprovals(): void {
  if (manualGatesEnabled) return;
  for (const approval of currentState.approvals) {
    if (approval.status !== "PENDING") continue;
    const key = `${approval.projectId}:${approval.treId}`;
    if (scheduledForApproval.has(key)) continue;
    scheduledForApproval.add(key);
    const treName = DEMO_TRES.find((t) => t.id === approval.treId)?.name ?? approval.treId;
    scheduleProjectApproval(approval.projectId, approval.treId, `Harbourmaster of ${treName}`, BASE_GATE1_DELAY_MS / simSpeed);
  }
}

const scheduledForReview = new Set<string>();
function scheduleNewOutputReviews(): void {
  if (manualGatesEnabled) return;
  for (const crate of currentState.crates) {
    if (crate.status !== "HELD" || scheduledForReview.has(crate.id)) continue;
    scheduledForReview.add(crate.id);
    const decision: "RELEASED" | "REFUSED" = demoRng() < GATE2_REFUSAL_RATE ? "REFUSED" : "RELEASED";
    const generation = ambientGeneration;
    // Long enough that the crate has already visibly arrived and parked at
    // this island's own customs hall (the flow controller's hold leg is
    // well under a second) before "a human" decides — honesty rule 3, the
    // queue must visibly hold, not just skip straight to the outcome.
    setTimeout(() => {
      if (generation !== ambientGeneration) return; // see scheduleProjectApproval's own comment on this guard
      if (manualGatesEnabled) return;
      if (getCrate(currentState, crate.id)?.status !== "HELD") return;
      currentState = decideOutputReview(currentState, { crateId: crate.id, decision });
    }, BASE_GATE2_DELAY_MS / simSpeed);
  }
}

/**
 * The visitor's own decision, made through inspectorPanel.ts's Gate 1 card
 * — only reachable while manual mode is on and only ever offered for a
 * project that's actually still PENDING there, but this guards again
 * anyway: a lingering auto-timer scheduled just before manual mode was
 * switched on could in principle resolve the same approval first.
 */
function decideProjectApprovalManually(projectId: string, treId: TreId, decision: "APPROVED" | "REFUSED"): void {
  if (getApproval(currentState, projectId, treId)?.status !== "PENDING") return;
  const treName = DEMO_TRES.find((t) => t.id === treId)?.name ?? treId;
  currentState = decideProjectApproval(currentState, {
    projectId,
    treId,
    decision,
    decidedBy: `You, harbourmaster of ${treName}`,
  });
  statsPanel.update();
}

/** The visitor's own decision at Gate 2 — same shape and the same reasoning as decideProjectApprovalManually above. */
function decideOutputReviewManually(crateId: string, decision: "RELEASED" | "REFUSED"): void {
  if (getCrate(currentState, crateId)?.status !== "HELD") return;
  currentState = decideOutputReview(currentState, { crateId, decision });
  statsPanel.update();
}

// Generous enough that even the top of the speed range takes a long, real
// session to exhaust — see spawnDemoProject's own doc comment on why a cap
// exists at all.
const MAX_DEMO_PROJECTS = 2000;
let projectCounter = 0;

/**
 * Submits one new project to every island, so ferries keep departing and
 * returning indefinitely instead of the world going static after the
 * first round trip. Capped so an indefinitely open tab doesn't grow
 * SimState's arrays without bound. Its approval is picked up and
 * scheduled by the next scheduleNewProjectApprovals() pass rather than
 * scheduled directly here — the same pass that also has to handle every
 * approval left pending from a stretch of manual-gates time, so there is
 * only the one path for "a PENDING approval needs a decision, eventually."
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
  DEMO_TRES.forEach((tre) => {
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
  const generation = ambientGeneration;
  for (let i = 0; i < taskCount; i++) {
    setTimeout(() => {
      if (generation !== ambientGeneration) return; // see scheduleProjectApproval's own comment on this guard
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
    scheduleNewProjectApprovals();
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

// The free-roam camera's own starting shot — tuned for DEFAULT_ISLAND_COUNT
// (3 islands, the pre-existing 110°-spread layout). overviewPoseForRingRadius
// scales it for other island counts; see rebuildIslandCount.
const BASE_OVERVIEW_POSE: CameraPoseVec = {
  position: { x: 0, y: 50, z: 60 },
  target: { x: 0, y: 0, z: -5 },
};
const BASE_OVERVIEW_RING_RADIUS = 26; // mirrors layout.ts's ISLAND_RING_RADIUS baseline

/**
 * Pulls the free-roam camera back proportionally to how wide the current
 * island crescent actually is, so a larger island count doesn't leave outer
 * islands outside the initial view — a visitor who drags the slider up
 * should be able to see the isolation claim (honesty rules 1 and 6) across
 * every island at once, not just the one nearest the mainland. Scaled by a
 * sub-linear power (0.7), not linearly: gentle enough that a modest island
 * count doesn't zoom out further than it needs to, while still keeping the
 * largest roster (6 islands) inside OrbitControls' own maxDistance (see
 * cameraRig.ts, tuned alongside this constant).
 */
function overviewPoseForRingRadius(geometries: ReadonlyMap<TreId, IslandGeometry>): CameraPoseVec {
  let maxRadius = BASE_OVERVIEW_RING_RADIUS;
  for (const island of geometries.values()) {
    const radius = Math.hypot(island.center.x, island.center.z);
    if (radius > maxRadius) maxRadius = radius;
  }
  const scale = Math.pow(maxRadius / BASE_OVERVIEW_RING_RADIUS, 0.7);
  return {
    position: {
      x: 0,
      y: BASE_OVERVIEW_POSE.position.y * scale,
      z: BASE_OVERVIEW_POSE.position.z * scale,
    },
    target: BASE_OVERVIEW_POSE.target,
  };
}

/**
 * The visitor's own preference for the gently orbiting overview camera —
 * on by default (see the initial cameraRig.controls.autoRotate = true
 * above). Only ever changed by an explicit HUD click or by the visitor
 * dragging the camera themselves (handleUserCameraTakeover below); a tour
 * starting or ending never touches it, only the live autoRotate flag —
 * see startTour/onExit.
 */
let orbitEnabled = true;

/** The HUD's 🌐 toggle and handleUserCameraTakeover's own single path for changing orbitEnabled — always keeps the live autoRotate flag, the stored preference, and the button's own pressed state in agreement. Also re-frames the camera on the whole archipelago when turning on, so "orbit" always means the same gentle medium-distance overview, not a spin from wherever the camera happened to be left. */
function setOrbitEnabled(enabled: boolean): void {
  orbitEnabled = enabled;
  hud.setOrbitActive(enabled);
  cameraRig.controls.autoRotate = enabled && !tourActive;
  if (enabled) cameraRig.flyTo(overviewPoseForRingRadius(islandGeometries), CAMERA_FLIGHT_SECONDS);
}

/** Fires on the OrbitControls 'start' event — a real pointer/wheel interaction, never something main.ts's own flyTo/setPose calls trigger — so dragging, zooming, or panning the camera is exactly the "override" the orbit toggle promises. */
function handleUserCameraTakeover(): void {
  if (orbitEnabled) setOrbitEnabled(false);
}
cameraRig.controls.addEventListener("start", handleUserCameraTakeover);

/** Set while a tour has taken over the camera and world — see startTour/onExit just below. Guards rebuildIslandCount so a mid-tour slider drag can't rebuild the very world the tour is driving. */
let tourActive = false;

/**
 * Rebuilds the whole ambient world for a new island count, drawn from
 * ISLAND_ROSTER's front slice — see IDEAS.md "Toggle how many islands
 * there are". This is a full reset (fresh SimState, geometry, flow
 * controller, picker, decorative controllers) rather than a live migration
 * of in-flight projects/tasks: there is no sensible mapping from "N
 * islands' worth of state" onto "M islands' worth of state", so the
 * ambient demo simply starts over, the same way it does on first load.
 */
function rebuildIslandCount(newCount: number): void {
  if (tourActive || newCount === DEMO_TRES.length) return;

  ambientGeneration++;
  pauseAmbientDemo();
  inspector.hide();
  flowController.dispose();
  picker.dispose();
  labelsHandle.dispose();
  whaleHandle.dispose();
  weatherHandle.dispose();
  vaultShimmerHandle.dispose();
  engine.scene.remove(worldGroup);

  DEMO_TRES = ISLAND_ROSTER.slice(0, newCount);
  syncTreNames();
  currentState = createInitialSimState({ seed: 1, tres: DEMO_TRES, pollIntervalTicks: 2 });
  islandGeometries = computeIslandGeometries(DEMO_TRES);

  worldGroup = buildWorld(currentState);
  engine.scene.add(worldGroup);
  vaultShimmerHandle = createVaultShimmer(engine, collectVaultMeshes(worldGroup));
  whaleHandle = createWhaleController(engine, { exclusionZones: computeSeaExclusionZones(islandGeometries) });
  weatherHandle = createWeatherController(engine, { exclusionZones: computeSeaExclusionZones(islandGeometries) });
  // Non-null: rebuildIslandCount only ever runs after the throw-if-missing
  // check above has already passed, on module load.
  labelsHandle = createLabels(engine, container!, collectLabelTargets(worldGroup));
  picker = buildPicker(worldGroup);
  flowController = createFlowController(engine, islandGeometries, () => currentState);

  scheduledForApproval.clear();
  scheduledForReview.clear();
  projectCounter = 0;

  cameraRig.flyTo(overviewPoseForRingRadius(islandGeometries), CAMERA_FLIGHT_SECONDS);

  spawnDemoProject();
  statsPanel.update();
  resumeAmbientDemo();
}

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
  tourActive = true;
  statsPanel.setIslandsEnabled(false);
  pauseAmbientDemo();
  cameraRig.controls.enabled = false;
  // Suspended, not turned off: a tour drives the camera its own way via
  // flyTo, and OrbitControls' own autoRotate does not check `enabled` —
  // left on, it would fight every stop's camera move. onExit restores it
  // from the preserved orbitEnabled preference, not from this false.
  cameraRig.controls.autoRotate = false;
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
      tourActive = false;
      statsPanel.setIslandsEnabled(true);
      cameraRig.controls.autoRotate = orbitEnabled;
    },
  });
}

const SOURCE_URL = "https://github.com/andyrae/fed";

const helpOverlay = mountHelpOverlay(document.body, SOURCE_URL);
const nightMode = createNightModeController(engine);

const hud = mountHud(document.body, {
  tours: [journeyOfATaskTour, theResultThatNeverLeftTour, theFiveSafesTour],
  onStartTour: startTour,
  onToggleHelp: () => helpOverlay.toggle(),
  onToggleNight: () => {
    nightMode.toggle();
    hud.setNightActive(nightMode.isEnabled());
  },
  onToggleManualGates: () => {
    manualGatesEnabled = !manualGatesEnabled;
    hud.setManualGatesActive(manualGatesEnabled);
  },
  onToggleOrbit: () => setOrbitEnabled(!orbitEnabled),
});
// Orbit defaults to on (see the initial cameraRig.controls.autoRotate =
// true above); the button's own default markup doesn't know that, so sync
// it once here rather than threading an "initial" prop through HudOptions
// for a single boolean.
hud.setOrbitActive(orbitEnabled);

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
        theFiveSafesTour: typeof theFiveSafesTour;
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
  get picker() {
    return picker;
  },
  tours: { journeyOfATaskTour, theResultThatNeverLeftTour, theFiveSafesTour, playTour },
};
