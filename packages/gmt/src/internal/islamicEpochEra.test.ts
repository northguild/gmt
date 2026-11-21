import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateTimeToParts } from "../plain/format/formatDateTimeToParts";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatUnix } from "../unix/format/formatUnix";
import { formatUtc } from "../utc/format/formatUtc";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { formatZonedToParts } from "../zoned/format/formatZonedToParts";
import { Temporal } from "./temporal";
import { isIslamicEraCompatNeeded } from "./temporalCompat/capabilities";

/*
 * CORE-112, defect D32: JavaScriptCore chooses the Islamic era from the instant, at one fixed
 * instant (0622-07-19T07:52:58Z, a day earlier for `islamic-tbla`) in every zone, so the first
 * hours of 1 Muharram of year 1 print as year 0 in the era `Before Hijra`, and in a zone west of
 * UTC the last hours of the day before it print as the era `AH`. Intl era/monthCode Table 2 and
 * § 4.1.12 make the Hijra (1 Muharram of year 1) the start of the era `ah`, and the day before it
 * the last day of year 0, the era `bh` year 1. The epoch dates are Calendrical Calculations'
 * (Reingold & Dershowitz, ch. 6): Friday 16 July 622 Julian (ISO 0622-07-19) for the civil
 * calendar, which ICU's umalqura calendar follows outside its table, and Thursday (ISO
 * 0622-07-18) for the astronomical tabular calendar. Every value below holds on an engine that
 * has the defect and on one that does not.
 */

const fields = {
  era: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
} as const;

/** The first day of year 1, and the last day of year 0, of each calendar (ISO dates). */
const epochs = [
  { calendar: "islamic-civil", lastBefore: "0622-07-18", first: "0622-07-19" },
  { calendar: "islamic-tbla", lastBefore: "0622-07-17", first: "0622-07-18" },
  {
    calendar: "islamic-umalqura",
    lastBefore: "0622-07-18",
    first: "0622-07-19",
  },
] as const;

/** The era the engine prints for a date well after the Hijra (`AH`). */
function modernEra(locale: string): string {
  return (
    new Intl.DateTimeFormat(locale, { era: "short", timeZone: "UTC" })
      .formatToParts(
        Temporal.Instant.from("2025-07-10T00:00:00Z").epochMilliseconds,
      )
      .find((part) => part.type === "era")?.value ?? ""
  );
}

type Parts = { type: string; value: string }[];

function valueOf(parts: Parts, type: string): string | undefined {
  return parts.find((part) => part.type === type)?.value;
}

/** The parts of the first day of year 1: 1 Muharram, year 1, the era of a modern date. */
function expectFirstDay(parts: Parts, locale: string): void {
  expect(valueOf(parts, "year")).toBe("1");
  expect(valueOf(parts, "month")).toBe("1");
  expect(valueOf(parts, "day")).toBe("1");
  expect(valueOf(parts, "era")).toBe(modernEra(locale));
}

/**
 * The parts of the last day of year 0: the empty value where the engine has no name for the era
 * (D26), and otherwise 12 Dhu al-Hijjah of the era year 1 (`bh` year n is year 1 - n) in an era
 * other than the modern one.
 */
function expectLastDay(parts: Parts, locale: string, day: string): void {
  if (isIslamicEraCompatNeeded()) {
    expect(parts).toEqual([]);
    return;
  }
  expect(valueOf(parts, "year")).toBe("1");
  expect(valueOf(parts, "month")).toBe("12");
  expect(valueOf(parts, "day")).toBe(day);
  expect(valueOf(parts, "era")).not.toBe(modernEra(locale));
  expect(valueOf(parts, "era")).not.toBe("");
}

/** The ISO text of a wall-clock time in a zone, written as GMT reads a zoned date-time. */
function zoned(wallClock: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(wallClock)
    .toZonedDateTime(timeZone)
    .toString();
}

