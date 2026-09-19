import { splitIntervalByUnitTime } from "./splitIntervalByUnitTime";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";

describe("splitIntervalByUnitTime", () => {
  const expectedExactDivision = [
    { start: "12:00:00", end: "13:00:00" },
    { start: "13:00:00", end: "14:00:00" },
  ];

  const expectedRemainder = [
    { start: "12:00:00", end: "13:00:00" },
    { start: "13:00:00", end: "14:00:00" },
    { start: "14:00:00", end: "14:30:00" },
  ];

  const expectedMinuteUnit = [
    { start: "12:00:00", end: "12:01:00" },
    { start: "12:01:00", end: "12:02:00" },
    { start: "12:02:00", end: "12:03:00" },
    { start: "12:03:00", end: "12:04:00" },
    { start: "12:04:00", end: "12:05:00" },
  ];

  const expectedSecondUnit = [
    { start: "12:00:00", end: "12:00:01" },
    { start: "12:00:01", end: "12:00:02" },
    { start: "12:00:02", end: "12:00:03" },
  ];

  const expectedMillisecondUnit = [
    { start: "12:00:00", end: "12:00:00.001" },
    { start: "12:00:00.001", end: "12:00:00.002" },
    { start: "12:00:00.002", end: "12:00:00.003" },
  ];

  const expectedZeroLength = [{ start: "12:00:00", end: "12:00:00" }];

  const expectedSingleStep = [{ start: "12:00:00", end: "12:02:00" }];

  it.each`
    start             | end               | unit             | amount | expected
    ${"12:00:00"}     | ${"14:00:00"}     | ${"hour"}        | ${1}   | ${expectedExactDivision}
    ${"12:00:00"}     | ${"14:30:00"}     | ${"hour"}        | ${1}   | ${expectedRemainder}
    ${"12:00:00"}     | ${"12:05:00"}     | ${"minute"}      | ${1}   | ${expectedMinuteUnit}
    ${"12:00:00"}     | ${"12:00:03"}     | ${"second"}      | ${1}   | ${expectedSecondUnit}
    ${"12:00:00.000"} | ${"12:00:00.003"} | ${"millisecond"} | ${1}   | ${expectedMillisecondUnit}
  `(
    "returns $expected for $start to $end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitTime(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start         | end           | unit        | amount | expected
    ${"12:00:00"} | ${"12:00:00"} | ${"hour"}   | ${1}   | ${expectedZeroLength}
    ${"12:00:00"} | ${"12:02:00"} | ${"minute"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start to $end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitTime(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start         | end           | unit         | amount
    ${"invalid"}  | ${"14:00:00"} | ${"hour"}    | ${1}
    ${""}         | ${"14:00:00"} | ${"hour"}    | ${1}
    ${"25:00:00"} | ${"14:00:00"} | ${"hour"}    | ${1}
    ${"12:00:00"} | ${"invalid"}  | ${"hour"}    | ${1}
    ${"12:00:00"} | ${""}         | ${"hour"}    | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${"invalid"} | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${""}        | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}    | ${0}
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}    | ${-1}
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}    | ${1.5}
    ${"12:00:00"} | ${"14:00:00"} | ${"days"}    | ${1}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitTime(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start           | end             | unit            | amount
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${false}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitTime(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );

  it("returns [] when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(splitIntervalByUnitTime("12:00:00", "14:00:00", "hour", 1)).toEqual(
      [],
    );
  });
});

