import { sameInstantBattleCases } from "../../test";
import { areZonedDateTimesEqual } from "./areZonedEqual";

describe("areZonedDateTimesEqual", () => {
  it.each`
    value1                                               | value2                                           | expected
    ${"2024-02-29T14:30[America/New_York]"}              | ${"2024-02-29T14:30:00[America/New_York]"}       | ${true}
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"2024-02-29T14:30:45.123[America/New_York]"}   | ${true}
    ${"2024-02-29T14:30:45Z[UTC]"}                       | ${"2024-02-29T14:30:45Z[UTC]"}                   | ${true}
    ${"2024-02-29T14:30:45Z[UTC]"}                       | ${"2024-02-29T10:30:45-05:00[America/New_York]"} | ${false}
    ${"2024-02-29T14:30:45[America/New_York]"}           | ${"2024-02-29T14:31:45[America/New_York]"}       | ${false}
    ${"2024-02-29T14:30:45[America/New_York]"}           | ${"not-a-zoned-datetime"}                        | ${false}
  `(
    "returns $expected when comparing $value1 to $value2",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(areZonedDateTimesEqual(value1, value2)).toBe(expected);
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${true}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${true}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${true}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${true}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${true}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${true}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${true}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${true}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${true}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${true}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${true}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${true}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${true}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${true}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${true}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${true}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${true}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${true}
  `(
    "returns $expected when comparing identical battle-test $value to itself",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(areZonedDateTimesEqual(value, value)).toBe(expected);
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns true for identical battle-test zoned datetime in ${timeZone}`, () => {
      expect(areZonedDateTimesEqual(value, value)).toBe(true);
    });
  }
});
