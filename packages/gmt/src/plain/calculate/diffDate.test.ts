import { diffDate } from "./diffDate";

describe("diffDate", () => {
  it.each`
    date1           | date2           | unit          | expected
    ${"2023-01-01"} | ${"2024-01-01"} | ${"years"}    | ${1}
    ${"2023-01-01"} | ${"2023-02-01"} | ${"months"}   | ${1}
    ${"2023-01-01"} | ${"2023-01-08"} | ${"weeks"}    | ${1}
    ${"2023-01-01"} | ${"2023-01-02"} | ${"days"}     | ${1}
    ${"2024-02-29"} | ${"2025-02-28"} | ${["years"]}  | ${{ years: 0 }}
    ${"2024-12-31"} | ${"2025-01-01"} | ${["days"]}   | ${{ days: 1 }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${["weeks"]}  | ${{ weeks: 52 }}
    ${"2024-01-31"} | ${"2024-02-29"} | ${["months"]} | ${{ months: 0 }}
  `(
    "returns $expected for $unit comparing $date1, $date2",
    ({ date1, date2, unit, expected }) => {
      expect(diffDate(date1, date2, unit)).toEqual(expected);
    },
  );

  it.each`
    date1           | date2           | expected
    ${"2024-01-01"} | ${"2023-01-01"} | ${{ days: -365 }}
    ${"2024-01-31"} | ${"2024-01-01"} | ${{ days: -30 }}
    ${"2024-02-29"} | ${"2024-01-31"} | ${{ days: -29 }}
  `(
    "returns negative difference for date1 before date2: $date1, $date2",
    ({ date1, date2, expected }) => {
      expect(diffDate(date1, date2, ["days"])).toEqual(expected);
    },
  );

  it.each`
    nonStringInput
    ${"2024-02-30"}
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-00-10"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29T12:00:00Z"}
    ${"2024-02-29T12:00:00Z"}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(
        diffDate(nonStringInput as never, "2024-01-01", ["days"]),
      ).toBeNull();
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hour"}
    ${"hours"}
    ${"dayss"}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      diffDate("2024-01-01", "2024-01-02", [invalidUnit] as never),
    ).toBeNull();
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${4}
    ${"floor"}      | ${2}
    ${"trunc"}      | ${2}
    ${"halfExpand"} | ${4}
    ${"halfCeil"}   | ${4}
    ${"halfFloor"}  | ${2}
    ${"halfTrunc"}  | ${2}
    ${"halfEven"}   | ${4}
    ${"expand"}     | ${4}
  `(
    "rounds a 3-day span to $expected days with smallestUnit day, roundingIncrement 2, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffDate("2023-01-01", "2023-01-04", "days", {
          smallestUnit: "days",
          roundingIncrement: 2,
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no options are provided", () => {
    expect(diffDate("2023-01-01", "2023-01-10", "days")).toBe(9);
  });

  it("rounds using a roundingIncrement that does not evenly divide the span", () => {
    expect(
      diffDate("2023-01-01", "2023-01-10", "days", {
        smallestUnit: "days",
        roundingIncrement: 5,
        roundingMode: "halfExpand",
      }),
    ).toBe(10);
  });

  it("returns null when roundingIncrement is invalid (negative)", () => {
    expect(
      diffDate("2023-01-01", "2023-01-10", "days", {
        smallestUnit: "days",
        roundingIncrement: -1,
        roundingMode: "trunc",
      }),
    ).toBeNull();
  });

  it("rounds a negative diff (date1 after date2)", () => {
    expect(
      diffDate("2023-01-10", "2023-01-01", "weeks", {
        smallestUnit: "weeks",
        roundingMode: "halfExpand",
      }),
    ).toBe(-1);
  });

  it("rounds a zero-length diff to zero", () => {
    expect(
      diffDate("2023-01-01", "2023-01-01", "weeks", {
        smallestUnit: "weeks",
        roundingMode: "halfExpand",
      }),
    ).toBe(0);
  });

  it("rounds a result requested as an array of units", () => {
    expect(
      diffDate("2023-01-01", "2024-08-20", ["years", "months"], {
        smallestUnit: "months",
        roundingMode: "halfExpand",
      }),
    ).toEqual({ years: 1, months: 8 });
  });

  it("returns the unrounded array-of-units result when no options are provided", () => {
    expect(diffDate("2023-01-01", "2024-08-20", ["years", "months"])).toEqual({
      years: 1,
      months: 7,
    });
  });

  it("returns null when smallestUnit is coarser than the largest requested unit", () => {
    expect(
      diffDate("2023-01-01", "2024-01-10", ["months", "days"], {
        smallestUnit: "years",
      }),
    ).toBeNull();
  });

  // E5 (issue #78): diffDate accepts RFC 9557 calendar-annotated PlainDate strings. When both
  // endpoints name the same calendar, the difference is measured in that calendar; when they name
  // different calendars (a bare ISO string names iso8601) the result is null (following
  // TC39 DifferenceTemporalPlainDate's CalendarEquals check).
  // Strings converted to RFC 9557 by native Temporal (Chromium 153).
  it("measures in the shared calendar when both endpoints carry the same tag (Hebrew Adar I -> Adar)", () => {
    expect(
      diffDate("2024-02-24[u-ca=hebrew]", "2024-03-25[u-ca=hebrew]", "months"),
    ).toBe(1);
  });

  // CORE-6 D6/D7: see diffDateAsDuration.test.ts. Chromium 152 native Temporal
  // (q2-grid-chromium152.json): buddhist 2023-08-31 +30 d is P30D, hebrew 2024-02-11 +384 d is
  // P12M29D with largestUnit years.
  it.each`
    date1                          | date2                          | unit                   | expected                    | reason
    ${"2023-08-31[u-ca=buddhist]"} | ${"2023-09-30[u-ca=buddhist]"} | ${"months"}            | ${0}                        | ${"D6: 30 days, not a month"}
    ${"2023-08-31[u-ca=buddhist]"} | ${"2023-09-30[u-ca=buddhist]"} | ${["months", "days"]}  | ${{ months: 0, days: 30 }}  | ${"D6 record"}
    ${"2024-02-11[u-ca=hebrew]"}   | ${"2025-03-01[u-ca=hebrew]"}   | ${"years"}             | ${0}                        | ${"D7: not null"}
    ${"2024-02-11[u-ca=hebrew]"}   | ${"2025-03-01[u-ca=hebrew]"}   | ${["years", "months"]} | ${{ years: 0, months: 12 }} | ${"D7 record"}
  `(
    "returns $expected for $unit from $date1 to $date2 ($reason)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDate(date1, date2, unit)).toEqual(expected);
    },
  );

  // Native Temporal (Chromium 153) until throws "Mismatched calendars." for each pair, in days
  // and in months; the same-calendar control spelled two ways is 30 days.
  it.each`
    date1                          | date2                         | reason
    ${"2024-10-03[u-ca=hebrew]"}   | ${"2024-11-03"}               | ${"hebrew and bare ISO"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=hebrew]"}  | ${"bare ISO and hebrew"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=gregory]"} | ${"iso8601 and gregory"}
    ${"2024-10-03[u-ca=ethiopic]"} | ${"2024-11-02[u-ca=ethioaa]"} | ${"ethiopic and ethioaa"}
  `(
    "returns null for $date1 to $date2 ($reason: different calendars)",
    ({ date1, date2 }) => {
      expect(diffDate(date1, date2, "days")).toBeNull();
      expect(diffDate(date1, date2, "months")).toBeNull();
    },
  );

  it("measures a pair whose ids spell the same calendar differently (ethiopic-amete-alem, ethioaa)", () => {
    expect(
      diffDate(
        "2024-10-03[u-ca=ethiopic-amete-alem]",
        "2024-11-02[u-ca=ethioaa]",
        "days",
      ),
    ).toBe(30);
  });

  // A date-time is read as its date, as Temporal.PlainDate.from reads it (decided
  // 2026-09-17; before 1.16.0 the sentinel). Expected values from native Chromium 153.
  it.each`
    date1                              | date2                        | unit        | expected
    ${"2024-03-10T14:30:00"}           | ${"2024-03-15"}              | ${"days"}   | ${5}
    ${"2024-02-24T23:00[u-ca=hebrew]"} | ${"2024-03-25[u-ca=hebrew]"} | ${"months"} | ${1}
  `(
    "returns $expected $unit from the date-time $date1 to $date2",
    ({ date1, date2, unit, expected }) => {
      expect(diffDate(date1, date2, unit)).toBe(expected);
    },
  );
});

