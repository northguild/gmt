/**
 * Required-locale contract: a function whose `locale` parameter is required reads locale data
 * (week start, weekend, names) that differs by locale, so an omitted locale is the sentinel rather
 * than the host default. An empty preference list names no locale either: ECMA-402 would resolve
 * `[]` to the host default locale (ResolveLocale), which would bring back exactly the host
 * dependency the required parameter rules out, so the house rule (determinism) treats `[]` as
 * omitted → sentinel. Functions whose locale is optional keep ECMA-402's `[]` = default.
 */
import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatTimeZoneName,
  getLocaleDayOfWeek,
  getLocaleEndOfWeek,
  getLocaleEraNames,
  getLocaleMeridiems,
  getLocaleMonthNames,
  getLocaleStartOfWeek,
  getLocaleWeekdayNames,
  getLocaleWeekYear,
  getLocaleZonedDayOfWeek,
  getLocaleZonedEndOfWeek,
  getLocaleZonedStartOfWeek,
  getWeekOfMonth,
  getWeeksInLocaleWeekYear,
  getWeeksInMonth,
  isWeekend,
  isZonedWeekend,
} from "../index";

type LocaleCall = (locale: unknown) => unknown;

describe("required locale: omitted or an empty list → sentinel", () => {
  it.each`
    name                           | call                                                                                 | valid                                         | sentinel
    ${"getLocaleStartOfWeek"}      | ${(l: never) => getLocaleStartOfWeek("2024-02-29", l)}                               | ${"2024-02-25"}                               | ${""}
    ${"getLocaleEndOfWeek"}        | ${(l: never) => getLocaleEndOfWeek("2024-02-29", l)}                                 | ${"2024-03-02"}                               | ${""}
    ${"getLocaleDayOfWeek"}        | ${(l: never) => getLocaleDayOfWeek("2024-02-25", l)}                                 | ${0}                                          | ${null}
    ${"getLocaleWeekYear"}         | ${(l: never) => getLocaleWeekYear("2024-06-15", l)}                                  | ${2024}                                       | ${null}
    ${"getWeeksInLocaleWeekYear"}  | ${(l: never) => getWeeksInLocaleWeekYear("2024-06-15", l)}                           | ${52}                                         | ${null}
    ${"getWeekOfMonth"}            | ${(l: never) => getWeekOfMonth("2024-02-01", l)}                                     | ${1}                                          | ${null}
    ${"getWeeksInMonth"}           | ${(l: never) => getWeeksInMonth("2024-02-15", l)}                                    | ${5}                                          | ${null}
    ${"isWeekend"}                 | ${(l: never) => isWeekend("2024-02-03", l)}                                          | ${true}                                       | ${false}
    ${"getLocaleEraNames"}         | ${(l: never) => getLocaleEraNames(l)}                                                | ${["Before Christ", "Anno Domini"]}           | ${[]}
    ${"getLocaleMeridiems"}        | ${(l: never) => getLocaleMeridiems(l)}                                               | ${["AM", "PM"]}                               | ${[]}
    ${"getLocaleMonthNames"}       | ${(l: never) => getLocaleMonthNames(l, "short").slice(0, 2)}                         | ${["Jan", "Feb"]}                             | ${[]}
    ${"getLocaleWeekdayNames"}     | ${(l: never) => getLocaleWeekdayNames(l, "short").slice(0, 2)}                       | ${["Sun", "Mon"]}                             | ${[]}
    ${"getLocaleZonedDayOfWeek"}   | ${(l: never) => getLocaleZonedDayOfWeek("2024-02-25T12:00:00+00:00[UTC]", l)}        | ${0}                                          | ${null}
    ${"getLocaleZonedStartOfWeek"} | ${(l: never) => getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", l)}      | ${"2024-02-25T00:00:00+00:00[UTC]"}           | ${""}
    ${"getLocaleZonedEndOfWeek"}   | ${(l: never) => getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", l)}        | ${"2024-03-02T23:59:59.999999999+00:00[UTC]"} | ${""}
    ${"isZonedWeekend"}            | ${(l: never) => isZonedWeekend("2024-02-03T10:00:00-05:00[America/New_York]", l)}    | ${true}                                       | ${false}
    ${"formatTimeZoneName"}        | ${(l: never) => formatTimeZoneName("America/New_York", l, { style: "longGeneric" })} | ${"Eastern Time"}                             | ${""}
  `(
    "$name: 'en-US' and ['en-US'] give $valid; omitted and [] give $sentinel",
    ({ call, valid, sentinel }) => {
      const run = call as LocaleCall;
      expect({
        tag: run("en-US"),
        list: run(["en-US"]),
        omitted: run(undefined),
        empty: run([]),
      }).toEqual({
        tag: valid,
        list: valid,
        omitted: sentinel,
        empty: sentinel,
      });
    },
  );
});

describe("optional locale: an empty list is the default locale (ECMA-402)", () => {
  it("formatDate(value, []) equals formatDate(value) with the locale omitted", () => {
    expect(formatDate("2024-02-03", [])).toBe(formatDate("2024-02-03"));
  });
});
