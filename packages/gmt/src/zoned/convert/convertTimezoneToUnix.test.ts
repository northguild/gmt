import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { convertTimezoneToUnix } from "./convertTimezoneToUnix";

describe("convertTimezoneToUnix", () => {
  it.each`
    value                                            | unit              | expected
    ${"1970-01-01T00:00:00+00:00[UTC]"}              | ${"milliseconds"} | ${0}
    ${"1970-01-01T00:00:00+00:00[UTC]"}              | ${"seconds"}      | ${0}
    ${"2024-02-29T04:00:00-05:00[America/New_York]"} | ${"milliseconds"} | ${1709197200000}
    ${"2024-02-29T04:00:00-05:00[America/New_York]"} | ${"seconds"}      | ${1709197200}
  `("returns $expected for $value as $unit", ({ value, unit, expected }) => {
    expect(convertTimezoneToUnix(value, unit)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T09:00:00+00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns null for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertTimezoneToUnix(invalidValue as never)).toBeNull();
    },
  );

  for (const {
    timeZone,
    value,
    unixMilliseconds,
    unixSeconds,
  } of sameInstantBattleCases) {
    it(`returns consistent unix values for battle-test timezone ${timeZone}`, () => {
      expect(convertTimezoneToUnix(value, "milliseconds")).toBe(
        unixMilliseconds,
      );
      expect(convertTimezoneToUnix(value, "seconds")).toBe(unixSeconds);
    });
  }
});
