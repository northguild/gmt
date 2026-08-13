import { isValidUnixSeconds } from "./isValidUnixSeconds";

describe("isValidUnixSeconds", () => {
  it.each`
    value
    ${1704067200}
    ${1735689599}
    ${1709164800}
    ${0}
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
    ${"1704067200"}
    ${"not-a-timestamp"}
    ${true}
  `("returns false for non-integer input $value", ({ value }) => {
    expect(isValidUnixSeconds(value as never)).toBe(false);
  });
});
