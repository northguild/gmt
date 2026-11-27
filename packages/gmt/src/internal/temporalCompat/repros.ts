import { Temporal } from "../temporal";
import {
  type DefectId,
  type ProbeRepro,
  probeReproGroups,
} from "./probeRepros";
import { rangeFieldCases, rangeFieldProblem } from "./rangeFieldRepros";

/*
 * Every upstream repro for each `temporal-polyfill` or runtime-ICU defect GMT works around, with
 * the spec-correct answer: the probe groups from `probeRepros.ts` plus the canary-only groups
 * below (D9 and D23 to D34). No shipped module imports this file: a repro the shipped probes do
 * not read lives here, so it never reaches a bundle. It imports ONLY the polyfill (through
 * `../temporal`), `probeRepros.ts` and `rangeFieldRepros.ts`, so a canary script can load its
 * compiled copy straight from `dist` and report which workarounds are still needed.
 *
 * `expected` is test data, like a fixture: it is compared against `run()` and never read by a
 * fallback. Sources: test262, Chromium native Temporal (ICU4X) — never the polyfill or GMT. See
 * README.md for each defect.
 */

export type { DefectId } from "./probeRepros";

/**
 * Canary-only groups no capability probe gates. D9 (`monthRange.ts`): the guard is always on, and
 * a probe large enough to show the cost would be the cost itself.
 */
export type BoundedWorkDefectId = "D9";

/**
 * Engine and CLDR defects the canary reads without a probe in `probeRepros.ts` (CORE-112). D23:
 * V8 without commit 0426b0d1045d aborts the process in `formatToParts` and `formatRangeToParts` on
 * a pattern with the week-of-year year field (nodejs/node#67076). D24: CLDR 48 patterns print that
 * week-year where the calendar year is meant. The guard in `weekYearGuard.ts` covers both and
 * changes no output once the engine and the data are right. D25 to D32 (`yearPrinting.ts`): the
 * japanese calendar prints Japanese eras before 1873-01-01 (ICU-23341, ICU-23619), an islamic calendar prints
 * a negative year before the Hijra (ICU-23327), `ja` japanese leaves a `2-digit` era year unpadded
 * (ICU-23620), and chinese and dangi pad the related year under `2-digit` (ICU-23621). D29
 * (`rangeFields.ts`): a range drops, repeats or garbles a field of one date. D30
 * (`formatterCache.ts`): `islamic` and `islamic-rgsa` resolve as Intl era/monthCode says. D31
 * (`copticEra.ts`): the coptic calendar prints `1 - year` and no era before AM 1 (ICU-23277). D32
 * (`islamicEpochEra.ts`): JavaScriptCore changes the Islamic era in the middle of the first day of year 1
 * (WebKit 331724). D34 (`copticEra.ts`): JavaScriptCore changes the Coptic era in the middle of 1 Tout AM 1
 * (WebKit 331724). D33
 * (`lunisolarRefusal.ts`): hosts print different Chinese and Dangi dates, and the dependency reads
 * them from the host.
 */
export type CanaryDefectId =
  | "D23"
  | "D24"
  | "D25"
  | "D26"
  | "D27"
  | "D28"
  | "D29"
  | "D30"
  | "D31"
  | "D32"
  | "D33"
  | "D34";

export interface Repro extends Omit<ProbeRepro, "defect"> {
  defect: DefectId | BoundedWorkDefectId | CanaryDefectId;
}

/**
 * D9, out-of-range half: a month amount past the date range throws RangeError, as the
 * specification requires, but only after work linear in the amount. Hebrew 2024-01-15 + 40,000,000
 * months and + 400,000,000 months both throw; bounded work takes about as long for the second as
 * for the first, linear work about ten times as long. The repro runs the first call and fails at
 * once, without the second, when it took longer than `D9_CEILING_MS` (5,000 ms): bounded work is
 * far under that, and the second call would cost ten times as much. Otherwise it passes when
 * `t2 < 3 × t1 + 10` ms (a ratio is independent of engine speed). Any result other than a
 * RangeError from either call fails it. GMT's `assertMonthsInRange` (`monthRange.ts`) throws first.
 * Cost on 1.0.8, the runtime GMT ships, measured on Node: the first call takes about 15 ms and
 * the second about 100 ms, so both pass the ceiling and the ratio fails the repro (linear work).
 * Polyfill 0.5.1 stops adding at the range limit, and its first call alone takes about 12 s to
 * 30 s, so the ceiling fails the repro at once.
 */
