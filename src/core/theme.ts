/**
 * The fixed, semantic colour palette. See CLAUDE.md "Visual language":
 * colour is semantic and fixed, never reused across roles because it
 * looks good elsewhere. Framework-agnostic (plain hex numbers) so both
 * `src/world` (three.js materials) and a future `src/ui` (CSS) can share
 * it without either depending on the other.
 */
export const theme = {
  /** Island interiors: a separate, walled trust zone. */
  trust: {
    island: 0x2f6f5e,
    wall: 0x1c4a3d,
    ferry: 0x3f8a72,
  },
  /** Everything between trust zones: the sea and the mainland submission layer. */
  untrusted: {
    sea: 0x1b3a5c,
    mainland: 0x5b6470,
  },
  /** Reserved exclusively for the two human gates: Gate 1 (project approval) and Gate 2 (output review). Never used for anything else. */
  gate: {
    amber: 0xd99a2b,
  },
  /** Reserved exclusively for the vault and anything derived from it. Nothing is ever derived from it — honesty rule 2 — so this colour appears nowhere else in the world. */
  vault: {
    reserved: 0x7a2048,
  },
  /** Sealed crates: visually distinct from the vault they must never be confused with. */
  crate: {
    body: 0xc2934f,
  },
  /** The customs hall building itself, outside every island. Distinct from the amber gate marker for the human decision that happens inside it. */
  customs: {
    hall: 0x8a6d4a,
  },
} as const;
