import type { Crate, CrateId, ProjectApproval, ProjectId, SimState, TaskId, TesTask, TreId } from "../core/types.ts";

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

/**
 * Aggregation happens at the researcher's quay, after release — this is the
 * one point in the model that reads across TREs, and only over crates that
 * have already cleared Gate 2. See CLAUDE.md honesty rule 6.
 */
export function releasedCratesForProject(state: SimState, projectId: ProjectId): readonly Crate[] {
  return state.crates.filter((c) => c.projectId === projectId && c.status === "RELEASED");
}
