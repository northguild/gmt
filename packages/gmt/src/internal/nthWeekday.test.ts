import { Temporal } from "./temporal";
import { epochDayOf, isoWeekdayOf } from "./epochDay";
import {
  isWeekdayOrdinal,
  nthWeekdayEpochDay,
  ordinalNumber,
} from "./nthWeekday";

const ORDINALS = [1, 2, 3, 4, 5, -1, -2, -3, -4, -5];

/** Checks every weekday and sample ordinal of one month against a PlainDate walk. */
function checkMonth(year: number, month: number): void {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });
  const days = Array.from({ length: first.daysInMonth }, (_, index) =>
    first.add({ days: index }),
  );

  for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
    const matching = days.filter((date) => date.dayOfWeek === weekday);

    for (const n of ORDINALS) {
      const picked = n > 0 ? matching[n - 1] : matching.at(n);
      const expected = picked
        ? Temporal.PlainDate.from("1970-01-01").until(picked).days
        : null;

      expect(nthWeekdayEpochDay(year, month, weekday, n)).toBe(expected);
    }
  }
}

describe("nthWeekdayEpochDay", () => {
  // January 2026: 1 is a Thursday, so Fridays fall on 2, 9, 16, 23, 30 (five of them).
  // February 2026: 1 is a Sunday, so Fridays fall on 6, 13, 20, 27 (four of them).
  it.each`
    year        | month | weekday | n     | expected                       | description
    ${2026}     | ${1}  | ${5}    | ${5}  | ${epochDayOf(2026, 1, 30)}     | ${"fifth Friday of January 2026"}
    ${2026}     | ${1}  | ${5}    | ${-5} | ${epochDayOf(2026, 1, 2)}      | ${"fifth-from-last Friday of January 2026 is the first"}
    ${2026}     | ${2}  | ${5}    | ${5}  | ${null}                        | ${"February 2026 has four Fridays"}
    ${2026}     | ${2}  | ${5}    | ${-5} | ${null}                        | ${"February 2026 has four Fridays, counted from the end"}
    ${2026}     | ${12} | ${3}    | ${3}  | ${epochDayOf(2026, 12, 16)}    | ${"December reaches the next year for its month end"}
    ${2024}     | ${2}  | ${4}    | ${5}  | ${epochDayOf(2024, 2, 29)}     | ${"leap February fifth Thursday on the 29th"}
    ${-271_821} | ${4}  | ${1}    | ${1}  | ${null}                        | ${"first Monday is 5 April, before Temporal's minimum"}
    ${-271_821} | ${4}  | ${1}    | ${3}  | ${epochDayOf(-271_821, 4, 19)} | ${"third Monday is the first in-range day"}
    ${275_760}  | ${9}  | ${7}    | ${-1} | ${null}                        | ${"last Sunday is 28 September, past Temporal's maximum"}
    ${275_760}  | ${9}  | ${6}    | ${2}  | ${epochDayOf(275_760, 9, 13)}  | ${"second Saturday is the last in-range day"}
  `("$description gives $expected", ({ year, month, weekday, n, expected }) => {
    expect(nthWeekdayEpochDay(year, month, weekday, n)).toBe(expected);
  });

  // A month's layout is fixed by (weekday of the 1st) x (length 28/29/30/31). The 28 years
  // 2000..2027 hold every leap and common year start-weekday pair, so one 28-year run covers
  // every layout; a 400-year walk repeats them and only adds cost.
  it("agrees with a PlainDate walk over every month layout (2000..2027)", () => {
    for (let year = 2000; year <= 2027; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        checkMonth(year, month);
      }
    }
  });

  it.each`
    year    | month | weekday | n     | expected                   | description
    ${1900} | ${2}  | ${3}    | ${4}  | ${epochDayOf(1900, 2, 28)} | ${"century common year: February has 28 days"}
    ${2100} | ${2}  | ${7}    | ${-1} | ${epochDayOf(2100, 2, 28)} | ${"century common year, counted from the end"}
    ${2000} | ${2}  | ${2}    | ${5}  | ${epochDayOf(2000, 2, 29)} | ${"400-year leap February fifth Tuesday"}
    ${-1}   | ${12} | ${2}    | ${-1} | ${epochDayOf(-1, 12, 28)}  | ${"negative year, month end"}
    ${0}    | ${1}  | ${6}    | ${1}  | ${epochDayOf(0, 1, 1)}     | ${"year 0, first day is a Saturday"}
  `("$description gives $expected", ({ year, month, weekday, n, expected }) => {
    expect(nthWeekdayEpochDay(year, month, weekday, n)).toBe(expected);
  });

  it.each`
    year                | n
    ${1e306}            | ${-1}
    ${-1e306}           | ${1}
    ${Number.MAX_VALUE} | ${3}
  `("returns null, not NaN, for year $year", ({ year, n }) => {
    expect(nthWeekdayEpochDay(year, 3, 7, n)).toBeNull();
  });

  it("returns days of the requested weekday", () => {
    const day = nthWeekdayEpochDay(2026, 3, 7, -1);
    expect(day === null ? 0 : isoWeekdayOf(day)).toBe(7);
  });
});

describe("isWeekdayOrdinal", () => {
  it.each`
    value         | expected
    ${1}          | ${true}
    ${5}          | ${true}
    ${-1}         | ${true}
    ${-5}         | ${true}
    ${"last"}     | ${true}
    ${0}          | ${false}
    ${6}          | ${false}
    ${-6}         | ${false}
    ${1.5}        | ${false}
    ${"first"}    | ${false}
    ${"Last"}     | ${false}
    ${"1"}        | ${false}
    ${undefined}  | ${false}
    ${null}       | ${false}
    ${Number.NaN} | ${false}
  `("gives $expected for $value", ({ value, expected }) => {
    expect(isWeekdayOrdinal(value)).toBe(expected);
  });
});

describe("ordinalNumber", () => {
  it.each`
    n         | expected
    ${"last"} | ${-1}
    ${-1}     | ${-1}
    ${3}      | ${3}
    ${-5}     | ${-5}
  `("maps $n to $expected", ({ n, expected }) => {
    expect(ordinalNumber(n)).toBe(expected);
  });
});
