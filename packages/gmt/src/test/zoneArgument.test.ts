/**
 * A stored UTC offset in the time zone position.
 *
 * The library returns offsets with seconds
 * (`getTimeZoneOffset("Africa/Monrovia", "1970-01-01T12:00:00Z")` is `"-00:44:30"`), and a time
 * zone identifier stops at minutes (TC39 Temporal
 * `TimeZoneIdentifier ::: UTCOffset[~SubMinutePrecision] | TimeZoneIANAName`, §13.31). So:
 *
 * - A function whose result names no zone reads, in its time zone position, every string
 *   `isValidTimeZone` or `isValidUtcOffset` accepts. There are 84, each run here by name.
 * - A function that writes the zone into its result, or hands it to `Intl.DateTimeFormat`, takes
 *   a time zone identifier only and returns its sentinel for an offset with seconds. There are 28.
 *
 * The calls are in `./zoneArgumentCalls.ts`. Where a block compares two results, the offset it
 * passes comes from plain Temporal, never from the library.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Temporal } from "@js-temporal/polyfill";
import * as gmt from "../index";
import { battleTestTimeZones } from "./timeZoneMatrix";
import {
  asRecorded,
  BASELINE_AT,
  baselineOnlyZones,
  identifierZones,
  ZONE_REACH_DAYS,
  type ZoneArgumentCall,
  zoneArgumentCalls,
  zoneIdentifierCalls,
  zoneLabel,
  type ZoneReach,
} from "./zoneArgumentCalls";

/** The 84 functions whose result has no zone in it, by namespace. */
const ZONELESS_RESULT_FUNCTIONS: readonly string[] = [
  // instant/convert
  "resolveLocal",
  "classifyLocal",
  "toOffsetInstant",
  // zoned/get
  "getTimeZoneOffset",
  "getDstTransitions",
  "getZonedDay",
  "getZonedDayOfWeek",
  "getZonedHour",
  "getZonedMicrosecond",
  "getZonedMillisecond",
  "getZonedMinute",
  "getZonedMonth",
  "getZonedNanosecond",
  "getZonedNowUnit",
  "getZonedSecond",
  "getZonedToday",
  "getZonedWeekOfYear",
  "getZonedYear",
  // zoned/validate
  "hasDaylightSaving",
  // utc/convert
  "convertUtcToPlainDate",
  "convertUtcToPlainDateTime",
  "convertUtcToPlainTime",
  // utc/parse
  "parseDateFromUtc",
  "parseDayFromUtc",
  "parseDayOfWeekFromUtc",
  "parseHourFromUtc",
  "parseMicrosecondFromUtc",
  "parseMillisecondFromUtc",
  "parseMinuteFromUtc",
  "parseMonthFromUtc",
  "parseNanosecondFromUtc",
  "parseSecondFromUtc",
  "parseTimeFromUtc",
  "parseUnitFromUtc",
  "parseWeekFromUtc",
  "parseYearFromUtc",
  // utc/format
  "formatRelativeUtc",
  // unix/convert
  "convertUnixToPlainDate",
  "convertUnixToPlainDateTime",
  "convertUnixToPlainTime",
  // unix/parse
  "parseDateFromUnix",
  "parseDayFromUnix",
  "parseDayOfWeekFromUnix",
  "parseHourFromUnix",
  "parseMicrosecondFromUnix",
  "parseMillisecondFromUnix",
  "parseMinuteFromUnix",
  "parseMonthFromUnix",
  "parseNanosecondFromUnix",
  "parseSecondFromUnix",
  "parseTimeFromUnix",
  "parseUnitFromUnix",
  "parseWeekFromUnix",
  "parseYearFromUnix",
  // unix/calculate
  "addUnix",
  "subtractUnix",
  "diffUnix",
  "diffUnixAsDuration",
  "startOfUnix",
  "endOfUnix",
  "startOfQuarterForUnix",
  "endOfQuarterForUnix",
  "roundUnix",
  "setUnix",
  "isBetweenUnix",
  // unix/compare
  "areUnixEqualBy",
  // unix/interval
  "intervalCountUnix",
  "intervalFromDurationUnix",
  "intervalLengthUnix",
  "intervalOverlappingDaysUnix",
  "splitIntervalByUnitUnix",
  // unix/format
  "formatRelativeUnix",
  // calendar/calculate
  "floorToZone",
  "bucketRange",
  // calendar/hours
  "recurringWindows",
  "addOperatingTime",
  "isOpenAt",
  "nextCloseAt",
  "nextOpenAt",
  "operatingIntervals",
  "operatingTimeBetween",
  // intermodal
  "freeTimeExpiry",
  "chargeableDays",
  "bolTimestamp",
];

