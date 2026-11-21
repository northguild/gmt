import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { runInBoundedChild } from "../test/boundedChild";
import {
  hostEraAt,
  hostFormatter,
  hostJoinedWithYears,
  hostRangeWithYears,
} from "../test/hostIntl";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { normalizeDateTime } from "./normalizeDateTime";

/*
 * CORE-112 (D24): a range prints the calendar year at each end, never the week-year.
 *
 * Every year below is the Temporal calendar year of that endpoint (`eraYear ?? year` where the
 * pattern prints an era), not the engine's text:
 *   - kok japanese, 2018-12-27: Heisei 30 (Heisei ended 2019-04-30); 2019-12-27: Reiwa 1.
 *   - my buddhist, 2026-12-27: BE 2569 = 2026 + 543; 2027-01-03: BE 2570.
 *   - kok roc, 2024-07-10 and 2024-07-12: ROC 113 = 2024 - 1911.
 *   - kok-Deva coptic, 2029-09-09 and 2029-09-10: Coptic 1745 AM (year 1745 runs from
 *     2028-09-11 to 2029-09-10); month 13, so the polyfill cannot derive it (defect F).
 * The years are the value; the layout, separators, digits and era text are the host's wording
 * (read from the host's own `Intl`), so the expected text is the host's own range with these years written
 * in (`hostRangeWithYears`). The en dash is written as `-`, as GMT normalizes every formatted
 * string.
 *
 * A host whose range fails the D29 field check (Firefox's `my` buddhist range prints no era and
 * another day width at its end, while its single prints the week-year) gets ECMA-402's
 * `[[Default]]` from D29: its two singles, each with the calendar year, joined by the fallback
 * (`hostJoinedWithYears`). Either text is the host's text for the same two years.
 */
describe("range, week-year patterns", () => {
  const numeric = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  } as const;
  const weekdayShort = { ...numeric, weekday: "short" } as const;
  const withEra = { era: "short", ...weekdayShort } as const;

  it.each`
    locale                    | options         | from            | to              | years           | label
    ${"kok-u-ca-japanese"}    | ${numeric}      | ${"2018-12-27"} | ${"2019-12-27"} | ${[30, 1]}      | ${"kok japanese, Heisei to Reiwa"}
    ${"my-u-ca-buddhist"}     | ${numeric}      | ${"2026-12-27"} | ${"2027-01-03"} | ${[2569, 2570]} | ${"my buddhist, over New Year"}
    ${"kok-u-ca-roc"}         | ${weekdayShort} | ${"2024-07-10"} | ${"2024-07-12"} | ${[113, 113]}   | ${"kok roc, option set 12"}
    ${"kok-u-ca-roc"}         | ${withEra}      | ${"2024-07-10"} | ${"2024-07-12"} | ${[113, 113]}   | ${"kok roc, option set 19"}
    ${"kok-Deva-u-ca-coptic"} | ${numeric}      | ${"2029-09-09"} | ${"2029-09-10"} | ${[1745, 1745]} | ${"kok-Deva coptic, control"}
  `(
    "formatDateRange and formatDateTimeRange print the calendar year for $label ('$locale', $from to $to)",
    ({ locale, options, from, to, years }) => {
      const expected = [
        hostRangeWithYears(locale, options, from, to, years),
        hostJoinedWithYears(locale, options, from, to, years),
      ];
      expect(expected).toContain(formatDateRange(from, to, locale, options));
      expect(expected).toContain(
        formatDateTimeRange(
          `${from}T00:00:00`,
          `${to}T00:00:00`,
          locale,
          options,
        ),
      );
      expect(expected).toContain(
        formatZonedRange(
          `${from}T00:00:00+00:00[UTC]`,
          `${to}T00:00:00+00:00[UTC]`,
          locale,
          options,
        ),
      );
    },
  );

  it("formatZonedRange prints the calendar year beside a zone name, in a child process", async () => {
    const from = "2026-12-27T09:30:00+06:30[Asia/Yangon]";
    const to = "2027-01-03T09:30:00+06:30[Asia/Yangon]";
    const options =
      '{ year: "numeric", month: "numeric", day: "numeric", timeZoneName: "short" }';
    const run = await runInBoundedChild([
      `gmt.formatZonedRange("${from}", "${to}", "my-u-ca-buddhist", ${options})`,
    ]);
    expect(
      { timedOut: run.timedOut, crashed: run.crashed },
      run.stderr,
    ).toEqual({ timedOut: false, crashed: false });
    // The years in the formatter's numbering system: Burmese digits where the host has `my` data.
    const { locale, numberingSystem } = hostFormatter(
      "my-u-ca-buddhist",
      {},
    ).resolvedOptions();
    const written = (year: number): string =>
      new Intl.NumberFormat(locale, {
        numberingSystem,
        useGrouping: false,
      }).format(year);
    const range = String(run.calls[0]?.value);
    expect(range).toContain(written(2569));
    expect(range).toContain(written(2570));
    expect(range).not.toContain(written(2026));
    expect(range).not.toContain(written(2027));
  });
});

