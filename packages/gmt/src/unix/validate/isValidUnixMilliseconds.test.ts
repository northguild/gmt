import { isValidUnixMilliseconds } from "./isValidUnixMilliseconds";

describe("isValidUnixMilliseconds", () => {
  it.each`
    value
    ${1709164800000}
    ${0}
    ${9999999999999}
  `("returns true for valid unix milliseconds $value", ({ value }) => {
    expect(isValidUnixMilliseconds(value)).toBe(true);
  });

  it.each`
    value
    ${-1}
    ${1.5}
    ${null}
    ${undefined}
    ${"1709164800000"}
    ${"not-a-timestamp"}
  `("returns false for invalid unix milliseconds $value", ({ value }) => {
    expect(isValidUnixMilliseconds(value as never)).toBe(false);
  });
});
