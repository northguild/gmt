import { Temporal } from "../../internal/temporal";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { cutoffAt } from "../calculate/cutoffAt";
import { timeToCutoff } from "./timeToCutoff";

/** The document cut-off: Wednesday 12 June 2024, 17:00 in Amsterdam (15:00Z). */
const cutoff = "2024-06-12T17:00:00+02:00[Europe/Amsterdam]";

describe("timeToCutoff", () => {
  // Exact elapsed time with hours as the largest unit, signed: derived from the UTC difference
  // and checked against Temporal.Instant#until({ largestUnit: "hours" }).
  it.each`
    now                                 | expected            | why
    ${"2024-06-10T15:00:00Z"}           | ${"PT48H"}          | ${"two days ahead"}
    ${"2024-06-12T13:30:00Z"}           | ${"PT1H30M"}        | ${"ninety minutes ahead"}
    ${"2024-06-12T15:00:00Z"}           | ${"PT0S"}           | ${"at the cut-off"}
    ${"2024-06-12T16:00:00Z"}           | ${"-PT1H"}          | ${"an hour past: negative"}
    ${"2024-06-14T15:00:00.5Z"}         | ${"-PT48H0.5S"}     | ${"two days and half a second past"}
    ${"2024-06-12T14:59:59.999999999Z"} | ${"PT0.000000001S"} | ${"one nanosecond ahead"}
    ${"2024-06-12T11:00:00-04:00"}      | ${"PT0S"}           | ${"another zone's clock, the same instant"}
  `("$why: $expected", ({ now, expected }) => {
    expect(timeToCutoff(now, cutoff)).toBe(expected);
  });

  // New York fell back on Sunday 3 November 2024: from Saturday 17:00 EDT to Sunday 17:00 EST
  // is one calendar day and 25 hours.
  it("counts exact hours across a DST transition", () => {
    expect(
      timeToCutoff(
        "2024-11-02T17:00:00-04:00",
        "2024-11-03T17:00:00-05:00[America/New_York]",
      ),
    ).toBe("PT25H");
  });

  it.each(battleTestTimeZones)(
    "gives the same duration whatever zone the zoned cut-off is written in (%s)",
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
    now                                    | deadline                                         | expected            | why
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00+00:00[UTC]"}           | ${"PT4800000000H"}  | ${"the whole instant range"}
    ${"+275760-09-13T00:00:00Z"}           | ${"-271821-04-20T00:00:00+00:00[UTC]"}           | ${"-PT4800000000H"} | ${"the whole range, reversed"}
    ${"-271821-04-20T00:00:00Z"}           | ${"-271821-04-20T00:00:00+00:00[UTC]"}           | ${"PT0S"}           | ${"the first instant against itself"}
    ${"-271821-04-19T23:59:59.999999999Z"} | ${"-271821-04-20T00:00:00+00:00[UTC]"}           | ${""}               | ${"one nanosecond before the first instant"}
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00.000000001+00:00[UTC]"} | ${""}               | ${"one nanosecond after the last instant"}
  `("$why: '$expected'", ({ now, deadline, expected }) => {
    expect(timeToCutoff(now, deadline)).toBe(expected);
  });

  it.each`
    now                       | deadline                                   | why
    ${"2024-06-12T16:00:00"}  | ${cutoff}                                  | ${"a zoneless now"}
    ${"2024-06-12T16:00:00Z"} | ${"2024-06-12T17:00"}                      | ${"a zoneless cut-off"}
    ${"2024-06-12T16:00:00Z"} | ${"2024-06-12T17:00:00[Europe/Amsterdam]"} | ${"a zoned cut-off with no offset"}
    ${"not a date"}           | ${cutoff}                                  | ${"a malformed now"}
    ${"2024-06-12T16:00:00Z"} | ${""}                                      | ${"cutoffAt's sentinel as the cut-off"}
  `("returns the sentinel for $why", ({ now, deadline }) => {
    expect(timeToCutoff(now, deadline)).toBe("");
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(timeToCutoff("2024-06-12T16:00:00Z", cutoff)).toBe("");
  });

  // `cutoffAt` writes a zoned string, so the cut-off is read through its bracket: the offset fixes
  // the instant (17:00+02:00 is 15:00Z; 01:30-05:00 in New York is 06:30Z).
  it.each`
    now                       | cutoff                                            | expected   | why
    ${"2024-06-12T14:00:00Z"} | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam]"}  | ${"PT1H"}  | ${"an hour before a zoned cut-off"}
    ${"2024-06-12T14:00:00Z"} | ${"2024-06-12T17:00:00+02:00[!Europe/Amsterdam]"} | ${"PT1H"}  | ${"an hour before a critical-zone cut-off"}
    ${"2024-11-03T05:30:00Z"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"}  | ${"PT1H"}  | ${"the second pass of a repeated hour"}
    ${"2024-11-03T06:30:00Z"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}  | ${"-PT1H"} | ${"after the first pass of a repeated hour"}
  `("reads a zoned cut-off: $why", ({ now, cutoff, expected }) => {
    expect(timeToCutoff(now, cutoff)).toBe(expected);
  });

  it.each`
    now                       | expected  | why
    ${"2024-06-12T15:00:00Z"} | ${"PT1H"} | ${"an hour before"}
    ${"2024-06-12T16:00:00Z"} | ${"PT0S"} | ${"exactly at it"}
  `(
    "reads the cut-off cutoffAt writes for an offset zone, $why",
    ({ now, expected }) => {
      const written = cutoffAt("2024-06-14T16:00:00Z", "P2D", {
        timeZone: "+02:00",
      });
      expect(written).toBe("2024-06-12T18:00:00+02:00[+02:00]");
      expect(timeToCutoff(now, written)).toBe(expected);
    },
  );

  it.each`
    now                                              | cutoff                                                         | why
    ${"2024-06-12T14:00:00Z"}                        | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam][u-ca=iso8601]"} | ${"a calendar annotation after the zone"}
    ${"2024-06-12T14:00:00Z"}                        | ${"2024-06-12T17:00:00+01:00[Europe/Amsterdam]"}               | ${"an offset the zone does not have then"}
    ${"2024-06-12T14:00:00Z"}                        | ${"2024-06-12T15:00:00Z"}                                      | ${"a bare Z instant"}
    ${"2024-06-12T14:00:00Z"}                        | ${"2024-06-12T17:00:00+02:00"}                                 | ${"a bare offset instant"}
    ${"2024-06-12T14:00:00Z"}                        | ${"2024-06-12T17:00:00+02:00[foo=bar]"}                        | ${"an elective annotation"}
    ${"2024-06-12T14:00:00Z"}                        | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam][Europe/Paris]"} | ${"a second zone"}
    ${"2024-06-12T16:00:00+02:00[Europe/Amsterdam]"} | ${"2024-06-12T15:00:00Z"}                                      | ${"a zoned now"}
  `("returns an empty string for $why", ({ now, cutoff }) => {
    expect(timeToCutoff(now, cutoff)).toBe("");
  });
});
