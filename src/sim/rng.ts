/**
 * Deterministic PRNG (mulberry32). Every source of randomness in the sim
 * must go through an instance of this so a seed plus a directive script
 * fully determines a run — see CLAUDE.md "Simulation model".
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
