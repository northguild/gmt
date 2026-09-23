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
  // boundaries) happens in that calendar -- a Hebrew leap year splits into 13 month-slices, not
  // 12. Each boundary's tag is re-derived from the stepped date, never copied. Different
  // calendars return [] (TC39 CalendarEquals). Goldens verified directly against
  // @js-temporal/polyfill.
  it("splits a Hebrew leap year into 13 month-slices, not 12 (ISO's answer for the same span)", () => {
    const slices = splitIntervalByUnitDate(
      "2023-09-16[u-ca=hebrew]",
      "2024-10-03[u-ca=hebrew]",
      "month",
      1,
    );
    expect(slices).toHaveLength(13);
    expect(slices[0]).toEqual({
      start: "2023-09-16[u-ca=hebrew]",
      end: "2023-10-16[u-ca=hebrew]",
    });
  });

  // Native Temporal (Chromium 153) until throws "Mismatched calendars." for each pair.
  it.each`
    start                          | end                           | reason
    ${"2024-10-03[u-ca=hebrew]"}   | ${"2024-11-03"}               | ${"hebrew and bare ISO"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=gregory]"} | ${"iso8601 and gregory"}
    ${"2024-10-03[u-ca=ethiopic]"} | ${"2024-11-02[u-ca=ethioaa]"} | ${"ethiopic and ethioaa"}
  `(
    "returns [] from $start to $end ($reason: different calendars)",
    ({ start, end }) => {
      expect(splitIntervalByUnitDate(start, end, "day", 7)).toEqual([]);
    },
  );

  // CORE-6: boundaries step through the calendar-correct add. Polyfill 0.5.1 throws `Invalid ISO
  // date` stepping a month from islamic-civil min+68 (D1) and "Missing month" from Hebrew year -41
  // (D3), so both splits used to return []. Boundaries: Chromium 152 (q2-xscan-chromium152.json),
  // the Hebrew one through the Dershowitz–Reingold oracle; the last boundary is `end` itself.
  it.each`
    start                                  | end                                    | unit        | expected                                                                                                                                                                                | reason
    ${"-271821-06-26[u-ca=islamic-civil]"} | ${"-271821-08-24[u-ca=islamic-civil]"} | ${"months"} | ${[{ start: "-271821-06-26[u-ca=islamic-civil]", end: "-271821-07-25[u-ca=islamic-civil]" }, { start: "-271821-07-25[u-ca=islamic-civil]", end: "-271821-08-24[u-ca=islamic-civil]" }]} | ${"D1: +1 month constrains to Jumada I 29 (xscan min[68]); +2 months is Rajab 30 = end"}
    ${"-003801-01-03[u-ca=hebrew]"}        | ${"-003801-03-03[u-ca=hebrew]"}        | ${"months"} | ${[{ start: "-003801-01-03[u-ca=hebrew]", end: "-003801-02-02[u-ca=hebrew]" }, { start: "-003801-02-02[u-ca=hebrew]", end: "-003801-03-03[u-ca=hebrew]" }]}                             | ${"D3/D4: Shevat 16 -> Adar 16 -> Nisan 16 (xscan stride k=979)"}
    ${"-271821-06-03[u-ca=islamic-civil]"} | ${"-271820-05-23[u-ca=islamic-civil]"} | ${"years"}  | ${[{ start: "-271821-06-03[u-ca=islamic-civil]", end: "-271820-05-23[u-ca=islamic-civil]" }]}                                                                                           | ${"D1: +1 year is end (xscan min[45] +1 year = min[400])"}
  `(
    "splits $start to $end by 1 $unit ($reason)",
    ({ start, end, unit, expected }) => {
      expect(splitIntervalByUnitDate(start, end, unit, 1)).toEqual(expected);
    },
  );
});

