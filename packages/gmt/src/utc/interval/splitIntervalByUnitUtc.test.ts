import { Temporal } from "@js-temporal/polyfill";
import { splitIntervalByUnitUtc } from "./splitIntervalByUnitUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("splitIntervalByUnitUtc", () => {
  // Each boundary is start + k × amount (Temporal and Luxon Interval.splitBy), so month ends don't drift.
  it.each`
    start                     | end                       | unit       | expected
    ${"2024-01-31T10:00:00Z"} | ${"2024-05-15T10:00:00Z"} | ${"month"} | ${[{ start: "2024-01-31T10:00:00Z", end: "2024-02-29T10:00:00Z" }, { start: "2024-02-29T10:00:00Z", end: "2024-03-31T10:00:00Z" }, { start: "2024-03-31T10:00:00Z", end: "2024-04-30T10:00:00Z" }, { start: "2024-04-30T10:00:00Z", end: "2024-05-15T10:00:00Z" }]}
  `(
    "computes every $unit boundary of $start to $end from the start, without month-end drift",
    ({ start, end, unit, expected }) => {
      expect(splitIntervalByUnitUtc(start, end, unit, 1)).toEqual(expected);
    },
  );

  // amount > 1 from a month end: step k is start + 3k months (2024-05-30), where stepping from
  // the clamped Feb 29 would drift to 2024-05-29. Verified against Temporal.ZonedDateTime.add in UTC.
  it.each`
    start                     | end                       | unit       | amount | expected
    ${"2023-11-30T10:00:00Z"} | ${"2024-09-01T10:00:00Z"} | ${"month"} | ${3}   | ${[{ start: "2023-11-30T10:00:00Z", end: "2024-02-29T10:00:00Z" }, { start: "2024-02-29T10:00:00Z", end: "2024-05-30T10:00:00Z" }, { start: "2024-05-30T10:00:00Z", end: "2024-08-30T10:00:00Z" }, { start: "2024-08-30T10:00:00Z", end: "2024-09-01T10:00:00Z" }]}
  `(
    "computes every $amount $unit boundary of $start to $end from the start",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUtc(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  // A calendar step that resolves to the previous boundary is skipped, not treated as a failure.
  // The stub makes step 2 land on step 1's day (the shape of a deleted local day).
  it("skips a day step that repeats the previous boundary", () => {
    const realAdd = Temporal.ZonedDateTime.prototype.add;
    vi.spyOn(Temporal.ZonedDateTime.prototype, "add").mockImplementation(
      function (
        this: Temporal.ZonedDateTime,
        ...args: Parameters<Temporal.ZonedDateTime["add"]>
      ) {
        const { days } = args[0] as { days: number };
        return realAdd.call(this, { days: days === 2 ? 1 : days });
      },
    );

    expect(
      splitIntervalByUnitUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-04T00:00:00Z",
        "day",
        1,
      ),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" },
      { start: "2024-01-02T00:00:00Z", end: "2024-01-04T00:00:00Z" },
    ]);
  });

  // Exact units step from the previous boundary. 3 × 3033333333333333 exceeds 2^53 and rounds to
  // 9100000000000000, so an anchored third boundary would be 07:46:40 instead of 07:46:39.999999999.
  // Verified against Temporal.ZonedDateTime.add stepping incrementally in UTC.
  it.each`
    start                     | end                       | unit            | amount              | expected
    ${"1970-01-01T00:00:00Z"} | ${"1970-04-26T17:46:40Z"} | ${"nanosecond"} | ${3033333333333333} | ${[{ start: "1970-01-01T00:00:00Z", end: "1970-02-05T02:35:33.333333333Z" }, { start: "1970-02-05T02:35:33.333333333Z", end: "1970-03-12T05:11:06.666666666Z" }, { start: "1970-03-12T05:11:06.666666666Z", end: "1970-04-16T07:46:39.999999999Z" }, { start: "1970-04-16T07:46:39.999999999Z", end: "1970-04-26T17:46:40Z" }]}
  `(
    "steps $amount $unit boundaries of $start to $end without losing precision past 2^53",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUtc(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  // Loop bound: steps that never advance past the previous boundary return [] instead of spinning.
  it.each`
    unit
    ${"day"}
    ${"hour"}
  `("returns [] when $unit steps stop advancing", ({ unit }) => {
    vi.spyOn(Temporal.ZonedDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.ZonedDateTime) {
        return this;
      },
    );

    expect(
      splitIntervalByUnitUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-10T00:00:00Z",
        unit,
        1,
      ),
    ).toEqual([]);
  });

  // No-progress guard: a step that does not move past the previous boundary returns [] rather
  // than looping forever.
  it("returns [] when a step lands before the previous boundary", () => {
    vi.spyOn(Temporal.ZonedDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.ZonedDateTime) {
        return this.subtract({ hours: 1 });
      },
    );

    expect(
      splitIntervalByUnitUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-01T10:00:00Z",
        "hour",
        1,
      ),
    ).toEqual([]);
  });

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
    start           | end             | unit            | amount
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
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
