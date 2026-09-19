import { Temporal } from "@js-temporal/polyfill";
import {
  isExactDurationUnit,
  MAX_STALLED_SPLIT_STEPS,
  minSlicesForSpan,
  tileByUnit,
} from "./splitStep";

const toStrings = (slices: Array<[Temporal.PlainDate, Temporal.PlainDate]>) =>
  slices.map(([start, end]) => [start.toString(), end.toString()]);

describe("isExactDurationUnit", () => {
  it.each`
    unit              | expected
    ${"hours"}        | ${true}
    ${"minutes"}      | ${true}
    ${"seconds"}      | ${true}
    ${"milliseconds"} | ${true}
    ${"microseconds"} | ${true}
    ${"nanoseconds"}  | ${true}
    ${"years"}        | ${false}
    ${"months"}       | ${false}
    ${"weeks"}        | ${false}
    ${"days"}         | ${false}
    ${"hour"}         | ${false}
    ${""}             | ${false}
  `("returns $expected for unit $unit", ({ unit, expected }) => {
    expect(isExactDurationUnit(unit)).toBe(expected);
  });
});

describe("MAX_STALLED_SPLIT_STEPS", () => {
  it("allows 8 consecutive non-advancing steps", () => {
    expect(MAX_STALLED_SPLIT_STEPS).toBe(8);
  });
});

describe("tileByUnit", () => {
  // Verified against Temporal.PlainDate.add: 2024-01-31 + 1/2/3 months = 02-29, 03-31, 04-30.
  it.each`
    start           | end             | unit        | amount | expected
    ${"2024-01-01"} | ${"2024-01-04"} | ${"days"}   | ${2}   | ${[["2024-01-01", "2024-01-03"], ["2024-01-03", "2024-01-04"]]}
    ${"2024-01-31"} | ${"2024-04-30"} | ${"months"} | ${1}   | ${[["2024-01-31", "2024-02-29"], ["2024-02-29", "2024-03-31"], ["2024-03-31", "2024-04-30"]]}
  `(
    "tiles $start to $end by $amount $unit, anchored to the start",
    ({ start, end, unit, amount, expected }) => {
      const slices = tileByUnit(
        Temporal.PlainDate.from(start),
        Temporal.PlainDate.from(end),
        Temporal.PlainDate.compare,
        unit,
        amount,
        100,
      );
      expect(slices && toStrings(slices)).toEqual(expected);
    },
  );

  it("skips a step that repeats the previous boundary", () => {
    const realAdd = Temporal.PlainDate.prototype.add;
    vi.spyOn(Temporal.PlainDate.prototype, "add").mockImplementation(function (
      this: Temporal.PlainDate,
      ...args: Parameters<Temporal.PlainDate["add"]>
    ) {
      const { days } = args[0] as { days: number };
      return realAdd.call(this, { days: days === 2 ? 1 : days });
    });

    const slices = tileByUnit(
      Temporal.PlainDate.from("2024-01-01"),
      Temporal.PlainDate.from("2024-01-04"),
      Temporal.PlainDate.compare,
      "days",
      1,
      100,
    );

    expect(slices && toStrings(slices)).toEqual([
      ["2024-01-01", "2024-01-02"],
      ["2024-01-02", "2024-01-04"],
    ]);
  });

  it.each`
    unit       | reason
    ${"hours"} | ${"PlainDate ignores exact units, so no step advances"}
    ${"days"}  | ${"a stub keeps returning the receiver"}
  `("returns null when $unit steps stall ($reason)", ({ unit }) => {
    if (unit === "days") {
      vi.spyOn(Temporal.PlainDate.prototype, "add").mockImplementation(
        function (this: Temporal.PlainDate) {
          return this;
        },
      );
    }

    expect(
      tileByUnit(
        Temporal.PlainDate.from("2024-01-01"),
        Temporal.PlainDate.from("2024-01-04"),
        Temporal.PlainDate.compare,
        unit,
        1,
        100,
      ),
    ).toBeNull();
  });

  // A stub stalls the first `stalls` anchored steps on the start, then advances one real day per
  // step. The cap allows exactly 8 consecutive stalls; the 9th gives up.
  it.each`
    stalls | expected
    ${8}   | ${[["2024-01-01", "2024-01-02"], ["2024-01-02", "2024-01-03"], ["2024-01-03", "2024-01-04"]]}
    ${9}   | ${null}
  `(
    "returns $expected after $stalls consecutive stalled steps",
    ({ stalls, expected }) => {
      const realAdd = Temporal.PlainDate.prototype.add;
      vi.spyOn(Temporal.PlainDate.prototype, "add").mockImplementation(
        function (
          this: Temporal.PlainDate,
          ...args: Parameters<Temporal.PlainDate["add"]>
        ) {
          const { days } = args[0] as { days: number };
          return days <= stalls
            ? this
            : realAdd.call(this, { days: days - stalls });
        },
      );

      const slices = tileByUnit(
        Temporal.PlainDate.from("2024-01-01"),
        Temporal.PlainDate.from("2024-01-04"),
        Temporal.PlainDate.compare,
        "days",
        1,
        100,
      );

      expect(slices && toStrings(slices)).toEqual(expected);
    },
  );

  it("returns null when a step goes backwards", () => {
    vi.spyOn(Temporal.PlainDate.prototype, "add").mockImplementation(
      function (this: Temporal.PlainDate) {
        return this.subtract({ days: 1 });
      },
    );

    expect(
      tileByUnit(
        Temporal.PlainDate.from("2024-01-01"),
        Temporal.PlainDate.from("2024-01-04"),
        Temporal.PlainDate.compare,
        "days",
        1,
        100,
      ),
    ).toBeNull();
  });

  // 2024-01-01..2024-01-04 by 1 day is 3 slices.
  it.each`
    maxSlices | expected
    ${3}      | ${[["2024-01-01", "2024-01-02"], ["2024-01-02", "2024-01-03"], ["2024-01-03", "2024-01-04"]]}
    ${2}      | ${null}
    ${1}      | ${null}
  `(
    "returns $expected for 3 day slices under maxSlices $maxSlices",
    ({ maxSlices, expected }) => {
      const slices = tileByUnit(
        Temporal.PlainDate.from("2024-01-01"),
        Temporal.PlainDate.from("2024-01-04"),
        Temporal.PlainDate.compare,
        "days",
        1,
        maxSlices,
      );

      expect(slices && toStrings(slices)).toEqual(expected);
    },
  );
});

