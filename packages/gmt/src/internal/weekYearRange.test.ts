import { Temporal } from "./temporal";
import {
  formatRangeChecked,
  forgetWeekYearRange,
  markRangeHandled,
  repairRangeYear,
  rangeYearVerdict,
} from "./weekYearRange";

/*
 * CORE-112 slice 3c (D24 in ranges). The range pattern is another pattern from the single-date
 * one, so a formatter whose `format` is right can print the week-year in `formatRange`. Two kinds
 * of formatter are used:
 *
 * - Real engine formatters, where the expected years are the Temporal calendar year of each
 *   endpoint (ECMA-402 FormatDateTimePattern prints the calendar year, the era year with an era).
 * - A stand-in whose `formatRange` prints a year we choose, so the repair and the verdict are
 *   tested without reading any CLDR text: a Gregorian year printed one too high is the shape of a
 *   week-year at a year end, and a year printed five too high is not a week-year at all.
 */
const utc = { timeZone: "UTC" } as const;

const ms = (date: string): number =>
  Temporal.PlainDate.from(date).toZonedDateTime("UTC").epochMilliseconds;

const at = (dateTime: string): number =>
  Temporal.ZonedDateTime.from(`${dateTime}+00:00[UTC]`).epochMilliseconds;

/** The digit runs of a text, in order. */
const digits = (text: string | null): string[] => text?.match(/\d+/g) ?? [];

/**
 * An English formatter whose range text has every digit run rewritten by `rewrite`: the engine's
 * own layout and separators, with the years we choose. `resolvedOptions` and the rest come from
 * the real formatter, so the library reads it as it reads any other.
 */
function printing(
  options: Intl.DateTimeFormatOptions,
  rewrite: (run: string) => string,
): Intl.DateTimeFormat {
  const real = new Intl.DateTimeFormat("en", { ...options, ...utc });
  return {
    resolvedOptions: () => real.resolvedOptions(),
    formatRange: (start: number, end: number) =>
      real.formatRange(start, end).replace(/\d+/g, rewrite),
  } as unknown as Intl.DateTimeFormat;
}

const plusOne = (run: string): string => String(Number(run) + 1);
const plusFive = (run: string): string => String(Number(run) + 5);
const timesThree = (run: string): string => String(Number(run) * 3);

afterEach(() => {
  vi.restoreAllMocks();
  forgetWeekYearRange();
});

describe("repairRangeYear: a year printed above the calendar year", () => {
  const yearly = { year: "numeric" } as const;

  it.each`
    start           | end             | printed             | expected
    ${"2024-12-30"} | ${"2025-01-02"} | ${["2025", "2026"]} | ${["2024", "2025"]}
    ${"2026-07-01"} | ${"2026-09-04"} | ${["2027"]}         | ${["2026"]}
    ${"2023-03-05"} | ${"2025-03-05"} | ${["2024", "2026"]} | ${["2023", "2025"]}
  `(
    "writes the calendar years of $start and $end over $printed",
    ({ start, end, printed, expected }) => {
      const formatter = printing(yearly, plusOne);
      expect(digits(formatter.formatRange(ms(start), ms(end)))).toEqual(
        printed,
      );
      expect(
        digits(repairRangeYear(formatter, yearly, ms(start), ms(end))),
      ).toEqual(expected);
    },
  );

  it("keeps every character outside the year runs", () => {
    const real = new Intl.DateTimeFormat("en", { ...yearly, ...utc });
    const formatter = printing(yearly, plusOne);
    expect(
      repairRangeYear(formatter, yearly, ms("2024-12-30"), ms("2025-01-02")),
    ).toBe(real.formatRange(ms("2024-12-30"), ms("2025-01-02")));
  });

  it("writes the last two digits, padded, for year 2-digit", () => {
    const options = { year: "2-digit" } as const;
    const formatter = printing(options, (run) =>
      String((Number(run) + 1) % 100).padStart(2, "0"),
    );
    expect(
      digits(
        repairRangeYear(formatter, options, ms("2008-12-30"), ms("2009-01-02")),
      ),
    ).toEqual(["08", "09"]);
  });

  it("returns null when a year run is more than one away from the calendar year", () => {
    const formatter = printing(yearly, plusFive);
    expect(
      repairRangeYear(formatter, yearly, ms("2024-12-30"), ms("2025-01-02")),
    ).toBeNull();
  });

  it("returns null when the year runs cannot be located", () => {
    // Three times the year moves by three times the shift, so no digit run moves as a year.
    const formatter = printing(yearly, timesThree);
    expect(
      repairRangeYear(formatter, yearly, ms("2024-12-30"), ms("2025-01-02")),
    ).toBeNull();
  });
});

