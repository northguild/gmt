import { formatCalendar } from "../plain/format/formatCalendar";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateTimeToParts } from "../plain/format/formatDateTimeToParts";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatTime } from "../plain/format/formatTime";
import { formatCalendarUnix } from "../unix/format/formatCalendarUnix";
import { formatUnix } from "../unix/format/formatUnix";
import { formatCalendarUtc } from "../utc/format/formatCalendarUtc";
import { formatUtc } from "../utc/format/formatUtc";
import { formatCalendarZoned } from "../zoned/format/formatCalendarZoned";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { formatZonedToParts } from "../zoned/format/formatZonedToParts";
import { utcMs } from "./utcMs";

/** The value of one part type in a ToParts result, or `undefined` when it has none. */
function partOf(
  parts: readonly { type: string; value: string }[],
  type: string,
): string | undefined {
  return parts.find((part) => part.type === type)?.value;
}

// A locale's default calendar is the host's choice (ECMA-402 CreateDateTimeFormat reads it from
// the locale data), and hosts choose differently for these tags: some print an Islamic, Persian or
// Buddhist year where others print a Gregorian one. With no calendar named, every format that
// prints a year, month, day or era returns its sentinel on every host (compat D37).
describe.each`
  label                          | locale
  ${"ar-SA"}                     | ${"ar-SA"}
  ${"ara-SA"}                    | ${"ara-SA"}
  ${"en-SA"}                     | ${"en-SA"}
  ${"en-TH"}                     | ${"en-TH"}
  ${"shn-TH"}                    | ${"shn-TH"}
  ${"ps-AF"}                     | ${"ps-AF"}
  ${"ps-Arab-PK"}                | ${"ps-Arab-PK"}
  ${"lrc"}                       | ${"lrc"}
  ${"mzn-IR"}                    | ${"mzn-IR"}
  ${"pbu"}                       | ${"pbu"}
  ${"prs"}                       | ${"prs"}
  ${"uzn-AF"}                    | ${"uzn-AF"}
  ${"uzn-Arab"}                  | ${"uzn-Arab"}
  ${"uz-004"}                    | ${"uz-004"}
  ${"ckb-364"}                   | ${"ckb-364"}
  ${"AR-sa (any case)"}          | ${"AR-sa"}
  ${"ar-SA-posix (a variant)"}   | ${"ar-SA-posix"}
  ${"ar-SA-u-nu-latn"}           | ${"ar-SA-u-nu-latn"}
  ${"ar-SA-u-rg-uszzzz"}         | ${"ar-SA-u-rg-uszzzz"}
  ${"ar-SA-x-private"}           | ${"ar-SA-x-private"}
  ${"[ar-SA, en]"}               | ${["ar-SA", "en"]}
  ${"[en, ar-SA]"}               | ${["en", "ar-SA"]}
  ${"[fur, fa] (mixed default)"} | ${["fur", "fa"]}
`("D37 refusal via $label", ({ locale }: { locale: string | string[] }) => {
  it.each`
    date            | note
    ${"2024-02-03"} | ${"a Saturday in Rajab 1445"}
    ${"2026-09-12"} | ${"a Saturday in Tishri 5787"}
  `(
    "refuses every date-printing format of $date ($note)",
    ({ date }: { date: string }) => {
      const zoned = `${date}T10:00:00+03:00[Asia/Riyadh]`;
      const utc = `${date}T07:00:00Z`;
      expect([
        formatDate(date, locale),
        formatDate(date, locale, { dateStyle: "full" }),
        formatDate(date, locale, { year: "numeric" }),
        formatDate(date, locale, { month: "long" }),
        formatDate(date, locale, { day: "numeric" }),
        formatDate(date, locale, { era: "short" }),
        formatDateTime(`${date}T10:00`, locale),
        formatDateRange("2024-02-03", "2024-02-05", locale),
        formatDateTimeRange("2024-02-03T10:00", "2024-02-05T10:00", locale),
        formatZonedDateTime(zoned, locale),
        formatZonedRange(
          "2024-02-03T10:00:00+03:00[Asia/Riyadh]",
          "2024-02-05T10:00:00+03:00[Asia/Riyadh]",
          locale,
        ),
        formatUtc(utc, locale),
        formatUnix(utcMs(utc), locale),
        formatUnix(utcMs(utc) / 1000, locale, { epochUnit: "seconds" }),
      ]).toEqual(Array.from({ length: 14 }, () => ""));
    },
  );

  it("returns [] from the ToParts functions", () => {
    expect([
      formatDateToParts("2024-02-03", locale),
      formatDateToParts("2024-02-03", locale, { year: "2-digit" }),
      formatDateTimeToParts("2024-02-03T10:00", locale),
      formatZonedToParts("2024-02-03T10:00:00+03:00[Asia/Riyadh]", locale),
    ]).toEqual([[], [], [], []]);
  });

  it("returns an empty string from the day-label formats a long way from the reference", () => {
    const utc = "2024-02-03T07:00:00Z";
    expect([
      formatCalendar("2024-02-03T10:00", locale, { reference: "2031-01-01" }),
      formatCalendarZoned("2024-02-03T10:00:00+03:00[Asia/Riyadh]", locale, {
        reference: "2031-01-01T00:00:00+03:00[Asia/Riyadh]",
      }),
      formatCalendarUtc(utc, locale, { reference: "2031-01-01T00:00:00Z" }),
      formatCalendarUnix(utcMs(utc), locale, {
        reference: utcMs("2031-01-01T00:00:00Z"),
      }),
    ]).toEqual(["", "", "", ""]);
  });

  it("refuses a calendar the host does not have, which falls back to the default", () => {
    expect(formatDate("2024-02-03", locale, { calendar: "zzzz" })).toBe("");
  });
});

