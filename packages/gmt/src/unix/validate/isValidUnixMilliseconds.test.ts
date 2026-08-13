import { isValidUnixMilliseconds } from "./isValidUnixMilliseconds";

describe("isValidUnixMilliseconds", () => {
  it.each`
    value
    ${1704067200000}
    ${1735689599000}
    ${1709164800000}
    ${0}
    ${-86400000}
    ${-31536000000}
  `("returns true for valid unix milliseconds $value", ({ value }) => {
    expect(isValidUnixMilliseconds(value)).toBe(true);
  });

  it.each`
    value
    ${1.5}
    ${null}
    ${undefined}
    ${"1704067200000"}
    ${"not-a-timestamp"}
    ${true}
  `("returns false for non-integer input $value", ({ value }) => {
    expect(isValidUnixMilliseconds(value as never)).toBe(false);
  });
});
