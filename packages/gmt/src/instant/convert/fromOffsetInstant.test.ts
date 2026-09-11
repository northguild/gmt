import { Temporal } from "@js-temporal/polyfill";
import {
  localDstEdgeBattleCases,
  sameInstantBattleCases,
  unixEpochBattleCases,
} from "../../test";
import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { fromOffsetInstant } from "./fromOffsetInstant";
import { toOffsetInstant } from "./toOffsetInstant";

/** Both readings of every battle-test zone's own fall-back wall clock. */
const fallBackBattleCases = localDstEdgeBattleCases
  .filter(({ ambiguous }) => ambiguous !== null)
  .flatMap(({ timeZone, ambiguous }) => {
    const wallClock = Temporal.PlainDateTime.from(ambiguous as string);

    return (["earlier", "later"] as const).map((disambiguation) => {
      const zoned = wallClock.toZonedDateTime(timeZone, { disambiguation });
      return {
        timeZone,
        disambiguation,
        wallClock: wallClock.toString(),
        value: zoned.toString(),
        instant: zoned.toInstant().toString(),
        offset: zoned.offset,
      };
    });
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

/**
 * Bracketed identifiers Temporal accepts but `isValidTimeZone` does not, because its
 * `timeZoneLike` regex requires a slash. `toOffsetInstant` keeps them, so this must too.
 */
const aliasZoneCases = [
  { timeZone: "EST5EDT", value: "2024-07-15T12:00:00-04:00[EST5EDT]" },
  { timeZone: "Zulu", value: "2024-07-15T12:00:00+00:00[Zulu]" },
  { timeZone: "US/Eastern", value: "2024-07-15T12:00:00-04:00[US/Eastern]" },
  {
    timeZone: "Asia/Calcutta",
    value: "2024-07-15T12:00:00+05:30[Asia/Calcutta]",
  },
];

describe("fromOffsetInstant", () => {
  it.each`
    value                                                              | expected
    ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }}           | ${"2024-07-15T12:00:00-04:00"}
    ${{ instant: "2024-01-15T17:00:00Z", offset: "-05:00" }}           | ${"2024-01-15T12:00:00-05:00"}
    ${{ instant: "2024-02-29T06:15:00Z", offset: "+05:45" }}           | ${"2024-02-29T12:00:00+05:45"}
    ${{ instant: "2024-07-15T16:00:00Z", offset: "+00:00" }}           | ${"2024-07-15T16:00:00+00:00"}
    ${{ instant: "2024-07-15T16:00:00.123456789Z", offset: "-04:00" }} | ${"2024-07-15T12:00:00.123456789-04:00"}
    ${{ instant: "1970-01-01T00:00:00Z", offset: "-00:44:30" }}        | ${"1969-12-31T23:15:30-00:44:30"}
    ${{ instant: "2024-02-29T00:00:00Z", offset: "+13:00" }}           | ${"2024-02-29T13:00:00+13:00"}
    ${{ instant: "2024-02-29T00:00:00Z", offset: "-11:00" }}           | ${"2024-02-28T13:00:00-11:00"}
  `("renders the zoneless pair $value as $expected", ({ value, expected }) => {
    expect(fromOffsetInstant(value)).toBe(expected);
  });

  it.each`
    value                                                                                  | expected
    ${{ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }} | ${"2024-07-15T12:00:00-04:00[America/New_York]"}
    ${{ instant: "2024-02-29T06:15:00Z", offset: "+05:45", timeZone: "Asia/Kathmandu" }}   | ${"2024-02-29T12:00:00+05:45[Asia/Kathmandu]"}
    ${{ instant: "2024-02-29T12:00:00Z", offset: "+00:00", timeZone: "UTC" }}              | ${"2024-02-29T12:00:00+00:00[UTC]"}
    ${{ instant: "2024-11-03T05:30:00Z", offset: "-04:00", timeZone: "America/New_York" }} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${{ instant: "2024-11-03T06:30:00Z", offset: "-05:00", timeZone: "America/New_York" }} | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
  `("renders the zoned pair $value as $expected", ({ value, expected }) => {
    expect(fromOffsetInstant(value)).toBe(expected);
  });

  it.each`
    written        | canonical
    ${"-04:00:00"} | ${"2024-07-15T12:00:00-04:00"}
    ${"+05:45:00"} | ${"2024-07-15T21:45:00+05:45"}
    ${"-00:00"}    | ${"2024-07-15T16:00:00+00:00"}
  `(
    "canonicalises the offset $written when rendering, giving $canonical",
    ({ written, canonical }) => {
      expect(
        fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: written }),
      ).toBe(canonical);
    },
  );

  it.each(sameInstantBattleCases)(
    "round-trips $value in $timeZone through toOffsetInstant and back",
    ({ value }) => {
      const pair = toOffsetInstant(value);
      expect(fromOffsetInstant(pair as never)).toBe(value);
      expect(toOffsetInstant(fromOffsetInstant(pair as never))).toEqual(pair);
    },
  );

  it.each(unixEpochBattleCases)(
    "round-trips the epoch as $timeZone saw it, $value",
    ({ value }) => {
      const pair = toOffsetInstant(value);
      expect(fromOffsetInstant(pair as never)).toBe(value);
      expect(toOffsetInstant(fromOffsetInstant(pair as never))).toEqual(pair);
    },
  );

  it.each(subMinuteOffsetCases)(
    "round-trips $timeZone's real offset $offset at $instant through a string that writes $writtenOffset",
    ({ timeZone, instant, offset, value }) => {
      const pair = { instant, offset, timeZone };

      // The rendered string carries the rounded offset RFC 9557 allows; the bracketed zone
      // is what resolves it, so the pair that comes back is the pair that went in.
      expect(fromOffsetInstant(pair)).toBe(value);
      expect(toOffsetInstant(fromOffsetInstant(pair))).toEqual(pair);
    },
  );

  it.each(subMinuteOffsetCases)(
    "renders $timeZone's $offset exactly when the pair carries no zone to round against",
    ({ instant, offset }) => {
      const pair = { instant, offset };

      expect(fromOffsetInstant(pair).endsWith(offset)).toBe(true);
      expect(toOffsetInstant(fromOffsetInstant(pair))).toEqual(pair);
    },
  );

  it.each(fallBackBattleCases)(
    "round-trips $timeZone's $disambiguation reading of $wallClock, offset $offset",
    ({ value }) => {
      const pair = toOffsetInstant(value);
      expect(fromOffsetInstant(pair as never)).toBe(value);
      expect(toOffsetInstant(fromOffsetInstant(pair as never))).toEqual(pair);
    },
  );

  it.each`
    value                                       | description
    ${{ instant: "2024-07-15T12:00:00-04:00" }} | ${"an offset-only string with no zone"}
    ${{ instant: "2024-07-15T16:00:00Z" }}      | ${"a Z instant"}
    ${{ instant: "2024-02-29T00:00:00Z" }}      | ${"the leap-day battle instant"}
  `(
    "round-trips $description without a timeZone through both directions",
    ({ value }) => {
      const pair = toOffsetInstant(value.instant);
      expect(toOffsetInstant(fromOffsetInstant(pair as never))).toEqual(pair);
    },
  );

  it.each`
    value                                                                                  | description
    ${{ instant: "2024-07-15T16:00:00Z", offset: "-05:00", timeZone: "America/New_York" }} | ${"a winter offset on a summer instant"}
    ${{ instant: "2024-01-15T17:00:00Z", offset: "-04:00", timeZone: "America/New_York" }} | ${"a summer offset on a winter instant"}
    ${{ instant: "2024-07-15T16:00:00Z", offset: "+00:00", timeZone: "America/New_York" }} | ${"UTC's offset on a New York pair"}
    ${{ instant: "1970-01-01T00:00:00Z", offset: "-00:45", timeZone: "Africa/Monrovia" }}  | ${"a rounded offset where the zone's own is -00:44:30"}
  `('returns "" for $description', ({ value }) => {
    expect(fromOffsetInstant(value)).toBe("");
  });

  it.each`
    offset           | description
    ${"Z"}           | ${"the UTC designator, which is not an offset"}
    ${"-0400"}       | ${"basic format"}
    ${"+24:00"}      | ${"an hour out of range"}
    ${"+01:00:00.5"} | ${"a sub-second offset"}
    ${""}            | ${"an empty string"}
    ${"invalid"}     | ${"non-offset text"}
    ${null}          | ${"null"}
    ${undefined}     | ${"undefined"}
    ${-240}          | ${"a number of minutes"}
  `('returns "" when offset is $description', ({ offset }) => {
    expect(
      fromOffsetInstant({
        instant: "2024-07-15T16:00:00Z",
        offset: offset as never,
      }),
    ).toBe("");
  });

  it.each`
    instant                                | description
    ${"2024-07-15T12:00:00"}               | ${"no offset designator"}
    ${"2016-12-31T23:59:60Z"}              | ${"a leap second"}
    ${"2024-07-15T16:00:00Z[u-ca=hebrew]"} | ${"a calendar annotation"}
    ${"2024-02-30T12:00:00Z"}              | ${"a date that does not exist"}
    ${"invalid"}                           | ${"not a datetime at all"}
    ${""}                                  | ${"an empty string"}
    ${null}                                | ${"null"}
    ${undefined}                           | ${"undefined"}
    ${1721059200}                          | ${"a number"}
  `('returns "" when instant is $description', ({ instant }) => {
    expect(
      fromOffsetInstant({ instant: instant as never, offset: "-04:00" }),
    ).toBe("");
  });

  it.each`
    timeZone          | description
    ${"Invalid/Zone"} | ${"is not an IANA identifier"}
    ${"-04:00"}       | ${"is an offset, not a zone"}
    ${""}             | ${"is empty"}
    ${null}           | ${"is null"}
    ${123}            | ${"is a number"}
  `('returns "" when timeZone $description', ({ timeZone }) => {
    expect(
      fromOffsetInstant({
        instant: "2024-07-15T16:00:00Z",
        offset: "-04:00",
        timeZone: timeZone as never,
      }),
    ).toBe("");
  });

  it.each`
    input         | description
    ${null}       | ${"null"}
    ${undefined}  | ${"undefined"}
    ${"pair"}     | ${"string"}
    ${1721059200} | ${"number"}
    ${true}       | ${"boolean"}
    ${[]}         | ${"array"}
    ${{}}         | ${"empty object"}
  `('returns "" when the pair is $description', ({ input }) => {
    expect(fromOffsetInstant(input as never)).toBe("");
  });

  it.each`
    instant                      | offset         | expected
    ${"+275760-09-13T00:00:00Z"} | ${"+14:00"}    | ${"+275760-09-13T14:00:00+14:00"}
    ${"+275760-09-13T00:00:00Z"} | ${"+23:59:59"} | ${"+275760-09-13T23:59:59+23:59:59"}
    ${"-271821-04-20T00:00:00Z"} | ${"-14:00"}    | ${"-271821-04-19T10:00:00-14:00"}
    ${"-271821-04-20T00:00:00Z"} | ${"+14:00"}    | ${"-271821-04-20T14:00:00+14:00"}
  `(
    "renders $instant at $offset as $expected — a wall clock reaches a day further than an instant does",
    ({ instant, offset, expected }) => {
      expect(fromOffsetInstant({ instant, offset })).toBe(expected);
      expect(toOffsetInstant(expected)).toEqual({ instant, offset });
    },
  );

  it.each`
    instant                                | description
    ${"2024-07-15T16:00:00Z[foo=bar]"}     | ${"an annotation GMT cannot vouch for"}
    ${"2024-07-15T16:00:00Z[u-ca=hebrew]"} | ${"a calendar annotation"}
  `('returns "" when instant carries $description', ({ instant }) => {
    expect(fromOffsetInstant({ instant, offset: "-04:00" })).toBe("");
  });

  it('returns "" when Temporal.Instant.fromEpochNanoseconds throws', () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(
      fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }),
    ).toBe("");
  });

  it.each`
    timeZone    | description
    ${"-04:00"} | ${"an offset, which names no place"}
    ${"-0400"}  | ${"the basic-format spelling Temporal canonicalises to an offset"}
    ${"+05"}    | ${"the hour-only spelling Temporal canonicalises to an offset"}
  `('returns "" when timeZone is $timeZone ($description)', ({ timeZone }) => {
    expect(
      fromOffsetInstant({
        instant: "2024-07-15T16:00:00Z",
        offset: "-04:00",
        timeZone,
      }),
    ).toBe("");
  });

  it.each(aliasZoneCases)(
    "round-trips the alias zone $timeZone, which toOffsetInstant also keeps as written",
    ({ timeZone, value }) => {
      const pair = toOffsetInstant(value);

      expect(pair).toMatchObject({ timeZone });
      expect(fromOffsetInstant(pair as never)).toBe(value);
      expect(toOffsetInstant(fromOffsetInstant(pair as never))).toEqual(pair);
    },
  );
});