describe("D37 overrides", () => {
  // Each year is the calendar's own: 3 February 2024 is 22 Rajab 1445 AH (Umm al-Qura), 14 Bahman
  // 1402 AP, and 2567 BE (Gregorian year + 543); 12 September 2026 is 1 Tishri 5787.
  it.each`
    label                                     | locale                                   | options                             | date            | year
    ${"ar-SA with calendar gregory"}          | ${"ar-SA-u-nu-latn"}                     | ${{ calendar: "gregory" }}          | ${"2024-02-03"} | ${"2024"}
    ${"ar-SA-u-ca-gregory"}                   | ${"ar-SA-u-ca-gregory-nu-latn"}          | ${{}}                               | ${"2024-02-03"} | ${"2024"}
    ${"ar-SA-u-ca-islamic-umalqura"}          | ${"ar-SA-u-ca-islamic-umalqura-nu-latn"} | ${{}}                               | ${"2024-02-03"} | ${"1445"}
    ${"en-TH-u-ca-buddhist"}                  | ${"en-TH-u-ca-buddhist"}                 | ${{}}                               | ${"2024-02-03"} | ${"2567"}
    ${"en-TH with calendar gregory"}          | ${"en-TH"}                               | ${{ calendar: "gregory" }}          | ${"2024-02-03"} | ${"2024"}
    ${"en-SA with calendar islamic-umalqura"} | ${"en-SA"}                               | ${{ calendar: "islamic-umalqura" }} | ${"2024-02-03"} | ${"1445"}
    ${"ps-AF-u-ca-persian"}                   | ${"ps-AF-u-ca-persian-nu-latn"}          | ${{}}                               | ${"2024-02-03"} | ${"1402"}
    ${"[ar-SA, en] with calendar gregory"}    | ${["ar-SA-u-nu-latn", "en"]}             | ${{ calendar: "gregory" }}          | ${"2024-02-03"} | ${"2024"}
    ${"[fur, fa] with calendar persian"}      | ${["fur-u-nu-latn", "fa-u-nu-latn"]}     | ${{ calendar: "persian" }}          | ${"2024-02-03"} | ${"1402"}
  `(
    "$label prints the year $year for $date",
    ({
      locale,
      options,
      date,
      year,
    }: {
      locale: string | string[];
      options: Intl.DateTimeFormatOptions;
      date: string;
      year: string;
    }) => {
      const parts = formatDateToParts(date, locale, {
        ...options,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      expect(partOf(parts, "year")).toBe(year);
      expect(formatDate(date, locale, options)).not.toBe("");
    },
  );
});

describe("D37 allowed formats", () => {
  it.each`
    label            | locale
    ${"ar-SA"}       | ${"ar-SA"}
    ${"en-TH"}       | ${"en-TH"}
    ${"ps-AF"}       | ${"ps-AF"}
    ${"[ar-SA, en]"} | ${["ar-SA", "en"]}
  `(
    "formats a time of day and a time-only date-time for $label",
    ({ locale }: { locale: string | string[] }) => {
      expect(formatTime("10:00", locale)).not.toBe("");
      expect(
        formatDateTime("2024-02-03T10:00", locale, {
          hour: "numeric",
          minute: "numeric",
        }),
      ).not.toBe("");
    },
  );

  it.each`
    label      | locale
    ${"en-SA"} | ${"en-SA"}
    ${"en-TH"} | ${"en-TH"}
  `(
    "formats a weekday on its own as Saturday for $label",
    ({ locale }: { locale: string }) => {
      expect(formatDate("2024-02-03", locale, { weekday: "long" })).toBe(
        "Saturday",
      );
    },
  );

  // Every host gives these the same default calendar: a script subtag, or a region whose default
  // all hosts share, settles it.
  it.each`
    label            | locale
    ${"ar-Arab-SA"}  | ${"ar-Arab-SA"}
    ${"en-Latn-SA"}  | ${"en-Latn-SA"}
    ${"shn-Mymr-TH"} | ${"shn-Mymr-TH"}
    ${"ps-PK"}       | ${"ps-PK"}
    ${"pbu-PK"}      | ${"pbu-PK"}
    ${"lrc-IQ"}      | ${"lrc-IQ"}
    ${"en-GB"}       | ${"en-GB"}
    ${"[th-TH, th]"} | ${["th-TH", "th"]}
  `(
    "formats a date for $label",
    ({ locale }: { locale: string | string[] }) => {
      expect(formatDate("2024-02-03", locale)).not.toBe("");
    },
  );
});

// ECMA-402 ResolveLocale keeps a locale's `-u-ca-` keyword only when the locale it resolves to came
// from the caller's tag; a host without data for the language falls back to its default locale
// and the keyword with it. The calendar is the caller's either way, so it is passed as the
// `calendar` option, which applies whatever locale is resolved.
describe("a -u-ca- keyword survives a host that has no data for the language", () => {
  // 12 September 2026 is 1 Tishri 5787 (the day before is 29 Elul 5786); 1 July 2026 is 2569 BE
  // and Reiwa 8 (2026 − 2018).
  it.each`
    locale                         | date            | year
    ${"gl-u-ca-hebrew"}            | ${"2026-09-12"} | ${"5787"}
    ${"gl-u-ca-hebrew"}            | ${"2026-09-11"} | ${"5786"}
    ${"fur-u-ca-hebrew"}           | ${"2026-09-12"} | ${"5787"}
    ${"my-u-ca-buddhist-nu-latn"}  | ${"2026-07-01"} | ${"2569"}
    ${"kok-u-ca-japanese-nu-latn"} | ${"2026-07-01"} | ${"8"}
  `(
    "$locale prints the year $year for $date",
    ({
      locale,
      date,
      year,
    }: {
      locale: string;
      date: string;
      year: string;
    }) => {
      const parts = formatDateToParts(date, locale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      expect(partOf(parts, "year")).toBe(year);
    },
  );
});
