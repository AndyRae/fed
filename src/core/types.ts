/**
 * SimState is the contract between `src/sim` and everything else. `src/sim`
 * owns and mutates it; `src/world`, `src/engine`, and `src/ui` may only read
 * it. See CLAUDE.md "Architecture" and "Key design rules".
 */

export type TreId = string;
export type ProjectId = string;
export type TaskId = string;
export type CrateId = string;

/**
 * The GA4GH TES executor states, verbatim, plus the governance states around
 * them (project approval and output review). Per CLAUDE.md this is the full
 * set — never invent or rename a state. Some TES-spec states (UNKNOWN,
 * PAUSED, SYSTEM_ERROR, CANCELING, PREEMPTED) are deliberately out of scope
 * for this model; see SIMPLIFICATIONS.md.
 */
export type TaskStatus =
  | "AWAITING_PROJECT_APPROVAL"
  | "PROJECT_REFUSED"
  | "QUEUED"
  | "INITIALIZING"
  | "RUNNING"
  | "COMPLETE"
  | "EXECUTOR_ERROR"
  | "CANCELED"
  | "AWAITING_OUTPUT_REVIEW"
  | "RELEASED"
  | "OUTPUT_REFUSED";

/**
 * The legal transition graph for a TES task, including the governance
 * states either side of it. This is the single source of truth for what
 * moves are possible; `src/sim` must route every status change through
 * {@link assertTaskTransition} rather than assigning `status` directly, so
 * an illegal transition throws instead of silently corrupting state.
 */
export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = Object.freeze({
  AWAITING_PROJECT_APPROVAL: ["QUEUED", "PROJECT_REFUSED"],
  PROJECT_REFUSED: [],
  QUEUED: ["INITIALIZING", "CANCELED"],
  INITIALIZING: ["RUNNING", "EXECUTOR_ERROR", "CANCELED"],
  RUNNING: ["COMPLETE", "EXECUTOR_ERROR", "CANCELED"],
  COMPLETE: ["AWAITING_OUTPUT_REVIEW"],
  EXECUTOR_ERROR: [],
  CANCELED: [],
  AWAITING_OUTPUT_REVIEW: ["RELEASED", "OUTPUT_REFUSED"],
  RELEASED: [],
  OUTPUT_REFUSED: [],
});

/** Statuses with no legal outgoing transition: where a task's story ends. */
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = Object.freeze(
  (Object.keys(TASK_TRANSITIONS) as TaskStatus[]).filter(
    (status) => TASK_TRANSITIONS[status].length === 0,
  ),
);

export function isLegalTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

export class IllegalTaskTransitionError extends Error {
  readonly from: TaskStatus;
  readonly to: TaskStatus;

  constructor(from: TaskStatus, to: TaskStatus) {
    super(`Illegal TES task transition: ${from} -> ${to}`);
    this.name = "IllegalTaskTransitionError";
    this.from = from;
    this.to = to;
  }
}

/** Throws {@link IllegalTaskTransitionError} in place of returning a boolean, for call sites that mutate state and must not proceed on an illegal move. */
export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!isLegalTaskTransition(from, to)) {
    throw new IllegalTaskTransitionError(from, to);
  }
}

export type ProjectApprovalStatus = "PENDING" | "APPROVED" | "REFUSED";

export type CrateStatus = "HELD" | "RELEASED" | "REFUSED";

export interface Tre {
  readonly id: TreId;
  readonly name: string;
}

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly researcher: string;
  readonly submittedAtTick: number;
  readonly targetTreIds: readonly TreId[];
}

/** Gate 1: one harbourmaster decision per (project, TRE) pair. */
export interface ProjectApproval {
  readonly projectId: ProjectId;
  readonly treId: TreId;
  readonly status: ProjectApprovalStatus;
  readonly decidedAtTick: number | null;
  readonly decidedBy: string | null;
}

export interface TaskStatusChange {
  readonly status: TaskStatus;
  readonly atTick: number;
}

export interface TesTask {
  readonly id: TaskId;
  readonly projectId: ProjectId;
  readonly treId: TreId;
  readonly status: TaskStatus;
  readonly createdAtTick: number;
  readonly history: readonly TaskStatusChange[];
}

/** Gate 2: the customs inspector's decision on a sealed crate. */
export interface Crate {
  readonly id: CrateId;
  readonly taskId: TaskId;
  readonly projectId: ProjectId;
  readonly treId: TreId;
  readonly status: CrateStatus;
  readonly createdAtTick: number;
  readonly decidedAtTick: number | null;
}

/** One TRE agent (ferry). Polls on a fixed scaled interval; never triggered by anything crossing the wall inward. */
export interface AgentState {
  readonly treId: TreId;
  readonly pollIntervalTicks: number;
  readonly lastPolledAtTick: number;
}

export type SimEvent =
  | { readonly type: "PROJECT_SUBMITTED"; readonly tick: number; readonly projectId: ProjectId }
  | {
      readonly type: "PROJECT_APPROVAL_DECIDED";
      readonly tick: number;
      readonly projectId: ProjectId;
      readonly treId: TreId;
      readonly status: "APPROVED" | "REFUSED";
    }
  | { readonly type: "TASK_SUBMITTED"; readonly tick: number; readonly taskId: TaskId }
  | { readonly type: "AGENT_POLLED"; readonly tick: number; readonly treId: TreId }
  | { readonly type: "TASK_COLLECTED"; readonly tick: number; readonly taskId: TaskId; readonly treId: TreId }
  | {
      readonly type: "TASK_STATE_CHANGED";
      readonly tick: number;
      readonly taskId: TaskId;
      readonly from: TaskStatus;
      readonly to: TaskStatus;
    }
  | { readonly type: "CRATE_SEALED"; readonly tick: number; readonly crateId: CrateId; readonly taskId: TaskId }
  | {
      readonly type: "OUTPUT_REVIEW_DECIDED";
      readonly tick: number;
      readonly crateId: CrateId;
      readonly status: "RELEASED" | "REFUSED";
    };

/**
 * The full simulation contract. `src/sim` owns and mutates this; every
 * other layer only reads it. Contains no geometry — positions and routes
 * live in `src/world/layout.ts`.
 */
export interface SimState {
  readonly tick: number;
  readonly seed: number;
  readonly tres: readonly Tre[];
  readonly projects: readonly Project[];
  readonly approvals: readonly ProjectApproval[];
  readonly tasks: readonly TesTask[];
  readonly crates: readonly Crate[];
  readonly agents: readonly AgentState[];
  readonly events: readonly SimEvent[];
}
