import { isValidUnixInterval } from "./isValidUnixInterval";

describe("isValidUnixInterval", () => {
  it.each`
    start     | end             | expected
    ${0}      | ${1700000000}   | ${true}
    ${-86400} | ${0}            | ${true}
    ${1000}   | ${2000}         | ${true}
    ${"0"}    | ${"1700000000"} | ${true}
  `(
    "returns $expected for valid Unix interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidUnixInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start   | end     | expected
    ${1000} | ${1000} | ${true}
  `(
    "returns $expected for equal Unix values $start",
    ({ start, end, expected }) => {
      expect(isValidUnixInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start         | end     | expected
    ${1700000000} | ${0}    | ${false}
    ${2000}       | ${1000} | ${false}
  `(
    "returns $expected for reversed Unix interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidUnixInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start        | end
    ${NaN}       | ${1000}
    ${Infinity}  | ${1000}
    ${-Infinity} | ${1000}
    ${1000}      | ${NaN}
    ${1000}      | ${Infinity}
    ${1000}      | ${-Infinity}
  `("returns false for non-finite Unix: $start, $end", ({ start, end }) => {
    expect(isValidUnixInterval(start, end)).toBe(false);
  });

  it.each`
    start        | end
    ${null}      | ${1000}
    ${undefined} | ${1000}
    ${"abc"}     | ${1000}
    ${1000}      | ${null}
    ${1000}      | ${undefined}
    ${1000}      | ${"abc"}
  `("returns false for non-numeric input: $start, $end", ({ start, end }) => {
    expect(isValidUnixInterval(start as never, end as never)).toBe(false);
  });
});
