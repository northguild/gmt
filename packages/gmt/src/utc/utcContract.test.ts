/**
 * Cross-function contract of the `utc/` namespace: one `timeZone` vocabulary for every function
 * that takes the option, the same one the `unix/` namespace has.
 *
 * - Omitted (or `undefined`) → UTC. A UTC string names an instant, so no host zone is read unless
 *   asked for.
 * - `"local"` → the system time zone.
 * - An IANA name or a UTC offset → that zone.
 * - Anything else → the sentinel (ECMA-402 and Temporal throw RangeError for an unknown zone).
 */
import { isDeepStrictEqual } from "node:util";
import { mockSystemTimeZone } from "../test";
import { getSystemTimeZone } from "../zoned/get/getSystemTimeZone";
import {
  convertUtcToPlainDate,
  convertUtcToPlainDateTime,
  convertUtcToPlainTime,
} from "./convert";
import { formatCalendarUtc, formatRelativeUtc, formatUtc } from "./format";
import {
  parseDateFromUtc,
  parseDayFromUtc,
  parseDayOfWeekFromUtc,
  parseHourFromUtc,
  parseMicrosecondFromUtc,
  parseMillisecondFromUtc,
  parseMinuteFromUtc,
  parseMonthFromUtc,
  parseNanosecondFromUtc,
  parseSecondFromUtc,
  parseTimeFromUtc,
  parseUnitFromUtc,
  parseWeekFromUtc,
  parseYearFromUtc,
} from "./parse";

// Tuesday 30 January 2024, 20:30:45.123456789 UTC. Asia/Tokyo is UTC+9 with no DST, so the same
// instant is Wednesday 31 January, 05:30:45.123456789 there: the date, the day, the weekday and
// the hour all differ from UTC.
const VALUE = "2024-01-30T20:30:45.123456789Z";
const SYSTEM_ZONE = "Asia/Tokyo";

type Options = { timeZone?: string } | undefined;

type ZoneFunction = {
  name: string;
  call: (options: Options) => unknown;
  sentinel: unknown;
  inTokyo: unknown;
};

// The three formatters, each on a case whose text depends on the zone.

// en-US short date is month/day/two-digit year (CLDR `M/d/yy`): 1/30/24 in UTC, 1/31/24 in Tokyo.
const formatShortDate = (o: Options) =>
  formatUtc(VALUE, "en-US", { dateStyle: "short", ...o });

// The reference is 10:00 UTC on 30 January, which is 19:00 the same day in Tokyo. VALUE is the
// same calendar day in UTC ("today at 8:30 PM") and the next one in Tokyo ("tomorrow at 5:30 AM").
const formatCalendarFromMorning = (o: Options) =>
  formatCalendarUtc(VALUE, "en-US", {
    reference: "2024-01-30T10:00:00Z",
    ...o,
  });

// 15 days after the reference, counted in months from the reference's wall-clock date (Temporal
// Duration.prototype.total with relativeTo: the fraction of the month that starts there).
// - UTC: the reference is 29 February 20:00, and one month on is 29 March: 15 of 29 days is 0.517,
//   which rounds to 1, "next month".
// - Tokyo: the reference is 1 March 05:00, and one month on is 1 April: 15 of 31 days is 0.484,
//   which rounds to 0, "this month".
const formatFifteenDaysInMonths = (o: Options) =>
  formatRelativeUtc("2024-03-15T20:00:00Z", "en-US", {
    reference: "2024-02-29T20:00:00Z",
    largestUnit: "month",
    ...o,
  });

/**
 * Run one test for every `utc/` function that takes a `timeZone` option. `inTokyo` is what the
 * call returns on the Asia/Tokyo wall clock, written from the offset above and from the notes
 * beside each formatter.
 *
 * - parseDayOfWeekFromUtc: ISO 8601 weekday, Monday is 1, so Wednesday is 3.
 * - parseWeekFromUtc: ISO 8601 week; 1 January 2024 is a Monday, so week 5 runs 29 January to
 *   4 February.
 */
