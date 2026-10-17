import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lib } from "~/test/gnss-lib";
import { GNSS_WEEK_COUNTERS } from "./gnss-names";
import {
  CUSTOM_PRESET_ID,
  EMPTY_TEXTS,
  RIGHT_DATE_TEXT,
  ROLLING_DATE_TEXT,
  ROLLOVER_PRESETS,
  ROLLOVER_SENTENCES,
  dateOfDay,
  dayOfDate,
  isSeeded,
  matchPreset,
  parseSpan,
  permalinkOf,
  presetState,
  readArgs,
  readRollover,
  spanText,
  windowDays,
  type RolloverState,
} from "./gnss-rollover-checker";
import { beforeFirstWeekText } from "./gnss-widgets";

const NOW = "2026-10-15T00:00:00Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const preset = (id: string) => ROLLOVER_PRESETS.find((p) => p.id === id)!.state;
const read = (state: RolloverState, now = NOW) => readRollover(lib, state, now);

/** Each preset's result, from a run of the built library. */
const EXPECTED: Record<
  string,
  { reported: string; verdict: string; wrongFrom: string; left: string }
> = {
  "navic-built-2020": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2039-08-17T00:00:00Z",
    left: "4689 days",
  },
  "navic-built-2020-after-wrap": {
    reported: "2020-05-17T00:00:00Z",
    verdict: "a date 7168 days early",
    wrongFrom: "2039-08-17T00:00:00Z",
    left: "past by 137 days",
  },
  "qzss-built-2005": {
    reported: "2007-03-01T00:00:04Z",
    verdict: "a date 7167 days 23 h 59 min 56 s early",
    wrongFrom: "2025-01-14T23:59:55Z",
    left: "past by 638 days 5 s",
  },
  "galileo-built-2024": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2102-07-03T00:00:00Z",
    left: "27654 days",
  },
  "beidou-built-2024": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2181-01-01T00:00:00Z",
    left: "56326 days",
  },
  "navic-fixed-era": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "4419 days 23 h 59 min 42 s",
  },
  "navic-fixed-era-after-2038": {
    reported: "2019-05-18T00:00:00Z",
    verdict: "a date 7168 days early",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "past by 41 days 18 s",
  },
  "galileo-fixed-first-wrap": {
    reported: "1999-08-31T00:00:05Z",
    verdict: "a date 28671 days 23 h 59 min 55 s early",
    wrongFrom: "2078-02-19T23:59:42Z",
    left: "past by 9 days 18 s",
  },
  "gps-lnav-fixed-era": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "4419 days 23 h 59 min 42 s",
  },
  "firmware-ahead": {
    reported: "2046-05-31T00:00:00Z",
    verdict: "a date 7168 days late",
    wrongFrom: "2058-07-06T23:59:42Z",
    left: "11587 days 23 h 59 min 42 s",
  },
  today: {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2102-07-03T00:00:00Z",
    left: "27654 days",
  },
};

describe("presets, against the real library", () => {
  it("has an expectation for every preset, and the default is the first", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      ROLLOVER_PRESETS.map((p) => p.id).sort(),
    );
    expect(ROLLOVER_PRESETS[0]!.id).toBe("navic-built-2020");
    expect(ROLLOVER_PRESETS).toHaveLength(11);
  });

  it.each(ROLLOVER_PRESETS.map((p) => [p.id]))("%s", (id) => {
    const r = read(preset(id!));
    const want = EXPECTED[id!]!;
    expect(r.status).toBe("ok");
    expect(r.reported).toBe(want.reported);
    expect(r.verdictText).toBe(want.verdict);
    expect(r.wrongFrom).toBe(want.wrongFrom);
    expect(r.left).toBe(want.left);
    expect(r.plates.map((p) => p.value)).toEqual([
      want.reported,
      want.wrongFrom,
      want.left,
    ]);
  });

  it("every preset's description names no body or place", () => {
    for (const p of ROLLOVER_PRESETS) {
      expect(p.description + p.label).not.toMatch(
        /UTC\+3|Moscow|MSK|New_York|en-US|\bGMT\b|GPS rollover/,
      );
    }
  });

  it("only the today preset checks the live clock", () => {
    expect(
      ROLLOVER_PRESETS.filter((p) => p.state.nowMode === "today").map(
        (p) => p.id,
      ),
    ).toEqual(["today"]);
  });
});

