import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../test";
import { mockTemporalInstantFromThrow } from "../test/mocks";
import { instantFrom, parseInstantNanoseconds } from "./instantNanoseconds";

describe("parseInstantNanoseconds", () => {
  it.each`
    value                                            | expected
    ${"1970-01-01T00:00:00Z"}                        | ${0n}
    ${"1969-12-31T23:59:59Z"}                        | ${-1000000000n}
    ${"2024-03-10T12:00:00.123456789Z"}              | ${1710072000123456789n}
    ${"2024-03-10T12:00:00-05:00"}                   | ${1710090000000000000n}
    ${"2024-03-10T12:00:00-05:00[America/New_York]"} | ${1710090000000000000n}
    ${"2024-03-10T12:00-05:00:00.5"}                 | ${1710090000500000000n}
    ${"2024-03-10T12:00:00,5Z"}                      | ${1710072000500000000n}
    ${"+275760-09-13T00:00:00Z"}                     | ${8640000000000000000000n}
    ${"-271821-04-20T00:00:00Z"}                     | ${-8640000000000000000000n}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseInstantNanoseconds(value)).toBe(expected);
  });

  it("distinguishes the epoch from a rejected string, which is the point of returning null", () => {
    expect(parseInstantNanoseconds("1970-01-01T00:00:00Z")).toBe(0n);
    expect(parseInstantNanoseconds("invalid")).toBeNull();
  });

  it.each`
    value                                            | reason
    ${"2024-03-10"}                                  | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                         | ${"no offset designator"}
    ${"12:00:00Z"}                                   | ${"time-only"}
    ${"2024-13-10T12:00:00Z"}                        | ${"month out of range"}
    ${"2024-02-30T12:00:00Z"}                        | ${"day out of range"}
    ${"+275760-09-13T00:00:00.001Z"}                 | ${"past the representable range"}
    ${"-271821-04-19T23:59:59Z"}                     | ${"before the representable range"}
    ${"2016-12-31T23:59:60Z"}                        | ${"leap second"}
    ${"2016-12-31T23:59:60.500Z"}                    | ${"fractional leap second"}
    ${"2016-12-31t23:59:60Z"}                        | ${"leap second, lowercase t separator"}
    ${"2016-12-31 23:59:60Z"}                        | ${"leap second, space separator"}
    ${"2016-12-31T23:59:60z"}                        | ${"leap second, lowercase z"}
    ${"20161231T235960Z"}                            | ${"leap second, basic format"}
    ${"2016-12-31T235960Z"}                          | ${"leap second, basic-format time"}
    ${"20161231 235960Z"}                            | ${"leap second, basic format and space"}
    ${"2016-12-31T23:59:60+00:00"}                   | ${"leap second with numeric offset"}
    ${"2016-12-31T23:59:60-05:00[America/New_York]"} | ${"leap second in a zoned string"}
    ${"2024-03-10 12:00:00Z"}                        | ${"space separator (strict extended shape)"}
    ${"2024-03-10t12:00:00Z"}                        | ${"lower-case t separator (strict extended shape)"}
    ${"2024-03-10T12:00:00z"}                        | ${"lower-case z designator (strict extended shape)"}
    ${"20240310T120000Z"}                            | ${"basic format (strict extended shape)"}
    ${"2024-03-10T07:00:00-0500"}                    | ${"basic offset (strict extended shape)"}
    ${"2024-03-10T07:00:00-05"}                      | ${"hour-only offset (strict extended shape)"}
    ${"2024-03-10T12Z"}                              | ${"hour-only time (strict extended shape)"}
    ${"invalid"}                                     | ${"unparseable"}
    ${""}                                            | ${"empty string"}
  `("returns null when $value is invalid ($reason)", ({ value }) => {
    expect(parseInstantNanoseconds(value)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    expect(parseInstantNanoseconds(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(parseInstantNanoseconds("2024-03-10T12:00:00Z")).toBeNull();
  });

  // Temporal.Instant.from reads RFC 9557 annotations and ignores a time zone, calendar or elective
  // annotation (an instant has no calendar; proposal-temporal `ParseTemporalInstantString`), and
  // rejects an unknown critical one. Native Temporal (Chromium 153) agrees.
  it.each`
    value                                            | expected
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"}      | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T12:00:00-05:00[!u-ca=hebrew]"}     | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T17:00:00Z[foo=bar]"}               | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T17:00:00Z[Europe/Paris][foo=bar]"} | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T17:00:00Z[!foo=bar]"}              | ${null}
    ${"2024-03-10T17:00:00Z[foo=bar][Europe/Paris]"} | ${null}
  `(
    "reads the annotations of $value as Temporal does → $expected",
    ({ value, expected }) => {
      expect(parseInstantNanoseconds(value)).toBe(expected);
    },
  );
});

/** Epoch nanoseconds of a `Z` instant: the independent reading every row is checked against. */
const ns = (utc: string): bigint => Temporal.Instant.from(utc).epochNanoseconds;

describe("parseInstantNanoseconds and instantFrom: a minute-rounded offset", () => {
  // TC39 ToTemporalZonedDateTime, match-minutes: an offset written without seconds matches a
  // zone offset that rounds to it (InterpretISODateTimeOffset). The wall clock minus the zone's
  // real offset is the instant: Africa/Monrovia stood at -00:44:30 until 1972-01-07 (written
  // -00:45), America/New_York at -04:56:02 until noon on 1883-11-18 (written -04:56).
  it.each`
    value                                                         | utc                         | why
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}               | ${"1960-01-01T01:04:30Z"}   | ${"-00:44:30 rounds up to -00:45"}
    ${"1960-01-01T00:20-00:45[Africa/Monrovia]"}                  | ${"1960-01-01T01:04:30Z"}   | ${"a time written without seconds"}
    ${"1960-01-01T00:20:00.5-00:45[Africa/Monrovia]"}             | ${"1960-01-01T01:04:30.5Z"} | ${"a fractional second is kept"}
    ${"1960-01-01T00:20:00-00:45[!Africa/Monrovia]"}              | ${"1960-01-01T01:04:30Z"}   | ${"a critical zone annotation"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][foo=bar]"}      | ${"1960-01-01T01:04:30Z"}   | ${"an elective annotation after the zone"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][u-ca=gregory]"} | ${"1960-01-01T01:04:30Z"}   | ${"a calendar, which an instant does not have"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][u-ca=bogus]"}   | ${"1960-01-01T01:04:30Z"}   | ${"a calendar, which an instant does not have"}
    ${"1883-11-18T09:00:00-04:56[America/New_York]"}              | ${"1883-11-18T13:56:02Z"}   | ${"-04:56:02 rounds down to -04:56"}
  `("reads the minute-rounded $value as $utc ($why)", ({ value, utc }) => {
    expect(parseInstantNanoseconds(value)).toBe(ns(utc));
    expect(instantFrom(value).toString()).toBe(utc);
  });

  // Everything else keeps the written offset, as Temporal.Instant.from reads it. An offset with
  // a seconds part is match-exactly in ToTemporalZonedDateTime, so -00:45:00 is never Monrovia's
  // -00:44:30; a zone that is missing, unknown or contradicted is not read.
  it.each`
    value                                                | utc                       | why
    ${"1960-01-01T01:04:30Z"}                            | ${"1960-01-01T01:04:30Z"} | ${"a Z instant"}
    ${"1960-01-01T00:20:00-00:45"}                       | ${"1960-01-01T01:05:00Z"} | ${"no bracket"}
    ${"1960-01-01T00:20:00-00:45[u-ca=gregory]"}         | ${"1960-01-01T01:05:00Z"} | ${"a calendar bracket is not a zone"}
    ${"1960-01-01T01:04:30Z[Africa/Monrovia]"}           | ${"1960-01-01T01:04:30Z"} | ${"Z with a zone"}
    ${"1960-01-01T00:20:00-00:44:30[Africa/Monrovia]"}   | ${"1960-01-01T01:04:30Z"} | ${"the zone's exact offset"}
    ${"1960-01-01T00:20:00-00:45:00[Africa/Monrovia]"}   | ${"1960-01-01T01:05:00Z"} | ${"an offset with seconds is matched exactly"}
    ${"1960-01-01T00:20:00-00:45:00.0[Africa/Monrovia]"} | ${"1960-01-01T01:05:00Z"} | ${"an offset with a fraction is matched exactly"}
    ${"1960-01-01T00:20:00-00:44[Africa/Monrovia]"}      | ${"1960-01-01T01:04:00Z"} | ${"-00:44:30 rounds half-expand to -00:45, never -00:44"}
    ${"1960-01-01T00:20:00+00:45[Africa/Monrovia]"}      | ${"1959-12-31T23:35:00Z"} | ${"the wrong sign"}
    ${"1960-01-01T00:20:00-00:45[Not/AZone]"}            | ${"1960-01-01T01:05:00Z"} | ${"a zone that does not exist"}
    ${"1960-01-01T00:20:00-00:45[Europe/London]"}        | ${"1960-01-01T01:05:00Z"} | ${"a zone the offset contradicts"}
    ${"1960-01-01T00:20:00-00:45[-00:45]"}               | ${"1960-01-01T01:05:00Z"} | ${"an offset zone"}
    ${"1972-01-07T00:44:40+00:00[Africa/Monrovia]"}      | ${"1972-01-07T00:44:40Z"} | ${"Monrovia after it moved to +00:00"}
    ${"2024-06-15T10:00:00-04:00[America/New_York]"}     | ${"2024-06-15T14:00:00Z"} | ${"a whole-minute zone"}
    ${"2024-06-15T10:00:00-05:00[America/New_York]"}     | ${"2024-06-15T15:00:00Z"} | ${"a whole-minute zone the offset contradicts"}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"}     | ${"2024-11-03T05:30:00Z"} | ${"the first pass of a repeated hour"}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"}     | ${"2024-11-03T06:30:00Z"} | ${"the second pass of a repeated hour"}
    ${"2024-03-10T02:30:00-05:00[America/New_York]"}     | ${"2024-03-10T07:30:00Z"} | ${"a skipped wall time: the offset is all there is"}
  `("keeps the written offset of $value: $utc ($why)", ({ value, utc }) => {
    expect(parseInstantNanoseconds(value)).toBe(ns(utc));
    expect(instantFrom(value).toString()).toBe(utc);
  });

  // What Temporal writes for a zone is read back as the instant it was written from. (The one
  // exception, a repeated wall time inside a sub-minute offset change, is the next block.)
  it.each(battleTestTimeZones)(
    "reads back the string Temporal writes for %s",
    (timeZone) => {
      for (const utc of ["2024-02-29T12:00:00Z", "1900-01-01T00:00:00Z"]) {
        const written = Temporal.Instant.from(utc)
          .toZonedDateTimeISO(timeZone)
          .toString();
        expect(parseInstantNanoseconds(written)).toBe(ns(utc));
      }
    },
  );

  // Pacific/Niue moved from -11:19:40 to -11:20:00 at the end of 15 October 1952, so 23:59:59
  // happened twice, 20 seconds apart. test262 intl402/Temporal/ZonedDateTime/from/
  // zoneddatetime-sub-minute-offset.js: "-11:20 matches the first candidate -11:19:40 in the
  // Pacific/Niue edge case" (reference -543069621_000_000_000n) and "-11:20:00 is accepted as
  // -11:20:00" (reference + 20_000_000_000n). Temporal writes both passes as -11:20, so the
  // second pass does not read back as itself.
  it("reads a repeated wall time inside a sub-minute offset change as its first pass", () => {
    const secondPass = -543069601000000000n;
    const written = Temporal.Instant.fromEpochNanoseconds(secondPass)
      .toZonedDateTimeISO("Pacific/Niue")
      .toString();
    expect(written).toBe("1952-10-15T23:59:59-11:20[Pacific/Niue]");
    expect(parseInstantNanoseconds(written)).toBe(-543069621000000000n);
    expect(instantFrom(written).toString()).toBe("1952-10-16T11:19:39Z");
    // The exact offsets name each pass.
    expect(
      parseInstantNanoseconds("1952-10-15T23:59:59-11:19:40[Pacific/Niue]"),
    ).toBe(-543069621000000000n);
    expect(
      parseInstantNanoseconds("1952-10-15T23:59:59-11:20:00[Pacific/Niue]"),
    ).toBe(secondPass);
  });

  // Second by second across two sub-minute offset changes, the reader agrees with a plain
  // Temporal.ZonedDateTime.from on the string Temporal writes: Africa/Monrovia's move from
  // -00:44:30 to +00:00 at 1972-01-07T00:44:30Z (a gap), and Pacific/Niue's from -11:19:40 to
  // -11:20:00 at 1952-10-16T11:19:40Z (a 20-second overlap, where the repeated wall times read
  // as their first pass).
  it.each`
    timeZone             | transition
    ${"Africa/Monrovia"} | ${"1972-01-07T00:44:30Z"}
    ${"Pacific/Niue"}    | ${"1952-10-16T11:19:40Z"}
  `(
    "reads every second around $timeZone's change at $transition as Temporal.ZonedDateTime.from does",
    ({ timeZone, transition }) => {
      const start = Temporal.Instant.from(transition).subtract({ seconds: 90 });
      for (let second = 0; second <= 180; second += 1) {
        const written = start
          .add({ seconds: second })
          .toZonedDateTimeISO(timeZone)
          .toString();
        expect(parseInstantNanoseconds(written)).toBe(
          Temporal.ZonedDateTime.from(written).epochNanoseconds,
        );
      }
    },
  );

  // At the low limit the written offset's own reading is outside the range (London's first
  // instant is written 23:58:45-00:01, 15 s early; Bangui's, at +00:13:35, is written
  // 00:13:35+00:14, 25 s early), so the instant comes from the zone alone. Annotations are read
  // there as Temporal.Instant.from reads them anywhere: a calendar id is not checked, an
  // elective annotation is ignored, and an unknown critical one, or a zone that is not the
  // first annotation, is rejected.
  it.each`
    value                                                         | why
    ${"-271821-04-19T23:58:45-00:01[Europe/London]"}              | ${"west of Greenwich, no other annotation"}
    ${"-271821-04-19T23:58:45-00:01[Europe/London][u-ca=bogus]"}  | ${"west, a calendar id Temporal does not know"}
    ${"-271821-04-19T23:58:45-00:01[Europe/London][u-ca=hebrew]"} | ${"west, a calendar"}
    ${"-271821-04-19T23:58:45-00:01[Europe/London][foo=bar]"}     | ${"west, an elective annotation"}
    ${"-271821-04-19T23:58:45-00:01[!Europe/London]"}             | ${"west, a critical zone"}
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui]"}              | ${"east of Greenwich, no other annotation"}
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui][u-ca=bogus]"}  | ${"east, a calendar id Temporal does not know"}
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui][foo=bar]"}     | ${"east, an elective annotation"}
  `("reads $value as the first instant ($why)", ({ value }) => {
    expect(parseInstantNanoseconds(value)).toBe(-8640000000000000000000n);
    expect(instantFrom(value).toString()).toBe("-271821-04-20T00:00:00Z");
  });

  it.each`
    value                                                                        | why
    ${"-271821-04-19T23:58:45-00:01[Europe/London][!foo=bar]"}                   | ${"an unknown critical annotation"}
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui][!foo=bar]"}                   | ${"an unknown critical annotation, east"}
    ${"-271821-04-19T23:58:45-00:01[u-ca=hebrew][Europe/London]"}                | ${"a zone after a calendar"}
    ${"-271821-04-19T23:58:45-00:01[Europe/London][u-ca=hebrew][!u-ca=iso8601]"} | ${"two calendars, one critical"}
    ${"-271821-04-19T23:58:45-00:01[Europe/London][foo]"}                        | ${"a second annotation without a key"}
    ${"-271821-04-31T23:58:45-00:01[Europe/London]"}                             | ${"a day April does not have"}
    ${"-271821-04-19T23:58:45-00:01[Not/AZone]"}                                 | ${"a zone that does not exist"}
  `("returns null at the low limit for $value ($why)", ({ value }) => {
    expect(parseInstantNanoseconds(value)).toBeNull();
  });

  // The gate is parseInstantNanoseconds: GMT's strict extended shape with a Z or an offset, no
  // leap second, and no unknown critical annotation.
  it.each`
    value                                                     | why
    ${"1960-01-01T00:20:00[Africa/Monrovia]"}                 | ${"a zoned wall time without an offset"}
    ${"1960-01-01T00:20:00"}                                  | ${"a zoneless wall time"}
    ${"1960-01-01 00:20:00-00:45[Africa/Monrovia]"}           | ${"a space separator"}
    ${"19600101T002000-0045[Africa/Monrovia]"}                | ${"basic format"}
    ${"1960-01-01T00:20:60-00:45[Africa/Monrovia]"}           | ${"a leap second"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][!foo=bar]"} | ${"an unknown critical annotation"}
    ${""}                                                     | ${"an empty string"}
    ${"invalid"}                                              | ${"not a date"}
  `("returns null for $value ($why)", ({ value }) => {
    expect(parseInstantNanoseconds(value)).toBeNull();
    expect(() => instantFrom(value)).toThrow(RangeError);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${-315615330}
    ${{}}
    ${Symbol("x")}
  `("returns null for the non-string $value", ({ value }) => {
    expect(parseInstantNanoseconds(value)).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      parseInstantNanoseconds("1960-01-01T00:20:00-00:45[Africa/Monrovia]"),
    ).toBeNull();
  });
});

