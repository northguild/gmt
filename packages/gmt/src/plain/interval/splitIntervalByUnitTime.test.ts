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
    "returns $expected for $start..$end split by $amount $unit",
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
    "returns $expected for edge-case $start..$end split by $amount $unit",
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
    start         | end           | unit         | amount
    ${null}       | ${"14:00:00"} | ${"hour"}    | ${1}
    ${undefined}  | ${"14:00:00"} | ${"hour"}    | ${1}
    ${123}        | ${"14:00:00"} | ${"hour"}    | ${1}
    ${true}       | ${"14:00:00"} | ${"hour"}    | ${1}
    ${[]}         | ${"14:00:00"} | ${"hour"}    | ${1}
    ${{}}         | ${"14:00:00"} | ${"hour"}    | ${1}
    ${"12:00:00"} | ${null}       | ${"hour"}    | ${1}
    ${"12:00:00"} | ${undefined}  | ${"hour"}    | ${1}
    ${"12:00:00"} | ${123}        | ${"hour"}    | ${1}
    ${"12:00:00"} | ${true}       | ${"hour"}    | ${1}
    ${"12:00:00"} | ${[]}         | ${"hour"}    | ${1}
    ${"12:00:00"} | ${{}}         | ${"hour"}    | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${null}      | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${undefined} | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${123}       | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${true}      | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${[]}        | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${{}}        | ${1}
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}    | ${null}
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}    | ${undefined}
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}    | ${"1"}
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}    | ${true}
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
