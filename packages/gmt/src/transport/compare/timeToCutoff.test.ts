import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { timeToCutoff } from "./timeToCutoff";

/** The document cut-off: Wednesday 12 June 2024, 17:00 in Amsterdam (15:00Z). */
const cutoff = "2024-06-12T17:00:00+02:00[Europe/Amsterdam]";

describe("timeToCutoff", () => {
  // Exact elapsed time with hours as the largest unit, signed: derived from the UTC difference
  // and checked against Temporal.Instant#until({ largestUnit: "hours" }).
  it.each`
    now                                              | expected            | why
    ${"2024-06-10T15:00:00Z"}                        | ${"PT48H"}          | ${"two days ahead"}
    ${"2024-06-12T13:30:00Z"}                        | ${"PT1H30M"}        | ${"ninety minutes ahead"}
    ${"2024-06-12T15:00:00Z"}                        | ${"PT0S"}           | ${"at the cut-off"}
    ${"2024-06-12T16:00:00Z"}                        | ${"-PT1H"}          | ${"an hour past: negative"}
    ${"2024-06-14T15:00:00.5Z"}                      | ${"-PT48H0.5S"}     | ${"two days and half a second past"}
    ${"2024-06-12T14:59:59.999999999Z"}              | ${"PT0.000000001S"} | ${"one nanosecond ahead"}
    ${"2024-06-12T11:00:00-04:00[America/New_York]"} | ${"PT0S"}           | ${"another zone's clock, the same instant"}
  `("$why: $expected", ({ now, expected }) => {
    expect(timeToCutoff(now, cutoff)).toBe(expected);
  });

  // New York fell back on Sunday 3 November 2024: from Saturday 17:00 EDT to Sunday 17:00 EST
  // is one calendar day and 25 hours.
  it("counts exact hours across a DST transition", () => {
    expect(
      timeToCutoff(
        "2024-11-02T17:00:00-04:00[America/New_York]",
        "2024-11-03T17:00:00-05:00[America/New_York]",
      ),
    ).toBe("PT25H");
  });

  it.each(battleTestTimeZones)(
    "gives the same duration whatever zone the cut-off is written in (%s)",
    (timeZone) => {
      const local = Temporal.Instant.from("2024-06-12T15:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(timeToCutoff("2024-06-12T12:00:00Z", local)).toBe("PT3H");
    },
  );

  // The instant range limits: 8.64e21 ns either side of the epoch. The whole range is
  // 4,800,000,000 hours, which Temporal.Instant#until({ largestUnit: "hours" }) confirms, and
  // still fits Temporal.Duration's 2^53-second limit.
  it.each`
    now                                    | deadline                               | expected            | why
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00Z"}           | ${"PT4800000000H"}  | ${"the whole instant range"}
    ${"+275760-09-13T00:00:00Z"}           | ${"-271821-04-20T00:00:00Z"}           | ${"-PT4800000000H"} | ${"the whole range, reversed"}
    ${"-271821-04-20T00:00:00Z"}           | ${"-271821-04-20T00:00:00Z"}           | ${"PT0S"}           | ${"the first instant against itself"}
    ${"-271821-04-19T23:59:59.999999999Z"} | ${"-271821-04-20T00:00:00Z"}           | ${""}               | ${"one nanosecond before the first instant"}
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00.000000001Z"} | ${""}               | ${"one nanosecond after the last instant"}
  `("$why: $expected", ({ now, deadline, expected }) => {
    expect(timeToCutoff(now, deadline)).toBe(expected);
  });

  it.each`
    now                       | deadline              | why
    ${"2024-06-12T16:00:00"}  | ${cutoff}             | ${"a zoneless now"}
    ${"2024-06-12T16:00:00Z"} | ${"2024-06-12T17:00"} | ${"a zoneless cut-off"}
    ${"not a date"}           | ${cutoff}             | ${"a malformed now"}
    ${"2024-06-12T16:00:00Z"} | ${""}                 | ${"cutoffAt's sentinel as the cut-off"}
  `("returns the sentinel for $why", ({ now, deadline }) => {
    expect(timeToCutoff(now, deadline)).toBe("");
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(timeToCutoff("2024-06-12T16:00:00Z", cutoff)).toBe("");
  });
});
