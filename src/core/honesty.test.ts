import { describe, expect, it } from "vitest";
import { TASK_TRANSITIONS } from "./types.ts";
import type { TaskStatus } from "./types.ts";

/**
 * Breadth-first search over the legal transition graph. Used here rather
 * than a specific scripted scenario so that if someone deletes an edge
 * from TASK_TRANSITIONS (e.g. removing PROJECT_REFUSED as a legal target
 * of AWAITING_PROJECT_APPROVAL), this fails without needing a matching
 * behavioural test to also be broken.
 */
function isReachable(from: TaskStatus, to: TaskStatus): boolean {
  const seen = new Set<TaskStatus>([from]);
  const queue: TaskStatus[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    for (const next of TASK_TRANSITIONS[current]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.has(to);
}

describe("honesty rule 5: refusal is a first-class path", () => {
  it("a task's journey can reach PROJECT_REFUSED (Gate 1 says no)", () => {
    expect(isReachable("AWAITING_PROJECT_APPROVAL", "PROJECT_REFUSED")).toBe(true);
  });

  it("a task's journey can reach OUTPUT_REFUSED (Gate 2 says no)", () => {
    expect(isReachable("AWAITING_PROJECT_APPROVAL", "OUTPUT_REFUSED")).toBe(true);
  });

  it("a task's journey can also reach RELEASED — refusal is a real fork, not the only ending", () => {
    expect(isReachable("AWAITING_PROJECT_APPROVAL", "RELEASED")).toBe(true);
  });

  it("would fail if a future edit deleted the refusal edge from either gate", () => {
    const withoutGate1Refusal = { ...TASK_TRANSITIONS, AWAITING_PROJECT_APPROVAL: ["QUEUED"] as const };
    const reachable = (() => {
      const seen = new Set<TaskStatus>(["AWAITING_PROJECT_APPROVAL"]);
      const queue: TaskStatus[] = ["AWAITING_PROJECT_APPROVAL"];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === "PROJECT_REFUSED") return true;
        for (const next of withoutGate1Refusal[current]) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return false;
    })();
    expect(reachable).toBe(false);
  });
});
