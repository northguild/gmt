import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalLengthDate } from "./intervalLengthDate";

describe("intervalLengthDate", () => {
  it.each`
    start           | end             | unit       | expected
    ${"2024-01-01"} | ${"2024-01-03"} | ${"day"}   | ${2}
    ${"2024-01-01"} | ${"2024-01-16"} | ${"day"}   | ${15}
    ${"2024-01-01"} | ${"2024-01-16"} | ${"month"} | ${15 / 31}
    ${"2024-01-01"} | ${"2024-02-01"} | ${"month"} | ${1}
    ${"2024-02-29"} | ${"2024-03-01"} | ${"day"}   | ${1}
    ${"2024-01-01"} | ${"2024-01-08"} | ${"week"}  | ${1}
    ${"2024-01-01"} | ${"2025-01-01"} | ${"year"}  | ${1}
    ${"2024-01-01"} | ${"2025-01-01"} | ${"day"}   | ${366}
    ${"2023-01-01"} | ${"2024-01-01"} | ${"day"}   | ${365}
  `(
    "returns $expected $unit for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthDate(start, end, unit)).toBeCloseTo(expected, 10);
    },
  );

  it.each`
    start           | end             | unit
    ${"2024-01-01"} | ${"2024-01-01"} | ${"day"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"month"}
  `("returns 0 for zero-length $start to $end", ({ start, end, unit }) => {
    expect(intervalLengthDate(start, end, unit)).toBe(0);
  });

  it("distinguishes from intervalCountDate on a fractional-month interval", () => {
    // intervalCountDate would report 1 month boundary crossed; intervalLengthDate reports the
    // true fraction of a month elapsed.
    const length = intervalLengthDate("2024-01-31", "2024-02-01", "month");
    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThan(1);
  });

  it.each`
    start           | end             | unit
    ${"invalid"}    | ${"2024-01-10"} | ${"day"}
    ${""}           | ${"2024-01-10"} | ${"day"}
    ${"2024-01-01"} | ${"invalid"}    | ${"day"}
    ${"2024-01-10"} | ${"2024-01-01"} | ${"day"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"invalid"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${""}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"hour"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"nanosecond"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthDate(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start   | end             | unit
    ${123}  | ${"2024-01-10"} | ${"day"}
    ${null} | ${"2024-01-10"} | ${"day"}
  `("returns null for wrong-type start $start", ({ start, end, unit }) => {
    expect(intervalLengthDate(start as never, end, unit)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(intervalLengthDate("2024-01-01", "2024-01-10", "day")).toBeNull();
  });
  // E5 (issue #78): same shared-calendar-or-fallback rule as intervalCountDate (D5). Golden
  // verified directly against @js-temporal/polyfill.
  it("measures length in the shared calendar when start and end carry the same tag", () => {
    expect(
      intervalLengthDate(
        "5784-06-15[u-ca=hebrew]",
        "5784-07-15[u-ca=hebrew]",
        "months",
      ),
    ).toBe(1);
  });

  // CORE-6: Duration.total({ unit, relativeTo: start }) of the calendar difference, per TC39
  // NudgeToCalendarUnit: whole units r1 from NonISODateUntil, plus the days from start + r1 to end
  // over the days from start + r1 to start + r1 + 1 (constrained).
  it.each`
    start                            | end                              | unit       | expected     | reason
    ${"2566-08-31[u-ca=buddhist]"}   | ${"2566-09-30[u-ca=buddhist]"}   | ${"month"} | ${1}         | ${"D6: until is P30D, but start + 1 month constrains to Sep 30 = end, so progress is 30/30"}
    ${"5784-06-02[u-ca=hebrew]"}     | ${"5785-06-01[u-ca=hebrew]"}     | ${"year"}  | ${384 / 385} | ${"D7: 384 days of the 385 to Adar 2 5785 (Adar I constrains to Adar)"}
    ${"279517-07-01[u-ca=hebrew]"}   | ${"279517-09-15[u-ca=hebrew]"}   | ${"month"} | ${2 + 14 / 29} | ${"D1: 2 months, then 14 of Iyar's 29 days, next to the maximum"}
  `(
    "returns $expected $unit for $start to $end ($reason)",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthDate(start, end, unit)).toBeCloseTo(expected, 12);
    },
  );
});