describe("splitIntervalByUnitDate maxPieces", () => {
  // Owner decision A2: maxPieces bounds the number of slices. At or above the slice count the
  // output is unchanged; one below it returns the sentinel.
  it.each`
    maxPieces
    ${4}
    ${9}
  `(
    "returns 4 slices for 2024-01-31 to 2024-05-15 by 1 month with maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitDate("2024-01-31", "2024-05-15", "month", 1, {
          maxPieces,
        }),
      ).toEqual([
        { start: "2024-01-31", end: "2024-02-29" },
        { start: "2024-02-29", end: "2024-03-31" },
        { start: "2024-03-31", end: "2024-04-30" },
        { start: "2024-04-30", end: "2024-05-15" },
      ]);
    },
  );

  it.each`
    maxPieces
    ${3}
    ${1}
  `(
    "returns [] for 2024-01-31 to 2024-05-15 by 1 month (4 slices) over maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitDate("2024-01-31", "2024-05-15", "month", 1, {
          maxPieces,
        }).length,
      ).toBe(0);
    },
  );

  it.each`
    maxPieces
    ${5}
    ${10}
  `(
    "returns 5 slices for 2024-01-01 to 2024-01-10 by 2 day with maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, {
          maxPieces,
        }),
      ).toEqual([
        { start: "2024-01-01", end: "2024-01-03" },
        { start: "2024-01-03", end: "2024-01-05" },
        { start: "2024-01-05", end: "2024-01-07" },
        { start: "2024-01-07", end: "2024-01-09" },
        { start: "2024-01-09", end: "2024-01-10" },
      ]);
    },
  );

  it.each`
    maxPieces
    ${4}
    ${1}
  `(
    "returns [] for 2024-01-01 to 2024-01-10 by 2 day (5 slices) over maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, {
          maxPieces,
        }).length,
      ).toBe(0);
    },
  );

  it("returns one slice for a zero-length interval with maxPieces 1", () => {
    expect(
      splitIntervalByUnitDate("2024-01-01", "2024-01-01", "day", 2, {
        maxPieces: 1,
      }),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-01" }]);
  });

  it.each`
    label                   | options
    ${"maxPieces 0"}        | ${{ maxPieces: 0 }}
    ${"maxPieces -1"}       | ${{ maxPieces: -1 }}
    ${"maxPieces 1.5"}      | ${{ maxPieces: 1.5 }}
    ${"maxPieces NaN"}      | ${{ maxPieces: Number.NaN }}
    ${"maxPieces Infinity"} | ${{ maxPieces: Number.POSITIVE_INFINITY }}
    ${"maxPieces string"}   | ${{ maxPieces: "5" }}
    ${"null options"}       | ${null}
    ${"number options"}     | ${5}
  `("returns [] for invalid $label", ({ options }) => {
    expect(
      splitIntervalByUnitDate(
        "2024-01-01",
        "2024-01-10",
        "day",
        2,
        options as never,
      ).length,
    ).toBe(0);
  });
});

describe("splitIntervalByUnitDate default piece limit", () => {
  // Default maxPieces is 1_000_000: a larger split returns the sentinel instead of exhausting the
  // heap.
  it.each`
    start              | end                | unit     | slices
    ${"-271821-04-19"} | ${"+275760-09-13"} | ${"day"} | ${"200_000_001 days"}
    ${"2024-01-01"}    | ${"4761-11-29"}    | ${"day"} | ${"1_000_001 days (2024-01-01 + 1_000_000 days is 4761-11-28)"}
  `(
    "returns [] for $start to $end by 1 $unit ($slices)",
    ({ start, end, unit }) => {
      expect(splitIntervalByUnitDate(start, end, unit, 1).length).toBe(0);
    },
  );

  // A step past Temporal's maximum (instant +275760-09-13T00:00:00Z; PlainDateTime
  // +275760-09-13T23:59:59.999999999; PlainDate +275760-09-13) lands after the representable `end`,
  // so the last piece is trimmed to `end` rather than discarding the split.
  it.each`
    start              | end                | unit       | amount
    ${"+275760-09-01"} | ${"+275760-09-13"} | ${"month"} | ${1}
    ${"+275760-09-10"} | ${"+275760-09-13"} | ${"week"}  | ${1}
    ${"+275760-09-12"} | ${"+275760-09-13"} | ${"day"}   | ${2}
  `(
    "returns one piece from $start to $end by $amount $unit at the date limit",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitDate(start, end, unit, amount)).toEqual([
        { start, end },
      ]);
    },
  );
});

// An unknown unit or a time unit (PlainDate has none) is invalid input whatever the span: a non-empty interval already returns
// [] for it, so a zero-length interval must too, rather than the one zero-length slice a valid
// unit gives.
describe("splitIntervalByUnitDate rejects an invalid unit on a zero-length interval", () => {
  it.each`
    unit
    ${"invalid"}
    ${"fortnight"}
    ${"hours"}
    ${"hour"}
  `("returns [] for unit $unit", ({ unit }) => {
    expect(
      splitIntervalByUnitDate("2024-01-01", "2024-01-01", unit, 1),
    ).toEqual([]);
  });
});
