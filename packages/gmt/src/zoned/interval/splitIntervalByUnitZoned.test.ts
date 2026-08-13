import { splitIntervalByUnitZoned } from "./splitIntervalByUnitZoned";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";

describe("splitIntervalByUnitZoned", () => {
  const expectedExactDivision = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T06:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T06:00:00+00:00[UTC]",
      end: "2024-01-01T12:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T12:00:00+00:00[UTC]",
      end: "2024-01-01T18:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T18:00:00+00:00[UTC]",
      end: "2024-01-02T00:00:00+00:00[UTC]",
    },
  ];

  const expectedRemainder = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T01:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T01:00:00+00:00[UTC]",
      end: "2024-01-01T01:30:00+00:00[UTC]",
    },
  ];

  const expectedDayUnit = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-03T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-03T00:00:00+00:00[UTC]",
      end: "2024-01-05T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-05T00:00:00+00:00[UTC]",
      end: "2024-01-07T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-07T00:00:00+00:00[UTC]",
      end: "2024-01-09T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-09T00:00:00+00:00[UTC]",
      end: "2024-01-10T00:00:00+00:00[UTC]",
    },
  ];

  const expectedZeroLength = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T00:00:00+00:00[UTC]",
    },
  ];

  const expectedSingleStep = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T02:00:00+00:00[UTC]",
    },
  ];

  it.each`
    start                               | end                                 | unit      | amount | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"hour"} | ${6}   | ${expectedExactDivision}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"} | ${1}   | ${expectedRemainder}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"day"}  | ${2}   | ${expectedDayUnit}
  `(
    "returns $expected for $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                               | end                                 | unit      | amount | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"hour"} | ${1}   | ${expectedZeroLength}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T02:00:00+00:00[UTC]"} | ${"hour"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                               | end                                 | unit         | amount
    ${"invalid"}                        | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${""}                               | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}                               | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"invalid"} | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${""}        | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${0}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${-1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1.5}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start                               | end                                 | unit         | amount
    ${null}                             | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${undefined}                        | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${123}                              | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${true}                             | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${[]}                               | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${{}}                               | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${null}                             | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${undefined}                        | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${123}                              | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${true}                             | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${[]}                               | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${{}}                               | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${null}      | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${undefined} | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${123}       | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${true}      | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${[]}        | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${{}}        | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${null}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${"1"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${true}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitZoned(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-02T00:00:00+00:00[UTC]",
        "hour",
        6,
      ),
    ).toEqual([]);
  });
});