describe("the table of next wraps", () => {
  it("lists all eight counters, with their widths, from the library", () => {
    const r = read(preset("navic-built-2020"));
    expect(r.rows.map((x) => x.counter)).toEqual([...GNSS_WEEK_COUNTERS]);
    expect(r.rows.map((x) => [x.counter, x.width, x.nextWrap, x.left])).toEqual(
      [
        ["GPS-LNAV", "weeks below 1024", "2038-11-20T23:59:42Z", "4419 days"],
        ["GPS-CNAV", "weeks below 8192", "2137-01-05T23:59:42Z", "40259 days"],
        ["GAL", "weeks below 4096", "2078-02-19T23:59:42Z", "18755 days"],
        ["BDT", "weeks below 8192", "2163-01-01T23:59:56Z", "49751 days"],
        ["QZS-LNAV", "weeks below 1024", "2038-11-20T23:59:42Z", "4419 days"],
        ["QZS-CNAV", "weeks below 8192", "2137-01-05T23:59:42Z", "40259 days"],
        ["IRN-LNAV", "weeks below 1024", "2038-11-20T23:59:42Z", "4419 days"],
        ["IRN-L1NV", "weeks below 8192", "2156-08-21T23:59:42Z", "47427 days"],
      ],
    );
  });

  it("marks the three 10-bit counters, which share their next wrap, as next to wrap", () => {
    const r = read(preset("navic-built-2020"));
    expect(r.rows.filter((x) => x.soonest).map((x) => x.counter)).toEqual([
      "GPS-LNAV",
      "QZS-LNAV",
      "IRN-LNAV",
    ]);
  });

  it("moves the soonest group when the check date passes their wrap", () => {
    const r = read(preset("navic-built-2020-after-wrap"));
    expect(r.rows.find((x) => x.counter === "GAL")!.soonest).toBe(false);
    expect(r.rows.filter((x) => x.soonest).map((x) => x.counter)).toEqual([
      "GPS-LNAV",
      "QZS-LNAV",
      "IRN-LNAV",
    ]);
    expect(r.rows.find((x) => x.counter === "GPS-LNAV")!.nextWrap).toBe(
      "2058-07-06T23:59:42Z",
    );
  });

  it("marks the receiver's own counter", () => {
    const r = read(preset("galileo-built-2024"));
    expect(r.rows.filter((x) => x.yours).map((x) => x.counter)).toEqual([
      "GAL",
    ]);
  });

  it("is drawn for every counter even when the firmware is wrong", () => {
    const r = read({ ...preset("navic-built-2020"), pivot: "garbage" });
    expect(r.status).toBe("sentinel");
    expect(r.rows.every((x) => !x.none)).toBe(true);
  });

  it("says no result for a counter the date is before", () => {
    const r = read({
      ...preset("navic-built-2020"),
      date: "1985-01-01T00:00:00Z",
    });
    // BDT, GAL and IRN had not begun.
    const none = r.rows.filter((x) => x.none).map((x) => x.counter);
    expect(none).toEqual(["GAL", "BDT", "IRN-LNAV", "IRN-L1NV"]);
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(beforeFirstWeekText("1999-08-21T23:59:47Z"));
  });
});

