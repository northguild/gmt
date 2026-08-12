import { isValidTimeInterval } from "./isValidTimeInterval";

describe("isValidTimeInterval", () => {
  it.each`
    start         | end           | expected
    ${"09:00:00"} | ${"17:00:00"} | ${true}
    ${"00:00:00"} | ${"23:59:59"} | ${true}
    ${"12:00:00"} | ${"12:01:00"} | ${true}
  `(
    "returns $expected for valid time interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidTimeInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start         | end           | expected
    ${"12:00:00"} | ${"12:00:00"} | ${true}
  `("returns $expected for equal times $start", ({ start, end, expected }) => {
    expect(isValidTimeInterval(start, end)).toBe(expected);
  });

  it.each`
    start         | end           | expected
    ${"17:00:00"} | ${"09:00:00"} | ${false}
    ${"23:59:59"} | ${"00:00:00"} | ${false}
    ${"12:01:00"} | ${"12:00:00"} | ${false}
  `(
    "returns $expected for reversed time interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidTimeInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start         | end
    ${"invalid"}  | ${"12:00:00"}
    ${""}         | ${"12:00:00"}
    ${"25:00:00"} | ${"12:00:00"}
    ${"12:00:00"} | ${"invalid"}
    ${"12:00:00"} | ${""}
    ${"12:00:00"} | ${"25:00:00"}
    ${"invalid"}  | ${"invalid"}
    ${""}         | ${""}
  `("returns false for malformed time: $start, $end", ({ start, end }) => {
    expect(isValidTimeInterval(start, end)).toBe(false);
  });

  it.each`
    start         | end           | expected
    ${"23:59:60"} | ${"12:00:00"} | ${false}
    ${"12:00:00"} | ${"23:59:60"} | ${false}
  `(
    "returns $expected for leap-second input: $start vs $end",
    ({ start, end, expected }) => {
      expect(isValidTimeInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start         | end
    ${null}       | ${"12:00:00"}
    ${undefined}  | ${"12:00:00"}
    ${123}        | ${"12:00:00"}
    ${true}       | ${"12:00:00"}
    ${[]}         | ${"12:00:00"}
    ${{}}         | ${"12:00:00"}
    ${"12:00:00"} | ${null}
    ${"12:00:00"} | ${undefined}
    ${"12:00:00"} | ${123}
    ${"12:00:00"} | ${true}
    ${"12:00:00"} | ${[]}
    ${"12:00:00"} | ${{}}
  `("returns false for non-string input: $start, $end", ({ start, end }) => {
    expect(isValidTimeInterval(start as never, end as never)).toBe(false);
  });
});
