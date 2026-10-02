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

/**
 * Every `utc/` function that takes a `timeZone` option. `inTokyo` is the value's reading on the
 * Asia/Tokyo wall clock, written from the offset above; `null` where the phrase depends on the
 * locale data rather than on a field.
 */
const zoneFunctions: Array<{
  name: string;
  call: (options: Options) => unknown;
  sentinel: unknown;
  inTokyo: unknown;
}> = [
  {
    name: "parseDateFromUtc",
    call: (o) => parseDateFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "2024-01-31",
  },
  {
    name: "parseDayFromUtc",
    call: (o) => parseDayFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "31",
  },
  {
    // ISO 8601 weekday: Monday is 1, so Wednesday is 3.
    name: "parseDayOfWeekFromUtc",
    call: (o) => parseDayOfWeekFromUtc(VALUE, o),
    sentinel: null,
    inTokyo: 3,
  },
  {
    name: "parseHourFromUtc",
    call: (o) => parseHourFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "05",
  },
  {
    name: "parseMicrosecondFromUtc",
    call: (o) => parseMicrosecondFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "456",
  },
  {
    name: "parseMillisecondFromUtc",
    call: (o) => parseMillisecondFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "123",
  },
  {
    name: "parseMinuteFromUtc",
    call: (o) => parseMinuteFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "30",
  },
  {
    name: "parseMonthFromUtc",
    call: (o) => parseMonthFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "01",
  },
  {
    name: "parseNanosecondFromUtc",
    call: (o) => parseNanosecondFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "789",
  },
  {
    name: "parseSecondFromUtc",
    call: (o) => parseSecondFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "45",
  },
  {
    name: "parseTimeFromUtc",
    call: (o) => parseTimeFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "05:30:45.123456789",
  },
  {
    name: "parseUnitFromUtc",
    call: (o) => parseUnitFromUtc(VALUE, "hour", o),
    sentinel: "",
    inTokyo: "05",
  },
  {
    // ISO 8601 week: 1 January 2024 is a Monday, so week 5 runs 29 January to 4 February.
    name: "parseWeekFromUtc",
    call: (o) => parseWeekFromUtc(VALUE, o),
    sentinel: null,
    inTokyo: 5,
  },
  {
    name: "parseYearFromUtc",
    call: (o) => parseYearFromUtc(VALUE, o),
    sentinel: "",
    inTokyo: "2024",
  },
  {
    name: "convertUtcToPlainDate",
    call: (o) => convertUtcToPlainDate(VALUE, o),
    sentinel: "",
    inTokyo: "2024-01-31",
  },
  {
    name: "convertUtcToPlainDateTime",
    call: (o) => convertUtcToPlainDateTime(VALUE, o),
    sentinel: "",
    inTokyo: "2024-01-31T05:30:45",
  },
  {
    name: "convertUtcToPlainTime",
    call: (o) => convertUtcToPlainTime(VALUE, o),
    sentinel: "",
    inTokyo: "05:30:45",
  },
  {
    name: "formatUtc",
    call: (o) => formatUtc(VALUE, "en-US", { dateStyle: "short", ...o }),
    sentinel: "",
    inTokyo: null,
  },
  {
    name: "formatCalendarUtc",
    call: (o) => formatCalendarUtc(VALUE, "en-US", { reference: VALUE, ...o }),
    sentinel: "",
    inTokyo: null,
  },
  {
    name: "formatRelativeUtc",
    call: (o) => formatRelativeUtc(VALUE, "en-US", { reference: VALUE, ...o }),
    sentinel: "",
    inTokyo: null,
  },
];

describe("utc/ timeZone option with a mocked system zone", () => {
  let restore: () => void;

  beforeEach(() => {
    restore = mockSystemTimeZone(SYSTEM_ZONE);
  });

  afterEach(() => {
    restore();
  });

  it.each(zoneFunctions)(
    "$name reads an omitted timeZone as UTC, not the system zone",
    ({ call, sentinel }) => {
      const utc = call({ timeZone: "UTC" });

      expect(utc).not.toEqual(sentinel);
      expect(call(undefined)).toEqual(utc);
      expect(call({ timeZone: undefined })).toEqual(utc);
    },
  );

  it.each(zoneFunctions.filter((row) => row.inTokyo !== null))(
    "$name reads $inTokyo for timeZone local with the system zone Asia/Tokyo",
    ({ call, inTokyo }) => {
      expect(call({ timeZone: "local" })).toEqual(inTokyo);
    },
  );

  it.each(zoneFunctions)(
    "$name reads local as the system zone",
    ({ call, sentinel }) => {
      const system = call({ timeZone: SYSTEM_ZONE });

      expect(system).not.toEqual(sentinel);
      expect(call({ timeZone: "local" })).toEqual(system);
    },
  );

  it.each(
    zoneFunctions.flatMap((row) =>
      ["Asia/Tokio", "", "UTC+9", "Local", null].map((timeZone) => ({
        ...row,
        timeZone,
      })),
    ),
  )(
    "$name returns its sentinel for timeZone $timeZone",
    ({ call, sentinel, timeZone }) => {
      expect(call({ timeZone: timeZone as never })).toEqual(sentinel);
    },
  );
});

describe("utc/ timeZone local when the host reports no valid zone", () => {
  it.each(zoneFunctions)(
    "$name returns its sentinel for local with the system zone not-a-timezone",
    ({ call, sentinel }) => {
      const restore = mockSystemTimeZone("not-a-timezone");

      expect(call({ timeZone: "local" })).toEqual(sentinel);

      restore();
    },
  );
});

// No mock: the host zone is whatever TZ the run has, so `"local"` is compared with the same call
// given the zone the host reports, never with a literal that holds in one zone only.
describe("utc/ timeZone local on the host's own zone", () => {
  it.each(zoneFunctions)(
    "$name reads local as the zone getSystemTimeZone reports",
    ({ call, sentinel }) => {
      const system = call({ timeZone: getSystemTimeZone() });

      expect(system).not.toEqual(sentinel);
      expect(call({ timeZone: "local" })).toEqual(system);
    },
  );
});
