/**
 * One fixed call per function that takes a time zone and returns a result with no zone in it.
 *
 * Each entry calls its function with a zone and an instant `at`, and with every other argument
 * valid. `src/test/zoneArgument.test.ts` runs the table to prove that a stored UTC offset
 * (`±HH:MM:SS`) is read wherever a time zone identifier is, and that every input that worked before
 * returns what it returned before.
 *
 * The library is a parameter and this file imports types only, so the same table also ran against
 * the published build to record `zoneArgumentBaseline.json` before any function changed.
 */
type Library = typeof import("../index");

/** How far from `at` a call reads the zone's rules, as a named span. */
export type ZoneReach = "POINT" | "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";

/** Days before and after `at` that each span covers. */
export const ZONE_REACH_DAYS: Readonly<
  Record<ZoneReach, readonly [daysBefore: number, daysAfter: number]>
> = {
  POINT: [0, 0],
  DAY: [1, 1],
  WEEK: [8, 8],
  MONTH: [8, 50],
  QUARTER: [1, 100],
  YEAR: [370, 370],
};

export interface ZoneArgumentCall {
  /** What the function returns for invalid input. */
  sentinel: unknown;
  /** How far from `at` the call reads the zone, for a named zone to stand in for its offset. */
  reach: ZoneReach;
  /** The call whose result shows whether the zone was accepted. */
  run: (zone: unknown) => unknown;
  /** More calls with the same zone, compared alongside `run`. */
  more?: (zone: unknown) => unknown[];
  /** True when a fixed offset's real answer equals the sentinel, so acceptance cannot be seen. */
  sentinelIsAnswer?: true;
  /** The part of the result that does not name the zone, compared between a zone and its offset. */
  zoneless?: (result: unknown) => unknown;
}

const POINT: ZoneReach = "POINT";
const DAY: ZoneReach = "DAY";
const WEEK: ZoneReach = "WEEK";
const MONTH: ZoneReach = "MONTH";
const QUARTER: ZoneReach = "QUARTER";
const YEAR: ZoneReach = "YEAR";

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

function weeklyWindows(from: string, to: string) {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, [{ from, to }]]));
}

/**
 * The calls, keyed by function name.
 *
 * @param lib the library under test (`src/index.ts`, or the published build)
 * @param at a UTC instant on a whole second, ending in `Z`; the clock must be pinned to it for the
 *   `getZoned…` readers
 */
