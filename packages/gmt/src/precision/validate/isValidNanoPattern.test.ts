import { formatNanoseconds } from "../format/formatNanoseconds";
import { parseNanoseconds } from "../parse/parseNanoseconds";
import { isValidNanoPattern } from "./isValidNanoPattern";

describe("isValidNanoPattern", () => {
  it.each`
    value                        | reason
    ${"1710072000123456789"}     | ${"a modern instant"}
    ${"0"}                       | ${"the epoch, where parseNanoseconds returns 0n"}
    ${"-1000000000"}             | ${"pre-epoch"}
    ${"8640000000000000000000"}  | ${"the maximum"}
    ${"-8640000000000000000000"} | ${"the minimum"}
  `("returns true for $value ($reason)", ({ value }) => {
    expect(isValidNanoPattern(value)).toBe(true);
  });

  it.each`
    value                        | reason
    ${"01"}                      | ${"leading zero"}
    ${"+1"}                      | ${"explicit plus sign"}
    ${"1.5"}                     | ${"fraction"}
    ${"1e18"}                    | ${"exponent"}
    ${"0x10"}                    | ${"hex"}
    ${"1_000"}                   | ${"digit separator"}
    ${" 1"}                      | ${"leading whitespace"}
    ${"1 "}                      | ${"trailing whitespace"}
    ${'"123"'}                   | ${"JSON text rather than the string value"}
    ${"8640000000000000000001"}  | ${"one past the maximum"}
    ${"-8640000000000000000001"} | ${"one before the minimum"}
    ${"1".repeat(400)}           | ${"absurdly long, rejected before BigInt"}
    ${"garbage"}                 | ${"not a number"}
    ${""}                        | ${"empty string"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(isValidNanoPattern(value)).toBe(false);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns false when $value is non-string input", ({ value }) => {
    expect(isValidNanoPattern(value as unknown as string)).toBe(false);
  });

  it('accepts "-0", because parseNanoseconds does — the two must never disagree', () => {
    // Not what formatNanoseconds emits for 0n (that is "0"), but the grammar admits it and
    // BigInt has no negative zero, so it round-trips to the same value. The validator's
    // contract is "accepts exactly what parseNanoseconds parses", not "is canonical".
    expect(isValidNanoPattern("-0")).toBe(true);
    expect(parseNanoseconds("-0")).toBe(0n);
    expect(formatNanoseconds(0n)).toBe("0");
  });

  it("is the predicate that disambiguates parseNanoseconds' 0n", () => {
    expect(isValidNanoPattern("0")).toBe(true);
    expect(parseNanoseconds("0")).toBe(0n);

    expect(isValidNanoPattern("garbage")).toBe(false);
    expect(parseNanoseconds("garbage")).toBe(0n);
  });

  it.each`
    value
    ${0n}
    ${1710072000123456789n}
    ${-1000000000n}
    ${8640000000000000000000n}
  `("accepts everything formatNanoseconds emits, for $value", ({ value }) => {
    const formatted = formatNanoseconds(value);

    expect(isValidNanoPattern(formatted)).toBe(true);
    expect(parseNanoseconds(formatted)).toBe(value);
  });
});
