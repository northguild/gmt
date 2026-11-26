/*
 * CORE-112, D29: one range per cause, and the check that tells a broken one.
 *
 * ECMA-402 PartitionDateTimeRangePattern and UTS #35 Part 4 (Interval Formats): a range holds every
 * field the formatter's single `format` prints for each date, except that a field the two dates
 * share may print once (`10/07 – 11/07/2024`). Each case lists the field texts a complete range
 * holds and the fewest and most times each may appear, and a repro passes when the engine's
 * `formatRange` holds each that many times. The joiner between the two dates (a spaced en
 * dash, a thin-spaced one, a plain hyphen) and the order of the fields are CLDR's to choose, so
 * neither is compared; a text may also be pinned to the start's side or the end's side of the
 * joiner. Nothing here reads a GMT module, so a canary script can load this file from `dist` with
 * the polyfill alone.
 */

/** A range an engine must print complete. */
export interface RangeFieldCase {
  /** Short name, unique among the cases. */
  readonly name: string;
  readonly locale: string;
  readonly options: Intl.DateTimeFormatOptions;
  readonly from: number;
  readonly to: number;
  /**
   * Each field text a complete range holds, with the fewest and most times it appears. A field a
   * range drops counts 0 (below the fewest), one it repeats counts above the most, and a text
   * that must never appear (two fields run together) is `0, 0`. A text only one date prints is
   * exactly once; a text both dates may print is one or two. The optional last number pins a text
   * to the start's side (0) or the end's side (1) of the first dash or tilde.
   */
  readonly fields: readonly (readonly [
    text: string,
    min: number,
    max: number,
    side?: 0 | 1,
  ])[];
}

// UTC epoch milliseconds: 2024-05-15 13:25 and its pairs, 2024-07-10 14:35 and its year-later pair.
const A = 1715779500000;
const D = A + 184500000; // 2024-05-17 16:40
const B = A + 11700000; // 2024-05-15 16:40
const C = A + 4500000; // 2024-05-15 14:40
const M = 1718901600000; // 2024-06-20 16:40
const Y = 1720622100000;
const Y2 = 1752158100000; // 2025-07-10 14:35
const G = -65306424300000; // 101 BC-07-10 14:35, to Y2
const n = "numeric";
const ymdw = { year: n, month: n, day: n, weekday: "short" } as const;
const hmDayPeriod = { hour: n, minute: n, dayPeriod: "long" } as const;
const eraDate = { era: "short", year: n, month: n, day: n } as const;

/**
 * One case per cause of the sweep (794,400 formatters, Node 22.22.2, 24.21.0 and 26.12.1), each the
 * shortest range that shows it. The gate (`isRangeFieldCompatNeeded`) stays on while any one of
 * them is broken, as the causes are fixed one at a time upstream.
 *
 * - chinese drops `relatedYear` from a range a year apart;
 * - `hi` drops a `B` day period, `ta` prints one for two (ICU-23622), `bgc` writes `PM` where the
 *   single writes the long period (ICU-23625);
 * - hebrew prints the end's month with the wrong value (`fur`);
 * - malformed CLDR patterns (CLDR-19912): `yo` prints the end's weekday twice and a year on the
 *   wrong side, `sw` drops the start's month, `rw` repeats a day, `ta` shortens a zone name, `hy` and
 *   `az` drop the end's year or era in a `G` pattern, `it` and `brx` run two numbers together,
 *   `zh` `iso8601` runs a month and a day together (CLDR-19913);
 * - ICU takes the `y` pattern when only the era differs (ICU-23623): `scn` drops the start's era,
 *   `ko` japanese writes `S` and `R` for the eras;
 * - `ja` writes `0時` for the hour 12 under `hourCycle: "h12"` (ICU-23624).
 */