describe("rangeYearVerdict: stand-in formatters", () => {
  const yearly = { year: "numeric" } as const;

  it.each`
    label                            | rewrite                 | flagged
    ${"the calendar year"}           | ${(run: string) => run} | ${false}
    ${"the calendar year plus one"}  | ${plusOne}              | ${true}
    ${"the calendar year plus five"} | ${plusFive}             | ${true}
  `("is $flagged for a range that prints $label", ({ rewrite, flagged }) => {
    expect(rangeYearVerdict(printing(yearly, rewrite), yearly)).toBe(flagged);
  });

  it("is false for a range text with no decimal year", () => {
    const formatter = printing(yearly, () => "year");
    expect(rangeYearVerdict(formatter, yearly)).toBe(false);
  });
});

describe("repairRangeYear: calendars the polyfill cannot project", () => {
  const monthly = {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  } as const;

  // Temporal's own coptic and ethiopic years, read from the `ethioaa` calendar the polyfill can
  // project: 2024-07-10 to 2024-09-10 lies in coptic year 1740 and ethiopic year 2016 throughout.
  it.each`
    calendar      | year
    ${"coptic"}   | ${"1740"}
    ${"ethiopic"} | ${"2016"}
  `(
    "prints $year once for a $calendar range inside one year",
    ({ calendar, year }) => {
      const options = { ...monthly, calendar };
      const formatter = new Intl.DateTimeFormat("ak", options);
      const start = at("2024-07-10T12:00:00");
      const end = at("2024-09-10T12:00:00");
      expect(digits(repairRangeYear(formatter, options, start, end))).toEqual([
        year,
      ]);
    },
  );

  // Before ISO year 1 (native Temporal: coptic year -285 and -283, printed 286 and 284 by
  // ECMA-402's "1 - year" for a year <= 0; ethiopic era `aa` 5491 and 5493; indian -79 and -77).
  // The polyfill cannot read coptic or ethiopic at all, so `TEMPORAL_STAND_IN` computes the years
  // and the printed years must be accepted as the calendar years.
  it.each`
    calendar      | years
    ${"coptic"}   | ${["286", "284"]}
    ${"ethiopic"} | ${["5491", "5493"]}
  `(
    "accepts the printed years $years of a $calendar range before ISO year 1",
    ({ calendar, years }) => {
      const options = { ...monthly, calendar };
      const formatter = new Intl.DateTimeFormat("ak", options);
      const start = at("-000001-07-10T12:00:00");
      const end = at("+000001-07-10T12:00:00");
      expect(digits(repairRangeYear(formatter, options, start, end))).toEqual(
        years,
      );
    },
  );

  // The polyfill throws for `indian` before ISO year 1 (V8 bug 10529), so nothing is measured
  // and ICU's own text is the answer.
  it("returns the engine text for an indian range before ISO year 1", () => {
    const options = { ...monthly, calendar: "indian" };
    const formatter = new Intl.DateTimeFormat("ak", options);
    const start = at("-000001-07-10T12:00:00");
    const end = at("+000001-07-10T12:00:00");
    expect(repairRangeYear(formatter, options, start, end)).toBe(
      formatter.formatRange(start, end),
    );
  });
});

