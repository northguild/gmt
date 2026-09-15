import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { splitIntervalByUnitDateTime } from "./splitIntervalByUnitDateTime";

describe("splitIntervalByUnitDateTime", () => {
  // Each boundary is start + k × amount (Temporal and Luxon Interval.splitBy), so month ends don't drift.
  it.each`
    start                    | end                      | unit       | expected
    ${"2024-01-31T10:00:00"} | ${"2024-05-15T10:00:00"} | ${"month"} | ${[{ start: "2024-01-31T10:00:00", end: "2024-02-29T10:00:00" }, { start: "2024-02-29T10:00:00", end: "2024-03-31T10:00:00" }, { start: "2024-03-31T10:00:00", end: "2024-04-30T10:00:00" }, { start: "2024-04-30T10:00:00", end: "2024-05-15T10:00:00" }]}
  `(
    "computes every $unit boundary of $start to $end from the start, without month-end drift",
    ({ start, end, unit, expected }) => {
      expect(splitIntervalByUnitDateTime(start, end, unit, 1)).toEqual(
        expected,
      );
    },
  );

  // amount > 1 from a month end: step k is start + 3k months (2024-05-30), where stepping from
  // the clamped Feb 29 would drift to 2024-05-29. Verified against Temporal.PlainDateTime.add.
  it.each`
    start                    | end                      | unit       | amount | expected
    ${"2023-11-30T10:00:00"} | ${"2024-09-01T10:00:00"} | ${"month"} | ${3}   | ${[{ start: "2023-11-30T10:00:00", end: "2024-02-29T10:00:00" }, { start: "2024-02-29T10:00:00", end: "2024-05-30T10:00:00" }, { start: "2024-05-30T10:00:00", end: "2024-08-30T10:00:00" }, { start: "2024-08-30T10:00:00", end: "2024-09-01T10:00:00" }]}
  `(
    "computes every $amount $unit boundary of $start to $end from the start",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitDateTime(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  // A calendar step that resolves to the previous boundary is skipped, not treated as a failure.
  // The stub makes step 2 land on step 1's day.
  it("skips a day step that repeats the previous boundary", () => {
    const realAdd = Temporal.PlainDateTime.prototype.add;
    vi.spyOn(Temporal.PlainDateTime.prototype, "add").mockImplementation(
      function (
        this: Temporal.PlainDateTime,
        ...args: Parameters<Temporal.PlainDateTime["add"]>
      ) {
        const { days } = args[0] as { days: number };
        return realAdd.call(this, { days: days === 2 ? 1 : days });
      },
    );

    expect(
      splitIntervalByUnitDateTime(
        "2024-01-01T00:00:00",
        "2024-01-04T00:00:00",
        "day",
        1,
      ),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" },
      { start: "2024-01-02T00:00:00", end: "2024-01-04T00:00:00" },
    ]);
  });

  // Exact units step from the previous boundary. 3 × 3033333333333333 exceeds 2^53 and rounds to
  // 9100000000000000, so an anchored third boundary would be 07:46:40 instead of 07:46:39.999999999.
  // Verified against Temporal.PlainDateTime.add stepping incrementally.
  it.each`
    start                    | end                      | unit            | amount              | expected
    ${"1970-01-01T00:00:00"} | ${"1970-04-26T17:46:40"} | ${"nanosecond"} | ${3033333333333333} | ${[{ start: "1970-01-01T00:00:00", end: "1970-02-05T02:35:33.333333333" }, { start: "1970-02-05T02:35:33.333333333", end: "1970-03-12T05:11:06.666666666" }, { start: "1970-03-12T05:11:06.666666666", end: "1970-04-16T07:46:39.999999999" }, { start: "1970-04-16T07:46:39.999999999", end: "1970-04-26T17:46:40" }]}
  `(
    "steps $amount $unit boundaries of $start to $end without losing precision past 2^53",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitDateTime(start, end, unit, amount)).toEqual(
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
    vi.spyOn(Temporal.PlainDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.PlainDateTime) {
        return this;
      },
    );

    expect(
      splitIntervalByUnitDateTime(
        "2024-01-01T00:00:00",
        "2024-01-10T00:00:00",
        unit,
        1,
      ),
    ).toEqual([]);
  });

  // No-progress guard: a step that does not move past the previous boundary returns [] rather
  // than looping forever.
  it("returns [] when a step lands before the previous boundary", () => {
    vi.spyOn(Temporal.PlainDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.PlainDateTime) {
        return this.subtract({ hours: 1 });
      },
    );

    expect(
      splitIntervalByUnitDateTime(
        "2024-01-01T00:00:00",
        "2024-01-01T10:00:00",
        "hour",
        1,
      ),
    ).toEqual([]);
  });

  const expectedExactDivision = [
    { start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" },
    { start: "2024-01-01T13:00:00", end: "2024-01-01T14:00:00" },
  ];

  const expectedRemainder = [
    { start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" },
    { start: "2024-01-01T13:00:00", end: "2024-01-01T14:00:00" },
    { start: "2024-01-01T14:00:00", end: "2024-01-01T14:30:00" },
  ];

  const expectedDayUnit = [
    { start: "2024-01-01T12:00:00", end: "2024-01-03T12:00:00" },
    { start: "2024-01-03T12:00:00", end: "2024-01-05T12:00:00" },
    { start: "2024-01-05T12:00:00", end: "2024-01-07T12:00:00" },
    { start: "2024-01-07T12:00:00", end: "2024-01-09T12:00:00" },
    { start: "2024-01-09T12:00:00", end: "2024-01-10T12:00:00" },
  ];

  const expectedZeroLength = [
    { start: "2024-01-01T12:00:00", end: "2024-01-01T12:00:00" },
  ];

  const expectedSingleStep = [
    { start: "2024-01-01T12:00:00", end: "2024-01-01T14:00:00" },
  ];

  it.each`
    start                    | end                      | unit      | amount | expected
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${"hour"} | ${1}   | ${expectedExactDivision}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:30:00"} | ${"hour"} | ${1}   | ${expectedRemainder}
    ${"2024-01-01T12:00:00"} | ${"2024-01-10T12:00:00"} | ${"day"}  | ${2}   | ${expectedDayUnit}
  `(
    "returns $expected for $start to $end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitDateTime(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                    | end                      | unit      | amount | expected
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T12:00:00"} | ${"hour"} | ${1}   | ${expectedZeroLength}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${"hour"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start to $end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitDateTime(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                    | end                      | unit         | amount
    ${"invalid"}             | ${"2024-01-01T14:00:00"} | ${"hour"}    | ${1}
    ${""}                    | ${"2024-01-01T14:00:00"} | ${"hour"}    | ${1}
    ${"2024-13-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${"hour"}    | ${1}
    ${"2024-01-01T12:00:00"} | ${"invalid"}             | ${"hour"}    | ${1}
    ${"2024-01-01T12:00:00"} | ${""}                    | ${"hour"}    | ${1}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${"invalid"} | ${1}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${""}        | ${1}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${"hour"}    | ${0}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${"hour"}    | ${-1}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T14:00:00"} | ${"hour"}    | ${1.5}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitDateTime(start, end, unit, amount)).toEqual([]);
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
        splitIntervalByUnitDateTime(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );

  it("returns [] when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      splitIntervalByUnitDateTime(
        "2024-01-01T12:00:00",
        "2024-01-01T14:00:00",
        "hour",
        1,
      ),
    ).toEqual([]);
  });
});
