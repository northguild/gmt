import { intervalContainsDateTime } from "./intervalContainsDateTime";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";

describe("intervalContainsDateTime", () => {
  it.each`
    intervalStart            | intervalEnd              | pointOrStart             | pointEnd     | expected
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${undefined} | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${undefined} | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-12-31T23:59:59"} | ${undefined} | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-01-01T10:00:00"} | ${"2024-01-01T10:00:00"} | ${undefined} | ${true}
    ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${undefined} | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2023-12-31T23:59:59"} | ${undefined} | ${false}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2025-01-01T00:00:00"} | ${undefined} | ${false}
  `(
    "returns $expected for point $pointOrStart in datetime interval $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsDateTime(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart            | intervalEnd              | innerStart               | innerEnd                 | expected
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-03-01T00:00:00"} | ${"2024-09-01T00:00:00"} | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-12-31T23:59:59"} | ${"2024-12-31T23:59:59"} | ${true}
    ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2023-12-01T00:00:00"} | ${"2024-06-15T00:00:00"} | ${false}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-06-15T00:00:00"} | ${"2025-01-01T00:00:00"} | ${false}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-06-15T00:00:00"} | ${"2024-06-10T00:00:00"} | ${false}
  `(
    "returns $expected for inner interval $innerStart to $innerEnd inside $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsDateTime(
          intervalStart,
          intervalEnd,
          innerStart,
          innerEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart            | intervalEnd              | pointOrStart             | pointEnd                 | expected
    ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-06-15T12:00:00"} | ${undefined}             | ${false}
    ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-07-15T12:00:00"} | ${false}
    ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-10T12:00:00"} | ${false}
  `(
    "returns $expected for reversed outer interval",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsDateTime(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart            | intervalEnd              | innerStart               | innerEnd                 | expected
    ${"2024-01-01T10:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-10T12:00:00"} | ${false}
    ${"2024-01-01T10:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-07-01T12:00:00"} | ${"2024-06-15T12:00:00"} | ${false}
  `(
    "returns $expected for reversed inner interval",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsDateTime(
          intervalStart,
          intervalEnd,
          innerStart,
          innerEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart            | intervalEnd              | pointOrStart
    ${"invalid"}             | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"}
    ${""}                    | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"}
    ${"2024-13-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"}
    ${"2024-01-01T10:00:00"} | ${"invalid"}             | ${"2024-06-15T12:00:00"}
    ${"2024-01-01T10:00:00"} | ${""}                    | ${"2024-06-15T12:00:00"}
    ${"2024-01-01T10:00:00"} | ${"2024-13-01T10:00:00"} | ${"2024-06-15T12:00:00"}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"invalid"}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${""}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"not-a-datetime"}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-12-31T23:59:60"}
  `(
    "returns false for malformed datetime: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsDateTime(
          intervalStart,
          intervalEnd,
          pointOrStart,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart            | intervalEnd              | pointOrStart             | pointEnd
    ${null}                  | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${undefined}
    ${undefined}             | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${undefined}
    ${123}                   | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${undefined}
    ${true}                  | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${undefined}
    ${[]}                    | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${undefined}
    ${{}}                    | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${null}                  | ${"2024-06-15T12:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${undefined}             | ${"2024-06-15T12:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${123}                   | ${"2024-06-15T12:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${true}                  | ${"2024-06-15T12:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${[]}                    | ${"2024-06-15T12:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${{}}                    | ${"2024-06-15T12:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${null}                  | ${undefined}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${undefined}             | ${undefined}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${123}                   | ${undefined}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${true}                  | ${undefined}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${[]}                    | ${undefined}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${{}}                    | ${undefined}
  `(
    "returns false for non-string input: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsDateTime(
          intervalStart as never,
          intervalEnd as never,
          pointOrStart as never,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart            | intervalEnd              | innerStart               | innerEnd
    ${null}                  | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${"2024-07-15T12:00:00"}
    ${"2024-01-01T10:00:00"} | ${null}                  | ${"2024-06-15T12:00:00"} | ${"2024-07-15T12:00:00"}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${null}                  | ${"2024-07-15T12:00:00"}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-06-15T12:00:00"} | ${null}
  `(
    "returns false for non-string 4-arg input",
    ({ intervalStart, intervalEnd, innerStart, innerEnd }) => {
      expect(
        intervalContainsDateTime(
          intervalStart as never,
          intervalEnd as never,
          innerStart as never,
          innerEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalContainsDateTime(
        "2024-01-01T10:00:00",
        "2024-12-31T23:59:59",
        "2024-06-15T12:00:00",
      ),
    ).toBe(false);
  });
});
