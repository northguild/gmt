import { isValidDateInterval } from "./isValidDateInterval";

describe("isValidDateInterval", () => {
  it.each`
    start           | end             | expected
    ${"2024-01-01"} | ${"2024-12-31"} | ${true}
    ${"2024-01-01"} | ${"2024-06-15"} | ${true}
    ${"2000-01-01"} | ${"2024-12-31"} | ${true}
  `(
    "returns $expected for valid date interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidDateInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start           | end             | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${true}
  `("returns $expected for equal dates $start", ({ start, end, expected }) => {
    expect(isValidDateInterval(start, end)).toBe(expected);
  });

  it.each`
    start           | end             | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${false}
    ${"2024-06-15"} | ${"2024-01-01"} | ${false}
  `(
    "returns $expected for reversed date interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidDateInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start           | end             | expected
    ${"invalid"}    | ${"2024-12-31"} | ${false}
    ${""}           | ${"2024-12-31"} | ${false}
    ${"2024-13-01"} | ${"2024-12-31"} | ${false}
    ${"2024-01-01"} | ${"invalid"}    | ${false}
    ${"2024-01-01"} | ${""}           | ${false}
    ${"2024-01-01"} | ${"2024-13-01"} | ${false}
    ${"invalid"}    | ${"invalid"}    | ${false}
    ${""}           | ${""}           | ${false}
  `(
    "returns false for malformed date: $start, $end",
    ({ start, end, expected }) => {
      expect(isValidDateInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                    | end                      | expected
    ${"2024-12-31T23:59:60"} | ${"2025-01-01"}          | ${false}
    ${"2024-01-01"}          | ${"2024-12-31T23:59:60"} | ${false}
  `(
    "returns $expected for leap-second input: $start vs $end",
    ({ start, end, expected }) => {
      expect(isValidDateInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start           | end
    ${null}         | ${"2024-12-31"}
    ${undefined}    | ${"2024-12-31"}
    ${123}          | ${"2024-12-31"}
    ${true}         | ${"2024-12-31"}
    ${[]}           | ${"2024-12-31"}
    ${{}}           | ${"2024-12-31"}
    ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${undefined}
    ${"2024-01-01"} | ${123}
    ${"2024-01-01"} | ${true}
    ${"2024-01-01"} | ${[]}
    ${"2024-01-01"} | ${{}}
  `("returns false for non-string input: $start, $end", ({ start, end }) => {
    expect(isValidDateInterval(start as never, end as never)).toBe(false);
  });
});