const D9_OUT_OF_RANGE_MONTHS = 40_000_000;
const D9_CEILING_MS = 5_000;
const D9_RATIO = 3;
const D9_SLACK_MS = 10;

function millisecondsToThrow(months: number): number | string {
  const start = Temporal.PlainDate.from("2024-01-15[u-ca=hebrew]");
  const before = performance.now();
  try {
    start.add({ months });
  } catch (error) {
    if (error instanceof RangeError) {
      return performance.now() - before;
    }
    return `${months} months threw ${String(error)}`;
  }
  return `${months} months did not throw`;
}

const d9OutOfRangeRepros: readonly Repro[] = [
  {
    defect: "D9",
    calendar: "hebrew",
    name: "outOfRangeMonthsThrowInBoundedTime",
    expected: "bounded",
    run: () => {
      const t1 = millisecondsToThrow(D9_OUT_OF_RANGE_MONTHS);
      if (typeof t1 === "string") {
        return t1;
      }
      if (t1 > D9_CEILING_MS) {
        return `${t1.toFixed(0)} ms for ${D9_OUT_OF_RANGE_MONTHS} months, over ${D9_CEILING_MS} ms`;
      }
      const t2 = millisecondsToThrow(D9_OUT_OF_RANGE_MONTHS * 10);
      if (typeof t2 === "string") {
        return t2;
      }
      return t2 < D9_RATIO * t1 + D9_SLACK_MS
        ? "bounded"
        : `${t1.toFixed(0)} ms, then ${t2.toFixed(0)} ms for ten times the months`;
    },
  },
];

/**
 * The recorded inputs of D23 and D24, all `timeZone: "UTC"`. Each is a pattern whose CLDR 48 data
 * uses the week-of-year year (UTS #35 Part 4 §8, `Y`) where the calendar year (`y`) is meant.
 */
const weekYearInputs: readonly {
  name: string;
  locale: string;
  options: Intl.DateTimeFormatOptions;
  date: [number, number, number];
  expected: string;
}[] = [
  {
    name: "gdMonthShortYearEnd",
    locale: "gd",
    options: { year: "numeric", month: "short" },
    date: [2024, 12, 30],
    expected: "Dùbh 2024",
  },
  {
    name: "kshNumericYearStart",
    locale: "ksh",
    options: { year: "numeric", month: "numeric" },
    date: [2027, 1, 1],
    expected: "2027-01",
  },
  {
    name: "scNumericYearStart",
    locale: "sc",
    options: { year: "numeric", month: "numeric" },
    date: [2027, 1, 1],
    expected: "01/2027",
  },
  {
    name: "teBuddhistYearEnd",
    locale: "te-u-ca-buddhist",
    options: { year: "numeric", month: "long" },
    date: [2026, 12, 31],
    expected: "డిసెంబర్ 2569",
  },
  {
    name: "myJapaneseMidYear",
    locale: "my-u-ca-japanese",
    options: { year: "numeric", month: "numeric", day: "numeric" },
    date: [2026, 7, 1],
    expected: "R ၀၁/၀၇/၈",
  },
  {
    name: "glHebrewDateStyleFull",
    locale: "gl-u-ca-hebrew",
    options: { dateStyle: "full" },
    date: [2026, 9, 12],
    expected: "sábado, 1 de Tishri de 5787 AM",
  },
  {
    name: "deChEraShortYearEnd",
    locale: "de-CH",
    options: {
      era: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    },
    date: [2024, 12, 30],
    expected: "Mo., 12.30.2024 n. Chr.",
  },
];

