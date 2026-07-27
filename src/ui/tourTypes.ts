import type {
  CrateId,
  ProjectId,
  SimState,
  TaskId,
  TreId,
} from "../core/types.ts";
import type {
  DecideOutputReviewParams,
  DecideProjectApprovalParams,
  SubmitProjectParams,
  SubmitTaskParams,
} from "../sim/sim.ts";

/**
 * What a stop does to the simulation. The tour player interprets these;
 * adding a tour never requires touching player or engine code — see
 * CLAUDE.md "Tour mechanism".
 */
export type SimDirective =
  | { readonly kind: "none" }
  | { readonly kind: "submitProject"; readonly params: SubmitProjectParams }
  | { readonly kind: "submitTask"; readonly params: SubmitTaskParams }
  | { readonly kind: "decideProjectApproval"; readonly params: DecideProjectApprovalParams }
  | { readonly kind: "decideOutputReview"; readonly params: DecideOutputReviewParams }
  | { readonly kind: "tick"; readonly ticks: number };

/**
 * Where the camera looks. Placeholder ahead of `src/engine`: references a
 * zone id from `src/world/layout.ts` rather than a real vector, since no
 * geometry exists yet this session.
 */
export interface CameraPose {
  readonly lookAtZoneId: string;
}

export type FocusEntity =
  | { readonly kind: "none" }
  | { readonly kind: "tre"; readonly treId: TreId }
  | { readonly kind: "project"; readonly projectId: ProjectId }
  | { readonly kind: "task"; readonly taskId: TaskId }
  | { readonly kind: "crate"; readonly crateId: CrateId };

/** Dual-register narration: both are content, both get editorial review — see CLAUDE.md "Tour mechanism". */
export interface Narration {
  readonly plain: string;
  readonly detail: string;
}

export interface TourStop {
  readonly id: string;
  readonly cameraPose: CameraPose;
  readonly focusEntity: FocusEntity;
  readonly narration: Narration;
  readonly simDirective: SimDirective;
}

export interface Tour {
  readonly id: string;
  readonly title: string;
  readonly stops: readonly TourStop[];
  /** Builds the world this tour runs against, fresh each time it's played. */
  readonly createInitialState: () => SimState;
}
