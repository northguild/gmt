import { localNoonBattleCases } from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { subtractZoned } from "./subtractZoned";

describe("subtractZoned", () => {
  it.each`
    value                               | amount | unit             | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"year"}        | ${"2023-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"month"}       | ${"2024-01-29T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"week"}        | ${"2024-02-15T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"day"}         | ${"2024-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"hour"}        | ${"2024-02-29T12:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"minute"}      | ${"2024-02-29T13:45:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"second"}      | ${"2024-02-29T14:29:15+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${250} | ${"millisecond"} | ${"2024-02-29T14:29:59.75+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"microsecond"} | ${"2024-02-29T14:29:59.999999+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"nanosecond"}  | ${"2024-02-29T14:29:59.999999999+00:00[UTC]"}
  `(
    "returns $expected for $value - $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(subtractZoned(value, { [`${unit}s`]: amount } as never)).toBe(
        expected,
      );
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"}                 | ${"2023-03-01T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[GMT]"}                 | ${"2023-03-01T14:30:00+00:00[GMT]"}
    ${"2024-02-29T14:30:00+00:00[Etc/GMT]"}             | ${"2023-03-01T14:30:00+00:00[Etc/GMT]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Lisbon]"}       | ${"2023-03-01T14:30:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Dublin]"}       | ${"2023-03-01T14:30:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T14:30:00+01:00[Europe/Berlin]"}       | ${"2023-03-01T14:30:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T14:30:00+02:00[Europe/Helsinki]"}     | ${"2023-03-01T14:30:00+02:00[Europe/Helsinki]"}
    ${"2024-02-29T14:30:00+03:00[Europe/Istanbul]"}     | ${"2023-03-01T14:30:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}        | ${"2023-03-01T14:30:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T14:30:00+05:45[Asia/Kathmandu]"}      | ${"2023-03-01T14:30:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T14:30:00+08:00[Asia/Shanghai]"}       | ${"2023-03-01T14:30:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T14:30:00+11:00[Australia/Lord_Howe]"} | ${"2023-03-01T14:30:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T14:30:00+13:45[Pacific/Chatham]"}     | ${"2023-03-01T14:30:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T14:30:00+13:00[Pacific/Apia]"}        | ${"2023-03-01T14:30:00+13:00[Pacific/Apia]"}
    ${"2024-02-29T14:30:00-11:00[Pacific/Niue]"}        | ${"2023-03-01T14:30:00-11:00[Pacific/Niue]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"}    | ${"2023-03-01T14:30:00-05:00[America/New_York]"}
    ${"2024-02-29T14:30:00-06:00[America/Chicago]"}     | ${"2023-03-01T14:30:00-06:00[America/Chicago]"}
    ${"2024-02-29T14:30:00-07:00[America/Phoenix]"}     | ${"2023-03-01T14:30:00-07:00[America/Phoenix]"}
  `(
    "works across ordered battle-test timeZones for $value",
    ({ value, expected }) => {
      expect(subtractZoned(value, { days: 365 })).toBe(expected);
    },
  );

  it.each`
    value                               | amount | unit        | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-1}  | ${"hour"}   | ${"2024-02-29T15:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-30} | ${"minute"} | ${"2024-02-29T15:00:00+00:00[UTC]"}
  `(
    "returns $expected for negative amount $amount",
    ({ value, amount, unit, expected }) => {
      expect(subtractZoned(value, { [`${unit}s`]: amount } as never)).toBe(
        expected,
      );
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
      expect(subtractZoned(invalidValue as never, { hours: 1 } as never)).toBe(
        "",
      );
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
        subtractZoned("2024-02-29T14:30:00+00:00[UTC]", {
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
        subtractZoned("2024-02-29T14:30:00+00:00[UTC]", {
          [String(invalidUnit)]: 1,
        } as never),
      ).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} when subtracting`, () => {
      expect(parseTimeZoneFromZoned(subtractZoned(value, { hours: 1 }))).toBe(
        timeZone,
      );
    });
  }

  // disambiguation: fall-back overlap (result of - 1 day lands on an ambiguous local time)
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-11-04T01:30:00-05:00[America/New_York]"} | ${undefined}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"} | ${"compatible"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"} | ${"earlier"}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"} | ${"later"}      | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"} | ${"reject"}     | ${""}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}    | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap for $value - 1 day with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(subtractZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // disambiguation: spring-forward gap (result of - 1 day lands on a nonexistent local time,
  // but Temporal's arithmetic already advances past it, so disambiguation has no effect)
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-03-11T02:30:00-04:00[America/New_York]"} | ${undefined}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"} | ${"compatible"} | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"} | ${"earlier"}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"} | ${"later"}      | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"} | ${"reject"}     | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}    | ${"reject"}     | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
  `(
    "spring-forward gap for $value - 1 day is unaffected by disambiguation $disambiguation, returns $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(subtractZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // offset is accepted but inert: the internal rebuild step reconstructs from a plain datetime
  // string with no offset embedded, so every offset value produces identical output
  it.each`
    offset
    ${undefined}
    ${"prefer"}
    ${"use"}
    ${"ignore"}
    ${"reject"}
  `(
    "produces identical output regardless of offset $offset (inert on this function)",
    ({ offset }) => {
      const value = "2024-11-04T01:30:00-05:00[America/New_York]";
      const withoutOffset = subtractZoned(
        value,
        { days: 1 },
        {
          disambiguation: "later",
        },
      );
      const withOffset = subtractZoned(
        value,
        { days: 1 },
        {
          disambiguation: "later",
          offset,
        },
      );
      expect(withOffset).toBe(withoutOffset);
    },
  );
});