/** The digit runs of a text, in any numbering system, joined by commas: the numbers a pattern prints. */
const digitRunsOf = (text: string): string =>
  (text.match(/\p{Nd}+/gu) ?? []).join(",");

/**
 * D24: each input prints the calendar year (ECMA-402 FormatDateTimePattern, `year`: the calendar
 * year, or the era year with an era). The value is the numbers the text holds, not its words, so a
 * wording change in locale data never reads as the defect. Only `format` is called, so no engine
 * can abort on it.
 */
const d24Repros: readonly Repro[] = weekYearInputs.map((input) => ({
  defect: "D24",
  calendar: "iso8601",
  name: input.name,
  expected: digitRunsOf(input.expected),
  run: () =>
    digitRunsOf(
      new Intl.DateTimeFormat(input.locale, {
        ...input.options,
        timeZone: "UTC",
      }).format(
        Temporal.PlainDate.from({
          year: input.date[0],
          month: input.date[1],
          day: input.date[2],
        }).toZonedDateTime("UTC").epochMilliseconds,
      ),
    ),
}));

/**
 * D23: a component-option formatter resolves a year field for a pattern that holds the week-year.
 * V8 without commit 0426b0d1045d resolves `undefined` there and aborts in `formatToParts`, and
 * a fixed V8, SpiderMonkey and JavaScriptCore resolve `numeric` (ECMA-402 CreateDateTimeFormat).
 * No parts call is made: the canary script confirms the abort in a child process, on Node only.
 */
const d23Repros: readonly Repro[] = [
  {
    defect: "D23",
    calendar: "iso8601",
    name: "resolvedYearOfWeekYearPattern",
    expected: "numeric",
    run: () =>
      String(
        new Intl.DateTimeFormat("gd", {
          year: "numeric",
          month: "short",
          timeZone: "UTC",
        }).resolvedOptions().year,
      ),
  },
];

/** The epoch milliseconds of noon UTC on an ISO date, years before 0000 included. */
function noonMs(year: number, month: number, day: number): number {
  return Temporal.PlainDate.from({ year, month, day }).toZonedDateTime({
    timeZone: "UTC",
    plainTime: "12:00",
  }).epochMilliseconds;
}

/** A UTC `Intl.DateTimeFormat` text at an ISO date. */
function printed(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  date: readonly [number, number, number],
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(noonMs(date[0], date[1], date[2]));
}

/**
 * D25 to D32, text only (`format`), so no engine can abort on a repro. The expected values are the
 * specifications': Intl era/monthCode Table 2 as amended by tc39/proposal-intl-era-monthcode#86 and
 * test262 tc39/test262#4877 (japanese before 1873-01-01 is Gregorian, and Meiji 6 starts it),
 * Table 2 and § 4.1.12 (the islamic calendars have a second era before the Hijra), ECMA-402
 * FormatDateTimePattern (`2-digit` pads the era year to two digits; the related year is
 * FormatNumeric at full width), Table 2 and 4.1.12 (coptic has one era, `am`, and its era year is
 * the year, so ISO -000001-07-10 is -285 AM), Table 2 and 4.1.12 (the era `ah` starts on the whole first
 * day of year 1: ISO 0622-07-19, and 0622-07-18 for islamic-tbla).
 */
