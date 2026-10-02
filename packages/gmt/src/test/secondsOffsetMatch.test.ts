import { durationAs } from "../duration/calculate/durationAs";
import { compareDurations } from "../duration/compare/compareDurations";
import { normalizeDuration } from "../duration/normalize/normalizeDuration";
import { zonedDateTimeFrom } from "../internal/zonedWallClock";
import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import { nextDeparture } from "../transport/calculate/nextDeparture";
import { transitTime } from "../transport/calculate/transitTime";
import { isValidZonedDateTime } from "../zoned/validate/isValidZonedDateTime";

/**
 * A zoned string whose offset is written with seconds is matched exactly (D12).
 *
 * TC39 `ToTemporalZonedDateTime` matches an offset against the zone by minutes only when the
 * offset string has no seconds part ("If offsetParseResult contains more than one MinuteSecond
 * Parse Node, set matchBehaviour to match-exactly"). Every value here is from test262
 * `test/intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js`:
 *
 * - Africa/Monrovia stood at −00:44:30 in 1970, so 12:00 local is 45870 s after the epoch.
 *   `-00:45` is its minute-rounded form and matches; `-00:45:00` and `-00:44:40` do not.
 * - Pacific/Niue moved from −11:19:40 to −11:20 at the end of 15 October 1952, so 23:59:59
 *   happened twice, 20 seconds apart: −543069621 s at −11:19:40, −543069601 s at −11:20:00.
 *   `-11:20` (no seconds) matches the first pass by rounding; `-11:20:00` names the second.
 */
