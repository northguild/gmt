import { isValidUnixSeconds } from "./isValidUnixSeconds";

describe("isValidUnixSeconds", () => {
  // Temporal nsMaxInstant is 10^8 days = 8.64e12 seconds either side of the epoch.
  it.each`
    value                 | reason
    ${1704067200}         | ${"2024-01-01"}
    ${0}                  | ${"the epoch"}
    ${-86400}             | ${"1969-12-31"}
    ${"1704067200"}       | ${"a digit string"}
    ${"-86400"}           | ${"a negative digit string"}
    ${8_640_000_000_000}  | ${"the last Temporal instant"}
    ${-8_640_000_000_000} | ${"the first Temporal instant"}
  `("returns true for $value ($reason)", ({ value }) => {
    expect(isValidUnixSeconds(value)).toBe(true);
  });

  it.each`
    value                 | reason
    ${1.5}                | ${"a fraction"}
    ${8_640_000_000_001}  | ${"one second past the last instant"}
    ${-8_640_000_000_001} | ${"one second before the first instant"}
    ${2 ** 53}            | ${"not a safe integer"}
    ${NaN}                | ${"NaN"}
    ${"1.5"}              | ${"a decimal string"}
    ${" 1704067200"}      | ${"a padded string"}
    ${"+1704067200"}      | ${"a plus sign"}
    ${"1e9"}              | ${"exponent notation"}
    ${""}                 | ${"an empty string"}
    ${"not-a-timestamp"}  | ${"a non-numeric string"}
    ${null}               | ${"null"}
    ${undefined}          | ${"undefined"}
    ${true}               | ${"a boolean"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(isValidUnixSeconds(value as never)).toBe(false);
  });
});