/** The 23 functions whose result carries the zone, and the 5 that hand it to `Intl`. */
const IDENTIFIER_ONLY_FUNCTIONS: readonly string[] = [
  "convertUtcToZoned",
  "convertUnixToZoned",
  "convertPlainDateTimeToZoned",
  "convertZonedToZoned",
  "getZonedNow",
  "fromNanoseconds",
  "fromOffsetInstant",
  "cutoffAt",
  "cutoffSchedule",
  "crossingTime",
  "dwellTime",
  "etaAtZone",
  "scheduleDelivery",
  "multimodalETA",
  "isValidBusinessCalendar",
  "mergeCalendars",
  "businessDaysBetween",
  "nextBusinessDay",
  "previousBusinessDay",
  "rollDate",
  "addBusinessDays",
  "subtractBusinessDays",
  "isBusinessDay",
  "formatUtc",
  "formatCalendarUtc",
  "formatUnix",
  "formatCalendarUnix",
  "formatTimeZoneName",
];

interface Baseline {
  at: string;
  functions: Record<string, Record<string, unknown>>;
  identifierFunctions: Record<string, Record<string, unknown>>;
}

// What every function returned before stored offsets were read, recorded from the published
// build by a script that ran the same call table. It is the expectation, never regenerated from
// the code under test.
const baseline = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "zoneArgumentBaseline.json"),
    "utf8",
  ),
) as Baseline;

/** Pin the clock for the `getZoned…` readers. */
function pinClock(at: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(Temporal.Instant.from(at).epochMilliseconds);
  // The polyfill's clock adds a sub-millisecond counter taken from its previous reading, so one
  // reading is spent to make every later one the same.
  Temporal.Now.instant();
}

/** Every result of one call for one zone, as JSON stores it. */
function resultsOf(call: ZoneArgumentCall, zone: unknown): unknown {
  return asRecorded([call.run(zone), ...(call.more?.(zone) ?? [])]);
}

/** The results with the zone's own name removed, for comparing a zone with its offset. */
function zonelessResultsOf(call: ZoneArgumentCall, zone: unknown): unknown {
  const zoneless = call.zoneless ?? ((result: unknown) => result);
  return asRecorded([
    zoneless(call.run(zone)),
    ...(call.more?.(zone) ?? []).map(zoneless),
  ]);
}

function isSentinel(call: { sentinel: unknown }, result: unknown): boolean {
  return (
    JSON.stringify(asRecorded(result)) === JSON.stringify(call.sentinel ?? null)
  );
}

describe("the call table", () => {
  it("runs each of the 84 functions with a zoneless result, by name", () => {
    expect(ZONELESS_RESULT_FUNCTIONS).toHaveLength(84);
    expect(new Set(ZONELESS_RESULT_FUNCTIONS).size).toBe(84);
    expect(Object.keys(zoneArgumentCalls(gmt, BASELINE_AT)).toSorted()).toEqual(
      ZONELESS_RESULT_FUNCTIONS.toSorted(),
    );
  });

  it("runs each of the 28 functions that take a time zone identifier only, by name", () => {
    expect(IDENTIFIER_ONLY_FUNCTIONS).toHaveLength(28);
    expect(
      Object.keys(zoneIdentifierCalls(gmt, BASELINE_AT)).toSorted(),
    ).toEqual(IDENTIFIER_ONLY_FUNCTIONS.toSorted());
  });

  it.each(
    [...ZONELESS_RESULT_FUNCTIONS, ...IDENTIFIER_ONLY_FUNCTIONS].map(
      (name) => ({ name }),
    ),
  )("$name is a public function", ({ name }) => {
    expect(typeof (gmt as Record<string, unknown>)[name]).toBe("function");
  });
});

