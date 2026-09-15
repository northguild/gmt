import { Temporal } from "@js-temporal/polyfill";

/*
 * Upstream repros for each `@js-temporal/polyfill` calendar defect GMT works around, with the
 * spec-correct answer. This file imports ONLY the polyfill (no GMT module), so a canary script can
 * load its compiled copy straight from `dist` and report which workarounds are still needed.
 *
 * `expected` is test data, like a fixture: it is compared against `run()` and never read by a
 * fallback. Sources: test262, Chromium 152 native Temporal (ICU4X), and the Dershowitz–Reingold
 * Hebrew arithmetic — never the polyfill or GMT. See README.md for each defect.
 */

/** Defect ids from the CORE-6 calendar-correctness spec §1.2. */
export type DefectId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";

/**
 * Zoned range-limit defects worked around in `internal/zonedWallClock*` (upstream issue drafts A, B
 * and D in the CORE-6 polyfill research). Canary-only: no capability probe gates them, because
 * those fallbacks already run only when the polyfill throws or returns an unchecked UTC value.
 */
export type ZonedDefectId = "zoned.A" | "zoned.B" | "zoned.D";

export interface Repro {
  defect: DefectId | ZonedDefectId;
  /** Temporal calendar id the repro exercises. */
  calendar: string;
  /** Short name, unique per defect and calendar. */
  name: string;
  /** The spec-correct output of `run()`. */
  expected: string;
  run: () => string;
}

const MAX_ISO = "+275760-09-13";
const MIN_ISO = "-271821-04-19";

/** `year|monthCode|day` of an ISO date read in `calendar`. */
function readFields(iso: string, calendar: string): string {
  const date = Temporal.PlainDate.from(iso).withCalendar(calendar);
  return `${date.year}|${date.monthCode}|${date.day}`;
}

function fieldsToIso(
  calendar: string,
  year: number,
  month: number,
  day: number,
): string {
  return Temporal.PlainDate.from(
    { calendar, year, month, day },
    { overflow: "reject" },
  )
    .withCalendar("iso8601")
    .toString();
}

/**
 * test262 `intl402/Temporal/PlainDate/from/extreme-dates.js`, as
 * `[calendar, minYear, minMonth, minDay, maxYear, maxMonth, maxDay]` (ordinal months).
 */
const extremeDateRows: readonly [
  string,
  number,
  number,
  number,
  number,
  number,
  number,
][] = [
  ["buddhist", -271278, 4, 19, 276303, 9, 13],
  ["hebrew", -268058, 11, 4, 279517, 10, 11],
  ["indian", -271899, 1, 29, 275682, 6, 22],
  ["islamic-civil", -280804, 3, 21, 283583, 5, 23],
  ["islamic-tbla", -280804, 3, 22, 283583, 5, 24],
  ["islamic-umalqura", -280804, 3, 21, 283583, 5, 23],
  ["persian", -272442, 1, 9, 275139, 7, 12],
  ["ethioaa", -266323, 3, 23, 281247, 5, 22],
];

/** D1: fields → ISO probes outside the legacy `Date` range near both limits and throws. */
const d1Repros: Repro[] = extremeDateRows.flatMap(
  ([calendar, minY, minM, minD, maxY, maxM, maxD]): Repro[] => [
    {
      defect: "D1",
      calendar,
      name: "fieldsMax",
      expected: MAX_ISO,
      run: () => fieldsToIso(calendar, maxY, maxM, maxD),
    },
    {
      defect: "D1",
      calendar,
      name: "fieldsMin",
      expected: MIN_ISO,
      run: () => fieldsToIso(calendar, minY, minM, minD),
    },
  ],
);

function isoOf(date: Temporal.PlainDate): string {
  return date.withCalendar("iso8601").toString();
}

function monthsUntil(calendar: string, from: string, to: string): string {
  return Temporal.PlainDate.from(from)
    .withCalendar(calendar)
    .until(Temporal.PlainDate.from(to).withCalendar(calendar), {
      largestUnit: "months",
    })
    .toString();
}

