import { intervalContainsTime } from "./intervalContainsTime";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";

describe("intervalContainsTime", () => {
  it.each`
    intervalStart | intervalEnd   | pointOrStart  | pointEnd     | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${undefined} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${undefined} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${undefined} | ${true}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${undefined} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"08:59:59"} | ${undefined} | ${false}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:01"} | ${undefined} | ${false}
  `(
    "returns $expected for point $pointOrStart in time interval $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsTime(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd   | innerStart    | innerEnd      | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"10:00:00"} | ${"16:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${true}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"08:00:00"} | ${"12:00:00"} | ${false}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"} | ${false}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${false}
  `(
    "returns $expected for inner interval $innerStart to $innerEnd inside $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsTime(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd   | pointOrStart  | pointEnd      | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${undefined}  | ${false}
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${false}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${false}
  `(
    "returns $expected for reversed outer interval",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsTime(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd   | innerStart    | innerEnd      | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${false}
    ${"09:00:00"} | ${"17:00:00"} | ${"13:00:00"} | ${"12:00:00"} | ${false}
  `(
    "returns $expected for reversed inner interval",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsTime(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd   | pointOrStart
    ${"invalid"}  | ${"12:00:00"} | ${"12:00:00"}
    ${""}         | ${"12:00:00"} | ${"12:00:00"}
    ${"25:00:00"} | ${"12:00:00"} | ${"12:00:00"}
    ${"12:00:00"} | ${"invalid"}  | ${"12:00:00"}
    ${"12:00:00"} | ${""}         | ${"12:00:00"}
    ${"12:00:00"} | ${"25:00:00"} | ${"12:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${"invalid"}
    ${"12:00:00"} | ${"12:00:00"} | ${""}
    ${"12:00:00"} | ${"12:00:00"} | ${"25:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${"23:59:60"}
  `(
    "returns false for malformed time: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsTime(
          intervalStart,
          intervalEnd,
          pointOrStart,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart   | intervalEnd     | pointOrStart    | pointEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${false}
  `(
    "returns false for non-string input: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsTime(
          intervalStart as never,
          intervalEnd as never,
          pointOrStart as never,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart | intervalEnd   | innerStart    | innerEnd
    ${null}       | ${"12:00:00"} | ${"12:00:00"} | ${"13:00:00"}
    ${"12:00:00"} | ${null}       | ${"12:00:00"} | ${"13:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${null}       | ${"13:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${null}
  `(
    "returns false for non-string 4-arg input",
    ({ intervalStart, intervalEnd, innerStart, innerEnd }) => {
      expect(
        intervalContainsTime(
          intervalStart as never,
          intervalEnd as never,
          innerStart as never,
          innerEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(intervalContainsTime("09:00:00", "17:00:00", "12:00:00")).toBe(
      false,
    );
  });
});
