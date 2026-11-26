import { formatCalendar } from "../plain/format/formatCalendar";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { hostDateText, hostRangeText, hostText } from "../test/hostIntl";
import { normalizeDateTime } from "./normalizeDateTime";
import { cachedFormatter } from "./formatterCache";
import { Temporal } from "./temporal";
import { utcMs } from "../test/utcMs";
import { isIslamicEraCompatNeeded } from "./temporalCompat/capabilities";
import { calendarFieldsOf } from "./temporalCompat";

/*
 * CORE-112, D30: `islamic` and `islamic-rgsa` resolve to calendars no engine should use.
 *
 * Intl era/monthCode CreateDateTimeFormat: a resolved `islamic` becomes `islamic-tbla`. Since
 * tc39/proposal-intl-era-monthcode#99 `islamic-rgsa` is not an available calendar, so a
 * DateTimeFormat ignores it and takes the locale's default calendar (test262
 * `intl402/DateTimeFormat/constructor-options-calendar-islamic-fallback.js`). Each value holds on
 * an engine that has the defect and on one that does not. The date is the calendar's value: the
 * day and the year are asserted exactly (`islamicTbla`), and the month name, the era and the
 * separators come from the host's own `islamic-tbla` text, which is its wording.
 */

/**
 * The day and the year `islamic-tbla` gives a date, the values of Table 1 of the calendar, read
 * through GMT's calendar-field read: on WebKit the polyfill reads 1 Muharram of year 1 as year 0
 * (D18), and GMT corrects it there.
 */
function islamicTbla(iso: string, locale = "en-u-ca-islamic-tbla") {
  const date = calendarFieldsOf(Temporal.PlainDate.from(iso), "islamic-tbla");
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(utcMs(`${iso}T00:00:00Z`));
  return {
    day: date.day,
    year: date.year,
    hostDay: Number(parts.find((part) => part.type === "day")?.value),
    hostYear: Number(
      parts.find((part) =>
        (["relatedYear", "year"] as string[]).includes(part.type),
      )?.value,
    ),
  };
}

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

  it("takes the date islamic-tbla gives for 2024-07-10: day 4 of 1446 (ICU's astronomical calendar gives day 5)", () => {
    expect(islamicTbla("2024-07-10")).toEqual({
      day: 4,
      year: 1446,
      hostDay: 4,
      hostYear: 1446,
    });
    expect(formatDate("2024-07-10", "en-u-ca-islamic", eraDate)).toBe(
      hostDateText("en-u-ca-islamic-tbla", eraDate, "2024-07-10"),
    );
  });

  it("takes the Hijra of islamic-tbla (Table 1: 0622-07-18) for '0622-07-17': the day before is before the Hijra", () => {
    const text = formatDate("0622-07-17", "en-u-ca-islamic", eraDate);
    // D26: the empty value where the engine cannot name `bh`, and otherwise the engine's own text,
    // which is not the 1 AH of the next day.
    if (isIslamicEraCompatNeeded()) {
      expect(text).toBe("");
    } else {
      expect(text).not.toBe("");
      expect(text).not.toMatch(/\bAH\b/);
    }
  });

  it("takes the Hijra of islamic-tbla (Table 1: 0622-07-18) for '0622-07-18': day 1 of year 1", () => {
    expect(islamicTbla("0622-07-18")).toMatchObject({ day: 1, year: 1 });
    // Some hosts (WebKit) place the Hijra a day early and print "0 Before Hijra", so the host's
    // text for the day itself is not the value. The wording (month name, era, separators) is taken
    // from the host's text for day 3 of the same year, and the day is the calendar's value, 1.
    const sameYear = new Intl.DateTimeFormat("en-u-ca-islamic-tbla", {
      ...eraDate,
      timeZone: "UTC",
    })
      .formatToParts(utcMs("0622-07-20T00:00:00Z"))
      .map((part) => (part.type === "day" ? "1" : part.value))
      .join("");
    expect(formatDate("0622-07-18", "en-u-ca-islamic", eraDate)).toBe(
      normalizeDateTime(sameYear),
    );
  });
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
  const tbla = "en-u-ca-islamic-tbla";
  const noon = "2024-07-10T12:00:00+00:00[UTC]";
  const nonNoon = "2024-07-12T12:00:00+00:00[UTC]";
  it.each`
    label                       | call                                                                                                                                      | host
    ${"formatDate keyword"}     | ${() => formatDate("2024-07-10", "en-u-ca-islamic", { dateStyle: "long" })}                                                               | ${() => hostText(tbla, { dateStyle: "long" }, noon)}
    ${"formatDate option"}      | ${() => formatDate("2024-07-10", "en", { calendar: "islamic", dateStyle: "long" })}                                                       | ${() => hostText(tbla, { dateStyle: "long" }, noon)}
    ${"formatDateTime keyword"} | ${() => formatDateTime("2024-07-10T12:00:00", "en-u-ca-islamic", { dateStyle: "long", timeStyle: "short" })}                              | ${() => hostText(tbla, { dateStyle: "long", timeStyle: "short" }, noon)}
    ${"formatCalendar keyword"} | ${() => formatCalendar("2024-07-10T12:00:00", "en-u-ca-islamic", { reference: "2024-09-01T12:00:00" })}                                   | ${() => hostText(tbla, { dateStyle: "long", timeStyle: "short" }, noon)}
    ${"formatDateRange"}        | ${() => formatDateRange("2024-07-10", "2024-07-12", "en-u-ca-islamic", { dateStyle: "medium" })}                                          | ${() => hostRangeText(tbla, { dateStyle: "medium" }, noon, nonNoon)}
    ${"formatZonedRange"}       | ${() => formatZonedRange("2024-07-10T12:00:00+00:00[UTC]", "2024-07-12T12:00:00+00:00[UTC]", "en-u-ca-islamic", { dateStyle: "medium" })} | ${() => hostRangeText(tbla, { dateStyle: "medium" }, noon, nonNoon)}
  `("$label gives the host's islamic-tbla text", ({ call, host }) => {
    expect(call()).toBe(host());
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
