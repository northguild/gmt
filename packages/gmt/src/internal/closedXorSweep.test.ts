import { Temporal } from "@js-temporal/polyfill";
import { type ClosedXorOps, closedXorSweep } from "./closedXorSweep";

const integerOps: ClosedXorOps<number> = {
  compare: (left, right) => left - right,
  stepUp: (value) => value + 1,
  stepDown: (value) => value - 1,
};

const timeOps: ClosedXorOps<Temporal.PlainTime> = {
  compare: Temporal.PlainTime.compare,
  stepUp: (value) => value.add({ nanoseconds: 1 }),
  stepDown: (value) => value.subtract({ nanoseconds: 1 }),
};

const toTimes = (
  intervals: Array<{ start: string; end: string }>,
): Array<{ start: Temporal.PlainTime; end: Temporal.PlainTime }> =>
  intervals.map(({ start, end }) => ({
    start: Temporal.PlainTime.from(start),
    end: Temporal.PlainTime.from(end),
  }));

const fromTimes = (
  intervals: Array<{ start: Temporal.PlainTime; end: Temporal.PlainTime }>,
): Array<{ start: string; end: string }> =>
  intervals.map(({ start, end }) => ({
    start: start.toString(),
    end: end.toString(),
  }));

describe("closedXorSweep", () => {
  // Integer rows: the closed set of each interval is written out, and the expected runs are the
  // values listed an odd number of times, merged into maximal runs.
  it.each`
    intervals                                                                | expected                                                                 | reason
    ${[]}                                                                    | ${[]}                                                                    | ${"empty list"}
    ${[{ start: 2, end: 5 }]}                                                | ${[{ start: 2, end: 5 }]}                                                | ${"single interval unchanged"}
    ${[{ start: 3, end: 3 }]}                                                | ${[{ start: 3, end: 3 }]}                                                | ${"zero-length interval covers its point"}
    ${[{ start: 1, end: 3 }, { start: 1, end: 3 }]}                          | ${[]}                                                                    | ${"identical intervals cancel"}
    ${[{ start: 1, end: 10 }, { start: 4, end: 6 }]}                         | ${[{ start: 1, end: 3 }, { start: 7, end: 10 }]}                         | ${"nested: 4..6 covered twice"}
    ${[{ start: 1, end: 5 }, { start: 5, end: 9 }]}                          | ${[{ start: 1, end: 4 }, { start: 6, end: 9 }]}                          | ${"closed ends share 5, covered twice"}
    ${[{ start: 1, end: 3 }, { start: 4, end: 6 }]}                          | ${[{ start: 1, end: 6 }]}                                                | ${"adjacent runs merge into one maximal run"}
    ${[{ start: 1, end: 3 }, { start: 5, end: 6 }]}                          | ${[{ start: 1, end: 3 }, { start: 5, end: 6 }]}                          | ${"a one-value gap keeps runs apart"}
    ${[{ start: 1, end: 10 }, { start: 5, end: 15 }, { start: 8, end: 20 }]} | ${[{ start: 1, end: 4 }, { start: 8, end: 10 }, { start: 16, end: 20 }]} | ${"3-way: 1..4 once, 8..10 three times, 16..20 once"}
    ${[{ start: 8, end: 20 }, { start: 1, end: 10 }, { start: 5, end: 15 }]} | ${[{ start: 1, end: 4 }, { start: 8, end: 10 }, { start: 16, end: 20 }]} | ${"3-way in a different input order"}
    ${[{ start: 1, end: 5 }, { start: 3, end: 3 }]}                          | ${[{ start: 1, end: 2 }, { start: 4, end: 5 }]}                          | ${"zero-length hole at 3"}
    ${[{ start: 1, end: 5 }, { start: 5, end: 5 }]}                          | ${[{ start: 1, end: 4 }]}                                                | ${"zero-length hole at the shared end 5"}
  `("returns $expected for $intervals ($reason)", ({ intervals, expected }) => {
    expect(closedXorSweep(intervals, integerOps)).toEqual(expected);
  });

  // PlainTime wraps at the end of the day, so no boundary may be computed as `end + 1`.
  it.each`
    intervals                                                                                               | expected
    ${[{ start: "22:00:00", end: "23:59:59.999999999" }]}                                                   | ${[{ start: "22:00:00", end: "23:59:59.999999999" }]}
    ${[{ start: "22:00:00", end: "23:59:59.999999999" }, { start: "23:00:00", end: "23:30:00" }]}           | ${[{ start: "22:00:00", end: "22:59:59.999999999" }, { start: "23:30:00.000000001", end: "23:59:59.999999999" }]}
    ${[{ start: "22:00:00", end: "23:59:59.999999999" }, { start: "23:00:00", end: "23:59:59.999999999" }]} | ${[{ start: "22:00:00", end: "22:59:59.999999999" }]}
    ${[{ start: "00:00:00", end: "00:00:00" }, { start: "00:00:00", end: "01:00:00" }]}                     | ${[{ start: "00:00:00.000000001", end: "01:00:00" }]}
  `(
    "returns $expected for PlainTime $intervals without wrapping at midnight",
    ({ intervals, expected }) => {
      expect(fromTimes(closedXorSweep(toTimes(intervals), timeOps))).toEqual(
        expected,
      );
    },
  );

  it("never steps past the maximum PlainDate for an interval ending on +275760-09-13", () => {
    const dateOps: ClosedXorOps<Temporal.PlainDate> = {
      compare: Temporal.PlainDate.compare,
      stepUp: (value) => value.add({ days: 1 }),
      stepDown: (value) => value.subtract({ days: 1 }),
    };
    const day = (value: string): Temporal.PlainDate =>
      Temporal.PlainDate.from(value);

    const result = closedXorSweep(
      [
        { start: day("+275760-09-10"), end: day("+275760-09-13") },
        { start: day("+275760-09-11"), end: day("+275760-09-12") },
      ],
      dateOps,
    );

    expect(
      result.map(({ start, end }) => [start.toString(), end.toString()]),
    ).toEqual([
      ["+275760-09-10", "+275760-09-10"],
      ["+275760-09-13", "+275760-09-13"],
    ]);
  });
});
