import { isBetweenUtc } from "./isBetweenUtc";

describe("isBetweenUtc", () => {
  it.each`
    value                     | start                     | end                       | expected
    ${"2024-03-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${true}
    ${"2024-05-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${true}
    ${"2023-12-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${false}
  `(
    "returns $expected for value $value between $start and $end",
    ({ value, start, end, expected }) => {
      expect(isBetweenUtc(value, start, end)).toBe(expected);
    },
  );

  it.each`
    value                     | start                     | end                       | inclusiveStart | inclusiveEnd | expected
    ${"2024-02-01T12:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${false}       | ${true}      | ${true}
    ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${false}       | ${true}      | ${true}
    ${"2024-04-01T12:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-02-28T23:59:59Z"} | ${true}        | ${false}     | ${false}
    ${"2024-02-15T12:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${false}       | ${false}     | ${true}
    ${"2024-03-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"} | ${false}       | ${false}     | ${true}
  `(
    "supports inclusive options for value $value between $start and $end",
    ({ value, start, end, inclusiveStart, inclusiveEnd, expected }) => {
      expect(
        isBetweenUtc(value, start, end, { inclusiveStart, inclusiveEnd }),
      ).toBe(expected);
    },
  );

  it.each`
    value                     | start                     | end
    ${"invalid"}              | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"}
    ${"2024-03-01T00:00:00Z"} | ${"invalid"}              | ${"2024-05-01T00:00:00Z"}
    ${"2024-03-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"invalid"}
    ${""}                     | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"}
    ${null}                   | ${"2024-01-01T00:00:00Z"} | ${"2024-05-01T00:00:00Z"}
  `(
    "returns false for invalid inputs: $value | $start | $end",
    ({ value, start, end }) => {
      expect(isBetweenUtc(value as never, start as never, end as never)).toBe(
        false,
      );
    },
  );

  it("returns false when start is after end", () => {
    expect(
      isBetweenUtc(
        "2024-03-01T00:00:00Z",
        "2024-05-01T00:00:00Z",
        "2024-01-01T00:00:00Z",
      ),
    ).toBe(false);
  });
});