const yearPrintingRepros: readonly Repro[] = [
  {
    defect: "D25",
    calendar: "iso8601",
    name: "japaneseTwoBc",
    expected: "2 BC",
    run: () =>
      printed(
        "en-u-ca-japanese",
        { era: "short", year: "numeric" },
        [-1, 7, 10],
      ),
  },
  {
    defect: "D25",
    calendar: "iso8601",
    name: "japaneseLastGregorianDay",
    expected: "1872 AD",
    run: () =>
      printed(
        "en-u-ca-japanese",
        { era: "short", year: "numeric" },
        [1872, 12, 31],
      ),
  },
  {
    defect: "D26",
    calendar: "iso8601",
    name: "islamicCivilEraBeforeHijra",
    expected: "two eras",
    run: () => {
      const era = (year: number) =>
        printed("en-u-ca-islamic-civil", { era: "short", year: "numeric" }, [
          year,
          7,
          10,
        ]).replace(/[\p{Nd}\p{Pd}\p{Z}−]/gu, "");
      return era(600) === era(2025) ? "one era" : "two eras";
    },
  },
  {
    defect: "D31",
    calendar: "iso8601",
    name: "copticSignedYearAndEraBeforeAm",
    expected: "signed year and the era",
    run: () => {
      const options = { era: "short", year: "numeric" } as const;
      const before = printed("en-u-ca-coptic", options, [-1, 7, 10]);
      const after = printed("en-u-ca-coptic", options, [2000, 1, 1]);
      const eraOf = (text: string) =>
        text.replace(/[\p{Nd}\p{Pd}\p{Z}−]/gu, "");
      return before.includes("-285") &&
        eraOf(after) !== "" &&
        eraOf(before) === eraOf(after)
        ? "signed year and the era"
        : "unsigned year or no era";
    },
  },
  {
    defect: "D32",
    calendar: "iso8601",
    name: "islamicEraOnEpochDay",
    expected: "one era",
    run: () => {
      const eraOf = (calendar: string, day: number, hour: number) =>
        new Intl.DateTimeFormat(`en-u-ca-${calendar}`, {
          era: "short",
          year: "numeric",
          timeZone: "UTC",
        })
          .format(
            Temporal.Instant.from(
              `0622-07-${day}T${String(hour).padStart(2, "0")}:00:00Z`,
            ).epochMilliseconds,
          )
          .replace(/[\p{Nd}\p{Pd}\p{Z}−]/gu, "");
      return [
        ["islamic-civil", 19],
        ["islamic-tbla", 18],
        ["islamic-umalqura", 19],
      ].every(
        ([calendar, day]) =>
          eraOf(calendar as string, day as number, 0) ===
          eraOf(calendar as string, day as number, 23),
      )
        ? "one era"
        : "two eras";
    },
  },
  {
    defect: "D34",
    calendar: "iso8601",
    name: "copticEraOnEpochDay",
    expected: "one era",
    run: () => {
      const eraAt = (hour: number) =>
        new Intl.DateTimeFormat("en-u-ca-coptic", {
          era: "short",
          year: "numeric",
          timeZone: "UTC",
        })
          .format(
            Temporal.Instant.from(
              `0284-08-29T${String(hour).padStart(2, "0")}:00:00Z`,
            ).epochMilliseconds,
          )
          .replace(/[\p{Nd}\p{Pd}\p{Z}−]/gu, "");
      return eraAt(0) === eraAt(23) ? "one era" : "two eras";
    },
  },
  {
    defect: "D27",
    calendar: "iso8601",
    name: "jaJapaneseTwoDigitEraYear",
    expected: "令和06年",
    run: () => printed("ja-u-ca-japanese", { year: "2-digit" }, [2024, 7, 10]),
  },
  {
    defect: "D27",
    calendar: "iso8601",
    name: "jaJapaneseNumberingSystemYear",
    expected: "令和٦年",
    run: () =>
      printed("ja-u-ca-japanese-nu-arab", { year: "numeric" }, [2024, 7, 10]),
  },
  {
    defect: "D28",
    calendar: "iso8601",
    name: "chineseRelatedYearFullWidth",
    expected: "5",
    run: () =>
      /\p{Nd}+/u.exec(
        printed("en-u-ca-chinese", { year: "2-digit" }, [5, 7, 10]),
      )?.[0] ?? "",
  },
  {
    defect: "D30",
    calendar: "iso8601",
    name: "islamicResolvesTbla",
    expected: "islamic-tbla",
    run: () =>
      new Intl.DateTimeFormat("en-u-ca-islamic").resolvedOptions().calendar,
  },
  {
    defect: "D30",
    calendar: "iso8601",
    name: "islamicRgsaIsIgnored",
    expected: "not islamic-rgsa",
    run: () =>
      new Intl.DateTimeFormat("en-u-ca-islamic-rgsa").resolvedOptions()
        .calendar === "islamic-rgsa"
        ? "islamic-rgsa"
        : "not islamic-rgsa",
  },
];

