import { splitIntervalByUnitDate } from "./splitIntervalByUnitDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("splitIntervalByUnitDate", () => {
  const expectedExactDivision = [
    { start: "2024-01-01", end: "2024-01-03" },
    { start: "2024-01-03", end: "2024-01-05" },
    { start: "2024-01-05", end: "2024-01-07" },
    { start: "2024-01-07", end: "2024-01-09" },
  ];

  const expectedRemainder = [
    { start: "2024-01-01", end: "2024-01-03" },
    { start: "2024-01-03", end: "2024-01-05" },
    { start: "2024-01-05", end: "2024-01-07" },
    { start: "2024-01-07", end: "2024-01-09" },
    { start: "2024-01-09", end: "2024-01-10" },
  ];

  const expectedWeekUnit = [
    { start: "2024-01-01", end: "2024-01-08" },
    { start: "2024-01-08", end: "2024-01-15" },
  ];

  const expectedMonthUnit = [
    { start: "2024-01-01", end: "2024-02-01" },
    { start: "2024-02-01", end: "2024-03-01" },
  ];

  const expectedZeroLength = [{ start: "2024-01-01", end: "2024-01-01" }];

  const expectedSingleStep = [{ start: "2024-01-01", end: "2024-01-05" }];

  const expectedAmount1 = [
    { start: "2024-01-01", end: "2024-01-02" },
    { start: "2024-01-02", end: "2024-01-03" },
  ];

  const expectedYearUnit = [
    { start: "2024-01-01", end: "2025-01-01" },
    { start: "2025-01-01", end: "2026-01-01" },
  ];

  it.each`
    start           | end             | unit       | amount | expected
    ${"2024-01-01"} | ${"2024-01-09"} | ${"day"}   | ${2}   | ${expectedExactDivision}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}   | ${2}   | ${expectedRemainder}
    ${"2024-01-01"} | ${"2024-01-15"} | ${"week"}  | ${1}   | ${expectedWeekUnit}
    ${"2024-01-01"} | ${"2024-03-01"} | ${"month"} | ${1}   | ${expectedMonthUnit}
  `(
    "returns $expected for $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitDate(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start           | end             | unit      | amount | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"day"}  | ${2}   | ${expectedZeroLength}
    ${"2024-01-01"} | ${"2024-01-05"} | ${"day"}  | ${4}   | ${expectedSingleStep}
    ${"2024-01-01"} | ${"2024-01-03"} | ${"day"}  | ${1}   | ${expectedAmount1}
    ${"2024-01-01"} | ${"2026-01-01"} | ${"year"} | ${1}   | ${expectedYearUnit}
  `(
    "returns $expected for edge-case $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitDate(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start           | end             | unit         | amount
    ${"invalid"}    | ${"2024-01-10"} | ${"day"}     | ${2}
    ${""}           | ${"2024-01-10"} | ${"day"}     | ${2}
    ${"2024-13-01"} | ${"2024-01-10"} | ${"day"}     | ${2}
    ${"2024-01-01"} | ${"invalid"}    | ${"day"}     | ${2}
    ${"2024-01-01"} | ${""}           | ${"day"}     | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"invalid"} | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${""}        | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}     | ${0}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}     | ${-1}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}     | ${1.5}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"hours"}   | ${1}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitDate(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start           | end             | unit         | amount
    ${null}         | ${"2024-01-10"} | ${"day"}     | ${2}
    ${undefined}    | ${"2024-01-10"} | ${"day"}     | ${2}
    ${123}          | ${"2024-01-10"} | ${"day"}     | ${2}
    ${true}         | ${"2024-01-10"} | ${"day"}     | ${2}
    ${[]}           | ${"2024-01-10"} | ${"day"}     | ${2}
    ${{}}           | ${"2024-01-10"} | ${"day"}     | ${2}
    ${"2024-01-01"} | ${null}         | ${"day"}     | ${2}
    ${"2024-01-01"} | ${undefined}    | ${"day"}     | ${2}
    ${"2024-01-01"} | ${123}          | ${"day"}     | ${2}
    ${"2024-01-01"} | ${true}         | ${"day"}     | ${2}
    ${"2024-01-01"} | ${[]}           | ${"day"}     | ${2}
    ${"2024-01-01"} | ${{}}           | ${"day"}     | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${null}      | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${undefined} | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${123}       | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${true}      | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${[]}        | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${{}}        | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}     | ${null}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}     | ${undefined}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}     | ${"2"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"day"}     | ${true}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitDate(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );

  it("returns [] when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2),
    ).toEqual([]);
  });
});
