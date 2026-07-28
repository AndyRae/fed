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
    /** The on-island workflow route: an informational path only, connecting Gate 1, the workshop, and this island's own Gate 2 — never anything that itself moves or decides. Rendered as a physical dirt road (see routes.ts), so this is an earthy tone rather than the glowing colour the ferry/egress tracks use — that contrast is deliberate: this is the one route nothing ever rides. */
    workflow: 0xa5744a,
    /** Secondary shades within the trust role, for terrain decoration only — not new semantic roles, same precedent as untrusted.mainlandAccent below. islandDirt tints the same scattered dirt patches and exposed ground as the road; islandBeach is the sandy coastal ring around every island. */
    islandDirt: 0x8a6b45,
    islandBeach: 0xe3c988,
  },
  /** Everything between trust zones: the sea and the mainland submission layer. */
  untrusted: {
    sea: 0x3aa0d8,
    mainland: 0xc9b389,
    /** Secondary shades within the same untrusted role, for building variety in the researcher quarter — not new semantic roles, same precedent as trust.islandDirt/islandBeach. Three distinct accents so the quarter reads as a real mixed skyline, not one colour repeated. */
    mainlandAccent: 0x9c8a63,
    mainlandAccent2: 0xc06b4a,
    mainlandAccent3: 0x7d8a94,
    /** Rooftops across the researcher quarter — one more secondary shade, distinct from every wall colour so roof and building silhouettes read apart from a distance. */
    roof: 0x5c4a3d,
    /** The paved plaza under the researcher quarter — stone, not grass: keeps the ground itself reading as urban even where it isn't sandy coastline or bare tan. */
    plaza: 0xaba290,
    /** A submitted task's own colour on its one-way trip from the researcher quarter to the quay — see engine/flowController.ts. Deliberately a pale "paperwork" tone, distinct from the ferry's container (trust.ferry) and the crate it will eventually become (crate.body): this hasn't been agreed to by any island yet. */
    submission: 0xeee0c5,
    /** A thin, lighter ring where each island's own beach meets the open sea (see world/island.ts) — purely a coastline blend, not a new zone or gate; still the untrusted role, just a lighter tone of it. */
    foam: 0xdff3fa,
    /** The whale that occasionally surfaces out in open water (see world/whale.ts) — pure ambient decoration, like the sea's own swell, so it stays within the untrusted role rather than becoming a new one. */
    whale: 0x2b4a5c,
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
  /** A fixture, not a zone or a gate: the small running light every island's own ferry carries (see engine/flowController.ts's buildFerryMesh). Present at all times, but only lit — see engine/nightMode.ts — once night mode is on. */
  night: {
    ferryLight: 0xfff2c9,
  },
} as const;
