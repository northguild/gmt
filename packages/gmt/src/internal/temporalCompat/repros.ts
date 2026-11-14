import { Temporal } from "../temporal";
import {
  type DefectId,
  type ProbeRepro,
  probeReproGroups,
} from "./probeRepros";

/*
 * Every upstream repro for each `@js-temporal/polyfill` defect GMT works around, with the
 * spec-correct answer: the probe groups from `probeRepros.ts` plus the canary-only groups below
 * (zoned.A, zoned.B, zoned.D, zoned.E, D9, D21 and D23 to D28). No shipped module imports this file: a repro the
 * shipped probes do not read lives here, so it never reaches a bundle. It imports ONLY the
 * polyfill (through `../temporal`) and `probeRepros.ts`, so a canary script can load its compiled copy straight from
 * `dist` and report which workarounds are still needed.
 *
 * `expected` is test data, like a fixture: it is compared against `run()` and never read by a
 * fallback. Sources: test262, Chromium 152 native Temporal (ICU4X), and the Dershowitz–Reingold
 * Hebrew arithmetic — never the polyfill or GMT. See README.md for each defect.
 */

export type { DefectId } from "./probeRepros";

/**
 * Zoned defects worked around in `internal/zonedWallClock*`: the range-limit defects (upstream
 * issue drafts A, B and D in the CORE-6 polyfill research) and zoned.E, the transition search
 * floored at 1847-01-01 (js-temporal/temporal-polyfill#372). Canary-only: no capability probe
 * gates them, because those fallbacks already run only when the polyfill throws, returns an
 * unchecked UTC value, or (zoned.E) is asked about an instant before 1847, where GMT computes the
 * spec's answer from offsets.
 */
export type ZonedDefectId = "zoned.A" | "zoned.B" | "zoned.D" | "zoned.E";

/**
 * Canary-only groups no capability probe gates. D9 (`largeMonthSpan.ts`): a probe large enough to
 * show the cost would be the abort itself, and timing is not deterministic; the workaround runs
 * only for amounts of at least `LARGE_MONTH_SPAN` months and computes the spec's answer. D21
 * (`clock.ts`): the guard compares each `Temporal.Now` reading with `Date.now()` and never fires
 * on a fixed runtime. Neither changes any output when the polyfill is fixed.
 */
export type BoundedWorkDefectId = "D9" | "D21";

/**
 * Engine and CLDR defects the canary reads without a probe in `probeRepros.ts` (CORE-112). D23:
 * V8 without commit 0426b0d1045d aborts the process in `formatToParts` and `formatRangeToParts` on
 * a pattern with the week-of-year year field (nodejs/node#67076). D24: CLDR 48 patterns print that
 * week-year where the calendar year is meant. The guard in `weekYearGuard.ts` covers both and
 * changes no output once the engine and the data are right. D25 to D28 (`yearPrinting.ts`): the
 * japanese calendar prints Japanese eras before 1873-01-01 (ICU-23341, ICU-23619), an islamic calendar prints
 * a negative year before the Hijra (ICU-23327), `ja` japanese leaves a `2-digit` era year unpadded
 * (ICU-23620), and chinese and dangi pad the related year under `2-digit` (ICU-23621).
 */
export type CanaryDefectId = "D23" | "D24" | "D25" | "D26" | "D27" | "D28";

export interface Repro extends Omit<ProbeRepro, "defect"> {
  defect: DefectId | ZonedDefectId | BoundedWorkDefectId | CanaryDefectId;
}

const MAX_EPOCH_NANOSECONDS = 8_640_000_000_000_000_000_000n;
const MIN_EPOCH_NANOSECONDS = -MAX_EPOCH_NANOSECONDS;
const NANOSECONDS_PER_DAY = 86_400_000_000_000n;
const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;

function zoned(
  epochNanoseconds: bigint,
  timeZone: string,
): Temporal.ZonedDateTime {
  return new Temporal.ZonedDateTime(epochNanoseconds, timeZone);
}

