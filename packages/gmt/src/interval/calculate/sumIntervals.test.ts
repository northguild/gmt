import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalDurationFromThrow } from "../../test/mocks";
import type { Interval } from "../../types";
import { sumIntervals } from "./sumIntervals";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. Longer spans and the Instant-range limits are
// overrides needed to reach past 2^53 ns and the whole representable range.
const A = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };
const at = (time: string) => `2024-01-01T${time}Z`;
const earliest = "-271821-04-20T00:00:00Z";
const latest = "+275760-09-13T00:00:00Z";

describe("sumIntervals", () => {
  // Single intervals: each row is also asserted against Temporal's own
  // Instant.until(…, { largestUnit: "hour" }). Hand checks: Jan 1 → Jan 3 01:30 is 48 h + 1.5 h;
  // New York 2024-03-09T12:00-05:00 is 17:00Z and 2024-03-10T12:00-04:00 is 16:00Z next day, 23 h;
  // Jan 1 → Apr 15 is 31 + 29 + 31 + 14 = 105 days = 2520 h, + 8 h (9 100 800 000 000 001 ns > 2^53);
  // the Instant range is ±10^8 days, so 2 × 10^8 days = 4 800 000 000 h.
  it.each`
    start                                            | end                                              | expected                  | reason
    ${"2024-01-01T00:00:00Z"}                        | ${"2024-01-03T01:30:00Z"}                        | ${"PT49H30M"}             | ${"hours are the largest unit, no days"}
    ${"2024-01-01T00:00:00Z"}                        | ${"2024-01-02T00:00:00Z"}                        | ${"PT24H"}                | ${"one UTC day"}
    ${"2024-01-01T00:00:00Z"}                        | ${"2024-01-01T00:00:01.5Z"}                      | ${"PT1.5S"}               | ${"fractional seconds"}
    ${"2024-01-01T00:00:00Z"}                        | ${"2024-01-03T01:30:00.000000001Z"}              | ${"PT49H30M0.000000001S"} | ${"hours plus 1 ns"}
    ${at("00:00:00")}                                | ${at("00:00:00.000001")}                         | ${"PT0.000001S"}          | ${"1 microsecond"}
    ${at("00:00:00")}                                | ${at("00:01:00.01")}                             | ${"PT1M0.01S"}            | ${"minute plus centiseconds"}
    ${at("12:00:00")}                                | ${at("12:00:00")}                                | ${"PT0S"}                 | ${"only an empty interval"}
    ${"2024-03-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"PT23H"}                | ${"New York spring-forward day is elapsed time"}
    ${"2024-01-01T00:00:00Z"}                        | ${"2024-04-15T08:00:00.000000001Z"}              | ${"PT2528H0.000000001S"}  | ${"past 2^53 ns"}
    ${earliest}                                      | ${latest}                                        | ${"PT4800000000H"}        | ${"full Instant range"}
  `(
    "returns $expected for [$start, $end) ($reason) and agrees with Instant.until",
    ({ start, end, expected }) => {
      expect(sumIntervals([{ start, end }])).toBe(expected);
      expect(sumIntervals([{ start, end }])).toBe(
        Temporal.Instant.from(start)
          .until(Temporal.Instant.from(end), { largestUnit: "hour" })
          .toString(),
      );
    },
  );

  // Unions by hand (D4, length of the union): [09,13) ∪ [12,17) = [09,17) = 8 h; touching 3 h + 5 h;
  // disjoint 1 h + 1 h; 1 ns gap 3 h + (5 h − 1 ns) = 7:59:59.999999999; Jan 1 → Feb 15 is 45 days
  // and Mar 1 → Apr 30 is 60 days, 105 days = 2520 h, + 1 ns; a range plus a contained half, or two
  // touching halves, is the range itself.
  it.each`
    intervals                                                                                                                                     | expected                  | reason
    ${[]}                                                                                                                                         | ${"PT0S"}                 | ${"empty list"}
    ${[{ start: at("09:00:00"), end: at("13:00:00") }, { start: at("12:00:00"), end: at("17:00:00") }]}                                           | ${"PT8H"}                 | ${"overlap counted once"}
    ${[{ start: at("09:00:00"), end: at("12:00:00") }, { start: at("12:00:00"), end: at("17:00:00") }]}                                           | ${"PT8H"}                 | ${"touching add up"}
    ${[{ start: at("09:00:00"), end: at("10:00:00") }, { start: at("12:00:00"), end: at("13:00:00") }]}                                           | ${"PT2H"}                 | ${"disjoint"}
    ${[{ start: at("09:00:00"), end: at("12:00:00") }, { start: at("12:00:00.000000001"), end: at("17:00:00") }]}                                 | ${"PT7H59M59.999999999S"} | ${"1 ns gap"}
    ${[{ start: at("12:00:00"), end: at("12:00:00") }, { start: "2024-01-01T07:00:00-05:00", end: "2024-01-01T07:00:00-05:00" }]}                 | ${"PT0S"}                 | ${"identical empties"}
    ${[{ start: "2024-01-01T00:00:00Z", end: "2024-02-15T00:00:00Z" }, { start: "2024-03-01T00:00:00Z", end: "2024-04-30T00:00:00.000000001Z" }]} | ${"PT2520H0.000000001S"}  | ${"two disjoint, total past 2^53 ns"}
    ${[{ start: earliest, end: latest }, { start: "1970-01-01T00:00:00Z", end: latest }]}                                                         | ${"PT4800000000H"}        | ${"full range plus an overlapping half"}
    ${[{ start: earliest, end: "1970-01-01T00:00:00Z" }, { start: "1970-01-01T00:00:00Z", end: latest }]}                                         | ${"PT4800000000H"}        | ${"two touching halves of the full range"}
  `("returns $expected for $intervals ($reason)", ({ intervals, expected }) => {
    expect(sumIntervals(intervals)).toBe(expected);
  });

  it.each`
    value
    ${"x"}
    ${null}
    ${{}}
  `(
    "returns an empty string when intervals $value is not an array",
    ({ value }) => {
      expect(sumIntervals(value as unknown as Interval[])).toBe("");
    },
  );

  it.each`
    list                                                   | reason
    ${[null]}                                              | ${"null element"}
    ${[A, null]}                                           | ${"null among valid ones"}
    ${[A, { start: at("17:00:00"), end: at("09:00:00") }]} | ${"inverted element among valid ones"}
  `(
    "returns an empty string when an element is invalid ($reason)",
    ({ list }) => {
      expect(sumIntervals(list)).toBe("");
    },
  );

  it.each`
    bad                                                                               | reason
    ${{}}                                                                             | ${"empty record"}
    ${{ start: "2024-01-01T09:00:00Z" }}                                              | ${"missing end"}
    ${{ start: 1, end: "2024-01-01T09:00:00Z" }}                                      | ${"non-string start"}
    ${{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }}                 | ${"inverted"}
    ${{ start: "2024-01-01T09:30:00Z", end: "2024-01-01T10:00:00+01:00" }}            | ${"inverted by instant, ascending as text"}
    ${{ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }}                 | ${"leap second"}
    ${{ start: "2024-01-01T09:00:00Z[!foo=bar]", end: "2024-01-01T17:00:00Z" }}       | ${"unknown critical annotation"}
    ${{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }}                  | ${"zoneless"}
    ${{ start: "2024-01-01T09:00:00[UTC]", end: "2024-01-01T17:00:00Z" }}             | ${"bracket-only zone"}
    ${{ start: "2024-01-01", end: "2024-01-01T17:00:00Z" }}                           | ${"date only"}
    ${{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00.000000001Z" }} | ${"past the Instant range"}
  `(
    "returns an empty string when any element is invalid ($reason)",
    ({ bad }) => {
      expect(sumIntervals([A, bad])).toBe("");
    },
  );

  it("returns an empty string when Temporal.Duration.from throws", () => {
    mockTemporalDurationFromThrow();

    expect(sumIntervals([A])).toBe("");
  });

  // Temporal.Instant.from ignores a calendar annotation (critical or not) and an elective unknown
  // annotation (proposal-temporal ParseTemporalInstantString; RFC 9557 §3.3), so these endpoints
  // are the unannotated instants. GMT echoes the caller's text (CORE-6), annotation included.
  it("sums annotated disjoint intervals by instant: [09:00Z, 12:00Z) + [13:00Z, 17:00Z) → PT7H", () => {
    expect(
      sumIntervals([
        {
          start: "2024-01-01T09:00:00Z[u-ca=iso8601]",
          end: "2024-01-01T12:00:00Z[foo=bar]",
        },
        {
          start: "2024-01-01T13:00:00Z[!u-ca=hebrew]",
          end: "2024-01-01T17:00:00Z",
        },
      ]),
    ).toBe("PT7H");
  });
});
