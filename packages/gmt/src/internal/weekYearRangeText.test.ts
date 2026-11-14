import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { runInBoundedChild } from "../test/boundedChild";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { normalizeDateTime } from "./normalizeDateTime";

/*
 * CORE-112 (D24, slice 3c): a range prints the calendar year at each end, never the week-year.
 *
 * Every year below is the Temporal calendar year of that endpoint (`eraYear ?? year` where the
 * pattern prints an era), written in the formatter's numbering system, not the engine's text:
 *   - kok japanese, 2018-12-27: Heisei 30 (Heisei ended 2019-04-30); 2019-12-27: Reiwa 1.
 *   - my buddhist, 2026-12-27: BE 2569 = 2026 + 543; 2027-01-03: BE 2570. Burmese digits.
 *   - kok roc, 2024-07-10 and 2024-07-12: ROC 113 = 2024 - 1911.
 *   - kok-Deva coptic, 2029-09-09 and 2029-09-10: Coptic 1745 AM (year 1745 runs from
 *     2028-09-11 to 2029-09-10); month 13, so the polyfill cannot derive it (defect F).
 * Layout, separators and era text stay as the locale data has them. The en dash is written as `-`,
 * as GMT normalizes every formatted string.
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
    locale                    | options         | from            | to              | expected                                  | label
    ${"kok-u-ca-japanese"}    | ${numeric}      | ${"2018-12-27"} | ${"2019-12-27"} | ${"27-12-30 H – 27-12-1 R"}               | ${"kok japanese, Heisei to Reiwa"}
    ${"my-u-ca-buddhist"}     | ${numeric}      | ${"2026-12-27"} | ${"2027-01-03"} | ${"BE ၂၇/၁၂/၂၅၆၉ – BE ၀၃/၀၁/၂၅၇၀"}        | ${"my buddhist, over New Year"}
    ${"kok-u-ca-roc"}         | ${weekdayShort} | ${"2024-07-10"} | ${"2024-07-12"} | ${"बुधवार, 10-7-113 ROC – शुक्रार-12-7-113"} | ${"kok roc, option set 12"}
    ${"kok-u-ca-roc"}         | ${withEra}      | ${"2024-07-10"} | ${"2024-07-12"} | ${"बुधवार, 10-7-113 ROC – शुक्रार-12-7-113"} | ${"kok roc, option set 19"}
    ${"kok-Deva-u-ca-coptic"} | ${numeric}      | ${"2029-09-09"} | ${"2029-09-10"} | ${"4-13-1745 AM – 5-13-1745"}             | ${"kok-Deva coptic, control"}
  `(
    "formatDateRange and formatDateTimeRange print the calendar year for $label ('$locale', $from to $to)",
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
    const range = String(run.calls[0]?.value);
    expect(range).toContain("၂၅၆၉");
    expect(range).toContain("၂၅၇၀");
    expect(range).not.toContain("၂၀၂");
  });
});

/*
 * Slice 3c before ISO year 1, in the calendars the polyfill cannot project directly (`TEMPORAL_STAND_IN`
 * for coptic and ethiopic, `readable()` for indian). Each expected year is the Temporal year of
 * the endpoint (native Temporal, which projects these calendars before ISO year 1), written as
 * Intl prints it: ECMA-402 FormatDateTimePattern turns a year <= 0 into 1 - year, so coptic
 * year -285 (ISO -0001-07-10) prints 286 and -283 prints 284; ethiopic prints the era year of the
 * `aa` era (5491, 5493) because its years before AM 1 have that era; indian is one signed era,
 * so -79 and -77 print as they are, with the locale's minus. The kok formatters print a week-year
 * in their range pattern (kok-u-ca-coptic and kok-u-ca-ethiopic are flagged), so the repair
 * must write these years; kok-u-ca-indian is not flagged and ICU's text stands.
 */
describe("range, calendar year before ISO year 1", () => {
  const numeric = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  } as const;

  it.each`
    locale                    | from               | to                 | expected                        | label
    ${"kok-u-ca-coptic"}      | ${"-000001-07-10"} | ${"0001-07-10"}    | ${"18-11-286 - 18-11-284"}      | ${"coptic -285 to -283"}
    ${"kok-Deva-u-ca-coptic"} | ${"-000001-07-10"} | ${"0001-07-10"}    | ${"18-11-286 - 18-11-284"}      | ${"kok-Deva coptic -285 to -283"}
    ${"kok-u-ca-coptic"}      | ${"-000002-07-10"} | ${"-000001-07-10"} | ${"18-11-287 - 18-11-286"}      | ${"coptic -286 to -285"}
    ${"kok-u-ca-coptic"}      | ${"0001-01-01"}    | ${"0001-12-31"}    | ${"8-5-284 - 7-5-283"}          | ${"coptic -283 to -282, across the coptic new year"}
    ${"kok-u-ca-ethiopic"}    | ${"-000001-07-10"} | ${"0001-07-10"}    | ${"18-11-5491 - 18-11-5493 AA"} | ${"ethiopic aa 5491 to 5493"}
    ${"kok-u-ca-ethiopic"}    | ${"-000002-07-10"} | ${"-000001-07-10"} | ${"18-11-5490 - 18-11-5491 AA"} | ${"ethiopic aa 5490 to 5491"}
    ${"kok-u-ca-ethiopic"}    | ${"0001-01-01"}    | ${"0001-12-31"}    | ${"8-5-5493 - 7-5-5494 AA"}     | ${"ethiopic aa 5493 to 5494"}
    ${"kok-u-ca-indian"}      | ${"-000001-07-10"} | ${"0001-07-10"}    | ${"19-4--79 - 19-4--77 शक"}     | ${"indian -79 to -77"}
    ${"kok-u-ca-indian"}      | ${"-000002-07-10"} | ${"-000001-07-10"} | ${"19-4--80 - 19-4--79 शक"}     | ${"indian -80 to -79"}
    ${"kok-u-ca-indian"}      | ${"0001-01-01"}    | ${"0001-12-31"}    | ${"11-10--78 - 10-10--77 शक"}   | ${"indian -78 to -77"}
  `(
    "the three range functions print the calendar year for $label ('$locale', $from to $to)",
    ({ locale, from, to, expected }) => {
      expect(formatDateRange(from, to, locale, numeric)).toBe(
        normalizeDateTime(expected),
      );
      expect(
        formatDateTimeRange(
          `${from}T00:00:00`,
          `${to}T00:00:00`,
          locale,
          numeric,
        ),
      ).toBe(normalizeDateTime(expected));
      expect(
        formatZonedRange(
          `${from}T00:00:00+00:00[UTC]`,
          `${to}T00:00:00+00:00[UTC]`,
          locale,
          numeric,
        ),
      ).toBe(normalizeDateTime(expected));
    },
  );
});
