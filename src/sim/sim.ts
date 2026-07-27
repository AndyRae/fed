import {
  assertTaskTransition,
  type AgentState,
  type Crate,
  type CrateId,
  type ProjectApproval,
  type ProjectId,
  type SimEvent,
  type SimState,
  type TaskId,
  type TaskStatus,
  type TesTask,
  type Tre,
  type TreId,
} from "../core/types.ts";
import { getApproval, getCrate, getTask } from "./selectors.ts";

const DEFAULT_POLL_INTERVAL_TICKS = 5;

export interface CreateInitialSimStateParams {
  readonly seed: number;
  readonly tres: readonly { id: TreId; name: string }[];
  readonly pollIntervalTicks?: number;
}

export function createInitialSimState(params: CreateInitialSimStateParams): SimState {
  const pollIntervalTicks = params.pollIntervalTicks ?? DEFAULT_POLL_INTERVAL_TICKS;
  const tres: Tre[] = params.tres.map((t) => ({ id: t.id, name: t.name }));
  const agents: AgentState[] = params.tres.map((t) => ({
    treId: t.id,
    pollIntervalTicks,
    lastPolledAtTick: 0,
  }));
  return {
    tick: 0,
    seed: params.seed,
    tres,
    projects: [],
    approvals: [],
    tasks: [],
    crates: [],
    agents,
    events: [],
  };
}

function appendEvent(state: SimState, event: SimEvent): SimState {
  return { ...state, events: [...state.events, event] };
}

export interface SubmitProjectParams {
  readonly id: ProjectId;
  readonly name: string;
  readonly researcher: string;
  readonly targetTreIds: readonly TreId[];
}

export function submitProject(state: SimState, params: SubmitProjectParams): SimState {
  if (state.projects.some((p) => p.id === params.id)) {
    throw new Error(`Project already submitted: ${params.id}`);
  }
  for (const treId of params.targetTreIds) {
    if (!state.tres.some((t) => t.id === treId)) {
      throw new Error(`Unknown TRE: ${treId}`);
    }
  }

  const project = {
    id: params.id,
    name: params.name,
    researcher: params.researcher,
    submittedAtTick: state.tick,
    targetTreIds: params.targetTreIds,
  };
  const newApprovals: ProjectApproval[] = params.targetTreIds.map((treId) => ({
    projectId: params.id,
    treId,
    status: "PENDING",
    decidedAtTick: null,
    decidedBy: null,
  }));

  let next: SimState = {
    ...state,
    projects: [...state.projects, project],
    approvals: [...state.approvals, ...newApprovals],
  };
  next = appendEvent(next, { type: "PROJECT_SUBMITTED", tick: state.tick, projectId: params.id });
  return next;
}

export interface DecideProjectApprovalParams {
  readonly projectId: ProjectId;
  readonly treId: TreId;
  readonly decision: "APPROVED" | "REFUSED";
  readonly decidedBy: string;
}

export function decideProjectApproval(state: SimState, params: DecideProjectApprovalParams): SimState {
  const approval = getApproval(state, params.projectId, params.treId);
  if (!approval) {
    throw new Error(`No approval pending for project ${params.projectId} at ${params.treId}`);
  }
  if (approval.status !== "PENDING") {
    throw new Error(
      `Approval for project ${params.projectId} at ${params.treId} was already decided: ${approval.status}`,
    );
  }

  const decidedApproval: ProjectApproval = {
    ...approval,
    status: params.decision,
    decidedAtTick: state.tick,
    decidedBy: params.decidedBy,
  };
  let next: SimState = {
    ...state,
    approvals: state.approvals.map((a) =>
      a.projectId === params.projectId && a.treId === params.treId ? decidedApproval : a,
    ),
  };
  next = appendEvent(next, {
    type: "PROJECT_APPROVAL_DECIDED",
    tick: state.tick,
    projectId: params.projectId,
    treId: params.treId,
    status: params.decision,
  });

  if (params.decision === "REFUSED") {
    // The ferry never collects for a refused project: any task still
    // waiting on this exact approval is refused immediately, not on the
    // next poll. See CLAUDE.md honesty rule 5 and the refusal tour.
    for (const task of next.tasks) {
      if (task.projectId === params.projectId && task.treId === params.treId && task.status === "AWAITING_PROJECT_APPROVAL") {
        next = transitionTask(next, task.id, "PROJECT_REFUSED");
      }
    }
  }

  return next;
}

export interface SubmitTaskParams {
  readonly id: TaskId;
  readonly projectId: ProjectId;
  readonly treId: TreId;
}

export function submitTask(state: SimState, params: SubmitTaskParams): SimState {
  if (state.tasks.some((t) => t.id === params.id)) {
    throw new Error(`Task already submitted: ${params.id}`);
  }
  const project = state.projects.find((p) => p.id === params.projectId);
  if (!project) {
    throw new Error(`Unknown project: ${params.projectId}`);
  }
  if (!project.targetTreIds.includes(params.treId)) {
    throw new Error(`Project ${params.projectId} was not submitted to ${params.treId}`);
  }

  const approval = getApproval(state, params.projectId, params.treId);
  const initialStatus: TaskStatus = approval?.status === "REFUSED" ? "PROJECT_REFUSED" : "AWAITING_PROJECT_APPROVAL";

  const task: TesTask = {
    id: params.id,
    projectId: params.projectId,
    treId: params.treId,
    status: initialStatus,
    createdAtTick: state.tick,
    history: [{ status: initialStatus, atTick: state.tick }],
  };

  let next: SimState = { ...state, tasks: [...state.tasks, task] };
  next = appendEvent(next, { type: "TASK_SUBMITTED", tick: state.tick, taskId: params.id });
  return next;
}

