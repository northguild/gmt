/**
 * The Duration Parser Bench's pure logic against the real library. Every unit,
 * string and hour is a value the built library returns; the expected literals
 * below were read from a run of `packages/gmt/dist`.
 */
import { describe, expect, it } from "vitest";
import { loadDurationBenchLib } from "./duration-bench-lib";
import type { DurationBenchLib } from "./duration-bench-lib";
import {
  BENCH_DEFAULT_TEXT,
  BENCH_MAX_TEXT,
  DURATION_FIELDS,
  LAYTIME_STARTS,
  MINUTE_OR_MONTH_ROWS,
  REFUSAL_TEXT,
  TRY_STRINGS,
  benchView,
  laytimeRows,
  minuteOrMonthRows,
  permalinkOf,
  readArgs,
} from "./duration-parser-bench";

const lib = await loadDurationBenchLib();

describe("readArgs and permalinkOf", () => {
  it("defaults the text and the locale", () => {
    expect(readArgs({})).toEqual({ text: BENCH_DEFAULT_TEXT, locale: "en" });
    expect(readArgs({ text: "" }).text).toBe(BENCH_DEFAULT_TEXT);
  });

  it("never trims the text, and caps it at the permalink limit", () => {
    expect(readArgs({ text: " 2h" }).text).toBe(" 2h");
    expect(readArgs({ text: "x".repeat(100) }).text).toHaveLength(
      BENCH_MAX_TEXT,
    );
  });

  it("writes the locale only when it is not the default", () => {
    expect(permalinkOf({ text: "1m", locale: "en" })).toEqual({ text: "1m" });
    expect(permalinkOf({ text: "1m", locale: "de-DE" })).toEqual({
      text: "1m",
      locale: "de-DE",
    });
    expect(permalinkOf({ text: "", locale: "en" })).toEqual({});
  });
});

describe("the ten fields", () => {
  it("run from years to nanoseconds, and only two have no spelling", () => {
    expect(DURATION_FIELDS.map((f) => f.field)).toEqual([
      "years",
      "months",
      "weeks",
      "days",
      "hours",
      "minutes",
      "seconds",
      "milliseconds",
      "microseconds",
      "nanoseconds",
    ]);
    expect(DURATION_FIELDS.filter((f) => f.symbol === null)).toHaveLength(2);
  });
});

describe("benchView", () => {
  it("reads a human string: parser, ISO, units, compact, round trip, words", () => {
    const v = benchView(lib, "2h 30m", "en");
    expect(v.parser).toBe("human");
    expect(v.iso).toBe("PT2H30M");
    expect(v.refusal).toBeNull();
    expect(v.cells.filter((c) => c.lit).map((c) => c.field)).toEqual([
      "hours",
      "minutes",
    ]);
    expect(v.cells.find((c) => c.field === "hours")?.value).toBe(2);
    expect(v.compact).toBe("2h 30m");
    expect(v.roundTrip).toBe("PT2H30M");
    expect(v.sameDuration).toBe(true);
    expect(v.words).toBe(lib.formatDuration("PT2H30M", "en"));
    expect(Object.values(v.calls).map((c) => c?.fn)).toEqual([
      "parseDuration",
      "parseHumanDuration",
      "formatHumanDuration",
      "parseHumanDuration",
      "formatDuration",
    ]);
  });

  it("reads an ISO string with the ISO parser", () => {
    const v = benchView(lib, "PT90M", "en");
    expect(v.parser).toBe("iso");
    expect(v.iso).toBe("PT90M");
    expect(v.compact).toBe("90m");
    expect(v.sameDuration).toBe(true);
  });

  it("reads P1M as ISO: the human parser returns an empty string", () => {
    const v = benchView(lib, "P1M", "en");
    expect(v.calls.human?.result).toBe("");
    expect(v.calls.iso?.result).toBe("P1M");
    expect(v.parser).toBe("iso");
    expect(v.cells.find((c) => c.field === "months")?.lit).toBe(true);
  });

  it.each([" 2h", "2h 3h", "nonsense", ""])(
    "makes only the two parse calls for %j and says so",
    (text) => {
      const v = benchView(lib, text, "en");
      expect(v.parser).toBe("none");
      expect(v.iso).toBe("");
      expect(v.refusal).toBe(REFUSAL_TEXT);
      expect(v.cells.every((c) => c.value === null && !c.lit)).toBe(true);
      expect(v.compact).toBeNull();
      expect(v.roundTrip).toBeNull();
      expect(v.sameDuration).toBeNull();
      expect(v.words).toBeNull();
      expect(v.calls.compact).toBeNull();
      expect(v.calls.iso?.result).toBe("");
      expect(v.calls.human?.result).toBe("");
    },
  );

  it("reads every Try string as the library does", () => {
    const read = TRY_STRINGS.map((s) => [s, benchView(lib, s, "en").parser]);
    expect(read).toEqual([
      ["1.5h", "human"],
      ["2h, and 30m", "human"],
      ["30m 2h", "none"],
      ["1.5h 30m", "none"],
      ["2h 3h", "none"],
      ["1,5h", "none"],
      ["PT90M", "iso"],
      ["-2h 30m", "human"],
    ]);
  });

  it("calls only the library it was given", () => {
    const calls: string[] = [];
    const spy = new Proxy({} as DurationBenchLib, {
      get:
        (_t, name: string) =>
        (...args: unknown[]) => {
          calls.push(name);
          return (
            lib as unknown as Record<string, (...a: unknown[]) => unknown>
          )[name]!(...args);
        },
    });
    benchView(spy, "2h 30m", "en");
    expect(new Set(calls)).toEqual(
      new Set([
        "parseDuration",
        "parseHumanDuration",
        "getDurationUnit",
        "formatHumanDuration",
        "formatDuration",
      ]),
    );
  });
});

describe("table A: minute or month", () => {
  const rows = minuteOrMonthRows(lib, "en");

  it("has the seven rows in order", () => {
    expect(rows.map((r) => r.written)).toEqual([
      "1m",
      "1M",
      "1min",
      "1mo",
      "1 month",
      "500ms",
      "P1M",
    ]);
    expect(rows).toHaveLength(MINUTE_OR_MONTH_ROWS.length);
  });

  it("gives each row the unit its note names", () => {
    for (const r of rows) expect(r.unitFound).toBe(r.unit);
  });

  it("shows P1M as a refusal by the human parser and a month by the ISO parser", () => {
    const p1m = rows.at(-1)!;
    expect(p1m.human).toBe("");
    expect(p1m.iso).toBe("P1M");
    expect(p1m.unitFound).toBe("month");
  });
});

describe("table B: laytime", () => {
  it("measures P3D on the zone's clock and PT72H in exact hours", () => {
    const rows = laytimeRows(lib);
    expect(rows.map((r) => r.written)).toEqual(["3 days", "72h"]);
    expect(rows.map((r) => r.human)).toEqual(["P3D", "PT72H"]);
    expect(rows.flatMap((r) => r.hours)).toEqual([71, 73, 72, 72]);
    expect(LAYTIME_STARTS).toHaveLength(2);
  });
});
