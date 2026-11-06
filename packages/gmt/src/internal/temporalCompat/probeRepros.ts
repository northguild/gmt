import { Temporal } from "../temporal";

/*
 * Upstream repros for each `temporal-polyfill` / engine defect GMT still works around, with the
 * spec-correct answer. This file holds the repros the shipped capability probes read (D16, D17,
 * D19 and D22); `repros.ts` adds the canary-only D9 timing repro. It imports ONLY the polyfill,
 * through `../temporal` (no other GMT module), so a canary script can load its compiled copy
 * straight from `dist`.
 *
 * `expected` is test data, like a fixture: it is compared against `run()` and never read by a
 * fallback. Sources: Chromium 153 native Temporal and the ECMA-402 and UTS #35 text cited on each
 * group, never the polyfill or GMT. See README.md for each defect.
 */

/** Defect ids from the temporalCompat README's workaround table. */
export type DefectId = "D16" | "D17" | "D19" | "D22";

export interface ProbeRepro {
  defect: DefectId;
  /** Temporal calendar id the repro exercises. */
  calendar: string;
  /** Short name, unique per defect and calendar. */
  name: string;
  /** The spec-correct output of `run()`. */
  expected: string;
  run: () => string;
}

/**
 * D16 (`zoned/format/formatZonedRange.ts`): ICU-20548. `DateIntervalFormat` skeletons lose the
 * `timeZoneName` width: V8 and JSC print `long` and `longGeneric` as short names and drop
 * `shortOffset` and `longOffset`, in a range only. UTS #35 (Matching Skeletons) expects "fields in
 * the skeleton and pattern ... to be adjusted in parallel", so the range pattern for a skeleton
 * keeps the requested zone name width, and the range's zone part equals the single format's. The
 * repro compares the two for one style, so it owns no CLDR string; the zone and the
 * locale do not matter, the defect is in skeleton handling. `+01:00` is a fixed offset, so both
 * instants carry the same zone name.
 */
const D16_STYLES = [
  "short",
  "long",
  "shortGeneric",
  "longGeneric",
  "shortOffset",
  "longOffset",
] as const;

const d16Repros: readonly ProbeRepro[] = D16_STYLES.map(
  (style): ProbeRepro => ({
    defect: "D16",
    calendar: "iso8601",
    name: `range.${style}`,
    expected: "same",
    run: () => {
      const format = new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "numeric",
        timeZone: "+01:00",
        timeZoneName: style,
      } as Intl.DateTimeFormatOptions);
      const zonePart = (parts: Intl.DateTimeFormatPart[]) =>
        JSON.stringify(
          parts.find((part) => part.type === "timeZoneName")?.value ?? null,
        );
      const range = zonePart(format.formatRangeToParts(0, 3_600_000));
      const single = zonePart(format.formatToParts(0));
      return range === single ? "same" : `range ${range} vs single ${single}`;
    },
  }),
);

/**
 * D17 (`zoned/format/formatZonedRange.ts`): SpiderMonkey (Firefox 155) `formatRange` writes the
 * AM/PM day period where `dayPeriod` asks for a flexible one, when `timeZoneName` is also set and
 * neither `hourCycle` nor `hour12` is. ECMA-402 §11.5.8 picks the range pattern by the resolved
 * [[HourCycle]] only, and en-US resolves to h12 with or without an explicit `hourCycle: "h12"`,
 * yet the explicit one prints the flexible period and the omitted one AM/PM, so identical resolved
 * options give two range outputs. The repro compares the range's day period parts with those of
 * the two single formats, so it owns no CLDR string. The instants are 10:00 and 12:00 in `+01:00`.
 */
const d17Repros: readonly ProbeRepro[] = [
  {
    defect: "D17",
    calendar: "iso8601",
    name: "range.dayPeriod",
    expected: "same",
    run: () => {
      const format = new Intl.DateTimeFormat("en", {
        hour: "numeric",
        dayPeriod: "short",
        timeZone: "+01:00",
        timeZoneName: "short",
      });
      const dayPeriods = (parts: Intl.DateTimeFormatPart[]) =>
        parts.filter((part) => part.type === "dayPeriod").map((p) => p.value);
      const range = JSON.stringify(
        dayPeriods(format.formatRangeToParts(32_400_000, 39_600_000)),
      );
      const single = JSON.stringify([
        ...dayPeriods(format.formatToParts(32_400_000)),
        ...dayPeriods(format.formatToParts(39_600_000)),
      ]);
      return range === single ? "same" : `range ${range} vs single ${single}`;
    },
  },
];

