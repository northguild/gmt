import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";
import { chopZonedSeconds } from "./chopZonedSeconds";

describe("chopZonedSeconds", () => {
  it.each`
    value                                            | expected
    ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}     | ${"2024-02-29T12:30+01:00[Europe/Paris]"}
    ${"2024-02-29T12:30:45.123+01:00[Europe/Paris]"} | ${"2024-02-29T12:30+01:00[Europe/Paris]"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"2024-02-29T14:30+00:00[UTC]"}
    ${"2024-02-29T09:30:45+02:00[Europe/Helsinki]"}  | ${"2024-02-29T09:30+02:00[Europe/Helsinki]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}              | ${"2024-02-29T00:00+00:00[UTC]"}
    ${"2024-02-29T23:59:59.999+00:00[UTC]"}          | ${"2024-02-29T23:59+00:00[UTC]"}
    ${"2024-02-29T12:30+01:00[Europe/Paris]"}        | ${"2024-02-29T12:30+01:00[Europe/Paris]"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedSeconds(value)).toBe(expected);
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
    expect(chopZonedSeconds(invalidValue)).toBe("");
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns a valid zoned datetime at minute precision for battle-test timezone ${timeZone}`, () => {
      const result = chopZonedSeconds(value);
      expect(isValidZonedDateTime(result)).toBe(true);
      // time portion ends at minutes (HH:MM) then immediately transitions to offset sign
      expect(result).toMatch(/T\d{2}:\d{2}[+-]/);
      // offset and timezone are preserved
      expect(result).toMatch(/\[.+\]$/);
    });
  }
});
