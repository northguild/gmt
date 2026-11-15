import { formatCalendar } from "../plain/format/formatCalendar";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { formatZonedToParts } from "../zoned/format/formatZonedToParts";

/*
 * CORE-112 (D25 to D30): the years an engine prints wrongly outside the week-year.
 *
 * Every expected value comes from a specification, never from the engine's text:
 * - D25: Intl era/monthCode Table 2 as amended by tc39/proposal-intl-era-monthcode#86 (test262
 *   tc39/test262#4877): the japanese calendar uses Gregorian eras up to and including 1872-12-31
 *   and the solar Japanese eras from 1873-01-01. ISO -0001-07-10 is 2 BC, 1872-12-31 is 1872 AD,
 *   1873-01-01 is Meiji 6 (Meiji 1 is 1868 as a year count).
 * - D26: Table 2 and § 4.1.12 give `bh`; an engine with no `bh` name gives the house empty value.
 * - D27: ECMA-402 FormatDateTimePattern, "2-digit": FormatNumeric with minimumIntegerDigits 2, so
 *   Reiwa 6 is 06; CLDR's ja data keeps 元年 for year 1 (owner decision).
 * - D28: ECMA-402 FormatDateTimePattern, `relatedYear`: FormatNumeric at full width, no 2-digit
 *   form, so related year 5 is 5 and -1 is -1.
 * Each value holds on an engine that has the defect and on one that does not.
 */

const eraYear = { era: "short", year: "numeric" } as const;

describe("D25: japanese dates before 1873-01-01 print Gregorian eras", () => {
  it.each`
    locale                | iso                | expected
    ${"en-u-ca-japanese"} | ${"-000001-07-10"} | ${"2 BC"}
    ${"ja-u-ca-japanese"} | ${"-000001-07-10"} | ${"紀元前2年"}
    ${"en-u-ca-japanese"} | ${"1872-12-31"}    | ${"1872 AD"}
    ${"ja-u-ca-japanese"} | ${"1872-12-31"}    | ${"西暦1872年"}
    ${"en-u-ca-japanese"} | ${"1868-10-23"}    | ${"1868 AD"}
    ${"ja-u-ca-japanese"} | ${"1868-10-23"}    | ${"西暦1868年"}
    ${"en-u-ca-japanese"} | ${"1873-01-01"}    | ${"6 Meiji"}
    ${"ja-u-ca-japanese"} | ${"1873-01-01"}    | ${"明治6年"}
  `(
    "formatDate prints '$expected' for '$locale' at $iso",
    ({ locale, iso, expected }) => {
      expect(formatDate(iso, locale, eraYear)).toBe(expected);
    },
  );

  it("splits the Gregorian era and year of a pre-1873 date into era and year parts", () => {
    expect(
      formatDateToParts("1872-12-31", "en-u-ca-japanese", eraYear),
    ).toEqual([
      { type: "year", value: "1872" },
      { type: "literal", value: " " },
      { type: "era", value: "AD" },
    ]);
  });

  it("prints a zoned date before 1873 with the Gregorian era", () => {
    expect(
      formatZonedDateTime(
        "-000001-07-10T12:00:00+00:00[UTC]",
        "en-u-ca-japanese",
        eraYear,
      ),
    ).toBe("2 BC");
    expect(
      formatZonedToParts(
        "-000001-07-10T12:00:00+00:00[UTC]",
        "en-u-ca-japanese",
        eraYear,
      )
        .map((part) => part.value)
        .join(""),
    ).toBe("2 BC");
  });

  it("prints a range inside the Gregorian eras and one inside the Meiji era", () => {
    expect(
      formatDateRange("1870-01-01", "1872-12-31", "en-u-ca-japanese", eraYear),
    ).toMatch(/^1870\D+1872 AD$/);
    expect(
      formatDateRange("1873-01-01", "1875-06-01", "en-u-ca-japanese", eraYear),
    ).toMatch(/^6\D+8 Meiji$/);
  });
});

/*
 * The japanese pattern prints an era with its year, so the Gregorian twin of a date before 1873
 * prints one too, though the caller asked for none (`1872 AD`, never a bare `1872` that reads as a
 * Japanese year count). A `dateStyle` cannot be combined with `era`, so the era is placed by the
 * japanese pattern's own order.
 */
