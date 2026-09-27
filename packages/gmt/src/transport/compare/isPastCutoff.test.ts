import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { isPastCutoff } from "./isPastCutoff";

/** The document cut-off: Wednesday 12 June 2024, 17:00 in Amsterdam (15:00Z). */
const cutoff = "2024-06-12T17:00:00+02:00[Europe/Amsterdam]";

describe("isPastCutoff", () => {
  // The window to meet a cut-off is half-open, [.., cutoff): at the cut-off itself it has closed.
  it.each`
    now                                              | expected | why
    ${"2024-06-12T14:59:59.999999999Z"}              | ${false} | ${"one nanosecond before"}
    ${"2024-06-12T15:00:00Z"}                        | ${true}  | ${"exactly at the cut-off, the window has closed"}
    ${"2024-06-12T15:00:00.000000001Z"}              | ${true}  | ${"one nanosecond after"}
    ${"2024-06-11T15:00:00Z"}                        | ${false} | ${"a day before"}
    ${"2024-06-12T11:00:00-04:00[America/New_York]"} | ${true}  | ${"another zone's clock, the same instant"}
    ${"2024-06-12T16:30:00+02:00"}                   | ${false} | ${"an offset with no zone"}
  `("$why: $expected", ({ now, expected }) => {
    expect(isPastCutoff(now, cutoff)).toBe(expected);
  });

  it.each(battleTestTimeZones)(
    "compares instants, not wall clocks, when the cut-off is written in %s",
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
    const secondPass = "2024-11-03T01:30:00-05:00[America/New_York]";
    expect(
      isPastCutoff("2024-11-03T01:30:00-04:00[America/New_York]", secondPass),
    ).toBe(false);
    expect(
      isPastCutoff(secondPass, "2024-11-03T01:30:00-04:00[America/New_York]"),
    ).toBe(true);
  });

  it.each`
    now                       | deadline              | why
    ${"2024-06-12T16:00:00"}  | ${cutoff}             | ${"a zoneless now"}
    ${"2024-06-12T16:00:00Z"} | ${"2024-06-12T17:00"} | ${"a zoneless cut-off"}
    ${"not a date"}           | ${cutoff}             | ${"a malformed now"}
    ${"2024-06-12T16:00:00Z"} | ${""}                 | ${"cutoffAt's sentinel as the cut-off"}
  `("returns false for $why", ({ now, deadline }) => {
    expect(isPastCutoff(now, deadline)).toBe(false);
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(isPastCutoff("2024-06-12T16:00:00Z", cutoff)).toBe(false);
  });
});