/**
 * D29, text only (`format`, `formatRange`): each case is a range the engine must print with every
 * field of both dates (ECMA-402 PartitionDateTimeRangePattern; UTS #35 Part 4, Interval Formats).
 * The value is `complete`, or the engine's own range text when it is not.
 */
const rangeFieldRepros: readonly Repro[] = rangeFieldCases.map((c) => ({
  defect: "D29",
  calendar: "iso8601",
  name: c.name,
  expected: "complete",
  run: () => rangeFieldProblem(c.locale, c.options, c.from, c.to),
}));

/**
 * D33: known Chinese and Dangi text answers, the host's `Intl.DateTimeFormat` (`relatedYear|day` of a
 * UTC-noon instant; month text is left out because ICU 78 prints `6bis` and `Mo12` where older ICU
 * prints `6` and `12`). The values are the Intl era/monthCode proposal's (section 1.1 Table 1:
 * `chinese` follows Purple Mountain Observatory data, `dangi` Korea Astronomy and Space Science
 * Institute data). Chinese rows are checked against the Hong Kong Observatory Gregorian-Lunar
 * Calendar Conversion Table (computed to GB/T 33661-2017), Dangi rows against the KASI lunar-solar
 * conversion service, and every row against native Temporal (ICU4X). `isLunisolarTextCompatNeeded`
 * (`capabilities.ts`) reads the same rows.
 */
const d33TextRows: readonly [string, string, string, string][] = [
  ["chineseNewYear2027Text", "chinese", "2027-02-06", "2027|1"],
  ["chineseLastDay2029Text", "chinese", "2030-02-02", "2029|30"],
  ["chineseNewYear2030Text", "chinese", "2030-02-03", "2030|1"],
  ["chineseNinthMonthEnd2018Text", "chinese", "2018-11-07", "2018|30"],
  ["dangiSecond2017Text", "dangi", "2017-02-26", "2017|1"],
  ["dangiNewYear2027Text", "dangi", "2027-02-07", "2027|1"],
];

/** The related year (the year when none is printed) and day of a UTC-noon date in `calendar`. */
function printedRelatedYearAndDay(calendar: string, iso: string): string {
  const [year, month, day] = [
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)),
    Number(iso.slice(8, 10)),
  ];
  const parts = new Intl.DateTimeFormat(`en-u-ca-${calendar}`, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(noonMs(year, month, day));
  const value = (type: string): string | undefined =>
    parts.find((part) => part.type === type)?.value;
  return `${value("relatedYear") ?? value("year")}|${value("day")}`;
}

const d33Repros: readonly Repro[] = [
  ...d33TextRows.map(([name, calendar, iso, expected]): Repro => ({
    defect: "D33",
    calendar,
    name,
    expected,
    run: () => printedRelatedYearAndDay(calendar, iso),
  })),
];

export const repros: readonly Repro[] = [
  ...d23Repros,
  ...d24Repros,
  ...yearPrintingRepros,
  ...rangeFieldRepros,
  ...d33Repros,
  ...d9OutOfRangeRepros,
  ...probeReproGroups.d16,
  ...probeReproGroups.d17,
  ...probeReproGroups.d19,
  ...probeReproGroups.d22,
  ...probeReproGroups.d35,
];

/** The repro with this defect, calendar and name, if any. */
export function findRepro(
  defect: DefectId | BoundedWorkDefectId | CanaryDefectId,
  calendar: string,
  name: string,
): Repro | undefined {
  return repros.find(
    (repro) =>
      repro.defect === defect &&
      repro.calendar === calendar &&
      repro.name === name,
  );
}