function zonedRepro(
  defect: ZonedDefectId,
  name: string,
  expected: string,
  run: () => unknown,
): Repro {
  return {
    defect,
    calendar: "iso8601",
    name,
    expected,
    run: () => String(run()),
  };
}

/** The error class a call throws, or `returned <value>` when it does not throw. */
function thrownErrorName(run: () => unknown): string {
  try {
    return `returned ${String(run())}`;
  } catch (error) {
    return error instanceof Error ? error.name : String(error);
  }
}

const SYDNEY_NEAR_MAX =
  MAX_EPOCH_NANOSECONDS - 3n * NANOSECONDS_PER_DAY - 5n * NANOSECONDS_PER_HOUR;

/**
 * zoned.A (`internal/zonedWallClock.ts` defect 1): `GetNamedTimeZoneEpochNanoseconds` clamps its
 * offset probe to the wall clock's own UTC reading instead of the range limit. Polyfill 05ce7a3
 * fixes the `max.*` rows only: a 0.5.1 build with it applied still throws for every `min.*` row, so
 * this group must not be retired on the maximum alone. Expected values: Chromium 153 native Temporal
 * (TC39 `DifferenceZonedDateTime`, `InterpretISODateTimeOffset`; upstream-issue draft A).
 */
const zonedARepros: Repro[] = [
  zonedRepro(
    "zoned.A",
    "max.parseSydney",
    "+275760-09-13T09:00:00+10:00[Australia/Sydney]",
    () =>
      Temporal.ZonedDateTime.from(
        "+275760-09-13T09:00:00+10:00[Australia/Sydney]",
      ),
  ),
  zonedRepro("zoned.A", "max.untilSydney", "P1D", () =>
    zoned(
      MAX_EPOCH_NANOSECONDS - NANOSECONDS_PER_DAY,
      "Australia/Sydney",
    ).until(zoned(MAX_EPOCH_NANOSECONDS, "Australia/Sydney"), {
      largestUnit: "day",
    }),
  ),
  zonedRepro("zoned.A", "max.sinceSydneyYears", "-P3DT5H", () =>
    zoned(SYDNEY_NEAR_MAX, "Australia/Sydney").since(
      zoned(MAX_EPOCH_NANOSECONDS, "Australia/Sydney"),
      { largestUnit: "year" },
    ),
  ),
  zonedRepro("zoned.A", "max.untilKiritimati", "P1D", () =>
    zoned(
      MAX_EPOCH_NANOSECONDS - NANOSECONDS_PER_DAY,
      "Pacific/Kiritimati",
    ).until(zoned(MAX_EPOCH_NANOSECONDS, "Pacific/Kiritimati"), {
      largestUnit: "week",
    }),
  ),
  zonedRepro("zoned.A", "max.totalSydney", "2.0416666666666665", () =>
    Temporal.Duration.from("PT49H").total({
      unit: "day",
      relativeTo: zoned(SYDNEY_NEAR_MAX, "Australia/Sydney"),
    }),
  ),
  zonedRepro("zoned.A", "max.compareSydney", "-1", () =>
    Temporal.Duration.compare("P3D", "PT73H", {
      relativeTo: zoned(SYDNEY_NEAR_MAX, "Australia/Sydney"),
    }),
  ),
  zonedRepro(
    "zoned.A",
    "min.parseNewYork",
    "-271821-04-19T20:00:00-04:56[America/New_York]",
    () =>
      Temporal.ZonedDateTime.from("-271821-04-19T20:00:00[America/New_York]"),
  ),
  zonedRepro(
    "zoned.A",
    "min.toZonedDateTimeNewYork",
    "-271821-04-19T20:00:00-04:56[America/New_York]",
    () =>
      Temporal.PlainDateTime.from("-271821-04-19T20:00").toZonedDateTime(
        "America/New_York",
      ),
  ),
  zonedRepro("zoned.A", "min.untilNewYork", "-P1D", () =>
    zoned(
      MIN_EPOCH_NANOSECONDS + NANOSECONDS_PER_DAY,
      "America/New_York",
    ).until(zoned(MIN_EPOCH_NANOSECONDS, "America/New_York"), {
      largestUnit: "day",
    }),
  ),
  zonedRepro("zoned.A", "min.untilHonolulu", "-P1D", () =>
    zoned(
      MIN_EPOCH_NANOSECONDS + NANOSECONDS_PER_DAY,
      "Pacific/Honolulu",
    ).until(zoned(MIN_EPOCH_NANOSECONDS, "Pacific/Honolulu"), {
      largestUnit: "day",
    }),
  ),
];

