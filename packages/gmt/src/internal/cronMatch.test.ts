import { describe, expect, it } from "vitest";
import { epochDayOf, isoDateString, MAX_EPOCH_DAY } from "./epochDay";
import type { CronExpression, CronField } from "../types/cron";
import { parseCronExpression } from "../recurrence/parse/parseCronExpression";
import { cronDayMatches, nextCronDay } from "./cronMatch";

function cron(text: string): CronExpression {
  const parsed = parseCronExpression(text);
  if (parsed === null) throw new Error(`test cron ${text} did not parse`);
  return parsed;
}

const day = (year: number, month: number, date: number) =>
  epochDayOf(year, month, date);

function matchingDays(text: string, from: number, through: number): string[] {
  const expression = cron(text);
  const found: string[] = [];
  let at = from;
  for (;;) {
    const next = nextCronDay(expression, at);
    if (next === null || next > through) return found;
    found.push(isoDateString(next));
    at = next + 1;
  }
}

describe("cronDayMatches", () => {
  // Rule: crontab(5) NOTES: both day fields restricted means either one matching is enough
  // ("30 4 1,15 * 5": the 1st, the 15th and every Friday). Otherwise both must match.
  // 2024-03-01 is a Friday, 2024-03-15 a Friday, 2024-03-02 a Saturday, 2024-03-08 a Friday.
  it.each`
    expression         | date             | expected | why
    ${"30 4 1,15 * 5"} | ${[2024, 3, 1]}  | ${true}  | ${"the 1st (and a Friday)"}
    ${"30 4 1,15 * 5"} | ${[2024, 3, 8]}  | ${true}  | ${"a Friday that is not the 1st or 15th"}
    ${"30 4 1,15 * 5"} | ${[2024, 3, 15]} | ${true}  | ${"the 15th"}
    ${"30 4 1,15 * 5"} | ${[2024, 6, 15]} | ${true}  | ${"the 15th, a Saturday"}
    ${"30 4 1,15 * 5"} | ${[2024, 3, 9]}  | ${false} | ${"a Saturday, not the 1st or 15th"}
    ${"0 0 * 1 1"}     | ${[2024, 1, 8]}  | ${true}  | ${"dayOfMonth is star so ANDed: Monday in January"}
    ${"0 0 * 1 1"}     | ${[2024, 1, 9]}  | ${false} | ${"a Tuesday in January"}
    ${"0 0 * 1 1"}     | ${[2024, 2, 5]}  | ${false} | ${"a Monday in February (month is ANDed)"}
    ${"0 0 */2 * 1"}   | ${[2024, 1, 1]}  | ${true}  | ${"*/2 is a star so ANDed: Monday the 1st"}
    ${"0 0 */2 * 1"}   | ${[2024, 1, 8]}  | ${false} | ${"Monday the 8th is an even day"}
    ${"0 0 1,15 * 1"}  | ${[2024, 1, 8]}  | ${true}  | ${"restricted both: any Monday"}
    ${"0 0 1,15 1 *"}  | ${[2024, 1, 15]} | ${true}  | ${"dayOfWeek star: the 15th in January"}
    ${"0 0 1,15 1 *"}  | ${[2024, 2, 15]} | ${false} | ${"month is ANDed"}
    ${"@weekly"}       | ${[2024, 1, 7]}  | ${true}  | ${"Sunday = 7"}
    ${"@weekly"}       | ${[2024, 1, 8]}  | ${false} | ${"Monday"}
    ${"@monthly"}      | ${[2024, 6, 1]}  | ${true}  | ${"the 1st, a Saturday"}
    ${"@monthly"}      | ${[2024, 9, 1]}  | ${true}  | ${"the 1st, a Sunday"}
    ${"@monthly"}      | ${[2024, 9, 8]}  | ${false} | ${"a Sunday that is not the 1st: dayOfWeek is star so ANDed"}
    ${"0 0 30 2 *"}    | ${[2024, 2, 29]} | ${false} | ${"February has no 30th"}
  `(
    "$expression on $date is $expected: $why",
    ({ expression, date, expected }) => {
      expect(
        cronDayMatches(
          cron(expression),
          day(...(date as [number, number, number])),
        ),
      ).toBe(expected);
    },
  );

  it("reads dayOfWeek values as IsoWeekday directly, with Sunday as 7", () => {
    const sundays: CronField = { values: [7], star: false };
    const expression: CronExpression = {
      ...cron("0 0 * * *"),
      dayOfWeek: sundays,
    };
    expect(cronDayMatches(expression, day(2024, 1, 7))).toBe(true);
    expect(cronDayMatches(expression, day(2024, 1, 1))).toBe(false);
  });
});

