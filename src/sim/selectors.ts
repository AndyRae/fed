import type {
  Crate,
  CrateId,
  ProjectApproval,
  ProjectApprovalStatus,
  ProjectId,
  SimState,
  TaskId,
  TaskStatus,
  TesTask,
  TreId,
} from "../core/types.ts";

export function getTask(state: SimState, taskId: TaskId): TesTask | undefined {
  return state.tasks.find((t) => t.id === taskId);
}

export function getApproval(state: SimState, projectId: ProjectId, treId: TreId): ProjectApproval | undefined {
  return state.approvals.find((a) => a.projectId === projectId && a.treId === treId);
}

export function getCrate(state: SimState, crateId: CrateId): Crate | undefined {
  return state.crates.find((c) => c.id === crateId);
}

export function getCrateForTask(state: SimState, taskId: TaskId): Crate | undefined {
  return state.crates.find((c) => c.taskId === taskId);
}

/** Every project still awaiting this TRE's own Gate 1 decision — the harbourmaster's own inbox. */
export function pendingApprovalsForTre(state: SimState, treId: TreId): readonly ProjectApproval[] {
  return state.approvals.filter((a) => a.treId === treId && a.status === "PENDING");
}

/** Every crate still awaiting this TRE's own Gate 2 decision — the customs inspector's own inbox. */
export function heldCratesForTre(state: SimState, treId: TreId): readonly Crate[] {
  return state.crates.filter((c) => c.treId === treId && c.status === "HELD");
}

/**
 * Aggregation happens at the researcher's quay, after release — this is the
 * one point in the model that reads across TREs, and only over crates that
 * have already cleared Gate 2. See CLAUDE.md honesty rule 6.
 */
export function releasedCratesForProject(state: SimState, projectId: ProjectId): readonly Crate[] {
  return state.crates.filter((c) => c.projectId === projectId && c.status === "RELEASED");
}

/**
 * How many distinct TREs have released a result for this project so far —
 * the real measure of whether this project's aggregation has actually
 * become cross-island yet, versus just one island's own output. Used by
 * `src/engine/flowController.ts` to trigger a one-time visual payoff the
 * moment a project's results first converge from more than one island
 * (IDEAS.md/CHANGELOG.md "A visible moment when aggregation actually
 * happens") — reads only released crates, same honesty-rule-6 boundary as
 * releasedCratesForProject above.
 */
export function releasedIslandCountForProject(state: SimState, projectId: ProjectId): number {
  return new Set(releasedCratesForProject(state, projectId).map((c) => c.treId)).size;
}

const IN_FLIGHT_TASK_STATUSES: readonly TaskStatus[] = ["QUEUED", "INITIALIZING", "RUNNING"];
/** A task counts as "run" once it has actually reached COMPLETE — whatever the workshop produced, regardless of what Gate 2 later decides about it. */
const RAN_TASK_STATUSES: readonly TaskStatus[] = ["COMPLETE", "AWAITING_OUTPUT_REVIEW", "RELEASED", "OUTPUT_REFUSED"];

/** Live totals for the activity panel — see src/ui/statsPanel.ts. Purely a read over SimState; never mutates it, never drives protocol state. */
export interface ActivityStats {
  readonly projectsSubmitted: number;
  readonly gate1Approved: number;
  readonly gate1Refused: number;
  readonly tasksInFlight: number;
  readonly analysesRun: number;
  readonly gate2Released: number;
  readonly gate2Refused: number;
}

/**
 * A cross-island tally for the human observer's own dashboard — not a
 * capability any island or the sim itself has. This is the same kind of
 * aggregation honesty rule 6 already permits at the researcher's quay
 * ("Aggregation of results happens at the researcher's quay, after
 * release, and is shown there"); this just extends that to every stage of
 * the funnel, for the UI layer, never for anything in `src/world` or
 * `src/sim` itself.
 */
