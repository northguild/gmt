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
    ${"2024-02-29T12:00:00"}
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
    ${"day"}
    ${"month"}
    ${"year"}
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
});
