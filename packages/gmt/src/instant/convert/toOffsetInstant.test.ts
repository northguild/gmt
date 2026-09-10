import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  localDstEdgeBattleCases,
  sameInstantBattleCases,
  unixEpochBattleCases,
} from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { toOffsetInstant } from "./toOffsetInstant";

/**
 * The instants either side of every battle-test zone's own fall-back transition, as zoned
 * strings. The same wall clock reads twice on that night and the two readings carry different
 * offsets — the pair's whole reason for existing, and something no fixed date can produce
 * because every zone transitions on a different one.
 */
const fallBackBattleCases = localDstEdgeBattleCases
  .filter(({ ambiguous }) => ambiguous !== null)
  .map(({ timeZone, ambiguous }) => {
    const wallClock = Temporal.PlainDateTime.from(ambiguous as string);
    const earlier = wallClock.toZonedDateTime(timeZone, {
      disambiguation: "earlier",
    });
    const later = wallClock.toZonedDateTime(timeZone, {
      disambiguation: "later",
    });

    return {
      timeZone,
      wallClock: wallClock.toString(),
      earlier: earlier.toString(),
      later: later.toString(),
      earlierOffset: earlier.offset,
      laterOffset: later.offset,
      earlierInstant: earlier.toInstant().toString(),
      laterInstant: later.toInstant().toString(),
    };
  });

/**
 * Instants in zones that did not run on a whole minute. Temporal reports the true offset on
 * `.offset` but writes the RFC 9557 rounded one into a string, so these are the cases where
 * reading the string's offset literally and resolving it against the zone give different
 * instants — 30 seconds apart for `Africa/Monrovia`.
 */
const subMinuteOffsetCases = [
  { timeZone: "Africa/Monrovia", instant: "1970-01-01T00:00:00Z" },
  { timeZone: "Asia/Kolkata", instant: "1880-01-01T00:00:00Z" },
  { timeZone: "America/Sao_Paulo", instant: "1900-01-01T00:00:00Z" },
  { timeZone: "Pacific/Apia", instant: "1900-01-01T00:00:00Z" },
].map(({ timeZone, instant }) => {
  const zoned = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
  const value = zoned.toString();

  return {
    timeZone,
    instant,
    offset: zoned.offset,
    value,
    // What the string actually writes: RFC 9557 caps an offset at minutes, so this is the
    // rounded neighbour of `offset`, not `offset` itself.
    writtenOffset: value.slice(0, value.indexOf("[")).slice(-6),
  };
});

