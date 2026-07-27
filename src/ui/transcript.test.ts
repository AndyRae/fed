import { describe, expect, it } from "vitest";
import { journeyOfATaskTour, theResultThatNeverLeftTour } from "./tours.ts";
import { buildTranscript, renderTranscriptText } from "./transcript.ts";

describe("buildTranscript", () => {
  it("has exactly one transcript stop per tour stop, in the same order", () => {
    const transcript = buildTranscript(journeyOfATaskTour);
    expect(transcript.stops.map((s) => s.stopId)).toEqual(journeyOfATaskTour.stops.map((s) => s.id));
  });

  it("carries the same plain and technical narration as the tour data — the transcript is not a paraphrase", () => {
    const transcript = buildTranscript(journeyOfATaskTour);
    for (let i = 0; i < transcript.stops.length; i++) {
      expect(transcript.stops[i]!.plain).toBe(journeyOfATaskTour.stops[i]!.narration.plain);
      expect(transcript.stops[i]!.detail).toBe(journeyOfATaskTour.stops[i]!.narration.detail);
    }
  });

  it("describes real simulation state at each stop, not canned text", () => {
    const transcript = buildTranscript(journeyOfATaskTour);
    const sealed = transcript.stops.find((s) => s.stopId === "sealed-crate")!;
    expect(sealed.stateDescription).toContain("HELD");

    const final = transcript.stops[transcript.stops.length - 1]!;
    expect(final.stateDescription).toContain("RELEASED");
  });

  it("describes the refusal outcome for the result-that-never-left tour", () => {
    const transcript = buildTranscript(theResultThatNeverLeftTour);
    const final = transcript.stops[transcript.stops.length - 1]!;
    expect(final.stateDescription).toContain("REFUSED");
  });
});

describe("renderTranscriptText", () => {
  it("renders every stop's plain narration, in order, as linear text", () => {
    const transcript = buildTranscript(journeyOfATaskTour);
    const text = renderTranscriptText(transcript);

    let lastIndex = -1;
    for (const stop of journeyOfATaskTour.stops) {
      const index = text.indexOf(stop.narration.plain);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("includes the tour title and every stop's technical detail", () => {
    const transcript = buildTranscript(journeyOfATaskTour);
    const text = renderTranscriptText(transcript);
    expect(text).toContain(journeyOfATaskTour.title);
    for (const stop of journeyOfATaskTour.stops) {
      expect(text).toContain(stop.narration.detail);
    }
  });

  it("is plain text end to end — no markup that implies a rendered scene", () => {
    const transcript = buildTranscript(journeyOfATaskTour);
    const text = renderTranscriptText(transcript);
    expect(text).not.toMatch(/<[a-z]+>/i);
  });
});
