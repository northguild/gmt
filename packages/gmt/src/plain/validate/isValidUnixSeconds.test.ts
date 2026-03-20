import { unixFixture } from "../test/runtimeFixtures";
import { isValidUnixSeconds } from "./isValidUnixSeconds";

describe("isValidUnixSeconds", () => {
  it.each`
    value
    ${unixFixture.seconds}
    ${"0000000000"}
    ${"9999999999"}
  `("returns true for valid unix seconds $value", ({ value }) => {
    expect(isValidUnixSeconds(value)).toBe(true);
  });

  it.each`
    value
    ${unixFixture.milliseconds}
    ${unixFixture.invalid[0]}
    ${unixFixture.invalid[1]}
    ${unixFixture.invalid[2]}
    ${unixFixture.invalid[3]}
    ${unixFixture.invalid[4]}
    ${null}
    ${undefined}
  `("returns false for invalid unix seconds $value", ({ value }) => {
    expect(isValidUnixSeconds(value as never)).toBe(false);
  });
});