export function computeActivityStats(state: SimState): ActivityStats {
  return {
    projectsSubmitted: state.projects.length,
    gate1Approved: state.approvals.filter((a) => a.status === "APPROVED").length,
    gate1Refused: state.approvals.filter((a) => a.status === "REFUSED").length,
    tasksInFlight: state.tasks.filter((t) => IN_FLIGHT_TASK_STATUSES.includes(t.status)).length,
    analysesRun: state.tasks.filter((t) => RAN_TASK_STATUSES.includes(t.status)).length,
    gate2Released: state.crates.filter((c) => c.status === "RELEASED").length,
    gate2Refused: state.crates.filter((c) => c.status === "REFUSED").length,
  };
}

/**
 * This island's own ledger — see IDEAS.md "An island's own ledger" — the
 * same shape as ActivityStats, scoped to one TRE instead of the whole
 * world. Unlike computeActivityStats (an observer's dashboard, explicitly
 * not a capability any island has), this *is* meant to stand for what a
 * single island can genuinely see: its own record, and only its own.
 * `projectsSeen` reads the approvals table rather than `state.projects`,
 * on purpose — a project that never targeted this TRE at all should never
 * appear in its ledger, even if it targeted some other island.
 */
export interface IslandLedger {
  readonly treId: TreId;
  readonly projectsSeen: number;
  readonly gate1Approved: number;
  readonly gate1Refused: number;
  readonly tasksInFlight: number;
  readonly analysesRun: number;
  readonly gate2Released: number;
  readonly gate2Refused: number;
}

export function computeIslandLedger(state: SimState, treId: TreId): IslandLedger {
  const approvalsHere = state.approvals.filter((a) => a.treId === treId);
  return {
    treId,
    projectsSeen: approvalsHere.length,
    gate1Approved: approvalsHere.filter((a) => a.status === "APPROVED").length,
    gate1Refused: approvalsHere.filter((a) => a.status === "REFUSED").length,
    tasksInFlight: state.tasks.filter((t) => t.treId === treId && IN_FLIGHT_TASK_STATUSES.includes(t.status)).length,
    analysesRun: state.tasks.filter((t) => t.treId === treId && RAN_TASK_STATUSES.includes(t.status)).length,
    gate2Released: state.crates.filter((c) => c.treId === treId && c.status === "RELEASED").length,
    gate2Refused: state.crates.filter((c) => c.treId === treId && c.status === "REFUSED").length,
  };
}

/** One targeted island's own status for a project, from the researcher's side — see ProjectLedger's own doc comment. */
export interface ProjectIslandStatus {
  readonly treId: TreId;
  /** This island's own Gate 1 decision for this project — PENDING until its harbourmaster actually decides, same states as ProjectApproval. */
  readonly gate1Status: ProjectApprovalStatus;
  readonly cratesHeld: number;
  readonly cratesReleased: number;
  readonly cratesRefused: number;
}

/**
 * A project's own status across every island it targeted — see IDEAS.md
 * "A project-centric view at the quay". The mirror image of IslandLedger:
 * that one is what a single island can see of its own record; this one is
 * what the researcher's quay is allowed to see, reading across every
 * island a project targeted (honesty rule 6's own stated exception —
 * "Aggregation of results happens at the researcher's quay, after
 * release" — already exercised by releasedCratesForProject). `undefined`
 * if the project doesn't exist in this state.
 */
export interface ProjectLedger {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly researcher: string;
  readonly perIsland: readonly ProjectIslandStatus[];
  /** Same count releasedCratesForProject would give — released crates gathered at the quay so far, across every island. */
  readonly releasedCount: number;
}

export function computeProjectLedger(state: SimState, projectId: ProjectId): ProjectLedger | undefined {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return undefined;

  const perIsland = project.targetTreIds.map((treId): ProjectIslandStatus => {
    const cratesHere = state.crates.filter((c) => c.projectId === projectId && c.treId === treId);
    return {
      treId,
      gate1Status: getApproval(state, projectId, treId)?.status ?? "PENDING",
      cratesHeld: cratesHere.filter((c) => c.status === "HELD").length,
      cratesReleased: cratesHere.filter((c) => c.status === "RELEASED").length,
      cratesRefused: cratesHere.filter((c) => c.status === "REFUSED").length,
    };
  });

  return {
    projectId,
    name: project.name,
    researcher: project.researcher,
    perIsland,
    releasedCount: releasedCratesForProject(state, projectId).length,
  };
}
