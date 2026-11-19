/**
 * @vitest-environment jsdom
 *
 * The deck's live page-tool call runs the tool's own `execute`, which makes its link absolute
 * against `location`. The year is fixed (2027), so its two Easters are fixed dates.
 */
import {
  DECK_YEAR,
  answerText,
  jsonText,
  pageToolRequest,
  runPageToolCall,
} from "./page-tool-call";

describe("the live page-tool call", () => {
  it("sends Moving Feasts' tool name and the talk's year, nothing else", () => {
    expect(pageToolRequest()).toEqual({
      name: "compute_easter_dates",
      arguments: { year: 2027 },
    });
  });

  it("answers with both Easters an agent would read, and the call's own input", async () => {
    const controller = new AbortController();
    try {
      const { call, answer } = await runPageToolCall(controller.signal);
      expect(call.name).toBe("compute_easter_dates");
      expect(answer.ok).toBe(true);
      if (!answer.ok) return;
      expect(answer.input).toMatchObject({ year: DECK_YEAR });
      expect(answer.result).toMatchObject({
        year: 2027,
        easter: {
          gregorian: "2027-03-28",
          julian: "2027-05-02",
          apart: "35 days",
          side: "Julian after Gregorian",
        },
      });
      expect(() => JSON.parse(jsonText(answer))).not.toThrow();
    } finally {
      controller.abort();
    }
  });

  it("names the year once, then the two Sundays and the gap, and leaves the notes to the JSON", async () => {
    const controller = new AbortController();
    try {
      const { answer, text } = await runPageToolCall(controller.signal);
      if (!answer.ok) throw new Error("the call was refused");
      expect(text).toBe(answerText(answer));
      expect(text).toBe(
        [
          "The page answers, for Easter Sunday in 2027:",
          "",
          "- Gregorian: `2027-03-28`",
          "- Julian: `2027-05-02`",
          "- Apart: 35 days, Julian after Gregorian",
        ].join("\n"),
      );
      expect(answer.notes.length).toBeGreaterThan(0);
    } finally {
      controller.abort();
    }
  });

  it("says why when the page refuses the call or cannot run it", () => {
    expect(
      answerText({
        ok: false,
        tool: "compute_easter_dates",
        error: "invalid-input",
        issues: [{ path: "year", message: "is out of range" }],
      }),
    ).toBe("The page refused the input: year is out of range");
    expect(
      answerText({
        ok: false,
        tool: "compute_easter_dates",
        error: "unavailable",
        message: "the library did not load",
      }),
    ).toBe("The page could not run the tool: the library did not load");
  });

  it("says when no Easter is placed, with the page's note", () => {
    expect(
      answerText({
        ok: true,
        tool: "compute_easter_dates",
        input: {},
        result: {
          year: 1900,
          easter: { gregorian: null, julian: null, apart: null, side: null },
        },
        notes: ["The library places no Easter in 1900."],
      }),
    ).toBe(
      "The page answers, for Easter Sunday in 1900:\n\n- Gregorian: none placed\n- Julian: none placed\n\nThe library places no Easter in 1900.",
    );
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    const reason = new Error("left the slide");
    controller.abort(reason);
    await expect(runPageToolCall(controller.signal)).rejects.toBe(reason);
  });
});