describe("every input that worked before returns what it returned before", () => {
  const zones = [...battleTestTimeZones, ...baselineOnlyZones];
  const rows = ZONELESS_RESULT_FUNCTIONS.flatMap((name) =>
    zones.map((zone) => ({ name, zone, label: zoneLabel(zone) })),
  );

  it("was recorded at the instant the calls run at, for every function and zone", () => {
    expect(baseline.at).toBe(BASELINE_AT);
    expect(Object.keys(baseline.functions).toSorted()).toEqual(
      ZONELESS_RESULT_FUNCTIONS.toSorted(),
    );
    // 84 functions x (20 battle-test zones + 27 further spellings and invalid values).
    expect(rows).toHaveLength(84 * 47);
  });

  it.each(rows)(
    "$name returns the recorded result for $label",
    ({ name, zone, label }) => {
      pinClock(BASELINE_AT);
      const call = zoneArgumentCalls(gmt, BASELINE_AT)[name];

      expect(resultsOf(call, zone)).toEqual(baseline.functions[name][label]);
    },
  );
});

describe("Oracle A: a whole-minute offset spelled with seconds is the offset without them", () => {
  const rows = ZONELESS_RESULT_FUNCTIONS.flatMap((name) => [
    { name, withSeconds: "+05:30:00", identifier: "+05:30" },
    { name, withSeconds: "-00:00:00", identifier: "+00:00" },
  ]);

  it("has two rows for each of the 84 functions", () => {
    expect(rows).toHaveLength(168);
  });

  it.each(rows)(
    "$name returns for $withSeconds what it returns for $identifier",
    ({ name, withSeconds, identifier }) => {
      pinClock(BASELINE_AT);
      const call = zoneArgumentCalls(gmt, BASELINE_AT)[name];

      expect(resultsOf(call, withSeconds)).toEqual(resultsOf(call, identifier));
      if (!call.sentinelIsAnswer) {
        expect(isSentinel(call, call.run(withSeconds))).toBe(false);
      }
    },
  );
});

/**
 * Zones that stood at an offset with seconds, and the years to read them in. The offset is read
 * from Temporal at noon UTC on 1 January, and each row first proves it has seconds.
 */
const SECONDS_OFFSET_ZONES: readonly { zone: string; years: number[] }[] = [
  { zone: "Africa/Monrovia", years: [1925, 1935, 1950, 1970] },
  { zone: "America/St_Johns", years: [1890, 1910, 1925, 1935] },
  { zone: "America/Paramaribo", years: [1925, 1935] },
  { zone: "Africa/Khartoum", years: [1850, 1890, 1910, 1925] },
  { zone: "America/Havana", years: [1910, 1925] },
];

/** Controls whose offset is a whole number of minutes: these passed before the change too. */
const MINUTE_OFFSET_ZONES: readonly { zone: string; years: number[] }[] = [
  { zone: "Asia/Kathmandu", years: [2024] },
  { zone: "America/New_York", years: [2024] },
  { zone: "UTC", years: [2024] },
];

const NANOSECONDS_PER_DAY = 86_400_000_000_000n;

/**
 * True when `zone` stood at one offset for the whole span a call reads around `at`, so the offset
 * alone gives the same local time the zone does. Asked of plain Temporal two ways: the offset on
 * every day of the span, and the zone's next transition after the span opens.
 */
function holdsOneOffset(zone: string, at: string, reach: ZoneReach): boolean {
  const [daysBefore, daysAfter] = ZONE_REACH_DAYS[reach];
  const atNs = Temporal.Instant.from(at).epochNanoseconds;
  const fromNs = atNs - BigInt(daysBefore) * NANOSECONDS_PER_DAY;
  const untilNs = atNs + BigInt(daysAfter) * NANOSECONDS_PER_DAY;
  const offsetAt = (ns: bigint): number =>
    Temporal.Instant.fromEpochNanoseconds(ns).toZonedDateTimeISO(zone)
      .offsetNanoseconds;
  const offset = offsetAt(atNs);

  for (let ns = fromNs; ns <= untilNs; ns += NANOSECONDS_PER_DAY) {
    if (offsetAt(ns) !== offset) return false;
  }

  const next = Temporal.Instant.fromEpochNanoseconds(fromNs)
    .toZonedDateTimeISO(zone)
    .getTimeZoneTransition("next");

  return next === null || next.epochNanoseconds > untilNs;
}

