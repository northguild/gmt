import { sameInstantBattleCases } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseTimeZoneFromZoned } from "./parseTimeZoneFromZoned";

describe("parseTimeZoneFromZoned", () => {
  it.each`
    value                                                | expected
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"America/New_York"}
    ${"2024-02-29T14:30:45Z[UTC]"}                       | ${"UTC"}
  `("returns timeZone $expected for $value", ({ value, expected }) => {
    expect(parseTimeZoneFromZoned(value)).toBe(expected);
  });

  it.each`
    value                                        | expected
    ${"2024-02-29T14:30:45+01:00[Europe/Paris]"} | ${"Europe/Paris"}
  `(
    "returns edge case timeZone $expected for $value",
    ({ value, expected }) => {
      expect(parseTimeZoneFromZoned(value)).toBe(expected);
    },
  );

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
      expect(parseTimeZoneFromZoned(invalidValue as never)).toBe("");
    },
  );

  it.each(sameInstantBattleCases)(
    "returns $timeZone for battle-test $value",
    ({ value, timeZone }) => {
      expect(parseTimeZoneFromZoned(value)).toBe(timeZone);
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseTimeZoneFromZoned(
      "2024-02-29T14:30:45.123-05:00[America/New_York]",
    );
    expect(result).toBe("");
  });
});
