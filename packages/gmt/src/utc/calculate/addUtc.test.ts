import { addUtc } from "./addUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("addUtc", () => {
  const canonicalInput = "2024-01-01T00:00:00Z";
  const leapDayInput = "2024-02-29T14:30:00Z";

  it.each`
    value             | amount | unit             | expected
    ${canonicalInput} | ${1}   | ${"year"}        | ${"2025-01-01T00:00:00Z"}
    ${canonicalInput} | ${1}   | ${"month"}       | ${"2024-02-01T00:00:00Z"}
    ${canonicalInput} | ${1}   | ${"week"}        | ${"2024-01-08T00:00:00Z"}
    ${canonicalInput} | ${1}   | ${"day"}         | ${"2024-01-02T00:00:00Z"}
    ${canonicalInput} | ${2}   | ${"hour"}        | ${"2024-01-01T02:00:00Z"}
    ${canonicalInput} | ${45}  | ${"minute"}      | ${"2024-01-01T00:45:00Z"}
    ${canonicalInput} | ${45}  | ${"second"}      | ${"2024-01-01T00:00:45Z"}
    ${canonicalInput} | ${250} | ${"millisecond"} | ${"2024-01-01T00:00:00.25Z"}
  `(
    "returns $expected for $value + $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(addUtc(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    value           | amount | unit        | expected
    ${leapDayInput} | ${-1}  | ${"hour"}   | ${"2024-02-29T13:30:00Z"}
    ${leapDayInput} | ${-30} | ${"minute"} | ${"2024-02-29T14:00:00Z"}
  `(
    "returns $expected for negative amount $amount on $value",
    ({ value, amount, unit, expected }) => {
      expect(addUtc(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-01-01T00:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid UTC datetime $invalidValue",
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
    "returns empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addUtc(canonicalInput, { hours: invalidAmount as never } as never),
      ).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"timeZone"}
    ${""}
    ${null}
    ${undefined}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(addUtc(canonicalInput, { [String(invalidUnit)]: 1 } as never)).toBe(
      "",
    );
  });

  it.each`
    value                     | units             | overflow       | expected
    ${"2024-01-31T12:00:00Z"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29T12:00:00Z"}
    ${"2024-01-31T12:00:00Z"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-01-31T12:00:00Z"} | ${{ months: 13 }} | ${"constrain"} | ${"2025-02-28T12:00:00Z"}
    ${"2024-01-31T12:00:00Z"} | ${{ months: 13 }} | ${"reject"}    | ${""}
    ${leapDayInput}           | ${{ years: 1 }}   | ${"constrain"} | ${"2025-02-28T14:30:00Z"}
    ${leapDayInput}           | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15T12:00:00Z"} | ${{ months: 1 }}  | ${"reject"}    | ${"2024-02-15T12:00:00Z"}
    ${"2024-03-31T12:00:00Z"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-02-29T12:00:00Z"}
    ${"2024-03-31T12:00:00Z"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value + $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(addUtc(value, units, { overflow })).toBe(expected);
    },
  );

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(addUtc(canonicalInput, { hours: 1 })).toBe("");
  });
});
