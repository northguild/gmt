import { Temporal } from "./temporal";
import { battleTestTimeZones } from "../test";
import { readZonedOffsetInstant } from "./offsetInstant";

/** Epoch nanoseconds of a `Z` instant: the independent reading every row is checked against. */
const ns = (utc: string): bigint => Temporal.Instant.from(utc).epochNanoseconds;

/** The instant `readZonedOffsetInstant` reads `value` as, in epoch nanoseconds, or `null`. */
const readNs = (value: string): bigint | null => {
  const read = readZonedOffsetInstant(value);

  return read === null ? null : ns(read.instant);
};

describe("readZonedOffsetInstant: a minute-rounded offset in a zoned string", () => {
  // TC39 ToTemporalZonedDateTime, match-minutes: an offset written without seconds matches a
  // zone offset that rounds to it (InterpretISODateTimeOffset). The wall clock minus the zone's
  // real offset is the instant: Africa/Monrovia stood at -00:44:30 until 1972-01-07 (written
  // -00:45), America/New_York at -04:56:02 until noon on 1883-11-18 (written -04:56).
  it.each`
    value                                             | utc                         | why
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}   | ${"1960-01-01T01:04:30Z"}   | ${"-00:44:30 rounds up to -00:45"}
    ${"1960-01-01T00:20-00:45[Africa/Monrovia]"}      | ${"1960-01-01T01:04:30Z"}   | ${"a time written without seconds"}
    ${"1960-01-01T00:20:00.5-00:45[Africa/Monrovia]"} | ${"1960-01-01T01:04:30.5Z"} | ${"a fractional second is kept"}
    ${"1960-01-01T00:20:00-00:45[!Africa/Monrovia]"}  | ${"1960-01-01T01:04:30Z"}   | ${"a critical zone annotation"}
    ${"1883-11-18T09:00:00-04:56[America/New_York]"}  | ${"1883-11-18T13:56:02Z"}   | ${"-04:56:02 rounds down to -04:56"}
  `("reads the minute-rounded $value as $utc ($why)", ({ value, utc }) => {
    expect(readNs(value)).toBe(ns(utc));
    expect(readZonedOffsetInstant(value)?.instant).toBe(utc);
  });

  // Everything else follows ToTemporalZonedDateTime: an offset with a seconds part is
  // match-exactly (so -00:45:00 is never Monrovia's -00:44:30), and an offset the zone does not
  // have at that wall time, a zone that does not exist, and a skipped wall time are not read.
  it.each`
    value                                              | utc                       | why
    ${"1960-01-01T01:04:30Z[Africa/Monrovia]"}         | ${"1960-01-01T01:04:30Z"} | ${"Z with a zone"}
    ${"1960-01-01T00:20:00-00:44:30[Africa/Monrovia]"} | ${"1960-01-01T01:04:30Z"} | ${"the zone's exact offset"}
    ${"1960-01-01T00:20:00-00:45[-00:45]"}             | ${"1960-01-01T01:05:00Z"} | ${"an offset zone"}
    ${"1972-01-07T00:44:40+00:00[Africa/Monrovia]"}    | ${"1972-01-07T00:44:40Z"} | ${"Monrovia after it moved to +00:00"}
    ${"2024-06-15T10:00:00-04:00[America/New_York]"}   | ${"2024-06-15T14:00:00Z"} | ${"a whole-minute zone"}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"}   | ${"2024-11-03T05:30:00Z"} | ${"the first pass of a repeated hour"}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"}   | ${"2024-11-03T06:30:00Z"} | ${"the second pass of a repeated hour"}
  `("reads $value as $utc ($why)", ({ value, utc }) => {
    expect(readNs(value)).toBe(ns(utc));
    expect(readZonedOffsetInstant(value)?.instant).toBe(utc);
  });

  // A string with no bracket is an instant, not a zoned string: this reader refuses it.
  it.each`
    value                          | why
    ${"1960-01-01T01:04:30Z"}      | ${"a Z instant"}
    ${"1960-01-01T00:20:00-00:45"} | ${"an offset with no bracket"}
  `("refuses the unbracketed $value ($why)", ({ value }) => {
    expect(readZonedOffsetInstant(value)).toBeNull();
  });

  it.each`
    value                                                         | why
    ${"1960-01-01T00:20:00-00:45:00[Africa/Monrovia]"}            | ${"an offset with seconds is matched exactly: -00:45:00 is not -00:44:30"}
    ${"1960-01-01T00:20:00-00:45:00.0[Africa/Monrovia]"}          | ${"an offset with a fraction is matched exactly"}
    ${"1960-01-01T00:20:00-00:44[Africa/Monrovia]"}               | ${"-00:44:30 rounds half-expand to -00:45, never -00:44"}
    ${"1960-01-01T00:20:00+00:45[Africa/Monrovia]"}               | ${"the wrong sign"}
    ${"1960-01-01T00:20:00-00:45[Not/AZone]"}                     | ${"a zone that does not exist"}
    ${"1960-01-01T00:20:00-00:45[Europe/London]"}                 | ${"a zone the offset contradicts"}
    ${"2024-06-15T10:00:00-05:00[America/New_York]"}              | ${"a whole-minute zone the offset contradicts"}
    ${"2024-03-10T02:30:00-05:00[America/New_York]"}              | ${"a skipped wall time: no instant has it"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][foo=bar]"}      | ${"an elective annotation after the zone"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][u-ca=gregory]"} | ${"a calendar annotation after the zone"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][u-ca=iso8601]"} | ${"the ISO calendar annotation after the zone"}
    ${"1960-01-01T00:20:00-00:45[u-ca=gregory]"}                  | ${"a calendar annotation and no zone"}
    ${"1960-01-01T00:20:00-00:45[foo=bar]"}                       | ${"an elective annotation and no zone"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia][!foo=bar]"}     | ${"an unknown critical annotation"}
  `("returns null for $value ($why)", ({ value }) => {
    expect(readZonedOffsetInstant(value)).toBeNull();
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
        expect(readNs(written)).toBe(ns(utc));
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
    expect(readNs(written)).toBe(-543069621000000000n);
    expect(readZonedOffsetInstant(written)?.instant).toBe(
      "1952-10-16T11:19:39Z",
    );
    // The exact offsets name each pass.
    expect(readNs("1952-10-15T23:59:59-11:19:40[Pacific/Niue]")).toBe(
      -543069621000000000n,
    );
    expect(readNs("1952-10-15T23:59:59-11:20:00[Pacific/Niue]")).toBe(
      secondPass,
    );
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
        expect(readNs(written)).toBe(
          Temporal.ZonedDateTime.from(written).epochNanoseconds,
        );
      }
    },
  );

  // At the low limit the zoned string is read as TC39 reads it (CheckISODaysRange): Bangui's
  // first instant, at +00:13:35 and written 00:13:35+00:14, is the minimum instant; a wall time
  // on the day before it is outside the range.
  it.each`
    value                                             | why
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui]"}  | ${"east of Greenwich, no other annotation"}
    ${"-271821-04-20T00:13:35+00:14[!Africa/Bangui]"} | ${"east, a critical zone"}
  `("reads $value as the first instant ($why)", ({ value }) => {
    expect(readNs(value)).toBe(-8640000000000000000000n);
  });

  it.each`
    value                                                         | why
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui][u-ca=bogus]"}  | ${"east, a calendar annotation"}
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui][foo=bar]"}     | ${"east, an elective annotation"}
    ${"-271821-04-20T00:13:35+00:14[Africa/Bangui][!foo=bar]"}    | ${"an unknown critical annotation"}
    ${"-271821-04-19T23:58:45-00:01[Europe/London]"}              | ${"a wall date outside the ISO days range"}
    ${"-271821-04-19T23:58:45-00:01[u-ca=hebrew][Europe/London]"} | ${"a zone after a calendar"}
    ${"-271821-04-31T23:58:45-00:01[Europe/London]"}              | ${"a day April does not have"}
    ${"-271821-04-19T23:58:45-00:01[Not/AZone]"}                  | ${"a zone that does not exist"}
  `("returns null at the low limit for $value ($why)", ({ value }) => {
    expect(readZonedOffsetInstant(value)).toBeNull();
  });

  it.each`
    value                                           | why
    ${"1960-01-01T00:20:00[Africa/Monrovia]"}       | ${"a zoned wall time without an offset"}
    ${"1960-01-01T00:20:00"}                        | ${"a zoneless wall time"}
    ${"1960-01-01 00:20:00-00:45[Africa/Monrovia]"} | ${"a space separator"}
    ${"19600101T002000-0045[Africa/Monrovia]"}      | ${"basic format"}
    ${"1960-01-01T00:20:60-00:45[Africa/Monrovia]"} | ${"a leap second"}
    ${""}                                           | ${"an empty string"}
    ${"invalid"}                                    | ${"not a date"}
  `("returns null for '$value' ($why)", ({ value }) => {
    expect(readZonedOffsetInstant(value)).toBeNull();
  });
});