describe("D32: 1 Muharram of year 1 prints year 1 in the era AH", () => {
  it.each(epochs)(
    "formatDateToParts of '$calendar' prints year 1 AH for $first",
    ({ calendar, first }) => {
      const locale = `en-u-ca-${calendar}`;
      expectFirstDay(formatDateToParts(first, locale, fields), locale);
      expect(formatDate(first, locale, fields)).toBe(
        `1/1/1 ${modernEra(locale)}`,
      );
    },
  );

  it.each(epochs)(
    "formatDateTimeToParts of '$calendar' prints year 1 AH for $first at each hour",
    ({ calendar, first }) => {
      const locale = `en-u-ca-${calendar}`;
      for (const time of ["00:00:00", "07:00:00", "08:00:00", "23:59:59"]) {
        expectFirstDay(
          formatDateTimeToParts(`${first}T${time}`, locale, fields),
          locale,
        );
      }
      expect(formatDateTime(`${first}T00:00:00`, locale, fields)).toBe(
        `1/1/1 ${modernEra(locale)}`,
      );
    },
  );

  it.each(epochs)(
    "formatZonedToParts of '$calendar' in UTC prints year 1 AH for $first at midnight",
    ({ calendar, first }) => {
      const locale = `en-u-ca-${calendar}`;
      expectFirstDay(
        formatZonedToParts(`${first}T00:00:00+00:00[UTC]`, locale, fields),
        locale,
      );
      expect(
        formatZonedDateTime(`${first}T00:00:00+00:00[UTC]`, locale, fields),
      ).toBe(`1/1/1 ${modernEra(locale)}`);
    },
  );

  it.each`
    calendar              | first           | timeZone              | wallClock
    ${"islamic-civil"}    | ${"0622-07-19"} | ${"Pacific/Auckland"} | ${"T00:00:00"}
    ${"islamic-tbla"}     | ${"0622-07-18"} | ${"Pacific/Auckland"} | ${"T00:00:00"}
    ${"islamic-umalqura"} | ${"0622-07-19"} | ${"Asia/Tokyo"}       | ${"T01:30:00"}
    ${"islamic-civil"}    | ${"0622-07-19"} | ${"Pacific/Honolulu"} | ${"T00:00:00"}
    ${"islamic-tbla"}     | ${"0622-07-18"} | ${"Pacific/Honolulu"} | ${"T23:59:59"}
  `(
    "formatZonedToParts of '$calendar' in '$timeZone' prints year 1 AH for local $first $wallClock",
    ({ calendar, first, timeZone, wallClock }) => {
      const locale = `en-u-ca-${calendar}`;
      expectFirstDay(
        formatZonedToParts(
          zoned(`${first}${wallClock}`, timeZone),
          locale,
          fields,
        ),
        locale,
      );
    },
  );

  it.each`
    calendar              | lastBefore      | timeZone              | wallClock      | day
    ${"islamic-civil"}    | ${"0622-07-18"} | ${"Pacific/Honolulu"} | ${"T22:00:00"} | ${"29"}
    ${"islamic-civil"}    | ${"0622-07-18"} | ${"Pacific/Honolulu"} | ${"T12:00:00"} | ${"29"}
    ${"islamic-tbla"}     | ${"0622-07-17"} | ${"Pacific/Honolulu"} | ${"T23:59:59"} | ${"29"}
    ${"islamic-umalqura"} | ${"0622-07-18"} | ${"Pacific/Honolulu"} | ${"T23:00:00"} | ${"29"}
    ${"islamic-civil"}    | ${"0622-07-18"} | ${"Asia/Tokyo"}       | ${"T23:59:59"} | ${"29"}
  `(
    "formatZonedToParts of '$calendar' in '$timeZone' gives the pre-Hijra value for local $lastBefore $wallClock",
    ({ calendar, lastBefore, timeZone, wallClock, day }) => {
      const locale = `en-u-ca-${calendar}`;
      expectLastDay(
        formatZonedToParts(
          zoned(`${lastBefore}${wallClock}`, timeZone),
          locale,
          fields,
        ),
        locale,
        day,
      );
    },
  );

  it.each(epochs)(
    "formatUtc and formatUnix of '$calendar' print year 1 AH at midnight UTC of $first",
    ({ calendar, first }) => {
      const locale = `en-u-ca-${calendar}`;
      const text = `1/1/1 ${modernEra(locale)}`;
      expect(formatUtc(`${first}T00:00:00Z`, locale, fields)).toBe(text);
      expect(
        formatUnix(
          Temporal.Instant.from(`${first}T00:00:00Z`).epochMilliseconds,
          locale,
          { ...fields, epochUnit: "milliseconds" },
        ),
      ).toBe(text);
    },
  );

  it.each`
    locale                                | year
    ${"ar-u-ca-islamic-umalqura-nu-arab"} | ${1}
    ${"th-u-ca-islamic-tbla-nu-thai"}     | ${1}
    ${"en-u-ca-islamic-civil-nu-arab"}    | ${1}
  `(
    "prints the year of '$locale' on the first day as Intl.NumberFormat writes $year",
    ({ locale, year }) => {
      const resolved = new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
      }).resolvedOptions();
      const first =
        resolved.calendar === "islamic-tbla" ? "0622-07-18" : "0622-07-19";
      const expected = new Intl.NumberFormat(
        new Intl.Locale(resolved.locale).baseName,
        { numberingSystem: resolved.numberingSystem, useGrouping: false },
      ).format(year);
      expect(valueOf(formatDateToParts(first, locale, fields), "year")).toBe(
        expected,
      );
    },
  );

  it("prints the 2-digit year 01 for the first day of year 1", () => {
    expect(
      valueOf(
        formatDateToParts("0622-07-19", "en-u-ca-islamic-civil", {
          year: "2-digit",
        }),
        "year",
      ),
    ).toBe("01");
  });

  it("keeps the weekday, month name and time of the first day", () => {
    const options = {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    } as const;
    // Friday 0622-07-19, 1 Muharram: the same text 210 years on (74417 days = 10631 weeks).
    const later = Temporal.PlainDate.from("0622-07-19")
      .add({ days: 74417 })
      .toString();
    const text = (date: string): string =>
      formatDateTime(`${date}T00:30:00`, "en-u-ca-islamic-civil", options);
    expect(text("0622-07-19")).toBe(text(later));
    expect(text("0622-07-19")).toMatch(/^Friday, /);
  });
});