// `zonedReading` looks up the zone's offset half a minute either side of the written reading
// and assumes the zone changes offset at most once in between. This walks every zone the
// runtime knows, through the plain polyfill's own transition search and never through GMT, and
// fails, naming the zones, if a tzdb release ever puts two offset changes within a minute.
// - Before 1847 the polyfill's search finds nothing; `zonedWallClock.test.ts` proves the only
//   changes there are the five date-line crossings of 1844, one per zone.
// - After 2040 every zone repeats its current yearly rule, whose changes are months apart.
// - The search steps in weeks, so it cannot see an offset that came and went again inside one
//   step. The closest pair it reports is days apart; the guard is for a change of rule, not a
//   proof about sub-step blips.
describe("zonedReading's assumption: no zone changes offset twice within a minute", () => {
  it("finds every pair of consecutive transitions from 1847 to 2040 more than 60 seconds apart", () => {
    const MINUTE = 60_000_000_000n;
    const from = Temporal.Instant.from("1847-01-01T00:00:00Z");
    const until = Temporal.Instant.from(
      "2040-01-01T00:00:00Z",
    ).epochNanoseconds;
    const tooClose: string[] = [];

    for (const timeZone of Intl.supportedValuesOf("timeZone")) {
      let cursor = from.toZonedDateTimeISO(timeZone);
      let previous: bigint | null = null;
      // No zone has 1,000 transitions; the cap only bounds the loop.
      for (let step = 0; step < 1000; step += 1) {
        const next = cursor.getTimeZoneTransition("next");
        if (next === null || next.epochNanoseconds > until) {
          break;
        }
        if (previous !== null && next.epochNanoseconds - previous <= MINUTE) {
          tooClose.push(`${timeZone} at ${next.toInstant().toString()}`);
        }
        previous = next.epochNanoseconds;
        cursor = next;
      }
    }

    expect(tooClose).toEqual([]);
  }, 60_000);
});
