import { normalizeDuration } from "./normalizeDuration";

describe("normalizeDuration", () => {
  it.each`
    value       | expected
    ${"PT90M"}  | ${"PT90M"}
    ${"PT36H"}  | ${"PT36H"}
    ${"PT0S"}   | ${"PT0S"}
    ${"P1D"}    | ${"P1D"}
    ${"-PT90M"} | ${"-PT90M"}
    ${"PT130S"} | ${"PT130S"}
  `(
    "defaults to largestUnit auto, reformatting $value to $expected",
    ({ value, expected }) => {
      expect(normalizeDuration(value)).toBe(expected);
    },
  );

  it.each`
    value       | largestUnit | expected
    ${"PT90M"}  | ${"hour"}   | ${"PT1H30M"}
    ${"PT90M"}  | ${"minute"} | ${"PT90M"}
    ${"P1DT2H"} | ${"day"}    | ${"P1DT2H"}
    ${"P1DT2H"} | ${"hour"}   | ${"PT26H"}
  `(
    "rebalances $value to $expected with largestUnit $largestUnit",
    ({ value, largestUnit, expected }) => {
      expect(normalizeDuration(value, { largestUnit })).toBe(expected);
    },
  );

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"PT2M"}
    ${"floor"}      | ${"PT1M"}
    ${"trunc"}      | ${"PT1M"}
    ${"halfExpand"} | ${"PT2M"}
    ${"halfCeil"}   | ${"PT2M"}
    ${"halfFloor"}  | ${"PT1M"}
    ${"halfTrunc"}  | ${"PT1M"}
    ${"halfEven"}   | ${"PT2M"}
    ${"expand"}     | ${"PT2M"}
  `(
    "rounds PT1M30S to $expected with smallestUnit minute and roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        normalizeDuration("PT1M30S", { smallestUnit: "minute", roundingMode }),
      ).toBe(expected);
    },
  );

  it.each`
    value      | smallestUnit | roundingIncrement | expected
    ${"PT45M"} | ${"minute"}  | ${30}             | ${"PT60M"}
    ${"PT45M"} | ${"minute"}  | ${7}              | ${""}
    ${"PT45M"} | ${"hour"}    | ${1}              | ${"PT1H"}
    ${"P10D"}  | ${"day"}     | ${7}              | ${"P7D"}
  `(
    "applies roundingIncrement $roundingIncrement to $value with smallestUnit $smallestUnit -> $expected",
    ({ value, smallestUnit, roundingIncrement, expected }) => {
      expect(
        normalizeDuration(value, { smallestUnit, roundingIncrement }),
      ).toBe(expected);
    },
  );

  it("rebalances using smallestUnit alone, with no explicit largestUnit", () => {
    expect(normalizeDuration("PT90M30S", { smallestUnit: "minute" })).toBe(
      "PT91M",
    );
  });

  it.each`
    value     | smallestUnit | expected
    ${"PT1H"} | ${"hour"}    | ${"PT1H"}
    ${"P1D"}  | ${"day"}     | ${"P1D"}
  `(
    "smallestUnit $smallestUnit has no effect on $value, still succeeds as $expected",
    ({ value, smallestUnit, expected }) => {
      expect(normalizeDuration(value, { smallestUnit })).toBe(expected);
    },
  );

  it("falls back to the largestUnit auto default when only roundingMode is given", () => {
    expect(normalizeDuration("PT90M", { roundingMode: "ceil" })).toBe("PT90M");
  });

  it.each`
    value      | largestUnit | relativeTo      | expected
    ${"P45D"}  | ${"month"}  | ${undefined}    | ${""}
    ${"P45D"}  | ${"month"}  | ${"2024-01-01"} | ${"P1M14D"}
    ${"P400D"} | ${"year"}   | ${"2023-01-01"} | ${"P1Y1M4D"}
    ${"-P45D"} | ${"month"}  | ${"2024-01-01"} | ${"-P1M14D"}
  `(
    "rebalancing $value to largestUnit $largestUnit with relativeTo $relativeTo -> $expected",
    ({ value, largestUnit, relativeTo, expected }) => {
      expect(normalizeDuration(value, { largestUnit, relativeTo })).toBe(
        expected,
      );
    },
  );

  // E5 (issue #78): relativeTo accepts a GMT calendar-annotated PlainDate string, not
  // Temporal's own ISO-digit u-ca convention. Regression golden verified directly against
  // @js-temporal/polyfill: before this fix, relativeTo below rebalanced to "P1Y3D" (misread
  // as ISO year 5784), not "P1Y15D".
  it("rebalances relative to a GMT calendar-annotated PlainDate string (Hebrew leap year)", () => {
    expect(
      normalizeDuration("P400D", {
        largestUnit: "year",
        relativeTo: "5784-06-15[u-ca=hebrew]",
      }),
    ).toBe("P1Y15D");
  });

  it.each`
    value    | options                                             | expected
    ${"P1M"} | ${{}}                                               | ${""}
    ${"P1M"} | ${{ largestUnit: "day" }}                           | ${""}
    ${"P1M"} | ${{ largestUnit: "day", relativeTo: "2024-01-01" }} | ${"P31D"}
  `(
    "input with a calendar unit requires relativeTo even under default auto: $value with $options -> $expected",
    ({ value, options, expected }) => {
      expect(normalizeDuration(value, options)).toBe(expected);
    },
  );

  it("returns an empty string for an invalid relativeTo", () => {
    expect(
      normalizeDuration("P45D", {
        largestUnit: "month",
        relativeTo: "not-a-date",
      }),
    ).toBe("");
  });

  it.each`
    invalidValue
    ${"not a duration"}
    ${""}
  `(
    "returns an empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(normalizeDuration(invalidValue)).toBe("");
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${5}
    ${true}
    ${false}
    ${["PT1H"]}
    ${{}}
    ${{ days: 1 }}
  `("returns an empty string for non-string input $value", ({ value }) => {
    expect(normalizeDuration(value as never)).toBe("");
  });
});