export interface DecideOutputReviewParams {
  readonly crateId: CrateId;
  readonly decision: "RELEASED" | "REFUSED";
}

export function decideOutputReview(state: SimState, params: DecideOutputReviewParams): SimState {
  const crate = getCrate(state, params.crateId);
  if (!crate) {
    throw new Error(`Unknown crate: ${params.crateId}`);
  }
  if (crate.status !== "HELD") {
    throw new Error(`Crate ${params.crateId} was already decided: ${crate.status}`);
  }

  const decidedCrate: Crate = { ...crate, status: params.decision, decidedAtTick: state.tick };
  let next: SimState = {
    ...state,
    crates: state.crates.map((c) => (c.id === params.crateId ? decidedCrate : c)),
  };
  next = transitionTask(next, crate.taskId, params.decision === "RELEASED" ? "RELEASED" : "OUTPUT_REFUSED");
  next = appendEvent(next, { type: "OUTPUT_REVIEW_DECIDED", tick: state.tick, crateId: params.crateId, status: params.decision });
  return next;
}

/** Applies a validated status change to a task: updates status, history, and emits TASK_STATE_CHANGED. Throws via assertTaskTransition if the move is illegal. */
function transitionTask(state: SimState, taskId: TaskId, to: TaskStatus): SimState {
  const task = getTask(state, taskId);
  if (!task) {
    throw new Error(`Unknown task: ${taskId}`);
  }
  assertTaskTransition(task.status, to);
  const from = task.status;
  const updated: TesTask = {
    ...task,
    status: to,
    history: [...task.history, { status: to, atTick: state.tick }],
  };
  let next: SimState = { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)) };
  next = appendEvent(next, { type: "TASK_STATE_CHANGED", tick: state.tick, taskId, from, to });
  return next;
}

/**
 * Advances the sim by one or more ticks. Each tick, every TRE agent whose
 * poll interval has elapsed polls independently (its own island's ferry,
 * touching only that island's tasks — honesty rule 6), and every task that
 * is mid-execution advances exactly one mechanical stage. Gate 1 and Gate 2
 * never advance automatically: only decideProjectApproval and
 * decideOutputReview move a task past a human gate (honesty rule 3).
 */
export function tick(state: SimState, ticks = 1): SimState {
  let next = state;
  for (let i = 0; i < ticks; i++) {
    next = tickOnce(next);
  }
  return next;
}

function tickOnce(state: SimState): SimState {
  const newTick = state.tick + 1;
  let next: SimState = { ...state, tick: newTick };

  const pollingTreIds = new Set<TreId>();
  const polledAgents: AgentState[] = next.agents.map((agent) => {
    if (newTick - agent.lastPolledAtTick >= agent.pollIntervalTicks) {
      pollingTreIds.add(agent.treId);
      return { ...agent, lastPolledAtTick: newTick };
    }
    return agent;
  });
  next = { ...next, agents: polledAgents };
  for (const treId of pollingTreIds) {
    next = appendEvent(next, { type: "AGENT_POLLED", tick: newTick, treId });
  }

  // Decide every task's next mechanical stage from the pre-tick snapshot,
  // so a task advances at most one stage per tick call regardless of order.
  const snapshot = state.tasks;
  for (const task of snapshot) {
    switch (task.status) {
      case "AWAITING_PROJECT_APPROVAL": {
        if (!pollingTreIds.has(task.treId)) break;
        const approval = getApproval(next, task.projectId, task.treId);
        if (approval?.status !== "APPROVED") break;
        next = transitionTask(next, task.id, "QUEUED");
        next = appendEvent(next, { type: "TASK_COLLECTED", tick: newTick, taskId: task.id, treId: task.treId });
        break;
      }
      case "QUEUED":
        next = transitionTask(next, task.id, "INITIALIZING");
        break;
      case "INITIALIZING":
        next = transitionTask(next, task.id, "RUNNING");
        break;
      case "RUNNING":
        next = transitionTask(next, task.id, "COMPLETE");
        break;
      case "COMPLETE": {
        next = transitionTask(next, task.id, "AWAITING_OUTPUT_REVIEW");
        const crate: Crate = {
          id: `crate-${task.id}`,
          taskId: task.id,
          projectId: task.projectId,
          treId: task.treId,
          status: "HELD",
          createdAtTick: newTick,
          decidedAtTick: null,
        };
        next = { ...next, crates: [...next.crates, crate] };
        next = appendEvent(next, { type: "CRATE_SEALED", tick: newTick, crateId: crate.id, taskId: task.id });
        break;
      }
      default:
        // AWAITING_OUTPUT_REVIEW and every terminal status: no automatic
        // progression. A human decision or nothing at all.
        break;
    }
  }

  return next;
}
