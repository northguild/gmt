import { fromOffsetInstant } from "../instant/convert/fromOffsetInstant";
import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import { isValidInterval } from "../interval/validate/isValidInterval";
import { toNanoseconds } from "../precision/convert/toNanoseconds";
import { isValidInstant } from "../precision/validate/isValidInstant";
import { spanNs } from "../span/calculate/spanNs";
import { transitTime } from "../transport/calculate/transitTime";
import { etaAtZone } from "../transport/convert/etaAtZone";
import { areUtcEqual } from "../utc/compare/areUtcEqual";
import { isValidUtc } from "../utc/validate/isValidUtc";
import { classifyStoredZoned } from "../zoned/classify/classifyStoredZoned";
import { getTimeZoneOffset } from "../zoned/get/getTimeZoneOffset";
import { isValidZonedDateTime } from "../zoned/validate/isValidZonedDateTime";

/**
 * A zoned string whose zone has a sub-minute UTC offset.
 *
 * `Temporal.ZonedDateTime.prototype.toString` writes the offset rounded to the minute
 * (FormatDateTimeUTCOffsetRounded). TC39 `ToTemporalZonedDateTime` reads it back with
 * match-minutes: an offset written without seconds matches a zone offset that rounds to it
 * (`InterpretISODateTimeOffset`). Only the functions that keep the zone read a zoned string
 * (`toOffsetInstant`, `transitTime`, `classifyStoredZoned`, `isValidZonedDateTime`, ...), and they
 * read it that way. Every instant reader matches `<date>T<time>` then `Z` or an offset over the
 * whole string, so the same string, bracket and all, is not an instant to it.
 *
 * Expected values come from the zones' real offsets in the IANA database, checked against a
 * plain `Temporal.ZonedDateTime.from(zoned).toInstant()`:
 *
 * - Africa/Monrovia stood at -00:44:30 until 1972-01-07T00:44:30Z, written `-00:45`:
 *   1960-01-01 00:20:00 local is 01:04:30Z (literal reading 01:05:00Z, 30 seconds late).
 * - America/New_York stood at -04:56:02 until 1883-11-18T17:00:00Z, written `-04:56`:
 *   1883-11-18 09:00:00 local is 13:56:02Z (literal reading 13:56:00Z, 2 seconds early).
 */
const cases = it.each`
  zone                  | zoned                                            | instant                   | offset
  ${"Africa/Monrovia"}  | ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:04:30Z"} | ${"-00:44:30"}
  ${"America/New_York"} | ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"1883-11-18T13:56:02Z"} | ${"-04:56:02"}
`;

describe("instant readers refuse a zoned string with a minute-rounded offset", () => {
  cases(
    "the instant readers return their sentinel for $zoned",
    ({ zoned, instant }: { zoned: string; instant: string }) => {
      expect(isValidInstant(zoned)).toBe(false);
      expect(toNanoseconds(zoned)).toBe(0n);
      expect(spanNs(instant, zoned)).toBeNull();
      expect(isValidInterval({ start: zoned, end: instant })).toBe(false);
      expect(isValidUtc(zoned)).toBe(false);
      expect(areUtcEqual(zoned, instant)).toBe(false);
      expect(fromOffsetInstant({ instant: zoned, offset: "+00:00" })).toBe("");
      expect(getTimeZoneOffset("UTC", zoned)).toBe("");
    },
  );
});

describe("functions that keep the zone read a minute-rounded offset as its zone's real offset", () => {
  cases(
    "toOffsetInstant splits $zoned into $instant and $offset",
    ({ zone, zoned, instant, offset }) => {
      expect(toOffsetInstant(zoned)).toEqual({
        instant,
        offset,
        timeZone: zone,
      });
    },
  );

  cases(
    "classifyStoredZoned calls $zoned valid at $instant",
    ({ zoned, instant }) => {
      expect(classifyStoredZoned(zoned)).toMatchObject({
        kind: "valid",
        instant,
      });
    },
  );

  // `offset: "use"` gives the written wall clock minus the written minute-rounded offset
  // (09:00 + 4:56 = 13:56:00).
  cases(
    "classifyStoredZoned gives $zoned at the stored offset",
    ({ zoned, instant }) => {
      const stored = {
        "1960-01-01T01:04:30Z": "1960-01-01T01:05:00Z",
        "1883-11-18T13:56:02Z": "1883-11-18T13:56:00Z",
      }[instant as string];
      expect(classifyStoredZoned(zoned)).toEqual({
        kind: "valid",
        instant,
        atStoredOffset: stored,
      });
    },
  );

  // Monrovia moved from -00:44:30 to +00:00 at 1972-01-07T00:44:30Z. 23:59:50 local on the 6th
  // is 00:44:20Z, before the change.
  it("toOffsetInstant reads Monrovia at 1972-01-06T23:59:50-00:45 as -00:44:30", () => {
    expect(
      toOffsetInstant("1972-01-06T23:59:50-00:45[Africa/Monrovia]"),
    ).toEqual({
      instant: "1972-01-07T00:44:20Z",
      offset: "-00:44:30",
      timeZone: "Africa/Monrovia",
    });
  });
});

/**
 * Pacific/Niue moved from -11:19:40 to -11:20:00 at the end of 15 October 1952, so 23:59:40 to
 * 23:59:59 happened twice, 20 seconds apart, and Temporal writes both passes with `-11:20`.
 * test262 `intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js`: `-11:20`
 * "matches the first candidate -11:19:40" (-543069621 s, 11:19:39Z on the 16th) and `-11:20:00`
 * "is accepted as -11:20:00" (20 s later, 11:19:59Z).
 */
