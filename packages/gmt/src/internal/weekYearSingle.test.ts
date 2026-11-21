import { formatDate } from "../plain/format/formatDate";
import { formatDateTimeToParts } from "../plain/format/formatDateTimeToParts";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { hostFormatter } from "../test/hostIntl";
import type { CalendarSystem } from "../types";
import {
  computationCalendarId,
  computationYearBias,
} from "./calendarSystemIds";
import { normalizeDateTime } from "./normalizeDateTime";
import { Temporal } from "./temporal";
import { utcMs } from "../test/utcMs";

/*
 * CORE-112 (D23, D24): a single date prints the calendar year, never the week-year.
 *
 * Every expected year is derived here from Temporal, not from the engine: the calendar year, or the
 * era year where the pattern prints an era (ECMA-402 FormatDateTimePattern, `year` field), written
 * in the formatter's numbering system. `numeric` is unpadded and ungrouped; `2-digit` is the last
 * two digits, padded. CLDR 48 data prints the week-year in these patterns (UTS #35 Part 4 §8
 * defines `y` as the calendar year); the engine's own text is never asserted. Only the year
 * changes: month, day, era and separators stay as the locale data has them.
 */

/** A date in `calendar`, read in the calendar it computes in (`coptic` and `ethiopic` in `ethioaa`). */
function inCalendar(iso: string, calendar: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(iso).withCalendar(
    computationCalendarId(calendar as CalendarSystem),
  );
}

/** The calendar year and era year of a date, less the offset of the calendar it computes in. */
function yearsOf(
  iso: string,
  calendar: string,
): { year: number; eraYear: number } {
  const date = inCalendar(iso, calendar);
  const bias = computationYearBias(calendar as CalendarSystem);
  return bias === 0
    ? { year: date.year, eraYear: date.eraYear ?? date.year }
    : { year: date.year - bias, eraYear: date.year - bias };
}

function expectedYear(
  iso: string,
  locale: string,
  calendar: string,
  width: "numeric" | "2-digit",
  hasEra: boolean,
): string {
  const years = yearsOf(iso, calendar);
  const year = hasEra ? years.eraYear : years.year;
  const numberingSystem = hostFormatter(locale, {}).resolvedOptions()
    .numberingSystem;
  const digits = new Intl.NumberFormat(locale, {
    numberingSystem,
    useGrouping: false,
    minimumIntegerDigits: width === "2-digit" ? 2 : 1,
  }).format(year);
  return width === "2-digit" ? [...digits].slice(-2).join("") : digits;
}

/**
 * The host's own text for the date with its year replaced by the calendar year. The month names,
 * the order, the separators and the hour cycle are the host's own wording; the
 * year is the value, so it is the one derived above and never the host's own. A host with the
 * defect prints the week-year (the next or the previous year, and for `japanese` or `roc` the
 * Gregorian year), so the host's year is found among those candidates and swapped. The host's
 * `formatToParts` is not used: on these patterns it aborts on V8 without 0426b0d1045d (every Node
 * line; D23).
 */
function hostTextWithYear(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  wallClock: string,
  calendar: string,
  width: "numeric" | "2-digit",
  year: string,
): string {
  const text = normalizeDateTime(
    hostFormatter(locale, { ...options, timeZone: "UTC" }).format(
      utcMs(`${wallClock}Z`),
    ),
  );
  if (text.includes(year)) return text;
  const date = Temporal.PlainDate.from(wallClock.slice(0, 10));
  const own = yearsOf(date.toString(), calendar);
  const numberingSystem = hostFormatter(locale, {}).resolvedOptions()
    .numberingSystem;
  const digits = (value: number): string => {
    const written = new Intl.NumberFormat(locale, {
      numberingSystem,
      useGrouping: false,
      minimumIntegerDigits: width === "2-digit" ? 2 : 1,
    }).format(value);
    return width === "2-digit" ? [...written].slice(-2).join("") : written;
  };
  const candidates = [own.year, own.eraYear, date.year].flatMap((value) => [
    value + 1,
    value - 1,
    value,
  ]);
  for (const candidate of candidates) {
    const written = digits(candidate);
    if (text.includes(written)) return text.replace(written, year);
  }
  return text;
}