describe("splitIntervalByUnitTime maxPieces", () => {
  // Owner decision A2: maxPieces bounds the number of slices. At or above the slice count the
  // output is unchanged; one below it returns the sentinel.
  it.each`
    maxPieces
    ${3}
    ${8}
  `(
    "returns 3 slices for 12:00:00 to 14:30:00 by 1 hour with maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitTime("12:00:00", "14:30:00", "hour", 1, {
          maxPieces,
        }),
      ).toEqual([
        { start: "12:00:00", end: "13:00:00" },
        { start: "13:00:00", end: "14:00:00" },
        { start: "14:00:00", end: "14:30:00" },
      ]);
    },
  );

  it.each`
    maxPieces
    ${2}
    ${1}
  `(
    "returns [] for 12:00:00 to 14:30:00 by 1 hour (3 slices) over maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitTime("12:00:00", "14:30:00", "hour", 1, {
          maxPieces,
        }).length,
      ).toBe(0);
    },
  );

  it("returns one slice for a zero-length interval with maxPieces 1", () => {
    expect(
      splitIntervalByUnitTime("12:00:00", "12:00:00", "hour", 1, {
        maxPieces: 1,
      }),
    ).toEqual([{ start: "12:00:00", end: "12:00:00" }]);
  });

  it.each`
    label                   | options
    ${"maxPieces 0"}        | ${{ maxPieces: 0 }}
    ${"maxPieces -1"}       | ${{ maxPieces: -1 }}
    ${"maxPieces 1.5"}      | ${{ maxPieces: 1.5 }}
    ${"maxPieces NaN"}      | ${{ maxPieces: Number.NaN }}
    ${"maxPieces Infinity"} | ${{ maxPieces: Number.POSITIVE_INFINITY }}
    ${"maxPieces string"}   | ${{ maxPieces: "5" }}
    ${"null options"}       | ${null}
    ${"number options"}     | ${5}
  `("returns [] for invalid $label", ({ options }) => {
    expect(
      splitIntervalByUnitTime(
        "12:00:00",
        "14:30:00",
        "hour",
        1,
        options as never,
      ).length,
    ).toBe(0);
  });
});

describe("splitIntervalByUnitTime default piece limit", () => {
  // Default maxPieces is 1_000_000: a larger split returns the sentinel instead of exhausting the
  // heap.
  it.each`
    start         | end               | unit             | slices
    ${"00:00"}    | ${"23:59"}        | ${"nanosecond"}  | ${"86_340_000_000_000 nanoseconds"}
    ${"00:00:00"} | ${"00:16:40.001"} | ${"millisecond"} | ${"1_000_001 milliseconds"}
  `(
    "returns [] for $start to $end by 1 $unit ($slices)",
    ({ start, end, unit }) => {
      expect(splitIntervalByUnitTime(start, end, unit, 1).length).toBe(0);
    },
  );
});

describe("splitIntervalByUnitTime steps that pass midnight", () => {
  // Temporal PlainTime.prototype.add wraps at midnight (AddTime balances the time and discards
  // whole days), but a split's boundaries lie on the one day between start and end: a step that
  // reaches or passes midnight is past `end`, so that slice is trimmed to `end`. maxPieces 10
  // bounds a wrapping loop.
  it.each`
    start         | end           | amount | expected                                                                            | reason
    ${"12:00:00"} | ${"23:00:00"} | ${12}  | ${[{ start: "12:00:00", end: "23:00:00" }]}                                         | ${"12:00 + 12h is midnight, past 23:00"}
    ${"12:00:00"} | ${"23:00:00"} | ${24}  | ${[{ start: "12:00:00", end: "23:00:00" }]}                                         | ${"12:00 + 24h is the next noon"}
    ${"20:00:00"} | ${"23:00:00"} | ${5}   | ${[{ start: "20:00:00", end: "23:00:00" }]}                                         | ${"20:00 + 5h is 01:00 the next day"}
    ${"22:00:00"} | ${"23:30:00"} | ${1}   | ${[{ start: "22:00:00", end: "23:00:00" }, { start: "23:00:00", end: "23:30:00" }]} | ${"23:00 + 1h is midnight, past 23:30"}
  `(
    "returns $expected for $start to $end by $amount hours ($reason)",
    ({ start, end, amount, expected }) => {
      expect(
        splitIntervalByUnitTime(start, end, "hours", amount, { maxPieces: 10 }),
      ).toEqual(expected);
    },
  );
});

// An unknown unit or a calendar unit (PlainTime has none) is invalid input whatever the span: a non-empty interval already returns
// [] for it, so a zero-length interval must too, rather than the one zero-length slice a valid
// unit gives.
describe("splitIntervalByUnitTime rejects an invalid unit on a zero-length interval", () => {
  it.each`
    unit
    ${"invalid"}
    ${"fortnight"}
    ${"days"}
    ${"day"}
  `("returns [] for unit $unit", ({ unit }) => {
    expect(splitIntervalByUnitTime("01:00:00", "01:00:00", unit, 1)).toEqual(
      [],
    );
  });
});