// Temporal §13.17 GetTemporalUnitValuedOption: a singular unit name is the same unit as its plural;
// record keys stay plural. Values from native Temporal (Chromium 153): 2024-01-01 until 2024-01-08
// is P1W / P7D; until 2025-03-01 is P14M / P1Y2M.
describe("diffDate with singular unit names", () => {
  it.each`
    end             | unit                  | expected
    ${"2024-01-08"} | ${"week"}             | ${1}
    ${"2024-01-08"} | ${"day"}              | ${7}
    ${"2025-03-01"} | ${"month"}            | ${14}
    ${"2025-03-01"} | ${"year"}             | ${1}
    ${"2024-01-08"} | ${["week", "day"]}    | ${{ weeks: 1, days: 0 }}
    ${"2025-03-01"} | ${["year", "months"]} | ${{ years: 1, months: 2 }}
  `(
    "returns $expected for singular unit $unit from 2024-01-01 to $end",
    ({ end, unit, expected }) => {
      expect(diffDate("2024-01-01", end, unit)).toEqual(expected);
    },
  );
});

// Plan #16: a units array returns the whole difference. The amount of each unlisted unit between
// two listed units is carried into the next smaller listed unit, measured from the start moved by
// the larger listed amounts, so `start + record` is the end (Temporal AddDate adds years and months
// first, then days). Values from native Temporal (Chromium 153):
// - 2024-01-01 until 2025-03-01 is P1Y2M; 2025-01-01 until 2025-03-01 is 59 days (P8W3D).
// - 2024-02-29 until 2025-03-30 is P1Y1M1D; 2024-02-29 + P1Y is 2025-02-28, + 30 days is 2025-03-30
//   (carrying P1M1D from the unclamped date would give 29 days and miss the end by one).
// - 2025-03-01 until 2024-01-01 is -P1Y2M; 2025-03-01 - P1Y is 2024-03-01, 60 days before 2024-01-01.
// - 5784 Tishrei 1 until 5785 Tevet 1 (Hebrew) is P1Y3M; 5785 Tishrei 1 to Tevet 1 is 90 days
//   (2024-10-03 to 2025-01-01 in ISO).
// - 2024-01-01 until 2024-03-20 with largestUnit month is P2M19D (no weeks to carry: unchanged).
// - 2024-02-29 until 2025-03-28 is P1Y28D: nothing to carry, so Temporal's fields are kept (measuring
//   months again from the clamped 2025-02-28 would give P1M).
// - Temporal fills weeks only when largestUnit is weeks, so a listed weeks after months or years is
//   measured from the start moved by those amounts: 2024-03-01 until 2024-03-20 is P2W5D;
//   2025-02-28 until 2025-03-30 is P4W2D; 2024-01-10 until 2025-01-31 is P1Y21D (P3W from 2025-01-10).
describe("diffDate units array carries unlisted units", () => {
  it.each`
    date1                        | date2                        | units                          | expected
    ${"2024-01-01"}              | ${"2025-03-01"}              | ${["years", "days"]}           | ${{ years: 1, days: 59 }}
    ${"2024-01-01"}              | ${"2025-03-01"}              | ${["day", "year"]}             | ${{ days: 59, years: 1 }}
    ${"2024-01-01"}              | ${"2025-03-01"}              | ${["years", "weeks"]}          | ${{ years: 1, weeks: 8 }}
    ${"2024-02-29"}              | ${"2025-03-30"}              | ${["years", "days"]}           | ${{ years: 1, days: 30 }}
    ${"2025-03-01"}              | ${"2024-01-01"}              | ${["years", "days"]}           | ${{ years: -1, days: -60 }}
    ${"2023-09-16[u-ca=hebrew]"} | ${"2025-01-01[u-ca=hebrew]"} | ${["years", "days"]}           | ${{ years: 1, days: 90 }}
    ${"2024-01-01"}              | ${"2024-03-20"}              | ${["months", "days"]}          | ${{ months: 2, days: 19 }}
    ${"2024-02-29"}              | ${"2025-03-28"}              | ${["years", "months"]}         | ${{ years: 1, months: 0 }}
    ${"2024-02-29"}              | ${"2025-03-28"}              | ${["years", "days"]}           | ${{ years: 1, days: 28 }}
    ${"2024-01-01"}              | ${"2024-03-20"}              | ${["months", "weeks"]}         | ${{ months: 2, weeks: 2 }}
    ${"2024-01-01"}              | ${"2024-03-20"}              | ${["months", "weeks", "days"]} | ${{ months: 2, weeks: 2, days: 5 }}
    ${"2024-01-31"}              | ${"2025-03-30"}              | ${["months", "weeks"]}         | ${{ months: 13, weeks: 4 }}
    ${"2024-01-10"}              | ${"2025-01-31"}              | ${["years", "weeks"]}          | ${{ years: 1, weeks: 3 }}
    ${"2024-03-20"}              | ${"2024-01-01"}              | ${["months", "weeks", "days"]} | ${{ months: -2, weeks: -2, days: -5 }}
  `(
    "returns $expected for $units from $date1 to $date2",
    ({ date1, date2, units, expected }) => {
      expect(diffDate(date1, date2, units)).toEqual(expected);
    },
  );

  // Rounding applies to the whole difference first: P1Y2M from 2024-01-01 rounds (to months) to
  // P1Y2M, whose end 2025-03-01 is then expressed in years and days.
  it("rounds the difference before carrying (2024-01-01 to 2025-03-10, months halfExpand)", () => {
    expect(
      diffDate("2024-01-01", "2025-03-10", ["years", "days"], {
        smallestUnit: "month",
        roundingMode: "halfExpand",
      }),
    ).toEqual({ years: 1, days: 59 });
  });
});

// Strict-shape rule (see coding-standards): the part before the first `[` must be GMT's strict extended date (or
// date-time), as `isValidDate`/`isValidDateTime` require. Native Chromium 153
// `Temporal.PlainDate.from` reads each of these as 2024-10-03; GMT rejects them.
describe("diffDate rejects calendar strings outside GMT's strict shape", () => {
  it.each`
    value                                    | reason
    ${"20241003[u-ca=hebrew]"}               | ${"basic format"}
    ${"2024-10-03t14:30[u-ca=hebrew]"}       | ${"lower-case t separator"}
    ${"2024-10-03T14:30+01:00[u-ca=hebrew]"} | ${"UTC offset"}
  `("returns null for $value ($reason)", ({ value }) => {
    expect(diffDate(value, "2024-10-10[u-ca=hebrew]", "days")).toBeNull();
  });
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (P31D).
describe("diffDate with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${null}
    ${"x"}       | ${null}
    ${5}         | ${null}
    ${true}      | ${null}
    ${undefined} | ${31}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(diffDate("2024-01-01", "2024-02-01", "days", options)).toBe(
      expected,
    );
  });
});
