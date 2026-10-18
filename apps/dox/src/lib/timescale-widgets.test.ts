/**
 * `timescale-widgets.ts`'s pure helpers, against the real gmt modules through
 * `~/test/timescale-lib`. Every library result a test states was read from a
 * run against the built `dist`; where a test can ask the library instead of
 * stating a value, it does.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadTimescaleLib, type TimescaleLib } from "./timescale-lib";
import {
  CONTINUOUS_UTC_FROM,
  INTEGER_UTC_FROM,
  insertions,
  insertionsBetween,
  secondAfter,
  secondsText,
} from "./timescale-widgets";
import { WidgetLoadError } from "./widget-mount";
import { lib } from "~/test/timescale-lib";

/** One second before an instant, asked of the library. */
const secondBefore = (instant: string) => lib.addUtc(instant, { seconds: -1 });

describe("INTEGER_UTC_FROM", () => {
  it("is the instant TAI - UTC starts to read, 10 s, and null one second before", () => {
    expect(INTEGER_UTC_FROM).toBe("1972-01-01T00:00:00Z");
    expect(lib.taiMinusUtc(INTEGER_UTC_FROM)).toBe(10);
    expect(lib.taiMinusUtc(secondBefore(INTEGER_UTC_FROM))).toBeNull();
    expect(lib.taiMinusUtc("1971-12-31T23:59:59Z")).toBeNull();
  });

  it("is the first instant the library reads on the TAI side too", () => {
    expect(lib.toTAI(INTEGER_UTC_FROM)).not.toBe("");
    expect(lib.toTAI(secondBefore(INTEGER_UTC_FROM))).toBe("");
  });
});

