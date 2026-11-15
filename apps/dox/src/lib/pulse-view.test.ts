import {
  beatLabel,
  beats,
  beatsCaption,
  cadenceText,
  nextRun,
  noSignal,
  resultOf,
  type Run,
} from "./pulse-view";

const run = (startedAt: string, conclusion = "success"): Run => ({
  startedAt,
  conclusion,
  url: `https://example.test/${startedAt}`,
});

// A Saturday at 14:00 UTC; the Monday 06:17 runs before it are 2, 9, 16, 23 Nov ... counting back.
const READ = "2026-11-14T14:00:00Z";

describe("cadenceText", () => {
  it.each([
    ["17 6 * * 1", "Every Monday at 06:17 UTC"],
    ["23 3 * * 6", "Every Saturday at 03:23 UTC"],
    ["43 6 * * 1", "Every Monday at 06:43 UTC"],
    ["17 7 * * 1", "Every Monday at 07:17 UTC"],
    ["41 4 * * 0", "Every Sunday at 04:41 UTC"],
    ["0 6 * * *", "Every day at 06:00 UTC"],
  ])("reads %s as %s", (cron, words) => {
    expect(cadenceText(cron)).toBe(words);
  });

  it("throws on a schedule it cannot say in words", () => {
    expect(() => cadenceText("*/5 * * * *")).toThrow(/cannot read/);
    expect(() => cadenceText("0 6 * * 1,3")).toThrow(/cannot read/);
    expect(() => cadenceText("0 6 1 * *")).toThrow(/cannot read/);
    expect(() => cadenceText("nonsense")).toThrow(/cannot read/);
  });
});

describe("nextRun", () => {
  it("is the first schedule time after the given instant", () => {
    expect(nextRun("17 6 * * 1", READ)).toBe("2026-11-16T06:17:00Z");
  });
});

describe("beats", () => {
  it("answers each expected time with the run that started after it", () => {
    const list = beats(
      "17 6 * * 1",
      [run("2026-11-09T06:30:00Z"), run("2026-11-02T06:25:00Z", "failure")],
      READ,
    );
    expect(list).toHaveLength(8);
    expect(list.at(-1)).toMatchObject({
      expected: "2026-11-09T06:17:00Z",
      result: "passed",
    });
    expect(list.at(-2)).toMatchObject({
      expected: "2026-11-02T06:17:00Z",
      result: "failed",
    });
  });

  it("marks a week with no run as No run", () => {
    const list = beats("17 6 * * 1", [run("2026-11-09T06:30:00Z")], READ);
    expect(list.at(-2)?.result).toBe("none");
    expect(list.at(-2)?.run).toBeNull();
    expect(beatLabel(list.at(-2)!)).toBe("No run, expected 2 November");
  });

  it("counts a 13:00 start as the 06:17 run, because GitHub may start a run hours late", () => {
    const list = beats("17 6 * * 1", [run("2026-11-09T13:00:00Z")], READ);
    expect(list.at(-1)?.result).toBe("passed");
  });

  it("does not give one run to the next week's expected time", () => {
    const list = beats("17 6 * * 1", [run("2026-11-02T06:20:00Z")], READ);
    expect(list.at(-2)?.result).toBe("passed");
    expect(list.at(-1)?.result).toBe("none");
  });

  it("calls a cancelled run Did not finish", () => {
    const list = beats(
      "17 6 * * 1",
      [run("2026-11-09T06:20:00Z", "cancelled")],
      READ,
    );
    expect(list.at(-1)?.result).toBe("unfinished");
    expect(beatsCaption(list)).toBe(
      "Last 8 · latest Did not finish, 9 November",
    );
  });

  it("with no runs at all, every beat is No run", () => {
    expect(
      beats("17 6 * * 1", [], READ).every((b) => b.result === "none"),
    ).toBe(true);
  });
});

describe("resultOf", () => {
  it.each([
    ["success", "passed"],
    ["failure", "failed"],
    ["startup_failure", "failed"],
    ["cancelled", "unfinished"],
    ["timed_out", "unfinished"],
    ["skipped", "unfinished"],
  ])("%s is %s", (conclusion, result) => {
    expect(resultOf(conclusion)).toBe(result);
  });
});

describe("noSignal", () => {
  it("is no signal when no history was read", () => {
    expect(noSignal(null, null)?.text).toBe(
      "Run history not read in this build",
    );
    expect(noSignal(null, READ)?.reason).toBe("not-read");
  });

  it("trusts a read of a few days", () => {
    expect(noSignal([], READ, "2026-11-20T14:00:00Z")).toBeNull();
  });

  it("does not trust a 9-day-old read", () => {
    expect(noSignal([], READ, "2026-11-23T14:00:00Z")).toEqual({
      reason: "stale",
      text: "Run history is 9 days old",
    });
  });

  it("at build, with no now, only a missing history is no signal", () => {
    expect(noSignal([], READ)).toBeNull();
  });
});
