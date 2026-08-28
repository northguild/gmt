import { diffDateAsDuration } from "./diffDateAsDuration";

describe("diffDateAsDuration", () => {
  it.each`
    date1           | date2           | unit        | expected
    ${"2023-01-01"} | ${"2024-01-01"} | ${"years"}  | ${"P1Y"}
    ${"2023-01-01"} | ${"2023-02-01"} | ${"months"} | ${"P1M"}
    ${"2023-01-01"} | ${"2023-01-08"} | ${"weeks"}  | ${"P1W"}
    ${"2023-01-01"} | ${"2023-01-02"} | ${"days"}   | ${"P1D"}
    ${"2024-03-10"} | ${"2024-04-05"} | ${"days"}   | ${"P26D"}
    ${"2024-03-10"} | ${"2024-04-05"} | ${"weeks"}  | ${"P3W5D"}
  `(
    "returns $expected for $unit comparing $date1, $date2",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );

  it.each`
    date1           | date2           | expected
    ${"2024-01-01"} | ${"2023-01-01"} | ${"-P365D"}
    ${"2024-01-31"} | ${"2024-01-01"} | ${"-P30D"}
    ${"2024-02-29"} | ${"2024-01-31"} | ${"-P29D"}
  `(
    "returns negative duration for date1 after date2: $date1, $date2",
    ({ date1, date2, expected }) => {
      expect(diffDateAsDuration(date1, date2, "days")).toBe(expected);
    },
  );

  it("returns PT0S for a zero-length diff", () => {
    expect(diffDateAsDuration("2024-01-01", "2024-01-01", "days")).toBe("PT0S");
  });

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
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T12:00:00Z"}
  `('returns "" for non-string input $nonStringInput', ({ nonStringInput }) => {
    expect(
      diffDateAsDuration(nonStringInput as never, "2024-01-01", "days"),
    ).toBe("");
  });

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hour"}
    ${"day"}
    ${"month"}
    ${"year"}
    ${["days"]}
  `('returns "" for invalid unit $invalidUnit', ({ invalidUnit }) => {
    expect(
      diffDateAsDuration("2024-01-01", "2024-01-02", invalidUnit as never),
    ).toBe("");
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"P4D"}
    ${"floor"}      | ${"P2D"}
    ${"trunc"}      | ${"P2D"}
    ${"halfExpand"} | ${"P4D"}
    ${"halfCeil"}   | ${"P4D"}
    ${"halfFloor"}  | ${"P2D"}
    ${"halfTrunc"}  | ${"P2D"}
    ${"halfEven"}   | ${"P4D"}
    ${"expand"}     | ${"P4D"}
  `(
    "rounds a 3-day span to $expected with smallestUnit day, roundingIncrement 2, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffDateAsDuration("2023-01-01", "2023-01-04", "days", {
          smallestUnit: "days",
          roundingIncrement: 2,
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no options are provided", () => {
    expect(diffDateAsDuration("2023-01-01", "2023-01-10", "days")).toBe("P9D");
  });

  it('returns "" when roundingIncrement is invalid (negative)', () => {
    expect(
      diffDateAsDuration("2023-01-01", "2023-01-10", "days", {
        smallestUnit: "days",
        roundingIncrement: -1,
        roundingMode: "trunc",
      }),
    ).toBe("");
  });

  it('returns "" when smallestUnit is coarser than largestUnit', () => {
    expect(
      diffDateAsDuration("2023-01-01", "2024-01-10", "days", {
        smallestUnit: "years",
      }),
    ).toBe("");
  });

  it.each`
    toStringSmallestUnit | fractionalSecondDigits | toStringRoundingMode | expected
    ${undefined}         | ${undefined}           | ${undefined}         | ${"P1D"}
    ${"second"}          | ${undefined}           | ${undefined}         | ${"P1DT0S"}
    ${undefined}         | ${3}                   | ${undefined}         | ${"P1DT0.000S"}
  `(
    "applies toString precision options: toStringSmallestUnit=$toStringSmallestUnit fractionalSecondDigits=$fractionalSecondDigits -> $expected",
    ({
      toStringSmallestUnit,
      fractionalSecondDigits,
      toStringRoundingMode,
      expected,
    }) => {
      expect(
        diffDateAsDuration("2023-01-01", "2023-01-02", "days", {
          toStringSmallestUnit,
          fractionalSecondDigits,
          toStringRoundingMode,
        }),
      ).toBe(expected);
    },
  );

  // E5 (issue #78): same shared-calendar rule as diffDate — see its test file. Golden
  // verified directly against @js-temporal/polyfill.
  it("measures in the shared calendar when both endpoints carry the same tag (Hebrew Adar I -> Adar)", () => {
    expect(
      diffDateAsDuration(
        "5784-06-15[u-ca=hebrew]",
        "5784-07-15[u-ca=hebrew]",
        "months",
      ),
    ).toBe("P1M");
  });

  it('returns "" for a datetime/zoned string instead of silently truncating to its date portion (parseCalendarDateValue regression, E5)', () => {
    expect(
      diffDateAsDuration("2024-03-10T14:30:00", "2024-03-15", "days"),
    ).toBe("");
  });
});