function eachZoneFunction(
  title: string,
  test: (row: ZoneFunction) => void,
): void {
  it.each`
    name                           | call                                                   | sentinel | inTokyo
    ${"parseDateFromUtc"}          | ${(o: Options) => parseDateFromUtc(VALUE, o)}          | ${""}    | ${"2024-01-31"}
    ${"parseDayFromUtc"}           | ${(o: Options) => parseDayFromUtc(VALUE, o)}           | ${""}    | ${"31"}
    ${"parseDayOfWeekFromUtc"}     | ${(o: Options) => parseDayOfWeekFromUtc(VALUE, o)}     | ${null}  | ${3}
    ${"parseHourFromUtc"}          | ${(o: Options) => parseHourFromUtc(VALUE, o)}          | ${""}    | ${"05"}
    ${"parseMicrosecondFromUtc"}   | ${(o: Options) => parseMicrosecondFromUtc(VALUE, o)}   | ${""}    | ${"456"}
    ${"parseMillisecondFromUtc"}   | ${(o: Options) => parseMillisecondFromUtc(VALUE, o)}   | ${""}    | ${"123"}
    ${"parseMinuteFromUtc"}        | ${(o: Options) => parseMinuteFromUtc(VALUE, o)}        | ${""}    | ${"30"}
    ${"parseMonthFromUtc"}         | ${(o: Options) => parseMonthFromUtc(VALUE, o)}         | ${""}    | ${"01"}
    ${"parseNanosecondFromUtc"}    | ${(o: Options) => parseNanosecondFromUtc(VALUE, o)}    | ${""}    | ${"789"}
    ${"parseSecondFromUtc"}        | ${(o: Options) => parseSecondFromUtc(VALUE, o)}        | ${""}    | ${"45"}
    ${"parseTimeFromUtc"}          | ${(o: Options) => parseTimeFromUtc(VALUE, o)}          | ${""}    | ${"05:30:45.123456789"}
    ${"parseUnitFromUtc"}          | ${(o: Options) => parseUnitFromUtc(VALUE, "hour", o)}  | ${""}    | ${"05"}
    ${"parseWeekFromUtc"}          | ${(o: Options) => parseWeekFromUtc(VALUE, o)}          | ${null}  | ${5}
    ${"parseYearFromUtc"}          | ${(o: Options) => parseYearFromUtc(VALUE, o)}          | ${""}    | ${"2024"}
    ${"convertUtcToPlainDate"}     | ${(o: Options) => convertUtcToPlainDate(VALUE, o)}     | ${""}    | ${"2024-01-31"}
    ${"convertUtcToPlainDateTime"} | ${(o: Options) => convertUtcToPlainDateTime(VALUE, o)} | ${""}    | ${"2024-01-31T05:30:45"}
    ${"convertUtcToPlainTime"}     | ${(o: Options) => convertUtcToPlainTime(VALUE, o)}     | ${""}    | ${"05:30:45"}
    ${"formatUtc"}                 | ${formatShortDate}                                     | ${""}    | ${"1/31/24"}
    ${"formatCalendarUtc"}         | ${formatCalendarFromMorning}                           | ${""}    | ${"tomorrow at 5:30 AM"}
    ${"formatRelativeUtc"}         | ${formatFifteenDaysInMonths}                           | ${""}    | ${"this month"}
  `(`$name ${title}`, test);
}

describe("utc/ timeZone option with a mocked system zone", () => {
  let restore: () => void;

  beforeEach(() => {
    restore = mockSystemTimeZone(SYSTEM_ZONE);
  });

  afterEach(() => {
    restore();
  });

  eachZoneFunction(
    "reads an omitted timeZone as UTC, not the system zone",
    ({ call, sentinel, inTokyo }) => {
      const utc = call({ timeZone: "UTC" });

      expect(utc).not.toEqual(sentinel);
      expect(call(undefined)).toEqual(utc);
      expect(call({ timeZone: undefined })).toEqual(utc);
      // Every case reads differently in the system zone, except the fields Tokyo shares with UTC.
      expect(call({ timeZone: SYSTEM_ZONE })).toEqual(inTokyo);
    },
  );

  eachZoneFunction(
    "reads $inTokyo for timeZone local with the system zone Asia/Tokyo",
    ({ call, inTokyo }) => {
      expect(call({ timeZone: "local" })).toEqual(inTokyo);
    },
  );

  eachZoneFunction(
    "returns its sentinel $sentinel for timeZone 'Asia/Tokio' | '' | 'UTC+9' | 'Local' | null",
    ({ call, sentinel }) => {
      expect({
        misspelled: call({ timeZone: "Asia/Tokio" }),
        empty: call({ timeZone: "" }),
        posixStyle: call({ timeZone: "UTC+9" }),
        wrongCase: call({ timeZone: "Local" }),
        null: call({ timeZone: null as never }),
      }).toEqual({
        misspelled: sentinel,
        empty: sentinel,
        posixStyle: sentinel,
        wrongCase: sentinel,
        null: sentinel,
      });
    },
  );
});

describe("utc/ timeZone local when the host reports no valid zone", () => {
  let restore: () => void;

  beforeEach(() => {
    restore = mockSystemTimeZone("not-a-timezone");
  });

  // Restored here, not after the assertion: a failing expect must not leak the mocked zone into
  // the tests that follow.
  afterEach(() => {
    restore();
  });

  eachZoneFunction(
    "returns its sentinel $sentinel for local with the system zone not-a-timezone",
    ({ call, sentinel }) => {
      expect(call({ timeZone: "local" })).toEqual(sentinel);
    },
  );
});

// No mock: the host zone is whatever TZ the run has, so `"local"` is compared with the same call
// given the zone the host reports, never with a literal that holds in one zone only.
describe("utc/ timeZone local on the host's own zone", () => {
  const hostZone = getSystemTimeZone();
  // Whether the host zone is one ECMA-402 accepts: Intl.DateTimeFormat throws RangeError for a
  // zone it does not know. Node reports "Etc/Unknown" when TZ is empty, and that is not a zone.
  const hostZoneIsValid = (() => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: hostZone });
      return true;
    } catch {
      return false;
    }
  })();

  eachZoneFunction(
    "reads local as the zone getSystemTimeZone reports, or its sentinel when that is no zone",
    ({ call, sentinel }) => {
      const system = call({ timeZone: hostZone });

      // A valid host zone gives a real answer; an invalid one gives the sentinel. Either way
      // "local" is the host zone.
      expect(isDeepStrictEqual(system, sentinel)).toBe(!hostZoneIsValid);
      expect(call({ timeZone: "local" })).toEqual(system);
    },
  );
});