describe("nextCronDay", () => {
  it.each`
    expression      | from            | expected
    ${"0 0 * * *"}  | ${[2024, 5, 5]} | ${"2024-05-05"}
    ${"0 0 29 2 *"} | ${[2024, 3, 1]} | ${"2028-02-29"}
    ${"0 0 29 2 *"} | ${[2096, 3, 1]} | ${"2104-02-29"}
    ${"0 0 * 1 1"}  | ${[2024, 2, 1]} | ${"2025-01-06"}
    ${"0 0 31 * *"} | ${[2024, 2, 1]} | ${"2024-03-31"}
    ${"0 0 31 4 *"} | ${[2024, 1, 1]} | ${null}
    ${"0 0 30 2 *"} | ${[2024, 1, 1]} | ${null}
  `("$expression from $from is $expected", ({ expression, from, expected }) => {
    const found = nextCronDay(
      cron(expression),
      day(...(from as [number, number, number])),
    );
    expect(found === null ? null : isoDateString(found)).toBe(expected);
  });

  it("lists the Mondays of January 2024 for 0 0 * 1 1", () => {
    expect(
      matchingDays("0 0 * 1 1", day(2024, 1, 1), day(2024, 2, 28)),
    ).toEqual([
      "2024-01-01",
      "2024-01-08",
      "2024-01-15",
      "2024-01-22",
      "2024-01-29",
    ]);
  });

  // crontab(5) NOTES example `30 4 1,15 * 5` over February 2024: Fridays 2, 9, 16, 23 and the 1st, 15th.
  it("lists 1,15 or Friday for 30 4 1,15 * 5 over February 2024", () => {
    expect(
      matchingDays("30 4 1,15 * 5", day(2024, 2, 1), day(2024, 2, 29)),
    ).toEqual([
      "2024-02-01",
      "2024-02-02",
      "2024-02-09",
      "2024-02-15",
      "2024-02-16",
      "2024-02-23",
    ]);
  });

  it("scans 146,097 days and no more for an expression that never matches", () => {
    // 0 0 30 2 * never matches; the scan is bounded, and a far start also ends.
    expect(nextCronDay(cron("0 0 30 2 *"), 0)).toBeNull();
  });

  it.each`
    expression       | from            | last              | expected
    ${"0 0 29 2 *"}  | ${[2024, 3, 1]} | ${[2028, 2, 28]}  | ${null}
    ${"0 0 29 2 *"}  | ${[2024, 3, 1]} | ${[2028, 2, 29]}  | ${"2028-02-29"}
    ${"0 0 * 12 *"}  | ${[2024, 1, 1]} | ${[2024, 11, 30]} | ${null}
    ${"0 0 * 12 *"}  | ${[2024, 1, 1]} | ${[2024, 12, 1]}  | ${"2024-12-01"}
    ${"0 0 * 3,9 *"} | ${[2024, 4, 1]} | ${[2024, 9, 1]}   | ${"2024-09-01"}
    ${"0 0 * 3,9 *"} | ${[2024, 4, 1]} | ${[2024, 8, 31]}  | ${null}
  `(
    "$expression from $from stops at the caller's last day $last: $expected",
    ({ expression, from, last, expected }) => {
      const found = nextCronDay(
        cron(expression),
        day(...(from as [number, number, number])),
        day(...(last as [number, number, number])),
      );
      expect(found === null ? null : isoDateString(found)).toBe(expected);
    },
  );

  it("returns null once the scan passes the last epoch day", () => {
    expect(nextCronDay(cron("0 0 * * *"), MAX_EPOCH_DAY + 1)).toBeNull();
    expect(nextCronDay(cron("0 0 * * *"), MAX_EPOCH_DAY)).toBe(MAX_EPOCH_DAY);
  });
});