describe("normalizeDuration relative to the last days of the range", () => {
  // TC39 Duration#round: PT73H from max - 3d5h is 3 local days and 1 hour; the day after the
  // result starts past +275760-09-13T00:00 local in a zone ahead of UTC, but in range.
  it.each`
    relativeTo                                            | expected
    ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"}   | ${"P3DT1H"}
    ${"+275760-09-10T09:00:00+14:00[Pacific/Kiritimati]"} | ${"P3DT1H"}
  `(
    "rebalances PT73H to $expected relative to $relativeTo",
    ({ relativeTo, expected }) => {
      expect(
        normalizeDuration("PT73H", { largestUnit: "day", relativeTo }),
      ).toBe(expected);
    },
  );

  // TC39 NudgeToCalendarUnit: rounding to a whole day looks at a day window that ends past the
  // maximum, so Temporal throws — in UTC as in every other zone.
  it.each`
    value      | relativeTo
    ${"PT73H"} | ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"}
    ${"PT49H"} | ${"+275760-09-10T23:00:00+00:00[UTC]"}
    ${"PT49H"} | ${"+275760-09-10T23:00:00+00:00[+00:00]"}
    ${"PT49H"} | ${"+275760-09-11T00:00:00+01:00[Europe/London]"}
  `(
    "returns an empty string rounding $value to a day relative to $relativeTo",
    ({ value, relativeTo }) => {
      expect(
        normalizeDuration(value, {
          largestUnit: "day",
          smallestUnit: "day",
          relativeTo,
        }),
      ).toBe("");
    },
  );
});

describe("normalizeDuration relative to the first days of the range", () => {
  // TC39 Duration#round: -PT73H back from min + 3d2h is 3 local days and 1 hour; the day before the
  // result reaches the minimum's local date -271821-04-19 in a zone behind UTC, but in range.
  it.each`
    relativeTo
    ${"-271821-04-22T21:03:58-04:56[America/New_York]"}
    ${"-271821-04-22T15:28:34-10:31[Pacific/Honolulu]"}
  `(
    "rebalances -PT73H to -P3DT1H relative to $relativeTo",
    ({ relativeTo }) => {
      expect(
        normalizeDuration("-PT73H", { largestUnit: "day", relativeTo }),
      ).toBe("-P3DT1H");
    },
  );
});

// CORE-6 S7: a non-ISO calendar `relativeTo` follows TC39 Duration#round with a plain relativeTo
// (DifferencePlainDateTimeWithRounding, GetUTCEpochNanoseconds). Values: Chromium 153 native
// `Duration.from(d).round({ largestUnit, relativeTo: PlainDate })`.
describe("normalizeDuration with a non-ISO calendar relativeTo (CORE-6)", () => {
  it.each`
    duration  | relativeTo                         | expected    | reason
    ${"P40D"} | ${"279517-08-15[u-ca=hebrew]"}    | ${"P1M10D"} | ${"D1: 1 month then 10 days, just before the maximum"}
    ${"P30D"} | ${"2566-08-31[u-ca=buddhist]"}    | ${"P30D"}   | ${"D6: Aug 31 + 1 month is Sep 31, past Sep 30"}
    ${"P40D"} | ${"1543-01-15[u-ca=buddhist]"}    | ${"P1M9D"}  | ${"proleptic buddhist: ISO 1000-01-15 + 1 month is Feb 15"}
    ${"P40D"} | ${"-096239-06-23[u-ca=hebrew]"}   | ${"P1M11D"} | ${"hebrew year <= 0: M06 has 29 days"}
  `(
    "normalizes $duration to $expected in months relative to $relativeTo ($reason)",
    ({ duration, relativeTo, expected }) => {
      expect(
        normalizeDuration(duration, { largestUnit: "months", relativeTo }),
      ).toBe(expected);
    },
  );
});
