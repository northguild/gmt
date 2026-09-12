import { isValidFiscalPattern } from "./isValidFiscalPattern";

describe("isValidFiscalPattern", () => {
  it.each`
    pattern
    ${"4-5-4"}
    ${"4-4-5"}
    ${"5-4-4"}
  `("returns true for valid fiscal pattern: $pattern", ({ pattern }) => {
    expect(isValidFiscalPattern(pattern)).toBe(true);
  });

  it.each`
    invalidPattern | reason
    ${"4-5-5"}     | ${"the shape a 53-week year's last quarter takes, not a pattern"}
    ${"5-5-4"}     | ${"not one of the three documented shapes"}
    ${"454"}       | ${"no separators"}
    ${"4-5-4 "}    | ${"trailing whitespace"}
    ${"4–5–4"}     | ${"en dashes, not hyphens"}
    ${"invalid"}   | ${"not a pattern at all"}
    ${""}          | ${"empty string"}
  `(
    "returns false for invalid fiscal pattern: $invalidPattern ($reason)",
    ({ invalidPattern }) => {
      expect(isValidFiscalPattern(invalidPattern)).toBe(false);
    },
  );

  it.each`
    nonString
    ${454}
    ${0}
    ${true}
    ${false}
    ${null}
    ${undefined}
    ${["4-5-4"]}
    ${{ pattern: "4-5-4" }}
  `("returns false when $nonString is non-string", ({ nonString }) => {
    expect(isValidFiscalPattern(nonString)).toBe(false);
  });
});
