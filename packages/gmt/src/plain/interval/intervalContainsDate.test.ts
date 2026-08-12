import { intervalContainsDate } from "./intervalContainsDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("intervalContainsDate", () => {
  it.each`
    intervalStart   | intervalEnd     | pointOrStart    | pointEnd     | expected
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-15"} | ${undefined} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${undefined} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-12-31"} | ${undefined} | ${true}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${undefined} | ${true}
    ${"2024-06-15"} | ${"2024-06-15"} | ${"2024-06-15"} | ${undefined} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2023-12-31"} | ${undefined} | ${false}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2025-01-01"} | ${undefined} | ${false}
  `(
    "returns $expected for point $pointOrStart in date interval $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsDate(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart   | intervalEnd     | innerStart      | innerEnd        | expected
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-03-01"} | ${"2024-09-01"} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-12-31"} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-12-31"} | ${"2024-12-31"} | ${true}
    ${"2024-06-15"} | ${"2024-06-15"} | ${"2024-06-15"} | ${"2024-06-15"} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2023-12-01"} | ${"2024-06-15"} | ${false}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-15"} | ${"2025-01-01"} | ${false}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-15"} | ${"2024-06-10"} | ${false}
  `(
    "returns $expected for inner interval $innerStart to $innerEnd inside $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsDate(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart   | intervalEnd     | pointOrStart    | pointEnd        | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-15"} | ${undefined}    | ${false}
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-15"} | ${"2024-07-15"} | ${false}
    ${"2024-06-15"} | ${"2024-06-15"} | ${"2024-06-15"} | ${"2024-06-10"} | ${false}
  `(
    "returns $expected for reversed outer interval",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsDate(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart   | intervalEnd     | innerStart      | innerEnd        | expected
    ${"2024-01-01"} | ${"2024-06-15"} | ${"2024-06-15"} | ${"2024-06-10"} | ${false}
    ${"2024-01-01"} | ${"2024-06-15"} | ${"2024-06-20"} | ${"2024-06-15"} | ${false}
  `(
    "returns $expected for reversed inner interval",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsDate(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart   | intervalEnd     | pointOrStart
    ${"invalid"}    | ${"2024-12-31"} | ${"2024-06-15"}
    ${""}           | ${"2024-12-31"} | ${"2024-06-15"}
    ${"2024-13-01"} | ${"2024-12-31"} | ${"2024-06-15"}
    ${"2024-01-01"} | ${"invalid"}    | ${"2024-06-15"}
    ${"2024-01-01"} | ${""}           | ${"2024-06-15"}
    ${"2024-01-01"} | ${"2024-13-01"} | ${"2024-06-15"}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"invalid"}
    ${"2024-01-01"} | ${"2024-12-31"} | ${""}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"not-a-date"}
  `(
    "returns false for malformed date: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsDate(
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
    ${null}         | ${"2024-12-31"} | ${"2024-06-15"} | ${undefined}
    ${undefined}    | ${"2024-12-31"} | ${"2024-06-15"} | ${undefined}
    ${123}          | ${"2024-12-31"} | ${"2024-06-15"} | ${undefined}
    ${true}         | ${"2024-12-31"} | ${"2024-06-15"} | ${undefined}
    ${[]}           | ${"2024-12-31"} | ${"2024-06-15"} | ${undefined}
    ${{}}           | ${"2024-12-31"} | ${"2024-06-15"} | ${undefined}
    ${"2024-01-01"} | ${null}         | ${"2024-06-15"} | ${undefined}
    ${"2024-01-01"} | ${undefined}    | ${"2024-06-15"} | ${undefined}
    ${"2024-01-01"} | ${123}          | ${"2024-06-15"} | ${undefined}
    ${"2024-01-01"} | ${true}         | ${"2024-06-15"} | ${undefined}
    ${"2024-01-01"} | ${[]}           | ${"2024-06-15"} | ${undefined}
    ${"2024-01-01"} | ${{}}           | ${"2024-06-15"} | ${undefined}
    ${"2024-01-01"} | ${"2024-12-31"} | ${null}         | ${undefined}
    ${"2024-01-01"} | ${"2024-12-31"} | ${undefined}    | ${undefined}
    ${"2024-01-01"} | ${"2024-12-31"} | ${123}          | ${undefined}
    ${"2024-01-01"} | ${"2024-12-31"} | ${true}         | ${undefined}
    ${"2024-01-01"} | ${"2024-12-31"} | ${[]}           | ${undefined}
    ${"2024-01-01"} | ${"2024-12-31"} | ${{}}           | ${undefined}
  `(
    "returns false for non-string input: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsDate(
          intervalStart as never,
          intervalEnd as never,
          pointOrStart as never,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart   | intervalEnd     | innerStart      | innerEnd
    ${null}         | ${"2024-12-31"} | ${"2024-06-15"} | ${"2024-07-15"}
    ${"2024-01-01"} | ${null}         | ${"2024-06-15"} | ${"2024-07-15"}
    ${"2024-01-01"} | ${"2024-12-31"} | ${null}         | ${"2024-07-15"}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-15"} | ${null}
  `(
    "returns false for non-string 4-arg input",
    ({ intervalStart, intervalEnd, innerStart, innerEnd }) => {
      expect(
        intervalContainsDate(
          intervalStart as never,
          intervalEnd as never,
          innerStart as never,
          innerEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15")).toBe(
      false,
    );
  });
});