/*
 * Slice 3c before ISO year 1, in the calendars the polyfill cannot project directly (`TEMPORAL_STAND_IN`
 * for coptic and ethiopic, `readable()` for indian). Each year is the Temporal year of the
 * endpoint (native Temporal, which projects these calendars before ISO year 1): coptic has the
 * one era `am` for every year (Intl era/monthCode Table 2, 4.1.12: eraYear is year), so coptic
 * year -285 (ISO -0001-07-10) and -283 print as they are, with the locale's minus and the era name
 * (D31, `copticEra.ts`; ICU prints 286 and 284 with no era); ethiopic prints the era year of the
 * `aa` era (5491, 5493) because its years before AM 1 have that era; indian is one signed era, so
 * -79 and -77 print as they are, with the locale's minus. The expected text is the host's range
 * with these years written in. Where the host drops the coptic era the library writes it back,
 * and its place is `copticEra.test.ts`'s to check, so here the era is left out of both sides and
 * the library's text must hold it once.
 */
describe("range, calendar year before ISO year 1", () => {
  const numeric = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  } as const;

  // The era of every coptic year is AM (Intl era/monthCode Table 2), named as the host names it in
  // a positive year. Before AM 1 the host's own range names another era or none (D31), and not
  // always the one its `format` names for the same date: ICU data without kok coptic era names
  // prints `Anno Martyrum` from `format` and `ERA0` from `formatRange`. So every word leaves the
  // host's range (the dates are numeric), the library's era leaves its text, and that era is
  // counted on its own.
  const withoutEra = (text: string, era: string): string =>
    normalizeDateTime(text.replaceAll(era, ""));
  const withoutWords = (text: string): string =>
    normalizeDateTime(text.replace(/[\p{L}\p{M}][\p{L}\p{M}\p{Nd}]*/gu, ""));

  it.each`
    locale                    | from               | to                 | years           | era      | label
    ${"kok-u-ca-coptic"}      | ${"-000001-07-10"} | ${"0001-07-10"}    | ${[-285, -283]} | ${true}  | ${"coptic -285 to -283"}
    ${"kok-Deva-u-ca-coptic"} | ${"-000001-07-10"} | ${"0001-07-10"}    | ${[-285, -283]} | ${true}  | ${"kok-Deva coptic -285 to -283"}
    ${"kok-u-ca-coptic"}      | ${"-000002-07-10"} | ${"-000001-07-10"} | ${[-286, -285]} | ${true}  | ${"coptic -286 to -285"}
    ${"kok-u-ca-coptic"}      | ${"0001-01-01"}    | ${"0001-12-31"}    | ${[-283, -282]} | ${true}  | ${"coptic -283 to -282, across the coptic new year"}
    ${"kok-u-ca-ethiopic"}    | ${"-000001-07-10"} | ${"0001-07-10"}    | ${[5491, 5493]} | ${false} | ${"ethiopic aa 5491 to 5493"}
    ${"kok-u-ca-ethiopic"}    | ${"-000002-07-10"} | ${"-000001-07-10"} | ${[5490, 5491]} | ${false} | ${"ethiopic aa 5490 to 5491"}
    ${"kok-u-ca-ethiopic"}    | ${"0001-01-01"}    | ${"0001-12-31"}    | ${[5493, 5494]} | ${false} | ${"ethiopic aa 5493 to 5494"}
    ${"kok-u-ca-indian"}      | ${"-000001-07-10"} | ${"0001-07-10"}    | ${[-79, -77]}   | ${false} | ${"indian -79 to -77"}
    ${"kok-u-ca-indian"}      | ${"-000002-07-10"} | ${"-000001-07-10"} | ${[-80, -79]}   | ${false} | ${"indian -80 to -79"}
    ${"kok-u-ca-indian"}      | ${"0001-01-01"}    | ${"0001-12-31"}    | ${[-78, -77]}   | ${false} | ${"indian -78 to -77"}
  `(
    "the three range functions print the calendar year for $label ('$locale', $from to $to)",
    ({ locale, from, to, years, era }) => {
      const expected = hostRangeWithYears(locale, numeric, from, to, years);
      const name = era ? hostEraAt(locale, "2029-01-01") : "";
      const texts = [
        formatDateRange(from, to, locale, numeric),
        formatDateTimeRange(
          `${from}T00:00:00`,
          `${to}T00:00:00`,
          locale,
          numeric,
        ),
        formatZonedRange(
          `${from}T00:00:00+00:00[UTC]`,
          `${to}T00:00:00+00:00[UTC]`,
          locale,
          numeric,
        ),
      ];
      for (const text of texts) {
        if (!era) {
          expect(text).toBe(expected);
          continue;
        }
        expect(withoutEra(text, name)).toBe(withoutWords(expected));
        expect(text.split(name).length - 1).toBe(1);
      }
    },
  );
});