/** America/Santiago's last transition before the maximum (-04:00 → -03:00, local midnight skipped). */
const SANTIAGO_LAST_TRANSITION =
  "+275760-09-07T01:00:00-03:00[America/Santiago]";

/**
 * zoned.B (`internal/zonedWallClock.ts` defect 2): `GetNamedTimeZoneNextTransition` returns null
 * once a search step would pass the maximum, so a transition in the range's last two weeks is
 * missed and `GetStartOfDay` dereferences that null. Not fixed on the polyfill's main branch.
 * Expected values: Chromium 153 (TC39 `GetNamedTimeZoneNextTransition`, `GetStartOfDay`).
 */
const zonedBRepros: Repro[] = [
  zonedRepro("zoned.B", "max.nextTransition", SANTIAGO_LAST_TRANSITION, () =>
    Temporal.Instant.from("+275760-09-01T00:00:00Z")
      .toZonedDateTimeISO("America/Santiago")
      .getTimeZoneTransition("next"),
  ),
  zonedRepro(
    "zoned.B",
    "max.startOfDaySantiago",
    SANTIAGO_LAST_TRANSITION,
    () =>
      Temporal.PlainDate.from("+275760-09-07").toZonedDateTime(
        "America/Santiago",
      ),
  ),
  zonedRepro(
    "zoned.B",
    "max.hoursInDaySantiago",
    "23",
    () =>
      Temporal.ZonedDateTime.from("+275760-09-07T12:00[America/Santiago]")
        .hoursInDay,
  ),
];

/**
 * zoned.D (`internal/zonedDifference/utcValidity.ts`): the `"UTC"` fast path of
 * `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`, so a UTC rounding or total window
 * ending past the maximum returns a value where TC39 throws. Not fixed on the polyfill's main
 * branch. Expected: RangeError, as Chromium 153 throws (and the polyfill does for `+00:00`).
 */
const zonedDRepros: Repro[] = [
  zonedRepro("zoned.D", "max.untilUtcRounded", "RangeError", () =>
    thrownErrorName(() =>
      zoned(SYDNEY_NEAR_MAX, "UTC").until(zoned(MAX_EPOCH_NANOSECONDS, "UTC"), {
        largestUnit: "day",
        smallestUnit: "hour",
      }),
    ),
  ),
  zonedRepro("zoned.D", "max.totalUtc", "RangeError", () =>
    thrownErrorName(() =>
      Temporal.Duration.from("PT49H").total({
        unit: "day",
        relativeTo: zoned(
          MAX_EPOCH_NANOSECONDS -
            2n * NANOSECONDS_PER_DAY -
            NANOSECONDS_PER_HOUR,
          "UTC",
        ),
      }),
    ),
  ),
];

/** Asia/Manila's 1844-12-31 date-line crossing (−15:56:08 → +08:03:52), as Chromium 153 prints it. */
const MANILA_CROSSING = "1845-01-01T00:00:00+08:04[Asia/Manila]";

/**
 * zoned.E (`internal/zonedWallClock.ts` defect 3): `GetNamedTimeZoneNextTransition` and
 * `…PreviousTransition` start their search at `BEFORE_FIRST_DST` = 1847-01-01, so the 1844-12-31
 * date-line crossing of Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau is never found, and
 * `GetStartOfDay` for the skipped 1844-12-31 returns the wrong `next`. js-temporal/temporal-polyfill
 * #372 (tc39/proposal-temporal#3330). Expected values: Chromium 153 native Temporal.
 * `previousGuam` asks from after the floor, so it also proves the backward search reaches past it.
 */