describe("minSlicesForSpan", () => {
  const HOUR = 3_600_000_000_000;
  const DAY = 86_400_000_000_000;

  // Exact units step exactly, so the count is ceil(span / step). Calendar units can step at most
  // amount × (1 day | 7 days | 31 days | 385 days), the longest day, week, month (every CLDR
  // calendar) and year (Hebrew and Chinese leap years), so K boundaries reach at most that far.
  // A zoned value may also shift by an offset change (< 48 hours, offsets lie within ±24 hours)
  // and may stall up to 8 steps in a row, so at least floor(K / 9) of those steps are slices.
  it.each`
    label                         | spanNs          | unit             | amount | zoned    | expected
    ${"3 hours by 1 hour"}        | ${3 * HOUR}     | ${"hours"}       | ${1}   | ${false} | ${3}
    ${"3 hours + 1 ns by 1 hour"} | ${3 * HOUR + 1} | ${"hours"}       | ${1}   | ${false} | ${4}
    ${"3 hours by 1 hour, zoned"} | ${3 * HOUR}     | ${"hours"}       | ${1}   | ${true}  | ${3}
    ${"1 ns by 1 nanosecond"}     | ${1}            | ${"nanoseconds"} | ${1}   | ${false} | ${1}
    ${"zero span"}                | ${0}            | ${"days"}        | ${1}   | ${false} | ${0}
    ${"10 days by 1 day"}         | ${10 * DAY}     | ${"days"}        | ${1}   | ${false} | ${10}
    ${"10 days by 2 days"}        | ${10 * DAY}     | ${"days"}        | ${2}   | ${false} | ${5}
    ${"15 days by 1 week"}        | ${15 * DAY}     | ${"weeks"}       | ${1}   | ${false} | ${3}
    ${"62 days by 1 month"}       | ${62 * DAY}     | ${"months"}      | ${1}   | ${false} | ${2}
    ${"10 days by 1 month"}       | ${10 * DAY}     | ${"months"}      | ${1}   | ${false} | ${1}
    ${"770 days by 1 year"}       | ${770 * DAY}    | ${"years"}       | ${1}   | ${false} | ${2}
    ${"20 days by 1 day, zoned"}  | ${20 * DAY}     | ${"days"}        | ${1}   | ${true}  | ${2}
    ${"2 days by 1 day, zoned"}   | ${2 * DAY}      | ${"days"}        | ${1}   | ${true}  | ${0}
    ${"unknown unit"}             | ${10 * DAY}     | ${"fortnights"}  | ${1}   | ${false} | ${0}
    ${"non-positive amount"}      | ${10 * DAY}     | ${"days"}        | ${0}   | ${false} | ${0}
  `(
    "returns $expected for $label",
    ({ spanNs, unit, amount, zoned, expected }) => {
      expect(minSlicesForSpan(spanNs, unit, amount, zoned)).toBe(expected);
    },
  );
});
