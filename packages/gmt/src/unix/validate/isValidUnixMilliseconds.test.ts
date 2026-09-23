import { isValidUnixMilliseconds } from "./isValidUnixMilliseconds";

describe("isValidUnixMilliseconds", () => {
  // Temporal nsMaxInstant is 10^8 days = 8.64e15 milliseconds either side of the epoch.
  it.each`
    value                     | reason
    ${1704067200000}          | ${"2024-01-01"}
    ${0}                      | ${"the epoch"}
    ${-86400000}              | ${"1969-12-31"}
    ${"1704067200000"}        | ${"a digit string"}
    ${"-86400000"}            | ${"a negative digit string"}
    ${8_640_000_000_000_000}  | ${"the last Temporal instant"}
    ${-8_640_000_000_000_000} | ${"the first Temporal instant"}
  `("returns true for $value ($reason)", ({ value }) => {
    expect(isValidUnixMilliseconds(value)).toBe(true);
  });

  it.each`
    value                     | reason
    ${1.5}                    | ${"a fraction"}
    ${8_640_000_000_000_001}  | ${"one millisecond past the last instant"}
    ${-8_640_000_000_000_001} | ${"one millisecond before the first instant"}
    ${2 ** 53}                | ${"not a safe integer"}
    ${Infinity}               | ${"Infinity"}
    ${"1704067200000.0"}      | ${"a decimal string"}
    ${"1704067200000 "}       | ${"a padded string"}
    ${"0x10"}                 | ${"a hex string"}
    ${""}                     | ${"an empty string"}
    ${"not-a-timestamp"}      | ${"a non-numeric string"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${true}                   | ${"a boolean"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(isValidUnixMilliseconds(value as never)).toBe(false);
  });
});
