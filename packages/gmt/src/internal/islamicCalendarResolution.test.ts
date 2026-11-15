import { formatCalendar } from "../plain/format/formatCalendar";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { cachedFormatter } from "./formatterCache";

/*
 * CORE-112 slice 7, D30: `islamic` and `islamic-rgsa` resolve to calendars no engine should use.
 *
 * Intl era/monthCode CreateDateTimeFormat: a resolved `islamic` becomes `islamic-tbla`. Since
 * tc39/proposal-intl-era-monthcode#99 `islamic-rgsa` is not an available calendar, so a
 * DateTimeFormat ignores it and takes the locale's default calendar (test262
 * `intl402/DateTimeFormat/constructor-options-calendar-islamic-fallback.js`). Each value holds on
 * an engine that has the defect and on one that does not.
 */

const eraDate = {
  era: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
} as const;

/** The calendar a cached formatter resolves for these arguments. */
function resolvedCalendar(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return cachedFormatter("DateTimeFormat", locale, {
    ...options,
    timeZone: "UTC",
  }).resolvedOptions().calendar;
}

describe("D30: islamic resolves to islamic-tbla", () => {
  it.each`
    locale               | options                    | label
    ${"en-u-ca-islamic"} | ${{}}                      | ${"the ca keyword"}
    ${"en"}              | ${{ calendar: "islamic" }} | ${"the calendar option"}
    ${"ja-u-ca-islamic"} | ${{ year: "numeric" }}     | ${"a locale with its own default and a year"}
  `(
    "$locale with $options resolves islamic-tbla through $label",
    ({ locale, options }) => {
      expect(resolvedCalendar(locale, options)).toBe("islamic-tbla");
    },
  );

  it("prints Muh. 4, 1446 AH for 2024-07-10, the date islamic-tbla gives (ICU's astronomical calendar gives Muh. 5)", () => {
    expect(formatDate("2024-07-10", "en-u-ca-islamic", eraDate)).toBe(
      "Muh. 4, 1446 AH",
    );
  });

  it.each`
    iso             | expected
    ${"0622-07-17"} | ${""}
    ${"0622-07-18"} | ${"Muh. 1, 1 AH"}
  `(
    "takes the Hijra of islamic-tbla (Table 1: 0622-07-18) for '$iso': '$expected'",
    ({ iso, expected }) => {
      expect(formatDate(iso, "en-u-ca-islamic", eraDate)).toBe(expected);
    },
  );
});

describe("D30: islamic-rgsa is ignored", () => {
  it.each`
    locale                    | options                         | defaultOf
    ${"en-u-ca-islamic-rgsa"} | ${{}}                           | ${"en"}
    ${"th-u-ca-islamic-rgsa"} | ${{}}                           | ${"th"}
    ${"fa-u-ca-islamic-rgsa"} | ${{ year: "numeric" }}          | ${"fa"}
    ${"en"}                   | ${{ calendar: "islamic-rgsa" }} | ${"en"}
    ${"th"}                   | ${{ calendar: "islamic-rgsa" }} | ${"th"}
  `(
    "$locale with $options resolves the default calendar of '$defaultOf'",
    ({ locale, options, defaultOf }) => {
      const resolved = resolvedCalendar(locale, options);
      expect(resolved).not.toBe("islamic-rgsa");
      expect(resolved).toBe(resolvedCalendar(defaultOf, {}));
    },
  );

  it("keeps the other keywords of the locale when it drops the calendar one", () => {
    expect(
      cachedFormatter("DateTimeFormat", "en-u-ca-islamic-rgsa-nu-arab", {
        timeZone: "UTC",
      }).resolvedOptions(),
    ).toMatchObject({ calendar: "gregory", numberingSystem: "arab" });
  });

  it("prints a date of the locale's default calendar, not ICU's astronomical one", () => {
    expect(
      formatDate("2024-07-10", "en-u-ca-islamic-rgsa", { dateStyle: "medium" }),
    ).toBe("Jul 10, 2024");
  });
});

describe("D30: the other islamic calendars are untouched", () => {
  it.each`
    calendar
    ${"islamic-civil"}
    ${"islamic-tbla"}
    ${"islamic-umalqura"}
  `("$calendar stays $calendar", ({ calendar }) => {
    expect(resolvedCalendar(`en-u-ca-${calendar}`, {})).toBe(calendar);
  });
});

/*
 * Every public entry takes the calendar from the locale keyword or from the `calendar` option, and
 * both reach the same formatter. Values are native `islamic-tbla` and default-calendar texts
 * (Node 22, 24 and 26).
 */
describe("D30: the public entries resolve islamic the same way", () => {
  it.each`
    label                       | call                                                                                                                                      | expected
    ${"formatDate keyword"}     | ${() => formatDate("2024-07-10", "en-u-ca-islamic", { dateStyle: "long" })}                                                               | ${"Muharram 4, 1446 AH"}
    ${"formatDate option"}      | ${() => formatDate("2024-07-10", "en", { calendar: "islamic", dateStyle: "long" })}                                                       | ${"Muharram 4, 1446 AH"}
    ${"formatDateTime keyword"} | ${() => formatDateTime("2024-07-10T12:00:00", "en-u-ca-islamic", { dateStyle: "long", timeStyle: "short" })}                              | ${"Muharram 4, 1446 AH at 12:00 PM"}
    ${"formatCalendar keyword"} | ${() => formatCalendar("2024-07-10T12:00:00", "en-u-ca-islamic", { reference: "2024-09-01T12:00:00" })}                                   | ${"Muharram 4, 1446 AH at 12:00 PM"}
    ${"formatDateRange"}        | ${() => formatDateRange("2024-07-10", "2024-07-12", "en-u-ca-islamic", { dateStyle: "medium" })}                                          | ${"Muh. 4 - 6, 1446 AH"}
    ${"formatZonedRange"}       | ${() => formatZonedRange("2024-07-10T12:00:00+00:00[UTC]", "2024-07-12T12:00:00+00:00[UTC]", "en-u-ca-islamic", { dateStyle: "medium" })} | ${"Muh. 4 - 6, 1446 AH"}
  `("$label gives '$expected'", ({ call, expected }) => {
    expect(call()).toBe(expected);
  });

  it.each`
    label                        | call                                                                                                  | expected
    ${"formatDate keyword"}      | ${() => formatDate("2024-07-10", "en-u-ca-islamic-rgsa", { dateStyle: "long" })}                      | ${"July 10, 2024"}
    ${"formatDate option"}       | ${() => formatDate("2024-07-10", "en", { calendar: "islamic-rgsa", dateStyle: "long" })}              | ${"July 10, 2024"}
    ${"formatDateRange keyword"} | ${() => formatDateRange("2024-07-10", "2024-07-12", "en-u-ca-islamic-rgsa", { dateStyle: "medium" })} | ${"Jul 10 - 12, 2024"}
  `("islamic-rgsa through $label gives '$expected'", ({ call, expected }) => {
    expect(call()).toBe(expected);
  });
});