describe("rangeYearVerdict: real formatters", () => {
  it.each`
    locale                | options
    ${"en"}               | ${{ year: "numeric", month: "short", day: "numeric" }}
    ${"de"}               | ${{ year: "numeric", month: "long" }}
    ${"ja-u-ca-japanese"} | ${{ year: "numeric", month: "long", day: "numeric" }}
    ${"zh-u-ca-chinese"}  | ${{ year: "numeric", month: "long", day: "numeric" }}
    ${"kok-u-ca-ethioaa"} | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-indian"}  | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"ak-u-ca-coptic"}   | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"ak-u-ca-ethiopic"} | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"ak-u-ca-indian"}   | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"en"}               | ${{ hour: "numeric", minute: "numeric" }}
  `("does not flag '$locale' $options", ({ locale, options }) => {
    const formatter = new Intl.DateTimeFormat(locale, { ...options, ...utc });
    expect(rangeYearVerdict(formatter, options)).toBe(false);
  });

  it.each`
    locale                    | options
    ${"kok-u-ca-japanese"}    | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-coptic"}      | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-Deva-u-ca-coptic"} | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-ethiopic"}    | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"my-u-ca-buddhist"}     | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-roc"}         | ${{ year: "numeric", month: "numeric", day: "numeric", weekday: "short" }}
    ${"kok-u-ca-roc"}         | ${{ era: "short", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }}
  `("flags '$locale' $options", ({ locale, options }) => {
    const formatter = new Intl.DateTimeFormat(locale, { ...options, ...utc });
    expect(rangeYearVerdict(formatter, options)).toBe(true);
  });
});

describe("rangeYearVerdict: laziness", () => {
  const options = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  } as const;

  it("makes no range call when the formatter is built", () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatRange");
    new Intl.DateTimeFormat("kok-u-ca-japanese", { ...options, ...utc });
    expect(spy).not.toHaveBeenCalled();
  });

  it("probes on the first call and answers later calls from the kept verdict", () => {
    const formatter = new Intl.DateTimeFormat("kok-u-ca-japanese", {
      ...options,
      ...utc,
    });
    const spy = vi.spyOn(formatter, "formatRange");
    const first = rangeYearVerdict(formatter, options);
    const probed = spy.mock.calls.length;
    expect(probed).toBeGreaterThan(0);
    expect(rangeYearVerdict(formatter, options)).toBe(first);
    expect(spy.mock.calls.length).toBe(probed);
  });

  it("probes again for a formatter built after the verdicts were forgotten", () => {
    const formatter = new Intl.DateTimeFormat("en", { ...options, ...utc });
    rangeYearVerdict(formatter, options);
    const spy = vi.spyOn(formatter, "formatRange");
    forgetWeekYearRange();
    rangeYearVerdict(formatter, options);
    expect(spy.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("formatRangeChecked", () => {
  const yearly = { year: "numeric" } as const;
  const start = ms("2024-12-30");
  const end = ms("2025-01-02");

  it("answers with the engine's own text for a formatter that is not flagged", () => {
    const formatter = new Intl.DateTimeFormat("en", { ...yearly, ...utc });
    expect(formatRangeChecked(formatter, yearly, start, end)).toBe(
      formatter.formatRange(start, end),
    );
  });

  it("answers with the repaired text for a flagged formatter", () => {
    const formatter = printing(yearly, plusOne);
    expect(digits(formatRangeChecked(formatter, yearly, start, end))).toEqual([
      "2024",
      "2025",
    ]);
  });

  it("answers null for a flagged formatter whose year runs cannot be repaired", () => {
    const formatter = printing(yearly, plusFive);
    expect(formatRangeChecked(formatter, yearly, start, end)).toBeNull();
  });

  it("calls a stand-in that repairs its own range as it is, without a verdict", () => {
    const standIn = printing(yearly, plusOne);
    const spy = vi.spyOn(standIn, "formatRange");
    markRangeHandled(standIn);
    expect(digits(formatRangeChecked(standIn, yearly, start, end))).toEqual([
      "2025",
      "2026",
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