describe("CONTINUOUS_UTC_FROM", () => {
  it("is a date with no time of day, as the resolution states it", () => {
    expect(CONTINUOUS_UTC_FROM).toBe("2027-05-20");
    expect(CONTINUOUS_UTC_FROM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is after the last insertion the library lists", () => {
    const last = insertions(lib).at(-1)!;
    expect(`${CONTINUOUS_UTC_FROM}T00:00:00Z` > last).toBe(true);
  });
});

describe("insertions", () => {
  it("walks nextLeapSecond from 1972 until it runs out", () => {
    const list = insertions(lib);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toBe("1972-06-30T23:59:60Z");
    expect(list.at(-1)).toBe("2016-12-31T23:59:60Z");
    // The walk ended: nothing follows the last one.
    expect(lib.nextLeapSecond(list.at(-1)!)).toBe("");
  });

  it("lists only real, ordered, distinct insertions", () => {
    const list = insertions(lib);
    expect([...list].sort()).toEqual(list);
    expect(new Set(list).size).toBe(list.length);
    for (const insertion of list) {
      expect(lib.isLeapSecond(insertion)).toBe(true);
      expect(lib.hasSecond60(insertion)).toBe(true);
    }
  });

  it("is each step the library's own next", () => {
    const list = insertions(lib);
    expect(lib.nextLeapSecond(INTEGER_UTC_FROM)).toBe(list[0]);
    for (let i = 1; i < list.length; i += 1) {
      expect(lib.nextLeapSecond(list[i - 1]!)).toBe(list[i]);
    }
  });

  it("steps TAI - UTC by one across each insertion", () => {
    for (const insertion of insertions(lib)) {
      const before = lib.taiMinusUtc(insertion);
      const after = lib.taiMinusUtc(secondAfter(lib, insertion));
      expect(before).not.toBeNull();
      expect(after).toBe(before! + 1);
    }
  });

  it("starts at 10 s and ends one step per insertion later", () => {
    const list = insertions(lib);
    expect(lib.taiMinusUtc(INTEGER_UTC_FROM)).toBe(10);
    expect(lib.taiMinusUtc(secondAfter(lib, list.at(-1)!))).toBe(
      10 + list.length,
    );
    expect(lib.taiMinusUtc(secondAfter(lib, list.at(-1)!))).toBe(37);
  });

  it("does not loop when the library repeats itself", () => {
    const stuck: TimescaleLib = {
      ...lib,
      nextLeapSecond: () => "1972-06-30T23:59:60Z",
    };
    expect(insertions(stuck)).toEqual(["1972-06-30T23:59:60Z"]);
  });
});

describe("secondAfter", () => {
  it("is the first instant whose TAI - UTC is the new value, for every insertion", () => {
    for (const insertion of insertions(lib)) {
      const after = secondAfter(lib, insertion);
      const value = lib.taiMinusUtc(after);
      expect(value).toBe(lib.taiMinusUtc(insertion)! + 1);
      // And the second before it is still on the old value.
      expect(lib.taiMinusUtc(secondBefore(after))).toBe(value! - 1);
    }
  });

  it("is the library's addUtc of the insertion read as second 59", () => {
    expect(secondAfter(lib, "1972-06-30T23:59:60Z")).toBe(
      lib.addUtc("1972-06-30T23:59:59Z", { seconds: 1 }),
    );
    expect(secondAfter(lib, "1972-06-30T23:59:60Z")).toBe(
      "1972-07-01T00:00:00Z",
    );
    expect(secondAfter(lib, "2016-12-31T23:59:60Z")).toBe(
      "2017-01-01T00:00:00Z",
    );
  });

  it("is the sentinel for a label that is not second 60", () => {
    expect(secondAfter(lib, "2016-12-31T23:59:59Z")).toBe("");
    expect(secondAfter(lib, "")).toBe("");
  });
});

/** Every from/to pair of the Leap Second Timeline's and Elapsed vs.
 *  Clock's presets, plus the one where the library counts nothing. */
const PRESET_PAIRS: readonly (readonly [string, string])[] = [
  ["2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z"],
  ["2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z"],
  ["2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z"],
  ["2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z"],
  ["2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z"],
  ["2017-12-31T23:59:60Z", "2018-01-01T00:00:00Z"],
  ["1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z"],
];

describe("insertionsBetween", () => {
  it.each(PRESET_PAIRS)(
    "%s to %s: the list is as long as the library's count",
    (start, end) => {
      const count = lib.leapSecondsBetween(start, end);
      if (count === null) return;
      expect(insertionsBetween(lib, start, end, count)).toHaveLength(
        Math.abs(count),
      );
    },
  );

  it("counts the preset pairs the way the library does", () => {
    const counts = PRESET_PAIRS.map(([s, e]) => lib.leapSecondsBetween(s, e));
    expect(counts).toEqual([5, -5, 1, 1, 0, null, null]);
  });

  it("lists the five seconds from 2000 to 2024, and the same five backwards", () => {
    const forward = insertionsBetween(
      lib,
      "2000-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      5,
    );
    expect(forward).toEqual([
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ]);
    expect(
      insertionsBetween(
        lib,
        "2024-01-01T00:00:00Z",
        "2000-01-01T00:00:00Z",
        -5,
      ),
    ).toEqual(forward);
  });

  it("lists the second a span starts on, as the count is half-open", () => {
    const start = "2016-12-31T23:59:60Z";
    const end = "2017-01-01T00:00:00Z";
    expect(lib.leapSecondsBetween(start, end)).toBe(1);
    expect(insertionsBetween(lib, start, end, 1)).toEqual([start]);
  });

  it("lists the second a span crosses", () => {
    expect(
      insertionsBetween(lib, "2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z", 1),
    ).toEqual(["2016-12-31T23:59:60Z"]);
  });

  it("is empty for a count of zero", () => {
    expect(
      insertionsBetween(lib, "2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z", 0),
    ).toEqual([]);
  });

  it("does not list a second that began before the span", () => {
    const start = "2016-12-31T23:59:60.5Z";
    const end = "2017-01-01T00:00:00Z";
    expect(lib.leapSecondsBetween(start, end)).toBe(0);
    expect(insertionsBetween(lib, start, end, 0)).toEqual([]);
    // Counting forward from the same instant to a later one lists the next
    // insertions only, never this one.
    const count = lib.leapSecondsBetween(start, "2030-01-01T00:00:00Z");
    expect(count).toBe(0);
  });

  it("reads an offset spelling of an insertion as the second it is", () => {
    const start = "2009-01-01T08:59:60+09:00";
    const end = "2017-01-01T00:00:00Z";
    const count = lib.leapSecondsBetween(start, end);
    expect(count).toBe(4);
    expect(insertionsBetween(lib, start, end, count!)).toEqual([
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ]);
  });

  it("lists every insertion from 1972 for the whole count", () => {
    const all = insertions(lib);
    const end = "2027-01-01T00:00:00Z";
    const count = lib.leapSecondsBetween(INTEGER_UTC_FROM, end);
    expect(count).toBe(all.length);
    expect(insertionsBetween(lib, INTEGER_UTC_FROM, end, count!)).toEqual(all);
  });

  it("stops early if the library runs out", () => {
    expect(
      insertionsBetween(lib, "2016-12-31T23:59:59Z", "2030-01-01T00:00:00Z", 3),
    ).toEqual(["2016-12-31T23:59:60Z"]);
  });
});

describe("secondsText", () => {
  it("writes whole seconds", () => {
    expect(secondsText(86_401n * 1_000_000_000n)).toBe("86401 s");
    expect(secondsText(0n)).toBe("0 s");
  });

  it("writes a fraction to nine digits and drops trailing zeros", () => {
    expect(secondsText(1_500_000_000n)).toBe("1.5 s");
    expect(secondsText(1n)).toBe("0.000000001 s");
    expect(secondsText(123_456_789n)).toBe("0.123456789 s");
  });

  it("keeps the sign of a backwards span", () => {
    expect(secondsText(-3_000_000_000n)).toBe("-3 s");
    expect(secondsText(-1_500_000_000n)).toBe("-1.5 s");
  });

  it("reads the spans the library measures: the clock's and the elapsed one", () => {
    const start = "2016-12-31T23:59:59Z";
    const end = "2017-01-01T00:00:01Z";
    const clock = lib.spanNs(start, end);
    expect(clock).not.toBeNull();
    expect(secondsText(clock!)).toBe("2 s");
    const taiStart = lib.toTAI(start).split(" ")[0];
    const taiEnd = lib.toTAI(end).split(" ")[0];
    const elapsed = lib.spanNs(`${taiStart}Z`, `${taiEnd}Z`);
    expect(secondsText(elapsed!)).toBe("3 s");
  });
});

describe("loadTimescaleLib", () => {
  it("hands back every function the test library holds, as the library's own", async () => {
    const loaded = await loadTimescaleLib();
    expect(Object.keys(loaded).sort()).toEqual(Object.keys(lib).sort());
    for (const name of Object.keys(lib) as (keyof TimescaleLib)[]) {
      expect(loaded[name], name).toBe(lib[name]);
    }
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["span/calculate"];
    GMT_MODULES["span/calculate"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadTimescaleLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["span/calculate"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["timescale/convert"];
    GMT_MODULES["timescale/convert"] = () => Promise.resolve({});
    try {
      await expect(loadTimescaleLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["timescale/convert"] = original;
    }
  });
});
