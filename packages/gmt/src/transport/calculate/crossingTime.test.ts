import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  dateLineCrossingAt,
  dateLineCrossingTimeZones,
} from "../../test/timeZoneMatrix";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { crossingTime } from "./crossingTime";

/** Late evening UTC on 15 June to the small hours of 16 June: a local date change in some zones. */
const entry = "2024-06-15T22:30:00Z";
const exit = "2024-06-16T01:00:00Z";

describe("crossingTime", () => {
  // Expected values derived by hand (whole hours on one UTC day) and confirmed against plain
  // @js-temporal/polyfill: Instant.until(largestUnit "hours") and toZonedDateTimeISO(targetZone).
  it.each`
    entry                                            | exit                                 | targetZone         | duration            | enter                                         | exitLocal
    ${"2024-06-15T08:00:00Z"}                        | ${"2024-06-15T17:30:00Z"}            | ${"Europe/Berlin"} | ${"PT9H30M"}        | ${"2024-06-15T10:00:00+02:00[Europe/Berlin]"} | ${"2024-06-15T19:30:00+02:00[Europe/Berlin]"}
    ${"2024-06-15T10:00:00+09:00"}                   | ${"2024-06-15T12:00:00+09:00"}       | ${"Asia/Tokyo"}    | ${"PT2H"}           | ${"2024-06-15T10:00:00+09:00[Asia/Tokyo]"}    | ${"2024-06-15T12:00:00+09:00[Asia/Tokyo]"}
    ${"2024-06-15T10:00:00Z"}                        | ${"2024-06-15T10:00:00Z"}            | ${"Asia/Tokyo"}    | ${"PT0S"}           | ${"2024-06-15T19:00:00+09:00[Asia/Tokyo]"}    | ${"2024-06-15T19:00:00+09:00[Asia/Tokyo]"}
    ${"2024-06-15T22:30:00Z"}                        | ${"2024-06-16T01:00:00Z"}            | ${"+02:00"}        | ${"PT2H30M"}        | ${"2024-06-16T00:30:00+02:00[+02:00]"}        | ${"2024-06-16T03:00:00+02:00[+02:00]"}
    ${"2024-06-10T12:00:00Z"}                        | ${"2024-06-15T12:00:00Z"}            | ${"UTC"}           | ${"PT120H"}         | ${"2024-06-10T12:00:00+00:00[UTC]"}           | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-06-15T10:00:00Z"}                        | ${"2024-06-15T10:00:00.5Z"}          | ${"UTC"}           | ${"PT0.5S"}         | ${"2024-06-15T10:00:00+00:00[UTC]"}           | ${"2024-06-15T10:00:00.5+00:00[UTC]"}
    ${"2024-06-15T22:30:00Z[Not/AZone]"}             | ${"2024-06-16T01:00:00Z[Not/AZone]"} | ${"UTC"}           | ${"PT2H30M"}        | ${"2024-06-15T22:30:00+00:00[UTC]"}           | ${"2024-06-16T01:00:00+00:00[UTC]"}
    ${"2024-06-15T10:00:00Z"}                        | ${"2024-06-15T10:00:00.000000001Z"}  | ${"UTC"}           | ${"PT0.000000001S"} | ${"2024-06-15T10:00:00+00:00[UTC]"}           | ${"2024-06-15T10:00:00.000000001+00:00[UTC]"}
    ${"2024-06-15T10:00:00Z"}                        | ${"2024-06-15T11:00:00Z"}            | ${"asia/tokyo"}    | ${"PT1H"}           | ${"2024-06-15T19:00:00+09:00[Asia/Tokyo]"}    | ${"2024-06-15T20:00:00+09:00[Asia/Tokyo]"}
    ${"2024-06-15T10:00:00-05:00[America/New_York]"} | ${"2024-06-15T16:00:00Z"}            | ${"UTC"}           | ${"PT1H"}           | ${"2024-06-15T15:00:00+00:00[UTC]"}           | ${"2024-06-15T16:00:00+00:00[UTC]"}
  `(
    "measures $duration from $entry to $exit rendered in $targetZone",
    ({ entry, exit, targetZone, duration, enter, exitLocal }) => {
      expect(crossingTime(entry, exit, targetZone)).toEqual({
        duration,
        enter,
        exit: exitLocal,
      });
    },
  );

  // Two real brackets, neither of them the target: 19:00+09:00 is 10:00Z and 14:00+02:00 is
  // 12:00Z, rendered in New York (-04:00 in June). The brackets name the zones the inputs were
  // logged in; the target zone alone renders the result.
  it("renders ends logged in two other real zones in the target zone only", () => {
    expect(
      crossingTime(
        "2024-06-15T19:00:00+09:00[Asia/Tokyo]",
        "2024-06-15T14:00:00+02:00[Europe/Berlin]",
        "America/New_York",
      ),
    ).toEqual({
      duration: "PT2H",
      enter: "2024-06-15T06:00:00-04:00[America/New_York]",
      exit: "2024-06-15T08:00:00-04:00[America/New_York]",
    });
  });

  it.each(battleTestTimeZones)(
    "renders the same 2h30m crossing on %s's own clock",
    (timeZone) => {
      expect(crossingTime(entry, exit, timeZone)).toEqual({
        duration: "PT2H30M",
        enter: Temporal.Instant.from(entry)
          .toZonedDateTimeISO(timeZone)
          .toString(),
        exit: Temporal.Instant.from(exit)
          .toZonedDateTimeISO(timeZone)
          .toString(),
      });
    },
  );

  // The 1844 date-line crossings: 24 elapsed hours from local 30 December straight to
  // 1 January — the 31st never happened. `dateLineCrossingAt` builds both ends from exact time.
  it.each(dateLineCrossingTimeZones)(
    "crosses the deleted 1844-12-31 in $timeZone: PT24H, 30 Dec noon to 1 Jan noon",
    (crossing) => {
      const enter = dateLineCrossingAt(crossing, -12);
      const leave = dateLineCrossingAt(crossing, 12);
      expect(enter.toString().startsWith("1844-12-30T12:00:00")).toBe(true);
      expect(leave.toString().startsWith("1845-01-01T12:00:00")).toBe(true);
      expect(
        crossingTime(
          enter.toInstant().toString(),
          leave.toInstant().toString(),
          crossing.timeZone,
        ),
      ).toEqual({
        duration: "PT24H",
        enter: enter.toString(),
        exit: leave.toString(),
      });
    },
  );

  // Exact elapsed time across the New York transitions; on the fall-back night both ends read
  // 01:30 and only the offsets tell them apart.
  it.each`
    entry                     | exit                      | duration  | enter                                            | exitLocal                                        | transition
    ${"2024-03-10T05:00:00Z"} | ${"2024-03-10T12:00:00Z"} | ${"PT7H"} | ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${"2024-03-10T08:00:00-04:00[America/New_York]"} | ${"spring forward: midnight to 08:00 local is seven hours"}
    ${"2024-11-03T04:00:00Z"} | ${"2024-11-03T13:00:00Z"} | ${"PT9H"} | ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${"2024-11-03T08:00:00-05:00[America/New_York]"} | ${"fall back: midnight to 08:00 local is nine hours"}
    ${"2024-11-03T05:30:00Z"} | ${"2024-11-03T06:30:00Z"} | ${"PT1H"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"repeated hour: both ends read 01:30, offsets differ"}
  `(
    "reports exact elapsed time across the $transition",
    ({ entry, exit, duration, enter, exitLocal }) => {
      expect(crossingTime(entry, exit, "America/New_York")).toEqual({
        duration,
        enter,
        exit: exitLocal,
      });
    },
  );

  it.each`
    entry                     | exit                      | targetZone          | reason
    ${123}                    | ${"2024-06-16T01:00:00Z"} | ${"Europe/London"}  | ${"entry is non-string input"}
    ${"2024-06-15T22:30:00Z"} | ${123}                    | ${"Europe/London"}  | ${"exit is non-string input"}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00Z"} | ${123}              | ${"targetZone is non-string input"}
    ${"2024-06-16T01:00:00Z"} | ${"2024-06-15T22:30:00Z"} | ${"Europe/London"}  | ${"exit before entry"}
    ${"2024-06-15T22:30:00"}  | ${"2024-06-16T01:00:00Z"} | ${"Europe/London"}  | ${"entry has no offset designator"}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00"}  | ${"Europe/London"}  | ${"exit has no offset designator"}
    ${"2016-12-31T23:59:60Z"} | ${"2017-01-01T01:00:00Z"} | ${"Europe/London"}  | ${"leap second"}
    ${""}                     | ${"2024-06-16T01:00:00Z"} | ${"Europe/London"}  | ${"empty entry"}
    ${"2024-06-15T22:30:00Z"} | ${"invalid"}              | ${"Europe/London"}  | ${"garbage exit"}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00Z"} | ${"Europe/Londres"} | ${"targetZone does not exist"}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00Z"} | ${""}               | ${"empty targetZone"}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00Z"} | ${undefined}        | ${"targetZone omitted: it is always the rendering zone"}
  `("returns the sentinel when $reason", ({ entry, exit, targetZone }) => {
    expect(crossingTime(entry, exit, targetZone)).toBeNull();
  });

  // Temporal's instant range: nsMaxInstant is +275760-09-13T00:00:00Z and nsMinInstant is
  // -271821-04-20T00:00:00Z (TC39); one nanosecond past either is not an instant.
  it.each`
    entry                                  | exit                                   | expected
    ${"+275760-09-12T23:30:00Z"}           | ${"+275760-09-13T00:00:00Z"}           | ${{ duration: "PT30M", enter: "+275760-09-12T23:30:00+00:00[UTC]", exit: "+275760-09-13T00:00:00+00:00[UTC]" }}
    ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-13T00:00:00Z"}           | ${{ duration: "PT0S", enter: "+275760-09-13T00:00:00+00:00[UTC]", exit: "+275760-09-13T00:00:00+00:00[UTC]" }}
    ${"-271821-04-20T00:00:00Z"}           | ${"-271821-04-20T00:00:00Z"}           | ${{ duration: "PT0S", enter: "-271821-04-20T00:00:00+00:00[UTC]", exit: "-271821-04-20T00:00:00+00:00[UTC]" }}
    ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-13T00:00:00.000000001Z"} | ${null}
    ${"+275760-09-13T00:00:00.000000001Z"} | ${"+275760-09-13T00:00:00.000000001Z"} | ${null}
    ${"-271821-04-19T23:59:59.999999999Z"} | ${"-271821-04-20T00:00:00Z"}           | ${null}
  `(
    "measures $entry to $exit at the instant range limits (UTC)",
    ({ entry, exit, expected }) => {
      expect(crossingTime(entry, exit, "UTC")).toEqual(expected);
    },
  );

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(crossingTime(entry, exit, "Europe/London")).toBeNull();
  });
});
