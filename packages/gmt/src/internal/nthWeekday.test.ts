import { Temporal } from "./temporal";
import {
  epochDayOf,
  isoWeekdayOf,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
} from "./epochDay";
import {
  isWeekdayOrdinal,
  nthWeekdayEpochDay,
  nthWeekdayInRange,
  nthWeekdayWithin,
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

describe("nthWeekdayInRange", () => {
  // 1997-01-01 is a Wednesday, so the first Monday is Jan 6 and the 20th is Jan 6 + 133 days = day 139 = May 19.
  // 2024 starts on a Monday and has 366 days: the 53rd Monday is day 1 + 364 = day 365 = Dec 30,
  // the 53rd Tuesday is day 366 = Dec 31, the 53rd Wednesday would be 2025-01-01, outside the range.
  it.each`
    first                      | last                        | weekday | n      | expected                    | description
    ${epochDayOf(1997, 1, 1)}  | ${epochDayOf(1997, 12, 31)} | ${1}    | ${20}  | ${epochDayOf(1997, 5, 19)}  | ${"20th Monday of 1997"}
    ${epochDayOf(2024, 1, 1)}  | ${epochDayOf(2024, 12, 31)} | ${1}    | ${53}  | ${epochDayOf(2024, 12, 30)} | ${"53rd Monday of 2024"}
    ${epochDayOf(2024, 1, 1)}  | ${epochDayOf(2024, 12, 31)} | ${2}    | ${53}  | ${epochDayOf(2024, 12, 31)} | ${"53rd Tuesday of 2024"}
    ${epochDayOf(2024, 1, 1)}  | ${epochDayOf(2024, 12, 31)} | ${3}    | ${53}  | ${null}                     | ${"53rd Wednesday of 2024 does not exist"}
    ${epochDayOf(2024, 1, 1)}  | ${epochDayOf(2024, 12, 31)} | ${2}    | ${-53} | ${epochDayOf(2024, 1, 2)}   | ${"53rd Tuesday from the end of 2024 is Jan 2"}
    ${epochDayOf(2024, 1, 1)}  | ${epochDayOf(2024, 12, 31)} | ${3}    | ${-53} | ${null}                     | ${"53rd Wednesday from the end of 2024 does not exist"}
    ${epochDayOf(2024, 5, 13)} | ${epochDayOf(2024, 5, 13)}  | ${1}    | ${-1}  | ${epochDayOf(2024, 5, 13)}  | ${"last Monday of a one-day Monday range"}
    ${epochDayOf(2024, 5, 13)} | ${epochDayOf(2024, 5, 13)}  | ${1}    | ${1}   | ${epochDayOf(2024, 5, 13)}  | ${"first Monday of a one-day Monday range"}
    ${epochDayOf(2024, 5, 13)} | ${epochDayOf(2024, 5, 13)}  | ${2}    | ${-1}  | ${null}                     | ${"no Tuesday in a one-day Monday range"}
    ${MAX_EPOCH_DAY - 3}       | ${MAX_EPOCH_DAY + 10}       | ${1}    | ${2}   | ${null}                     | ${"a second hit is at least 7 days on, past the last Temporal date"}
  `("$description", ({ first, last, weekday, n, expected }) => {
    expect(nthWeekdayInRange(first, last, weekday, n)).toBe(expected);
  });

  // 2024-05-13 is a Monday, so 13..19 May is one Monday-to-Sunday week and 13..20 May adds a second Monday.
  // MIN_EPOCH_DAY (-271821-04-19) is a Monday, so MIN_EPOCH_DAY - 1 is the Sunday before Temporal's range.
  it.each`
    first                      | last                       | weekday | n     | expected                   | description
    ${epochDayOf(2024, 5, 13)} | ${epochDayOf(2024, 5, 19)} | ${7}    | ${1}  | ${epochDayOf(2024, 5, 19)} | ${"first Sunday of a Monday-to-Sunday week is its last day"}
    ${epochDayOf(2024, 5, 13)} | ${epochDayOf(2024, 5, 19)} | ${1}    | ${2}  | ${null}                    | ${"a seven-day range holds only one Monday"}
    ${epochDayOf(2024, 5, 13)} | ${epochDayOf(2024, 5, 20)} | ${1}    | ${2}  | ${epochDayOf(2024, 5, 20)} | ${"second Monday is the last day of an eight-day range"}
    ${epochDayOf(2024, 5, 13)} | ${epochDayOf(2024, 5, 20)} | ${1}    | ${-2} | ${epochDayOf(2024, 5, 13)} | ${"second Monday from the end is the first day of an eight-day range"}
    ${epochDayOf(2024, 5, 14)} | ${epochDayOf(2024, 5, 13)} | ${1}    | ${-1} | ${null}                    | ${"an empty range (first after last) holds nothing"}
    ${epochDayOf(2024, 5, 14)} | ${epochDayOf(2024, 5, 13)} | ${2}    | ${1}  | ${null}                    | ${"an empty range holds nothing, counted from the start"}
    ${MIN_EPOCH_DAY - 3}       | ${MIN_EPOCH_DAY + 10}      | ${1}    | ${1}  | ${MIN_EPOCH_DAY}           | ${"the first Monday is the first Temporal date"}
    ${MIN_EPOCH_DAY - 3}       | ${MIN_EPOCH_DAY + 10}      | ${7}    | ${1}  | ${null}                    | ${"the Sunday before Temporal's minimum is out of range"}
    ${MIN_EPOCH_DAY - 3}       | ${MIN_EPOCH_DAY + 10}      | ${1}    | ${-2} | ${MIN_EPOCH_DAY}           | ${"second Monday from the end is the first Temporal date"}
    ${MIN_EPOCH_DAY - 3}       | ${MIN_EPOCH_DAY + 10}      | ${1}    | ${-3} | ${null}                    | ${"third Monday from the end is a week before Temporal's minimum"}
  `("$description", ({ first, last, weekday, n, expected }) => {
    expect(nthWeekdayInRange(first, last, weekday, n)).toBe(expected);
  });
});

describe("nthWeekdayWithin", () => {
  // April -271821 starts the Temporal range: Apr 19 is a Monday, so Apr 5, 12, 19 and 26 are the Mondays.
  // 2021-01 has four Mondays (4, 11, 18, 25); 2021-03 has five (1, 8, 15, 22, 29).
  it.each`
    first                     | last                       | weekday | n     | expected                  | description
    ${MIN_EPOCH_DAY - 14}     | ${MIN_EPOCH_DAY + 11}      | ${1}    | ${1}  | ${MIN_EPOCH_DAY - 14}     | ${"counts a day before the Temporal minimum (first Monday, Apr 5)"}
    ${MIN_EPOCH_DAY - 14}     | ${MIN_EPOCH_DAY + 11}      | ${1}    | ${4}  | ${MIN_EPOCH_DAY + 7}      | ${"the 4th Monday counts the three before the minimum (Apr 26)"}
    ${MAX_EPOCH_DAY - 12}     | ${MAX_EPOCH_DAY + 17}      | ${1}    | ${-1} | ${MAX_EPOCH_DAY + 16}     | ${"counts a day after the Temporal maximum (last Monday, Sep 29)"}
    ${epochDayOf(2021, 1, 1)} | ${epochDayOf(2021, 1, 31)} | ${1}    | ${-5} | ${null}                   | ${"-5 in a month with four Mondays does not exist"}
    ${epochDayOf(2021, 1, 1)} | ${epochDayOf(2021, 1, 31)} | ${1}    | ${5}  | ${null}                   | ${"5 in a month with four Mondays does not exist"}
    ${epochDayOf(2021, 3, 1)} | ${epochDayOf(2021, 3, 31)} | ${1}    | ${-5} | ${epochDayOf(2021, 3, 1)} | ${"-5 in a month with five Mondays is the first"}
  `("$description", ({ first, last, weekday, n, expected }) => {
    expect(nthWeekdayWithin(first, last, weekday, n)).toBe(expected);
  });

  it("nthWeekdayInRange still returns null where nthWeekdayWithin counts past the range", () => {
    expect(
      nthWeekdayInRange(MIN_EPOCH_DAY - 14, MIN_EPOCH_DAY + 11, 1, 1),
    ).toBeNull();
  });
});