export function zoneArgumentCalls(
  lib: Library,
  at: string,
): Record<string, ZoneArgumentCall> {
  const instant = lib.Temporal.Instant.from(at);
  const ms = instant.epochMilliseconds;
  const year = instant.toZonedDateTimeISO("UTC").year;
  /** The digits of `at`, read as a local wall time. */
  const local = at.slice(0, -1);
  /** `at` with a nanosecond fraction, so the sub-second readers have something to read. */
  const precise = instant.add({ nanoseconds: 123_456_789 }).toString();
  const later = (hours: number): string => instant.add({ hours }).toString();
  const laterMs = (hours: number): number => ms + hours * 3_600_000;
  const z = (zone: unknown): string => zone as string;
  const tz = (zone: unknown): { timeZone: string } => ({ timeZone: z(zone) });

  const businessHours = (zone: unknown) => ({
    timeZone: z(zone),
    weekly: weeklyWindows("08:00", "17:00"),
  });
  const alwaysOpen = (zone: unknown) => ({
    timeZone: z(zone),
    weekly: weeklyWindows("00:00", "00:00"),
  });
  const threeDays = { start: at, end: later(72) };

  const text = (
    reach: ZoneReach,
    run: (zone: unknown) => unknown,
    more?: (zone: unknown) => unknown[],
  ): ZoneArgumentCall => ({ sentinel: "", reach, run, more });
  const nullable = (
    reach: ZoneReach,
    run: (zone: unknown) => unknown,
    more?: (zone: unknown) => unknown[],
  ): ZoneArgumentCall => ({ sentinel: null, reach, run, more });
  const flag = (
    reach: ZoneReach,
    run: (zone: unknown) => unknown,
    more?: (zone: unknown) => unknown[],
  ): ZoneArgumentCall => ({ sentinel: false, reach, run, more });
  const list = (
    reach: ZoneReach,
    run: (zone: unknown) => unknown,
    more?: (zone: unknown) => unknown[],
  ): ZoneArgumentCall => ({ sentinel: [], reach, run, more });

  return {
    // instant/convert
    resolveLocal: text(
      DAY,
      (zone) => lib.resolveLocal(local, z(zone)),
      (zone) => [
        lib.resolveLocal(local, z(zone), { disambiguation: "earlier" }),
        lib.resolveLocal(local, z(zone), { disambiguation: "later" }),
        lib.resolveLocal(local, z(zone), { disambiguation: "reject" }),
      ],
    ),
    classifyLocal: nullable(DAY, (zone) => lib.classifyLocal(local, z(zone))),
    toOffsetInstant: {
      ...nullable(POINT, (zone) => lib.toOffsetInstant(at, z(zone))),
      zoneless: (result) => {
        if (result === null) return null;
        const pair = result as { instant: string; offset: string };
        return { instant: pair.instant, offset: pair.offset };
      },
    },

    // zoned/get
    getTimeZoneOffset: text(POINT, (zone) =>
      lib.getTimeZoneOffset(z(zone), at),
    ),
    getDstTransitions: {
      ...list(YEAR, (zone) => lib.getDstTransitions(z(zone), year)),
      sentinelIsAnswer: true,
    },
    getZonedDay: text(POINT, (zone) => lib.getZonedDay(z(zone))),
    getZonedDayOfWeek: nullable(POINT, (zone) =>
      lib.getZonedDayOfWeek(z(zone)),
    ),
    getZonedHour: text(POINT, (zone) => lib.getZonedHour(z(zone))),
    getZonedMicrosecond: text(POINT, (zone) =>
      lib.getZonedMicrosecond(z(zone)),
    ),
    getZonedMillisecond: text(POINT, (zone) =>
      lib.getZonedMillisecond(z(zone)),
    ),
    getZonedMinute: text(POINT, (zone) => lib.getZonedMinute(z(zone))),
    getZonedMonth: text(POINT, (zone) => lib.getZonedMonth(z(zone))),
    getZonedNanosecond: text(POINT, (zone) => lib.getZonedNanosecond(z(zone))),
    getZonedNowUnit: text(
      POINT,
      (zone) => lib.getZonedNowUnit(z(zone), "hour"),
      (zone) =>
        (
          [
            "year",
            "month",
            "week",
            "day",
            "dayOfWeek",
            "minute",
            "second",
            "millisecond",
            "microsecond",
            "nanosecond",
          ] as const
        ).map((unit) => lib.getZonedNowUnit(z(zone), unit)),
    ),
    getZonedSecond: text(POINT, (zone) => lib.getZonedSecond(z(zone))),
    getZonedToday: text(POINT, (zone) => lib.getZonedToday(z(zone))),
    getZonedWeekOfYear: nullable(POINT, (zone) =>
      lib.getZonedWeekOfYear(z(zone)),
    ),
    getZonedYear: text(POINT, (zone) => lib.getZonedYear(z(zone))),

    // zoned/validate
    hasDaylightSaving: {
      ...flag(YEAR, (zone) => lib.hasDaylightSaving(z(zone), { at })),
      sentinelIsAnswer: true,
    },

    // utc/convert
    convertUtcToPlainDate: text(POINT, (zone) =>
      lib.convertUtcToPlainDate(precise, tz(zone)),
    ),
    convertUtcToPlainDateTime: text(POINT, (zone) =>
      lib.convertUtcToPlainDateTime(precise, tz(zone)),
    ),
    convertUtcToPlainTime: text(POINT, (zone) =>
      lib.convertUtcToPlainTime(precise, tz(zone)),
    ),

    // utc/parse
    parseDateFromUtc: text(POINT, (zone) =>
      lib.parseDateFromUtc(precise, tz(zone)),
    ),
    parseDayFromUtc: text(POINT, (zone) =>
      lib.parseDayFromUtc(precise, tz(zone)),
    ),
    parseDayOfWeekFromUtc: nullable(POINT, (zone) =>
      lib.parseDayOfWeekFromUtc(precise, tz(zone)),
    ),
    parseHourFromUtc: text(POINT, (zone) =>
      lib.parseHourFromUtc(precise, tz(zone)),
    ),
    parseMicrosecondFromUtc: text(POINT, (zone) =>
      lib.parseMicrosecondFromUtc(precise, tz(zone)),
    ),
    parseMillisecondFromUtc: text(POINT, (zone) =>
      lib.parseMillisecondFromUtc(precise, tz(zone)),
    ),
    parseMinuteFromUtc: text(POINT, (zone) =>
      lib.parseMinuteFromUtc(precise, tz(zone)),
    ),
    parseMonthFromUtc: text(POINT, (zone) =>
      lib.parseMonthFromUtc(precise, tz(zone)),
    ),
    parseNanosecondFromUtc: text(POINT, (zone) =>
      lib.parseNanosecondFromUtc(precise, tz(zone)),
    ),
    parseSecondFromUtc: text(POINT, (zone) =>
      lib.parseSecondFromUtc(precise, tz(zone)),
    ),
    parseTimeFromUtc: text(POINT, (zone) =>
      lib.parseTimeFromUtc(precise, tz(zone)),
    ),
    parseUnitFromUtc: text(
      POINT,
      (zone) => lib.parseUnitFromUtc(precise, "hour", tz(zone)),
      (zone) => [
        lib.parseUnitFromUtc(precise, "day", tz(zone)),
        lib.parseUnitFromUtc(precise, "dayOfWeek", tz(zone)),
        lib.parseUnitFromUtc(precise, "second", tz(zone)),
        lib.parseUnitFromUtc(precise, "nanosecond", tz(zone)),
        lib.parseUnitFromUtc(precise, "week", {
          ...tz(zone),
          weekStartsOn: "sunday",
        }),
      ],
    ),
    parseWeekFromUtc: nullable(POINT, (zone) =>
      lib.parseWeekFromUtc(precise, tz(zone)),
    ),
    parseYearFromUtc: text(POINT, (zone) =>
      lib.parseYearFromUtc(precise, tz(zone)),
    ),

    // utc/format
    formatRelativeUtc: text(MONTH, (zone) =>
      lib.formatRelativeUtc(later(45 * 24), "en-US", {
        ...tz(zone),
        reference: at,
        largestUnit: "month",
      }),
    ),

    // unix/convert
    convertUnixToPlainDate: text(
      POINT,
      (zone) => lib.convertUnixToPlainDate(ms, tz(zone)),
      (zone) => [
        lib.convertUnixToPlainDate(Math.floor(ms / 1000), {
          ...tz(zone),
          epochUnit: "seconds",
        }),
      ],
    ),
    convertUnixToPlainDateTime: text(POINT, (zone) =>
      lib.convertUnixToPlainDateTime(ms + 123, tz(zone)),
    ),
    convertUnixToPlainTime: text(POINT, (zone) =>
      lib.convertUnixToPlainTime(ms + 123, tz(zone)),
    ),

    // unix/parse
    parseDateFromUnix: text(POINT, (zone) =>
      lib.parseDateFromUnix(ms, tz(zone)),
    ),
    parseDayFromUnix: text(POINT, (zone) => lib.parseDayFromUnix(ms, tz(zone))),
    parseDayOfWeekFromUnix: nullable(POINT, (zone) =>
      lib.parseDayOfWeekFromUnix(ms, tz(zone)),
    ),
    parseHourFromUnix: text(POINT, (zone) =>
      lib.parseHourFromUnix(ms, tz(zone)),
    ),
    parseMicrosecondFromUnix: text(POINT, (zone) =>
      lib.parseMicrosecondFromUnix(ms + 123, tz(zone)),
    ),
    parseMillisecondFromUnix: text(POINT, (zone) =>
      lib.parseMillisecondFromUnix(ms + 123, tz(zone)),
    ),
    parseMinuteFromUnix: text(POINT, (zone) =>
      lib.parseMinuteFromUnix(ms, tz(zone)),
    ),
    parseMonthFromUnix: text(POINT, (zone) =>
      lib.parseMonthFromUnix(ms, tz(zone)),
    ),
    parseNanosecondFromUnix: text(POINT, (zone) =>
      lib.parseNanosecondFromUnix(ms + 123, tz(zone)),
    ),
    parseSecondFromUnix: text(POINT, (zone) =>
      lib.parseSecondFromUnix(ms, tz(zone)),
    ),
    parseTimeFromUnix: text(POINT, (zone) =>
      lib.parseTimeFromUnix(ms + 123, tz(zone)),
    ),
    parseUnitFromUnix: text(
      POINT,
      (zone) => lib.parseUnitFromUnix(ms, "hour", tz(zone)),
      (zone) => [
        lib.parseUnitFromUnix(ms, "day", tz(zone)),
        lib.parseUnitFromUnix(ms, "dayOfWeek", tz(zone)),
        lib.parseUnitFromUnix(ms, "second", tz(zone)),
        lib.parseUnitFromUnix(ms, "week", {
          ...tz(zone),
          weekStartsOn: "sunday",
        }),
      ],
    ),
    parseWeekFromUnix: nullable(POINT, (zone) =>
      lib.parseWeekFromUnix(ms, tz(zone)),
    ),
    parseYearFromUnix: text(POINT, (zone) =>
      lib.parseYearFromUnix(ms, tz(zone)),
    ),

    // unix/calculate
    addUnix: nullable(
      MONTH,
      (zone) => lib.addUnix(ms, { months: 1, days: 1, hours: 5 }, tz(zone)),
      (zone) => [lib.addUnix(ms, { days: 1 }, tz(zone))],
    ),
    subtractUnix: nullable(
      WEEK,
      (zone) => lib.subtractUnix(ms, { days: 1 }, tz(zone)),
      (zone) => [lib.subtractUnix(ms, { days: 6, hours: 5 }, tz(zone))],
    ),
    diffUnix: nullable(
      MONTH,
      (zone) =>
        lib.diffUnix(ms, laterMs(40 * 24 + 7), ["months", "days", "hours"], {
          ...tz(zone),
        }),
      (zone) => [
        lib.diffUnix(ms, laterMs(40 * 24 + 7), "days", tz(zone)),
        lib.diffUnix(ms, laterMs(-31), "hours", tz(zone)),
      ],
    ),
    diffUnixAsDuration: text(MONTH, (zone) =>
      lib.diffUnixAsDuration(ms, laterMs(40 * 24 + 7), "months", tz(zone)),
    ),
    startOfUnix: nullable(
      WEEK,
      (zone) => lib.startOfUnix(ms, "day", tz(zone)),
      (zone) => [
        lib.startOfUnix(ms, "hour", tz(zone)),
        lib.startOfUnix(ms, "week", tz(zone)),
        lib.startOfUnix(ms, "week", { ...tz(zone), weekStartsOn: "sunday" }),
      ],
    ),
    endOfUnix: nullable(
      MONTH,
      (zone) => lib.endOfUnix(ms, "day", tz(zone)),
      (zone) => [
        lib.endOfUnix(ms, "hour", tz(zone)),
        lib.endOfUnix(ms, "week", tz(zone)),
        lib.endOfUnix(ms, "month", tz(zone)),
      ],
    ),
    startOfQuarterForUnix: nullable(QUARTER, (zone) =>
      lib.startOfQuarterForUnix(ms, tz(zone)),
    ),
    endOfQuarterForUnix: nullable(QUARTER, (zone) =>
      lib.endOfQuarterForUnix(ms, tz(zone)),
    ),
    roundUnix: nullable(
      DAY,
      (zone) =>
        lib.roundUnix(ms + 12_345, { ...tz(zone), smallestUnit: "day" }),
      (zone) => [
        lib.roundUnix(ms + 12_345, { ...tz(zone), smallestUnit: "hour" }),
        lib.roundUnix(ms + 12_345, {
          ...tz(zone),
          smallestUnit: "minute",
          roundingMode: "ceil",
        }),
      ],
    ),
    setUnix: nullable(
      DAY,
      (zone) => lib.setUnix(ms, { hour: 2, minute: 30, second: 15 }, tz(zone)),
      (zone) => [
        lib.setUnix(ms, { day: 20 }, tz(zone)),
        lib.setUnix(
          ms,
          { hour: 2, minute: 30 },
          {
            ...tz(zone),
            disambiguation: "earlier",
          },
        ),
      ],
    ),
    isBetweenUnix: flag(POINT, (zone) =>
      lib.isBetweenUnix(ms, ms - 1000, ms + 1000, tz(zone)),
    ),

    // unix/compare
    areUnixEqualBy: flag(
      DAY,
      (zone) => lib.areUnixEqualBy(ms, ms + 60_000, "month", tz(zone)),
      (zone) => [
        lib.areUnixEqualBy(ms, laterMs(6), "day", tz(zone)),
        lib.areUnixEqualBy(ms, laterMs(-12), "day", tz(zone)),
      ],
    ),

    // unix/interval
    intervalCountUnix: nullable(WEEK, (zone) =>
      lib.intervalCountUnix(ms, laterMs(77), "day", tz(zone)),
    ),
    intervalFromDurationUnix: nullable(
      MONTH,
      (zone) => lib.intervalFromDurationUnix(ms, "P1M2DT3H", "start", tz(zone)),
      (zone) => [lib.intervalFromDurationUnix(ms, "P6DT3H", "end", tz(zone))],
    ),
    intervalLengthUnix: nullable(WEEK, (zone) =>
      lib.intervalLengthUnix(ms, laterMs(77), "day", tz(zone)),
    ),
    intervalOverlappingDaysUnix: nullable(WEEK, (zone) =>
      lib.intervalOverlappingDaysUnix(
        ms,
        laterMs(72),
        laterMs(24),
        laterMs(120),
        tz(zone),
      ),
    ),
    splitIntervalByUnitUnix: list(WEEK, (zone) =>
      lib.splitIntervalByUnitUnix(ms, laterMs(72), "day", 1, tz(zone)),
    ),

    // unix/format
    formatRelativeUnix: text(MONTH, (zone) =>
      lib.formatRelativeUnix(laterMs(45 * 24), "en-US", {
        ...tz(zone),
        reference: ms,
        largestUnit: "month",
      }),
    ),

    // calendar/calculate
    floorToZone: text(
      WEEK,
      (zone) => lib.floorToZone(at, "day", z(zone)),
      (zone) => [
        lib.floorToZone(at, "hour", z(zone)),
        lib.floorToZone(at, "week", z(zone)),
      ],
    ),
    bucketRange: list(
      WEEK,
      (zone) => lib.bucketRange(at, later(72), "day", z(zone)),
      (zone) => [lib.bucketRange(at, later(5), "hour", z(zone))],
    ),

    // calendar/hours
    recurringWindows: list(WEEK, (zone) =>
      lib.recurringWindows(weeklyWindows("08:00", "17:00"), threeDays, z(zone)),
    ),
    addOperatingTime: text(MONTH, (zone) =>
      lib.addOperatingTime(at, "PT20H", businessHours(zone), {
        within: "P30D",
      }),
    ),
    isOpenAt: flag(
      WEEK,
      (zone) => lib.isOpenAt(at, alwaysOpen(zone)),
      (zone) => [lib.isOpenAt(at, businessHours(zone))],
    ),
    nextCloseAt: text(MONTH, (zone) =>
      lib.nextCloseAt(at, businessHours(zone), { within: "P30D" }),
    ),
    nextOpenAt: text(MONTH, (zone) =>
      lib.nextOpenAt(later(-6), businessHours(zone), { within: "P30D" }),
    ),
    operatingIntervals: list(WEEK, (zone) =>
      lib.operatingIntervals(businessHours(zone), threeDays),
    ),
    operatingTimeBetween: text(WEEK, (zone) =>
      lib.operatingTimeBetween(at, later(72), businessHours(zone)),
    ),

    // intermodal
    freeTimeExpiry: nullable(WEEK, (zone) =>
      lib.freeTimeExpiry(at, 3, {
        basis: "calendar",
        firstDay: "eventDay",
        timeZone: z(zone),
      }),
    ),
    chargeableDays: nullable(WEEK, (zone) =>
      lib.chargeableDays(at, later(6 * 24), 3, {
        basis: "calendar",
        chargeBasis: "calendar",
        firstDay: "nextDay",
        timeZone: z(zone),
        tiers: [2],
      }),
    ),
    bolTimestamp: text(POINT, (zone) =>
      lib.bolTimestamp(at, "issue", tz(zone)),
    ),
  };
}