/**
 * D1 in add and until: the same out-of-range probe as fields → ISO. Expected values are Chromium 152
 * native Temporal (q2-xscan-chromium152.json): `until(+275760-07-01, max)` is `edge.max[74]`, the
 * add rows are `edge.buddhist.max[366]` and `edge["islamic-civil"].min[400]`.
 */
const d1ArithmeticRepros: Repro[] = [
  ...(
    [
      ["hebrew", "P2M15D"],
      ["buddhist", "P2M12D"],
      ["islamic-civil", "P2M15D"],
      ["islamic-tbla", "P2M15D"],
      ["islamic-umalqura", "P2M15D"],
      ["persian", "P2M12D"],
      ["indian", "P2M12D"],
      ["ethioaa", "P2M14D"],
    ] as const
  ).map(([calendar, expected]): Repro => ({
    defect: "D1",
    calendar,
    name: "untilNearMax",
    expected,
    run: () => monthsUntil(calendar, "+275760-07-01", MAX_ISO),
  })),
  {
    defect: "D1",
    calendar: "buddhist",
    name: "addNearMax",
    expected: MAX_ISO,
    run: () =>
      isoOf(
        Temporal.PlainDate.from("+275759-09-13")
          .withCalendar("buddhist")
          .add({ years: 1 }),
      ),
  },
  {
    defect: "D1",
    calendar: "islamic-civil",
    name: "subtractNearMin",
    expected: "-271821-06-03",
    run: () =>
      isoOf(
        Temporal.PlainDate.from("-271820-05-23")
          .withCalendar("islamic-civil")
          .subtract({ years: 1 }),
      ),
  },
];

/**
 * D6: `until` re-constrains the day while counting months. The spec's NonISODateSurpasses compares
 * the un-constrained day, so a month-end start does not reach a shorter month's end. Hebrew and
 * ethioaa are test262 `wrapping-at-end-of-month-{hebrew,ethioaa}.js`; the rest are Chromium 152
 * (q2-grid-chromium152.json, the first D6 row of each calendar).
 */
const d6Repros: Repro[] = [
  ...(
    [
      ["buddhist", "2023-08-31", "2023-09-30", "P30D"],
      ["japanese", "2023-08-31", "2023-09-30", "P30D"],
      ["roc", "2023-08-31", "2023-09-30", "P30D"],
      ["persian", "2023-09-22", "2023-10-22", "P30D"],
      ["indian", "2023-09-22", "2023-10-22", "P30D"],
      ["islamic-civil", "2023-06-19", "2023-07-18", "P29D"],
      ["islamic-tbla", "2023-06-18", "2023-07-17", "P29D"],
      ["islamic-umalqura", "2023-07-18", "2023-08-16", "P29D"],
    ] as const
  ).map(([calendar, from, to, expected]): Repro => ({
    defect: "D6",
    calendar,
    name: "monthEnd",
    expected,
    run: () => monthsUntil(calendar, from, to),
  })),
  ...(
    [
      ["hebrew", 5783, "M07", 30, "M08", 29, "P29D"],
      ["ethioaa", 1970, "M12", 28, "M13", 5, "P7D"],
    ] as const
  ).map(
    ([calendar, year, fromCode, fromDay, toCode, toDay, expected]): Repro => ({
      defect: "D6",
      calendar,
      name: "monthEnd",
      expected,
      run: () =>
        Temporal.PlainDate.from(
          { calendar, year, monthCode: fromCode, day: fromDay },
          { overflow: "reject" },
        )
          .until(
            Temporal.PlainDate.from(
              { calendar, year, monthCode: toCode, day: toDay },
              { overflow: "reject" },
            ),
            { largestUnit: "months" },
          )
          .toString(),
    }),
  ),
];

/**
 * D7: `until` with `largestUnit: "years"` from a leap-year `M05L` date throws "mixed-sign"
 * (tc39/proposal-temporal#3159). Chromium 152: ISO 2024-02-11 + 384 days is `P12M29D`.
 */