// JavaScriptCore compares the instant, not the date, so in a fixed offset east of +16:07:02 local
// 2 Muharram of year 1 is still before the engine's switch instant. The era is `ah` for every date
// of year 1 (Intl era/monthCode Table 2, 4.1.12).
describe("D32: the second day of year 1 prints year 1 in the era AH in a zone far east", () => {
  const long = {
    era: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  } as const;

  it.each`
    calendar              | wallClock                | offset
    ${"islamic-civil"}    | ${"0622-07-20T00:30:00"} | ${"+20:00"}
    ${"islamic-civil"}    | ${"0622-07-20T00:30:00"} | ${"+23:59"}
    ${"islamic-umalqura"} | ${"0622-07-20T00:30:00"} | ${"+20:00"}
    ${"islamic-tbla"}     | ${"0622-07-19T00:30:00"} | ${"+20:00"}
    ${"islamic-tbla"}     | ${"0622-07-19T00:30:00"} | ${"+23:59"}
  `(
    "formatZonedDateTime of '$calendar' prints Muharram 2, 1 and the era AH for local $wallClock at $offset",
    ({ calendar, wallClock, offset }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(
        formatZonedDateTime(`${wallClock}${offset}[${offset}]`, locale, long),
      ).toBe(`Muharram 2, 1 ${modernEra(locale)}`);
    },
  );

  // The mirror guard: two days before the Hijra in the far west is year 0 on every host, the same
  // text UTC prints for that date.
  it.each`
    calendar              | wallClock
    ${"islamic-civil"}    | ${"0622-07-17T23:00:00"}
    ${"islamic-tbla"}     | ${"0622-07-16T23:00:00"}
    ${"islamic-umalqura"} | ${"0622-07-17T23:00:00"}
  `(
    "formatZonedDateTime of '$calendar' at -23:59 prints what UTC prints for local $wallClock",
    ({ calendar, wallClock }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(
        formatZonedDateTime(`${wallClock}-23:59[-23:59]`, locale, long),
      ).toBe(formatZonedDateTime(`${wallClock}+00:00[UTC]`, locale, long));
    },
  );

  it.each`
    calendar              | offset
    ${"islamic-civil"}    | ${"+20:00"}
    ${"islamic-civil"}    | ${"+23:59"}
    ${"islamic-tbla"}     | ${"+20:00"}
    ${"islamic-umalqura"} | ${"+23:59"}
  `(
    "formatZonedRange of '$calendar' from year 1 day 2 to day 4 at $offset prints what UTC prints for the same dates",
    ({ calendar, offset }) => {
      const locale = `en-u-ca-${calendar}`;
      const day = (n: number): string => `0622-07-${19 + n}`;
      const range = (suffix: string): string =>
        formatZonedRange(
          `${day(calendar === "islamic-tbla" ? 0 : 1)}T00:30:00${suffix}`,
          `${day(calendar === "islamic-tbla" ? 2 : 3)}T20:00:00${suffix}`,
          locale,
          fields,
        );
      expect(range(`${offset}[${offset}]`)).toBe(range("+00:00[UTC]"));
    },
  );
});