const zonedERepros: Repro[] = [
  zonedRepro("zoned.E", "pre1847.nextManila", MANILA_CROSSING, () =>
    Temporal.Instant.from("1800-01-01T00:00:00Z")
      .toZonedDateTimeISO("Asia/Manila")
      .getTimeZoneTransition("next"),
  ),
  zonedRepro("zoned.E", "pre1847.previousManila", MANILA_CROSSING, () =>
    Temporal.Instant.from("1846-01-01T00:00:00Z")
      .toZonedDateTimeISO("Asia/Manila")
      .getTimeZoneTransition("previous"),
  ),
  zonedRepro(
    "zoned.E",
    "pre1847.previousGuam",
    "1845-01-01T00:00:00+09:39[Pacific/Guam]",
    () =>
      Temporal.Instant.from("1848-01-01T00:00:00Z")
        .toZonedDateTimeISO("Pacific/Guam")
        .getTimeZoneTransition("previous"),
  ),
  zonedRepro(
    "zoned.E",
    "pre1847.hoursInDayManila",
    "24",
    () =>
      Temporal.ZonedDateTime.from("1844-12-30T12:00[Asia/Manila]").hoursInDay,
  ),
  zonedRepro("zoned.E", "pre1847.startOfDayManila", MANILA_CROSSING, () =>
    Temporal.PlainDate.from("1844-12-31").toZonedDateTime("Asia/Manila"),
  ),
];

/** More `Intl.DateTimeFormat#formatToParts` reads than this for 1,200 months is per-month work. */
const D9_INTL_READ_LIMIT = 100;
const D9_MONTHS = 1_200;

/**
 * `run()`'s output, or a note of how many `Intl.DateTimeFormat#formatToParts` calls it made when
 * that is more than `D9_INTL_READ_LIMIT`. Polyfill 0.5.1 reads the calendar through that method
 * once or more per month stepped; bounded arithmetic reads a handful of dates, or none.
 */
function withBoundedIntlReads(run: () => string): string {
  const prototype = Intl.DateTimeFormat.prototype;
  const original = prototype.formatToParts;
  let reads = 0;
  prototype.formatToParts = function formatToParts(
    this: Intl.DateTimeFormat,
    date?: Date | number,
  ) {
    reads++;
    return original.call(this, date);
  };
  try {
    const output = run();
    return reads <= D9_INTL_READ_LIMIT
      ? output
      : `${reads} Intl reads for ${D9_MONTHS} months`;
  } finally {
    prototype.formatToParts = original;
  }
}

/**
 * D9: 1,200 months from month M03 day 5. Persian has 12 months in every year (Intl era/monthCode
 * proposal §4.1.4 Table 3), so they are 100 years. Hebrew: the Dershowitz–Reingold month count
 * `floor((235y − 234) / 19)` puts month 1,200 after 5784-M03 at 5881 ordinal 3, a common year, so
 * `M03`.
 */
const d9Repros: readonly Repro[] = (
  [
    ["persian", 1402, "1502|M03|5"],
    ["hebrew", 5784, "5881|M03|5"],
  ] as const
).flatMap(([calendar, year, expected]): Repro[] => {
  const start = () =>
    Temporal.PlainDate.from({ calendar, year, month: 3, day: 5 });
  const [endYear] = expected.split("|").map(Number);
  return [
    {
      defect: "D9",
      calendar,
      name: "addMonths",
      expected,
      run: () =>
        withBoundedIntlReads(() => {
          const date = start().add({ months: D9_MONTHS });
          return `${date.year}|${date.monthCode}|${date.day}`;
        }),
    },
    {
      defect: "D9",
      calendar,
      name: "untilMonths",
      expected: `P${D9_MONTHS}M`,
      run: () =>
        withBoundedIntlReads(() =>
          start()
            .until(
              Temporal.PlainDate.from({
                calendar,
                year: endYear ?? Number.NaN,
                monthCode: "M03",
                day: 5,
              }),
              { largestUnit: "months" },
            )
            .toString(),
        ),
    },
  ];
});