describe("D25: a date before 1873 keeps its era when the caller asked for none", () => {
  it.each`
    locale                | options                                                | expected
    ${"en-u-ca-japanese"} | ${{ year: "numeric" }}                                 | ${"1872 AD"}
    ${"en-u-ca-japanese"} | ${{ year: "numeric", month: "short", day: "numeric" }} | ${"Dec 31, 1872 AD"}
    ${"ja-u-ca-japanese"} | ${{ year: "numeric" }}                                 | ${"西暦1872年"}
    ${"ja-u-ca-japanese"} | ${{ year: "numeric", month: "long", day: "numeric" }}  | ${"西暦1872年12月31日"}
    ${"en-u-ca-japanese"} | ${{ dateStyle: "medium" }}                             | ${"Dec 31, 1872 AD"}
    ${"ja-u-ca-japanese"} | ${{ dateStyle: "long" }}                               | ${"西暦1872年12月31日"}
  `(
    "formatZonedDateTime prints '$expected' for '$locale' with $options",
    ({ locale, options, expected }) => {
      expect(
        formatZonedDateTime("1872-12-31T12:00:00+00:00[UTC]", locale, options),
      ).toBe(expected);
    },
  );

  it("a range across 1873-01-01 keeps the era of the date before it", () => {
    expect(
      formatDateRange("1872-12-31", "1873-01-01", "en-u-ca-japanese", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    ).toBe("Dec 31, 1872 AD - Jan 1, 6 Meiji");
  });
});

describe("D25: more dates, locales and functions", () => {
  it.each`
    locale                        | iso                | suffix
    ${"en-u-ca-japanese-nu-arab"} | ${"-000001-07-10"} | ${"٢ BC"}
    ${"en-u-ca-japanese-nu-arab"} | ${"1872-12-31"}    | ${"١٨٧٢ AD"}
    ${"en-u-ca-japanese-nu-arab"} | ${"1873-01-01"}    | ${"٦ Meiji"}
    ${"th-u-ca-japanese-nu-thai"} | ${"-000001-07-10"} | ${"๒"}
    ${"th-u-ca-japanese-nu-thai"} | ${"1872-12-31"}    | ${"๑๘๗๒"}
    ${"th-u-ca-japanese-nu-thai"} | ${"1873-01-01"}    | ${"๖"}
  `(
    "formatDate ends with '$suffix' for '$locale' at $iso (digits of the numbering system)",
    ({ locale, iso, suffix }) => {
      expect(formatDate(iso, locale, eraYear).endsWith(suffix)).toBe(true);
    },
  );

  it.each`
    locale                | iso                | expected
    ${"ja-u-ca-japanese"} | ${"-000001-07-10"} | ${[{ type: "era", value: "紀元前" }, { type: "year", value: "2" }, { type: "literal", value: "年" }]}
    ${"ja-u-ca-japanese"} | ${"1873-01-01"}    | ${[{ type: "era", value: "明治" }, { type: "year", value: "6" }, { type: "literal", value: "年" }]}
  `(
    "formatDateToParts splits '$locale' at $iso into era, year and literal",
    ({ locale, iso, expected }) => {
      expect(formatDateToParts(iso, locale, eraYear)).toEqual(expected);
    },
  );

  it("types the year part of a pre-1873 date in a non-Latin numbering system as year", () => {
    expect(
      formatDateToParts("1872-12-31", "en-u-ca-japanese-nu-arab", eraYear),
    ).toEqual([
      { type: "year", value: "١٨٧٢" },
      { type: "literal", value: " " },
      { type: "era", value: "AD" },
    ]);
  });

  it("prints a plain date-time before 1873 with the Gregorian era", () => {
    expect(
      formatDateTime("1872-12-31T23:59:59", "en-u-ca-japanese", eraYear),
    ).toBe("1872 AD");
    expect(
      formatDateTime("1873-01-01T00:00:00", "en-u-ca-japanese", eraYear),
    ).toBe("6 Meiji");
  });

  // ISO -0100 is 101 BC and ISO -0001 is 2 BC (astronomical year numbering, year 0 is 1 BC).
  it.each`
    start              | end                | locale                | expected
    ${"-000100-01-01"} | ${"-000001-07-10"} | ${"en-u-ca-japanese"} | ${/^101\D+2 BC$/}
    ${"-000100-01-01"} | ${"-000001-07-10"} | ${"ja-u-ca-japanese"} | ${/^紀元前101年\D+2年$/}
    ${"1868-10-23"}    | ${"1872-12-31"}    | ${"en-u-ca-japanese"} | ${/^1868\D+1872 AD$/}
    ${"1868-10-23"}    | ${"1872-12-31"}    | ${"ja-u-ca-japanese"} | ${/^西暦1868年\D+1872年$/}
  `(
    "the three range functions print '$locale' $start to $end in one calendar, the Gregorian one",
    ({ start, end, locale, expected }) => {
      expect(formatDateRange(start, end, locale, eraYear)).toMatch(expected);
      expect(
        formatDateTimeRange(
          `${start}T00:00:00`,
          `${end}T00:00:00`,
          locale,
          eraYear,
        ),
      ).toMatch(expected);
      expect(
        formatZonedRange(
          `${start}T00:00:00+00:00[UTC]`,
          `${end}T00:00:00+00:00[UTC]`,
          locale,
          eraYear,
        ),
      ).toMatch(expected);
    },
  );

  // A range that crosses 1873-01-01 prints each date in its own era, joined as the engine joins
  // two dates it cannot share a pattern for (UTS #35 intervalFormatFallback). `1872 – 1873 AD` would
  // read the Meiji year as a Gregorian one.
  it.each`
    start              | end             | locale                | expected
    ${"1872-12-31"}    | ${"1873-01-01"} | ${"en-u-ca-japanese"} | ${/^1872 AD\D+6 Meiji$/}
    ${"1873-01-01"}    | ${"1872-12-31"} | ${"en-u-ca-japanese"} | ${/^6 Meiji\D+1872 AD$/}
    ${"1872-12-31"}    | ${"1873-01-01"} | ${"ja-u-ca-japanese"} | ${/^西暦1872年\D+明治6年$/}
    ${"1868-10-23"}    | ${"1875-06-01"} | ${"en-u-ca-japanese"} | ${/^1868 AD\D+8 Meiji$/}
    ${"-000001-07-10"} | ${"1873-01-01"} | ${"en-u-ca-japanese"} | ${/^2 BC\D+6 Meiji$/}
  `(
    "the three range functions print '$locale' $start to $end with each date in its own era",
    ({ start, end, locale, expected }) => {
      expect(formatDateRange(start, end, locale, eraYear)).toMatch(expected);
      expect(
        formatDateTimeRange(
          `${start}T00:00:00`,
          `${end}T00:00:00`,
          locale,
          eraYear,
        ),
      ).toMatch(expected);
      expect(
        formatZonedRange(
          `${start}T00:00:00+00:00[UTC]`,
          `${end}T00:00:00+00:00[UTC]`,
          locale,
          eraYear,
        ),
      ).toMatch(expected);
    },
  );

  it.each`
    locale                | first           | second       | joiner
    ${"en-u-ca-japanese"} | ${"1872 AD"}    | ${"6 Meiji"} | ${/^\s*-\s*$/}
    ${"ja-u-ca-japanese"} | ${"西暦1872年"} | ${"明治6年"} | ${/^～$/}
  `(
    "joins '$first' and '$second' with the locale's fallback joiner (UTS #35 intervalFormatFallback; the library writes dashes as ASCII)",
    ({ locale, first, second, joiner }) => {
      const text = formatDateRange("1872-12-31", "1873-01-01", locale, eraYear);
      expect(text.startsWith(first)).toBe(true);
      expect(text.endsWith(second)).toBe(true);
      expect(text.slice(first.length, text.length - second.length)).toMatch(
        joiner,
      );
    },
  );

  it("leaves a range inside the Meiji era in the japanese calendar, in every function", () => {
    expect(
      formatZonedRange(
        "1873-01-01T00:00:00+00:00[UTC]",
        "1875-06-01T00:00:00+00:00[UTC]",
        "en-u-ca-japanese",
        eraYear,
      ),
    ).toMatch(/^6\D+8 Meiji$/);
  });
});

/*
 * Styled ranges with both ends before 1873. A date style cannot take `era`, so the era is written
 * where the japanese pattern puts it, and the range collapses as ECMA-402
 * PartitionDateTimeRangePattern says: every printed field equal prints the single date; else the
 * greatest differing field picks the pattern (day: `Dec 30 - 31`, hour: `10:00 - 11:00 AM`).
 * Expected texts are the Gregorian pattern's range with the Gregorian era added where the engine's
 * japanese pattern puts its era for the same dates after 1873 (`Dec 30 - 31, 47 Showa`).
 */
describe("D25: a styled range with both ends before 1873 collapses and keeps its era", () => {
  it.each`
    locale                | options                    | start           | end             | expected
    ${"en-u-ca-japanese"} | ${{ dateStyle: "medium" }} | ${"1872-12-31"} | ${"1872-12-31"} | ${"Dec 31, 1872 AD"}
    ${"en-u-ca-japanese"} | ${{ dateStyle: "long" }}   | ${"1872-12-31"} | ${"1872-12-31"} | ${"December 31, 1872 AD"}
    ${"ja-u-ca-japanese"} | ${{ dateStyle: "medium" }} | ${"1872-12-31"} | ${"1872-12-31"} | ${"西暦1872/12/31"}
    ${"en-u-ca-japanese"} | ${{ dateStyle: "medium" }} | ${"1872-12-30"} | ${"1872-12-31"} | ${"Dec 30 - 31, 1872 AD"}
    ${"en-u-ca-japanese"} | ${{ dateStyle: "long" }}   | ${"1872-12-30"} | ${"1872-12-31"} | ${"December 30 - 31, 1872 AD"}
    ${"ja-u-ca-japanese"} | ${{ dateStyle: "medium" }} | ${"1872-12-30"} | ${"1872-12-31"} | ${"西暦1872/12/30～1872/12/31"}
  `(
    "the three range functions print '$locale' $options $start to $end as '$expected'",
    ({ locale, options, start, end, expected }) => {
      expect(formatDateRange(start, end, locale, options)).toBe(expected);
      expect(
        formatDateTimeRange(
          `${start}T10:00:00`,
          `${end}T10:00:00`,
          locale,
          options,
        ),
      ).toBe(expected);
      expect(
        formatZonedRange(
          `${start}T10:00:00+00:00[UTC]`,
          `${end}T10:00:00+00:00[UTC]`,
          locale,
          options,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    locale                | start                 | end                   | expected
    ${"en-u-ca-japanese"} | ${"1872-12-31T10:00"} | ${"1872-12-31T11:00"} | ${"Dec 31, 1872 AD, 10:00 - 11:00 AM"}
    ${"en-u-ca-japanese"} | ${"1872-12-30T10:00"} | ${"1872-12-31T10:00"} | ${"Dec 30, 1872 AD, 10:00 AM - Dec 31, 1872 AD, 10:00 AM"}
  `(
    "formatDateTimeRange and formatZonedRange print '$locale' $start to $end with the era on each printed year",
    ({ locale, start, end, expected }) => {
      const options = { dateStyle: "medium", timeStyle: "short" } as const;
      expect(
        formatDateTimeRange(`${start}:00`, `${end}:00`, locale, options),
      ).toBe(expected);
      expect(
        formatZonedRange(
          `${start}:00+00:00[UTC]`,
          `${end}:00+00:00[UTC]`,
          locale,
          options,
        ),
      ).toBe(expected);
    },
  );
});

describe("D25: a range whose shifted twin would straddle a japanese era boundary", () => {
  // The era is placed by the engine's range of the same dates 400 or more years later. A pair
  // that moved across 1912-07-30, 1926-12-25, 1989-01-08 or 2019-05-01 prints two eras there, so
  // the shift goes on until one era holds both. Each expected text is Node 26.12.1's Gregorian
  // range of the dates with ` AD` at the end, where the engine's same-era range puts its era.
  it.each`
    start           | end             | dateStyle   | expected
    ${"1589-01-07"} | ${"1589-01-08"} | ${"medium"} | ${"Jan 7 - 8, 1589 AD"}
    ${"1589-01-07"} | ${"1589-01-08"} | ${"short"}  | ${"1/7/89 - 1/8/89 AD"}
    ${"1619-04-30"} | ${"1619-05-01"} | ${"medium"} | ${"Apr 30 - May 1, 1619 AD"}
    ${"1619-04-30"} | ${"1619-05-01"} | ${"long"}   | ${"April 30 - May 1, 1619 AD"}
    ${"1619-04-30"} | ${"1619-05-01"} | ${"full"}   | ${"Tuesday, April 30 - Wednesday, May 1, 1619 AD"}
    ${"1526-12-24"} | ${"1526-12-25"} | ${"medium"} | ${"Dec 24 - 25, 1526 AD"}
    ${"1526-12-24"} | ${"1526-12-25"} | ${"long"}   | ${"December 24 - 25, 1526 AD"}
    ${"1526-12-24"} | ${"1526-12-25"} | ${"full"}   | ${"Friday, December 24 - Saturday, December 25, 1526 AD"}
    ${"1512-07-29"} | ${"1512-07-30"} | ${"medium"} | ${"Jul 29 - 30, 1512 AD"}
    ${"1512-07-29"} | ${"1512-07-30"} | ${"long"}   | ${"July 29 - 30, 1512 AD"}
    ${"1512-07-29"} | ${"1512-07-30"} | ${"full"}   | ${"Monday, July 29 - Tuesday, July 30, 1512 AD"}
    ${"1500-01-01"} | ${"1530-01-01"} | ${"short"}  | ${"1/1/00 - 1/1/30 AD"}
    ${"1500-01-01"} | ${"1530-01-01"} | ${"medium"} | ${"Jan 1, 1500 - Jan 1, 1530 AD"}
    ${"1588-06-01"} | ${"1589-06-01"} | ${"medium"} | ${"Jun 1, 1588 - Jun 1, 1589 AD"}
  `(
    "formatDateRange of 'en-u-ca-japanese' $dateStyle from $start to $end is '$expected'",
    ({ start, end, dateStyle, expected }) => {
      expect(
        formatDateRange(start, end, "en-u-ca-japanese", { dateStyle }),
      ).toBe(expected);
    },
  );

  it.each`
    locale                | expected
    ${"en-u-ca-japanese"} | ${"Jan 7, 1589 AD, 9:00 AM - Jan 8, 1589 AD, 11:30 AM"}
    ${"ja-u-ca-japanese"} | ${"西暦1589/01/07 9:00～西暦1589/01/08 11:30"}
  `(
    "formatZonedRange of '$locale' 1589-01-07T09:00 to 1589-01-08T11:30 is '$expected'",
    ({ locale, expected }) => {
      expect(
        formatZonedRange(
          "1589-01-07T09:00:00+00:00[UTC]",
          "1589-01-08T11:30:00+00:00[UTC]",
          locale,
          { dateStyle: "medium", timeStyle: "short" },
        ),
      ).toBe(expected);
    },
  );
});

/**
 * Every `islamic*` calendar id an engine resolves, per Intl era/monthCode: `islamic` becomes
 * `islamic-tbla` (D30), and `islamic-rgsa` is not an available calendar (the D30 tests cover it).
 */
const islamicCalendars = [
  "islamic",
  "islamic-civil",
  "islamic-tbla",
  "islamic-umalqura",
] as const;

describe("D26: islamic dates before the Hijra give the empty value", () => {
  it.each(islamicCalendars.map((calendar) => ({ calendar })))(
    "gives the empty value for '$calendar'",
    ({ calendar }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(formatDate("-000001-07-10", locale, eraYear)).toBe("");
      expect(formatDate("0600-07-10", locale, eraYear)).toBe("");
      expect(formatDateToParts("-000001-07-10", locale, eraYear)).toEqual([]);
      expect(formatDateTime("0600-07-10T12:00:00", locale, eraYear)).toBe("");
      expect(
        formatDateRange("-000001-07-10", "2025-07-10", locale, eraYear),
      ).toBe("");
      expect(formatDateRange("2025-07-10", "0600-07-10", locale, eraYear)).toBe(
        "",
      );
      expect(
        formatDateTimeRange(
          "0600-07-10T00:00:00",
          "2025-07-10T00:00:00",
          locale,
          eraYear,
        ),
      ).toBe("");
      expect(
        formatZonedDateTime("0600-07-10T12:00:00+00:00[UTC]", locale, eraYear),
      ).toBe("");
      expect(
        formatZonedToParts("0600-07-10T12:00:00+00:00[UTC]", locale, eraYear),
      ).toEqual([]);
      expect(
        formatZonedRange(
          "0600-07-10T12:00:00+00:00[UTC]",
          "2025-07-10T12:00:00+00:00[UTC]",
          locale,
          eraYear,
        ),
      ).toBe("");
    },
  );

  // Last day before the Hijra and the first day of AH 1, as native Temporal computes them
  // (`bh` era / year 0, then `ah` year 1). `islamic` resolves to `islamic-tbla` (D30), so
  // its epoch is that row's.
  it.each`
    calendar              | lastBefore      | firstDay
    ${"islamic-civil"}    | ${"0622-07-18"} | ${"0622-07-19"}
    ${"islamic-tbla"}     | ${"0622-07-17"} | ${"0622-07-18"}
    ${"islamic-umalqura"} | ${"0622-07-18"} | ${"0622-07-19"}
  `(
    "'$calendar' gives the empty value for the last day before the Hijra and 1 AH for $firstDay",
    ({ calendar, lastBefore, firstDay }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(formatDate(lastBefore, locale, eraYear)).toBe("");
      expect(formatDateToParts(lastBefore, locale, eraYear)).toEqual([]);
      expect(formatDate(firstDay, locale, eraYear)).toBe("1 AH");
      expect(
        formatDateToParts(firstDay, locale, eraYear).find(
          (part) => part.type === "year",
        ),
      ).toEqual({ type: "year", value: "1" });
      expect(formatDateRange(lastBefore, firstDay, locale, eraYear)).toBe("");
      expect(formatDateRange(firstDay, "0623-07-10", locale, eraYear)).toMatch(
        /^1\D+2 AH$/,
      );
      expect(
        formatZonedRange(
          `${lastBefore}T23:59:59+00:00[UTC]`,
          `${firstDay}T12:00:00+00:00[UTC]`,
          locale,
          eraYear,
        ),
      ).toBe("");
    },
  );

  it.each`
    locale
    ${"ja-u-ca-islamic-civil"}
    ${"ar-u-ca-islamic-umalqura-nu-arab"}
    ${"th-u-ca-islamic-tbla-nu-thai"}
  `("gives the empty value before the Hijra for '$locale'", ({ locale }) => {
    expect(formatDate("0600-07-10", locale, eraYear)).toBe("");
    expect(formatDateToParts("0600-07-10", locale, eraYear)).toEqual([]);
    expect(formatDateRange("0600-07-10", "0601-07-10", locale, eraYear)).toBe(
      "",
    );
  });

  it.each(islamicCalendars.map((calendar) => ({ calendar })))(
    "leaves a date after the Hijra alone for '$calendar'",
    ({ calendar }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(formatDate("2025-07-10", locale, eraYear)).toBe("1447 AH");
      expect(formatDate("2026-07-10", locale, eraYear)).toBe("1448 AH");
      expect(
        formatDateToParts("2025-07-10", locale, eraYear)
          .map((part) => part.value)
          .join(""),
      ).toBe("1447 AH");
      expect(
        formatDateRange("2025-07-10", "2026-07-10", locale, eraYear),
      ).toMatch(/1447.*1448/);
    },
  );

  it("leaves a pre-Hijra date alone in a gregory formatter", () => {
    expect(formatDate("0600-07-10", "en-u-ca-gregory", eraYear)).toBe("600 AD");
  });

  it("leaves a pre-Hijra date alone when no era or year is printed", () => {
    expect(
      formatDate("0600-07-10", "en-u-ca-islamic-civil", { month: "long" }),
    ).not.toBe("");
  });
});

describe("D27: ja japanese with year 2-digit pads the era year", () => {
  it.each`
    iso             | options                                                  | expected             | label
    ${"2024-07-10"} | ${{ year: "2-digit" }}                                   | ${"令和06年"}        | ${"Reiwa 6"}
    ${"2019-05-01"} | ${{ year: "2-digit" }}                                   | ${"令和元年"}        | ${"Reiwa 1 keeps 元"}
    ${"2019-05-01"} | ${{ year: "numeric" }}                                   | ${"令和元年"}        | ${"Reiwa 1 numeric"}
    ${"2024-07-10"} | ${{ year: "numeric" }}                                   | ${"令和6年"}         | ${"numeric is unpadded"}
    ${"2024-07-10"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"R06/7/10"}        | ${"numeric-only pattern"}
    ${"1990-06-10"} | ${{ year: "2-digit", month: "long", day: "numeric" }}    | ${"平成02年6月10日"} | ${"Heisei 2, month 6 stays"}
    ${"1989-01-08"} | ${{ year: "2-digit", month: "long", day: "numeric" }}    | ${"平成元年1月8日"}  | ${"Heisei 1, month 1 stays"}
    ${"2018-06-10"} | ${{ year: "2-digit", month: "long", day: "numeric" }}    | ${"平成30年6月10日"} | ${"two digits stay"}
  `(
    "formatDate prints '$expected' for $label ($iso)",
    ({ iso, options, expected }) => {
      expect(formatDate(iso, "ja-u-ca-japanese", options)).toBe(expected);
    },
  );

  it("pads in the year part and in the joined parts", () => {
    const parts = formatDateToParts("2024-07-10", "ja-u-ca-japanese", {
      year: "2-digit",
    });
    expect(parts.find((part) => part.type === "year")).toEqual({
      type: "year",
      value: "06",
    });
    expect(parts.map((part) => part.value).join("")).toBe("令和06年");
  });

  it("pads in a zoned date and keeps 元 there", () => {
    expect(
      formatZonedDateTime(
        "2024-07-10T12:00:00+00:00[UTC]",
        "ja-u-ca-japanese",
        {
          year: "2-digit",
        },
      ),
    ).toBe("令和06年");
    expect(
      formatZonedDateTime(
        "2019-05-01T12:00:00+00:00[UTC]",
        "ja-u-ca-japanese",
        {
          year: "2-digit",
        },
      ),
    ).toBe("令和元年");
  });
});

describe("D27: ranges across eras, ja japanese, year 2-digit", () => {
  // Heisei 31 ends on 2019-04-30, Reiwa 1 starts on 2019-05-01, Showa 64 ends on 1989-01-07.
  it.each`
    start           | end             | first         | second
    ${"2019-04-30"} | ${"2020-05-01"} | ${"平成31年"} | ${"令和02年"}
    ${"2019-05-01"} | ${"2020-05-01"} | ${"令和元年"} | ${"02年"}
    ${"2019-04-30"} | ${"2019-05-01"} | ${"平成31年"} | ${"令和元年"}
    ${"1989-01-07"} | ${"1990-01-07"} | ${"昭和64年"} | ${"平成02年"}
    ${"1989-01-08"} | ${"1990-01-08"} | ${"平成元年"} | ${"02年"}
    ${"2018-06-10"} | ${"2019-04-30"} | ${"平成30年"} | ${"31年"}
    ${"2024-07-10"} | ${"2034-07-10"} | ${"令和06年"} | ${"16年"}
  `(
    "the three range functions print '$first' and '$second' for $start to $end",
    ({ start, end, first, second }) => {
      const expected = new RegExp(`^${first}\\D+${second}$`);
      const options = { year: "2-digit" } as const;
      expect(formatDateRange(start, end, "ja-u-ca-japanese", options)).toMatch(
        expected,
      );
      expect(
        formatDateTimeRange(
          `${start}T00:00:00`,
          `${end}T00:00:00`,
          "ja-u-ca-japanese",
          options,
        ),
      ).toMatch(expected);
      expect(
        formatZonedRange(
          `${start}T00:00:00+00:00[UTC]`,
          `${end}T00:00:00+00:00[UTC]`,
          "ja-u-ca-japanese",
          options,
        ),
      ).toMatch(expected);
    },
  );

  it.each`
    start           | end             | expected
    ${"2019-04-30"} | ${"2020-05-01"} | ${/^平成31年\D+令和2年$/}
    ${"2019-05-01"} | ${"2020-05-01"} | ${/^令和元年\D+2年$/}
    ${"2024-07-10"} | ${"2034-07-10"} | ${/^令和6年\D+16年$/}
  `(
    "year numeric keeps the era year unpadded for $start to $end",
    ({ start, end, expected }) => {
      expect(
        formatDateRange(start, end, "ja-u-ca-japanese", { year: "numeric" }),
      ).toMatch(expected);
    },
  );

  it("pads a year of a range inside a numeric-only pattern as the engine does", () => {
    expect(
      formatDateRange("2024-07-10", "2025-07-10", "ja-u-ca-japanese", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
      }),
    ).toMatch(/^R06\/\d+\/10\D+07\/\d+\/10$/);
  });

  it("pads the year parts of a plain date-time and a zoned date in the joined parts", () => {
    expect(
      formatDateTime("2024-07-10T12:00:00", "ja-u-ca-japanese", {
        year: "2-digit",
      }),
    ).toBe("令和06年");
    expect(
      formatZonedToParts("2024-07-10T12:00:00+00:00[UTC]", "ja-u-ca-japanese", {
        year: "2-digit",
      }).find((part) => part.type === "year"),
    ).toEqual({ type: "year", value: "06" });
  });

  it("leaves a locale other than ja alone", () => {
    expect(
      formatDate("2024-07-10", "en-u-ca-japanese", {
        year: "2-digit",
        era: "short",
      }),
    ).toBe("06 Reiwa");
  });
});

describe("D27: ja japanese prints the era year in the formatter's numbering system", () => {
  // ECMA-402 FormatNumeric: the year is a number in the resolved numbering system, and "2-digit"
  // is `minimumIntegerDigits: 2`. 元 is a name, not a number, so it stays.
  it.each`
    locale                            | iso             | options                                               | expected
    ${"ja-u-ca-japanese-nu-arab"}     | ${"2024-07-10"} | ${{ year: "numeric" }}                                | ${"令和٦年"}
    ${"ja-u-ca-japanese-nu-arab"}     | ${"2024-07-10"} | ${{ year: "2-digit" }}                                | ${"令和٠٦年"}
    ${"ja-u-ca-japanese-nu-arab"}     | ${"2018-06-10"} | ${{ year: "2-digit" }}                                | ${"平成٣٠年"}
    ${"ja-u-ca-japanese-nu-arab"}     | ${"2019-05-01"} | ${{ year: "2-digit" }}                                | ${"令和元年"}
    ${"ja-u-ca-japanese-nu-fullwide"} | ${"2024-07-10"} | ${{ year: "numeric" }}                                | ${"令和６年"}
    ${"ja-u-ca-japanese-nu-fullwide"} | ${"2024-07-10"} | ${{ year: "2-digit" }}                                | ${"令和０６年"}
    ${"ja-u-ca-japanese-nu-arab"}     | ${"2024-07-10"} | ${{ dateStyle: "long" }}                              | ${"令和٦年٧月١٠日"}
    ${"ja-u-ca-japanese-nu-arab"}     | ${"2024-07-10"} | ${{ year: "2-digit", month: "long", day: "numeric" }} | ${"令和٠٦年٧月١٠日"}
  `(
    "formatDate prints '$expected' for '$locale' with $options at $iso",
    ({ locale, iso, options, expected }) => {
      expect(formatDate(iso, locale, options)).toBe(expected);
    },
  );

  it("leaves Latin digits for the latn numbering system", () => {
    expect(
      formatDate("2024-07-10", "ja-u-ca-japanese-nu-latn", { year: "numeric" }),
    ).toBe("令和6年");
  });

  it("prints no mixed digits in the year part or the joined parts", () => {
    const parts = formatDateToParts("2024-07-10", "ja-u-ca-japanese-nu-arab", {
      year: "2-digit",
    });
    expect(parts.find((part) => part.type === "year")).toEqual({
      type: "year",
      value: "٠٦",
    });
    expect(parts.map((part) => part.value).join("")).toBe("令和٠٦年");
  });

  it.each`
    start           | end             | options                | expected
    ${"2024-07-10"} | ${"2034-07-10"} | ${{ year: "numeric" }} | ${/^令和٦年\D+١٦年$/}
    ${"2024-07-10"} | ${"2034-07-10"} | ${{ year: "2-digit" }} | ${/^令和٠٦年\D+١٦年$/}
    ${"2019-05-01"} | ${"2020-05-01"} | ${{ year: "2-digit" }} | ${/^令和元年\D+٠٢年$/}
    ${"2019-04-30"} | ${"2020-05-01"} | ${{ year: "numeric" }} | ${/^平成٣١年\D+令和٢年$/}
  `(
    "a range from $start to $end with $options prints $expected",
    ({ start, end, options, expected }) => {
      const locale = "ja-u-ca-japanese-nu-arab";
      expect(formatDateRange(start, end, locale, options)).toMatch(expected);
      expect(
        formatZonedRange(
          `${start}T00:00:00+00:00[UTC]`,
          `${end}T00:00:00+00:00[UTC]`,
          locale,
          options,
        ),
      ).toMatch(expected);
    },
  );

  it("leaves a locale other than ja alone", () => {
    expect(
      formatDate("2024-07-10", "zh-u-ca-japanese-nu-arab", { year: "numeric" }),
    ).toBe("令和٦年");
  });
});

describe("D28: chinese and dangi related year at full width under year 2-digit", () => {
  // The related year is the Temporal `year` of the date in that calendar (native Temporal:
  // ISO 0005-07-10 is 5, -0001-07-10 is -1, 0099 is 99, 0100 is 100, 2024-07-10 is 2024).
  it.each`
    calendar     | iso                | expected
    ${"chinese"} | ${"0005-07-10"}    | ${"5"}
    ${"chinese"} | ${"-000001-07-10"} | ${"-1"}
    ${"chinese"} | ${"0099-07-10"}    | ${"99"}
    ${"chinese"} | ${"0100-07-10"}    | ${"100"}
    ${"chinese"} | ${"2024-07-10"}    | ${"2024"}
    ${"dangi"}   | ${"0005-07-10"}    | ${"5"}
    ${"dangi"}   | ${"-000001-07-10"} | ${"-1"}
    ${"dangi"}   | ${"0099-07-10"}    | ${"99"}
    ${"dangi"}   | ${"0100-07-10"}    | ${"100"}
    ${"dangi"}   | ${"2024-07-10"}    | ${"2024"}
  `(
    "prints related year '$expected' for '$calendar' at $iso, year 2-digit",
    ({ calendar, iso, expected }) => {
      const locale = `en-u-ca-${calendar}`;
      const options = { year: "2-digit" } as const;
      const text = formatDate(iso, locale, options);
      const parts = formatDateToParts(iso, locale, options);
      expect(parts.find((part) => part.type === "relatedYear")?.value).toBe(
        expected,
      );
      expect(text.startsWith(`${expected}(`)).toBe(true);
      expect(parts.map((part) => part.value).join("")).toBe(text);
      expect(
        formatZonedDateTime(`${iso}T12:00:00+00:00[UTC]`, locale, options),
      ).toBe(text);
      expect(formatDateTime(`${iso}T12:00:00`, locale, options)).toBe(text);
      expect(
        formatDate(iso, locale, { year: "numeric" }).startsWith(`${expected}(`),
      ).toBe(true);
    },
  );

  it.each`
    calendar     | iso                | expected
    ${"chinese"} | ${"-000001-07-10"} | ${"-1"}
    ${"chinese"} | ${"0005-07-10"}    | ${"5"}
    ${"dangi"}   | ${"-000001-07-10"} | ${"-1"}
    ${"dangi"}   | ${"0005-07-10"}    | ${"5"}
  `(
    "keeps month 2-digit and prints related year '$expected' for '$calendar' at $iso",
    ({ calendar, iso, expected }) => {
      const locale = `en-u-ca-${calendar}`;
      const options = { year: "2-digit", month: "2-digit" } as const;
      const text = formatDate(iso, locale, options);
      expect(text.endsWith(`/${expected}`)).toBe(true);
      expect(text.startsWith("0")).toBe(true);
      const parts = formatDateToParts(iso, locale, options);
      expect(parts.map((part) => part.type)).toEqual([
        "month",
        "literal",
        "relatedYear",
      ]);
      expect(parts.map((part) => part.value).join("")).toBe(text);
    },
  );

  it.each`
    locale                          | iso                | expected
    ${"en-u-ca-chinese-nu-arab"}    | ${"0005-07-10"}    | ${"٥"}
    ${"en-u-ca-chinese-nu-arab"}    | ${"-000001-07-10"} | ${"\u061C-١"}
    ${"en-u-ca-chinese-nu-arab"}    | ${"2024-07-10"}    | ${"٢٠٢٤"}
    ${"en-u-ca-dangi-nu-arab"}      | ${"0005-07-10"}    | ${"٥"}
    ${"zh-u-ca-chinese-nu-hanidec"} | ${"0005-07-10"}    | ${"五"}
    ${"zh-u-ca-chinese-nu-hanidec"} | ${"-000001-07-10"} | ${"-一"}
  `(
    "prints related year '$expected' in the numbering system of '$locale' at $iso",
    ({ locale, iso, expected }) => {
      expect(
        formatDateToParts(iso, locale, { year: "2-digit" }).find(
          (part) => part.type === "relatedYear",
        )?.value,
      ).toBe(expected);
    },
  );

  it("leaves a gregory year 2-digit and a chinese year numeric untouched", () => {
    expect(
      formatDate("2024-07-10", "en-u-ca-gregory", { year: "2-digit" }),
    ).toBe("24");
    expect(
      formatDate("0005-07-10", "en-u-ca-chinese", { year: "numeric" }),
    ).toMatch(/^5\(/);
  });

  it.each`
    calendar
    ${"chinese"}
    ${"dangi"}
  `(
    "prints every related year of a '$calendar' range unpadded, in all three functions",
    ({ calendar }) => {
      const locale = `en-u-ca-${calendar}`;
      const options = { year: "2-digit", month: "2-digit" } as const;
      const related = (text: string): string[] =>
        [...text.matchAll(/\/(-?\d+)/g)].map((match) => match[1] ?? "");
      expect(
        related(formatDateRange("0005-07-10", "0006-07-10", locale, options)),
      ).toEqual(["5", "6"]);
      expect(
        related(
          formatDateTimeRange(
            "0005-07-10T00:00:00",
            "0006-07-10T00:00:00",
            locale,
            options,
          ),
        ),
      ).toEqual(["5", "6"]);
      expect(
        related(
          formatZonedRange(
            "0005-07-10T00:00:00+00:00[UTC]",
            "0006-07-10T00:00:00+00:00[UTC]",
            locale,
            options,
          ),
        ),
      ).toEqual(["5", "6"]);
      expect(
        related(
          formatDateRange("-000001-07-10", "0005-07-10", locale, options),
        ),
      ).toEqual(["-1", "5"]);
      expect(
        related(formatDateRange("0005-07-10", "0005-08-10", locale, options)),
      ).toEqual(["5", "5"]);
    },
  );

  it.each`
    locale
    ${"en-u-ca-chinese"}
    ${"en-u-ca-dangi"}
  `(
    "leaves a 4-digit related year of a '$locale' range alone",
    ({ locale }) => {
      const text = formatDateRange("2024-07-10", "2025-07-10", locale, {
        year: "2-digit",
        month: "2-digit",
      });
      expect([...text.matchAll(/\/(-?\d+)/g)].map((match) => match[1])).toEqual(
        ["2024", "2025"],
      );
    },
  );

  it("prints a range that crosses from a 1-digit to a 3-digit related year at full width", () => {
    const text = formatDateRange(
      "0099-07-10",
      "0100-07-10",
      "en-u-ca-chinese",
      {
        year: "2-digit",
        month: "2-digit",
      },
    );
    expect([...text.matchAll(/\/(-?\d+)/g)].map((match) => match[1])).toEqual([
      "99",
      "100",
    ]);
  });
});

/*
 * The repairs sit under every public entry and under both ways of naming a calendar: the locale
 * keyword and the `calendar` option. Expected texts are the Gregorian twin's (D25), the empty value
 * (D26) and the 2-digit related year's full width (D28).
 */
describe("D25, D26: the calendar option and formatCalendar reach the same repairs", () => {
  it.each`
    label                      | call                                                                                                     | expected
    ${"D25 option, last day"}  | ${() => formatDate("1872-12-31", "en", { calendar: "japanese", year: "numeric" })}                       | ${"1872 AD"}
    ${"D25 option, first day"} | ${() => formatDate("1873-01-01", "en", { calendar: "japanese", year: "numeric" })}                       | ${"6 Meiji"}
    ${"D25 formatCalendar"}    | ${() => formatCalendar("1872-12-31T12:00:00", "en-u-ca-japanese", { reference: "1873-06-01T12:00:00" })} | ${"December 31, 1872 AD at 12:00 PM"}
    ${"D26 option, before"}    | ${() => formatDate("0600-07-10", "en", { calendar: "islamic-civil", era: "short", year: "numeric" })}    | ${""}
    ${"D26 option, after"}     | ${() => formatDate("2025-07-10", "en", { calendar: "islamic-civil", era: "short", year: "numeric" })}    | ${"1447 AH"}
  `("$label gives '$expected'", ({ call, expected }) => {
    expect(call()).toBe(expected);
  });
});
