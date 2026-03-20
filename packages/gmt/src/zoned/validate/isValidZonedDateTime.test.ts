import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { isValidZonedDateTime } from ".";

describe("isValidZonedDateTime", () => {
  // TODO add timezones
  it.each`
    value
    ${"2024-03-17T14:30:45.123-04:00[America/New_York]"}
    ${"2024-03-17T14:30:45.123[America/New_York]"}
    ${"2024-03-17T14:30:45Z[UTC]"}
  `(
    "returns true for valid zoned datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidZonedDateTime(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-03-17T14:30:60[America/New_York]"}
    ${"2024-03-17T14:30:60.123[America/New_York]"}
    ${"2024-03-17T14:30:60+05:00[Asia/Kolkata]"}
    ${"2024-03-17T14:30:60-08:00[America/Los_Angeles]"}
    ${"2024-03-17T14:30:60Z[UTC]"}
  `(
    "returns false for leap second with zoned datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidZonedDateTime(value)).toBe(false);
    },
  );

  it.each`
    value
    ${"2024-03-17T14:30:45.123-04:00"}
    ${"2024-03-17T14:30:45Z"}
    ${"2024-03-17T14:30:60Z[UTC]"}
    ${"2024-03-17T14:30:45.123-04:00[Not/AZone]"}
    ${"not-a-zoned-datetime"}
  `(
    "returns false for invalid zoned datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidZonedDateTime(value)).toBe(false);
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`accepts battle-test zoned datetime in ${timeZone}`, () => {
      expect(isValidZonedDateTime(value)).toBe(true);
    });
  }
});
