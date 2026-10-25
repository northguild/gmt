import { Temporal } from "../../internal/temporal";
import { nthWeekdayOfMonth } from "./nthWeekdayOfMonth";

// Counted by hand from the calendar and checked against PlainDate#dayOfWeek:
// March 2026 starts on a Sunday (Sundays 1, 8, 15, 22, 29); January 2026 on a Thursday.
describe("nthWeekdayOfMonth", () => {
  it.each`
    year        | month | weekday | n         | expected           | why
    ${2026}     | ${3}  | ${7}    | ${"last"} | ${"2026-03-29"}    | ${"last Sunday of March"}
    ${2026}     | ${1}  | ${1}    | ${3}      | ${"2026-01-19"}    | ${"third Monday of January"}
    ${2026}     | ${5}  | ${1}    | ${"last"} | ${"2026-05-25"}    | ${"last Monday of May"}
    ${2026}     | ${2}  | ${5}    | ${5}      | ${""}              | ${"February 2026 has four Fridays (6, 13, 20, 27)"}
    ${2026}     | ${1}  | ${5}    | ${5}      | ${"2026-01-30"}    | ${"January 2026 has five Fridays"}
    ${2026}     | ${1}  | ${5}    | ${-5}     | ${"2026-01-02"}    | ${"fifth from the end is the first Friday"}
    ${2026}     | ${3}  | ${7}    | ${-1}     | ${"2026-03-29"}    | ${"-1 equals last"}
    ${2026}     | ${3}  | ${7}    | ${-2}     | ${"2026-03-22"}    | ${"second-to-last Sunday"}
    ${2024}     | ${2}  | ${4}    | ${5}      | ${"2024-02-29"}    | ${"leap February fifth Thursday"}
    ${2026}     | ${10} | ${7}    | ${"last"} | ${"2026-10-25"}    | ${"last Sunday of October"}
    ${2026}     | ${3}  | ${3}    | ${3}      | ${"2026-03-18"}    | ${"third Wednesday of March"}
    ${2026}     | ${6}  | ${3}    | ${3}      | ${"2026-06-17"}    | ${"third Wednesday of June"}
    ${2026}     | ${9}  | ${3}    | ${3}      | ${"2026-09-16"}    | ${"third Wednesday of September"}
    ${2026}     | ${12} | ${3}    | ${3}      | ${"2026-12-16"}    | ${"third Wednesday of December"}
    ${-271_821} | ${4}  | ${1}    | ${3}      | ${"-271821-04-19"} | ${"first in-range day, a Monday"}
    ${-271_821} | ${4}  | ${1}    | ${1}      | ${""}              | ${"5 April -271821 is before the minimum"}
    ${275_760}  | ${9}  | ${6}    | ${2}      | ${"+275760-09-13"} | ${"last in-range day, a Saturday"}
    ${275_760}  | ${9}  | ${7}    | ${"last"} | ${""}              | ${"28 September +275760 is past the maximum"}
    ${275_761}  | ${1}  | ${1}    | ${1}      | ${""}              | ${"whole month out of range"}
    ${275_760}  | ${12} | ${1}    | ${1}      | ${""}              | ${"December of the maximum year is out of range"}
    ${-271_822} | ${12} | ${1}    | ${-1}     | ${""}              | ${"whole month before the minimum"}
    ${1900}     | ${2}  | ${3}    | ${4}      | ${"1900-02-28"}    | ${"century common year, February has 28 days"}
    ${2100}     | ${2}  | ${7}    | ${-1}     | ${"2100-02-28"}    | ${"century common year, last Sunday"}
    ${0}        | ${1}  | ${6}    | ${1}      | ${"0000-01-01"}    | ${"year 0, padded to four digits"}
    ${-1}       | ${12} | ${2}    | ${-1}     | ${"-000001-12-28"} | ${"negative year uses the six-digit form"}
    ${10_000}   | ${1}  | ${6}    | ${1}      | ${"+010000-01-01"} | ${"year above 9999 uses the signed six-digit form"}
    ${10_000}   | ${12} | ${3}    | ${-1}     | ${"+010000-12-27"} | ${"December of year 10000, from the end"}
  `(
    "($year, $month, $weekday, $n) gives '$expected': $why",
    ({ year, month, weekday, n, expected }) => {
      expect(nthWeekdayOfMonth(year, month, weekday, n)).toBe(expected);
    },
  );

  it("treats -1 and 'last' as the same occurrence for every weekday", () => {
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      expect(nthWeekdayOfMonth(2026, 3, weekday, "last")).toBe(
        nthWeekdayOfMonth(2026, 3, weekday, -1),
      );
    }
  });

  it("returns a date whose PlainDate weekday is the one asked for", () => {
    const result = nthWeekdayOfMonth(2026, 3, 7, "last");
    expect(Temporal.PlainDate.from(result).dayOfWeek).toBe(7);
  });

  it.each`
    year                 | month  | weekday | n            | why
    ${2026}              | ${0}   | ${1}    | ${1}         | ${"month 0"}
    ${2026}              | ${13}  | ${1}    | ${1}         | ${"month 13"}
    ${2026}              | ${1.5} | ${1}    | ${1}         | ${"fractional month"}
    ${2026}              | ${NaN} | ${1}    | ${1}         | ${"NaN month"}
    ${2026}              | ${"3"} | ${1}    | ${1}         | ${"string month"}
    ${2026}              | ${3}   | ${0}    | ${1}         | ${"weekday 0"}
    ${2026}              | ${3}   | ${8}    | ${1}         | ${"weekday 8"}
    ${2026}              | ${3}   | ${2.5}  | ${1}         | ${"fractional weekday"}
    ${2026.5}            | ${3}   | ${1}    | ${1}         | ${"fractional year"}
    ${NaN}               | ${3}   | ${1}    | ${1}         | ${"NaN year"}
    ${Infinity}          | ${3}   | ${1}    | ${1}         | ${"infinite year"}
    ${"2026"}            | ${3}   | ${1}    | ${1}         | ${"string year"}
    ${1e306}             | ${3}   | ${7}    | ${"last"}    | ${"year whose epoch day overflows to Infinity"}
    ${-1e306}            | ${3}   | ${7}    | ${"last"}    | ${"negative year whose epoch day overflows"}
    ${Number.MAX_VALUE}  | ${3}   | ${7}    | ${1}         | ${"Number.MAX_VALUE year"}
    ${-Number.MAX_VALUE} | ${3}   | ${7}    | ${-1}        | ${"-Number.MAX_VALUE year"}
    ${2026}              | ${3}   | ${1}    | ${0}         | ${"n 0"}
    ${2026}              | ${3}   | ${1}    | ${6}         | ${"n 6"}
    ${2026}              | ${3}   | ${1}    | ${-6}        | ${"n -6"}
    ${2026}              | ${3}   | ${1}    | ${1.5}       | ${"fractional n"}
    ${2026}              | ${3}   | ${1}    | ${"first"}   | ${"n 'first'"}
    ${2026}              | ${3}   | ${1}    | ${"Last"}    | ${"n 'Last'"}
    ${2026}              | ${3}   | ${1}    | ${undefined} | ${"n undefined"}
    ${2026}              | ${3}   | ${1}    | ${null}      | ${"n null"}
    ${2026}              | ${3}   | ${1}    | ${NaN}       | ${"n NaN"}
    ${2026}              | ${3}   | ${NaN}  | ${1}         | ${"NaN weekday"}
    ${2026}              | ${3}   | ${"1"}  | ${1}         | ${"string weekday"}
    ${2026}              | ${3}   | ${1}    | ${"1"}       | ${"string n"}
    ${2026}              | ${3}   | ${1}    | ${[1]}       | ${"array n"}
  `("returns an empty string for $why", ({ year, month, weekday, n }) => {
    expect(nthWeekdayOfMonth(year, month, weekday, n)).toBe("");
  });
});