/** A call to a function that writes the zone into its result, or hands it to `Intl`. */
export interface ZoneIdentifierCall {
  /** What the function returns for invalid input. */
  sentinel: unknown;
  /** The call, with every argument but the zone valid. */
  run: (zone: unknown) => unknown;
  /** True when the result is locale text, which ICU words differently between versions. */
  localeText?: true;
}

/**
 * One fixed call per function that takes a time zone identifier only, keyed by function name.
 *
 * These keep the zone: their result carries it in a bracket or a record, or `Intl.DateTimeFormat`
 * reads it. A UTC offset with seconds is not a time zone identifier, so each returns its sentinel
 * for one.
 *
 * @param lib the library under test
 * @param at a UTC instant on a whole second, ending in `Z`
 */
export function zoneIdentifierCalls(
  lib: Library,
  at: string,
): Record<string, ZoneIdentifierCall> {
  const instant = lib.Temporal.Instant.from(at);
  const ms = instant.epochMilliseconds;
  const local = at.slice(0, -1);
  const date = local.slice(0, 10);
  const later = (hours: number): string => instant.add({ hours }).toString();
  const z = (zone: unknown): string => zone as string;
  const calendar = (zone: unknown) => ({
    weekend: [6, 7],
    holidays: [date],
    timeZone: z(zone),
  });
  const legs = (zone: unknown) => [
    { departure: at, duration: "PT36H", timeZone: z(zone) },
  ];

  return {
    // The result carries the zone.
    convertUtcToZoned: {
      sentinel: "",
      run: (zone) => lib.convertUtcToZoned(at, z(zone)),
    },
    convertUnixToZoned: {
      sentinel: "",
      run: (zone) => lib.convertUnixToZoned(ms, z(zone)),
    },
    convertPlainDateTimeToZoned: {
      sentinel: "",
      run: (zone) => lib.convertPlainDateTimeToZoned(local, z(zone)),
    },
    convertZonedToZoned: {
      sentinel: "",
      run: (zone) => lib.convertZonedToZoned(`${local}+00:00[UTC]`, z(zone)),
    },
    getZonedNow: {
      sentinel: "",
      run: (zone) => lib.getZonedNow(z(zone), { smallestUnit: "second" }),
    },
    fromNanoseconds: {
      sentinel: "",
      run: (zone) => lib.fromNanoseconds(instant.epochNanoseconds, z(zone)),
    },
    fromOffsetInstant: {
      sentinel: "",
      run: (zone) =>
        lib.fromOffsetInstant({
          instant: at,
          offset: "+05:30",
          timeZone: z(zone),
        }),
    },
    cutoffAt: {
      sentinel: "",
      run: (zone) =>
        lib.cutoffAt(at, "P2D", { timeZone: z(zone), atLocalTime: "17:00" }),
    },
    cutoffSchedule: {
      sentinel: [],
      run: (zone) =>
        lib.cutoffSchedule(at, [{ name: "gate-in", offset: "P1D" }], {
          timeZone: z(zone),
        }),
    },
    crossingTime: {
      sentinel: null,
      run: (zone) => lib.crossingTime(at, later(9), z(zone)),
    },
    dwellTime: {
      sentinel: null,
      run: (zone) => lib.dwellTime(at, later(9), z(zone)),
    },
    etaAtZone: { sentinel: "", run: (zone) => lib.etaAtZone(at, z(zone)) },
    scheduleDelivery: {
      sentinel: null,
      run: (zone) => lib.scheduleDelivery(legs(zone)),
    },
    multimodalETA: {
      sentinel: null,
      run: (zone) => lib.multimodalETA(legs(zone)),
    },

    // The zone is part of a stored BusinessCalendar record.
    isValidBusinessCalendar: {
      sentinel: false,
      run: (zone) => lib.isValidBusinessCalendar(calendar(zone)),
    },
    mergeCalendars: {
      sentinel: null,
      run: (zone) => lib.mergeCalendars([calendar(zone), calendar(zone)]),
    },
    businessDaysBetween: {
      sentinel: null,
      run: (zone) =>
        lib.businessDaysBetween(date, later(240).slice(0, 10), calendar(zone)),
    },
    nextBusinessDay: {
      sentinel: "",
      run: (zone) => lib.nextBusinessDay(date, calendar(zone)),
    },
    previousBusinessDay: {
      sentinel: "",
      run: (zone) => lib.previousBusinessDay(date, calendar(zone)),
    },
    rollDate: {
      sentinel: "",
      run: (zone) => lib.rollDate(date, "following", calendar(zone)),
    },
    addBusinessDays: {
      sentinel: "",
      run: (zone) => lib.addBusinessDays(date, 3, calendar(zone)),
    },
    subtractBusinessDays: {
      sentinel: "",
      run: (zone) => lib.subtractBusinessDays(date, 3, calendar(zone)),
    },
    isBusinessDay: {
      sentinel: false,
      run: (zone) => lib.isBusinessDay(later(48).slice(0, 10), calendar(zone)),
    },

    // The zone goes to Intl.DateTimeFormat.
    formatUtc: {
      sentinel: "",
      localeText: true,
      run: (zone) => lib.formatUtc(at, "en-US", { timeZone: z(zone) }),
    },
    formatCalendarUtc: {
      sentinel: "",
      localeText: true,
      run: (zone) =>
        lib.formatCalendarUtc(later(24), "en-US", {
          timeZone: z(zone),
          reference: at,
        }),
    },
    formatUnix: {
      sentinel: "",
      localeText: true,
      run: (zone) => lib.formatUnix(ms, "en-US", { timeZone: z(zone) }),
    },
    formatCalendarUnix: {
      sentinel: "",
      localeText: true,
      run: (zone) =>
        lib.formatCalendarUnix(ms + 86_400_000, "en-US", {
          timeZone: z(zone),
          reference: ms,
        }),
    },
    formatTimeZoneName: {
      sentinel: "",
      localeText: true,
      run: (zone) => lib.formatTimeZoneName(z(zone), "en-US"),
    },
  };
}

