import { formatDate } from "../plain/format/formatDate";
import { formatDateTimeToParts } from "../plain/format/formatDateTimeToParts";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { Temporal } from "./temporal";

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
function expectedYear(
  iso: string,
  locale: string,
  calendar: string,
  width: "numeric" | "2-digit",
  hasEra: boolean,
): string {
  const date = Temporal.PlainDate.from(iso).withCalendar(calendar);
  const year = hasEra ? (date.eraYear ?? date.year) : date.year;
  const numberingSystem = new Intl.DateTimeFormat(locale).resolvedOptions()
    .numberingSystem;
  const digits = new Intl.NumberFormat(locale, {
    numberingSystem,
    useGrouping: false,
    minimumIntegerDigits: width === "2-digit" ? 2 : 1,
  }).format(year);
  return width === "2-digit" ? [...digits].slice(-2).join("") : digits;
}

describe("single date, week-year patterns", () => {
  it.each`
    locale                | options                                                                                  | iso             | calendar      | width        | hasEra   | expected                             | label
    ${"gd"}               | ${{ year: "numeric", month: "short" }}                                                   | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"Dùbh 2024"}                       | ${"gd month short, year-end"}
    ${"gd"}               | ${{ year: "numeric", month: "short" }}                                                   | ${"2027-01-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"Faoi 2027"}                       | ${"gd month short, year-start"}
    ${"gd"}               | ${{ year: "numeric", month: "short" }}                                                   | ${"2025-07-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"Iuch 2025"}                       | ${"gd month short, mid-year control"}
    ${"ksh"}              | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"2024-12"}                         | ${"ksh numeric, year-end"}
    ${"ksh"}              | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2027-01-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"2027-01"}                         | ${"ksh numeric, year-start"}
    ${"ksh"}              | ${{ year: "2-digit", month: "2-digit" }}                                                 | ${"2024-12-30"} | ${"gregory"}  | ${"2-digit"} | ${false} | ${"24-12"}                           | ${"ksh 2-digit, year-end"}
    ${"sc"}               | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"12/2024"}                         | ${"sc numeric, year-end"}
    ${"sc"}               | ${{ year: "numeric", month: "numeric" }}                                                 | ${"2027-01-01"} | ${"gregory"}  | ${"numeric"} | ${false} | ${"01/2027"}                         | ${"sc numeric, year-start"}
    ${"te-u-ca-buddhist"} | ${{ year: "numeric", month: "long" }}                                                    | ${"2026-07-01"} | ${"buddhist"} | ${"numeric"} | ${false} | ${"జులై 2569"}                        | ${"te buddhist, mid-year"}
    ${"te-u-ca-buddhist"} | ${{ year: "numeric", month: "long" }}                                                    | ${"2026-12-31"} | ${"buddhist"} | ${"numeric"} | ${false} | ${"డిసెంబర్ 2569"}                      | ${"te buddhist, year-end"}
    ${"my-u-ca-japanese"} | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2026-07-01"} | ${"japanese"} | ${"numeric"} | ${true}  | ${"R ၀၁/၀၇/၈"}                       | ${"my japanese numeric"}
    ${"my-u-ca-japanese"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }}                                 | ${"2026-07-01"} | ${"japanese"} | ${"2-digit"} | ${true}  | ${"R ၀၁/၀၇/၀၈"}                      | ${"my japanese 2-digit"}
    ${"my-u-ca-japanese"} | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2024-12-30"} | ${"japanese"} | ${"numeric"} | ${true}  | ${"R ၃၀/၁၂/၆"}                       | ${"my japanese year-end"}
    ${"my-u-ca-buddhist"} | ${{ year: "numeric", month: "numeric", day: "numeric" }}                                 | ${"2026-07-01"} | ${"buddhist"} | ${"numeric"} | ${true}  | ${"BE ၀၁/၀၇/၂၅၆၉"}                   | ${"my buddhist numeric"}
    ${"de-CH"}            | ${{ era: "short", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }} | ${"2024-12-30"} | ${"gregory"}  | ${"numeric"} | ${true}  | ${"Mo., 12.30.2024 n. Chr."}         | ${"de-CH era short, month and day as CLDR orders them"}
    ${"gl-u-ca-hebrew"}   | ${{ dateStyle: "full" }}                                                                 | ${"2026-09-12"} | ${"hebrew"}   | ${"numeric"} | ${false} | ${"sábado, 1 de Tishri de 5787 AM"}  | ${"gl hebrew dateStyle full, 1 Tishri"}
    ${"gl-u-ca-hebrew"}   | ${{ dateStyle: "full" }}                                                                 | ${"2026-09-13"} | ${"hebrew"}   | ${"numeric"} | ${false} | ${"domingo, 2 de Tishri de 5787 AM"} | ${"gl hebrew dateStyle full, 2 Tishri"}
    ${"gl-u-ca-roc"}      | ${{ dateStyle: "full" }}                                                                 | ${"2026-07-01"} | ${"roc"}      | ${"numeric"} | ${true}  | ${"mércores, 1 de xullo de 115 ROC"} | ${"gl roc dateStyle full, unpadded"}
  `(
    "formatDate and formatDateToParts print the calendar year for $label ('$locale', $iso)",
    ({ locale, options, iso, calendar, width, hasEra, expected }) => {
      const year = expectedYear(iso, locale, calendar, width, hasEra);
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
    expect(
      formatDateToParts("2024-12-30", "gd", {
        year: "numeric",
        month: "short",
      }),
    ).toEqual([
      { type: "month", value: "Dùbh" },
      { type: "literal", value: " " },
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
    expect(parts.map((part) => part.value).join("")).toBe("Dùbh 2024, 14:05");
    expect(parts.map((part) => part.type)).toEqual([
      "month",
      "literal",
      "year",
      "literal",
      "hour",
      "literal",
      "minute",
    ]);
  });

  it.each`
    locale                | options
    ${"en"}               | ${{ year: "numeric", month: "long" }}
    ${"de"}               | ${{ year: "numeric", month: "long" }}
    ${"fr"}               | ${{ year: "numeric", month: "long" }}
    ${"ja-u-ca-japanese"} | ${{ year: "numeric", month: "long" }}
    ${"zh-u-ca-chinese"}  | ${{ year: "numeric", month: "long" }}
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