describe("toOffsetInstant", () => {
  it.each`
    value                                            | expected
    ${"2024-07-15T12:00:00-04:00[America/New_York]"} | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }}
    ${"2024-01-15T12:00:00-05:00[America/New_York]"} | ${{ instant: "2024-01-15T17:00:00Z", offset: "-05:00", timeZone: "America/New_York" }}
    ${"2024-02-29T12:00:00+05:45[Asia/Kathmandu]"}   | ${{ instant: "2024-02-29T06:15:00Z", offset: "+05:45", timeZone: "Asia/Kathmandu" }}
    ${"2024-02-29T12:00:00+00:00[UTC]"}              | ${{ instant: "2024-02-29T12:00:00Z", offset: "+00:00", timeZone: "UTC" }}
    ${"2024-07-15T16:00:00Z[America/New_York]"}      | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }}
  `("splits the bracketed $value into $expected", ({ value, expected }) => {
    expect(toOffsetInstant(value)).toEqual(expected);
  });

  it.each`
    value                                    | expected
    ${"2024-07-15T12:00:00-04:00"}           | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}
    ${"2024-02-29T12:00:00+05:45"}           | ${{ instant: "2024-02-29T06:15:00Z", offset: "+05:45" }}
    ${"2024-07-15T16:00:00Z"}                | ${{ instant: "2024-07-15T16:00:00Z", offset: "+00:00" }}
    ${"2024-07-15T16:00:00+00:00"}           | ${{ instant: "2024-07-15T16:00:00Z", offset: "+00:00" }}
    ${"2024-07-15T16:00:00-00:00"}           | ${{ instant: "2024-07-15T16:00:00Z", offset: "+00:00" }}
    ${"2024-07-15T12:00:00.123456789-04:00"} | ${{ instant: "2024-07-15T16:00:00.123456789Z", offset: "-04:00" }}
    ${"2024-07-15 12:00:00-04:00"}           | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}
    ${"20240715T120000-0400"}                | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}
    ${"1969-12-31T23:15:30-00:44:30"}        | ${{ instant: "1970-01-01T00:00:00Z", offset: "-00:44:30" }}
  `(
    "splits the zoneless $value into $expected, with no timeZone field",
    ({ value, expected }) => {
      expect(toOffsetInstant(value)).toEqual(expected);
    },
  );

  it.each`
    value                                            | timeZone              | expected
    ${"2024-07-15T16:00:00Z"}                        | ${"America/New_York"} | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }}
    ${"2024-01-15T17:00:00Z"}                        | ${"America/New_York"} | ${{ instant: "2024-01-15T17:00:00Z", offset: "-05:00", timeZone: "America/New_York" }}
    ${"2024-02-29T06:15:00Z"}                        | ${"Asia/Kathmandu"}   | ${{ instant: "2024-02-29T06:15:00Z", offset: "+05:45", timeZone: "Asia/Kathmandu" }}
    ${"1970-01-01T00:00:00Z"}                        | ${"Africa/Monrovia"}  | ${{ instant: "1970-01-01T00:00:00Z", offset: "-00:44:30", timeZone: "Africa/Monrovia" }}
    ${"2024-07-15T12:00:00-04:00"}                   | ${"Europe/Berlin"}    | ${{ instant: "2024-07-15T16:00:00Z", offset: "+02:00", timeZone: "Europe/Berlin" }}
    ${"2024-07-15T12:00:00-04:00[America/New_York]"} | ${"Asia/Tokyo"}       | ${{ instant: "2024-07-15T16:00:00Z", offset: "+09:00", timeZone: "Asia/Tokyo" }}
  `(
    "reads $value's offset in the supplied $timeZone as $expected",
    ({ value, timeZone, expected }) => {
      expect(toOffsetInstant(value, timeZone)).toEqual(expected);
    },
  );

  it.each(fallBackBattleCases)(
    "gives $timeZone's two readings of $wallClock different offsets — $earlierOffset then $laterOffset",
    ({
      timeZone,
      earlier,
      later,
      earlierOffset,
      laterOffset,
      earlierInstant,
      laterInstant,
    }) => {
      expect(toOffsetInstant(earlier)).toEqual({
        instant: earlierInstant,
        offset: earlierOffset,
        timeZone,
      });
      expect(toOffsetInstant(later)).toEqual({
        instant: laterInstant,
        offset: laterOffset,
        timeZone,
      });
      expect(earlierOffset).not.toBe(laterOffset);
      expect(earlierInstant).not.toBe(laterInstant);
    },
  );

  it.each(sameInstantBattleCases)(
    "splits $value in $timeZone back to the instant $utc it was built from",
    ({ timeZone, value, utc }) => {
      expect(toOffsetInstant(value)).toEqual({
        instant: utc,
        offset: Temporal.ZonedDateTime.from(value).offset,
        timeZone,
      });
    },
  );

  it.each(unixEpochBattleCases)(
    "splits the epoch as $timeZone saw it, $value, back to $utc",
    ({ timeZone, value, utc }) => {
      expect(toOffsetInstant(value)).toEqual({
        instant: utc,
        offset: Temporal.ZonedDateTime.from(value).offset,
        timeZone,
      });
    },
  );

  it.each(battleTestTimeZones)(
    "reads the same instant's offset in %s when only the zone argument names it",
    (timeZone) => {
      const instant = "2024-02-29T00:00:00Z";
      expect(toOffsetInstant(instant, timeZone)).toEqual({
        instant,
        offset:
          Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).offset,
        timeZone,
      });
    },
  );

  it.each(subMinuteOffsetCases)(
    "keeps $timeZone's real offset $offset at $instant, where its own string writes $writtenOffset",
    ({ timeZone, instant, offset, value, writtenOffset }) => {
      const expected = { instant, offset, timeZone };

      // Reached two ways: from a bare instant plus the zone argument, and from the string
      // Temporal itself writes for that instant — whose offset is the rounded one, so
      // reading it literally would put the instant seconds away from this.
      expect(toOffsetInstant(instant, timeZone)).toEqual(expected);
      expect(toOffsetInstant(value)).toEqual(expected);
      expect(writtenOffset).not.toBe(offset);
    },
  );

  it.each`
    value                                  | expected
    ${"2024-07-15T12:00:00-04:00[-04:00]"} | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}
    ${"2024-07-15T16:00:00Z[-04:00]"}      | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}
    ${"2024-02-29T12:00:00+05:45[+05:45]"} | ${{ instant: "2024-02-29T06:15:00Z", offset: "+05:45" }}
    ${"2024-07-15T16:00:00+00:00[+00:00]"} | ${{ instant: "2024-07-15T16:00:00Z", offset: "+00:00" }}
  `(
    "gives $value no timeZone field — a bracketed offset names no place",
    ({ value, expected }) => {
      expect(toOffsetInstant(value)).toEqual(expected);
    },
  );

  it.each`
    value                                 | expected
    ${"2024-07-15T12:00:00-04:00[-0400]"} | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}
    ${"2024-07-15T12:00:00-04:00[-04]"}   | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}
  `(
    "gives $value no timeZone field either — Temporal canonicalises every offset spelling to ±HH:MM",
    ({ value, expected }) => {
      expect(toOffsetInstant(value)).toEqual(expected);
    },
  );

  it.each`
    value                                         | expected
    ${"2024-07-15T12:00:00-04:00[US/Eastern]"}    | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "US/Eastern" }}
    ${"2024-07-15T12:00:00-04:00[EST5EDT]"}       | ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "EST5EDT" }}
    ${"2024-07-15T12:00:00Z[Zulu]"}               | ${{ instant: "2024-07-15T12:00:00Z", offset: "+00:00", timeZone: "Zulu" }}
    ${"2024-07-15T12:00:00-05:00[Etc/GMT+5]"}     | ${{ instant: "2024-07-15T17:00:00Z", offset: "-05:00", timeZone: "Etc/GMT+5" }}
    ${"2024-07-15T12:00:00+05:30[Asia/Calcutta]"} | ${{ instant: "2024-07-15T06:30:00Z", offset: "+05:30", timeZone: "Asia/Calcutta" }}
  `(
    "keeps $value's bracketed identifier as written, alias or not",
    ({ value, expected }) => {
      expect(toOffsetInstant(value)).toEqual(expected);
    },
  );

  it.each`
    timeZone     | description
    ${"EST5EDT"} | ${"a slash-less IANA zone"}
    ${"Zulu"}    | ${"a slash-less IANA alias"}
  `(
    "returns null when the timeZone argument is $timeZone ($description), which isValidTimeZone rejects everywhere in GMT",
    ({ timeZone }) => {
      expect(toOffsetInstant("2024-07-15T16:00:00Z", timeZone)).toBeNull();
    },
  );

  it.each`
    value                                                      | description
    ${"2024-07-15T12:00:00-04:00[foo=bar]"}                    | ${"an annotation standing where a time zone would"}
    ${"2024-07-15T12:00:00Z[foo=bar]"}                         | ${"the same on a Z instant"}
    ${"2024-07-15T12:00:00-04:00[America/New_York][foo=bar]"}  | ${"an annotation alongside a real zone, which Temporal would silently drop"}
    ${"2024-07-15T12:00:00-04:00[America/New_York][!foo=bar]"} | ${"a critical unknown annotation"}
    ${"2024-07-15T12:00:00-04:00[x-provenance=estimated]"}     | ${"an annotation that changes what the timestamp asserts"}
  `(
    "returns null for $value ($description) — GMT cannot vouch for an annotation, so it refuses rather than ignores",
    ({ value }) => {
      expect(toOffsetInstant(value)).toBeNull();
    },
  );

  it("reads a bracketed offset string's offset in a supplied zone instead", () => {
    expect(
      toOffsetInstant("2024-07-15T12:00:00-04:00[-04:00]", "Europe/Berlin"),
    ).toEqual({
      instant: "2024-07-15T16:00:00Z",
      offset: "+02:00",
      timeZone: "Europe/Berlin",
    });
  });

  it.each`
    value                                            | description
    ${"2024-07-15T12:00:00-05:00[America/New_York]"} | ${"a summer offset contradicting the zone"}
    ${"2024-07-15T12:00:00-04:00[-05:00]"}           | ${"an offset contradicting a bracketed offset time zone"}
    ${"2024-01-15T12:00:00-04:00[America/New_York]"} | ${"a winter offset contradicting the zone"}
    ${"2024-03-10T02:30:00-05:00[America/New_York]"} | ${"a wall time inside the spring-forward gap"}
  `("returns null for $value ($description)", ({ value }) => {
    expect(toOffsetInstant(value)).toBeNull();
  });

  it.each`
    value                                       | description
    ${"2024-07-15T12:00:00"}                    | ${"no offset designator"}
    ${"2024-07-15T12:00:00[America/New_York]"}  | ${"a bracketed zone but no offset"}
    ${"2024-07-15"}                             | ${"a date with no time"}
    ${"2016-12-31T23:59:60Z"}                   | ${"a leap second"}
    ${"2016-12-31 23:59:60Z"}                   | ${"a leap second with a space separator"}
    ${"2024-07-15T12:00:00-04:00[u-ca=hebrew]"} | ${"a calendar annotation"}
    ${"2024-02-30T12:00:00Z"}                   | ${"a date that does not exist"}
    ${"2024-07-15T12:00:00+01:00:00.5"}         | ${"a sub-second offset, which no zone or standard uses"}
    ${"2024-07-15T12:00:00+01:00:00.000000001"} | ${"a nanosecond-precision offset"}
    ${"invalid"}                                | ${"not a datetime at all"}
    ${""}                                       | ${"an empty string"}
  `("returns null for a value with $description", ({ value }) => {
    expect(toOffsetInstant(value)).toBeNull();
  });

  it.each`
    timeZone          | description
    ${"Invalid/Zone"} | ${"is not an IANA identifier"}
    ${"-05:00"}       | ${"is an offset, not a zone"}
    ${""}             | ${"is empty"}
    ${null}           | ${"is null"}
    ${123}            | ${"is a number"}
  `("returns null when timeZone $description", ({ timeZone }) => {
    expect(
      toOffsetInstant("2024-07-15T16:00:00Z", timeZone as never),
    ).toBeNull();
  });

  it.each`
    input         | description
    ${null}       | ${"null"}
    ${undefined}  | ${"undefined"}
    ${1721059200} | ${"number"}
    ${true}       | ${"boolean"}
    ${[]}         | ${"array"}
    ${{}}         | ${"object"}
  `("returns null when value is $description", ({ input }) => {
    expect(toOffsetInstant(input as never)).toBeNull();
  });

  it("treats an omitted timeZone the same as an explicitly undefined one", () => {
    expect(toOffsetInstant("2024-07-15T12:00:00-04:00", undefined)).toEqual(
      toOffsetInstant("2024-07-15T12:00:00-04:00"),
    );
  });

  it("returns null when Temporal.Instant.fromEpochNanoseconds throws", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(toOffsetInstant("2024-07-15T16:00:00Z")).toBeNull();
  });

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      toOffsetInstant("2024-07-15T12:00:00-04:00[America/New_York]"),
    ).toBeNull();
  });

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(toOffsetInstant("2024-07-15T12:00:00-04:00")).toBeNull();
  });
});
