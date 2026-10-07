import { Temporal } from "@js-temporal/polyfill";
import { bucketRange } from "../calendar/calculate/bucketRange";
import { floorToZone } from "../calendar/calculate/floorToZone";
import { addOperatingTime } from "../calendar/hours/addOperatingTime";
import { isOpenAt } from "../calendar/hours/isOpenAt";
import { nextOpenAt } from "../calendar/hours/nextOpenAt";
import { operatingTimeBetween } from "../calendar/hours/operatingTimeBetween";
import { fromOffsetInstant } from "../instant/convert/fromOffsetInstant";
import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import { chargeableDays } from "../intermodal/calculate/chargeableDays";
import { demurrageClock } from "../intermodal/calculate/demurrageClock";
import { freeTimeExpiry } from "../intermodal/calculate/freeTimeExpiry";
import { multimodalETA } from "../intermodal/calculate/multimodalETA";
import { bolTimestamp } from "../intermodal/format/bolTimestamp";
import { intersectIntervals } from "../interval/calculate/intersectIntervals";
import { mergeIntervals } from "../interval/calculate/mergeIntervals";
import { splitIntervalAt } from "../interval/calculate/splitIntervalAt";
import { subtractIntervals } from "../interval/calculate/subtractIntervals";
import { sumIntervals } from "../interval/calculate/sumIntervals";
import { intervalContains } from "../interval/compare/intervalContains";
import { intervalsOverlap } from "../interval/compare/intervalsOverlap";
import { isValidInterval } from "../interval/validate/isValidInterval";
import { toDotNetTicks } from "../precision/convert/toDotNetTicks";
import { toExcelSerial } from "../precision/convert/toExcelSerial";
import { toFileTime } from "../precision/convert/toFileTime";
import { toNanoseconds } from "../precision/convert/toNanoseconds";
import { toNtpTimestamp } from "../precision/convert/toNtpTimestamp";
import { toPgMicroseconds } from "../precision/convert/toPgMicroseconds";
import { isValidInstant } from "../precision/validate/isValidInstant";
import { spanMs } from "../span/calculate/spanMs";
import { spanNs } from "../span/calculate/spanNs";
import { transitTime } from "../transport/calculate/transitTime";
import { scheduleDeviation } from "../transport/compare/scheduleDeviation";
import { areUtcEqual } from "../utc/compare/areUtcEqual";
import { etaAtZone } from "../transport/convert/etaAtZone";
import { isValidUtc } from "../utc/validate/isValidUtc";
import { isValidZonedDateTime } from "../zoned/validate/isValidZonedDateTime";
import { getTimeZoneOffset } from "../zoned/get/getTimeZoneOffset";

/**
 * A zoned string whose zone has a sub-minute UTC offset, read by every instant reader in the
 * library.
 *
 * `Temporal.ZonedDateTime.prototype.toString` writes the offset rounded to the minute
 * (FormatDateTimeUTCOffsetRounded). TC39 `ToTemporalZonedDateTime` reads it back with
 * match-minutes: an offset written without seconds matches a zone offset that rounds to it
 * (`InterpretISODateTimeOffset`). `Temporal.Instant.from` takes the written offset literally and
 * lands up to 30 seconds away. GMT's instant readers follow the zoned reading, so the string a
 * zoned function writes names the same instant in every other function, with the one exception
 * pinned in the last block: a repeated wall time inside a sub-minute offset change.
 *
 * Expected values come from the zones' real offsets in the IANA database, checked against a
 * plain `Temporal.ZonedDateTime.from(zoned).toInstant()`:
 *
 * - Africa/Monrovia stood at −00:44:30 until 1972-01-07T00:44:30Z, written `-00:45`:
 *   1960-01-01 00:20:00 local is 01:04:30Z (literal reading 01:05:00Z, 30 seconds late).
 * - America/New_York stood at −04:56:02 until 1883-11-18T17:00:00Z, written `-04:56`:
 *   1883-11-18 09:00:00 local is 13:56:02Z (literal reading 13:56:00Z, 2 seconds early).
 *
 * `between` lies strictly between the real instant and the literal reading.
 */
const ns = (utc: string): bigint => Temporal.Instant.from(utc).epochNanoseconds;

