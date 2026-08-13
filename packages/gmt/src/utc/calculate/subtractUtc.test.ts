import { subtractUtc } from "./subtractUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("subtractUtc", () => {
  // Canonical input: utcStart2024Jan01StartOfDay
  // Override: leap-day dates for Feb 29 boundary testing
  const canonicalInput = "2024-01-01T00:00:00Z";
  const leapDayInput = "2024-02-29T14:30:00Z";

  it.each`
    value             | amount | unit             | expected
    ${canonicalInput} | ${1}   | ${"year"}        | ${"2023-01-01T00:00:00Z"}
    ${canonicalInput} | ${1}   | ${"month"}       | ${"2023-12-01T00:00:00Z"}
    ${canonicalInput} | ${2}   | ${"week"}        | ${"2023-12-18T00:00:00Z"}
    ${canonicalInput} | ${1}   | ${"day"}         | ${"2023-12-31T00:00:00Z"}
    ${canonicalInput} | ${2}   | ${"hour"}        | ${"2023-12-31T22:00:00Z"}
    ${canonicalInput} | ${45}  | ${"minute"}      | ${"2023-12-31T23:15:00Z"}
    ${canonicalInput} | ${45}  | ${"second"}      | ${"2023-12-31T23:59:15Z"}
    ${canonicalInput} | ${250} | ${"millisecond"} | ${"2023-12-31T23:59:59.75Z"}
  `(
    "returns $expected for $value - $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(subtractUtc(value, { [`${unit}s`]: amount } as never)).toBe(
        expected,
      );
    },
  );

  it.each`
    value           | amount | unit        | expected
    ${leapDayInput} | ${-1}  | ${"hour"}   | ${"2024-02-29T15:30:00Z"}
    ${leapDayInput} | ${-30} | ${"minute"} | ${"2024-02-29T15:00:00Z"}
  `(
    "returns $expected for negative amount $amount on $value",
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
    "returns empty string for invalid UTC datetime $invalidValue",
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
    "returns empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        subtractUtc(canonicalInput, {
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
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      subtractUtc(canonicalInput, { [String(invalidUnit)]: 1 } as never),
    ).toBe("");
  });

  it.each`
    value                     | units             | overflow       | expected
    ${"2024-03-31T12:00:00Z"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29T12:00:00Z"}
    ${"2024-03-31T12:00:00Z"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-03-31T12:00:00Z"} | ${{ months: 13 }} | ${"constrain"} | ${"2023-02-28T12:00:00Z"}
    ${"2024-03-31T12:00:00Z"} | ${{ months: 13 }} | ${"reject"}    | ${""}
    ${leapDayInput}           | ${{ years: 1 }}   | ${"constrain"} | ${"2023-02-28T14:30:00Z"}
    ${leapDayInput}           | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15T12:00:00Z"} | ${{ months: 1 }}  | ${"reject"}    | ${"2023-12-15T12:00:00Z"}
    ${"2024-03-31T12:00:00Z"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-04-30T12:00:00Z"}
    ${"2024-03-31T12:00:00Z"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value - $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(subtractUtc(value, units, { overflow })).toBe(expected);
    },
  );

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(subtractUtc(canonicalInput, { hours: 1 })).toBe("");
  });
});