describe("the two firmware models", () => {
  it("a build date goes wrong at the pivot's own reading one era later", () => {
    const state = preset("navic-built-2020");
    const r = read(state);
    const own = lib.utcToGnssWeek("IRN-LNAV", state.pivot)!;
    expect(r.wrongFrom).toBe(
      lib.gnssWeekToUtc(
        "IRN-LNAV",
        own.week,
        own.timeOfWeekSeconds,
        own.era + 1,
      ),
    );
    // The instant before it still reports the right date; from it, an early one.
    const before = lib.addUtc(r.wrongFrom!, { seconds: -1 });
    expect(read({ ...state, date: before }).verdictText).toBe(RIGHT_DATE_TEXT);
    expect(read({ ...state, date: r.wrongFrom! }).verdict).toBe("early");
  });

  it("a fixed era goes wrong at the start of the next era", () => {
    const state = preset("navic-fixed-era");
    const r = read(state);
    expect(r.wrongFrom).toBe(lib.gnssWeekToUtc("IRN-LNAV", 0, 0, 2));
    const before = lib.addUtc(r.wrongFrom!, { seconds: -1 });
    expect(read({ ...state, date: before }).verdict).toBe("right");
    expect(read({ ...state, date: r.wrongFrom! }).verdict).toBe("early");
  });

  it("a fixed era reports late before its window and early after it", () => {
    const state = preset("navic-fixed-era");
    expect(read({ ...state, date: "2010-01-01T00:00:00Z" }).verdict).toBe(
      "late",
    );
    expect(read({ ...state, date: "2050-01-01T00:00:00Z" }).verdict).toBe(
      "early",
    );
  });

  it("a pivot reads a pass late when the date is before it", () => {
    const state = preset("navic-built-2020");
    expect(read({ ...state, date: "2010-01-01T00:00:00Z" }).verdict).toBe(
      "late",
    );
  });

  it("the window strip runs from the start to the end of the window after", () => {
    const r = read(preset("navic-built-2020"));
    expect(r.strip!.start).toBe("2020-01-01T00:00:00Z");
    expect(r.strip!.wrongFrom).toBe("2039-08-17T00:00:00Z");
    expect(r.strip!.end).toBe("2059-04-02T00:00:00Z");
    // The window sits on the 1980 to 2170 timeline: 2020 is a fifth of the way.
    expect(r.strip!.span.from).toBeCloseTo(21, 0);
    expect(r.strip!.span.wrong).toBeCloseTo(31.5, 0);
    expect(r.strip!.span.end).toBeCloseTo(41.5, 0);
    // The check date is before the wrong-from date, so some fuse is left.
    expect(r.strip!.fuse!.to).toBe(r.strip!.span.wrong);
    expect(r.strip!.marks.map((m) => [m.key, m.at])).toEqual([
      ["start", "2020-01-01T00:00:00Z"],
      ["wrap", "2038-11-20T23:59:42Z"],
      ["wrap", "2058-07-06T23:59:42Z"],
      ["wrong", "2039-08-17T00:00:00Z"],
      ["check", NOW],
    ]);
  });

  it("a fixed era's strip marks the wrap and the wrong-from date as one", () => {
    const r = read(preset("navic-fixed-era"));
    expect(r.strip!.marks.map((m) => m.key)).toEqual([
      "start",
      "wrong",
      "check",
    ]);
    expect(r.strip!.marks[1]!.label).toBe("the counter wraps, wrong from");
  });

  it("leaves a mark outside the timeline without a place", () => {
    const r = read({
      ...preset("navic-built-2020"),
      date: "2200-01-01T00:00:00Z",
    });
    expect(r.strip!.marks.find((m) => m.key === "check")!.pos).toBeNull();
    expect(r.strip!.fuse).toBeNull();
  });
});

