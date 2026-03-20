import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { convertZonedToUnix } from "./convertZonedToUnix";

describe("convertZonedToUnix", () => {
  it.each`
    value                                            | unit              | expected
    ${"1970-01-01T00:00:00+00:00[UTC]"}              | ${"milliseconds"} | ${0}
    ${"1970-01-01T00:00:00+00:00[UTC]"}              | ${"seconds"}      | ${0}
    ${"2024-02-29T04:00:00-05:00[America/New_York]"} | ${"milliseconds"} | ${1709197200000}
    ${"2024-02-29T04:00:00-05:00[America/New_York]"} | ${"seconds"}      | ${1709197200}
  `("returns $expected for $value in $unit", ({ value, unit, expected }) => {
    expect(convertZonedToUnix(value, unit)).toBe(expected);
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
      expect(convertZonedToUnix(invalidValue as never)).toBeNull();
    },
  );

  it.each`
    invalidUnit
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      convertZonedToUnix(
        "2024-02-29T09:00:00+00:00[UTC]",
        invalidUnit as never,
      ),
    ).toBeNull();
  });

  for (const {
    timeZone,
    value,
    unixMilliseconds,
    unixSeconds,
  } of sameInstantBattleCases) {
    it(`returns consistent unix values for battle-test timezone ${timeZone}`, () => {
      expect(convertZonedToUnix(value, "milliseconds")).toBe(unixMilliseconds);
      expect(convertZonedToUnix(value, "seconds")).toBe(unixSeconds);
    });
  }
});