describe("Oracle B: a zone's stored offset gives what the zone gives", () => {
  const cells = [...SECONDS_OFFSET_ZONES, ...MINUTE_OFFSET_ZONES].flatMap(
    ({ zone, years }) =>
      years.map((year) => {
        const at = `${year}-01-01T12:00:00Z`;
        return {
          zone,
          year,
          at,
          // Plain Temporal, not getTimeZoneOffset: the offset must not come from the library.
          offset: Temporal.Instant.from(at).toZonedDateTimeISO(zone).offset,
        };
      }),
  );
  const reaches = Object.keys(ZONE_REACH_DAYS) as ZoneReach[];
  const table = zoneArgumentCalls(gmt, BASELINE_AT);
  const rows = cells.flatMap((cell) =>
    ZONELESS_RESULT_FUNCTIONS.filter((name) =>
      holdsOneOffset(cell.zone, cell.at, table[name].reach),
    ).map((name) => ({ ...cell, name })),
  );

  it.each(
    SECONDS_OFFSET_ZONES.flatMap(({ zone, years }) =>
      years.map((year) => ({ zone, year })),
    ),
  )(
    "$zone stood at an offset with seconds on 1 January $year",
    ({ zone, year }) => {
      const cell = cells.find((c) => c.zone === zone && c.year === year);
      expect(cell?.offset).toMatch(/^[+-]\d{2}:\d{2}:\d{2}$/);
      expect(gmt.isValidTimeZone(cell?.offset ?? "")).toBe(false);
      expect(gmt.isValidUtcOffset(cell?.offset ?? "")).toBe(true);
    },
  );

  // A call is compared only where the zone kept one offset for everything the call reads. These
  // are the spans left out, each for a real change in the zone's own history:
  // - America/St_Johns observed daylight time in 1925 and moved to -03:30 on 1935-03-30.
  // - America/Paramaribo moved from -03:40:52 to -03:40:36 on 1 January 1935, eight hours before
  //   the row's instant.
  // - America/Havana moved from -05:29:36 to -05:00 on 1925-07-19.
  // - America/New_York springs forward on 2024-03-10.
  it("leaves out only the spans in which a zone changed its own offset", () => {
    const leftOut = Object.fromEntries(
      cells
        .map((cell) => [
          `${cell.zone} ${cell.year}`,
          reaches.filter((reach) => !holdsOneOffset(cell.zone, cell.at, reach)),
        ])
        .filter(([, missing]) => missing.length > 0),
    );

    expect(leftOut).toEqual({
      "America/St_Johns 1925": ["YEAR"],
      "America/St_Johns 1935": ["QUARTER", "YEAR"],
      "America/Paramaribo 1935": ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"],
      "America/Havana 1925": ["YEAR"],
      "America/New_York 2024": ["QUARTER", "YEAR"],
    });
  });

  it("compares every function in every zone and year that qualifies", () => {
    const perReach = (reach: ZoneReach): number =>
      ZONELESS_RESULT_FUNCTIONS.filter((name) => table[name].reach === reach)
        .length;
    // How many of the 84 read the instant alone, then a day, a week, a month, a quarter and a
    // year around it.
    expect(reaches.map(perReach)).toEqual([51, 5, 14, 10, 2, 2]);
    // 19 zone-years x 84 functions, less the spans left out above: St_Johns 1925 and Havana 1925
    // (2 each), St_Johns 1935 and New_York 2024 (4 each), Paramaribo 1935 (the 33 that read
    // beyond the instant).
    expect(cells).toHaveLength(19);
    expect(rows).toHaveLength(19 * 84 - 2 - 2 - 4 - 4 - 33);
    expect(rows).toHaveLength(1551);
  });

  it.each(rows)(
    "$name returns for $offset what it returns for $zone at $at",
    ({ name, zone, at, offset }) => {
      pinClock(at);
      const call = zoneArgumentCalls(gmt, at)[name];

      expect(zonelessResultsOf(call, offset)).toEqual(
        zonelessResultsOf(call, zone),
      );
      if (!call.sentinelIsAnswer) {
        expect(isSentinel(call, call.run(offset))).toBe(false);
      }
    },
  );
});