describe("D32: ranges on and around the first day of year 1", () => {
  const years = (text: string): string[] => text.match(/\d+/g) ?? [];

  it.each(epochs)(
    "formatDateRange of '$calendar' from $first to the next year prints 1 and 2",
    ({ calendar, first }) => {
      const locale = `en-u-ca-${calendar}`;
      const text = formatDateRange(first, "0623-07-10", locale, fields);
      expect(text).toMatch(/^1\/1\/1 /);
      expect(text).toMatch(/\/2 AH$/);
      expect(text).not.toMatch(/\b0\b/);
    },
  );

  it.each(epochs)(
    "formatDateTimeRange of '$calendar' within $first prints one date 1/1/1 and the era once",
    ({ calendar, first }) => {
      const locale = `en-u-ca-${calendar}`;
      const text = formatDateTimeRange(
        `${first}T00:00:00`,
        `${first}T12:00:00`,
        locale,
        { ...fields, hour: "numeric", minute: "numeric", hourCycle: "h23" },
      );
      expect(years(text).slice(0, 3)).toEqual(["1", "1", "1"]);
      expect(text.split(modernEra(locale))).toHaveLength(2);
      expect(text).not.toMatch(/\b0\b/);
    },
  );

  it.each(epochs)(
    "formatDateRange of '$calendar' from the last day of year 0 to $first gives the pre-Hijra value or two dates",
    ({ calendar, lastBefore, first }) => {
      const locale = `en-u-ca-${calendar}`;
      const text = formatDateRange(lastBefore, first, locale, fields);
      if (isIslamicEraCompatNeeded()) {
        expect(text).toBe("");
        return;
      }
      expect(text.endsWith(`1/1/1 ${modernEra(locale)}`)).toBe(true);
      expect(text.startsWith("12/")).toBe(true);
      expect(years(text)).toEqual(["12", "29", "1", "1", "1", "1"]);
    },
  );

  it.each`
    calendar              | first           | timeZone              | from           | to
    ${"islamic-civil"}    | ${"0622-07-19"} | ${"Pacific/Auckland"} | ${"T00:00:00"} | ${"T09:00:00"}
    ${"islamic-tbla"}     | ${"0622-07-18"} | ${"Asia/Tokyo"}       | ${"T00:00:00"} | ${"T09:00:00"}
    ${"islamic-umalqura"} | ${"0622-07-19"} | ${"Pacific/Honolulu"} | ${"T00:00:00"} | ${"T09:00:00"}
  `(
    "formatZonedRange of '$calendar' in '$timeZone' within local $first prints 1/1/1 once",
    ({ calendar, first, timeZone, from, to }) => {
      const locale = `en-u-ca-${calendar}`;
      const text = formatZonedRange(
        zoned(`${first}${from}`, timeZone),
        zoned(`${first}${to}`, timeZone),
        locale,
        { ...fields, hour: "numeric", minute: "numeric", hourCycle: "h23" },
      );
      expect(years(text).slice(0, 3)).toEqual(["1", "1", "1"]);
      expect(text.split(modernEra(locale))).toHaveLength(2);
      expect(text).not.toMatch(/\b0\b/);
    },
  );

  it.each`
    calendar              | lastBefore      | first           | timeZone
    ${"islamic-civil"}    | ${"0622-07-18"} | ${"0622-07-19"} | ${"Pacific/Honolulu"}
    ${"islamic-tbla"}     | ${"0622-07-17"} | ${"0622-07-18"} | ${"Pacific/Honolulu"}
    ${"islamic-umalqura"} | ${"0622-07-18"} | ${"0622-07-19"} | ${"Pacific/Honolulu"}
  `(
    "formatZonedRange of '$calendar' in '$timeZone' from local $lastBefore evening to $first gives the pre-Hijra value or two dates",
    ({ calendar, lastBefore, first, timeZone }) => {
      const locale = `en-u-ca-${calendar}`;
      const text = formatZonedRange(
        zoned(`${lastBefore}T22:00:00`, timeZone),
        zoned(`${first}T06:00:00`, timeZone),
        locale,
        fields,
      );
      if (isIslamicEraCompatNeeded()) {
        expect(text).toBe("");
        return;
      }
      expect(text.endsWith(`1/1/1 ${modernEra(locale)}`)).toBe(true);
      expect(text.startsWith("12/29/1 ")).toBe(true);
      expect(text).not.toMatch(/\b0\b/);
    },
  );

  it("prints both years of a range from year 1 into year 3", () => {
    const text = formatDateRange(
      "0622-07-19",
      "0624-07-10",
      "en-u-ca-islamic-civil",
      fields,
    );
    expect(text).toMatch(/^1\/1\/1 /);
    expect(text).toMatch(/\/3 AH$/);
  });
});
