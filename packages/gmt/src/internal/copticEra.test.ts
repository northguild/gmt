import { convertUtcToUnix } from "../utc/convert/convertUtcToUnix";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { normalizeDateTime } from "./normalizeDateTime";

/*
 * D31: the coptic calendar has one era, `am`, for every year (Intl era/monthCode Table 2: eraYear
 * -infinity to +infinity; 4.1.12: eraYear is year; test262
 * intl402/Temporal/PlainDate/from/non-positive-single-era-year.js keeps coptic eraYear -1 as -1).
 * ISO -000001-07-10 is coptic year -285 and 0001-07-10 is -283 (ISO 0001-01-01 is -283, ISO
 * 0001-12-31 is -282, ISO 0284-08-29 is year 1). An engine that prints `1 - year` with no era is
 * defective; the expected text is the signed year with the locale's minus in the formatter's
 * numbering system (written here with `Intl.NumberFormat`, which owns the minus and the digits),
 * and the era name is the engine's own for AM 1716.
 */
const numberFormat = (locale: string, value: number, digits = 1): string =>
  new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: digits,
  }).format(value);

const eraOf = (locale: string): string =>
  new Intl.DateTimeFormat(locale, { era: "short", timeZone: "UTC" })
    .formatToParts(
      convertUtcToUnix("2000-01-01T00:00:00Z", { epochUnit: "milliseconds" }) ??
        0,
    )
    .find((part) => part.type === "era")?.value ?? "";

const full = {
  era: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
} as const;

describe("D31: a coptic date before AM 1 prints its signed year and the era", () => {
  it.each`
    iso                | year    | label
    ${"-000001-07-10"} | ${-285} | ${"ISO -1"}
    ${"0001-07-10"}    | ${-283} | ${"ISO 1"}
    ${"0001-12-31"}    | ${-282} | ${"ISO 1 year end"}
    ${"0284-08-28"}    | ${0}    | ${"the day before AM 1"}
    ${"-000500-01-01"} | ${-784} | ${"ISO -500"}
  `(
    "formatDate prints coptic year $year for $label ($iso)",
    ({ iso, year }) => {
      const text = formatDate(iso, "en-u-ca-coptic", full);
      expect(text).toMatch(new RegExp(`, ${numberFormat("en", year)} `));
      expect(text.endsWith(eraOf("en-u-ca-coptic"))).toBe(true);
    },
  );

  it("prints 'Epep 18, -285 AM' for ISO -000001-07-10", () => {
    expect(formatDate("-000001-07-10", "en-u-ca-coptic", full)).toBe(
      `Epep 18, -285 ${eraOf("en-u-ca-coptic")}`,
    );
  });

  it("splits the date into month, day, year and era parts, the year signed", () => {
    expect(formatDateToParts("-000001-07-10", "en-u-ca-coptic", full)).toEqual([
      { type: "month", value: "Epep" },
      { type: "literal", value: " " },
      { type: "day", value: "18" },
      { type: "literal", value: ", " },
      { type: "year", value: "-285" },
      { type: "literal", value: " " },
      { type: "era", value: eraOf("en-u-ca-coptic") },
    ]);
  });

  it.each`
    locale                 | digitsOf
    ${"ar-u-ca-coptic"}    | ${"ar"}
    ${"kok-u-ca-coptic"}   | ${"kok"}
    ${"fa-u-ca-coptic"}    | ${"fa"}
    ${"en-u-ca-coptic"}    | ${"en"}
    ${"ar-EG-u-ca-coptic"} | ${"ar-EG"}
  `(
    "prints the year of '$locale' as Intl.NumberFormat writes -285",
    ({ locale }) => {
      const parts = formatDateToParts("-000001-07-10", locale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      const resolved = new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
      }).resolvedOptions();
      const expected = new Intl.NumberFormat(
        new Intl.Locale(resolved.locale).baseName,
        { numberingSystem: resolved.numberingSystem, useGrouping: false },
      ).format(-285);
      expect(parts.find((part) => part.type === "year")?.value).toBe(expected);
    },
  );

  it.each`
    options                                               | expected
    ${{ year: "2-digit" }}                                | ${"-85"}
    ${{ year: "numeric" }}                                | ${"-285"}
    ${{ year: "numeric", month: "long", day: "numeric" }} | ${"-285"}
  `(
    "prints '$expected' as the year part for options $options",
    ({ options, expected }) => {
      const parts = formatDateToParts(
        "-000001-07-10",
        "en-u-ca-coptic",
        options,
      );
      expect(parts.find((part) => part.type === "year")?.value).toBe(expected);
    },
  );

  it("leaves a date from AM 1 on to the engine", () => {
    expect(formatDate("0284-08-29", "en-u-ca-coptic", full)).toBe(
      normalizeDateTime(
        new Intl.DateTimeFormat("en-u-ca-coptic", {
          ...full,
          timeZone: "UTC",
        }).format(
          convertUtcToUnix("0284-08-29T00:00:00Z", {
            epochUnit: "milliseconds",
          }) ?? 0,
        ),
      ),
    );
  });

  it("prints the same year for a zoned date", () => {
    expect(
      formatZonedDateTime(
        "-000001-07-10T12:00:00+00:00[UTC]",
        "en-u-ca-coptic",
        full,
      ),
    ).toBe(`Epep 18, -285 ${eraOf("en-u-ca-coptic")}`);
  });

  it("leaves ethiopic alone: era aa, a positive year", () => {
    expect(formatDate("-000001-07-10", "en-u-ca-ethiopic", full)).toMatch(
      /, 5491 /,
    );
  });
});

