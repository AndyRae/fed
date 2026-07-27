import { describe, expect, it } from "vitest";
import {
  IllegalTaskTransitionError,
  TASK_TRANSITIONS,
  TERMINAL_TASK_STATUSES,
  assertTaskTransition,
  isLegalTaskTransition,
} from "./types.ts";
import type { TaskStatus } from "./types.ts";

describe("TES task state machine", () => {
  it("allows the full happy-path journey of a task", () => {
    const journey: TaskStatus[] = [
      "AWAITING_PROJECT_APPROVAL",
      "QUEUED",
      "INITIALIZING",
      "RUNNING",
      "COMPLETE",
      "AWAITING_OUTPUT_REVIEW",
      "RELEASED",
    ];
    for (let i = 0; i < journey.length - 1; i++) {
      const from = journey[i]!;
      const to = journey[i + 1]!;
      expect(isLegalTaskTransition(from, to)).toBe(true);
      expect(() => assertTaskTransition(from, to)).not.toThrow();
    }
  });

  it("reaches the project-refusal path from Gate 1", () => {
    expect(isLegalTaskTransition("AWAITING_PROJECT_APPROVAL", "PROJECT_REFUSED")).toBe(true);
  });

  it("reaches the output-refusal path from Gate 2", () => {
    expect(isLegalTaskTransition("AWAITING_OUTPUT_REVIEW", "OUTPUT_REFUSED")).toBe(true);
  });

  it("allows execution failure and cancellation from in-flight states", () => {
    expect(isLegalTaskTransition("QUEUED", "CANCELED")).toBe(true);
    expect(isLegalTaskTransition("INITIALIZING", "CANCELED")).toBe(true);
    expect(isLegalTaskTransition("RUNNING", "CANCELED")).toBe(true);
    expect(isLegalTaskTransition("INITIALIZING", "EXECUTOR_ERROR")).toBe(true);
    expect(isLegalTaskTransition("RUNNING", "EXECUTOR_ERROR")).toBe(true);
  });

  it("rejects illegal skips of the state machine", () => {
    expect(isLegalTaskTransition("AWAITING_PROJECT_APPROVAL", "RUNNING")).toBe(false);
    expect(isLegalTaskTransition("QUEUED", "COMPLETE")).toBe(false);
    expect(isLegalTaskTransition("AWAITING_PROJECT_APPROVAL", "RELEASED")).toBe(false);
  });

  it("rejects skipping output review straight to released", () => {
    expect(isLegalTaskTransition("COMPLETE", "RELEASED")).toBe(false);
  });

  it("throws IllegalTaskTransitionError with the offending states on an illegal move", () => {
    expect(() => assertTaskTransition("RELEASED", "RUNNING")).toThrow(IllegalTaskTransitionError);
    try {
      assertTaskTransition("RELEASED", "RUNNING");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(IllegalTaskTransitionError);
      const illegal = error as IllegalTaskTransitionError;
      expect(illegal.from).toBe("RELEASED");
      expect(illegal.to).toBe("RUNNING");
    }
  });

  it("has no outgoing transitions from any terminal status", () => {
    for (const status of TERMINAL_TASK_STATUSES) {
      expect(TASK_TRANSITIONS[status]).toEqual([]);
    }
  });

  it("marks exactly the five terminal statuses as terminal", () => {
    expect([...TERMINAL_TASK_STATUSES].sort()).toEqual(
      ["CANCELED", "EXECUTOR_ERROR", "OUTPUT_REFUSED", "PROJECT_REFUSED", "RELEASED"].sort(),
    );
  });

  it("every non-terminal status has at least one legal transition", () => {
    for (const status of Object.keys(TASK_TRANSITIONS) as TaskStatus[]) {
      if (TERMINAL_TASK_STATUSES.includes(status)) continue;
      expect(TASK_TRANSITIONS[status].length).toBeGreaterThan(0);
    }
  });
});
