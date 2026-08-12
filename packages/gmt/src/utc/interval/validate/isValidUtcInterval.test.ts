import { isValidUtcInterval } from "./isValidUtcInterval";

describe("isValidUtcInterval", () => {
  it.each`
    start                     | end                       | expected
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-15T12:30:45Z"} | ${true}
    ${"2000-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${true}
  `(
    "returns $expected for valid UTC interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidUtcInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                     | end                       | expected
    ${"2024-01-01T10:00:00Z"} | ${"2024-01-01T10:00:00Z"} | ${true}
  `(
    "returns $expected for equal UTC instants $start",
    ({ start, end, expected }) => {
      expect(isValidUtcInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                     | end                       | expected
    ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T10:00:00Z"} | ${false}
    ${"2024-06-15T12:30:45Z"} | ${"2024-01-01T00:00:00Z"} | ${false}
  `(
    "returns $expected for reversed UTC interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidUtcInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                     | end
    ${"invalid"}              | ${"2024-01-01T10:00:00Z"}
    ${""}                     | ${"2024-01-01T10:00:00Z"}
    ${"2024-01-01T10:00:00"}  | ${"2024-01-01T10:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"invalid"}
    ${"2024-01-01T10:00:00Z"} | ${""}
    ${"2024-01-01T10:00:00Z"} | ${"2024-01-01T10:00:00"}
    ${"invalid"}              | ${"invalid"}
    ${""}                     | ${""}
  `("returns false for malformed UTC: $start, $end", ({ start, end }) => {
    expect(isValidUtcInterval(start, end)).toBe(false);
  });

  it.each`
    start                     | end                       | expected
    ${"2024-12-31T23:59:60Z"} | ${"2025-01-01T00:00:00Z"} | ${false}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:60Z"} | ${false}
  `(
    "returns $expected for leap-second input: $start vs $end",
    ({ start, end, expected }) => {
      expect(isValidUtcInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                     | end
    ${null}                   | ${"2024-01-01T10:00:00Z"}
    ${undefined}              | ${"2024-01-01T10:00:00Z"}
    ${123}                    | ${"2024-01-01T10:00:00Z"}
    ${true}                   | ${"2024-01-01T10:00:00Z"}
    ${[]}                     | ${"2024-01-01T10:00:00Z"}
    ${{}}                     | ${"2024-01-01T10:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${null}
    ${"2024-01-01T10:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${123}
    ${"2024-01-01T10:00:00Z"} | ${true}
    ${"2024-01-01T10:00:00Z"} | ${[]}
    ${"2024-01-01T10:00:00Z"} | ${{}}
  `("returns false for non-string input: $start, $end", ({ start, end }) => {
    expect(isValidUtcInterval(start as never, end as never)).toBe(false);
  });
});