/**
 * D19 (`internal/zonedWallClockDifference.ts`): `ZonedDateTime#equals` answers false for two
 * identifiers of one zone on a host whose `Intl.DateTimeFormat#resolvedOptions` returns the
 * identifier as written. The polyfill's `GetAvailableNamedTimeZoneIdentifier` finds the primary
 * identifier in `Intl.supportedValuesOf("timeZone")` or, for a non-primary one, takes
 * `resolvedOptions().timeZone`. ECMA-402 §6.5 (Time Zone Identifiers) says "UTC" is primary and
 * "Etc/UTC" is a non-primary identifier that resolves to "UTC", and TimeZoneEquals compares the
 * primary identifiers, so `Etc/UTC` equals `UTC` on every host. JavaScriptCore (WebKit 26.6, Safari
 * 27) keeps the identifier as written (the Time Zone Canonicalization proposal), so the polyfill
 * compares `Etc/UTC` with `UTC` there and answers false. V8 and SpiderMonkey return the primary
 * identifier. The repro names the one pair the specification fixes, so it owns no time zone data.
 */
const d19Repros: readonly ProbeRepro[] = [
  {
    defect: "D19",
    calendar: "iso8601",
    name: "etcUtcEqualsUtc",
    expected: "true",
    run: () =>
      String(
        new Temporal.ZonedDateTime(0n, "Etc/UTC").equals(
          new Temporal.ZonedDateTime(0n, "UTC"),
        ),
      ),
  },
];

/**
 * D22 (`internal/zonedDifference/nudgeOrigin.ts`): a length from a zoned `relativeTo` or start in
 * either pass of a repeated hour fails the probe when a runtime mismeasures it, or when it has no
 * spec value and the runtime answers one anyway. TC39 `ComputeNudgeWindow` takes the window's start from the origin's
 * own exact time when no unit has been added (tc39/proposal-temporal#3148 for `total`, #3149 for
 * `round`), and `DifferenceZonedDateTime` subtracts the exact times when both fall on one local date
 * (#3141). A polyfill that turns the wall clock back into an exact time with `"compatible"` takes the
 * earlier pass, and backs up a day when the end falls in the later pass at a lower wall clock. New
 * York repeats 01:00-02:00 on 2024-11-03, so from 01:30-05:00 the next day is 24 hours away and from
 * 01:30-04:00 it is 25. Expected values: Chromium 153 native Temporal. `temporal-polyfill` 1.0.8
 * passes the origin repros (`roundWeekWithoutStartDays` included) and fails two of the last three,
 * `totalsWithNoValue` and `noDayCorrection`, for the second reason only.
 *
 * The last three read lengths with no spec value, where a TC39 Assert fails, and GMT returns its
 * sentinel. They keep the probe failing until a release reports no value for all of them, because
 * removing the workaround before then would turn a sentinel back into a number.
 * - `totalsWithNoValue`, `NudgeToCalendarUnit` (tc39/proposal-temporal#3336) and
 *   `CombineDateAndTimeDuration` (#3311): Chromium 153 throws and 1.0.8 extrapolates.
 * - `noDayCorrection`, `DifferenceZonedDateTime` (#3311): Chromium 153 and 1.0.8 both answer `PT45M`.
 * - `emptyDaySpan`, `NudgeToZonedTime` (#3310): 1.0.8 passes and Chromium 153 answers `-P1DT12H`.
 */
const LATER_PASS = "2024-11-03T01:30:00-05:00[America/New_York]";
const EARLIER_PASS = "2024-11-03T01:30:00-04:00[America/New_York]";

/**
 * What `read` returns for a length from `origin`, or `"none"` when it throws. A thrown message and
 * type vary by engine and build: Chromium throws a `RangeError`, a debug polyfill's assert an `Error`.
 * Only the read can report no value, so `origin` and `duration` are parsed outside the `try`. A zone
 * this engine lacks, or an offset its data disagrees with, fails the repro rather than passing it, and
 * so does a `TypeError`, which is a broken read.
 */