describe("a zoned offset written with seconds matches exactly (D12)", () => {
  it.each`
    value                                                        | epochNanoseconds        | why
    ${"1970-01-01T12:00:00-00:44:30[Africa/Monrovia]"}           | ${45870000000000n}      | ${"the exact offset"}
    ${"1970-01-01T12:00:00-00:44:30.000000000[Africa/Monrovia]"} | ${45870000000000n}      | ${"the exact offset with trailing zeroes"}
    ${"1970-01-01T12:00:00-00:45[Africa/Monrovia]"}              | ${45870000000000n}      | ${"the offset rounded to minutes"}
    ${"1952-10-15T23:59:59-11:19:40[Pacific/Niue]"}              | ${-543069621000000000n} | ${"the first pass, exactly"}
    ${"1952-10-15T23:59:59-11:20[Pacific/Niue]"}                 | ${-543069621000000000n} | ${"-11:20 matches the first candidate, -11:19:40, by rounding"}
    ${"1952-10-15T23:59:59-11:20:00[Pacific/Niue]"}              | ${-543069601000000000n} | ${"-11:20:00 is the second pass, exactly"}
  `(
    "reads $value as $epochNanoseconds ($why)",
    ({ value, epochNanoseconds }) => {
      expect(isValidZonedDateTime(value)).toBe(true);
      expect(zonedDateTimeFrom(value).epochNanoseconds).toBe(epochNanoseconds);
    },
  );

  it.each`
    value                                                | why
    ${"1970-01-01T12:00:00-00:45:00[Africa/Monrovia]"}   | ${"rounded HH:MM:SS is not the zone's -00:44:30"}
    ${"1970-01-01T12:00:00-00:45:00.0[Africa/Monrovia]"} | ${"rounded HH:MM:SS with a fraction"}
    ${"1970-01-01T12:00:00-00:44:40[Africa/Monrovia]"}   | ${"wrong seconds"}
    ${"1952-10-15T23:59:59-11:19:50[Pacific/Niue]"}      | ${"wrong seconds between the two passes"}
  `("rejects $value ($why)", ({ value }) => {
    expect(isValidZonedDateTime(value)).toBe(false);
    expect(() => zonedDateTimeFrom(value)).toThrow(RangeError);
    expect(transitTime(value, "PT0S")).toBe("");
    expect(nextDeparture(value, ["2000-01-01T00:00:00Z"])).toBe("");
    expect(nextDeparture("1900-01-01T00:00:00Z", [value])).toBe("");
    expect(toOffsetInstant(value)).toBeNull();
  });

  // The `offset` option: "use" takes the written offset as it stands; "ignore" and "prefer"
  // fall back to the wall time when the written offset does not match exactly.
  it.each`
    value                                              | offset      | epochNanoseconds   | why
    ${"1970-01-01T12:00:00-00:45:00[Africa/Monrovia]"} | ${"use"}    | ${45900000000000n} | ${"the rounded HH:MM:SS offset is used"}
    ${"1970-01-01T12:00:00-00:45:00[Africa/Monrovia]"} | ${"ignore"} | ${45870000000000n} | ${"the wall time is kept"}
    ${"1970-01-01T12:00:00-00:45:00[Africa/Monrovia]"} | ${"prefer"} | ${45870000000000n} | ${"no exact match, so the wall time is kept"}
    ${"1970-01-01T12:00:00-00:44:40[Africa/Monrovia]"} | ${"use"}    | ${45880000000000n} | ${"the wrong offset is used"}
    ${"1970-01-01T12:00:00-00:44:40[Africa/Monrovia]"} | ${"prefer"} | ${45870000000000n} | ${"no exact match, so the wall time is kept"}
  `(
    "reads $value with offset: $offset as $epochNanoseconds ($why)",
    ({ value, offset, epochNanoseconds }) => {
      expect(zonedDateTimeFrom(value, { offset }).epochNanoseconds).toBe(
        epochNanoseconds,
      );
    },
  );

  // The second 23:59:59 in Niue is 20 seconds after the first; an hour on from it is 00:59:59
  // on the 16th at -11:20.
  it("transitTime keeps the pass an exact seconds offset names", () => {
    expect(
      transitTime("1952-10-15T23:59:59-11:20:00[Pacific/Niue]", "PT1H"),
    ).toBe("1952-10-16T00:59:59-11:20[Pacific/Niue]");
    expect(
      transitTime("1952-10-15T23:59:59-11:19:40[Pacific/Niue]", "PT1H"),
    ).toBe("1952-10-16T00:59:39-11:20[Pacific/Niue]");
  });

  // A zoned `relativeTo` string is read by the same rule: TC39 `ToRelativeTemporalObject` has the
  // same step ("If offsetParseResult contains more than one MinuteSecond Parse Node, set
  // matchBehaviour to match-exactly"). test262 Duration/prototype/round/
  // relativeto-sub-minute-offset.js covers it for offset time zones only; no test262 file was
  // found for a named zone, so these rows rest on the spec step, which Chromium 153's native
  // Temporal follows (RangeError for -00:45:00, 31 days for -00:45). January 1970 has 31 days, so
  // from 1 January P1M is 31 days, P45D is P1M14D, and P1M is longer than P30D.
  it.each`
    relativeTo                                         | days    | normalized  | comparison | why
    ${"1970-01-01T00:00:00-00:44:30[Africa/Monrovia]"} | ${31}   | ${"P1M14D"} | ${1}       | ${"the exact offset"}
    ${"1970-01-01T00:00:00-00:45[Africa/Monrovia]"}    | ${31}   | ${"P1M14D"} | ${1}       | ${"the offset rounded to minutes"}
    ${"1970-01-01T00:00:00-00:45:00[Africa/Monrovia]"} | ${null} | ${""}       | ${null}    | ${"rounded HH:MM:SS is not the zone's offset"}
    ${"1970-01-01T00:00:00-00:44:40[Africa/Monrovia]"} | ${null} | ${""}       | ${null}    | ${"wrong seconds"}
  `(
    "duration functions read relativeTo $relativeTo: $days days ($why)",
    ({ relativeTo, days, normalized, comparison }) => {
      expect(durationAs("P1M", "days", { relativeTo })).toBe(days);
      expect(
        normalizeDuration("P45D", { largestUnit: "month", relativeTo }),
      ).toBe(normalized);
      expect(compareDurations("P1M", "P30D", { relativeTo })).toBe(comparison);
    },
  );
});
