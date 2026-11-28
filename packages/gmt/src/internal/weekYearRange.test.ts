import { repairCopticEra } from "./copticEra";
import { markRangeHandled } from "./rangeHooks";
import { Temporal } from "./temporal";
import {
  formatRangeChecked,
  forgetWeekYearRange,
  MAX_MOMENTS,
  repairRangeYear,
  rangeYearVerdict,
} from "./weekYearRange";

/*
 * CORE-112 (D24 in ranges). The range pattern is another pattern from the single-date
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

/**
 * The numbers of a text, in order. A digit run inside a word is part of a name, not a number: an
 * era is a name (UTS #35 Part 4 §8, `G`), and ICU data without a locale's coptic or ethiopic era
 * names prints the placeholder `ERA1` ("1740 ERA1").
 */
const digits = (text: string | null): string[] =>
  text?.match(/(?<!\p{L})\p{Nd}+(?!\p{L})/gu) ?? [];

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

/*
 * What one environment remembers is keyed by the caller's moments, so it must start again at a
 * size: a process that formats ranges for years would otherwise keep every start and end it saw.
 * The engine is asked again after that, and gives the same text.
 */
describe("repairRangeYear: what one environment remembers", () => {
  const options = { year: "numeric" } as const;
  const start = ms("2024-12-30");
  const end = ms("2025-01-02");
  const DAY = 86_400_000;

  /** How many times `run` reaches for an engine formatter's `format` (an accessor in ECMA-402). */
  const readsDuring = (run: () => void): number => {
    // TypeScript's lib types `format` as a method, so the accessor is spied through a wider type.
    const proto: { readonly format: unknown } = Intl.DateTimeFormat.prototype;
    const reads = vi.spyOn(proto, "format", "get");
    run();
    const count = reads.mock.calls.length;
    reads.mockRestore();
    return count;
  };

  it("forgets the first range once the others fill its maps, and repairs it the same", () => {
    const formatter = printing(options, plusOne);
    const first = repairRangeYear(formatter, options, start, end);
    expect(digits(first)).toEqual(["2024", "2025"]);
    const warm = readsDuring(() => {
      expect(repairRangeYear(formatter, options, start, end)).toBe(first);
    });
    // A week apart, so no range shares a start or end with another: each adds two moments.
    for (let i = 1; i <= MAX_MOMENTS / 2; i++) {
      repairRangeYear(
        formatter,
        options,
        start + i * 7 * DAY,
        end + i * 7 * DAY,
      );
    }
    const cold = readsDuring(() => {
      expect(repairRangeYear(formatter, options, start, end)).toBe(first);
    });
    expect(cold).toBeGreaterThan(warm);
  }, 15_000);
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

  // Before ISO year 1 (ethiopic era `aa` 5491 and 5493, in the polyfill and native Temporal): the
  // printed years must be accepted as the calendar years. Coptic has one era `am` for every year (Intl era/monthCode
  // Table 2, 4.1.12: eraYear is year), so -285 and -283 are the answer; the engine's own "1 - year"
  // text is D31 and `copticEra.ts` repairs it (below).
  it.each`
    calendar      | years
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

  it("prints the signed coptic years -285 and -283 for a coptic range before ISO year 1", () => {
    const options = { ...monthly, calendar: "coptic" };
    const formatter = repairCopticEra(
      new Intl.DateTimeFormat("ak", options),
      options,
    );
    const text = formatRangeChecked(
      formatter,
      options,
      at("-000001-07-10T12:00:00"),
      at("+000001-07-10T12:00:00"),
    );
    const minus = new Intl.NumberFormat("ak", { useGrouping: false })
      .format(-1)
      .replace(/\p{Nd}/gu, "");
    expect(digits(text)).toEqual(["285", "283"]);
    expect(text).toContain(`${minus}285`);
    expect(text).toContain(`${minus}283`);
  });

  // An indian range across ISO year 1 is measured like any other; ICU prints its years right, so
  // its own text is the answer.
  it("returns the engine text for an indian range across ISO year 1", () => {
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
    locale                           | options
    ${"en"}                          | ${{ year: "numeric", month: "short", day: "numeric" }}
    ${"de"}                          | ${{ year: "numeric", month: "long" }}
    ${"ja-u-ca-japanese"}            | ${{ year: "numeric", month: "long", day: "numeric" }}
    ${"zh-u-ca-chinese"}             | ${{ year: "numeric", month: "long", day: "numeric" }}
    ${"kok-u-ca-ethioaa"}            | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-indian"}             | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"ak-u-ca-coptic"}              | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"ak-u-ca-ethiopic"}            | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"ak-u-ca-indian"}              | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"en"}                          | ${{ hour: "numeric", minute: "numeric" }}
    ${"ar-SA-u-ca-islamic-umalqura"} | ${{ year: "numeric", month: "short", day: "numeric" }}
    ${"en-u-ca-islamic-civil"}       | ${{ year: "numeric", month: "long" }}
    ${"en-u-ca-islamic-tbla"}        | ${{ year: "numeric", month: "numeric", day: "numeric" }}
  `("does not flag '$locale' $options", ({ locale, options }) => {
    // The Islamic rows hold on WebKit too: its `format` prints a year before 1 AH as `153 Before
    // Hijra` and its `formatRange` as `-152`, a disagreement the earlier-era walk must not read as
    // a week-year, because GMT prints no date before the Hijra (D26).
    const formatter = new Intl.DateTimeFormat(locale, { ...options, ...utc });
    expect(rangeYearVerdict(formatter, options)).toBe(false);
  });

  /*
   * Whether a real formatter is flagged is the host's data: Node's ICU prints a week-year in these
   * range patterns, while Chromium's `kok` data does not, and Chromium has no `my` data, so it
   * falls back to `en-US` (ECMA-402 ResolveLocale) and keeps only the `calendar` option. So each
   * row names a witness range where the defect shows when the host has it, with the years the
   * calendar gives each end (any one of the forms listed: the era year ICU prints for an era
   * before AM 1, or the signed year), and the verdict must be true exactly when the host's text
   * for that witness leaves out a year:
   *   - kok japanese, 2016-06-01 is Heisei 28 (2016 - 1988) and 2034-12-31 is Reiwa 16
   *     (2034 - 2018), across the era change.
   *   - kok coptic, ISO -0560-01-21 is coptic -844 (ICU's era before AM 1 prints 845, 1 - year)
   *     and ISO 2034-09-10 is coptic 1750, month 13 (1751 starts on 2034-09-11).
   *   - kok ethiopic, the same dates: Amete Alem 4932 (year -568, as 5501 AA is 1 AM) and
   *     2026 AM, month 13 (Ethiopic is coptic + 276).
   *   - my buddhist, 2034-12-30 and 2034-12-31 are BE 2577 (2034 + 543).
   *   - kok roc, the same dates are ROC 123 (2034 - 1911).
   */
  const witnesses = {
    japanese: ["2016-06-01", "2034-12-31", [[28], [16]]],
    coptic: ["-000560-01-21", "2034-09-10", [[845, -844], [1750]]],
    ethiopic: ["-000560-01-21", "2034-09-10", [[4932, -568], [2026]]],
    buddhist: ["2034-12-30", "2034-12-31", [[2577], [2577]]],
    roc: ["2034-12-30", "2034-12-31", [[123], [123]]],
  } as const;

  /**
   * Whether the host prints another year than the calendar's in the calendar's witness: in its
   * range text, the start's year must be a run of digits and the end's a later run (both ends
   * print their year in these patterns, even when it is the same); and in its single text of the
   * start, because a range whose ends print alike is the start's single (ECMA-402
   * PartitionDateTimeRangePattern), so a host whose single prints the week-year or the ISO year
   * (Firefox, `my` buddhist: `BE 30/12/2034`) prints it in every such range too.
   */
  const hostPrintsAnotherYear = (formatter: Intl.DateTimeFormat): boolean => {
    const { calendar, locale, numberingSystem } = formatter.resolvedOptions();
    const [from, to, years] = witnesses[calendar as keyof typeof witnesses];
    const written = new Intl.NumberFormat(locale, {
      numberingSystem,
      useGrouping: false,
    });
    const holds = (run: string, forms: readonly number[]): boolean =>
      forms.some((year) => run === written.format(Math.abs(year)));
    const single = formatter.format(ms(from)).match(/\p{Nd}+/gu) ?? [];
    if (!single.some((run) => holds(run, years[0]))) return true;
    const runs =
      formatter.formatRange(ms(from), ms(to)).match(/\p{Nd}+/gu) ?? [];
    let next = 0;
    for (const forms of years) {
      const found = runs.findIndex(
        (run, index) => index >= next && holds(run, forms),
      );
      if (found < 0) return true;
      next = found + 1;
    }
    return false;
  };

  it.each`
    locale                    | options
    ${"kok-u-ca-japanese"}    | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-coptic"}      | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-Deva-u-ca-coptic"} | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-ethiopic"}    | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"my-u-ca-buddhist"}     | ${{ year: "numeric", month: "numeric", day: "numeric" }}
    ${"kok-u-ca-roc"}         | ${{ year: "numeric", month: "numeric", day: "numeric", weekday: "short" }}
    ${"kok-u-ca-roc"}         | ${{ era: "short", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }}
  `(
    "flags '$locale' $options exactly when the host prints another year in its witness range",
    ({ locale, options }) => {
      const formatter = new Intl.DateTimeFormat(locale, {
        ...options,
        ...utc,
        calendar: new Intl.Locale(locale).calendar,
      });
      expect(rangeYearVerdict(formatter, options)).toBe(
        hostPrintsAnotherYear(formatter),
      );
    },
  );
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