describe("D31: a coptic range with an end before AM 1 prints the signed years", () => {
  const era = eraOf("en-u-ca-coptic");
  const numeric = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  } as const;
  it.each`
    locale               | options    | from               | to                 | expected
    ${"en-u-ca-coptic"}  | ${full}    | ${"-000001-07-10"} | ${"0001-07-10"}    | ${`Epep 18, -285 – Epep 18, -283 ${era}`}
    ${"en-u-ca-coptic"}  | ${full}    | ${"-000002-07-10"} | ${"-000001-07-10"} | ${`Epep 18, -286 – Epep 18, -285 ${era}`}
    ${"en-u-ca-coptic"}  | ${full}    | ${"-000001-07-10"} | ${"-000001-07-12"} | ${`Epep 18 – 20, -285 ${era}`}
    ${"kok-u-ca-coptic"} | ${numeric} | ${"0001-01-01"}    | ${"0001-12-31"}    | ${`8-5--283 – 7-5--282 ${era}`}
  `(
    "formatDateRange prints '$expected' for '$locale' from $from to $to",
    ({ locale, options, from, to, expected }) => {
      expect(formatDateRange(from, to, locale, options)).toBe(
        normalizeDateTime(expected),
      );
      expect(
        formatDateTimeRange(
          `${from}T00:00:00`,
          `${to}T00:00:00`,
          locale,
          options,
        ),
      ).toBe(normalizeDateTime(expected));
      expect(
        formatZonedRange(
          `${from}T00:00:00+00:00[UTC]`,
          `${to}T00:00:00+00:00[UTC]`,
          locale,
          options,
        ),
      ).toBe(normalizeDateTime(expected));
    },
  );

  // The engine's own kok range across ICU's old era boundary drops a field, so where D29 runs the
  // range is written from its two singles (ECMA-402's `[[Default]]` fallback) and the start carries
  // the era too. The years and the era hold either way; the range pattern is the engine's.
  it("prints a range that crosses AM 1 with the year 0 start and the year 1 end", () => {
    expect(
      formatDateRange("0284-08-20", "0284-09-10", "kok-u-ca-coptic", numeric),
    ).toMatch(new RegExp(`^27-12-0(?: ${era})? \\S 13-1-1 ${era}$`, "u"));
  });
});