describe("the fuse timeline", () => {
  const groups = () => read(preset("navic-built-2020")).fuse!.groups;

  it("has one track per counter, grouped by width", () => {
    expect(
      groups().map((g) => [g.bits, g.tracks.map((t) => t.counter)]),
    ).toEqual([
      [10, ["GPS-LNAV", "QZS-LNAV", "IRN-LNAV"]],
      [12, ["GAL"]],
      [13, ["GPS-CNAV", "BDT", "QZS-CNAV", "IRN-L1NV"]],
    ]);
    expect(groups()[0]!.label).toBe("10-bit counters, weeks below 1024");
  });

  it("marks each track's next wrap, and the earlier ones past", () => {
    const tracks = groups().flatMap((g) => g.tracks);
    const irn = tracks.find((t) => t.counter === "IRN-LNAV")!;
    expect(irn.yours).toBe(true);
    expect(irn.wraps.find((w) => w.state === "next")!.at).toBe(
      "2038-11-20T23:59:42Z",
    );
    // IRN-LNAV began in 1999, so its first wrap, in 2019, has gone.
    expect(irn.wraps.filter((w) => w.state === "past")).toHaveLength(1);
    const gps = tracks.find((t) => t.counter === "GPS-LNAV")!;
    expect(gps.wraps.filter((w) => w.state === "past").length).toBe(2);
    expect(
      tracks.filter((t) => t.wraps.some((w) => w.state === "next")),
    ).toHaveLength(8);
  });

  it("reaches the last first wrap of any counter", () => {
    const bdt = groups()
      .flatMap((g) => g.tracks)
      .find((t) => t.counter === "BDT")!;
    expect(bdt.wraps[0]!.at).toBe("2163-01-01T23:59:56Z");
  });

  it("places today on the timeline, in either mode", () => {
    expect(read(preset("navic-built-2020")).fuse!.today).toBeCloseTo(24.5, 0);
  });

  it("gives the countdown in parts, and says when it is past", () => {
    const now = read(preset("navic-built-2020")).countdown!;
    expect(now).toMatchObject({ past: false });
    expect(now.days).toBeGreaterThan(4000);
    const later = read(preset("navic-built-2020-after-wrap")).countdown!;
    expect(later.past).toBe(true);
  });
});

describe("Today and a date", () => {
  it("reads the clock it is given in Today mode and pins a date otherwise", () => {
    const state = preset("today");
    const later = "2030-06-01T12:00:00Z";
    expect(read(state, later).at).toBe(later);
    expect(read({ ...state, nowMode: "date", date: NOW }, later).at).toBe(NOW);
  });

  it("counts down second by second", () => {
    const state = preset("today");
    const a = read(state, "2026-10-15T00:00:00Z").left!;
    const b = read(state, "2026-10-15T00:00:01Z").left!;
    expect(a).toBe("27654 days");
    expect(b).toBe("27653 days 23 h 59 min 59 s");
  });

  it("reads the rolling receiver on the device clock in Today mode", () => {
    const r = read(preset("today"));
    expect(r.rolling).toBe(`rolling reads ${NOW}, ${RIGHT_DATE_TEXT}`);
  });

  it("does not read the rolling receiver for another date", () => {
    expect(read(preset("navic-built-2020")).rolling).toBe(ROLLING_DATE_TEXT);
    expect(ROLLING_DATE_TEXT).toBe(
      "rolling reads the device's real clock; switch to Today to see it",
    );
  });

  it("the printed calls are the calls made", () => {
    const r = read(preset("navic-built-2020"));
    const names = r.calls.reading.map((c) => c.fn);
    expect(names.slice(0, 2)).toEqual(["utcToGnssWeek", "gnssWeekToUtc"]);
    expect(names).toContain("areUtcEqual");
    expect(names).not.toContain("hasSecond60");
    expect(r.calls.counters).toHaveLength(24);
    const today = read(preset("today")).calls.reading;
    expect(
      today.some((c) => c.fn === "gnssWeekToUtc" && c.args[3] === "rolling"),
    ).toBe(true);
  });
});

