import { maxUnix } from "./maxUnix";

describe("maxUnix", () => {
  it.each`
    unixValues                  | expected
    ${[1704067200, 1735689599]} | ${1735689599}
    ${[1735689599, 1704067200]} | ${1735689599}
  `(
    "returns $expected for unixValues $unixValues",
    ({ unixValues, expected }) => {
      expect(maxUnix(unixValues)).toBe(expected);
    },
  );

  it.each`
    unixValues              | expected
    ${[]}                   | ${null}
    ${[NaN]}                | ${null}
    ${[NaN, 1704067200]}    | ${1704067200}
    ${[Infinity, Infinity]} | ${null}
  `(
    "returns $expected for edge case: $unixValues",
    ({ unixValues, expected }) => {
      expect(maxUnix(unixValues)).toBe(expected);
    },
  );
});

describe("maxUnix drops values that are not unix epochs", () => {
  // A unix epoch is an integer (isValidUnixMilliseconds / isValidUnixSeconds) naming a
  // Temporal.Instant: |ms| <= 8.64e15 (nsMaxInstant = 10^8 days). With no epochUnit the widest
  // (milliseconds) range applies, which contains the seconds range.
  it.each`
    unixValues                    | expected                 | reason
    ${[1, 1e20]}                  | ${1}                     | ${"1e20 is past the instant range"}
    ${[1, 8_640_000_000_000_001]} | ${1}                     | ${"one past the maximum instant"}
    ${[1, 8_640_000_000_000_000]} | ${8_640_000_000_000_000} | ${"the maximum instant is inclusive"}
    ${[1, 2.5]}                   | ${1}                     | ${"a fraction is not an epoch"}
    ${[1, Infinity]}              | ${1}                     | ${"Infinity is not an epoch"}
    ${[1, "5"]}                   | ${1}                     | ${"a string is not a number epoch"}
    ${[1.5, 1e20, -Infinity]}     | ${null}                  | ${"no valid epoch remains"}
  `(
    "returns $expected for $unixValues ($reason)",
    ({ unixValues, expected }) => {
      expect(maxUnix(unixValues)).toBe(expected);
    },
  );
});

describe("maxUnix never throws on a long list", () => {
  // Spreading 200,000 arguments into Math.max overflows V8's call stack (RangeError). The list
  // 0..199,999 holds valid epochs, so the answer is its largest element.
  it("returns 199,999 for the 200,000 epochs 0..199,999", () => {
    const unixValues = Array.from({ length: 200_000 }, (_, index) => index);
    expect(maxUnix(unixValues)).toBe(199_999);
  });
});
