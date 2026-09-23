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
  parseDateTimeWithPattern,
  parseDateWithPattern,
  parseTimeWithPattern,
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

/**
 * The three pattern parsers take an optional `locale`, but their documented default is the fixed
 * tag `"en-US"`, not the host default: a name-based token (`MMM`, `a`, …) has to resolve against
 * *some* locale, and a decoder of a fixed producer format must not change meaning with the host.
 * An empty preference list names no locale, so it is the omitted case and takes that same default
 * — it must not fall through to ECMA-402's ResolveLocale, which would return the host locale.
 *
 * `"Mar"` is the en-US short month name for March and `"PM"` its post-meridiem name (CLDR, via
 * Intl.DateTimeFormat in Chromium 153); a French host spells the month `"mars"` and a Japanese one
 * writes `"午後"` for PM, so under either host the `[]` rows returned `""` before this contract held.
 */
describe("optional locale with a documented default: [] is that default, not the host", () => {
  it.each`
    name                          | call                                                                                        | expected
    ${"parseDateWithPattern"}     | ${(l: never) => parseDateWithPattern("15-Mar-2024", "dd-MMM-yyyy", l)}                      | ${"2024-03-15"}
    ${"parseDateTimeWithPattern"} | ${(l: never) => parseDateTimeWithPattern("15-Mar-2024 02:30 PM", "dd-MMM-yyyy hh:mm a", l)} | ${"2024-03-15T14:30:00"}
    ${"parseTimeWithPattern"}     | ${(l: never) => parseTimeWithPattern("02:30:45 PM", "hh:mm:ss a", l)}                       | ${"14:30:45"}
  `(
    "$name: 'en-US', ['en-US'], omitted and [] all give $expected on any host",
    ({ call, expected }) => {
      const run = call as LocaleCall;
      expect({
        tag: run("en-US"),
        list: run(["en-US"]),
        omitted: run(undefined),
        empty: run([]),
      }).toEqual({
        tag: expected,
        list: expected,
        omitted: expected,
        empty: expected,
      });
    },
  );
});
