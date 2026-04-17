import { isValidUnixSeconds } from "./isValidUnixSeconds";

describe("isValidUnixSeconds", () => {
  it.each`
    value
    ${1709164800}
    ${0}
    ${9999999999}
    ${-86400}
    ${-31536000}
  `("returns true for valid unix seconds $value", ({ value }) => {
    expect(isValidUnixSeconds(value)).toBe(true);
  });

  it.each`
    value
    ${1.5}
    ${null}
    ${undefined}
    ${"1709164800"}
    ${"not-a-timestamp"}
  `("returns false for invalid unix seconds $value", ({ value }) => {
    expect(isValidUnixSeconds(value as never)).toBe(false);
  });
});
