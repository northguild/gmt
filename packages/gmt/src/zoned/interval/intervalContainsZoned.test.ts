import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { intervalContainsZoned } from "./intervalContainsZoned";

describe("intervalContainsZoned", () => {
  it.each`
    intervalStart                                   | intervalEnd                                   | pointOrStart                                  | pointEnd | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-01-01T00:00:00+00:00[UTC]"}           | ${undefined} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}           | ${undefined} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-01-01T00:00:00+00:00[UTC]"}           | ${undefined} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2023-12-01T00:00:00+00:00[UTC]"}           | ${undefined} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2025-01-01T00:00:00+00:00[UTC]"}           | ${undefined} | ${false}
  `(
    "returns $expected for point $pointOrStart in zoned interval $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsZoned(intervalStart, intervalEnd, pointOrStart, pointEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                                   | intervalEnd                                   | innerStart                                    | innerEnd                                   | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-03-01T00:00:00+00:00[UTC]"}           | ${"2024-09-01T00:00:00+00:00[UTC]"}        | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-01-01T00:00:00+00:00[UTC]"}           | ${"2024-12-31T23:59:59+00:00[UTC]"}        | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}           | ${"2024-12-31T23:59:59+00:00[UTC]"}        | ${true}
    ${"2024-06-15T12:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${"2024-06-15T12:00:00+00:00[UTC]"}        | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2023-12-01T00:00:00+00:00[UTC]"}           | ${"2024-06-15T00:00:00+00:00[UTC]"}        | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T00:00:00+00:00[UTC]"}           | ${"2025-01-01T00:00:00+00:00[UTC]"}        | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T00:00:00+00:00[UTC]"}           | ${"2024-06-10T00:00:00+00:00[UTC]"}        | ${false}
  `(
    "returns $expected for inner interval $innerStart to $innerEnd inside $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsZoned(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                                   | intervalEnd                                   | pointOrStart                                  | pointEnd | expected
    ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined} | ${false}
    ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${"2024-07-15T12:00:00+00:00[UTC]"} | ${false}
    ${"2024-06-15T12:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${"2024-06-10T12:00:00+00:00[UTC]"} | ${false}
  `(
    "returns $expected for reversed outer interval",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsZoned(intervalStart, intervalEnd, pointOrStart, pointEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                                   | intervalEnd                                   | innerStart                                    | innerEnd                                   | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${"2024-06-10T12:00:00+00:00[UTC]"}        | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}            | ${"2024-07-01T12:00:00+00:00[UTC]"}           | ${"2024-06-15T12:00:00+00:00[UTC]"}        | ${false}
  `(
    "returns $expected for reversed inner interval",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsZoned(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                                   | intervalEnd                                   | pointOrStart
    ${"invalid"}                                    | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${""}                                           | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"not-a-zoned"}                                | ${"2024-06-15T12:00:00+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"invalid"}                                  | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${""}                                         | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"not-a-zoned"}                              | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"invalid"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${""}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"not-a-zoned"}
    ${"2024-12-31T23:59:60+00:00[UTC]"}            | ${"2025-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:60+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}
  `(
    "returns false for malformed zoned: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsZoned(
          intervalStart,
          intervalEnd,
          pointOrStart,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart                                   | intervalEnd                                   | pointOrStart                                  | pointEnd
    ${null}                                         | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${undefined}                                    | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${123}                                          | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${true}                                         | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${[]}                                           | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${{}}                                           | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${null}                                       | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${undefined}                                  | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${123}                                        | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${true}                                       | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${[]}                                         | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${{}}                                         | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${null}                                        | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${undefined}                                   | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${123}                                         | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${true}                                        | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${[]}                                          | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${{}}                                          | ${undefined}
  `("returns false for non-string input: $intervalStart, $intervalEnd, $pointOrStart", ({ intervalStart, intervalEnd, pointOrStart }) => {
    expect(
      intervalContainsZoned(
        intervalStart as never,
        intervalEnd as never,
        pointOrStart as never,
        undefined,
      ),
    ).toBe(false);
  });

  it.each`
    intervalStart                                   | intervalEnd                                   | innerStart                                    | innerEnd
    ${null}                                         | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${"2024-07-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${null}                                       | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${"2024-07-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${null}                                       | ${"2024-07-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}            | ${"2024-12-31T23:59:59+00:00[UTC]"}            | ${"2024-06-15T12:00:00+00:00[UTC]"}           | ${null}
  `("returns false for non-string 4-arg input", ({ intervalStart, intervalEnd, innerStart, innerEnd }) => {
    expect(
      intervalContainsZoned(
        intervalStart as never,
        intervalEnd as never,
        innerStart as never,
        innerEnd as never,
      ),
    ).toBe(false);
  });

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalContainsZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-12-31T23:59:59+00:00[UTC]",
        "2024-06-15T12:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("proves zone-invariance across sameInstantBattleCases", () => {
    const outerStart = "2024-01-01T00:00:00+00:00[UTC]";
    const outerEnd = "2024-12-31T23:59:59+00:00[UTC]";

    for (const { value: point } of sameInstantBattleCases) {
      expect(
        intervalContainsZoned(outerStart, outerEnd, point),
      ).toBe(true);
    }
  });

  it("returns true for points across a DST spring-forward gap by instant", () => {
    // America/Chicago spring-forward: 2024-03-10 02:00 -> 03:00
    // Interval spans the transition; containment is computed by instant, not wall-clock.
    const outerStart = "2024-03-09T23:00:00-06:00[America/Chicago]";
    const outerEnd = "2024-03-10T04:00:00-05:00[America/Chicago]";

    // Point before the gap (valid local time)
    expect(
      intervalContainsZoned(outerStart, outerEnd, "2024-03-10T01:00:00-06:00[America/Chicago]"),
    ).toBe(true);

    // Point at/after the gap (valid local time)
    expect(
      intervalContainsZoned(outerStart, outerEnd, "2024-03-10T04:00:00-05:00[America/Chicago]"),
    ).toBe(true);

    // Point before the interval
    expect(
      intervalContainsZoned(outerStart, outerEnd, "2024-03-09T20:00:00-06:00[America/Chicago]"),
    ).toBe(false);
  });
});