/** The zones each identifier-only call is recorded with: a minute offset, then two with seconds. */
export const identifierZones: readonly string[] = [
  "+05:30",
  "-00:44:30",
  "+05:30:00",
];

/** The instant the baseline was recorded at: America/New_York springs forward five hours earlier. */
export const BASELINE_AT = "2024-03-10T12:00:00Z";

/**
 * Time zone arguments whose result must not change: names in several spellings, an offset to the
 * minute in every spelling a time zone identifier allows, and values no validator accepts.
 */
export const baselineOnlyZones: readonly unknown[] = [
  "Japan",
  "utc",
  "america/new_york",
  "Etc/GMT+5",
  "Africa/Monrovia",
  "+05:30",
  "+0530",
  "+05",
  "-08:00",
  "-0800",
  "-08",
  "+00:00",
  "-00:00",
  "+14:00",
  "-12",
  "+23:59",
  "-23:59",
  "Invalid/Zone",
  "",
  "Z",
  "+24:00",
  "+5:30",
  "UTC+05:00",
  "+05:30:00.5",
  "-0400:30",
  5,
  null,
];

/** The key a zone argument is recorded under. */
export function zoneLabel(zone: unknown): string {
  return typeof zone === "string" ? zone : `(${String(zone)})`;
}

/** A result as JSON stores it, so a recorded value and a live one compare alike. */
export function asRecorded(result: unknown): unknown {
  return JSON.parse(JSON.stringify(result ?? null)) as unknown;
}