const d7Repro: Repro = {
  defect: "D7",
  calendar: "hebrew",
  name: "mixedSign",
  expected: "P12M29D",
  run: () =>
    Temporal.PlainDate.from({
      calendar: "hebrew",
      year: 5784,
      month: 6,
      day: 2,
    })
      .until(
        Temporal.PlainDate.from({
          calendar: "hebrew",
          year: 5785,
          month: 6,
          day: 1,
        }),
        { largestUnit: "years" },
      )
      .toString(),
};

/**
 * D1 in `Duration` rounding: a calendared `relativeTo` near the maximum reaches the same fields ->
 * ISO probe. Chromium 153: P40D from Hebrew 279517-08-15 is 1 month (M08 has 30 days) and 10 days.
 */
const d1RelativeToRepro: Repro = {
  defect: "D1",
  calendar: "hebrew",
  name: "relativeTo",
  expected: "P1M10D",
  run: () =>
    Temporal.Duration.from("P40D")
      .round({
        largestUnit: "months",
        relativeTo: Temporal.PlainDate.from({
          calendar: "hebrew",
          year: 279517,
          month: 8,
          day: 15,
        }),
      })
      .toString(),
};

function readRepro(
  defect: DefectId,
  calendar: string,
  iso: string,
  expected: string,
): Repro {
  return {
    defect,
    calendar,
    name: iso,
    expected,
    run: () => readFields(iso, calendar),
  };
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

export const repros: readonly Repro[] = [
  ...zonedARepros,
  ...zonedBRepros,
  ...zonedDRepros,
  ...d1Repros,
  ...d1ArithmeticRepros,
  d1RelativeToRepro,
  ...d6Repros,
  d7Repro,
  // D2: buddhist read through ICU4C's Julian/Gregorian hybrid. The Intl era/monthCode proposal
  // makes buddhist proleptic with month and day identical to ISO; Chromium 152 agrees.
  readRepro("D2", "buddhist", "1000-01-01", "1543|M01|1"),
  readRepro("D2", "buddhist", "1582-10-04", "2125|M10|4"),
  // D3: Hebrew `inLeapYear` uses JS `%` on negative years, so every year <= -1 is "leap".
  // Year -96239 is common: (7 × -96239 + 1) mod 19 = 11, not < 7.
  {
    defect: "D3",
    calendar: "hebrew",
    name: "-100000-01-01",
    expected: "12",
    run: () =>
      String(
        Temporal.PlainDate.from("-100000-01-01").withCalendar("hebrew")
          .monthsInYear,
      ),
  },
  // D4: ICU4C Hebrew is one day off for years <= 0 (fixed in ICU 5267bb5778, ICU-23007).
  // Chromium 152 and the Dershowitz–Reingold arithmetic agree on these days.
  readRepro("D4", "hebrew", "-271821-11-05", "-268057|M05|28"),
  readRepro("D4", "hebrew", "-003761-09-01", "0|M01|13"),
  // D5: the polyfill's stale "V8 bug 10529" detector throws for every ISO year < 1.
  readRepro("D5", "indian", "-000500-06-15", "-578|M03|25"),
  // D8: pre-proposal era codes. test262 japanese-pre-meiji.js and the proposal's era table:
  // `ce` up to 1872-12-31, `bce` for ISO years <= 0.
  ...(
    [
      ["1800-01-01", "ce|1800"],
      ["1872-12-31", "ce|1872"],
      ["0000-12-31", "bce|1"],
    ] as const
  ).map(([iso, expected]): Repro => ({
    defect: "D8",
    calendar: "japanese",
    name: iso,
    expected,
    run: () => {
      const date = Temporal.PlainDate.from(iso).withCalendar("japanese");
      return `${date.era}|${date.eraYear}`;
    },
  })),
];

/** The repro with this defect, calendar and name, if any. */
export function findRepro(
  defect: DefectId | ZonedDefectId,
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
