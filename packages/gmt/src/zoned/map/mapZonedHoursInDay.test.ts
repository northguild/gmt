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

  it.each`
    anchor                                              | expectedLength
    ${"2024-02-29T12:00:00+00:00[UTC]"}                 | ${24}
    ${"2024-02-29T12:00:00+00:00[GMT]"}                 | ${24}
    ${"2024-02-29T12:00:00+00:00[Etc/GMT]"}             | ${24}
    ${"2024-02-29T12:00:00+00:00[Europe/Lisbon]"}       | ${24}
    ${"2024-02-29T12:00:00+00:00[Europe/Dublin]"}       | ${24}
    ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}       | ${24}
    ${"2024-02-29T12:00:00+02:00[Europe/Helsinki]"}     | ${24}
    ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}     | ${24}
    ${"2024-02-29T12:00:00+05:30[Asia/Kolkata]"}        | ${24}
    ${"2024-02-29T12:00:00+05:45[Asia/Kathmandu]"}      | ${24}
    ${"2024-02-29T12:00:00+08:00[Asia/Shanghai]"}       | ${24}
    ${"2024-02-29T12:00:00+11:00[Australia/Lord_Howe]"} | ${24}
    ${"2024-02-29T12:00:00+13:45[Pacific/Chatham]"}     | ${24}
    ${"2024-02-29T12:00:00+13:00[Pacific/Apia]"}        | ${24}
    ${"2024-02-29T12:00:00-11:00[Pacific/Niue]"}        | ${24}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"}    | ${24}
    ${"2024-02-29T12:00:00-06:00[America/Chicago]"}     | ${24}
    ${"2024-02-29T12:00:00-07:00[America/Phoenix]"}     | ${24}
  `(
    "returns $expectedLength hourly entries for battle-test anchor $anchor",
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

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns 24 hourly entries for battle-test timezone ${timeZone}`, () => {
      expect(mapZonedHoursInDay(value)).toHaveLength(24);
    });
  }
});