export const rangeFieldCases: readonly RangeFieldCase[] = [
  {
    name: "chineseYearDropsRelatedYear",
    locale: "en-u-ca-chinese",
    options: { year: n, month: "long" },
    from: Y,
    to: Y2,
    fields: [
      ["2024", 1, 1],
      ["2025", 1, 1],
    ],
  },
  {
    name: "hiDropsDayPeriod",
    locale: "hi",
    options: hmDayPeriod,
    from: A,
    to: B,
    fields: [
      ["दोपहर", 1, 1],
      ["शाम", 1, 1],
    ],
  },
  {
    name: "furHebrewEndMonthValue",
    locale: "fur-u-ca-hebrew",
    options: { year: n, month: "narrow" },
    from: Y,
    to: Y2,
    fields: [
      ["11", 1, 2],
      ["10", 0, 0],
      ["5784", 1, 1],
      ["5785", 1, 1],
    ],
  },
  {
    name: "yoWeekdayTwice",
    locale: "yo",
    options: ymdw,
    from: Y,
    to: Y + 86_400_000,
    fields: [
      ["Ọjọ́rú", 1, 1],
      ["Ọjọ́bọ", 1, 1],
      ["10", 1, 1],
      ["11", 1, 1],
      ["07", 1, 2],
      ["2024", 1, 2],
    ],
  },
  {
    name: "yoYearOnWrongSide",
    locale: "yo",
    options: { year: n, month: "long" },
    from: Y,
    to: Y2,
    fields: [
      ["2024", 1, 1, 0],
      ["2025", 1, 1, 1],
    ],
  },
  {
    name: "taDropsStartDayPeriod",
    locale: "ta",
    options: hmDayPeriod,
    from: A,
    to: B,
    fields: [
      ["மதியம்", 1, 1],
      ["மாலை", 1, 1],
    ],
  },
  {
    name: "bgcLongDayPeriodShort",
    locale: "bgc",
    options: hmDayPeriod,
    from: A,
    to: C,
    fields: [["सांझ", 1, 2]],
  },
  {
    name: "swDropsStartMonth",
    locale: "sw",
    options: { year: n, month: "short", day: n },
    from: A,
    to: M,
    fields: [
      ["Mei", 1, 1],
      ["Jun", 1, 1],
    ],
  },
  {
    name: "rwRepeatsDay",
    locale: "rw",
    options: ymdw,
    from: A,
    to: D,
    fields: [
      ["15", 1, 1],
      ["17", 1, 1],
    ],
  },
  {
    name: "taShortensZoneName",
    locale: "ta",
    options: { hour: n, minute: n, timeZoneName: "longGeneric" },
    from: A,
    to: B,
    fields: [["GMT+00:00", 1, 2]],
  },
  {
    name: "hyDropsEndYear",
    locale: "hy",
    options: { year: n, month: "short", day: n, weekday: "short" },
    from: G,
    to: Y2,
    fields: [
      ["101", 1, 1],
      ["2025", 1, 1],
    ],
  },
  {
    name: "azDropsEndEra",
    locale: "az",
    options: { era: "long", year: n, month: "long", day: n, weekday: "long" },
    from: G,
    to: Y2,
    fields: [
      ["eramızdan", 1, 1],
      ["yeni", 1, 1],
    ],
  },
  {
    name: "itRunsDayAndMonthTogether",
    locale: "it",
    options: { ...eraDate, weekday: "short" },
    from: G,
    to: Y2,
    fields: [
      ["1007", 0, 0],
      ["gio", 1, 1],
    ],
  },
  {
    name: "brxRunsMonthAndYearTogether",
    locale: "brx",
    options: { ...eraDate, weekday: "short" },
    from: A,
    to: 1763656800000,
    fields: [["112025", 0, 0]],
  },
  {
    name: "zhIsoRunsMonthAndDayTogether",
    locale: "zh-u-ca-iso8601",
    options: { year: n, month: "narrow", day: n },
    from: 1715783700000,
    to: 1750430100000,
    fields: [["515", 0, 0]],
  },
  {
    name: "scnEraOnlyDropsStartEra",
    locale: "scn",
    options: { era: "short", year: n, month: "long" },
    from: G,
    to: Y2,
    fields: [
      ["p.C.", 1, 1],
      ["d.C.", 1, 1],
    ],
  },
  {
    name: "koJapaneseEraNames",
    locale: "ko-u-ca-japanese",
    options: { dateStyle: "long" },
    from: -177672300000,
    to: 1763649300000,
    fields: [
      ["쇼와", 1, 1],
      ["레이와", 1, 1],
    ],
  },
  {
    name: "jaTwelveWritesZero",
    locale: "ja",
    options: { hour: n, minute: n, hourCycle: "h12" },
    from: 1715731800000,
    to: 1715740800000,
    fields: [["12", 1, 1]],
  },
];

/**
 * `"complete"` when the engine's range holds every field text of the case the stated number of times, else the range text itself
 * (so a canary shows what the engine printed). A locale the runtime has no data for formats in the
 * fallback locale and cannot show a defect of its own data, so it answers `"complete"`
 * (ECMA-402 ResolveLocale falls back to the default locale).
 *
 * @param locale the locale
 * @param options the formatter options (UTC is added)
 * @param from range start, epoch milliseconds
 * @param to range end, epoch milliseconds
 * @returns `"complete"`, or the engine's range text
 *
 * @example rangeFieldProblem("yo", { year: "numeric", month: "numeric", day: "numeric", weekday: "short" }, 1720622100000, 1720708500000) // "Ọjọ́rú, 10-07-2024 – Ọjọ́bọ 11-07-2024, Ọjọ́bọ" where the engine repeats a weekday
 */
export function rangeFieldProblem(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  from: number,
  to: number,
): string {
  if (Intl.DateTimeFormat.supportedLocalesOf([locale]).length === 0) {
    return "complete";
  }
  const range = new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).formatRange(from, to);
  const own = rangeFieldCases.find(
    (c) =>
      c.locale === locale &&
      c.from === from &&
      c.to === to &&
      JSON.stringify(c.options) === JSON.stringify(options),
  );
  const cut = range.search(/[–—−~～]|\s-\s/u);
  const complete = own?.fields.every(([text, min, max, side]) => {
    const count = range.split(text).length - 1;
    return (
      count >= min &&
      count <= max &&
      (side === undefined ||
        cut < 0 ||
        (side ? range.slice(cut) : range.slice(0, cut)).includes(text))
    );
  });
  return complete ? "complete" : range;
}
