import { convertUtcToUnix } from "../utc/convert/convertUtcToUnix";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { normalizeDateTime } from "./normalizeDateTime";
import { Temporal } from "./temporal";

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

/** The host's name for the era AM in a locale: the era of 2000-01-01, coptic 1716. */
const eraOf = (locale: string, era: "short" | "long" = "short"): string =>
  new Intl.DateTimeFormat(locale, { era, timeZone: "UTC" })
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

  it("leaves a date after 1 Tout AM 1 to the engine", () => {
    expect(formatDate("0284-08-30", "en-u-ca-coptic", full)).toBe(
      normalizeDateTime(
        new Intl.DateTimeFormat("en-u-ca-coptic", {
          ...full,
          timeZone: "UTC",
        }).format(
          convertUtcToUnix("0284-08-30T00:00:00Z", {
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

/** A text without its era name, which is the engine's wording, not the value. */
const withoutEra = (text: string, era: string): string =>
  normalizeDateTime(text.replaceAll(era, "")).replace(/\s+/g, " ").trim();

describe("D31: a coptic range with an end before AM 1 prints the signed years", () => {
  const era = eraOf("en-u-ca-coptic");
  const numeric = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  } as const;
  it.each`
    locale              | options | from               | to                 | expected
    ${"en-u-ca-coptic"} | ${full} | ${"-000001-07-10"} | ${"0001-07-10"}    | ${`Epep 18, -285 – Epep 18, -283 ${era}`}
    ${"en-u-ca-coptic"} | ${full} | ${"-000002-07-10"} | ${"-000001-07-10"} | ${`Epep 18, -286 – Epep 18, -285 ${era}`}
    ${"en-u-ca-coptic"} | ${full} | ${"-000001-07-10"} | ${"-000001-07-12"} | ${`Epep 18 – 20, -285 ${era}`}
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

  // The host's own kok range for these two dates aborts on V8 without 0426b0d1045d (every Node
  // line; D23), so its wording cannot be asked for. The numbers are the date's (27 Dec of year 0 and 13 Jan of year 1, with the era
  // dropped); their order and padding are the host's, so they are compared as a set of numbers.
  it("formatDateRange gives day 27 of month 12 in year 0 and day 13 of month 1 in year 1 in kok", () => {
    const kok = "kok-u-ca-coptic";
    const text = withoutEra(
      formatDateRange("0284-08-20", "0284-09-10", kok, numeric),
      eraOf(kok),
    );
    const numbers = (text.match(/\d+/g) ?? [])
      .map(Number)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([0, 1, 1, 12, 13, 27]);
  });

  // The engine's own kok range across ICU's old era boundary drops a field, so D29 writes the
  // range from its two singles (ECMA-402's `[[Default]]` fallback) and the start carries the era
  // too; D34's reader keeps a year-0 start on the era `am` on every engine.
});

/*
 * D34 (WebKit/WebKit#81144, bug 331724): JavaScriptCore changes the coptic era at one fixed instant
 * (0284-08-29T07:52:58Z), not at the start of the calendar day. Intl era/monthCode Table 2 gives
 * `coptic` the one era `am`, and 4.1.12 reads the era from the calendar date, so every instant of
 * 1 Tout AM 1 (ISO 0284-08-29) prints `AM`. The texts below are written out: the month, day and
 * year are the date's, the era is the host's name for AM in the locale (`AM`, or `ERA1` where its
 * ICU data has no English coptic era names), read from a later date.
 */
describe("D34: every instant of 1 Tout AM 1 prints the era AM", () => {
  const era = eraOf("en-u-ca-coptic");
  const zoned = (wallClock: string, timeZone: string): string =>
    Temporal.PlainDateTime.from(wallClock).toZonedDateTime(timeZone).toString();

  it.each`
    locale              | expected
    ${"en-u-ca-coptic"} | ${"Tout 1, 1"}
    ${"de-u-ca-coptic"} | ${"1. Thout 1"}
  `(
    "formatDate prints '$expected' and the era AM for 0284-08-29 in '$locale'",
    ({ locale, expected }) => {
      expect(formatDate("0284-08-29", locale, full)).toBe(
        normalizeDateTime(`${expected} ${eraOf(locale)}`),
      );
      expect(
        formatDateToParts("0284-08-29", locale, full).find(
          (part) => part.type === "era",
        )?.value,
      ).toBe(eraOf(locale));
    },
  );

  it.each`
    timeZone                 | wallClock
    ${"UTC"}                 | ${"0284-08-29T00:30:00"}
    ${"UTC"}                 | ${"0284-08-29T07:00:00"}
    ${"UTC"}                 | ${"0284-08-29T09:00:00"}
    ${"UTC"}                 | ${"0284-08-29T23:30:00"}
    ${"Asia/Tokyo"}          | ${"0284-08-29T00:30:00"}
    ${"Asia/Tokyo"}          | ${"0284-08-29T09:00:00"}
    ${"America/Los_Angeles"} | ${"0284-08-29T00:30:00"}
    ${"America/Los_Angeles"} | ${"0284-08-29T07:00:00"}
    ${"Pacific/Honolulu"}    | ${"0284-08-29T00:30:00"}
    ${"Pacific/Honolulu"}    | ${"0284-08-29T23:30:00"}
  `(
    "formatZonedDateTime prints the era AM for local $wallClock in '$timeZone'",
    ({ timeZone, wallClock }) => {
      expect(
        formatZonedDateTime(zoned(wallClock, timeZone), "en-u-ca-coptic", {
          era: "short",
          year: "numeric",
          hour: "numeric",
        }),
      ).toMatch(new RegExp(`^1 ${era}, \\d`, "u"));
      expect(
        formatZonedDateTime(zoned(wallClock, timeZone), "en-u-ca-coptic", full),
      ).toBe(`Tout 1, 1 ${era}`);
    },
  );

  // JavaScriptCore compares the instant, not the date, so east of +16:07:02 local 1 Tout 2 AM 1 is
  // still before 0284-08-29T07:52:58Z. The era is `am` for every date of year 1 (4.1.12).
  it.each`
    wallClock                | offset
    ${"0284-08-30T00:30:00"} | ${"+20:00"}
    ${"0284-08-30T07:00:00"} | ${"+20:00"}
    ${"0284-08-30T00:30:00"} | ${"+23:59"}
  `(
    "formatZonedDateTime prints Tout 2, 1 and the era AM for local $wallClock at $offset",
    ({ wallClock, offset }) => {
      expect(
        formatZonedDateTime(
          `${wallClock}${offset}[${offset}]`,
          "en-u-ca-coptic",
          full,
        ),
      ).toBe(`Tout 2, 1 ${era}`);
    },
  );

  // The mirror case: west of -07:52:58, local 0284-08-28 (year 0) can be an instant after the
  // engine's fixed constant, where JavaScriptCore reads year 1. The date decides the era.
  it.each`
    wallClock                | offset
    ${"0284-08-28T20:00:00"} | ${"-12:00"}
    ${"0284-08-28T23:59:00"} | ${"-23:59"}
    ${"0284-08-28T10:00:00"} | ${"-08:00"}
  `(
    "formatZonedDateTime prints Nasie 5, 0 and the era AM for local $wallClock at $offset",
    ({ wallClock, offset }) => {
      expect(
        formatZonedDateTime(
          `${wallClock}${offset}[${offset}]`,
          "en-u-ca-coptic",
          full,
        ),
      ).toBe(`Nasie 5, 0 ${era}`);
    },
  );

  it.each`
    offset
    ${"-12:00"}
    ${"-23:59"}
    ${"+20:00"}
  `(
    "formatZonedRange across 1 Tout AM 1 at $offset prints what UTC prints for the same dates",
    ({ offset }) => {
      const range = (suffix: string): string =>
        formatZonedRange(
          `0284-08-28T20:00:00${suffix}`,
          `0284-08-30T20:00:00${suffix}`,
          "en-u-ca-coptic",
          full,
        );
      expect(range(`${offset}[${offset}]`)).toBe(range("+00:00[UTC]"));
    },
  );

  it("prints year 0 of the day before AM 1 at 23:30 in Honolulu, with the era", () => {
    expect(
      formatZonedDateTime(
        zoned("0284-08-28T23:30:00", "Pacific/Honolulu"),
        "en-u-ca-coptic",
        full,
      ),
    ).toBe(`Nasie 5, 0 ${era}`);
  });

  it.each`
    start                 | end                   | expected
    ${"0284-08-29T00:00"} | ${"0284-09-10T00:00"} | ${"Tout 1 – 13, 1"}
    ${"0284-08-29T00:30"} | ${"0284-09-10T00:00"} | ${"Tout 1 – 13, 1"}
  `(
    "the ranges from $start to $end print '$expected' with the era AM once",
    ({ start, end, expected }) => {
      const text = normalizeDateTime(`${expected} ${era}`);
      expect(
        formatDateRange(
          start.slice(0, 10),
          end.slice(0, 10),
          "en-u-ca-coptic",
          full,
        ),
      ).toBe(text);
      expect(formatDateTimeRange(start, end, "en-u-ca-coptic", full)).toBe(
        text,
      );
      for (const timeZone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
        expect(
          formatZonedRange(
            zoned(start, timeZone),
            zoned(end, timeZone),
            "en-u-ca-coptic",
            full,
          ),
        ).toBe(text);
      }
    },
  );

  it("prints a long era once in a range that starts on 1 Tout AM 1", () => {
    expect(
      formatDateRange("0284-08-29", "0284-09-10", "en-u-ca-coptic", {
        ...full,
        era: "long",
      }),
    ).toBe(
      normalizeDateTime(`Tout 1 – 13, 1 ${eraOf("en-u-ca-coptic", "long")}`),
    );
  });

  it("names the era of 0284-08-29 in Arabic as it names the era of a later date", () => {
    expect(
      formatDateToParts("0284-08-29", "ar-u-ca-coptic", full).find(
        (part) => part.type === "era",
      )?.value,
    ).toBe(eraOf("ar-u-ca-coptic"));
  });

  it.each`
    iso             | expected
    ${"0284-08-30"} | ${"Tout 2, 1"}
    ${"2024-07-10"} | ${"Epep 3, 1740"}
  `(
    "leaves $iso to the engine: '$expected' and the era AM",
    ({ iso, expected }) => {
      expect(formatDate(iso, "en-u-ca-coptic", full)).toBe(
        normalizeDateTime(`${expected} ${era}`),
      );
    },
  );
});

/*
 * D34 in the range field reader: WebKit read the era of a year-0 start from the engine, got the
 * wrong one, and D29 then saw an era difference and printed the era after both ends. The reader
 * is repaired by D31's cycles, so a range across 1 Tout AM 1 prints the era once, after the end.
 */
describe("D34: a range across 1 Tout AM 1 prints the era once", () => {
  const era = eraOf("en-u-ca-coptic");
  const zoned = (wallClock: string, timeZone: string): string =>
    Temporal.PlainDateTime.from(wallClock).toZonedDateTime(timeZone).toString();

  it.each`
    from               | to              | expected
    ${"0284-08-28"}    | ${"0284-08-30"} | ${"Nasie 5, 0 – Tout 2, 1"}
    ${"-000001-07-10"} | ${"0300-01-01"} | ${"Epep 18, -285 – Toba 5, 16"}
  `(
    "formatDateRange, formatDateTimeRange and formatZonedRange print '$expected' and the era AM from $from to $to",
    ({ from, to, expected }) => {
      const text = normalizeDateTime(`${expected} ${era}`);
      expect(formatDateRange(from, to, "en-u-ca-coptic", full)).toBe(text);
      expect(
        formatDateTimeRange(
          `${from}T00:00:00`,
          `${to}T00:00:00`,
          "en-u-ca-coptic",
          full,
        ),
      ).toBe(text);
      for (const timeZone of [
        "UTC",
        "Asia/Tokyo",
        "America/Los_Angeles",
        "Pacific/Honolulu",
      ]) {
        expect(
          formatZonedRange(
            zoned(`${from}T00:00:00`, timeZone),
            zoned(`${to}T00:00:00`, timeZone),
            "en-u-ca-coptic",
            full,
          ),
        ).toBe(text);
      }
    },
  );
});