const cases = it.each`
  zone                  | zoned                                            | instant                   | gap        | gapNs             | earlierInstant            | laterInstant              | between
  ${"Africa/Monrovia"}  | ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:04:30Z"} | ${"PT20M"} | ${1200000000000n} | ${"1960-01-01T00:44:30Z"} | ${"1960-01-01T01:24:30Z"} | ${"1960-01-01T01:04:45Z"}
  ${"America/New_York"} | ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"1883-11-18T13:56:02Z"} | ${"PT1H"}  | ${3600000000000n} | ${"1883-11-18T12:56:02Z"} | ${"1883-11-18T14:56:02Z"} | ${"1883-11-18T13:56:01Z"}
`;

describe("precision/ reads a minute-rounded offset as its zone's real offset", () => {
  cases(
    "isValidInstant accepts $zoned, as before",
    ({ zoned }: { zoned: string }) => {
      expect(isValidInstant(zoned)).toBe(true);
    },
  );

  // Each foreign epoch is a fixed count from the Unix epoch, taken from the function's own
  // documented epoch value: FILETIME 1970 = 116444736000000000 (100 ns ticks), .NET ticks 1970 =
  // 621355968000000000 (100 ns ticks), PostgreSQL 1970 = -946684800000000 (microseconds).
  cases(
    "toNanoseconds and the foreign-epoch converters read $zoned as $instant",
    ({ zoned, instant }: { zoned: string; instant: string }) => {
      const epochNs = ns(instant);
      expect(toNanoseconds(zoned)).toBe(epochNs);
      expect(toFileTime(zoned)).toBe(epochNs / 100n + 116444736000000000n);
      expect(toDotNetTicks(zoned)).toBe(epochNs / 100n + 621355968000000000n);
      expect(toPgMicroseconds(zoned)).toBe(epochNs / 1000n - 946684800000000n);
      // NTP fixed-point and Excel serials depend only on the instant, so the zoned spelling
      // and the `Z` spelling of one instant convert alike.
      expect(toNtpTimestamp(zoned)).toBe(toNtpTimestamp(instant));
      expect(toExcelSerial(zoned)).toBe(toExcelSerial(instant));
    },
  );
});

describe("span/ reads a minute-rounded offset as its zone's real offset", () => {
  cases(
    "spanNs and spanMs measure $zoned from $instant as zero, and from $earlierInstant as $gap",
    ({ zoned, instant, gapNs, earlierInstant }) => {
      expect(spanNs(instant, zoned)).toBe(0n);
      expect(spanNs(zoned, instant)).toBe(0n);
      expect(spanMs(instant, zoned)).toBe(0);
      expect(spanNs(earlierInstant, zoned)).toBe(gapNs);
      expect(spanMs(earlierInstant, zoned)).toBe(Number(gapNs / 1000000n));
    },
  );
});

describe("interval/ reads a minute-rounded offset as its zone's real offset", () => {
  cases(
    "isValidInterval accepts the empty interval between $zoned and $instant either way round",
    ({ zoned, instant }) => {
      expect(isValidInterval({ start: zoned, end: instant })).toBe(true);
      expect(isValidInterval({ start: instant, end: zoned })).toBe(true);
    },
  );

  cases(
    "intervalContains bounds an interval at $zoned by $instant",
    ({ zoned, instant, earlierInstant, laterInstant, between }) => {
      // Half-open: the start is inside and the end is not.
      expect(
        intervalContains({ start: zoned, end: laterInstant }, instant),
      ).toBe(true);
      expect(
        intervalContains({ start: earlierInstant, end: zoned }, instant),
      ).toBe(false);
      // `between` is inside exactly on the side of the real instant it lies on.
      expect(
        intervalContains({ start: zoned, end: laterInstant }, between),
      ).toBe(between > instant);
      expect(
        intervalContains({ start: earlierInstant, end: zoned }, between),
      ).toBe(between < instant);
    },
  );

  cases(
    "sumIntervals, intersectIntervals and intervalsOverlap meet at $zoned exactly",
    ({ zoned, instant, gap, earlierInstant, laterInstant }) => {
      const before = { start: earlierInstant, end: zoned };
      const after = { start: instant, end: laterInstant };
      expect(sumIntervals([before])).toBe(gap);
      // Touching intervals share no instant.
      expect(intersectIntervals(before, after)).toBeNull();
      expect(intervalsOverlap(before, after)).toBe(false);
      expect(
        intersectIntervals(
          { start: zoned, end: laterInstant },
          { start: earlierInstant, end: instant },
        ),
      ).toBeNull();
    },
  );

  cases(
    "mergeIntervals, subtractIntervals and splitIntervalAt cut at $zoned exactly",
    ({ zoned, instant, earlierInstant, laterInstant }) => {
      const whole = { start: earlierInstant, end: laterInstant };
      // Touching intervals merge into one run.
      expect(
        mergeIntervals([
          { start: earlierInstant, end: zoned },
          { start: instant, end: laterInstant },
        ]),
      ).toEqual([whole]);
      // Removing an empty interval at the cut leaves the whole.
      expect(
        subtractIntervals(whole, [{ start: zoned, end: instant }]),
      ).toEqual([whole]);
      expect(
        subtractIntervals(whole, [{ start: instant, end: zoned }]),
      ).toEqual([whole]);
      // A split point is echoed as written.
      expect(splitIntervalAt(whole, [zoned])).toEqual([
        { start: earlierInstant, end: zoned },
        { start: zoned, end: laterInstant },
      ]);
      // A split point on an endpoint cuts nothing.
      expect(
        splitIntervalAt({ start: instant, end: laterInstant }, [zoned]),
      ).toEqual([{ start: instant, end: laterInstant }]);
      expect(
        splitIntervalAt({ start: earlierInstant, end: instant }, [zoned]),
      ).toEqual([{ start: earlierInstant, end: instant }]);
    },
  );
});

