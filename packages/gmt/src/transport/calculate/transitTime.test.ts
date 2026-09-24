import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../../test";
import {
  mockTemporalDurationFromThrow,
  mockTemporalInstantFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { transitTime } from "./transitTime";

describe("transitTime", () => {
  it.each`
    departure                                        | duration      | expected
    ${"2024-06-15T10:00:00-04:00[America/New_York]"} | ${"PT2H30M"}  | ${"2024-06-15T12:30:00-04:00[America/New_York]"}
    ${"2024-06-15T12:30:00-04:00[America/New_York]"} | ${"-PT2H30M"} | ${"2024-06-15T10:00:00-04:00[America/New_York]"}
    ${"2024-06-15T10:00:00-04:00[America/New_York]"} | ${"PT0S"}     | ${"2024-06-15T10:00:00-04:00[America/New_York]"}
    ${"2024-06-15T10:00:00Z"}                        | ${"PT36H"}    | ${"2024-06-16T22:00:00Z"}
    ${"2024-06-15T10:00:00Z[UTC]"}                   | ${"PT36H"}    | ${"2024-06-16T22:00:00+00:00[UTC]"}
    ${"2024-06-15T10:00:00+09:00"}                   | ${"PT1H"}     | ${"2024-06-15T11:00:00+09:00"}
    ${"2024-06-15T10:00:00.5Z"}                      | ${"PT0.25S"}  | ${"2024-06-15T10:00:00.75Z"}
    ${"2024-06-15T10:00:00Z"}                        | ${"PT1H30M15.123456789S"} | ${"2024-06-15T11:30:15.123456789Z"}
  `(
    "adds $duration to $departure giving $expected",
    ({ departure, duration, expected }) => {
      expect(transitTime(departure, duration)).toBe(expected);
    },
  );

  // Transit time is exact time: a leg that crosses a transition arrives at the wall time the
  // elapsed hours land on, not at the same wall time shifted by a calendar day.
  it.each`
    departure                                            | duration   | expected                                             | transition
    ${"2024-03-09T23:00:00-05:00[America/New_York]"}     | ${"PT4H"}  | ${"2024-03-10T04:00:00-04:00[America/New_York]"}     | ${"spring forward: 23:00 EST plus four hours is 04:00 EDT"}
    ${"2024-11-02T23:00:00-04:00[America/New_York]"}     | ${"PT4H"}  | ${"2024-11-03T02:00:00-05:00[America/New_York]"}     | ${"fall back: 23:00 EDT plus four hours is 02:00 EST"}
    ${"2024-03-09T12:00:00-05:00[America/New_York]"}     | ${"P1D"}   | ${"2024-03-10T13:00:00-04:00[America/New_York]"}     | ${"a day is 24 elapsed hours across the spring-forward"}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"}     | ${"P1D"}   | ${"2024-11-03T11:00:00-05:00[America/New_York]"}     | ${"a day is 24 elapsed hours across the fall-back"}
    ${"2024-04-06T12:00:00+11:00[Australia/Lord_Howe]"}  | ${"PT24H"} | ${"2024-04-07T11:30:00+10:30[Australia/Lord_Howe]"}  | ${"half-hour fall-back"}
    ${"2024-04-06T12:00:00+13:45[Pacific/Chatham]"}      | ${"PT24H"} | ${"2024-04-07T11:00:00+12:45[Pacific/Chatham]"}      | ${"quarter-hour zone, one-hour fall-back"}
    ${"2024-06-15T10:00:00-04:00[America/New_York]"}     | ${"P1DT2H"} | ${"2024-06-16T12:00:00-04:00[America/New_York]"}    | ${"mixed day and hour components"}
  `(
    "adds exact elapsed time across $transition",
    ({ departure, duration, expected }) => {
      expect(transitTime(departure, duration)).toBe(expected);
    },
  );

  it.each(localNoonBattleCases)(
    "preserves the zone and adds exactly one hour in $timeZone",
    ({ timeZone, value }) => {
      const result = transitTime(value, "PT1H");
      const arrival = Temporal.ZonedDateTime.from(result);

      expect(arrival.timeZoneId).toBe(timeZone);
      expect(
        Temporal.Instant.compare(
          arrival.toInstant(),
          Temporal.ZonedDateTime.from(value).toInstant().add({ hours: 1 }),
        ),
      ).toBe(0);
    },
  );

  it.each`
    duration | reason
    ${"P1M"} | ${"months need a reference point"}
    ${"P1Y"} | ${"years need a reference point"}
    ${"P1W"} | ${"weeks need a reference point"}
    ${"P1Y2M3DT4H"} | ${"any calendar component refuses the whole duration"}
  `(
    "returns the sentinel for $duration ($reason)",
    ({ duration }) => {
      expect(
        transitTime("2024-06-15T10:00:00-04:00[America/New_York]", duration),
      ).toBe("");
    },
  );

  it.each`
    departure                                        | duration      | reason
    ${"2024-06-15T10:00:00"}                         | ${"PT2H"}     | ${"no zone and no offset"}
    ${"2024-06-15T10:00:00-05:00[America/New_York]"} | ${"PT2H"}     | ${"offset contradicts the zone: New York is -04:00 in June"}
    ${"2024-06-15T10:00:00Z[Not/AZone]"}             | ${"PT2H"}     | ${"bracketed zone that does not exist beside an offset"}
    ${"2024-06-15 10:00:00Z"}                        | ${"PT2H"}     | ${"space separator"}
    ${"2016-12-31T23:59:60Z"}                        | ${"PT2H"}     | ${"leap second"}
    ${"2024-06-15T10:00:00Z"}                        | ${"2 hours"}  | ${"not a duration"}
    ${"2024-06-15T10:00:00Z"}                        | ${""}         | ${"empty duration"}
    ${""}                                            | ${"PT2H"}     | ${"empty departure"}
    ${"invalid"}                                     | ${"PT2H"}     | ${"garbage departure"}
  `(
    "returns the sentinel for $departure + $duration ($reason)",
    ({ departure, duration }) => {
      expect(transitTime(departure, duration)).toBe("");
    },
  );

  // An offset-only departure keeps its offset text, including sub-minute offsets that Temporal
  // cannot use as an offset time zone (those identifiers are minute precision).
  it.each`
    departure                             | duration     | expected                              | reason
    ${"2024-06-15T10:00:00+05:30:15"}     | ${"PT1H"}    | ${"2024-06-15T11:00:00+05:30:15"}     | ${"seconds offset: 04:29:45Z + 1h read at +05:30:15"}
    ${"2024-06-15T10:00:00+05:30:00.5"}   | ${"PT1H"}    | ${"2024-06-15T11:00:00+05:30:00.5"}   | ${"fractional-second offset"}
    ${"2024-06-15T23:59:59.5-00:00:30"}   | ${"PT0.5S"}  | ${"2024-06-16T00:00:00-00:00:30"}     | ${"sub-minute negative offset across local midnight"}
    ${"2024-06-15T10:00:00-00:00"}        | ${"PT1H"}    | ${"2024-06-15T11:00:00-00:00"}        | ${"-00:00 is kept as written"}
    ${"2024-06-15T10:00:00.5+09:00"}      | ${"PT0.25S"} | ${"2024-06-15T10:00:00.75+09:00"}     | ${"fractional seconds in the wall time"}
  `(
    "keeps the offset of $departure + $duration giving $expected ($reason)",
    ({ departure, duration, expected }) => {
      expect(transitTime(departure, duration)).toBe(expected);
    },
  );

  // Temporal's instants run from -8.64e21 to 8.64e21 ns (TC39 Temporal, nsMinInstant/nsMaxInstant;
  // test262 ZonedDateTime/from/argument-string-limits.js): -271821-04-20T00:00:00Z, which is
  // 19:00 on the 19th at -05:00, to +275760-09-13T00:00:00Z, which is 10:00 +10:00 in Sydney
  // (AEST; daylight saving there starts in October).
  it.each`
    departure                                                      | duration                  | expected
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}            | ${"PT0S"}                 | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}            | ${"-PT1H"}                | ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}            | ${"-PT1H"}                | ${"+275760-09-13T08:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}            | ${"PT1H"}                 | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}            | ${"PT0.000000001S"}       | ${""}
    ${"+275760-09-13T10:00:00.000000001+10:00[Australia/Sydney]"}  | ${"-PT1H"}                | ${""}
    ${"+275760-09-13T10:00:00+10:00"}                              | ${"PT0S"}                 | ${"+275760-09-13T10:00:00+10:00"}
    ${"+275760-09-13T09:00:00+10:00"}                              | ${"PT1H"}                 | ${"+275760-09-13T10:00:00+10:00"}
    ${"-271821-04-19T19:00:00-05:00"}                              | ${"PT0S"}                 | ${"-271821-04-19T19:00:00-05:00"}
    ${"-271821-04-19T20:00:00-05:00"}                              | ${"-PT1H"}                | ${"-271821-04-19T19:00:00-05:00"}
    ${"-271821-04-19T20:00:00-05:00"}                              | ${"-PT1H0.000000001S"}    | ${""}
  `(
    "adds $duration to $departure at the range limit giving '$expected'",
    ({ departure, duration, expected }) => {
      expect(transitTime(departure, duration)).toBe(expected);
    },
  );

  it("returns the sentinel when the zoned parse throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      transitTime("2024-06-15T10:00:00-04:00[America/New_York]", "PT1H"),
    ).toBe("");
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(transitTime("2024-06-15T10:00:00Z", "PT1H")).toBe("");
  });

  it("returns the sentinel when the duration parse throws", () => {
    mockTemporalDurationFromThrow();
    expect(transitTime("2024-06-15T10:00:00Z", "PT1H")).toBe("");
  });
});
