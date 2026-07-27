/**
 * Dual-register explanations for every clickable entity in the world,
 * keyed by the `userData.kind` tag each mesh already carries — see
 * `src/world`'s builders. Content is grounded directly in CLAUDE.md's
 * world-metaphor table and honesty rules, so the inspector never drifts
 * from the documented claims: this file and that table should always say
 * the same thing.
 */
export interface EntityExplanation {
  readonly title: string;
  readonly plain: string;
  readonly detail: string;
}

export const ENTITY_KINDS = [
  "SEA",
  "MAINLAND_LAND",
  "MAINLAND_DOCK",
  "MAINLAND_BUILDING",
  "ISLAND_LAND",
  "ISLAND_WALL",
  "VAULT",
  "WORKSHOP",
  "GATE1_HARBOURMASTER",
  "DOCK",
  "FERRY",
  "CRATE",
  "CUSTOMS_HALL",
  "GATE2_INSPECTOR",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export const explanations: Readonly<Record<EntityKind, EntityExplanation>> = {
  SEA: {
    title: "The sea",
    plain: "Everything between the islands and the mainland is open water — nothing trusted happens out here.",
    detail:
      "The untrusted network. Every route that crosses it is either an island's own ferry (outbound-only, always returning to the island it departed from) or a sealed crate travelling to customs. Nothing else ever moves across it.",
  },
  MAINLAND_LAND: {
    title: "The mainland",
    plain: "The public-facing side of the system, where a researcher's work first arrives.",
    detail:
      "The submission layer. Public-facing; where researchers hand over work before any TRE (Trusted Research Environment) has agreed to run it.",
  },
  MAINLAND_DOCK: {
    title: "The researcher's quay",
    plain: "Where a researcher submits a project and its tasks, and where approved results eventually come back to.",
    detail:
      "Researcher / submitter. Tasks begin here, and aggregation of released results across every TRE that approved the project happens here too — the one point in the model that reads across islands, and only after Gate 2.",
  },
  MAINLAND_BUILDING: {
    title: "A quay building",
    plain: "Part of the mainland's submission layer — scenery, not a separate step in the protocol.",
    detail: "No distinct protocol role. Groups the quay visually so the mainland reads as a place, not an empty disc.",
  },
  ISLAND_LAND: {
    title: "An island",
    plain: "A Trusted Research Environment (TRE) — a separate, sealed place where analysis actually runs.",
    detail:
      "A TRE: a separate trust zone with a hard perimeter. Nothing crosses its wall inward except its own ferry, departing and returning.",
  },
  ISLAND_WALL: {
    title: "The island wall",
    plain: "The boundary of this TRE. Only this island's own ferry may ever cross it, and only by leaving and returning.",
    detail:
      "The TRE network boundary. Honesty rule 1: no ferry docks at an island it did not depart from, and no motion of any kind enters here from outside.",
  },
  VAULT: {
    title: "The vault",
    plain: "The sensitive data. Fixed here, always — nothing that starts here ever leaves.",
    detail:
      "Honesty rule 2: the vault emits nothing. Nothing whose origin is the vault ever boards a ferry, crosses a wall, or appears on the mainland.",
  },
  WORKSHOP: {
    title: "The workshop",
    plain: "Where the researcher's container actually runs, inside the wall.",
    detail:
      "The TES runner (Funnel, in the reference implementation). Executes the GA4GH TES task through its real states: QUEUED → INITIALIZING → RUNNING → COMPLETE (or EXECUTOR_ERROR / CANCELED).",
  },
  GATE1_HARBOURMASTER: {
    title: "The harbourmaster's office",
    plain: "A human here decides whether this island will work with this project at all — before anything runs.",
    detail:
      "TRE manager and project approval — Gate 1. A real person's decision, never automatic; the ferry never collects for a project this office refused.",
  },
  DOCK: {
    title: "The ferry's dock",
    plain: "The one place this island's wall may be crossed — by its own ferry, departing and returning.",
    detail:
      "The TRE agent's departure point. The ferry leaves from here, collects an approved container from the mainland, and returns here — the outbound-only fetch.",
  },
  FERRY: {
    title: "The ferry",
    plain: "This island's own vessel. It is the only thing that ever touches this island from outside.",
    detail:
      "The TRE agent. Polls the submission layer on a scaled interval and collects only tasks belonging to a project this specific island has already approved.",
  },
  CRATE: {
    title: "A sealed crate",
    plain: "A finished result, sealed and waiting. It cannot be opened or released until a human decides.",
    detail:
      "A result awaiting output review. Produced by the workshop, visually distinct from the vault's contents, and never altered by review — only approved or refused.",
  },
  CUSTOMS_HALL: {
    title: "The customs hall",
    plain: "Where sealed crates from every island wait for a human decision, outside any island's wall.",
    detail:
      "The egress service. Sits outside every island — the one place in the model that holds crates from more than one TRE at once, and only after they're already sealed.",
  },
  GATE2_INSPECTOR: {
    title: "The customs inspector",
    plain: "A human here approves or refuses each sealed crate. It is a decision, never a transformation.",
    detail:
      "Egress manager / output review — Gate 2. The crate's contents are never cleaned, shrunk, or altered by this decision — only its status changes.",
  },
};

export function explanationForKind(kind: string): EntityExplanation | undefined {
  return (explanations as Record<string, EntityExplanation>)[kind];
}
