import { subtractUtc } from "./subtractUtc";

describe("subtractUtc", () => {
  it.each`
    value                         | amount | unit             | expected
    ${"2024-02-29T14:30:00Z"}     | ${1}   | ${"year"}        | ${"2023-02-28T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"}     | ${1}   | ${"month"}       | ${"2024-01-29T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"}     | ${2}   | ${"week"}        | ${"2024-02-15T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"}     | ${1}   | ${"day"}         | ${"2024-02-28T14:30:00Z"}
    ${"2024-02-29T14:30:00Z"}     | ${2}   | ${"hour"}        | ${"2024-02-29T12:30:00Z"}
    ${"2024-02-29T14:30:00Z"}     | ${45}  | ${"minute"}      | ${"2024-02-29T13:45:00Z"}
    ${"2024-02-29T14:30:00Z"}     | ${45}  | ${"second"}      | ${"2024-02-29T14:29:15Z"}
    ${"2024-02-29T14:30:00.250Z"} | ${250} | ${"millisecond"} | ${"2024-02-29T14:30:00Z"}
  `(
    "returns $expected for $value - $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(subtractUtc(value, { [`${unit}s`]: amount } as never)).toBe(
        expected,
      );
    },
  );

  it.each`
    value                     | amount | unit        | expected
    ${"2024-02-29T14:30:00Z"} | ${-1}  | ${"hour"}   | ${"2024-02-29T15:30:00Z"}
    ${"2024-02-29T14:30:00Z"} | ${-30} | ${"minute"} | ${"2024-02-29T15:00:00Z"}
  `(
    "returns $expected for negative amount $amount",
    ({ value, amount, unit, expected }) => {
      expect(subtractUtc(value, { [`${unit}s`]: amount } as never)).toBe(
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
    "returns an empty string for invalid UTC datetime $invalidValue",
    ({ invalidValue }) => {
      expect(subtractUtc(invalidValue as never, { hours: 1 } as never)).toBe(
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
        subtractUtc("2024-02-29T14:30:00Z", {
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
        subtractUtc("2024-02-29T14:30:00Z", {
          [String(invalidUnit)]: 1,
        } as never),
      ).toBe("");
    },
  );
});
