import { Temporal } from "../temporal";
import {
  type DefectId,
  type ProbeRepro,
  probeReproGroups,
} from "./probeRepros";

/*
 * Every upstream repro for each `@js-temporal/polyfill` defect GMT works around, with the
 * spec-correct answer: the probe groups from `probeRepros.ts` plus the canary-only groups below
 * (zoned.A, zoned.B, zoned.D, zoned.E and D9). No shipped module imports this file: a repro the
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
 * D9: non-ISO months added and counted one month at a time (`largeMonthSpan.ts`). Canary-only: no
 * capability probe gates it, because a probe large enough to show the cost would be the abort
 * itself, and timing is not deterministic. The workaround runs only for amounts of at least
 * `LARGE_MONTH_SPAN` months and computes the spec's answer, so it changes no output either way.
 */
export type BoundedWorkDefectId = "D9";

export interface Repro extends Omit<ProbeRepro, "defect"> {
  defect: DefectId | ZonedDefectId | BoundedWorkDefectId;
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
 * zoned.D (`internal/zonedWallClockDifference.ts` defect 2): the `"UTC"` fast path of
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

export const repros: readonly Repro[] = [
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
  ...probeReproGroups.d6,
  ...probeReproGroups.d7,
  ...probeReproGroups.reads,
];

/** The repro with this defect, calendar and name, if any. */
export function findRepro(
  defect: DefectId | ZonedDefectId | BoundedWorkDefectId,
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
