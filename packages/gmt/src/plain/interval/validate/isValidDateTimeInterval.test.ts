import { isValidDateTimeInterval } from "./isValidDateTimeInterval";

describe("isValidDateTimeInterval", () => {
  it.each`
    start                    | end                      | expected
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${true}
    ${"2024-01-01T00:00:00"} | ${"2024-06-15T12:30:45"} | ${true}
    ${"2000-01-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${true}
  `(
    "returns $expected for valid datetime interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidDateTimeInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                    | end                          | expected
    ${"2024-01-01T10:00:00"} | ${"2024-01-01T10:00:00"}     | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-01-01T10:00:00.000"} | ${true}
  `(
    "returns $expected for equal datetimes $start",
    ({ start, end, expected }) => {
      expect(isValidDateTimeInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                    | end                      | expected
    ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${false}
    ${"2024-06-15T12:30:45"} | ${"2024-01-01T00:00:00"} | ${false}
  `(
    "returns $expected for reversed datetime interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidDateTimeInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                    | end
    ${"invalid"}             | ${"2024-01-01T10:00:00"}
    ${""}                    | ${"2024-01-01T10:00:00"}
    ${"2024-13-01T10:00:00"} | ${"2024-01-01T10:00:00"}
    ${"2024-01-01T10:00:00"} | ${"invalid"}
    ${"2024-01-01T10:00:00"} | ${""}
    ${"2024-01-01T10:00:00"} | ${"2024-13-01T10:00:00"}
    ${"invalid"}             | ${"invalid"}
    ${""}                    | ${""}
  `("returns false for malformed datetime: $start, $end", ({ start, end }) => {
    expect(isValidDateTimeInterval(start, end)).toBe(false);
  });

  it.each`
    start                    | end                      | expected
    ${"2024-12-31T23:59:60"} | ${"2025-01-01T00:00:00"} | ${false}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:60"} | ${false}
  `(
    "returns $expected for leap-second input: $start vs $end",
    ({ start, end, expected }) => {
      expect(isValidDateTimeInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                    | end
    ${null}                  | ${"2024-01-01T10:00:00"}
    ${undefined}             | ${"2024-01-01T10:00:00"}
    ${123}                   | ${"2024-01-01T10:00:00"}
    ${true}                  | ${"2024-01-01T10:00:00"}
    ${[]}                    | ${"2024-01-01T10:00:00"}
    ${{}}                    | ${"2024-01-01T10:00:00"}
    ${"2024-01-01T10:00:00"} | ${null}
    ${"2024-01-01T10:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${123}
    ${"2024-01-01T10:00:00"} | ${true}
    ${"2024-01-01T10:00:00"} | ${[]}
    ${"2024-01-01T10:00:00"} | ${{}}
  `("returns false for non-string input: $start, $end", ({ start, end }) => {
    expect(isValidDateTimeInterval(start as never, end as never)).toBe(false);
  });
});
