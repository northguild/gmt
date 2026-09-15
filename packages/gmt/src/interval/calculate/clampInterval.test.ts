import type { Interval } from "../../types";
import { clampInterval } from "./clampInterval";
import { intersectIntervals } from "./intersectIntervals";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as Z(09/17).
const bounds = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };

describe("clampInterval", () => {
  it.each`
    start                          | end                            | expectedStart                  | expectedEnd                    | reason
    ${"2024-01-01T08:00:00Z"}      | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T12:00:00Z"}      | ${"trims the start"}
    ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T11:00:00Z"}      | ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T11:00:00Z"}      | ${"already inside, unchanged"}
    ${"2024-01-01T06:00:00Z"}      | ${"2024-01-01T20:00:00Z"}      | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}      | ${"covers bounds, trims both"}
    ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T18:00:00Z"}      | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T17:00:00Z"}      | ${"trims the end"}
    ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00Z"}      | ${"empty strictly inside"}
    ${"2024-01-01T04:00:00-05:00"} | ${"2024-01-01T12:00:00-05:00"} | ${"2024-01-01T04:00:00-05:00"} | ${"2024-01-01T12:00:00-05:00"} | ${"equal to bounds, different spelling: interval's"}
  `(
    "clamps [$start, $end) into bounds to [$expectedStart, $expectedEnd) ($reason)",
    ({ start, end, expectedStart, expectedEnd }) => {
      const result = clampInterval({ start, end }, bounds);

      expect(result).toEqual({ start: expectedStart, end: expectedEnd });
      expect(result?.start === expectedStart).toBe(true);
    },
  );

  it.each`
    start                     | end                       | reason
    ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T18:00:00Z"} | ${"touching"}
    ${"2024-01-01T05:00:00Z"} | ${"2024-01-01T06:00:00Z"} | ${"outside"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"empty at the edge"}
    ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${"empty at the end edge"}
  `(
    "returns null when [$start, $end) has no part inside bounds ($reason)",
    ({ start, end }) => {
      expect(clampInterval({ start, end }, bounds)).toBeNull();
    },
  );

  it("deep-equals intersectIntervals(interval, bounds) for the overlap table pairs", () => {
    const pairs: Array<[Interval, Interval]> = [
      [bounds, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }],
      [bounds, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }],
      [
        { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" },
        { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" },
      ],
      [
        bounds,
        {
          start: "2024-01-01T04:00:00-05:00",
          end: "2024-01-01T12:00:00-05:00",
        },
      ],
      [
        {
          start: "2024-01-01T04:00:00-05:00",
          end: "2024-01-01T12:00:00-05:00",
        },
        bounds,
      ],
      [
        { start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" },
        {
          start: "2024-01-01T07:00:00-05:00",
          end: "2024-01-01T07:00:00-05:00",
        },
      ],
      [
        {
          start: "2024-01-01T09:00:00-05:00[America/New_York]",
          end: "2024-01-01T18:00:00+01:00[Europe/Berlin]",
        },
        {
          start: "2024-01-01T15:00:00Z",
          end: "2024-01-02T03:00:00+09:00[Asia/Tokyo]",
        },
      ],
    ];

    for (const [interval, clampBounds] of pairs) {
      expect(clampInterval(interval, clampBounds)).toEqual(
        intersectIntervals(interval, clampBounds),
      );
    }
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${[]}
  `("returns null when $value is non-object input", ({ value }) => {
    expect(clampInterval(value as unknown as Interval, bounds)).toBeNull();
    expect(clampInterval(bounds, value as unknown as Interval)).toBeNull();
  });

  it.each`
    bad                                                                               | reason
    ${{}}                                                                             | ${"empty record"}
    ${{ start: "2024-01-01T09:00:00Z" }}                                              | ${"missing end"}
    ${{ start: 1, end: "2024-01-01T09:00:00Z" }}                                      | ${"non-string start"}
    ${{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }}                 | ${"inverted"}
    ${{ start: "2024-01-01T09:30:00Z", end: "2024-01-01T10:00:00+01:00" }}            | ${"inverted by instant, ascending as text"}
    ${{ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }}                 | ${"leap second"}
    ${{ start: "2024-01-01T09:00:00Z[u-ca=iso8601]", end: "2024-01-01T17:00:00Z" }}   | ${"calendar annotation"}
    ${{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }}                  | ${"zoneless"}
    ${{ start: "2024-01-01T09:00:00[UTC]", end: "2024-01-01T17:00:00Z" }}             | ${"bracket-only zone"}
    ${{ start: "2024-01-01", end: "2024-01-01T17:00:00Z" }}                           | ${"date only"}
    ${{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00.000000001Z" }} | ${"past the Instant range"}
  `(
    "returns null when the interval or the bounds is invalid ($reason)",
    ({ bad }) => {
      expect(clampInterval(bad, bounds)).toBeNull();
      expect(clampInterval(bounds, bad)).toBeNull();
    },
  );
});
