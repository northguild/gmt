import { localNoonBattleCases } from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { addZoned } from "./addZoned";

describe("addZoned", () => {
  it.each`
    value                               | amount | unit             | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"year"}        | ${"2025-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"month"}       | ${"2024-03-29T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"week"}        | ${"2024-03-14T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"day"}         | ${"2024-03-01T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"hour"}        | ${"2024-02-29T16:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"minute"}      | ${"2024-02-29T15:15:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"second"}      | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${250} | ${"millisecond"} | ${"2024-02-29T14:30:00.25+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"microsecond"} | ${"2024-02-29T14:30:00.000001+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"nanosecond"}  | ${"2024-02-29T14:30:00.000000001+00:00[UTC]"}
  `(
    "returns $expected for $value + $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(addZoned(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"}                 | ${"2025-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[GMT]"}                 | ${"2025-02-28T14:30:00+00:00[GMT]"}
    ${"2024-02-29T14:30:00+00:00[Etc/GMT]"}             | ${"2025-02-28T14:30:00+00:00[Etc/GMT]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Lisbon]"}       | ${"2025-02-28T14:30:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Dublin]"}       | ${"2025-02-28T14:30:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T14:30:00+01:00[Europe/Berlin]"}       | ${"2025-02-28T14:30:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T14:30:00+02:00[Europe/Helsinki]"}     | ${"2025-02-28T14:30:00+02:00[Europe/Helsinki]"}
    ${"2024-02-29T14:30:00+03:00[Europe/Istanbul]"}     | ${"2025-02-28T14:30:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}        | ${"2025-02-28T14:30:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T14:30:00+05:45[Asia/Kathmandu]"}      | ${"2025-02-28T14:30:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T14:30:00+08:00[Asia/Shanghai]"}       | ${"2025-02-28T14:30:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T14:30:00+11:00[Australia/Lord_Howe]"} | ${"2025-02-28T14:30:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T14:30:00+13:45[Pacific/Chatham]"}     | ${"2025-02-28T14:30:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T14:30:00+13:00[Pacific/Apia]"}        | ${"2025-02-28T14:30:00+13:00[Pacific/Apia]"}
    ${"2024-02-29T14:30:00-11:00[Pacific/Niue]"}        | ${"2025-02-28T14:30:00-11:00[Pacific/Niue]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"}    | ${"2025-02-28T14:30:00-05:00[America/New_York]"}
    ${"2024-02-29T14:30:00-06:00[America/Chicago]"}     | ${"2025-02-28T14:30:00-06:00[America/Chicago]"}
    ${"2024-02-29T14:30:00-07:00[America/Phoenix]"}     | ${"2025-02-28T14:30:00-07:00[America/Phoenix]"}
  `(
    "works across ordered battle-test timeZones for $value",
    ({ value, expected }) => {
      // just add 365 days to leap day
      expect(addZoned(value, { days: 365 })).toBe(expected);
    },
  );

  it.each`
    value                               | amount | unit        | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-1}  | ${"hour"}   | ${"2024-02-29T13:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-30} | ${"minute"} | ${"2024-02-29T14:00:00+00:00[UTC]"}
  `(
    "returns $expected for negative amount $amount",
    ({ value, amount, unit, expected }) => {
      expect(addZoned(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(addZoned(invalidValue as never, { hours: 1 } as never)).toBe("");
    },
  );

  it.each`
    invalidAmount
    ${NaN}
    ${null}
    ${undefined}
    ${"1"}
  `(
    "returns an empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addZoned("2024-02-29T14:30:00+00:00[UTC]", {
          hours: invalidAmount as never,
        } as never),
      ).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"timeZone"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(
        addZoned("2024-02-29T14:30:00+00:00[UTC]", {
          [String(invalidUnit)]: 1,
        } as never),
      ).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} when adding`, () => {
      expect(parseTimeZoneFromZoned(addZoned(value, { hours: 1 }))).toBe(
        timeZone,
      );
    });
  }
});
