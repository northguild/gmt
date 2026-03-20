import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { convertToUnixSeconds } from "./convertToUnixSeconds";

describe("convertToUnixSeconds", () => {
  it.each`
    value                                            | expected
    ${"1970-01-01T00:00:00+00:00[UTC]"}              | ${0}
    ${"2024-02-29T09:00:00+00:00[UTC]"}              | ${1709197200}
    ${"2024-02-29T04:00:00-05:00[America/New_York]"} | ${1709197200}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: number }) => {
      expect(convertToUnixSeconds(value)).toBe(expected);
    },
  );

  it.each`
    value
    ${"1970-01-01T00:00:00+00:00[Etc/UTC]"}
  `("returns a number for edge case zoned datetime $value", ({ value }) => {
    expect(convertToUnixSeconds(value)).not.toBeNull();
  });

  it.each`
    invalidValue
    ${"not-a-zoned-datetime"}
    ${"2024-02-29T09:00:00+00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns null for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertToUnixSeconds(invalidValue as never)).toBeNull();
    },
  );

  for (const { timeZone, value, unixSeconds } of sameInstantBattleCases) {
    it(`returns shared epoch seconds for battle-test timezone ${timeZone}`, () => {
      expect(convertToUnixSeconds(value)).toBe(unixSeconds);
    });
  }
});
