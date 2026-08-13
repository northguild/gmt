import { splitIntervalByUnitUtc } from "./splitIntervalByUnitUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("splitIntervalByUnitUtc", () => {
  const expectedExactDivision = [
    { start: "2024-01-01T00:00:00Z", end: "2024-01-01T06:00:00Z" },
    { start: "2024-01-01T06:00:00Z", end: "2024-01-01T12:00:00Z" },
    { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" },
    { start: "2024-01-01T18:00:00Z", end: "2024-01-02T00:00:00Z" },
  ];

  const expectedRemainder = [
    { start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" },
    { start: "2024-01-01T01:00:00Z", end: "2024-01-01T01:30:00Z" },
  ];

  const expectedDayUnit = [
    { start: "2024-01-01T00:00:00Z", end: "2024-01-03T00:00:00Z" },
    { start: "2024-01-03T00:00:00Z", end: "2024-01-05T00:00:00Z" },
    { start: "2024-01-05T00:00:00Z", end: "2024-01-07T00:00:00Z" },
    { start: "2024-01-07T00:00:00Z", end: "2024-01-09T00:00:00Z" },
    { start: "2024-01-09T00:00:00Z", end: "2024-01-10T00:00:00Z" },
  ];

  const expectedZeroLength = [
    { start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" },
  ];

  const expectedSingleStep = [
    { start: "2024-01-01T00:00:00Z", end: "2024-01-01T02:00:00Z" },
  ];

  it.each`
    start                     | end                       | unit      | amount | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${"hour"} | ${6}   | ${expectedExactDivision}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"} | ${1}   | ${expectedRemainder}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-10T00:00:00Z"} | ${"day"}  | ${2}   | ${expectedDayUnit}
  `(
    "returns $expected for $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUtc(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                     | end                       | unit      | amount | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"hour"} | ${1}   | ${expectedZeroLength}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T02:00:00Z"} | ${"hour"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUtc(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                     | end                       | unit         | amount
    ${"invalid"}              | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${""}                     | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${"2024-12-31T23:59:60Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"invalid"}              | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${""}                     | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:60Z"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"invalid"} | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${""}        | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${0}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${-1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1.5}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitUtc(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start                     | end                       | unit         | amount
    ${null}                   | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${undefined}              | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${123}                    | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${true}                   | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${[]}                     | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${{}}                     | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${null}                   | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${undefined}              | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${123}                    | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${true}                   | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${[]}                     | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${{}}                     | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${null}      | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${undefined} | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${123}       | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${true}      | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${[]}        | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${{}}        | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${null}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${undefined}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${"1"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T01:30:00Z"} | ${"hour"}    | ${true}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitUtc(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );

  it("returns [] when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      splitIntervalByUnitUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-02T00:00:00Z",
        "hour",
        6,
      ),
    ).toEqual([]);
  });
});
