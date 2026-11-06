import {
  isDefectPresent,
  isRangeDayPeriodCompatNeeded,
  isRangeZoneNameCompatNeeded,
  isNudgeOriginCompatNeeded,
  isTimeZoneEqualsCompatNeeded,
  reproPasses,
  runRepro,
} from "./capabilities";
import { probeRepros, readOrNone } from "./probeRepros";
import { findRepro, repros } from "./repros";

// Probe tests never assert the probe's outcome against the installed polyfill: that would fail CI
// the day upstream ships the fix, which is the canary's job (temporalCompat README, "Canary and native oracle"). They pin the
// spec-correct expected constants to their quoted sources.
describe("repros", () => {
  // D9: an amount of months past the date range throws RangeError (TC39 CalendarDateAdd), and the
  // work to get there must not grow with the amount.
  it("expects the D9 out-of-range repro to report bounded work", () => {
    expect(
      findRepro("D9", "hebrew", "outOfRangeMonthsThrowInBoundedTime")?.expected,
    ).toBe("bounded");
  });

  it("has exactly one repro per defect, calendar and name", () => {
    const keys = repros.map((r) => `${r.defect}/${r.calendar}/${r.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("reproPasses", () => {
  it.each`
    recorded
    ${"900 ms, then 9000 ms for ten times the months"}
    ${"40000000 months did not throw"}
  `("reads '$recorded' as the defect", ({ recorded }) => {
    const repro = findRepro(
      "D9",
      "hebrew",
      "outOfRangeMonthsThrowInBoundedTime",
    )!;
    expect(reproPasses(repro, recorded)).toBe(false);
    expect(reproPasses(repro, repro.expected)).toBe(true);
  });
});

describe("runRepro", () => {
  it("turns a throwing repro into an ERR line instead of propagating", () => {
    const output = runRepro({
      run: () => {
        throw new RangeError("boom");
      },
    });
    expect(output).toBe("ERR RangeError: boom");
    expect(reproPasses({ expected: "+275760-09-13" }, output)).toBe(false);
  });
});

describe("isDefectPresent", () => {
  it("reports no defect for a calendar that has no repro", () => {
    expect(isDefectPresent("D22", "hebrew")).toBe(false);
  });
});

describe("repro split", () => {
  // DefectId (D16, D17, D19, D22) is the type the shipped probes can ask about; the canary-only
  // group is BoundedWorkDefectId (D9).
  const probeDefects = new Set(["D16", "D17", "D19", "D22"]);

  it("holds every probe-defect repro of the full table in probeRepros", () => {
    const expected = repros.filter((repro) => probeDefects.has(repro.defect));

    expect(expected.length).toBeGreaterThan(0);
    expect(probeRepros).toHaveLength(expected.length);
    const probes = new Set<unknown>(probeRepros);
    expect(expected.every((repro) => probes.has(repro))).toBe(true);
  });

  it("holds no D9 repro in probeRepros", () => {
    const canaryOnly = probeRepros.filter(
      (repro) => !probeDefects.has(repro.defect),
    );

    expect(canaryOnly).toEqual([]);
  });
});

// D16: UTS #35 (Matching Skeletons) expects the skeleton and pattern fields to be adjusted in
// parallel, so a range keeps the requested zone name width. The probe compares the engine's range zone part with its own single format, so it owns no
// CLDR string; ICU-20548 is the reason V8 and JSC fail it for every style but short.
describe("D16 range zone name probe", () => {
  const styles = [
    "short",
    "long",
    "shortGeneric",
    "longGeneric",
    "shortOffset",
    "longOffset",
  ] as const;

  it.each(styles.map((style) => ({ style })))(
    "has a range.$style repro that returns same or names both parts",
    ({ style }) => {
      const repro = findRepro("D16", "iso8601", `range.${style}`);
      expect(repro?.expected).toBe("same");
      expect(runRepro(repro!)).toMatch(/^same$|^range .* vs single /);
    },
  );

  it("returns same for range.short on every host", () => {
    expect(runRepro(findRepro("D16", "iso8601", "range.short")!)).toBe("same");
  });

  it("reports false for a style it has no repro for", () => {
    expect(isRangeZoneNameCompatNeeded("not-a-style")).toBe(false);
  });

  it("answers the same on a second call without running the repro again", () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatRangeToParts");
    try {
      const first = isRangeZoneNameCompatNeeded("longOffset");
      const runs = spy.mock.calls.length;
      expect(isRangeZoneNameCompatNeeded("longOffset")).toBe(first);
      expect(spy.mock.calls.length).toBe(runs);
    } finally {
      spy.mockRestore();
    }
  });
});

// D17: ECMA-402 §11.5.8 picks the range pattern by the resolved [[HourCycle]] only, so a range
// with and without an explicit h12 cannot differ in the day period it prints; the flexible day
// periods of a range ("in the morning", "noon") are expected to equal the two single formats'.
// Firefox 155 prints AM and PM in the range when the hour cycle is omitted.
describe("D17 range day period probe", () => {
  it("expects the range's day period parts to equal the single formats'", () => {
    expect(findRepro("D17", "iso8601", "range.dayPeriod")?.expected).toBe(
      "same",
    );
  });

  it("returns same or names both sides", () => {
    expect(runRepro(findRepro("D17", "iso8601", "range.dayPeriod")!)).toMatch(
      /^same$|^range .* vs single /,
    );
  });

  it("reads the recorded Firefox 155 output as the defect", () => {
    const repro = findRepro("D17", "iso8601", "range.dayPeriod")!;
    expect(
      reproPasses(
        repro,
        'range ["AM","PM"] vs single ["in the morning","noon"]',
      ),
    ).toBe(false);
  });

  it("answers the same on a second call", () => {
    expect(isRangeDayPeriodCompatNeeded()).toBe(isRangeDayPeriodCompatNeeded());
  });
});

// D19: ECMA-402 §6.5 fixes "UTC" as a primary time zone identifier and "Etc/UTC" as a non-primary
// one that resolves to it, and ECMA-262 TimeZoneEquals compares primary identifiers, so the two
// are one zone on every host. The polyfill reads a non-primary identifier's primary from
// `Intl.DateTimeFormat#resolvedOptions`, which JavaScriptCore (WebKit 26.6) returns as written.
describe("D19 time zone equals probe", () => {
  it("expects Etc/UTC to equal UTC", () => {
    expect(findRepro("D19", "iso8601", "etcUtcEqualsUtc")?.expected).toBe(
      "true",
    );
  });

  it("returns true or false", () => {
    expect(runRepro(findRepro("D19", "iso8601", "etcUtcEqualsUtc")!)).toMatch(
      /^(true|false)$/,
    );
  });

  it("reads the recorded WebKit 26.6 output as the defect", () => {
    const repro = findRepro("D19", "iso8601", "etcUtcEqualsUtc")!;
    expect(reproPasses(repro, "false")).toBe(false);
  });

  it("answers the same on a second call", () => {
    expect(isTimeZoneEqualsCompatNeeded()).toBe(isTimeZoneEqualsCompatNeeded());
  });
});

// D22: TC39 ComputeNudgeWindow takes the window's start from the origin's own exact time when no unit
// has been added (tc39/proposal-temporal #3148, #3149; tc39/ecma262#3759 commit 1f4e6717ef23 for the
// condition), and DifferenceZonedDateTime subtracts the exact times when both fall on one local date
// (#3141). New York repeats 01:00-02:00 on 2024-11-03, so from 01:30-05:00 the next day is 24 hours
// away and from 01:30-04:00 it is 25. Expected values: Chromium 153 native Temporal.
describe("D22 repeated-hour origin probe", () => {
  it.each`
    name                           | expected
    ${"totalDaysFromLaterPass"}    | ${String(1 / 24)}
    ${"roundToDayFromLaterPass"}   | ${"PT0S"}
    ${"untilSameDayFromLaterPass"} | ${"PT1H"}
    ${"totalDaysFromEarlierPass"}  | ${String(1 / 50)}
    ${"roundWeekWithoutStartDays"} | ${"P1W"}
  `("expects $name to answer '$expected'", ({ name, expected }) => {
    expect(findRepro("D22", "iso8601", name)?.expected).toBe(expected);
  });

  it.each`
    name                           | output
    ${"totalDaysFromLaterPass"}    | ${"0.08"}
    ${"roundToDayFromLaterPass"}   | ${"P1D"}
    ${"untilSameDayFromLaterPass"} | ${"PT2H"}
    ${"totalDaysFromEarlierPass"}  | ${"0.020833333333333332"}
  `(
    "reads the recorded polyfill 0.5.1 output of $name as the defect",
    ({ name, output }) => {
      expect(reproPasses(findRepro("D22", "iso8601", name)!, output)).toBe(
        false,
      );
    },
  );

  // js-temporal main (3c403686d39) tests r1 = 0 in its source, which turns P7D into P1W1D. This row keeps
  // the probe failing on a release like it, one without tc39/proposal-temporal#3319. The D22 repros have
  // not been run against main as a set.
  it("reads P1W1D in roundWeekWithoutStartDays as the defect", () => {
    expect(
      reproPasses(
        findRepro("D22", "iso8601", "roundWeekWithoutStartDays")!,
        "P1W1D",
      ),
    ).toBe(false);
  });

  // TC39 Asserts on both totals, so no value exists: tc39/proposal-temporal#3336 for the days, #3311
  // for the months. Polyfill 0.5.1 extrapolates, which is the first row.
  it.each`
    label                   | output
    ${"both extrapolate"}   | ${"1.0208333333333333,0.00034722222222222224"}
    ${"only days throws"}   | ${"none,0.00034722222222222224"}
    ${"only months throws"} | ${"1.0208333333333333,none"}
  `("reads totalsWithNoValue as the defect when $label", ({ output }) => {
    const repro = findRepro("D22", "iso8601", "totalsWithNoValue")!;
    expect(reproPasses(repro, output)).toBe(false);
  });

  it("reads totalsWithNoValue as fixed only when both totals throw", () => {
    const repro = findRepro("D22", "iso8601", "totalsWithNoValue")!;
    expect(reproPasses(repro, "none,none")).toBe(true);
  });

  // Two more Asserts, in DifferenceZonedDateTime and NudgeToZonedTime. Chromium 153 passes every other
  // D22 repro and answers both, so a release behaving like it must not retire the gate.
  it.each`
    name                 | runtime           | output
    ${"noDayCorrection"} | ${"Chromium 153"} | ${"PT45M,PT45M"}
    ${"noDayCorrection"} | ${"only round"}   | ${"PT45M,none"}
    ${"noDayCorrection"} | ${"only until"}   | ${"none,PT45M"}
    ${"emptyDaySpan"}    | ${"Chromium 153"} | ${"-P1DT12H"}
  `("reads $name as the defect from $runtime", ({ name, output }) => {
    expect(reproPasses(findRepro("D22", "iso8601", name)!, output)).toBe(false);
  });

  it.each`
    name                 | expected
    ${"noDayCorrection"} | ${"none,none"}
    ${"emptyDaySpan"}    | ${"none"}
  `("expects $name to report '$expected'", ({ name, expected }) => {
    expect(findRepro("D22", "iso8601", name)?.expected).toBe(expected);
  });

  describe("readOrNone", () => {
    const ORIGIN = "2024-06-15T12:00:00-04:00[America/New_York]";
    const fails = (error: Error) => () => {
      throw error;
    };

    it("returns what the read returns", () => {
      expect(readOrNone(ORIGIN, "PT1H", (length) => length.toString())).toBe(
        "PT1H",
      );
    });

    it.each`
      label           | error
      ${"RangeError"} | ${new RangeError("outside the window")}
      ${"Error"}      | ${new Error("assertion failure")}
    `("reads a thrown $label as no value", ({ error }) => {
      expect(readOrNone(ORIGIN, "PT1H", fails(error))).toBe("none");
    });

    it("does not read a TypeError as no value", () => {
      expect(() =>
        readOrNone(ORIGIN, "PT1H", fails(new TypeError("broken repro"))),
      ).toThrow(TypeError);
    });

    // An engine that lacks the zone, or disagrees with the origin's offset, has not reported anything.
    it.each`
      label                | origin                                           | duration
      ${"an unknown zone"} | ${"2024-06-15T12:00:00+00:00[Not/A_Zone]"}       | ${"PT1H"}
      ${"a wrong offset"}  | ${"2024-06-15T12:00:00+01:00[America/New_York]"} | ${"PT1H"}
      ${"a bad duration"}  | ${ORIGIN}                                        | ${"one hour"}
    `("does not read $label as no value", ({ origin, duration }) => {
      expect(() => readOrNone(origin, duration, () => "unreached")).toThrow(
        RangeError,
      );
    });
  });

  it("answers the same on a second call", () => {
    expect(isNudgeOriginCompatNeeded()).toBe(isNudgeOriginCompatNeeded());
  });
});