describe("the sentences", () => {
  const base = preset("navic-built-2020");

  it("names a fault of the era", () => {
    for (const era of ["x", "-1", "1.5", "1e3"]) {
      const r = read({ ...preset("navic-fixed-era"), era });
      expect(r.status, era).toBe("sentinel");
      expect(r.failure).toBe(ROLLOVER_SENTENCES.era);
    }
  });

  it("names a build date that is not an instant", () => {
    const r = read({ ...base, pivot: "next year" });
    expect(r.failure).toBe("The build date is not an ISO 8601 instant.");
  });

  it("reads a build date before the counter's first week as era 0", () => {
    const early = read({ ...base, pivot: "1970-01-01T00:00:00Z" });
    const era0 = read({ ...base, model: "era", era: "0" });
    expect(early.status).toBe("ok");
    expect(early.failure).toBeNull();
    expect(early.reported).toBe(era0.reported);
    expect(early.wrongFrom).toBe(era0.wrongFrom);
    expect(early.verdictText).toBe(era0.verdictText);
    expect(early.left).toBe(era0.left);
    expect(early.left).not.toBeNull();
  });

  it("names a date that is not an instant", () => {
    const r = read({ ...base, date: "soon" });
    expect(r.failure).toBe(ROLLOVER_SENTENCES.date);
    expect(r.rows.every((x) => x.none)).toBe(true);
  });

  it("names the inserted second", () => {
    const r = read({ ...base, date: "2016-12-31T23:59:60Z" });
    expect(r.failure).toBe("Pick a date outside an inserted second.");
  });

  it("names a date before the counter's first week", () => {
    const r = read({ ...base, date: "1990-01-01T00:00:00Z" });
    expect(r.failure).toBe(beforeFirstWeekText("1999-08-21T23:59:47Z"));
  });

  it("names a check date that falls after the year 9999", () => {
    const r = read({
      ...base,
      nowMode: "date",
      date: "9999-12-31T23:00:00-05:00",
    });
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(ROLLOVER_SENTENCES.dateAfter9999);
    expect(r.failure).toBe("That date falls after the year 9999.");
    expect(r.failure).not.toBe(beforeFirstWeekText("1999-08-21T23:59:47Z"));
    // The last second of the year 9999 written with Z is still a date.
    const edge = read({
      ...base,
      nowMode: "date",
      date: "9999-12-31T22:00:00Z",
    });
    expect(edge.failure).not.toBe(ROLLOVER_SENTENCES.dateAfter9999);
  });

  it("names a build date that falls after the year 9999", () => {
    const r = read({ ...base, pivot: "9999-12-31T23:00:00-05:00" });
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(ROLLOVER_SENTENCES.pivotAfter9999);
    expect(r.failure).toBe("The build date falls after the year 9999.");
  });

  it("says a build date before the first week is read as era 0", () => {
    const early = read({ ...base, pivot: "1970-01-01T00:00:00Z" });
    expect(early.eraZeroHint).toBe(
      `Build date before ${base.counter}'s first week (${early.strip!.start}): read as era 0.`,
    );
    expect(early.eraZeroHint).toContain("1999-08-21T23:59:47Z");
    // A build date on or after the first week, or an era, says nothing.
    expect(read(base).eraZeroHint).toBe("");
    expect(read({ ...base, model: "era", era: "0" }).eraZeroHint).toBe("");
    expect(read({ ...base, pivot: "garbage" }).eraZeroHint).toBe("");
  });

  it("names a window that runs past the year 9999", () => {
    const r = read({ ...preset("navic-fixed-era"), era: "100000" });
    expect(r.failure).toBe(ROLLOVER_SENTENCES.beyond);
  });

  it("is an empty state, never a sentinel, when a field is blank", () => {
    for (const [patch, text] of [
      [{ pivot: " " }, EMPTY_TEXTS.pivot],
      [{ date: "" }, EMPTY_TEXTS.date],
    ] as const) {
      const r = read({ ...base, ...patch });
      expect(r.status).toBe("empty");
      expect(r.emptyText).toBe(text);
      expect(r.calls.reading).toHaveLength(0);
    }
    const era = read({ ...preset("navic-fixed-era"), era: "" });
    expect(era.status).toBe("empty");
    expect(era.emptyText).toBe(EMPTY_TEXTS.era);
  });

  it("draws every plate empty under a sentinel", () => {
    const r = read({ ...base, pivot: "garbage" });
    expect(r.plates.map((p) => p.value)).toEqual([null, null, null]);
  });

  it("the sentences are distinct", () => {
    const all = Object.values(ROLLOVER_SENTENCES);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("the slider", () => {
  it("runs by day from the window's start to the end of the window after", () => {
    const r = read(preset("navic-built-2020"));
    const days = windowDays(lib, r)!;
    expect(dateOfDay(lib, r, 0)).toBe("2020-01-01T00:00:00Z");
    expect(dateOfDay(lib, r, days)).toBe("2059-04-02T00:00:00Z");
    expect(dayOfDate(lib, r, "2020-01-02T00:00:00Z")).toBe(1);
    expect(dayOfDate(lib, r, NOW)).toBe(
      parseSpan(lib.diffUtcAsDuration("2020-01-01T00:00:00Z", NOW, "days"))!
        .days,
    );
  });

  it("follows a date that is not a whole day after the start only by not moving", () => {
    const r = read(preset("navic-built-2020"));
    expect(dayOfDate(lib, r, "2020-01-02T00:00:01Z")).toBeNull();
    expect(dayOfDate(lib, r, "garbage")).toBeNull();
    expect(dayOfDate(lib, r, "2019-01-01T00:00:00Z")).toBeNull();
  });

  it("has no days when there is no window", () => {
    const r = read({ ...preset("navic-built-2020"), pivot: "garbage" });
    expect(windowDays(lib, r)).toBeNull();
    expect(dateOfDay(lib, r, 3)).toBe("");
  });
});

describe("durations in words", () => {
  it("parses and spells what the library returned", () => {
    expect(spanText(parseSpan("P4419DT23H59M42S")!)).toBe(
      "4419 days 23 h 59 min 42 s",
    );
    expect(spanText(parseSpan("P1D")!)).toBe("1 day");
    expect(spanText(parseSpan("PT0S")!)).toBe("0 s");
    expect(parseSpan("-P7168D")!.negative).toBe(true);
    expect(parseSpan("")).toBeNull();
    expect(parseSpan("P")).toBeNull();
    expect(parseSpan("PT")).toBeNull();
    expect(parseSpan("soon")).toBeNull();
  });
});

describe("permalink and seed", () => {
  it("round-trips every preset as the preset's id", () => {
    for (const p of ROLLOVER_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
      expect(permalinkOf(presetState(p))).toEqual({ preset: p.id });
      expect(readArgs({ preset: p.id })).toEqual(p.state);
    }
  });

  it("writes a custom state as strings of 1 to 64 characters", () => {
    const state: RolloverState = {
      counter: "BDT",
      model: "pivot",
      pivot: "2022-02-02T02:02:02Z",
      era: "1",
      nowMode: "date",
      date: "2030-05-05T05:05:05Z",
    };
    expect(matchPreset(state)).toBe(CUSTOM_PRESET_ID);
    const link = permalinkOf(state);
    expect(link).toEqual({
      counter: "BDT",
      firmwareNotBefore: "2022-02-02T02:02:02Z",
      date: "2030-05-05T05:05:05Z",
    });
    expect(readArgs(link)).toEqual(state);
  });

  it("leaves the date out for today and keeps an era as digits", () => {
    const state: RolloverState = {
      counter: "GPS-LNAV",
      model: "era",
      pivot: "2020-01-01T00:00:00Z",
      era: "3",
      nowMode: "today",
      date: NOW,
    };
    const link = permalinkOf(state);
    expect(link).toEqual({ counter: "GPS-LNAV", firmwareEra: "3" });
    expect(readArgs(link)).toMatchObject({
      counter: "GPS-LNAV",
      model: "era",
      era: "3",
      nowMode: "today",
    });
  });

  it("reads a chat call: counter and build date check today, a date pins it", () => {
    const today = readArgs({
      counter: "IRN-LNAV",
      firmwareNotBefore: "2020-01-01T00:00:00Z",
    });
    expect(today.nowMode).toBe("today");
    expect(today.model).toBe("pivot");
    const pinned = readArgs({
      counter: "GAL",
      firmwareEra: 0,
      date: "2078-03-01T00:00:00Z",
    });
    expect(pinned).toMatchObject({
      counter: "GAL",
      model: "era",
      era: "0",
      nowMode: "date",
      date: "2078-03-01T00:00:00Z",
    });
  });

  it("prefers a build date to an era, and ignores a counter it does not know", () => {
    const s = readArgs({
      counter: "NOPE",
      firmwareNotBefore: "2021-01-01T00:00:00Z",
      firmwareEra: "2",
    });
    expect(s.counter).toBe("IRN-LNAV");
    expect(s.model).toBe("pivot");
  });

  it("knows what seeds it", () => {
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ date: "" })).toBe(false);
    expect(isSeeded({ counter: "GAL" })).toBe(true);
  });
});

it("holds no skipped, todo or failing test", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("./gnss-rollover-checker.test.ts", import.meta.url),
    "utf8",
  );
  expect(source).not.toMatch(/\bit\.(?:skip|todo|fails)\b/);
});