/**
 * D21: with `Date.now()` at 1960-01-01T00:00:00Z, the second `Temporal.Now.instant()` reading
 * is in 1960. The Temporal proposal defines `Date.now()` as SystemUTCEpochMilliseconds, the floor of
 * SystemUTCEpochNanoseconds over 1e6 (spec/temporal.html, spec/mainadditions.html), and
 * test262 `built-ins/Temporal/Now/instant/return-value-value.js` asserts a reading is not earlier
 * than a `Date.now()` taken before it. Polyfill 0.5.1 carries the previous reading's `ms % 1e6`,
 * which is negative before 1970, and reads in 1959. Replaces `Date.now` and restores it.
 */
const d21Repros: readonly Repro[] = [
  {
    defect: "D21",
    calendar: "iso8601",
    name: "secondReadingAt1960",
    expected: "1960",
    run: () => {
      const original = Date.now; // date-ban: the canary sets the clock before 1970 and restores it
      Date.now = () => -315_619_200_000; // date-ban: 1960-01-01T00:00:00Z, the clock the canary needs
      try {
        Temporal.Now.instant();
        return String(Temporal.Now.instant().toZonedDateTimeISO("UTC").year);
      } finally {
        Date.now = original; // date-ban: restores the real clock
        // The polyfill still carries the 1960 tail: one real reading re-seeds it, so the next
        // direct reading in this process is not a millisecond early.
        Temporal.Now.instant();
      }
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

/**
 * D24: each input prints the calendar year, with the text the locale data otherwise gives
 * (ECMA-402 FormatDateTimePattern, `year`: the calendar year, or the era year with an era). Only
 * `format` is called, so no engine can abort on it.
 */
const d24Repros: readonly Repro[] = weekYearInputs.map((input) => ({
  defect: "D24",
  calendar: "iso8601",
  name: input.name,
  expected: input.expected,
  run: () =>
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
 * D25 to D28, text only (`format`), so no engine can abort on a repro. The expected values are the
 * specifications': Intl era/monthCode Table 2 as amended by tc39/proposal-intl-era-monthcode#86 and
 * test262 tc39/test262#4877 (japanese before 1873-01-01 is Gregorian, and Meiji 6 starts it),
 * Table 2 and § 4.1.12 (the islamic calendars have a second era before the Hijra), ECMA-402
 * FormatDateTimePattern (`2-digit` pads the era year to two digits; the related year is
 * FormatNumeric at full width).
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
    defect: "D27",
    calendar: "iso8601",
    name: "jaJapaneseTwoDigitEraYear",
    expected: "令和06年",
    run: () => printed("ja-u-ca-japanese", { year: "2-digit" }, [2024, 7, 10]),
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
];

export const repros: readonly Repro[] = [
  ...d21Repros,
  ...d23Repros,
  ...d24Repros,
  ...yearPrintingRepros,
  ...d9Repros,
  ...zonedARepros,
  ...zonedBRepros,
  ...zonedDRepros,
  ...zonedERepros,
  ...probeReproGroups.d1,
  ...probeReproGroups.d1Arithmetic,
  ...probeReproGroups.d1RelativeTo,
  ...probeReproGroups.d10,
  ...probeReproGroups.d12,
  ...probeReproGroups.d13,
  ...probeReproGroups.d14,
  ...probeReproGroups.d15,
  ...probeReproGroups.d16,
  ...probeReproGroups.d17,
  ...probeReproGroups.d18,
  ...probeReproGroups.d19,
  ...probeReproGroups.d20,
  ...probeReproGroups.d22,
  ...probeReproGroups.d6,
  ...probeReproGroups.d7,
  ...probeReproGroups.reads,
];

/** The repro with this defect, calendar and name, if any. */
export function findRepro(
  defect: DefectId | ZonedDefectId | BoundedWorkDefectId | CanaryDefectId,
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
