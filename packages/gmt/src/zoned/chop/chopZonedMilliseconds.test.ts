import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";
import { chopZonedMilliseconds } from "./chopZonedMilliseconds";

describe("chopZonedMilliseconds", () => {
  it.each`
    value                                                     | expected
    ${"2024-02-29T12:30:45.123+01:00[Europe/Paris]"}          | ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}
    ${"2024-02-29T12:30:45.000000001+01:00[Europe/Paris]"}    | ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}
    ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}              | ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}
    ${"2024-02-29T14:30:45.999+00:00[UTC]"}                   | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T09:30:45.123456789+02:00[Europe/Helsinki]"} | ${"2024-02-29T09:30:45+02:00[Europe/Helsinki]"}
    ${"2024-02-29T00:00:00.000+00:00[UTC]"}                   | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:30+01:00[Europe/Paris]"}                 | ${"2024-02-29T12:30:00+01:00[Europe/Paris]"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedMilliseconds(value)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"2024-02-29"}
    ${"12:30:45"}
    ${"2024-02-29T12:30:45"}
    ${"2024-02-29T12:30:45Z"}
    ${"not-a-datetime"}
    ${""}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `("returns empty string for $invalidValue", ({ invalidValue }) => {
    expect(chopZonedMilliseconds(invalidValue)).toBe("");
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns a valid zoned datetime at second precision for battle-test timezone ${timeZone}`, () => {
      const result = chopZonedMilliseconds(value);
      expect(isValidZonedDateTime(result)).toBe(true);
      // no fractional seconds in the result
      expect(result).not.toMatch(/\.\d/);
      expect(result).toMatch(/\[.+\]$/);
    });
  }
});