describe("the accepted set is what isValidTimeZone or isValidUtcOffset accepts", () => {
  // `undefined` and "local" are left out: an omitted option means UTC, and "local" is the
  // keyword the unix/ and utc/ options read as the system zone.
  const candidates: readonly unknown[] = [
    "UTC",
    "America/New_York",
    "utc",
    "Japan",
    "+05:30",
    "+0530",
    "-08",
    "-00:00",
    "+05:30:00",
    "+00:00:00",
    "-00:00:00",
    "-00:44:30",
    "+02:10:08",
    "+23:59:59",
    "-23:59:59",
    "Z",
    "+05:30:00.5",
    "+24:00",
    "+24:00:00",
    "+05:30:60",
    "-0400:30",
    "+5:30",
    "Invalid/Zone",
    "",
    5,
    null,
    true,
    {},
    // An array is not a string, though String(["UTC"]) is "UTC" and String(["-00:44:30"]) is the
    // offset: a function that coerced its zone would accept both.
    ["UTC"],
    ["-00:44:30"],
  ];
  const table = zoneArgumentCalls(gmt, BASELINE_AT);
  // A fixed offset has no transitions, so `false` and `[]` are these two functions' real answers
  // for one, and equal their sentinel: acceptance cannot be seen in the result.
  const unobservable = ZONELESS_RESULT_FUNCTIONS.filter(
    (name) => table[name].sentinelIsAnswer,
  );
  const rows = ZONELESS_RESULT_FUNCTIONS.filter(
    (name) => !table[name].sentinelIsAnswer,
  ).flatMap((name) =>
    candidates.map((zone) => ({ name, zone, label: zoneLabel(zone) })),
  );

  it("covers every function whose result can show it", () => {
    expect(unobservable).toEqual(["getDstTransitions", "hasDaylightSaving"]);
    expect(candidates).toHaveLength(30);
    expect(rows).toHaveLength(82 * 30);
  });

  it.each(rows)(
    "$name returns its sentinel for $label exactly when neither validator accepts it",
    ({ name, zone }) => {
      pinClock(BASELINE_AT);
      const call = zoneArgumentCalls(gmt, BASELINE_AT)[name];
      const accepted =
        gmt.isValidTimeZone(zone as string) ||
        gmt.isValidUtcOffset(zone as string);

      expect(isSentinel(call, call.run(zone))).toBe(!accepted);
    },
  );

  it.each`
    zone
    ${"-00:44:30"}
    ${"-00:45"}
    ${"+02:10:08"}
  `(
    "a fixed offset $zone has no daylight time and no transitions",
    ({ zone }) => {
      expect(gmt.hasDaylightSaving(zone, { at: BASELINE_AT })).toBe(false);
      expect(gmt.hasDaylightSaving(zone)).toBe(false);
      expect(gmt.getDstTransitions(zone, 2024)).toEqual([]);
    },
  );
});