describe("instant/ reads a minute-rounded offset as its zone's real offset", () => {
  cases(
    "fromOffsetInstant renders $zoned at +00:00 as $instant",
    ({ zoned, instant }: { zoned: string; instant: string }) => {
      expect(fromOffsetInstant({ instant: zoned, offset: "+00:00" })).toBe(
        `${instant.slice(0, -1)}+00:00`,
      );
    },
  );

  it.each`
    zone                  | zoned                                            | instant                   | offset
    ${"Africa/Monrovia"}  | ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:04:30Z"} | ${"-00:44:30"}
    ${"America/New_York"} | ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"1883-11-18T13:56:02Z"} | ${"-04:56:02"}
  `(
    "toOffsetInstant splits $zoned into $instant and $offset",
    ({ zone, zoned, instant, offset }) => {
      expect(toOffsetInstant(zoned)).toEqual({
        instant,
        offset,
        timeZone: zone,
      });
    },
  );
});

describe("calendar/hours reads a minute-rounded offset as its zone's real offset", () => {
  // Open all day in UTC on the one weekday each case falls on: 1960-01-01 was a Friday (5),
  // 1883-11-18 a Sunday (7).
  const allDay = [{ from: "00:00", to: "00:00" }];
  const schedule = { timeZone: "UTC", weekly: { 5: allDay, 7: allDay } };

  cases(
    "nextOpenAt, addOperatingTime and operatingTimeBetween start from $instant for $zoned",
    ({ zoned, instant, gap, laterInstant }) => {
      expect(isOpenAt(zoned, schedule)).toBe(true);
      // Already open: the answer is the moment asked about.
      expect(nextOpenAt(zoned, schedule)).toBe(instant);
      expect(addOperatingTime(zoned, gap, schedule)).toBe(laterInstant);
      expect(operatingTimeBetween(zoned, laterInstant, schedule)).toBe(gap);
    },
  );
});

describe("calendar/calculate reads a minute-rounded offset as its zone's real offset", () => {
  // Each start sits within the rounding error of a local hour boundary, so the literal reading
  // falls in the neighbouring hour.
  // - Monrovia 00:59:45 local is 01:44:15Z; its hour began at 00:00 local, 00:44:30Z. Read
  //   literally it is 01:00:15 local, in the hour that began at 01:44:30Z.
  // - New York 09:00:01 local is 13:56:03Z; its hour began at 09:00 local, 13:56:02Z. Read
  //   literally it is 08:59:59 local, in the hour that began at 12:56:02Z.
  it.each`
    zone                  | zoned                                            | hourStart                 | end                       | buckets
    ${"Africa/Monrovia"}  | ${"1960-01-01T00:59:45-00:45[Africa/Monrovia]"}  | ${"1960-01-01T00:44:30Z"} | ${"1960-01-01T02:00:00Z"} | ${["1960-01-01T00:44:30Z", "1960-01-01T01:44:30Z"]}
    ${"America/New_York"} | ${"1883-11-18T09:00:01-04:56[America/New_York]"} | ${"1883-11-18T13:56:02Z"} | ${"1883-11-18T14:00:00Z"} | ${["1883-11-18T13:56:02Z"]}
  `(
    "floorToZone and bucketRange put $zoned in the local hour that began at $hourStart",
    ({ zone, zoned, hourStart, end, buckets }) => {
      expect(floorToZone(zoned, "hour", zone)).toBe(hourStart);
      expect(bucketRange(zoned, end, "hour", zone)).toEqual(buckets);
    },
  );
});

