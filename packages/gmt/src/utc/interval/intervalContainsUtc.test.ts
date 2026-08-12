import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalContainsUtc } from "./intervalContainsUtc";

describe("intervalContainsUtc", () => {
  it.each`
    intervalStart             | intervalEnd               | pointOrStart              | pointEnd     | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${undefined} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${undefined} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${undefined} | ${true}
    ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2023-12-01T00:00:00Z"} | ${undefined} | ${false}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2025-01-01T00:00:00Z"} | ${undefined} | ${false}
  `(
    "returns $expected for point $pointOrStart in UTC interval $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsUtc(intervalStart, intervalEnd, pointOrStart, pointEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart             | intervalEnd               | innerStart                | innerEnd                  | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-03-01T00:00:00Z"} | ${"2024-09-01T00:00:00Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${true}
    ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2023-12-01T00:00:00Z"} | ${"2024-06-15T00:00:00Z"} | ${false}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${false}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T00:00:00Z"} | ${"2024-06-10T00:00:00Z"} | ${false}
  `(
    "returns $expected for inner interval $innerStart to $innerEnd inside $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsUtc(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart             | intervalEnd               | pointOrStart              | pointEnd                  | expected
    ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined}              | ${false}
    ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-07-15T12:00:00Z"} | ${false}
    ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-10T12:00:00Z"} | ${false}
  `(
    "returns $expected for reversed outer interval",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsUtc(intervalStart, intervalEnd, pointOrStart, pointEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart             | intervalEnd               | innerStart                | innerEnd                  | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-10T12:00:00Z"} | ${false}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-07-01T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${false}
  `(
    "returns $expected for reversed inner interval",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsUtc(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart             | intervalEnd               | pointOrStart
    ${"invalid"}              | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"}
    ${""}                     | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"}
    ${"2024-13-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"invalid"}              | ${"2024-06-15T12:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${""}                     | ${"2024-06-15T12:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-13-01T10:00:00Z"} | ${"2024-06-15T12:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"invalid"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${""}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"not-a-utc"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-12-31T23:59:60Z"}
  `(
    "returns false for malformed utc: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsUtc(
          intervalStart,
          intervalEnd,
          pointOrStart,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart             | intervalEnd               | pointOrStart              | pointEnd
    ${null}                   | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${undefined}              | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${123}                    | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${true}                   | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${[]}                     | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${{}}                     | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${null}                   | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${undefined}              | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${123}                    | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${true}                   | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${[]}                     | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${{}}                     | ${"2024-06-15T12:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${null}                   | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${undefined}              | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${123}                    | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${true}                   | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${[]}                     | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${{}}                     | ${undefined}
  `(
    "returns false for non-string input: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsUtc(
          intervalStart as never,
          intervalEnd as never,
          pointOrStart as never,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart             | intervalEnd               | innerStart                | innerEnd
    ${null}                   | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-07-15T12:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${null}                   | ${"2024-06-15T12:00:00Z"} | ${"2024-07-15T12:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${null}                   | ${"2024-07-15T12:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-06-15T12:00:00Z"} | ${null}
  `(
    "returns false for non-string 4-arg input",
    ({ intervalStart, intervalEnd, innerStart, innerEnd }) => {
      expect(
        intervalContainsUtc(
          intervalStart as never,
          intervalEnd as never,
          innerStart as never,
          innerEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalContainsUtc(
        "2024-01-01T00:00:00Z",
        "2024-12-31T23:59:59Z",
        "2024-06-15T12:00:00Z",
      ),
    ).toBe(false);
  });
});
