import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../test/timezoneFixtures";
import { isAfterZoned } from "./isAfterZoned";

describe("isAfterZoned", () => {
  it.each`
    value1                                           | value2                                           | expected
    ${"2024-02-29T10:31:00-05:00[America/New_York]"} | ${"2024-02-29T10:30:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-29T14:30:00Z[UTC]"}                   | ${"2024-02-29T10:30:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-29T10:29:00-05:00[America/New_York]"} | ${"2024-02-29T10:30:00-05:00[America/New_York]"} | ${false}
    ${"invalid"}                                     | ${"2024-02-29T10:30:00-05:00[America/New_York]"} | ${false}
  `(
    "returns $expected when checking if $value1 is after $value2",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(isAfterZoned(value1, value2)).toBe(expected);
    },
  );

  it.each`
    value1                                              | value2                                              | expected
    ${"2024-02-29T12:01:00+00:00[UTC]"}                 | ${"2024-02-29T12:00:00+00:00[UTC]"}                 | ${true}
    ${"2024-02-29T12:01:00+00:00[GMT]"}                 | ${"2024-02-29T12:00:00+00:00[GMT]"}                 | ${true}
    ${"2024-02-29T12:01:00+00:00[Etc/GMT]"}             | ${"2024-02-29T12:00:00+00:00[Etc/GMT]"}             | ${true}
    ${"2024-02-29T12:01:00+00:00[Europe/Lisbon]"}       | ${"2024-02-29T12:00:00+00:00[Europe/Lisbon]"}       | ${true}
    ${"2024-02-29T12:01:00+00:00[Europe/Dublin]"}       | ${"2024-02-29T12:00:00+00:00[Europe/Dublin]"}       | ${true}
    ${"2024-02-29T12:01:00+01:00[Europe/Berlin]"}       | ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}       | ${true}
    ${"2024-02-29T12:01:00+02:00[Europe/Helsinki]"}     | ${"2024-02-29T12:00:00+02:00[Europe/Helsinki]"}     | ${true}
    ${"2024-02-29T12:01:00+03:00[Europe/Istanbul]"}     | ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}     | ${true}
    ${"2024-02-29T12:01:00+05:30[Asia/Kolkata]"}        | ${"2024-02-29T12:00:00+05:30[Asia/Kolkata]"}        | ${true}
    ${"2024-02-29T12:01:00+05:45[Asia/Kathmandu]"}      | ${"2024-02-29T12:00:00+05:45[Asia/Kathmandu]"}      | ${true}
    ${"2024-02-29T12:01:00+08:00[Asia/Shanghai]"}       | ${"2024-02-29T12:00:00+08:00[Asia/Shanghai]"}       | ${true}
    ${"2024-02-29T12:01:00+11:00[Australia/Lord_Howe]"} | ${"2024-02-29T12:00:00+11:00[Australia/Lord_Howe]"} | ${true}
    ${"2024-02-29T12:01:00+13:45[Pacific/Chatham]"}     | ${"2024-02-29T12:00:00+13:45[Pacific/Chatham]"}     | ${true}
    ${"2024-02-29T12:01:00+13:00[Pacific/Apia]"}        | ${"2024-02-29T12:00:00+13:00[Pacific/Apia]"}        | ${true}
    ${"2024-02-29T12:01:00-11:00[Pacific/Niue]"}        | ${"2024-02-29T12:00:00-11:00[Pacific/Niue]"}        | ${true}
    ${"2024-02-29T12:01:00-05:00[America/New_York]"}    | ${"2024-02-29T12:00:00-05:00[America/New_York]"}    | ${true}
    ${"2024-02-29T12:01:00-06:00[America/Chicago]"}     | ${"2024-02-29T12:00:00-06:00[America/Chicago]"}     | ${true}
    ${"2024-02-29T12:01:00-07:00[America/Phoenix]"}     | ${"2024-02-29T12:00:00-07:00[America/Phoenix]"}     | ${true}
  `(
    "returns $expected when $value1 (noon+1m) is after $value2 (noon) in battle-test timezone",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(isAfterZoned(value1, value2)).toBe(expected);
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns true for a later battle-test datetime in ${timeZone}`, () => {
      const later = Temporal.ZonedDateTime.from(value)
        .add({ minutes: 1 })
        .toString();
      expect(isAfterZoned(later, value)).toBe(true);
    });
  }
});
