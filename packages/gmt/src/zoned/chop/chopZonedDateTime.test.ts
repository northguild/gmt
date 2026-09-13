import { sameInstantBattleCases, unixEpochBattleCases } from "../../test";
import { isValidTimeZone } from "../validate";
import { chopZonedDateTime } from "./chopZonedDateTime";

describe("chopZonedDateTime", () => {
  it.each`
    value                                            | expected
    ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}     | ${"Europe/Paris"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"UTC"}
    ${"2024-02-29T09:30:45+02:00[Europe/Helsinki]"}  | ${"Europe/Helsinki"}
    ${"2024-02-29T12:30:45.123+01:00[Europe/Paris]"} | ${"Europe/Paris"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}              | ${"UTC"}
    ${"2024-02-29T23:59:59.999+00:00[UTC]"}          | ${"UTC"}
    ${"2024-02-29T12:30:45Z[UTC]"}                   | ${"UTC"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedDateTime(value)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns timeZone name $timeZone for battle-test $value",
    ({ value, timeZone }) => {
      expect(chopZonedDateTime(value)).toBe(timeZone);
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
    expect(chopZonedDateTime(invalidValue)).toBe("");
  });

  for (const { timeZone, value } of unixEpochBattleCases) {
    it(`returns matching timeZone for historical battle-test timeZone ${timeZone}`, () => {
      expect(chopZonedDateTime(value)).toBe(timeZone);
    });
  }
});

describe("chopZonedDateTime edge cases", () => {
  it.each`
    value
    ${"2024-02-29T12:30:45Z[UTC]"}
  `(
    "returns a non-empty string for edge case zoned datetime $value",
    ({ value }) => {
      expect(chopZonedDateTime(value)).not.toBe("");
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns valid timeZone id for battle-test timeZone ${timeZone}`, () => {
      const result = chopZonedDateTime(value);
      expect(isValidTimeZone(result)).toBe(true);
    });
  }

  for (const { timeZone, value } of unixEpochBattleCases) {
    it(`returns valid timeZone id for historical battle-test timeZone ${timeZone}`, () => {
      const result = chopZonedDateTime(value);
      expect(isValidTimeZone(result)).toBe(true);
    });
  }
});
