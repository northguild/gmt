import { diffDateTime } from "./diffDateTime";

describe("diffDateTime", () => {
  it.each`
    dateTime1                    | dateTime2                          | unit              | expected
    ${"2024-02-29T00:00:00"}     | ${"2025-02-28T00:00:00"}           | ${"years"}        | ${0}
    ${"2024-12-31T23:59:59"}     | ${"2025-01-01T00:00:00"}           | ${"seconds"}      | ${1}
    ${"2024-01-01T00:00:00"}     | ${"2024-12-31T23:59:59"}           | ${"hours"}        | ${8783}
    ${"2024-01-31T00:00:00"}     | ${"2024-02-29T00:00:00"}           | ${"months"}       | ${0}
    ${"2023-01-01T23:59:59.999"} | ${"2023-01-02T00:00:00"}           | ${"milliseconds"} | ${1}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T01:00:00"}           | ${"hours"}        | ${1}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T12:00:00"}           | ${"hours"}        | ${12}
    ${"2024-02-29T12:30:45"}     | ${"2024-02-29T13:30:45"}           | ${"hours"}        | ${1}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T00:01:00"}           | ${"minutes"}      | ${1}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T00:30:00"}           | ${"minutes"}      | ${30}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T00:00:01"}           | ${"seconds"}      | ${1}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T00:00:59"}           | ${"seconds"}      | ${59}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T00:00:00.001"}       | ${"milliseconds"} | ${1}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T00:00:00.000001"}    | ${"microseconds"} | ${1}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29T00:00:00.000000001"} | ${"nanoseconds"}  | ${1}
  `(
    "returns int $expected for single unit $unit comparing $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, unit, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, unit)).toEqual(expected);
    },
  );

  it.each`
    dateTime1                | dateTime2                | expected
    ${"2024-02-29T12:00:00"} | ${"2024-02-29T11:59:59"} | ${{ seconds: -1 }}
    ${"2024-02-29T12:00:00"} | ${"2024-02-28T12:00:00"} | ${{ seconds: -86400 }}
  `(
    "returns negative difference for dateTime1 after dateTime2: $dateTime1, $dateTime2 as $expected ",
    ({ dateTime1, dateTime2, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, ["seconds"])).toEqual(expected);
    },
  );

  it.each`
    nonStringInput
    ${"2024-02-30T12:00:00"}
    ${"not-a-datetime"}
    ${"2024-13-01T12:00:00"}
    ${"2024-00-10T12:00:00"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29"}
    ${"12:00:00"}
    ${"2024-02-29T25:00:00"}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(
        diffDateTime(nonStringInput as never, "2024-01-01T00:00:00", ["days"]),
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
    ${"second"}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      diffDateTime("2024-01-01T00:00:00", "2024-01-02T00:00:00", [
        invalidUnit,
      ] as never),
    ).toBeNull();
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${2}
    ${"floor"}      | ${1}
    ${"trunc"}      | ${1}
    ${"halfExpand"} | ${2}
    ${"halfCeil"}   | ${2}
    ${"halfFloor"}  | ${1}
    ${"halfTrunc"}  | ${1}
    ${"halfEven"}   | ${2}
    ${"expand"}     | ${2}
  `(
    "rounds a 90-minute span to $expected hours with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffDateTime("2024-02-29T00:00:00", "2024-02-29T01:30:00", "hours", {
          smallestUnit: "hours",
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no options are provided", () => {
    expect(
      diffDateTime("2024-02-29T00:00:00", "2024-02-29T01:40:00", "hours"),
    ).toBe(1);
  });

  it("rounds sub-second precision with roundingIncrement", () => {
    expect(
      diffDateTime(
        "2024-02-29T00:00:00.000",
        "2024-02-29T00:00:00.750",
        "milliseconds",
        {
          smallestUnit: "milliseconds",
          roundingIncrement: 100,
          roundingMode: "halfExpand",
        },
      ),
    ).toBe(800);
  });

  it("returns null when roundingIncrement is invalid for the unit (does not divide evenly)", () => {
    expect(
      diffDateTime("2024-02-29T00:00:00", "2024-02-29T00:32:00", "minutes", {
        smallestUnit: "minutes",
        roundingIncrement: 7,
        roundingMode: "trunc",
      }),
    ).toBeNull();
  });

  it("rounds a negative diff (dateTime1 after dateTime2)", () => {
    expect(
      diffDateTime("2024-02-29T01:30:00", "2024-02-29T00:00:00", "hours", {
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe(-2);
  });

  it("rounds a zero-length diff to zero", () => {
    expect(
      diffDateTime("2024-02-29T00:00:00", "2024-02-29T00:00:00", "hours", {
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe(0);
  });

  it("rounds a result requested as an array of units", () => {
    expect(
      diffDateTime(
        "2023-01-01T00:00:00",
        "2023-01-01T01:45:00",
        ["hours", "minutes"],
        {
          smallestUnit: "minutes",
          roundingIncrement: 30,
          roundingMode: "halfExpand",
        },
      ),
    ).toEqual({ hours: 2, minutes: 0 });
  });

  it("returns the unrounded array-of-units result when no options are provided", () => {
    expect(
      diffDateTime("2023-01-01T00:00:00", "2023-01-01T01:45:00", [
        "hours",
        "minutes",
      ]),
    ).toEqual({ hours: 1, minutes: 45 });
  });

  it("returns null when smallestUnit is coarser than the largest requested unit", () => {
    expect(
      diffDateTime(
        "2023-01-01T00:00:00",
        "2023-01-01T01:45:00",
        ["minutes", "seconds"],
        { smallestUnit: "hours" },
      ),
    ).toBeNull();
  });
});
