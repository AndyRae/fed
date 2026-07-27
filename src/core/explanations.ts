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
  "EGRESS_AIRLOCK",
  "FERRY",
  "CRATE",
  "CUSTOMS_HALL",
  "GATE2_INSPECTOR",
  "FERRY_ROUTE",
  "EGRESS_ROUTE",
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
    plain: "Where this island's own ferry departs and returns, bringing an approved container in from the mainland.",
    detail:
      "The TRE agent's departure point. The ferry leaves from here, collects an approved container from the mainland, and returns here — the outbound-only fetch. Sealed crates leave by a different point on the wall: the egress airlock.",
  },
  EGRESS_AIRLOCK: {
    title: "The egress airlock",
    plain: "Every sealed crate passes through here before it may leave the island — an automated technical check, separate from the human decision that comes next.",
    detail:
      "The TRE's own local disclosure-control check, built into the wall (docs.federated-analytics.ac.uk describes this as part of the weave: \"essential disclosure control processes within TREs\"). It is not a third gate and makes no governance decision — the sole disclosure decision on this crate is still Gate 2, made by the customs inspector.",
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
  FERRY_ROUTE: {
    title: "The ferry's route",
    plain: "The path this island's ferry travels: out from its dock, across to the mainland, and back to the very same dock.",
    detail:
      "Honesty rule 1, drawn as a line: this route only ever starts and ends at the same island's dock. No route like this ever connects two different islands.",
  },
  EGRESS_ROUTE: {
    title: "A crate's route to customs",
    plain: "The path a sealed crate travels: out through this island's own egress airlock, across the water, to the shared customs hall.",
    detail:
      "One-way and outbound-only, like the ferry's route — it leaves through the island's egress airlock (the local disclosure-control checkpoint), never re-enters any island, and ends at customs, where Gate 2 is the only decision made.",
  },
};

export function explanationForKind(kind: string): EntityExplanation | undefined {
  return (explanations as Record<string, EntityExplanation>)[kind];
}
