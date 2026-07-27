/**
 * The fixed, semantic colour palette. See CLAUDE.md "Visual language":
 * colour is semantic and fixed, never reused across roles because it
 * looks good elsewhere. Framework-agnostic (plain hex numbers) so both
 * `src/world` (three.js materials) and a future `src/ui` (CSS) can share
 * it without either depending on the other. Tuned for a bright daytime
 * scene — see core/theme.test.ts for the no-reuse-across-roles guarantee.
 */
export const theme = {
  /** Island interiors: a separate, walled trust zone. */
  trust: {
    island: 0x3fae74,
    wall: 0x2d7a52,
    ferry: 0x57c98f,
    workshop: 0x8fe0b8,
    /** The on-island workflow route: an informational line only, connecting Gate 1, the workshop, and this island's own Gate 2 — never anything that itself moves or decides. Deliberately saturated enough to read against the island green. */
    workflow: 0x7c4fae,
  },
  /** Everything between trust zones: the sea and the mainland submission layer. */
  untrusted: {
    sea: 0x3aa0d8,
    mainland: 0xc9b389,
    /** A secondary shade within the same untrusted role, for quay structures — not a new semantic role. */
    mainlandAccent: 0x9c8a63,
  },
  /** Reserved exclusively for the two human gates: Gate 1 (project approval) and Gate 2 (output review). Never used for anything else. */
  gate: {
    amber: 0xf2a934,
  },
  /** Reserved exclusively for the vault and anything derived from it. Nothing is ever derived from it — honesty rule 2 — so this colour appears nowhere else in the world. */
  vault: {
    reserved: 0x9c2f5c,
  },
  /** Sealed crates: visually distinct from the vault they must never be confused with. */
  crate: {
    body: 0xd9a95f,
  },
  /** The customs hall building itself, one per island. Distinct from the amber gate marker for the human decision that happens inside it. */
  customs: {
    hall: 0xb98a5e,
  },
} as const;