describe("a repeated wall time inside a sub-minute offset change reads as its first pass", () => {
  it("the second 23:59:59 in Pacific/Niue on 1952-10-15 is written -11:20 and reads back as the first", () => {
    const written = transitTime(
      "1952-10-15T23:59:59-11:20:00[Pacific/Niue]",
      "PT0S",
    );
    expect(written).toBe("1952-10-15T23:59:59-11:20[Pacific/Niue]");
    expect(toOffsetInstant(written)?.instant).toBe("1952-10-16T11:19:39Z");
    expect(
      toOffsetInstant("1952-10-15T23:59:59-11:20:00[Pacific/Niue]")?.instant,
    ).toBe("1952-10-16T11:19:59Z");
    // Written by transitTime again, the first pass is the same text.
    expect(transitTime(written, "PT0S")).toBe(written);
  });
});

/**
 * The range limits. An instant runs from -271821-04-20T00:00:00Z to +275760-09-13T00:00:00Z
 * (TC39 nsMinInstant / nsMaxInstant, +-8.64e21 ns). That far back every zone is on local mean
 * time, which is rarely a whole minute. A zoned read is `Temporal.ZonedDateTime.from`'s:
 * `InterpretISODateTimeOffset` runs `CheckISODaysRange` on the local date first, and
 * -271821-04-19, the local date of the first hours of the range west of Greenwich, is outside
 * it (context/domination/js-temporal-polyfill-bugs.md section J, a tc39 spec item).
 *
 * `written` is `Temporal.Instant#toZonedDateTimeISO(zone).toString()` for the instant
 * `seconds` after the minimum, from the plain polyfill.
 */
describe("zoned readers read a string written at the range limits", () => {
  it.each`
    zone              | utc                          | written
    ${"Asia/Kolkata"} | ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-20T05:53:28+05:53[Asia/Kolkata]"}
    ${"Asia/Kolkata"} | ${"-271821-04-20T00:00:15Z"} | ${"-271821-04-20T05:53:43+05:53[Asia/Kolkata]"}
    ${"Asia/Tokyo"}   | ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-20T09:18:59+09:19[Asia/Tokyo]"}
    ${"Asia/Tokyo"}   | ${"-271821-04-20T00:00:15Z"} | ${"-271821-04-20T09:19:14+09:19[Asia/Tokyo]"}
  `("reads $written as $utc, east of Greenwich", ({ zone, utc, written }) => {
    expect(etaAtZone(utc, zone)).toBe(written);
    expect(isValidZonedDateTime(written)).toBe(true);
    expect(toOffsetInstant(written)?.instant).toBe(utc);
  });

  // By the far future every zone is on its current whole-minute offset, so the written offset
  // is exact.
  it.each`
    zone                    | utc                                    | written
    ${"Europe/London"}      | ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-13T01:00:00+01:00[Europe/London]"}
    ${"Asia/Tokyo"}         | ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-13T09:00:00+09:00[Asia/Tokyo]"}
    ${"America/New_York"}   | ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-12T20:00:00-04:00[America/New_York]"}
    ${"Pacific/Kiritimati"} | ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${"Pacific/Kiritimati"} | ${"+275760-09-12T23:59:59.999999999Z"} | ${"+275760-09-13T13:59:59.999999999+14:00[Pacific/Kiritimati]"}
  `("reads $written as $utc at the maximum", ({ zone, utc, written }) => {
    expect(etaAtZone(utc, zone)).toBe(written);
    expect(toOffsetInstant(written)?.instant).toBe(utc);
  });

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
    expect(isValidZonedDateTime(value)).toBe(false);
    expect(toOffsetInstant(value)).toBeNull();
    expect(transitTime(value, "PT0S")).toBe("");
  });

  // Asia/Kolkata 05:53:27 is one second before the minimum at the zone's +05:53:28, so no
  // instant in range has that wall time there and the bracket matches nothing: a zoned read
  // refuses it, as Temporal.ZonedDateTime.from does.
  it("refuses a wall time the zone's own reading puts outside the range", () => {
    expect(
      toOffsetInstant("-271821-04-20T05:53:27+05:53[Asia/Kolkata]"),
    ).toBeNull();
  });

  // West of Greenwich the local date -271821-04-19 is before the ISO date range, so the zoned
  // read refuses the string although its instant is in range. Chromium 153 native Temporal
  // throws RangeError for both.
  it.each`
    value
    ${"-271821-04-19T23:58:45-00:01[Europe/London]"}
    ${"-271821-04-19T23:59:00-00:01[Europe/London]"}
    ${"-271821-04-19T19:04:13-04:56[America/New_York]"}
  `(
    "zoned reads refuse $value, whose local date is before the ISO date range",
    ({ value }) => {
      expect(isValidZonedDateTime(value)).toBe(false);
      expect(transitTime(value, "PT0S")).toBe("");
      expect(toOffsetInstant(value)).toBeNull();
      expect(classifyStoredZoned(value)).toBeNull();
    },
  );

  // In Tokyo the stored `+09:19` is a minute past the zone's `+09:18:59`, so applying it lands
  // one second before the first instant, which is out of range as well.
  it("classifyStoredZoned returns null for the minimum instant written in Tokyo", () => {
    expect(
      classifyStoredZoned("-271821-04-20T09:18:59+09:19[Asia/Tokyo]"),
    ).toBeNull();
  });

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
