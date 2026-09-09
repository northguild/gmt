import { parseNanoseconds } from "./parseNanoseconds";
import { formatNanoseconds } from "../format/formatNanoseconds";

describe("parseNanoseconds", () => {
  it.each`
    value                        | expected
    ${"0"}                       | ${0n}
    ${"-0"}                      | ${0n}
    ${"1710072000123456789"}     | ${1710072000123456789n}
    ${"-1000000000"}             | ${-1000000000n}
    ${"-1710072000123456789"}    | ${-1710072000123456789n}
    ${"8640000000000000000000"}  | ${8640000000000000000000n}
    ${"-8640000000000000000000"} | ${-8640000000000000000000n}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseNanoseconds(value)).toBe(expected);
  });

  it.each`
    nanoseconds
    ${0n}
    ${1710072000123456789n}
    ${-1710072000123456789n}
    ${8640000000000000000000n}
    ${-8640000000000000000000n}
  `("round-trips $nanoseconds through formatNanoseconds", ({ nanoseconds }) => {
    expect(parseNanoseconds(formatNanoseconds(nanoseconds))).toBe(nanoseconds);
  });

  it("reads a value back out of a JSON payload", () => {
    const payload = JSON.stringify({
      observedAt: formatNanoseconds(1710072000123456789n),
    });

    expect(parseNanoseconds(JSON.parse(payload).observedAt)).toBe(
      1710072000123456789n,
    );
  });

  it.each`
    value                      | reason
    ${"1.5"}                   | ${"fractional"}
    ${"1710072000123456789.0"} | ${"trailing decimal point"}
    ${"1e18"}                  | ${"exponent notation"}
    ${"0x10"}                  | ${"hexadecimal"}
    ${"+1710072000123456789"}  | ${"leading plus"}
    ${"007"}                   | ${"leading zeros"}
    ${" 1710072000123456789 "} | ${"surrounding whitespace"}
    ${"1_000"}                 | ${"numeric separator"}
    ${"1,000"}                 | ${"thousands separator"}
    ${"1710072000123456789n"}  | ${"bigint literal suffix"}
    ${'"1710072000123456789"'} | ${"quoted JSON text, not the string value"}
    ${"abc"}                   | ${"not a number"}
    ${""}                      | ${"empty string"}
    ${"-"}                     | ${"sign only"}
  `("returns 0n when $value is invalid ($reason)", ({ value }) => {
    expect(parseNanoseconds(value)).toBe(0n);
  });

  it.each`
    value                          | reason
    ${"8640000000000000000001"}    | ${"past the maximum instant"}
    ${"-8640000000000000000001"}   | ${"before the minimum instant"}
    ${"1000000000000000000000000"} | ${"far beyond the representable range"}
  `("returns 0n when $value is out of range ($reason)", ({ value }) => {
    expect(parseNanoseconds(value)).toBe(0n);
  });

  it("returns 0n for a decimal string far too long to be an instant", () => {
    expect(parseNanoseconds("9".repeat(1000))).toBe(0n);
    expect(parseNanoseconds(`-${"9".repeat(1000)}`)).toBe(0n);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${1710072000123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns 0n when $value is non-string input", ({ value }) => {
    expect(parseNanoseconds(value as unknown as string)).toBe(0n);
  });
});
