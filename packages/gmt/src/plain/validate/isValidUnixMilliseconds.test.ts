import { unixFixture } from "../test/runtimeFixtures";
import { isValidUnixMilliseconds } from "./isValidUnixMilliseconds";

describe("isValidUnixMilliseconds", () => {
  it.each`
    value
    ${unixFixture.milliseconds}
    ${"0000000000000"}
    ${"9999999999999"}
  `("returns true for valid unix milliseconds $value", ({ value }) => {
    expect(isValidUnixMilliseconds(value)).toBe(true);
  });

  it.each`
    value
    ${unixFixture.seconds}
    ${unixFixture.invalid[0]}
    ${unixFixture.invalid[1]}
    ${unixFixture.invalid[2]}
    ${unixFixture.invalid[3]}
    ${unixFixture.invalid[4]}
    ${null}
    ${undefined}
  `("returns false for invalid unix milliseconds $value", ({ value }) => {
    expect(isValidUnixMilliseconds(value as never)).toBe(false);
  });
});
