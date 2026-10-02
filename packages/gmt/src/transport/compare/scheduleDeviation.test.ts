import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { scheduleDeviation } from "./scheduleDeviation";

/** The plan every row measures against: 10:00Z on Saturday 15 June 2024. */
const planned = "2024-06-15T10:00:00Z";

describe("scheduleDeviation", () => {
  // actual − planned in exact time, hours as the largest unit, positive when late. Derived from
  // the UTC difference and checked against Temporal.Instant#until({ largestUnit: "hours" }).
  it.each`
    actual                                           | expected            | why
    ${"2024-06-15T10:14:00Z"}                        | ${"PT14M"}          | ${"a 14-minute late arrival"}
    ${"2024-06-15T09:55:00Z"}                        | ${"-PT5M"}          | ${"a 5-minute early arrival is negative"}
    ${"2024-06-15T10:00:00Z"}                        | ${"PT0S"}           | ${"exactly on the plan"}
    ${"2024-06-15T10:00:00.000000001Z"}              | ${"PT0.000000001S"} | ${"one nanosecond late: nanosecond precision is kept"}
    ${"2024-06-17T11:30:00.5Z"}                      | ${"PT49H30M0.5S"}   | ${"two days late: hours, never days"}
    ${"2024-06-15T12:14:00+02:00[Europe/Amsterdam]"} | ${"PT14M"}          | ${"another zone's clock, the same instant"}
    ${"2024-06-15T19:14:00+09:00"}                   | ${"PT14M"}          | ${"an offset instant"}
    ${"2024-06-15T15:44:15+05:30:15"}                | ${"PT14M"}          | ${"a sub-minute offset instant (10:14:00Z)"}
    ${"2024-06-15T10:14:00Z[Not/AZone]"}             | ${"PT14M"}          | ${"a bracket is never read, so an unknown zone changes nothing"}
  `(
    "measures $actual against the plan as $expected ($why)",
    ({ actual, expected }) => {
      expect(scheduleDeviation(planned, actual)).toBe(expected);
    },
  );

  // New York fell back at 02:00 EDT on 3 November 2024 and sprang forward at 02:00 EST on
  // 10 March 2024. A wall-clock subtraction reads 0 and 2 hours; the elapsed time is one hour.
  it.each`
    plan                                             | actual                                           | expected   | transition
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"PT1H"}  | ${"fall-back: the same wall time an hour later"}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"-PT1H"} | ${"fall-back reversed: an hour early"}
    ${"2024-03-10T01:30:00-05:00[America/New_York]"} | ${"2024-03-10T03:30:00-04:00[America/New_York]"} | ${"PT1H"}  | ${"spring-forward: two wall hours apart, one elapsed"}
  `(
    "measures a delay across the $transition as exact elapsed time",
    ({ plan, actual, expected }) => {
      expect(scheduleDeviation(plan, actual)).toBe(expected);
    },
  );

  it.each(battleTestTimeZones)(
    "gives the same deviation whatever zone the plan is written in (%s)",
    (timeZone) => {
      const plan = Temporal.Instant.from(planned)
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(scheduleDeviation(plan, "2024-06-15T10:14:00Z")).toBe("PT14M");
    },
  );

  // The instant range is ±8.64e21 ns: 4,800,000,000 hours end to end, which
  // Temporal.Instant#until({ largestUnit: "hours" }) confirms.
  it.each`
    plan                                   | actual                                 | expected            | why
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00Z"}           | ${"PT4800000000H"}  | ${"the whole instant range"}
    ${"+275760-09-13T00:00:00Z"}           | ${"-271821-04-20T00:00:00Z"}           | ${"-PT4800000000H"} | ${"the whole range, reversed"}
    ${"-271821-04-19T23:59:59.999999999Z"} | ${"-271821-04-20T00:00:00Z"}           | ${""}               | ${"one nanosecond before the first instant"}
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00.000000001Z"} | ${""}               | ${"one nanosecond after the last instant"}
  `(
    "returns '$expected' at the range limit ($why)",
    ({ plan, actual, expected }) => {
      expect(scheduleDeviation(plan, actual)).toBe(expected);
    },
  );

  it.each`
    plan                     | actual                                     | why
    ${"2024-06-15T10:00:00"} | ${"2024-06-15T10:14:00Z"}                  | ${"a zoneless plan is not a moment"}
    ${planned}               | ${"2024-06-15T10:14:00"}                   | ${"a zoneless actual is not a moment"}
    ${planned}               | ${"2024-06-15T06:14:00[America/New_York]"} | ${"a zoned wall time without an offset: the bracket is never read"}
    ${planned}               | ${"2024-06-15T10:14:00z"}                  | ${"a lower-case z: extended format only"}
    ${"not a date"}          | ${"2024-06-15T10:14:00Z"}                  | ${"a malformed plan"}
    ${planned}               | ${""}                                      | ${"an empty actual"}
    ${planned}               | ${"2016-12-31T23:59:60Z"}                  | ${"a leap second"}
    ${null}                  | ${planned}                                 | ${"a non-string plan"}
    ${planned}               | ${1718446440}                              | ${"a non-string actual"}
  `("returns the sentinel for $why", ({ plan, actual }) => {
    expect(scheduleDeviation(plan, actual)).toBe("");
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(scheduleDeviation(planned, "2024-06-15T10:14:00Z")).toBe("");
  });
});
