import { localNoonBattleCases } from "../test/timezoneFixtures";
import { mapZonedHoursInDay } from "./mapZonedHoursInDay";

describe("mapZonedHoursInDay", () => {
  it.each`
    anchor                                           | expectedLength
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${23}
    ${"2024-11-03T12:00:00-05:00[America/New_York]"} | ${25}
    ${"2024-02-29T12:00:00+00:00[UTC]"}              | ${24}
  `(
    "returns $expectedLength entries for $anchor",
    ({
      anchor,
      expectedLength,
    }: {
      anchor: string;
      expectedLength: number;
    }) => {
      expect(mapZonedHoursInDay(anchor)).toHaveLength(expectedLength);
    },
  );

  it.each`
    anchor                              | expectedFirstPrefix
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"2024-02-29T00:00:00"}
  `(
    "returns expected midnight anchor for $anchor",
    ({ anchor, expectedFirstPrefix }) => {
      expect(mapZonedHoursInDay(anchor)[0]).toContain(expectedFirstPrefix);
    },
  );

  it.each`
    invalidAnchor
    ${"invalid"}
    ${"2024-02-29T12:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty array for invalid zoned datetime $invalidAnchor",
    ({ invalidAnchor }) => {
      expect(mapZonedHoursInDay(invalidAnchor as never)).toEqual([]);
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns 24 hourly entries for battle-test timezone ${timeZone}`, () => {
      expect(mapZonedHoursInDay(value)).toHaveLength(24);
    });
  }
});
