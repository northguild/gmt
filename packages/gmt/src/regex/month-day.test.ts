import { Temporal } from "../internal/temporal";
import { plainMonthDay } from "./month-day";

// The grammar's IsValidMonthDay early error: a string passes only when its day exists in at
// least one year. 1972 is Temporal's reference year, a leap year, so it has all 366 month-days.
const MONTH_DAYS_OF_1972: string[] = Array.from({ length: 366 }, (_, n) =>
  Temporal.PlainDate.from("1972-01-01").add({ days: n }).toString().slice(5),
);

describe("regex/month-day", () => {
  it.each`
    value        | why
    ${"--12-25"} | ${"DateSpecMonthDay"}
    ${"12-25"}   | ${"the leading -- is optional"}
    ${"--02-29"} | ${"exists in the 1972 reference year"}
    ${"02-29"}   | ${"29 February without the dashes"}
    ${"--01-31"} | ${"last day of a 31-day month"}
    ${"--04-30"} | ${"last day of a 30-day month"}
    ${"--12-01"} | ${"first day"}
    ${"--01-01"} | ${"first month-day"}
    ${"--12-31"} | ${"last month-day"}
  `("matches '$value' ($why)", ({ value }: { value: string }) => {
    expect(plainMonthDay.test(value)).toBe(true);
  });

  it.each`
    value                      | why
    ${"--02-30"}               | ${"IsValidMonthDay: February has no 30th"}
    ${"--02-31"}               | ${"IsValidMonthDay: February has no 31st"}
    ${"--04-31"}               | ${"IsValidMonthDay: April has 30 days"}
    ${"--06-31"}               | ${"IsValidMonthDay: June has 30 days"}
    ${"--09-31"}               | ${"IsValidMonthDay: September has 30 days"}
    ${"--11-31"}               | ${"IsValidMonthDay: November has 30 days"}
    ${"--00-10"}               | ${"month zero"}
    ${"--13-01"}               | ${"month 13"}
    ${"--12-00"}               | ${"day zero"}
    ${"--12-32"}               | ${"day 32"}
    ${"--1225"}                | ${"basic form"}
    ${"1225"}                  | ${"basic form without the dashes"}
    ${"--12"}                  | ${"no day"}
    ${"12"}                    | ${"no day, no dashes"}
    ${"2024-12-25"}            | ${"a full date"}
    ${"2024-12"}               | ${"a year-month"}
    ${"--12-25T10:00"}         | ${"a time"}
    ${"--12-25Z"}              | ${"a UTC designator"}
    ${"--12-25+01:00"}         | ${"an offset"}
    ${"--12-25[u-ca=iso8601]"} | ${"the regex is the unannotated part only"}
    ${" --12-25"}              | ${"leading space"}
    ${"--12-25 "}              | ${"trailing space"}
    ${"--12-25\n"}             | ${"trailing newline"}
    ${"−−12-25"}               | ${"U+2212 minus signs"}
    ${"--１２-２５"}           | ${"full-width digits"}
    ${"---12-25"}              | ${"three dashes"}
    ${"-12-25"}                | ${"one dash"}
    ${"--1-5"}                 | ${"unpadded"}
    ${""}                      | ${"empty"}
  `("rejects '$value' ($why)", ({ value }: { value: string }) => {
    expect(plainMonthDay.test(value)).toBe(false);
  });

  it.each(MONTH_DAYS_OF_1972)("matches the 1972 month-day '--%s'", (md) => {
    expect(plainMonthDay.test(`--${md}`)).toBe(true);
    expect(plainMonthDay.test(md)).toBe(true);
  });

  it("matches exactly 366 of the 12 * 31 month-day shapes", () => {
    let count = 0;
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 31; day += 1) {
        const text = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (plainMonthDay.test(text)) count += 1;
      }
    }
    expect(count).toBe(366);
  });
});