describe("an instant written with an offset", () => {
  const after = preset("navic-built-2020-after-wrap");

  it("reads a check date with an offset as the same instant written with Z", () => {
    const withOffset = read({ ...after, date: "2040-01-01T00:00:00+01:00" });
    const asZ = read({ ...after, date: "2039-12-31T23:00:00Z" });
    expect(withOffset.status).toBe("ok");
    expect(withOffset.verdict).not.toBe("right");
    expect(withOffset.verdictText).toBe(asZ.verdictText);
    expect(withOffset.left).toBe(asZ.left);
    expect(withOffset.left).not.toBeNull();
    expect(withOffset.reported).toBe(asZ.reported);
  });

  it("reads +00:00 as Z, so a wrong date is never called right", () => {
    const r = read({ ...after, date: "2040-01-01T00:00:00+00:00" });
    expect(r.verdict).toBe("early");
    expect(r.reported).toBe(
      read({ ...after, date: "2040-01-01T00:00:00Z" }).reported,
    );
    expect(r.verdictText).not.toBe(RIGHT_DATE_TEXT);
    expect(r.left).not.toBeNull();
  });

  it("reads a build date with an offset as the same instant written with Z", () => {
    const withOffset = read({
      ...after,
      pivot: "2020-01-01T01:00:00+01:00",
    });
    const asZ = read({ ...after, pivot: "2020-01-01T00:00:00Z" });
    expect(withOffset.status).toBe("ok");
    expect(withOffset.reported).toBe(asZ.reported);
    expect(withOffset.wrongFrom).toBe(asZ.wrongFrom);
    expect(withOffset.verdictText).toBe(asZ.verdictText);
    expect(withOffset.strip).toEqual(asZ.strip);
    expect(windowDays(lib, withOffset)).toBe(windowDays(lib, asZ));
  });

  it("puts the slider on the same day for a date with an offset", () => {
    const r = read(preset("navic-built-2020"));
    expect(dayOfDate(lib, r, "2020-01-02T01:00:00+01:00")).toBe(1);
  });

  it("never turns an unreadable difference into a right date", () => {
    const broken = {
      ...lib,
      diffUtcAsDuration: () => "",
      areUtcEqual: () => false,
    };
    const r = readRollover(broken, after, NOW);
    expect(r.status).toBe("sentinel");
    expect(r.verdict).not.toBe("right");
  });
});