describe("zoned/get reads a minute-rounded offset as its zone's real offset", () => {
  // Monrovia moved from −00:44:30 to +00:00 at 1972-01-07T00:44:30Z. 23:59:50 local on the 6th
  // is 00:44:20Z, before the change; read literally it is 00:44:50Z, after it. New York's
  // literal reading is 2 seconds early and its 1883 change went the other way, so no New York
  // instant has a different offset under the two readings; its row holds under both.
  it.each`
    zone                  | zoned                                            | offset
    ${"Africa/Monrovia"}  | ${"1972-01-06T23:59:50-00:45[Africa/Monrovia]"}  | ${"-00:44:30"}
    ${"America/New_York"} | ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"-04:56:02"}
  `(
    "getTimeZoneOffset reads $zone at $zoned as $offset",
    ({ zone, zoned, offset }) => {
      expect(getTimeZoneOffset(zone, zoned)).toBe(offset);
    },
  );
});

describe("intermodal/ reads a minute-rounded offset as its zone's real offset", () => {
  // Each clock start sits within the rounding error of a local midnight, so the literal reading
  // falls on the neighbouring date.
  // - Monrovia 23:59:45 local on 1 January 1960 is 00:44:15Z on the 2nd; the day ends at
  //   00:00 local on the 2nd, 00:44:30Z. Read literally it is 00:00:15 local on the 2nd.
  // - New York 00:00:01 local on 18 November 1883 is 04:56:03Z; the day ends at 00:00 local on
  //   the 19th, by then at −05:00: 05:00:00Z. Read literally it is 23:59:59 local on the 17th.
  it.each`
    zone                  | clockStart                                       | date            | expiresAt
    ${"Africa/Monrovia"}  | ${"1960-01-01T23:59:45-00:45[Africa/Monrovia]"}  | ${"1960-01-01"} | ${"1960-01-02T00:44:30Z"}
    ${"America/New_York"} | ${"1883-11-18T00:00:01-04:56[America/New_York]"} | ${"1883-11-18"} | ${"1883-11-19T05:00:00Z"}
  `(
    "freeTimeExpiry and chargeableDays start one free day at $clockStart on $date",
    ({ zone, clockStart, date, expiresAt }) => {
      expect(
        freeTimeExpiry(clockStart, 1, {
          basis: "calendar",
          timeZone: zone,
          firstDay: "eventDay",
        }),
      ).toEqual({ freeTimeStart: date, lastFreeDay: date, expiresAt });
      // A clock that stops exactly at expiry has used its free day and charged none.
      expect(
        chargeableDays(clockStart, expiresAt, 1, {
          basis: "calendar",
          chargeBasis: "calendar",
          timeZone: zone,
          firstDay: "eventDay",
        }),
      ).toEqual({
        freeDaysUsed: 1,
        chargeableDays: 0,
        expiresAt,
        chargedDates: [],
        byTier: [{ from: 1, to: null, days: 0 }],
      });
    },
  );

  // The same two clock starts as B/L events and as a first departure. Read literally, Monrovia's
  // is dated the 2nd and New York's the 17th; an hour's leg lands 01:44:15Z and 05:56:03Z.
  it.each`
    zone                  | value                                            | date            | eta
    ${"Africa/Monrovia"}  | ${"1960-01-01T23:59:45-00:45[Africa/Monrovia]"}  | ${"1960-01-01"} | ${"1960-01-02T01:44:15+00:00[UTC]"}
    ${"America/New_York"} | ${"1883-11-18T00:00:01-04:56[America/New_York]"} | ${"1883-11-18"} | ${"1883-11-18T05:56:03+00:00[UTC]"}
  `(
    "bolTimestamp dates $value as $date, and multimodalETA departs at its real instant",
    ({ zone, value, date, eta }) => {
      expect(bolTimestamp(value, "shippedOnBoard", { timeZone: zone })).toBe(
        date,
      );
      expect(
        multimodalETA([
          { departure: value, duration: "PT1H", timeZone: "UTC" },
        ]),
      ).toEqual({
        eta,
        totalLegs: 1,
        totalTransit: "PT1H",
        totalDwell: "PT0S",
      });
    },
  );

  cases(
    "demurrageClock orders $zoned against $between by the real instant",
    ({ zoned, instant, between }) => {
      const [first, second] =
        between > instant ? [zoned, between] : [between, zoned];
      const clock = (discharged: string, gatedOut: string) =>
        demurrageClock(
          [
            { type: "discharged", at: discharged },
            { type: "gatedOut", at: gatedOut },
          ],
          "demurrage",
          { direction: "import" },
        );
      expect(clock(first, second)).toEqual({ start: first, end: second });
      // An end before its start is a data error.
      expect(clock(second, first)).toBeNull();
    },
  );
});

