import { Temporal } from "@js-temporal/polyfill";
import { splitIntervalByUnitDate } from "./splitIntervalByUnitDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("splitIntervalByUnitDate", () => {
  // Each boundary is start + k × amount (Temporal and Luxon Interval.splitBy), so month ends don't drift.
  it.each`
    start           | end             | unit       | expected
    ${"2024-01-31"} | ${"2024-05-15"} | ${"month"} | ${[{ start: "2024-01-31", end: "2024-02-29" }, { start: "2024-02-29", end: "2024-03-31" }, { start: "2024-03-31", end: "2024-04-30" }, { start: "2024-04-30", end: "2024-05-15" }]}
    ${"2024-02-29"} | ${"2028-03-01"} | ${"year"}  | ${[{ start: "2024-02-29", end: "2025-02-28" }, { start: "2025-02-28", end: "2026-02-28" }, { start: "2026-02-28", end: "2027-02-28" }, { start: "2027-02-28", end: "2028-02-29" }, { start: "2028-02-29", end: "2028-03-01" }]}
  `(
    "computes every $unit boundary of $start to $end from the start, without month-end drift",
    ({ start, end, unit, expected }) => {
      expect(splitIntervalByUnitDate(start, end, unit, 1)).toEqual(expected);
    },
  );

  // amount > 1 from a month end: step k is start + 3k months (2024-05-30), where stepping from
  // the clamped Feb 29 would drift to 2024-05-29. Verified against Temporal.PlainDate.add.
  it.each`
    start           | end             | unit       | amount | expected
    ${"2023-11-30"} | ${"2024-09-01"} | ${"month"} | ${3}   | ${[{ start: "2023-11-30", end: "2024-02-29" }, { start: "2024-02-29", end: "2024-05-30" }, { start: "2024-05-30", end: "2024-08-30" }, { start: "2024-08-30", end: "2024-09-01" }]}
  `(
    "computes every $amount $unit boundary of $start to $end from the start",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitDate(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  // A calendar step that resolves to the previous boundary is skipped, not treated as a failure.
  // The stub makes step 2 land on step 1's day.
  it("skips a day step that repeats the previous boundary", () => {
    const realAdd = Temporal.PlainDate.prototype.add;
    vi.spyOn(Temporal.PlainDate.prototype, "add").mockImplementation(function (
      this: Temporal.PlainDate,
      ...args: Parameters<Temporal.PlainDate["add"]>
    ) {
      const { days } = args[0] as { days: number };
      return realAdd.call(this, { days: days === 2 ? 1 : days });
    });

    expect(
      splitIntervalByUnitDate("2024-01-01", "2024-01-04", "day", 1),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-02" },
      { start: "2024-01-02", end: "2024-01-04" },
    ]);
  });

  // Loop bound: steps that never advance past the previous boundary return [] instead of spinning.
  it("returns [] when day steps stop advancing", () => {
    vi.spyOn(Temporal.PlainDate.prototype, "add").mockImplementation(
      function (this: Temporal.PlainDate) {
        return this;
      },
    );

    expect(
      splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 1),
    ).toEqual([]);
  });

  // No-progress guard: a step that does not move past the previous boundary returns [] rather
  // than looping forever.
  it("returns [] when a step lands before the previous boundary", () => {
    vi.spyOn(Temporal.PlainDate.prototype, "add").mockImplementation(
      function (this: Temporal.PlainDate) {
        return this.subtract({ days: 1 });
      },
    );

    expect(
      splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 1),
    ).toEqual([]);
  });

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
    "returns $expected for $start to $end split by $amount $unit",
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
    "returns $expected for edge-case $start to $end split by $amount $unit",
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
    start           | end             | unit            | amount
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${false}
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
  // E5 (issue #78): when start and end share a calendar tag, stepping (and each slice's
  // boundaries) happens in that calendar (D5) -- a Hebrew leap year splits into 13 month-
  // slices, not 12. Each boundary's tag is re-derived from the stepped date, never copied.
  // Goldens verified directly against @js-temporal/polyfill.
  it("splits a Hebrew leap year into 13 month-slices, not 12 (ISO's answer for the same span)", () => {
    const slices = splitIntervalByUnitDate(
      "5784-01-01[u-ca=hebrew]",
      "5785-01-01[u-ca=hebrew]",
      "month",
      1,
    );
    expect(slices).toHaveLength(13);
    expect(slices[0]).toEqual({
      start: "5784-01-01[u-ca=hebrew]",
      end: "5784-02-01[u-ca=hebrew]",
    });
  });

  // CORE-6: boundaries step through the calendar-correct add. Polyfill 0.5.1 throws `Invalid ISO
  // date` stepping a month from islamic-civil min+68 (D1) and "Missing month" from Hebrew year -41
  // (D3), so both splits used to return []. Boundaries: Chromium 152 (q2-xscan-chromium152.json),
  // the Hebrew one through the Dershowitz–Reingold oracle; the last boundary is `end` itself.
  it.each`
    start                                  | end                                    | unit        | expected                                                                                                                                                                                | reason
    ${"-280804-05-30[u-ca=islamic-civil]"} | ${"-280804-07-30[u-ca=islamic-civil]"} | ${"months"} | ${[{ start: "-280804-05-30[u-ca=islamic-civil]", end: "-280804-06-29[u-ca=islamic-civil]" }, { start: "-280804-06-29[u-ca=islamic-civil]", end: "-280804-07-30[u-ca=islamic-civil]" }]} | ${"D1: +1 month constrains to Jumada I 29 (xscan min[68]); +2 months is Rajab 30 = end"}
    ${"-000041-05-16[u-ca=hebrew]"}        | ${"-000041-07-16[u-ca=hebrew]"}        | ${"months"} | ${[{ start: "-000041-05-16[u-ca=hebrew]", end: "-000041-06-16[u-ca=hebrew]" }, { start: "-000041-06-16[u-ca=hebrew]", end: "-000041-07-16[u-ca=hebrew]" }]}                             | ${"D3/D4: Shevat 16 -> Adar 16 -> Nisan 16 (xscan stride k=979)"}
    ${"-280804-05-07[u-ca=islamic-civil]"} | ${"-280803-05-07[u-ca=islamic-civil]"} | ${"years"}  | ${[{ start: "-280804-05-07[u-ca=islamic-civil]", end: "-280803-05-07[u-ca=islamic-civil]" }]}                                                                                           | ${"D1: +1 year is end (xscan min[45] +1 year = min[400])"}
  `(
    "splits $start to $end by 1 $unit ($reason)",
    ({ start, end, unit, expected }) => {
      expect(splitIntervalByUnitDate(start, end, unit, 1)).toEqual(expected);
    },
  );
});
