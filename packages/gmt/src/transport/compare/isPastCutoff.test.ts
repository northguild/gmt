import { Temporal } from "../../internal/temporal";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { cutoffAt } from "../calculate/cutoffAt";
import { isPastCutoff } from "./isPastCutoff";

/** The document cut-off: Wednesday 12 June 2024, 17:00 in Amsterdam (15:00Z). */
const cutoff = "2024-06-12T17:00:00+02:00[Europe/Amsterdam]";

describe("isPastCutoff", () => {
  // The window to meet a cut-off is half-open, [.., cutoff): at the cut-off itself it has closed.
  it.each`
    now                                 | expected | why
    ${"2024-06-12T14:59:59.999999999Z"} | ${false} | ${"one nanosecond before"}
    ${"2024-06-12T15:00:00Z"}           | ${true}  | ${"exactly at the cut-off, the window has closed"}
    ${"2024-06-12T15:00:00.000000001Z"} | ${true}  | ${"one nanosecond after"}
    ${"2024-06-11T15:00:00Z"}           | ${false} | ${"a day before"}
    ${"2024-06-12T11:00:00-04:00"}      | ${true}  | ${"another zone's clock, the same instant"}
    ${"2024-06-12T16:30:00+02:00"}      | ${false} | ${"an offset with no zone"}
  `("$why: $expected", ({ now, expected }) => {
    expect(isPastCutoff(now, cutoff)).toBe(expected);
  });

  it.each(battleTestTimeZones)(
    "compares instants, not wall clocks, when the zoned cut-off is written in %s",
    (timeZone) => {
      const local = Temporal.Instant.from("2024-06-12T15:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(isPastCutoff("2024-06-12T14:00:00Z", local)).toBe(false);
      expect(isPastCutoff("2024-06-12T16:00:00Z", local)).toBe(true);
    },
  );

  // Both passes of the repeated 01:30 on 3 November 2024 in New York: the offset picks one.
  it("tells the two passes of a repeated hour apart", () => {
    const firstPass = "2024-11-03T01:30:00-04:00[America/New_York]";
    const secondPass = "2024-11-03T01:30:00-05:00[America/New_York]";
    expect(isPastCutoff("2024-11-03T05:30:00Z", secondPass)).toBe(false);
    expect(isPastCutoff("2024-11-03T06:30:00Z", secondPass)).toBe(true);
    expect(isPastCutoff("2024-11-03T05:30:00Z", firstPass)).toBe(true);
    expect(isPastCutoff("2024-11-03T05:29:59Z", firstPass)).toBe(false);
  });

  // The instant range limits: 8.64e21 ns either side of the epoch.
  it.each`
    now                                    | deadline                               | expected | why
    ${"+275760-09-13T00:00:00Z"}           | ${"-271821-04-20T00:00:00+00:00[UTC]"} | ${true}  | ${"the last instant is past the first"}
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00+00:00[UTC]"} | ${false} | ${"the first instant is not past the last"}
    ${"-271821-04-20T00:00:00Z"}           | ${"-271821-04-20T00:00:00+00:00[UTC]"} | ${true}  | ${"the first instant against itself"}
    ${"-271821-04-19T23:59:59.999999999Z"} | ${"-271821-04-20T00:00:00+00:00[UTC]"} | ${false} | ${"one nanosecond before the first instant"}
    ${"+275760-09-13T00:00:00.000000001Z"} | ${"-271821-04-20T00:00:00+00:00[UTC]"} | ${false} | ${"one nanosecond after the last instant"}
  `("$why: $expected", ({ now, deadline, expected }) => {
    expect(isPastCutoff(now, deadline)).toBe(expected);
  });

  it.each`
    now                       | deadline                                   | why
    ${"2024-06-12T16:00:00"}  | ${cutoff}                                  | ${"a zoneless now"}
    ${"2024-06-12T16:00:00Z"} | ${"2024-06-12T17:00"}                      | ${"a zoneless cut-off"}
    ${"2024-06-12T16:00:00Z"} | ${"2024-06-12T17:00:00[Europe/Amsterdam]"} | ${"a zoned cut-off with no offset"}
    ${"not a date"}           | ${cutoff}                                  | ${"a malformed now"}
    ${"2024-06-12T16:00:00Z"} | ${""}                                      | ${"cutoffAt's sentinel as the cut-off"}
  `("returns false for $why", ({ now, deadline }) => {
    expect(isPastCutoff(now, deadline)).toBe(false);
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(isPastCutoff("2024-06-12T16:00:00Z", cutoff)).toBe(false);
  });

  // `cutoffAt` writes a zoned string, so the cut-off is read through its bracket: the offset fixes
  // the instant (17:00+02:00 is 15:00Z; 01:30-05:00 in New York is 06:30Z).
  it.each`
    now                            | deadline                                          | expected | why
    ${"2024-06-12T14:59:59Z"}      | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam]"}  | ${false} | ${"a zoned cut-off, one second before"}
    ${"2024-06-12T15:00:00Z"}      | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam]"}  | ${true}  | ${"a zoned cut-off, exactly at it"}
    ${"2024-06-12T15:00:00Z"}      | ${"2024-06-12T17:00:00+02:00[!Europe/Amsterdam]"} | ${true}  | ${"a critical zone, exactly at it"}
    ${"2024-06-12T14:59:59Z"}      | ${"2024-06-12T17:00:00+02:00[!Europe/Amsterdam]"} | ${false} | ${"a critical zone, one second before"}
    ${"2024-11-03T01:30:00-04:00"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"}  | ${false} | ${"the first pass of a repeated hour is before the second"}
    ${"2024-11-03T06:30:00Z"}      | ${"2024-11-03T01:30:00-05:00[America/New_York]"}  | ${true}  | ${"the second pass of a repeated hour, exactly at it"}
  `("reads a zoned cut-off: $why", ({ now, deadline, expected }) => {
    expect(isPastCutoff(now, deadline)).toBe(expected);
  });

  // A cut-off is zoned only: a bare instant is a different kind and is refused, even when `now`
  // is long after it.
  it.each`
    deadline                       | why
    ${"2024-06-12T15:00:00Z"}      | ${"a bare Z instant"}
    ${"2024-06-12T17:00:00+02:00"} | ${"a bare offset instant"}
  `("returns false for $why as the cut-off", ({ deadline }) => {
    expect(isPastCutoff("2024-06-13T00:00:00Z", deadline)).toBe(false);
  });

  it.each`
    deadline                                                       | why
    ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam][u-ca=iso8601]"} | ${"a calendar annotation after the zone"}
    ${"2024-06-12T17:00:00+02:00[foo=bar]"}                        | ${"an elective annotation"}
    ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam][Europe/Paris]"} | ${"a second zone"}
    ${"2024-06-12T17:00:00+01:00[Europe/Amsterdam]"}               | ${"an offset the zone does not have then"}
  `("returns false for $why", ({ deadline }) => {
    expect(isPastCutoff("2024-06-13T00:00:00Z", deadline)).toBe(false);
  });

  it.each`
    now                       | expected | why
    ${"2024-06-12T15:59:59Z"} | ${false} | ${"one second before"}
    ${"2024-06-12T16:00:00Z"} | ${true}  | ${"exactly at it"}
  `(
    "reads the cut-off cutoffAt writes for an offset zone, $why",
    ({ now, expected }) => {
      const written = cutoffAt("2024-06-14T16:00:00Z", "P2D", {
        timeZone: "+02:00",
      });
      expect(written).toBe("2024-06-12T18:00:00+02:00[+02:00]");
      expect(isPastCutoff(now, written)).toBe(expected);
    },
  );

  it("returns false for a zoned now", () => {
    expect(
      isPastCutoff("2024-06-12T18:00:00+02:00[Europe/Amsterdam]", cutoff),
    ).toBe(false);
  });
});