describe("a function that keeps the zone takes a time zone identifier only", () => {
  const rows = IDENTIFIER_ONLY_FUNCTIONS.flatMap((name) =>
    identifierZones.map((zone) => ({ name, zone })),
  );
  const recorded = IDENTIFIER_ONLY_FUNCTIONS.filter(
    (name) => !zoneIdentifierCalls(gmt, BASELINE_AT)[name].localeText,
  );

  it("was recorded for the 23 functions whose result is not locale text", () => {
    expect(Object.keys(baseline.identifierFunctions).toSorted()).toEqual(
      recorded.toSorted(),
    );
    expect(recorded).toHaveLength(23);
  });

  it.each(rows.filter(({ zone }) => zone !== "+05:30"))(
    "$name returns its sentinel for $zone, an offset with seconds",
    ({ name, zone }) => {
      pinClock(BASELINE_AT);
      const call = zoneIdentifierCalls(gmt, BASELINE_AT)[name];

      expect(isSentinel(call, call.run(zone))).toBe(true);
    },
  );

  it.each(
    recorded.flatMap((name) => identifierZones.map((zone) => ({ name, zone }))),
  )("$name returns the recorded result for $zone", ({ name, zone }) => {
    pinClock(BASELINE_AT);
    const call = zoneIdentifierCalls(gmt, BASELINE_AT)[name];

    expect(asRecorded(call.run(zone))).toEqual(
      baseline.identifierFunctions[name][zone],
    );
  });

  // fromOffsetInstant refuses any offset as `timeZone`: an offset names no place.
  it.each(
    recorded
      .filter((name) => name !== "fromOffsetInstant")
      .map((name) => ({ name })),
  )("$name returns a value for the minute offset +05:30", ({ name }) => {
    pinClock(BASELINE_AT);
    const call = zoneIdentifierCalls(gmt, BASELINE_AT)[name];

    expect(isSentinel(call, call.run("+05:30"))).toBe(false);
  });

  // Asia/Kolkata has stood at +05:30 since 1945, so these four print the same clock for both.
  it.each`
    name
    ${"formatUtc"}
    ${"formatCalendarUtc"}
    ${"formatUnix"}
    ${"formatCalendarUnix"}
  `(
    "$name formats the minute offset +05:30 as it formats Asia/Kolkata",
    ({ name }: { name: string }) => {
      const call = zoneIdentifierCalls(gmt, BASELINE_AT)[name];

      expect(call.run("+05:30")).not.toBe("");
      expect(call.run("+05:30")).toBe(call.run("Asia/Kolkata"));
    },
  );

  it("formatTimeZoneName names the minute offset +05:30", () => {
    expect(gmt.formatTimeZoneName("+05:30", "en-US")).not.toBe("");
  });

  // The zone a zoneless first-leg departure is read in is validated like a leg's own: the
  // function writes zoned strings, so it takes identifiers throughout.
  it.each`
    startTimeZone  | accepted
    ${"+05:30"}    | ${true}
    ${"-00:44:30"} | ${false}
    ${"+05:30:00"} | ${false}
  `(
    "scheduleDelivery and multimodalETA read a zoneless departure in startTimeZone $startTimeZone: $accepted",
    ({ startTimeZone, accepted }) => {
      const legs = [
        { departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" },
      ];

      expect(gmt.scheduleDelivery(legs, { startTimeZone }) !== null).toBe(
        accepted,
      );
      expect(gmt.multimodalETA(legs, { startTimeZone }) !== null).toBe(
        accepted,
      );
    },
  );

  // 12:44:30Z is 12:00:00 at -00:44:30: the local time with its full offset and no bracket,
  // which is what the docs of these functions point to.
  it("fromOffsetInstant writes the local time at an offset with seconds when no zone is given", () => {
    expect(
      gmt.fromOffsetInstant({
        instant: "1970-01-01T12:44:30Z",
        offset: "-00:44:30",
      }),
    ).toBe("1970-01-01T12:00:00-00:44:30");
  });
});

describe("an offset the library returns goes back in", () => {
  const cells = SECONDS_OFFSET_ZONES.flatMap(({ zone, years }) =>
    years.map((year) => {
      const at = `${year}-01-01T12:00:00Z`;
      const zoned = Temporal.Instant.from(at).toZonedDateTimeISO(zone);
      return {
        zone,
        at,
        zoned: zoned.toString(),
        // The local wall clock Temporal reads at that instant.
        local: zoned.toPlainDateTime().toString(),
      };
    }),
  );

  it.each(cells)(
    "resolveLocal reads $local back to $at with the offset getTimeZoneOffset returns for $zone",
    ({ zone, at, local }) => {
      expect(gmt.resolveLocal(local, gmt.getTimeZoneOffset(zone, at))).toBe(at);
    },
  );

  it.each(cells)(
    "resolveLocal reads $local back to $at with the offset getZonedOffset returns for $zoned",
    ({ at, zoned, local }) => {
      expect(gmt.resolveLocal(local, gmt.getZonedOffset(zoned))).toBe(at);
    },
  );

  it.each(cells)(
    "resolveLocal reads $local back to $at with the offset toOffsetInstant returns for $zone",
    ({ zone, at, local }) => {
      const pair = gmt.toOffsetInstant(at, zone);

      expect(pair).not.toBeNull();
      expect(gmt.resolveLocal(local, pair?.offset ?? "")).toBe(at);
    },
  );

  it.each(cells)(
    "resolveLocal reads the local time fromOffsetInstant writes for $at in $zone back to it",
    ({ zone, at, local }) => {
      const offset = Temporal.Instant.from(at).toZonedDateTimeISO(zone).offset;
      const written = gmt.fromOffsetInstant({ instant: at, offset });

      expect(written).toBe(`${local}${offset}`);
      expect(gmt.resolveLocal(written.slice(0, 19), offset)).toBe(at);
    },
  );

  it.each(cells)(
    "convertUtcToPlainDateTime reads $at at the offset of $zone as $local",
    ({ zone, at, local }) => {
      const offset = Temporal.Instant.from(at).toZonedDateTimeISO(zone).offset;

      expect(gmt.convertUtcToPlainDateTime(at, { timeZone: offset })).toBe(
        local,
      );
    },
  );
});
