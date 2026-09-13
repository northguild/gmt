import { Temporal } from "@js-temporal/polyfill";
import {
  isExactDurationUnit,
  MAX_STALLED_SPLIT_STEPS,
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
      ),
    ).toBeNull();
  });
});