describe("utc/ takes only `Z` instants, which have no offset to round", () => {
  cases(
    "isValidUtc and areUtcEqual refuse $zoned and read $instant as written",
    ({ zoned, instant }) => {
      expect(isValidUtc(zoned)).toBe(false);
      expect(areUtcEqual(zoned, instant)).toBe(false);
      expect(isValidUtc(`${instant}[Africa/Monrovia]`)).toBe(true);
      expect(areUtcEqual(`${instant}[Africa/Monrovia]`, instant)).toBe(true);
    },
  );
});

/**
 * The exception, which is Temporal's own. Pacific/Niue moved from −11:19:40 to −11:20:00 at the
 * end of 15 October 1952, so 23:59:40 to 23:59:59 happened twice, 20 seconds apart, and Temporal
 * writes both passes with `-11:20`. test262
 * `intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js`: `-11:20` "matches the
 * first candidate -11:19:40" (−543069621 s, 11:19:39Z on the 16th) and `-11:20:00` "is accepted
 * as -11:20:00" (20 s later, 11:19:59Z). Checked against the plain polyfill:
 * `Temporal.Instant.fromEpochNanoseconds(-543069601000000000n).toZonedDateTimeISO("Pacific/Niue")`
 * writes `1952-10-15T23:59:59-11:20[Pacific/Niue]`, which `Temporal.ZonedDateTime.from` reads as
 * `-543069621000000000n`.
 */
describe("a repeated wall time inside a sub-minute offset change reads as its first pass", () => {
  it("the second 23:59:59 in Pacific/Niue on 1952-10-15 is written -11:20 and reads back as the first", () => {
    const written = transitTime(
      "1952-10-15T23:59:59-11:20:00[Pacific/Niue]",
      "PT0S",
    );
    expect(written).toBe("1952-10-15T23:59:59-11:20[Pacific/Niue]");
    expect(toNanoseconds("1952-10-16T11:19:59Z")).toBe(-543069601000000000n);
    expect(toNanoseconds(written)).toBe(-543069621000000000n);
    expect(scheduleDeviation("1952-10-16T11:19:39Z", written)).toBe("PT0S");
    expect(scheduleDeviation(written, "1952-10-16T11:19:59Z")).toBe("PT20S");
    expect(spanNs(written, "1952-10-15T23:59:59-11:20:00[Pacific/Niue]")).toBe(
      20000000000n,
    );
    // Written by transitTime again, the first pass is the same text.
    expect(transitTime(written, "PT0S")).toBe(written);
  });
});

/**
 * The range limits. An instant runs from −271821-04-20T00:00:00Z to +275760-09-13T00:00:00Z
 * (TC39 nsMinInstant / nsMaxInstant, ±8.64e21 ns). That far back every zone is on local mean
 * time, which is rarely a whole minute, so the string Temporal writes there has a rounded offset
 * whose literal reading can fall outside the range, and, west of Greenwich, a local date
 * (−271821-04-19) that `Temporal.ZonedDateTime.from` refuses (`CheckISODaysRange` in
 * `InterpretISODateTimeOffset`). The instant readers still read every such string as the
 * instant it was written from.
 *
 * `written` is `Temporal.Instant#toZonedDateTimeISO(zone).toString()` for the instant
 * `seconds` after the minimum, from the plain polyfill; the local mean times are Europe/London
 * −00:01:15, Africa/Monrovia −00:43:08, America/New_York −04:56:02, Asia/Kolkata +05:53:28 and
 * Asia/Tokyo +09:18:59.
 */
