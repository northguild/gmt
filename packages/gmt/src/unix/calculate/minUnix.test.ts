import { minUnix } from "./minUnix";

describe("minUnix", () => {
  it.each`
    unixValues                  | expected
    ${[1704067200, 1735689599]} | ${1704067200}
    ${[1735689599, 1704067200]} | ${1704067200}
  `(
    "returns $expected for unixValues $unixValues",
    ({ unixValues, expected }) => {
      expect(minUnix(unixValues)).toBe(expected);
    },
  );

  it.each`
    unixValues           | expected
    ${[]}                | ${null}
    ${[NaN]}             | ${null}
    ${[NaN, 1704067200]} | ${1704067200}
  `(
    "returns $expected for edge case: $unixValues",
    ({ unixValues, expected }) => {
      expect(minUnix(unixValues)).toBe(expected);
    },
  );
});

describe("minUnix drops values that are not unix epochs", () => {
  // A unix epoch is an integer (isValidUnixMilliseconds / isValidUnixSeconds) naming a
  // Temporal.Instant: |ms| <= 8.64e15 (nsMinInstant = -10^8 days). With no epochUnit the widest
  // (milliseconds) range applies, which contains the seconds range.
  it.each`
    unixValues                     | expected                  | reason
    ${[1.5, 2]}                    | ${2}                      | ${"a fraction is not an epoch"}
    ${[0, -1e20]}                  | ${0}                      | ${"-1e20 is past the instant range"}
    ${[0, -8_640_000_000_000_001]} | ${0}                      | ${"one past the minimum instant"}
    ${[0, -8_640_000_000_000_000]} | ${-8_640_000_000_000_000} | ${"the minimum instant is inclusive"}
    ${[0, -Infinity]}              | ${0}                      | ${"-Infinity is not an epoch"}
    ${[3, "-5"]}                   | ${-5}                     | ${"a digit string is an epoch, returned as a number"}
    ${[3, "+1"]}                   | ${3}                      | ${"a plus sign is not an epoch"}
    ${[1.5, -1e20, Infinity]}      | ${null}                   | ${"no valid epoch remains"}
  `(
    "returns $expected for $unixValues ($reason)",
    ({ unixValues, expected }) => {
      expect(minUnix(unixValues)).toBe(expected);
    },
  );
});

describe("minUnix never throws on a long list", () => {
  // Spreading 200,000 arguments into Math.min overflows V8's call stack (RangeError). The list
  // 0..199,999 holds valid epochs, so the answer is its smallest element.
  it("returns 0 for the 200,000 epochs 0..199,999", () => {
    const unixValues = Array.from({ length: 200_000 }, (_, index) => index);
    expect(minUnix(unixValues)).toBe(0);
  });
});