export function readOrNone(
  origin: string,
  duration: string,
  read: (
    length: Temporal.Duration,
    zoned: Temporal.ZonedDateTime,
  ) => number | string,
): string {
  const zoned = Temporal.ZonedDateTime.from(origin);
  const length = Temporal.Duration.from(duration);
  try {
    return String(read(length, zoned));
  } catch (error) {
    if (error instanceof TypeError) {
      throw error;
    }
    return "none";
  }
}

const NO_CORRECTION_FROM = "1944-10-01T00:00:59-07:00[America/Phoenix]";

const d22Repros: readonly ProbeRepro[] = [
  {
    defect: "D22",
    calendar: "iso8601",
    name: "totalDaysFromLaterPass",
    expected: "0.041666666666666664",
    run: () =>
      String(
        Temporal.Duration.from("PT1H").total({
          unit: "day",
          relativeTo: LATER_PASS,
        }),
      ),
  },
  {
    defect: "D22",
    calendar: "iso8601",
    name: "roundToDayFromLaterPass",
    expected: "PT0S",
    run: () =>
      Temporal.Duration.from("PT11H45M")
        .round({ smallestUnit: "day", relativeTo: LATER_PASS })
        .toString(),
  },
  {
    defect: "D22",
    calendar: "iso8601",
    name: "untilSameDayFromLaterPass",
    expected: "PT1H",
    run: () => {
      const start = Temporal.ZonedDateTime.from(LATER_PASS);
      return start
        .until(start.add({ hours: 1 }), { largestUnit: "day" })
        .toString();
    },
  },
  {
    defect: "D22",
    calendar: "iso8601",
    name: "totalDaysFromEarlierPass",
    expected: "0.02",
    run: () =>
      String(
        Temporal.Duration.from("PT30M").total({
          unit: "day",
          relativeTo: EARLIER_PASS,
        }),
      ),
  },
  {
    defect: "D22",
    calendar: "iso8601",
    name: "roundWeekWithoutStartDays",
    expected: "P1W",
    run: () =>
      Temporal.Duration.from("P7D")
        .round({
          largestUnit: "week",
          smallestUnit: "day",
          relativeTo: LATER_PASS,
        })
        .toString(),
  },
  {
    defect: "D22",
    calendar: "iso8601",
    name: "totalsWithNoValue",
    expected: "none,none",
    run: () =>
      `${readOrNone("2024-11-02T01:30:00-04:00[America/New_York]", "PT24H30M", (length, zoned) => length.total({ unit: "day", relativeTo: zoned }))},${readOrNone("1944-10-01T00:00:59-06:00[America/Phoenix]", "PT15M", (length, zoned) => length.total({ unit: "month", relativeTo: zoned }))}`,
  },
  {
    defect: "D22",
    calendar: "iso8601",
    name: "noDayCorrection",
    expected: "none,none",
    run: () =>
      `${readOrNone(NO_CORRECTION_FROM, "-PT15M", (length, zoned) => length.round({ largestUnit: "day", relativeTo: zoned }).toString())},${readOrNone(NO_CORRECTION_FROM, "-PT15M", (length, zoned) => zoned.until(zoned.add(length), { largestUnit: "day" }).toString())}`,
  },
  {
    defect: "D22",
    calendar: "iso8601",
    name: "emptyDaySpan",
    expected: "none",
    run: () =>
      readOrNone(
        "1995-01-01T12:00:00+13:00[Pacific/Enderbury]",
        "-PT43199S",
        (length, zoned) =>
          length
            .round({
              largestUnit: "day",
              smallestUnit: "minute",
              relativeTo: zoned,
            })
            .toString(),
      ),
  },
];

/** The shipped-probe groups, each in the order the full table places it. */
export const probeReproGroups = {
  d16: d16Repros,
  d17: d17Repros,
  d19: d19Repros,
  d22: d22Repros,
} as const satisfies Record<string, readonly ProbeRepro[]>;

/** Every repro a shipped capability probe reads. */
export const probeRepros: readonly ProbeRepro[] =
  Object.values(probeReproGroups).flat();
