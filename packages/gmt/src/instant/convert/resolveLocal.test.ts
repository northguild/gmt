import { Temporal } from "@js-temporal/polyfill";
import {
  dateLineCrossingAt,
  dateLineCrossingTimeZones,
  localDstEdgeBattleCases,
} from "../../test";
import {
  mockTemporalInstantFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { classifyLocal } from "./classifyLocal";
import { resolveLocal } from "./resolveLocal";

const disambiguations = ["compatible", "earlier", "later", "reject"] as const;

const zonesWithTransitions = localDstEdgeBattleCases.filter(
  ({ nonexistent }) => nonexistent !== null,
);
const zonesWithoutTransitions = localDstEdgeBattleCases.filter(
  ({ nonexistent }) => nonexistent === null,
);

/** Nanoseconds between two instant strings — the unit an offset shift is measured in. */
function nanosecondsBetween(from: string, to: string): bigint {
  return (
    Temporal.Instant.from(to).epochNanoseconds -
    Temporal.Instant.from(from).epochNanoseconds
  );
}

/** The offset shift a zone's transition applies, read off the zone itself. */
function shiftNanoseconds(timeZone: string, localDateTime: string): bigint {
  const wallClock = Temporal.PlainDateTime.from(localDateTime);
  return (
    wallClock.toZonedDateTime(timeZone, { disambiguation: "later" })
      .epochNanoseconds -
    wallClock.toZonedDateTime(timeZone, { disambiguation: "earlier" })
      .epochNanoseconds
  );
}

describe("resolveLocal", () => {
  it.each`
    localDateTime                      | timeZone              | expected
    ${"2024-07-15T12:00:00"}           | ${"America/New_York"} | ${"2024-07-15T16:00:00Z"}
    ${"2024-01-15T12:00:00"}           | ${"America/New_York"} | ${"2024-01-15T17:00:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"UTC"}              | ${"2024-02-29T12:00:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"Asia/Kathmandu"}   | ${"2024-02-29T06:15:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"Pacific/Apia"}     | ${"2024-02-28T23:00:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"Pacific/Niue"}     | ${"2024-02-29T23:00:00Z"}
    ${"2024-07-15T12:00:00.123456789"} | ${"America/New_York"} | ${"2024-07-15T16:00:00.123456789Z"}
    ${"2024-07-15T12:00"}              | ${"America/New_York"} | ${"2024-07-15T16:00:00Z"}
  `(
    "resolves unambiguous $localDateTime in $timeZone to $expected",
    ({ localDateTime, timeZone, expected }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2024-11-03T05:30:00Z"}
    ${"compatible"} | ${"2024-11-03T05:30:00Z"}
    ${"earlier"}    | ${"2024-11-03T05:30:00Z"}
    ${"later"}      | ${"2024-11-03T06:30:00Z"}
    ${"reject"}     | ${""}
  `(
    "resolves the ambiguous 2024-11-03T01:30:00 in America/New_York to $expected with disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      expect(
        resolveLocal("2024-11-03T01:30:00", "America/New_York", {
          disambiguation,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2024-03-10T07:30:00Z"}
    ${"compatible"} | ${"2024-03-10T07:30:00Z"}
    ${"earlier"}    | ${"2024-03-10T06:30:00Z"}
    ${"later"}      | ${"2024-03-10T07:30:00Z"}
    ${"reject"}     | ${""}
  `(
    "resolves the nonexistent 2024-03-10T02:30:00 in America/New_York to $expected with disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      expect(
        resolveLocal("2024-03-10T02:30:00", "America/New_York", {
          disambiguation,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2024-07-15T16:00:00Z"}
    ${"compatible"} | ${"2024-07-15T16:00:00Z"}
    ${"earlier"}    | ${"2024-07-15T16:00:00Z"}
    ${"later"}      | ${"2024-07-15T16:00:00Z"}
    ${"reject"}     | ${"2024-07-15T16:00:00Z"}
  `(
    "leaves an unambiguous wall time at $expected with disambiguation $disambiguation, including reject",
    ({ disambiguation, expected }) => {
      expect(
        resolveLocal("2024-07-15T12:00:00", "America/New_York", {
          disambiguation,
        }),
      ).toBe(expected);
    },
  );

  it.each(zonesWithTransitions)(
    "resolves $timeZone's ambiguous $ambiguous one offset shift apart between earlier and later",
    ({ timeZone, ambiguous }) => {
      const localDateTime = ambiguous as string;
      const earlier = resolveLocal(localDateTime, timeZone, {
        disambiguation: "earlier",
      });
      const later = resolveLocal(localDateTime, timeZone, {
        disambiguation: "later",
      });

      expect(nanosecondsBetween(earlier, later)).toBe(
        shiftNanoseconds(timeZone, localDateTime),
      );
      expect(nanosecondsBetween(earlier, later)).toBeGreaterThan(0n);
      expect(resolveLocal(localDateTime, timeZone)).toBe(earlier);
      expect(
        resolveLocal(localDateTime, timeZone, {
          disambiguation: "reject",
        }),
      ).toBe("");
    },
  );

  it.each(zonesWithTransitions)(
    "resolves $timeZone's nonexistent $nonexistent one offset shift apart between earlier and later",
    ({ timeZone, nonexistent }) => {
      const localDateTime = nonexistent as string;
      const earlier = resolveLocal(localDateTime, timeZone, {
        disambiguation: "earlier",
      });
      const later = resolveLocal(localDateTime, timeZone, {
        disambiguation: "later",
      });

      expect(nanosecondsBetween(earlier, later)).toBe(
        shiftNanoseconds(timeZone, localDateTime),
      );
      expect(resolveLocal(localDateTime, timeZone)).toBe(later);
      expect(
        resolveLocal(localDateTime, timeZone, {
          disambiguation: "reject",
        }),
      ).toBe("");
    },
  );

  it.each(localDstEdgeBattleCases)(
    "resolves local noon $unique in $timeZone identically under every disambiguation",
    ({ timeZone, unique }) => {
      const resolved = disambiguations.map((disambiguation) =>
        resolveLocal(unique, timeZone, { disambiguation }),
      );

      expect(new Set([...resolved, resolveLocal(unique, timeZone)]).size).toBe(
        1,
      );
      expect(classifyLocal(unique, timeZone)).toBe("unique");
    },
  );

  it.each(zonesWithoutTransitions)(
    "resolves the US transition wall times in $timeZone under reject, since it has no transitions",
    ({ timeZone }) => {
      expect(
        resolveLocal("2024-03-10T02:30:00", timeZone, {
          disambiguation: "reject",
        }),
      ).not.toBe("");
      expect(
        resolveLocal("2024-11-03T01:30:00", timeZone, {
          disambiguation: "reject",
        }),
      ).not.toBe("");
    },
  );

  it.each(localDstEdgeBattleCases)(
    "resolves local noon in $timeZone to the instant Temporal reports for the same wall time",
    ({ timeZone, unique }) => {
      expect(resolveLocal(unique, timeZone)).toBe(
        Temporal.PlainDateTime.from(unique)
          .toZonedDateTime(timeZone)
          .toInstant()
          .toString(),
      );
    },
  );

  it.each`
    localDateTime                  | description
    ${"2024-11-03T01:30:00-04:00"} | ${"carries an offset"}
    ${"2024-11-03T01:30:00Z"}      | ${"carries a UTC designator"}
    ${"2024-11-03 01:30:00"}       | ${"uses a space separator"}
    ${"2024-11-03"}                | ${"is a date with no time"}
    ${"2024-02-30T01:30:00"}       | ${"is not a real date"}
    ${"2024-12-31T23:59:60"}       | ${"is a leap second"}
    ${"invalid"}                   | ${"is not a datetime at all"}
    ${""}                          | ${"is empty"}
  `('returns "" when localDateTime $description', ({ localDateTime }) => {
    expect(resolveLocal(localDateTime, "America/New_York")).toBe("");
  });

  it.each`
    timeZone          | description
    ${"Invalid/Zone"} | ${"is not an IANA identifier"}
    ${""}             | ${"is empty"}
  `('returns "" when timeZone $description', ({ timeZone }) => {
    expect(resolveLocal("2024-11-03T01:30:00", timeZone)).toBe("");
  });

  // `null` belongs here, not with the defaults: Temporal reads a present option through ToString,
  // so Chromium 153 answers `zdt.with({ hour: 3 }, { disambiguation: null })` with "RangeError:
  // Value null out of range for Temporal.ZonedDateTime.prototype.with options property
  // disambiguation". Only an omitted member takes "compatible".
  it.each`
    disambiguation | description
    ${"fortnight"} | ${"is not a disambiguation value"}
    ${"EARLIER"}   | ${"is the right word in the wrong case"}
    ${123}         | ${"is a number"}
    ${{}}          | ${"is an object"}
    ${[]}          | ${"is an array"}
    ${null}        | ${"is explicitly null, a value rather than an omission"}
  `('returns "" when disambiguation $description', ({ disambiguation }) => {
    expect(
      resolveLocal("2024-11-03T01:30:00", "America/New_York", {
        disambiguation: disambiguation as never,
      }),
    ).toBe("");
  });

  it.each`
    optionsArg                          | description
    ${undefined}                        | ${"no options object"}
    ${{}}                               | ${"an empty options object"}
    ${{ disambiguation: undefined }}    | ${"an explicitly undefined disambiguation"}
    ${{ disambiguation: "compatible" }} | ${'an explicit "compatible"'}
  `(
    "falls back to compatible for the ambiguous 2024-11-03T01:30:00 given $description",
    ({ optionsArg }) => {
      expect(
        resolveLocal("2024-11-03T01:30:00", "America/New_York", optionsArg),
      ).toBe("2024-11-03T05:30:00Z");
    },
  );

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${20241103}  | ${"number"}
    ${true}      | ${"boolean"}
    ${[]}        | ${"array"}
    ${{}}        | ${"object"}
  `('returns "" when either argument is $description', ({ input }) => {
    expect(resolveLocal(input as never, "America/New_York")).toBe("");
    expect(resolveLocal("2024-11-03T01:30:00", input as never)).toBe("");
  });

  it.each`
    localDateTime               | timeZone          | description
    ${"+275760-09-13T00:00:00"} | ${"Pacific/Niue"} | ${"the maximum PlainDateTime, which is past the last representable instant in a zone west of UTC"}
    ${"-271821-04-20T00:00:00"} | ${"Pacific/Apia"} | ${"the minimum PlainDateTime, which is before the first representable instant in a zone east of UTC"}
  `(
    'returns "" for $localDateTime in $timeZone — $description',
    ({ localDateTime, timeZone }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe("");
    },
  );

  it('returns "" when Temporal.ZonedDateTime.from throws', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(resolveLocal("2024-11-03T01:30:00", "America/New_York")).toBe("");
  });

  it('returns "" when Temporal.PlainDateTime.from throws', () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(resolveLocal("2024-11-03T01:30:00", "America/New_York")).toBe("");
  });
});

describe("resolveLocal at the maximum instant", () => {
  it.each`
    localDateTime               | timeZone                | expected
    ${"+275760-09-13T10:00:00"} | ${"Australia/Sydney"}   | ${"+275760-09-13T00:00:00Z"}
    ${"+275760-09-13T14:00:00"} | ${"Pacific/Kiritimati"} | ${"+275760-09-13T00:00:00Z"}
    ${"+275760-09-13T10:00:01"} | ${"Australia/Sydney"}   | ${""}
  `(
    "resolves $localDateTime in $timeZone to $expected",
    ({ localDateTime, timeZone, expected }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    localDateTime                              | expected
    ${"2024-07-15T12:00:00[foo=bar]"}          | ${"2024-07-15T16:00:00Z"}
    ${"2024-07-15T12:00:00[u-ca=iso8601]"}     | ${"2024-07-15T16:00:00Z"}
    ${"2024-07-15T12:00:00[Asia/Tokyo]"}       | ${"2024-07-15T16:00:00Z"}
    ${"2024-11-03T01:30:00[America/New_York]"} | ${"2024-11-03T05:30:00Z"}
    ${"2024-07-15T12:00:00[!foo=bar]"}         | ${""}
  `(
    "reads the annotations of $localDateTime as Temporal.PlainDateTime.from does → $expected",
    ({ localDateTime, expected }) => {
      expect(resolveLocal(localDateTime, "America/New_York")).toBe(expected);
    },
  );

  // Temporal's `TimeZoneIdentifier ::: UTCOffset[~SubMinutePrecision] | TimeZoneIANAName`
  // (proposal-temporal spec/abstractops.html): `±HH`, `±HHMM` or `±HH:MM`, hour 00–23, no seconds.
  // Native Temporal and Intl.DateTimeFormat (Chromium 153) accept and reject the same rows.
  it.each`
    timeZone    | expected
    ${"-05:00"} | ${"2024-11-03T06:30:00Z"}
    ${"+0530"}  | ${"2024-11-02T20:00:00Z"}
    ${"+24:00"} | ${""}
  `(
    "resolves 2024-11-03T01:30:00 in the offset zone $timeZone → $expected",
    ({ timeZone, expected }) => {
      expect(resolveLocal("2024-11-03T01:30:00", timeZone)).toBe(expected);
    },
  );
});

// The 1844 date-line crossings (zoned.E): Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau
// skipped 1844-12-31, jumping a whole day forward at local 1844-12-31T00:00 in LMT. Expected values
// are Chromium 153 native Temporal, never the polyfill (whose transition search starts at
// 1847-01-01). `dateLineCrossingAt(zone, h)` is the zone h hours from its crossing, from exact time.

describe("resolveLocal across the 1844 date-line crossings (zoned.E)", () => {
  // 1844-12-31T12:00 never happened: "compatible" moves it forward by the 24-hour gap.
  it.each(dateLineCrossingTimeZones)(
    "resolves the skipped 1844-12-31T12:00 in $timeZone 12 hours after the crossing",
    (crossing) => {
      expect(resolveLocal("1844-12-31T12:00", crossing.timeZone)).toBe(
        dateLineCrossingAt(crossing, 12).toInstant().toString(),
      );
    },
  );
});

// A stored UTC offset (`±HH:MM:SS`, what `getTimeZoneOffset` returns) is not a time zone
// identifier, but it is a complete rule for local time: instant = local time − offset. For an
// offset identifier, which stops at minutes, that subtraction is TC39 Temporal
// `GetPossibleEpochNanoseconds`, §11.1.13. A date-time string whose offset has seconds is read by
// `InterpretISODateTimeOffset`, §6.5.1, which subtracts the same way. Each expected value is that
// subtraction.
describe("resolveLocal with a stored UTC offset", () => {
  it.each`
    localDateTime                      | timeZone       | expected                            | reason
    ${"1970-01-01T12:00:00"}           | ${"-00:44:30"} | ${"1970-01-01T12:44:30Z"}           | ${"12:00:00 + 00:44:30"}
    ${"1970-01-01T12:00:00"}           | ${"+00:00:00"} | ${"1970-01-01T12:00:00Z"}           | ${"zero written with seconds"}
    ${"1970-01-01T12:00:00"}           | ${"-00:00:00"} | ${"1970-01-01T12:00:00Z"}           | ${"negative zero is zero"}
    ${"1970-01-01T12:00:00"}           | ${"+05:30:00"} | ${"1970-01-01T06:30:00Z"}           | ${"whole minutes: 12:00 − 05:30"}
    ${"1970-01-01T12:00:00"}           | ${"+23:59:59"} | ${"1969-12-31T12:00:01Z"}           | ${"a second short of a day earlier"}
    ${"1970-01-01T12:00:00"}           | ${"-23:59:59"} | ${"1970-01-02T11:59:59Z"}           | ${"a second short of a day later"}
    ${"1970-01-01T12:00"}              | ${"-00:44:30"} | ${"1970-01-01T12:44:30Z"}           | ${"a wall time with no seconds"}
    ${"1970-01-01T12:00:00.123456789"} | ${"-00:44:30"} | ${"1970-01-01T12:44:30.123456789Z"} | ${"nanoseconds survive"}
    ${"1970-01-01T12:00:00[foo=bar]"}  | ${"-00:44:30"} | ${"1970-01-01T12:44:30Z"}           | ${"an elective annotation is ignored"}
  `(
    "resolves $localDateTime at $timeZone → $expected ($reason)",
    ({ localDateTime, timeZone, expected }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  // Existing spellings of a whole-minute offset keep their result.
  it.each`
    timeZone    | expected
    ${"-00:00"} | ${"1970-01-01T12:00:00Z"}
    ${"+0530"}  | ${"1970-01-01T06:30:00Z"}
    ${"+05:30"} | ${"1970-01-01T06:30:00Z"}
  `(
    "still resolves 1970-01-01T12:00:00 at the identifier $timeZone → $expected",
    ({ timeZone, expected }) => {
      expect(resolveLocal("1970-01-01T12:00:00", timeZone)).toBe(expected);
    },
  );

  // Outside years 0000 to 9999 the instant is written with an expanded year, as the minute path
  // writes it: 0000-01-01T00:00:00 at +23:59 is -000001-12-31T00:01:00Z.
  it.each`
    localDateTime            | timeZone       | expected
    ${"0000-01-01T00:00:00"} | ${"+23:59:59"} | ${"-000001-12-31T00:00:01Z"}
    ${"9999-12-31T23:59:59"} | ${"-23:59:59"} | ${"+010000-01-01T23:59:58Z"}
    ${"0000-01-01T00:00:00"} | ${"+23:59"}    | ${"-000001-12-31T00:01:00Z"}
  `(
    "resolves $localDateTime at $timeZone to the expanded-year instant $expected",
    ({ localDateTime, timeZone, expected }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  // A fixed offset has no transition, so no wall time is repeated or skipped and no policy has
  // anything to decide: "reject" does not reject.
  it.each(disambiguations.map((disambiguation) => ({ disambiguation })))(
    "resolves 1970-01-01T12:00:00 at -00:44:30 to the same instant with disambiguation $disambiguation",
    ({ disambiguation }) => {
      expect(
        resolveLocal("1970-01-01T12:00:00", "-00:44:30", { disambiguation }),
      ).toBe("1970-01-01T12:44:30Z");
    },
  );

  // 02:30 on 10 March 2024 is skipped in America/New_York and 01:30 on 3 November is repeated
  // there. At a fixed offset neither is: -04:56:02 is New York's local mean time, so the instant
  // is the wall time plus 4 h 56 min 2 s, and +05:30:00 is the wall time less 5 h 30 min. The
  // whole-minute row goes through Temporal's zone path, where "reject" is really applied.
  it.each`
    localDateTime            | timeZone       | disambiguation  | expected
    ${"2024-03-10T02:30:00"} | ${"-04:56:02"} | ${"compatible"} | ${"2024-03-10T07:26:02Z"}
    ${"2024-03-10T02:30:00"} | ${"-04:56:02"} | ${"earlier"}    | ${"2024-03-10T07:26:02Z"}
    ${"2024-03-10T02:30:00"} | ${"-04:56:02"} | ${"later"}      | ${"2024-03-10T07:26:02Z"}
    ${"2024-03-10T02:30:00"} | ${"-04:56:02"} | ${"reject"}     | ${"2024-03-10T07:26:02Z"}
    ${"2024-11-03T01:30:00"} | ${"-04:56:02"} | ${"earlier"}    | ${"2024-11-03T06:26:02Z"}
    ${"2024-11-03T01:30:00"} | ${"-04:56:02"} | ${"later"}      | ${"2024-11-03T06:26:02Z"}
    ${"2024-11-03T01:30:00"} | ${"-04:56:02"} | ${"reject"}     | ${"2024-11-03T06:26:02Z"}
    ${"2024-03-10T02:30:00"} | ${"+05:30:00"} | ${"reject"}     | ${"2024-03-09T21:00:00Z"}
    ${"2024-11-03T01:30:00"} | ${"+05:30:00"} | ${"earlier"}    | ${"2024-11-02T20:00:00Z"}
    ${"2024-11-03T01:30:00"} | ${"+05:30:00"} | ${"later"}      | ${"2024-11-02T20:00:00Z"}
  `(
    "resolves $localDateTime at $timeZone with disambiguation $disambiguation → $expected, a wall time New York skips or repeats",
    ({ localDateTime, timeZone, disambiguation, expected }) => {
      expect(resolveLocal(localDateTime, timeZone, { disambiguation })).toBe(
        expected,
      );
    },
  );

  it('returns "" for an invalid disambiguation with a stored offset', () => {
    expect(
      resolveLocal("1970-01-01T12:00:00", "-00:44:30", {
        disambiguation: "x" as never,
      }),
    ).toBe("");
  });

  it.each`
    timeZone         | reason
    ${"Z"}           | ${"a designator, not an offset"}
    ${"+05:30:00.5"} | ${"a fraction of a second"}
    ${"+24:00"}      | ${"hour out of range"}
    ${"+24:00:00"}   | ${"hour out of range, with seconds"}
    ${"-0400:30"}    | ${"basic format with seconds"}
    ${"-00:44:60"}   | ${"second out of range"}
  `('returns "" for $timeZone ($reason)', ({ timeZone }) => {
    expect(resolveLocal("1970-01-01T12:00:00", timeZone)).toBe("");
  });

  // Temporal's last instant is +275760-09-13T00:00:00Z and its first -271821-04-20T00:00:00Z. A
  // wall clock reaches past both, so the local time of each limit resolves and a nanosecond
  // beyond does not.
  it.each`
    localDateTime                         | timeZone       | expected
    ${"+275760-09-13T00:00:30"}           | ${"+00:00:30"} | ${"+275760-09-13T00:00:00Z"}
    ${"+275760-09-13T00:00:30.000000001"} | ${"+00:00:30"} | ${""}
    ${"+275760-09-12T23:15:30"}           | ${"-00:44:30"} | ${"+275760-09-13T00:00:00Z"}
    ${"-271821-04-19T23:59:30"}           | ${"-00:00:30"} | ${"-271821-04-20T00:00:00Z"}
    ${"-271821-04-20T00:44:30"}           | ${"+00:44:30"} | ${"-271821-04-20T00:00:00Z"}
    ${"-271821-04-20T00:44:29.999999999"} | ${"+00:44:30"} | ${""}
  `(
    "resolves $localDateTime at $timeZone at the limit of the instant range → $expected",
    ({ localDateTime, timeZone, expected }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  it('returns "" when Temporal.Instant.from throws for a stored offset', () => {
    mockTemporalInstantFromThrow();
    expect(resolveLocal("1970-01-01T12:00:00", "-00:44:30")).toBe("");
  });
});