describe("single date, week-year patterns", () => {
  it.each`
    locale                 | options                                                                                  | iso             | calendar      | width        | hasEra   | label
    ${"gd"}                | ${{ year: "numeric", month: "short" }}                                                   | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"gd month short, year-end"}
    ${"gd"}                | ${{ year: "numeric", month: "short" }}                                                   | ${"2027-01-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"gd month short, year-start"}
    ${"gd"}                | ${{ year: "numeric", month: "short" }}                                                   | ${"2025-07-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"gd month short, mid-year control"}
    ${"ksh"}               | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"ksh numeric, year-end"}
    ${"ksh"}               | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2027-01-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"ksh numeric, year-start"}
    ${"ksh"}               | ${{ year: "2-digit", month: "2-digit" }}                                                 | ${"2024-12-30"} | ${"gregory"}  | ${"2-digit"} | ${false} | ${"ksh 2-digit, year-end"}
    ${"sc"}                | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"sc numeric, year-end"}
    ${"sc"}                | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2027-01-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"sc numeric, year-start"}
    ${"te-u-ca-buddhist"}  | ${{ year: "numeric", month: "long" }}                                                    | ${"2026-07-01"} | ${"buddhist"} | ${"numeric"} | ${false} | ${"te buddhist, mid-year"}
    ${"te-u-ca-buddhist"}  | ${{ year: "numeric", month: "long" }}                                                    | ${"2026-12-31"} | ${"buddhist"} | ${"numeric"} | ${false} | ${"te buddhist, year-end"}
    ${"my-u-ca-japanese"}  | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2026-07-01"} | ${"japanese"} | ${"numeric"} | ${true}  | ${"my japanese numeric"}
    ${"my-u-ca-japanese"}  | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }}                                 | ${"2026-07-01"} | ${"japanese"} | ${"2-digit"} | ${true}  | ${"my japanese 2-digit"}
    ${"my-u-ca-japanese"}  | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2024-12-30"} | ${"japanese"} | ${"numeric"} | ${true}  | ${"my japanese year-end"}
    ${"my-u-ca-buddhist"}  | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2026-07-01"} | ${"buddhist"} | ${"numeric"} | ${true}  | ${"my buddhist numeric"}
    ${"de-CH"}             | ${{ era: "short", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }} | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${true}  | ${"de-CH era short, month and day as CLDR orders them"}
    ${"gl-u-ca-hebrew"}    | ${{ dateStyle: "full" }}                                                                 | ${"2026-09-12"} | ${"hebrew"}   | ${"numeric"} | ${false} | ${"gl hebrew dateStyle full, 1 Tishri"}
    ${"gl-u-ca-hebrew"}    | ${{ dateStyle: "full" }}                                                                 | ${"2026-09-13"} | ${"hebrew"}   | ${"numeric"} | ${false} | ${"gl hebrew dateStyle full, 2 Tishri"}
    ${"gl-u-ca-roc"}       | ${{ dateStyle: "full" }}                                                                 | ${"2026-07-01"} | ${"roc"}      | ${"numeric"} | ${true}  | ${"gl roc dateStyle full, unpadded"}
    ${"ksh-u-ca-coptic"}   | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2026-09-12"} | ${"coptic"}   | ${"numeric"} | ${false} | ${"ksh coptic numeric, year-start"}
    ${"ksh-u-ca-coptic"}   | ${{ year: "2-digit", month: "2-digit" }}                                                 | ${"2026-09-12"} | ${"coptic"}   | ${"2-digit"} | ${false} | ${"ksh coptic 2-digit, year-start"}
    ${"ksh-u-ca-ethiopic"} | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2026-09-12"} | ${"ethiopic"} | ${"numeric"} | ${false} | ${"ksh ethiopic numeric, year-start"}
    ${"ksh-u-ca-ethiopic"} | ${{ year: "2-digit", month: "2-digit" }}                                                 | ${"2026-09-12"} | ${"ethiopic"} | ${"2-digit"} | ${false} | ${"ksh ethiopic 2-digit, year-start"}
    ${"my-u-ca-coptic"}    | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2026-09-08"} | ${"coptic"}   | ${"numeric"} | ${true}  | ${"my coptic, thirteenth month"}
    ${"my-u-ca-ethiopic"}  | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2026-09-08"} | ${"ethiopic"} | ${"numeric"} | ${true}  | ${"my ethiopic, thirteenth month"}
    ${"te-u-ca-coptic"}    | ${{ year: "numeric", month: "long" }}                                                    | ${"2026-09-08"} | ${"coptic"}   | ${"numeric"} | ${false} | ${"te coptic, thirteenth month"}
    ${"te-u-ca-ethiopic"}  | ${{ year: "numeric", month: "long" }}                                                    | ${"2026-09-08"} | ${"ethiopic"} | ${"numeric"} | ${false} | ${"te ethiopic, thirteenth month"}
    ${"lg"}                | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2027-01-01"} | ${"gregory"}  | ${"numeric"} | ${true}  | ${"lg weekday name with a digit, year-start"}
    ${"lg"}                | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2024-12-29"} | ${"gregory"}  | ${"numeric"} | ${true}  | ${"lg weekday name without a digit, year-end"}
    ${"lg-u-ca-buddhist"}  | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2026-12-31"} | ${"buddhist"} | ${"numeric"} | ${true}  | ${"lg buddhist weekday name with a digit"}
    ${"lg-u-ca-japanese"}  | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2026-12-31"} | ${"japanese"} | ${"numeric"} | ${true}  | ${"lg japanese weekday name with a digit"}
    ${"lg-u-ca-roc"}       | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2026-12-31"} | ${"roc"}      | ${"numeric"} | ${true}  | ${"lg roc weekday name with a digit"}
    ${"luy-u-ca-indian"}   | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2024-12-30"} | ${"indian"}   | ${"numeric"} | ${false} | ${"luy indian weekday name with a digit"}
    ${"luy-u-ca-indian"}   | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2027-01-01"} | ${"indian"}   | ${"numeric"} | ${false} | ${"luy indian weekday name without a digit"}
    ${"sg-u-ca-hebrew"}    | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2024-12-30"} | ${"hebrew"}   | ${"numeric"} | ${false} | ${"sg hebrew weekday name with a digit"}
    ${"sg-u-ca-hebrew"}    | ${{ year: "numeric", month: "short", day: "numeric", weekday: "short" }}                 | ${"2027-01-01"} | ${"hebrew"}   | ${"numeric"} | ${false} | ${"sg hebrew weekday name without a digit"}
  `(
    "formatDate and formatDateToParts print the calendar year for $label ('$locale', $iso) in the host's wording",
    ({ locale, options, iso, calendar, width, hasEra }) => {
      const year = expectedYear(iso, locale, calendar, width, hasEra);
      const expected = hostTextWithYear(
        locale,
        options,
        `${iso}T00:00:00`,
        calendar,
        width,
        year,
      );
      expect(formatDate(iso, locale, options)).toBe(expected);
      const parts = formatDateToParts(iso, locale, options);
      expect(parts.map((part) => part.value).join("")).toBe(expected);
      expect(parts.filter((part) => part.type === "year")).toEqual([
        { type: "year", value: year },
      ]);
      expect(parts.some((part) => part.type === "unknown")).toBe(false);
    },
  );

  it("splits a gd month and year into month, literal and year parts", () => {
    const options = { year: "numeric", month: "short" } as const;
    const text = hostTextWithYear(
      "gd",
      options,
      "2024-12-30T00:00:00",
      "gregory",
      "numeric",
      "2024",
    );
    // The month's name comes from a format of the month alone, which has no week-year.
    const month = normalizeDateTime(
      new Intl.DateTimeFormat("gd", {
        month: "short",
        timeZone: "UTC",
      }).format(utcMs("2024-12-30T00:00:00Z")),
    );
    expect(text.startsWith(month)).toBe(true);
    expect(formatDateToParts("2024-12-30", "gd", options)).toEqual([
      { type: "month", value: month },
      { type: "literal", value: text.slice(month.length, -4) },
      { type: "year", value: "2024" },
    ]);
  });

  it("keeps the time fields next to a repaired gd year, in text and in parts", () => {
    const options = {
      year: "numeric",
      month: "short",
      hour: "numeric",
      minute: "numeric",
    } as const;
    const parts = formatDateTimeToParts("2024-12-30T14:05:00", "gd", options);
    expect(parts.map((part) => part.value).join("")).toBe(
      hostTextWithYear(
        "gd",
        options,
        "2024-12-30T14:05:00",
        "gregory",
        "numeric",
        "2024",
      ),
    );
    // The hour cycle is the host's: a 12-hour host adds a literal and the day period.
    const types = parts.map((part) => part.type);
    expect(types.slice(0, 7)).toEqual([
      "month",
      "literal",
      "year",
      "literal",
      "hour",
      "literal",
      "minute",
    ]);
    expect([[], ["literal", "dayPeriod"]]).toContainEqual(types.slice(7));
  });

  it.each`
    locale               | iso
    ${"lg"}              | ${"2027-01-01"}
    ${"lg"}              | ${"2024-12-29"}
    ${"luy-u-ca-indian"} | ${"2024-12-30"}
    ${"luy-u-ca-indian"} | ${"2027-01-01"}
    ${"sg-u-ca-hebrew"}  | ${"2024-12-30"}
    ${"sg-u-ca-hebrew"}  | ${"2027-01-01"}
  `(
    "keeps a '$locale' weekday name whole on $iso, whether or not it holds a digit",
    ({ locale, iso }) => {
      // lg `Lw5` beside `Sab`: the digit belongs to the name, so the day and the year stay apart.
      const options = {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
      } as const;
      const weekday = normalizeDateTime(
        new Intl.DateTimeFormat(locale, {
          weekday: "short",
          timeZone: "UTC",
        }).format(utcMs(`${iso}T00:00:00Z`)),
      );
      const parts = formatDateToParts(iso, locale, options);
      expect(parts.filter((part) => part.type === "weekday")).toEqual([
        { type: "weekday", value: weekday },
      ]);
      expect(parts.filter((part) => part.type === "day")).toHaveLength(1);
    },
  );

  it.each`
    locale                | options
    ${"en"}               | ${{ year: "numeric", month: "long" }}
    ${"de"}               | ${{ year: "numeric", month: "long" }}
    ${"fr"}               | ${{ year: "numeric", month: "long" }}
    ${"ja-u-ca-japanese"} | ${{ year: "numeric", month: "long" }}
    ${"en"}               | ${{ dateStyle: "full" }}
  `(
    "leaves '$locale' $options alone: the parts join to the text",
    ({ locale, options }) => {
      const parts = formatDateToParts("2024-12-30", locale, options);
      expect(parts.map((part) => part.value).join("")).toBe(
        formatDate("2024-12-30", locale, options),
      );
      expect(parts.some((part) => part.type === "unknown")).toBe(false);
    },
  );
});
