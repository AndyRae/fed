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
 * Where the camera looks, as a semantic reference rather than raw
 * coordinates — tours stay data, geometry stays owned by
 * `src/world/layout.ts`. `src/ui/cameraPoses.ts` resolves one of these
 * against a real island-geometry map into an actual position/target.
 */
export type CameraPose =
  | { readonly kind: "overview" }
  | { readonly kind: "mainland" }
  | { readonly kind: "sea"; readonly treId: TreId }
  | { readonly kind: "tre"; readonly treId: TreId }
  | { readonly kind: "treGate1"; readonly treId: TreId }
  | { readonly kind: "treWorkshop"; readonly treId: TreId }
  | { readonly kind: "treVault"; readonly treId: TreId }
  | { readonly kind: "treCustoms"; readonly treId: TreId };

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
  /** Short human-readable chapter name for the HUD's tour card, e.g. "Safe people, safe project". */
  readonly title: string;
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
