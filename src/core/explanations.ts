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
  "QUAY_OFFICE",
  "MAINLAND_BUILDING",
  "RESEARCHER_QUARTER",
  "ISLAND_LAND",
  "ISLAND_BEACH",
  "ISLAND_WALL",
  "VAULT",
  "WORKSHOP",
  "GATE1_HARBOURMASTER",
  "DOCK",
  "FERRY",
  "CONTAINER",
  "SUBMISSION",
  "CRATE",
  "CUSTOMS_HALL",
  "GATE2_INSPECTOR",
  "FERRY_ROUTE",
  "EGRESS_ROUTE",
  "WORKFLOW_ROUTE",
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
    plain: "Where a researcher submits a project and its tasks, and where approved results simply arrive — no further check happens here.",
    detail:
      "Researcher / submitter. Tasks begin here, and released results arrive directly here from each island's own customs hall; there is no customs hall or inspector on the mainland. Aggregation of released results across every TRE that approved the project happens here too — the one point in the model that reads across islands, and only after each island's own Gate 2.",
  },
  QUAY_OFFICE: {
    title: "The quay office",
    plain: "The building where the submission layer itself lives — where a researcher's project and tasks are actually received, and where approved results are actually handed back.",
    detail:
      "This building is the submission layer itself, made concrete as a real structure rather than an implied capability of the bare dock platform beside it. It has no protocol role beyond that: a project and its tasks are received here, and released results are handed back and aggregated here too.",
  },
  MAINLAND_BUILDING: {
    title: "A quay building",
    plain: "Part of the mainland's submission layer — scenery, not a separate step in the protocol.",
    detail: "No distinct protocol role. Groups the quay visually so the mainland reads as a place, not an empty disc.",
  },
  RESEARCHER_QUARTER: {
    title: "The researcher quarter",
    plain: "Where researchers and their institutions are, collectively — every submitted task's own journey to the quay starts here.",
    detail:
      "Decorative and collective, like the quay buildings around it — not a new gate. \"Researcher / submitter\" in protocol terms is still centred on the quay itself, where tasks begin and results end; this is only where the submission animation visually originates. The model doesn't track which institution a given task came from.",
  },
  ISLAND_LAND: {
    title: "An island",
    plain: "A Trusted Research Environment (TRE) — a separate, sealed place where analysis actually runs.",
    detail:
      "A TRE: a separate trust zone with a hard perimeter. Nothing crosses its wall inward except its own ferry, departing and returning.",
  },
  ISLAND_BEACH: {
    title: "The shoreline",
    plain: "The sandy edge between this island's grass and the open water — scenery, not a separate step in the protocol.",
    detail:
      "No distinct protocol role, like the island's grass and its wall. Marks the coastline so the island reads as a real place with an edge, not a flat disc dropped onto the sea.",
  },
  ISLAND_WALL: {
    title: "The island wall",
    plain: "The boundary of this TRE. Only this island's own ferry may ever cross it, and only by leaving and returning.",
    detail:
      "The TRE network boundary: no ferry ever docks at an island it did not depart from, and no motion of any kind enters here from outside.",
  },
  VAULT: {
    title: "The vault",
    plain: "The sensitive data. Fixed here, always — nothing that starts here ever leaves.",
    detail:
      "The vault emits nothing: nothing whose origin is the vault ever boards a ferry, crosses a wall, or appears on the mainland.",
  },
  WORKSHOP: {
    title: "The workshop",
    plain: "Where the researcher's container actually runs, inside the wall, right next to the vault it computes on.",
    detail:
      "The TES runner (Funnel, in the reference implementation). Executes the GA4GH TES task through its real states: QUEUED → INITIALIZING → RUNNING → COMPLETE (or EXECUTOR_ERROR / CANCELED). Sits beside the vault and computes on it in place — nothing the vault holds ever leaves it; only the workshop's own output is ever sealed into a crate.",
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
      "The TRE agent's departure point. The ferry leaves from here, collects an approved container from the mainland, and returns here — the outbound-only fetch. Sealed crates leave by a different point on the wall: this island's own customs hall.",
  },
  FERRY: {
    title: "The ferry",
    plain: "This island's own vessel. It is the only thing that ever touches this island from outside.",
    detail:
      "The TRE agent. Polls the submission layer on a scaled interval and collects only tasks belonging to a project this specific island has already approved.",
  },
  CONTAINER: {
    title: "The researcher's container",
    plain: "The actual piece of work, now inside the wall and on its way from the ferry's dock to the workshop that will run it.",
    detail:
      "The GA4GH TES task's container, travelling on from where the island's own ferry left it. This leg is entirely inside the wall — the wall-crossing fetch already happened as the ferry's own round trip; this is only the container's onward trip to the workshop that executes it.",
  },
  SUBMISSION: {
    title: "A researcher's submission",
    plain: "The actual piece of work, on its way from the researcher quarter to the quay — before any island has agreed to run it.",
    detail:
      "Appears the moment a task is submitted, entirely on the mainland: no wall, no island, no TRE is involved yet. Distinct in colour from both the container it becomes once an island's ferry has collected it, and the crate it may become once a workshop has actually run it — this hasn't been agreed to by anyone yet.",
  },
  CRATE: {
    title: "A sealed crate",
    plain: "A finished result, sealed and waiting. It cannot be opened or released until a human decides.",
    detail:
      "A result awaiting output review. Produced by the workshop, visually distinct from the vault's contents, and never altered by review — only approved or refused.",
  },
  CUSTOMS_HALL: {
    title: "This island's customs hall",
    plain:
      "Every result this island produces passes through here before it may leave — a human decides whether they're comfortable releasing it beyond this TRE's own control.",
    detail:
      "Gate 2, made locally: this TRE's own disclosure-control review. docs.federated-analytics.ac.uk describes this as the \"Full Local Control\" egress pattern — \"at least one person checks the results by eye and approves the release.\" There is no shared or central customs hall in this model, and none on the mainland: an approved crate travels directly from here to the researcher's quay.",
  },
  GATE2_INSPECTOR: {
    title: "The customs inspector",
    plain: "A human here, on this island, approves or refuses each sealed crate this TRE produced. It is a decision, never a transformation.",
    detail:
      "Egress manager / output review — Gate 2, local to this TRE, just as Gate 1's harbourmaster is. The crate's contents are never cleaned, shrunk, or altered by this decision — only its status changes.",
  },
  FERRY_ROUTE: {
    title: "The ferry's route",
    plain: "The path this island's ferry travels: out from its dock, across to the mainland, and back to the very same dock.",
    detail:
      "Drawn as a line, this route only ever starts and ends at the same island's dock — no route like this ever connects two different islands.",
  },
  EGRESS_ROUTE: {
    title: "A crate's route to the quay",
    plain:
      "The path a sealed crate travels: out through this island's own customs hall, across the water, directly to the researcher's quay.",
    detail:
      "One-way and outbound-only, like the ferry's route — it leaves through this island's own customs hall, where Gate 2's human decision is made, never re-enters any island, and ends at the researcher's quay. There is no shared central stop along the way.",
  },
  WORKFLOW_ROUTE: {
    title: "This island's own workflow",
    plain:
      "How a task actually moves through this island once it's here: approved at the harbourmaster's office, run at the workshop, then checked at the customs hall before it may leave.",
    detail:
      "Connects the harbourmaster's office (Gate 1), the workshop, and this island's own customs hall (Gate 2), in that order — the real sequence a TES task's governance states follow inside the wall. Purely informational: nothing travels along it. The vault is deliberately not on this path: nothing whose origin is the vault ever travels anywhere.",
  },
};

export function explanationForKind(kind: string): EntityExplanation | undefined {
  return (explanations as Record<string, EntityExplanation>)[kind];
}