describe("instant readers read a zoned string written at the range limits", () => {
  const MIN = -8640000000000000000000n;
  const MAX = 8640000000000000000000n;

  it.each`
    zone                  | seconds  | utc                          | written
    ${"Europe/London"}    | ${0n}    | ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-19T23:58:45-00:01[Europe/London]"}
    ${"Europe/London"}    | ${14n}   | ${"-271821-04-20T00:00:14Z"} | ${"-271821-04-19T23:58:59-00:01[Europe/London]"}
    ${"Europe/London"}    | ${15n}   | ${"-271821-04-20T00:00:15Z"} | ${"-271821-04-19T23:59:00-00:01[Europe/London]"}
    ${"Europe/London"}    | ${3600n} | ${"-271821-04-20T01:00:00Z"} | ${"-271821-04-20T00:58:45-00:01[Europe/London]"}
    ${"Africa/Monrovia"}  | ${0n}    | ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-19T23:16:52-00:43[Africa/Monrovia]"}
    ${"Africa/Monrovia"}  | ${14n}   | ${"-271821-04-20T00:00:14Z"} | ${"-271821-04-19T23:17:06-00:43[Africa/Monrovia]"}
    ${"Africa/Monrovia"}  | ${3600n} | ${"-271821-04-20T01:00:00Z"} | ${"-271821-04-20T00:16:52-00:43[Africa/Monrovia]"}
    ${"America/New_York"} | ${0n}    | ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-19T19:03:58-04:56[America/New_York]"}
    ${"America/New_York"} | ${15n}   | ${"-271821-04-20T00:00:15Z"} | ${"-271821-04-19T19:04:13-04:56[America/New_York]"}
    ${"Asia/Kolkata"}     | ${0n}    | ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-20T05:53:28+05:53[Asia/Kolkata]"}
    ${"Asia/Kolkata"}     | ${15n}   | ${"-271821-04-20T00:00:15Z"} | ${"-271821-04-20T05:53:43+05:53[Asia/Kolkata]"}
    ${"Asia/Tokyo"}       | ${0n}    | ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-20T09:18:59+09:19[Asia/Tokyo]"}
    ${"Asia/Tokyo"}       | ${15n}   | ${"-271821-04-20T00:00:15Z"} | ${"-271821-04-20T09:19:14+09:19[Asia/Tokyo]"}
  `(
    "reads $written as $utc, $seconds s after the minimum",
    ({ zone, seconds, utc, written }) => {
      const instant = MIN + seconds * 1000000000n;
      expect(etaAtZone(utc, zone)).toBe(written);
      expect(isValidInstant(written)).toBe(true);
      expect(toNanoseconds(written)).toBe(instant);
      expect(spanNs(utc, written)).toBe(0n);
      expect(scheduleDeviation(utc, written)).toBe("PT0S");
      expect(etaAtZone(written, zone)).toBe(written);
      // The B/L date is the written string's own local date, −271821-04-19 west of Greenwich
      // included: the zoned reading refuses that date, the instant reading does not.
      expect(bolTimestamp(written, "issue", { timeZone: zone })).toBe(
        written.slice(0, written.indexOf("T")),
      );
    },
  );

  // By the far future every zone is on its current whole-minute offset, so the written offset
  // is exact and the literal reading is the instant.
  it.each`
    zone                    | utc                                    | instant     | written
    ${"Europe/London"}      | ${"+275760-09-13T00:00:00Z"}           | ${MAX}      | ${"+275760-09-13T01:00:00+01:00[Europe/London]"}
    ${"Asia/Tokyo"}         | ${"+275760-09-13T00:00:00Z"}           | ${MAX}      | ${"+275760-09-13T09:00:00+09:00[Asia/Tokyo]"}
    ${"America/New_York"}   | ${"+275760-09-13T00:00:00Z"}           | ${MAX}      | ${"+275760-09-12T20:00:00-04:00[America/New_York]"}
    ${"Pacific/Kiritimati"} | ${"+275760-09-13T00:00:00Z"}           | ${MAX}      | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${"Pacific/Kiritimati"} | ${"+275760-09-12T23:59:59.999999999Z"} | ${MAX - 1n} | ${"+275760-09-13T13:59:59.999999999+14:00[Pacific/Kiritimati]"}
  `(
    "reads $written as $utc at the maximum",
    ({ zone, utc, instant, written }) => {
      expect(etaAtZone(utc, zone)).toBe(written);
      expect(toNanoseconds(written)).toBe(instant);
      expect(scheduleDeviation(utc, written)).toBe("PT0S");
      expect(etaAtZone(written, zone)).toBe(written);
    },
  );

  // One step beyond: the wall time one second (or one nanosecond) outside what the zone can
  // show inside the instant range names no instant.
  it.each`
    value                                                           | why
    ${"-271821-04-19T23:58:44-00:01[Europe/London]"}                | ${"one second before the minimum in London"}
    ${"-271821-04-19T23:58:44.999999999-00:01[Europe/London]"}      | ${"one nanosecond before the minimum in London"}
    ${"-271821-04-19T23:16:51-00:43[Africa/Monrovia]"}              | ${"one second before the minimum in Monrovia"}
    ${"-271821-04-20T09:18:58+09:19[Asia/Tokyo]"}                   | ${"one second before the minimum in Tokyo"}
    ${"-271821-04-19T23:58:45+00:00[Europe/London]"}                | ${"an offset London's does not round to, read as written: before the minimum"}
    ${"+275760-09-13T09:00:00.000000001+09:00[Asia/Tokyo]"}         | ${"one nanosecond after the maximum in Tokyo"}
    ${"+275760-09-13T14:00:00.000000001+14:00[Pacific/Kiritimati]"} | ${"one nanosecond after the maximum in Kiritimati"}
  `("rejects $value ($why)", ({ value }) => {
    expect(isValidInstant(value)).toBe(false);
    expect(toNanoseconds(value)).toBe(0n);
    expect(spanNs(value, "1970-01-01T00:00:00Z")).toBeNull();
    expect(scheduleDeviation(value, "1970-01-01T00:00:00Z")).toBe("");
  });

  // Asia/Kolkata 05:53:27 is one second before the minimum at the zone's +05:53:28, so no
  // instant in range has that wall time there and the bracket matches nothing. The written
  // offset then stands, as for any bracket that does not match: 05:53:27 at +05:53:00 is
  // 27 seconds after the minimum.
  it("keeps the written offset when the zone's own reading is outside the range", () => {
    expect(toNanoseconds("-271821-04-20T05:53:27+05:53[Asia/Kolkata]")).toBe(
      MIN + 27000000000n,
    );
  });

  // A zoned read is Temporal.ZonedDateTime.from's: InterpretISODateTimeOffset runs
  // CheckISODaysRange on the local date before it matches the offset, and −271821-04-19 is
  // outside it. So a string with an offset on that local date, which only a zone west of
  // Greenwich writes, in the first hours of the range, is not a valid zoned string, although
  // its instant is in range. Chromium 153 native Temporal throws RangeError for both
  // (context/domination/js-temporal-polyfill-bugs.md § J, a tc39 spec item).
  it.each`
    value
    ${"-271821-04-19T23:59:00-00:01[Europe/London]"}
    ${"-271821-04-19T19:04:13-04:56[America/New_York]"}
  `(
    "zoned reads refuse $value, whose local date is before the ISO date range",
    ({ value }) => {
      expect(isValidZonedDateTime(value)).toBe(false);
      expect(transitTime(value, "PT0S")).toBe("");
      expect(toOffsetInstant(value)).toBeNull();
    },
  );

  // East of Greenwich the local date is inside the range, so the zoned read works from the
  // first instant.
  it("zoned reads accept the minimum instant written in Asia/Tokyo", () => {
    const written = "-271821-04-20T09:18:59+09:19[Asia/Tokyo]";
    expect(isValidZonedDateTime(written)).toBe(true);
    expect(transitTime(written, "PT0S")).toBe(written);
    expect(toOffsetInstant(written)).toEqual({
      instant: "-271821-04-20T00:00:00Z",
      offset: "+09:18:59",
      timeZone: "Asia/Tokyo",
    });
  });
});
