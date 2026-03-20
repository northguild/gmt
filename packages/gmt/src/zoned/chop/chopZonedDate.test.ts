import { isValidTime } from "../../plain/validate/isValidTime";
import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { chopZonedDate } from "./chopZonedDate";

describe("chopZonedDate", () => {
  it.each`
    value                                            | expected
    ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}     | ${"12:30:45"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"14:30:45"}
    ${"2024-02-29T09:30:45+02:00[Europe/Helsinki]"}  | ${"09:30:45"}
    ${"2024-02-29T12:30:45.123+01:00[Europe/Paris]"} | ${"12:30:45.123"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}              | ${"00:00:00"}
    ${"2024-02-29T23:59:59.999+00:00[UTC]"}          | ${"23:59:59.999"}
    ${"2024-02-29T12:30:45Z[UTC]"}                   | ${"12:30:45"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedDate(value)).toBe(expected);
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
    expect(chopZonedDate(invalidValue)).toBe("");
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns a valid plain time for battle-test timezone ${timeZone}`, () => {
      const result = chopZonedDate(value);
      expect(isValidTime(result)).toBe(true);
    });
  }
});
