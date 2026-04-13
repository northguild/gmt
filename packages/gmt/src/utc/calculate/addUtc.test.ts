import { addUtc } from "./addUtc";

describe("addUtc", () => {
  it.each`
    value                     | amount | unit             | expected
    ${"2024-02-29T14:30:00Z"} | ${1}   | ${"year"}        | ${"2025-02-28T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${1}   | ${"month"}       | ${"2024-03-29T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${2}   | ${"week"}        | ${"2024-03-14T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${1}   | ${"day"}         | ${"2024-03-01T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${2}   | ${"hour"}        | ${"2024-02-29T16:30:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${45}  | ${"minute"}      | ${"2024-02-29T15:15:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${45}  | ${"second"}      | ${"2024-02-29T14:30:45Z"}
    ${"2024-02-29T14:30:00Z"} | ${250} | ${"millisecond"} | ${"2024-02-29T14:30:00.25Z"}
  `(
    "returns $expected for $value + $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(addUtc(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    value                     | amount | unit        | expected
    ${"2024-02-29T14:30:00Z"} | ${-1}  | ${"hour"}   | ${"2024-02-29T13:30:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${-30} | ${"minute"} | ${"2024-02-29T14:00:00Z"}
  `(
    "returns $expected for negative amount $amount",
    ({ value, amount, unit, expected }) => {
      expect(addUtc(value, { [`${unit}s`]: amount } as never)).toBe(expected);
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
    "returns an empty string for invalid UTC datetime $invalidValue",
    ({ invalidValue }) => {
      expect(addUtc(invalidValue as never, { hours: 1 } as never)).toBe("");
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
        addUtc("2024-02-29T14:30:00Z", {
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
        addUtc("2024-02-29T14:30:00Z", {
          [String(invalidUnit)]: 1,
        } as never),
      ).toBe("");
    },
  );
});
