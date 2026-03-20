import { localNoonBattleCases } from "../test/timezoneFixtures";
import { parseZonedDate } from "./parseZonedDate";

describe("parseZonedDate", () => {
  it.each`
    value                                                | expected
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"2024-02-29"}
  `("returns the plain date portion for $value", ({ value, expected }) => {
    expect(parseZonedDate(value)).toBe(expected);
  });

  it.each`
    value                                            | expected
    ${"2024-03-10T00:30:00-05:00[America/New_York]"} | ${"2024-03-10"}
  `("returns edge case date portion for $value", ({ value, expected }) => {
    expect(parseZonedDate(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"2024-02-29T14:30:45.123-04:00"}
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseZonedDate(invalidValue as never)).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns the local date for battle-test timezone ${timeZone}`, () => {
      expect(parseZonedDate(value)).toBe("2024-02-29");
    });
  }
});
