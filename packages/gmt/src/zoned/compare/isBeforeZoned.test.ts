import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../test/timezoneFixtures";
import { isBeforeZoned } from "./isBeforeZoned";

describe("isBeforeZoned", () => {
  it.each`
    value1                                           | value2                                           | expected
    ${"2024-02-29T10:29:00-05:00[America/New_York]"} | ${"2024-02-29T10:30:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-29T14:30:00Z[UTC]"}                   | ${"2024-02-29T09:30:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-29T10:31:00-05:00[America/New_York]"} | ${"2024-02-29T10:30:00-05:00[America/New_York]"} | ${false}
    ${"invalid"}                                     | ${"2024-02-29T09:30:00-05:00[America/New_York]"} | ${false}
  `(
    "returns $expected when checking if $value1 is before $value2",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(isBeforeZoned(value1, value2)).toBe(expected);
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns true for an earlier battle-test datetime in ${timeZone}`, () => {
      const earlier = Temporal.ZonedDateTime.from(value)
        .subtract({ minutes: 1 })
        .toString();
      expect(isBeforeZoned(earlier, value)).toBe(true);
    });
  }
});
