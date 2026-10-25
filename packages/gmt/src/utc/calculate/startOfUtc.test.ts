import { startOfUtc } from "./startOfUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("startOfUtc", () => {
  // Override: Feb 29 leap day with non-zero time for thorough boundary testing
  // Canonical utcStart2024Jan01StartOfDay gives identity results for most units
  const leapDayInput = "2024-02-29T12:34:56Z";

  it.each`
    value                         | unit             | expected
    ${leapDayInput}               | ${"year"}        | ${"2024-01-01T00:00:00Z"}
    ${leapDayInput}               | ${"month"}       | ${"2024-02-01T00:00:00Z"}
    ${leapDayInput}               | ${"week"}        | ${"2024-02-26T00:00:00Z"}
    ${leapDayInput}               | ${"day"}         | ${"2024-02-29T00:00:00Z"}
    ${leapDayInput}               | ${"hour"}        | ${"2024-02-29T12:00:00Z"}
    ${leapDayInput}               | ${"minute"}      | ${"2024-02-29T12:34:00Z"}
    ${leapDayInput}               | ${"second"}      | ${"2024-02-29T12:34:56Z"}
    ${"2024-02-29T12:34:56.123Z"} | ${"millisecond"} | ${"2024-02-29T12:34:56.123Z"}
  `(
    "returns $expected for $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfUtc(value, unit as never)).toBe(expected);
    },
  );

  it.each`
    value           | unit      | weekStartsOn | expected
    ${leapDayInput} | ${"week"} | ${"monday"}  | ${"2024-02-26T00:00:00Z"}
    ${leapDayInput} | ${"week"} | ${"sunday"}  | ${"2024-02-25T00:00:00Z"}
  `(
    "returns $expected for $value and unit $unit with weekStartsOn $weekStartsOn",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfUtc(value, unit as never, { weekStartsOn })).toBe(expected);
    },
  );

  it.each`
    invalidValue             | label
    ${"invalid"}             | ${"'invalid'"}
    ${"2024-02-29T12:34:56"} | ${"'2024-02-29T12:34:56'"}
    ${""}                    | ${"''"}
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
  `("returns empty string for invalid value $label", ({ invalidValue }) => {
    expect(startOfUtc(invalidValue as never, "day" as never)).toBe("");
  });

  it.each`
    invalidUnit       | label
    ${"invalid-unit"} | ${"'invalid-unit'"}
    ${""}             | ${"''"}
    ${null}           | ${"null"}
    ${undefined}      | ${"undefined"}
  `("returns empty string for invalid unit $label", ({ invalidUnit }) => {
    expect(startOfUtc("2024-02-29T12:34:56Z", invalidUnit as never)).toBe("");
  });

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(startOfUtc(leapDayInput, "day")).toBe("");
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | expected
    ${"years"}        | ${"2024-01-01T00:00:00Z"}
    ${"months"}       | ${"2024-02-01T00:00:00Z"}
    ${"weeks"}        | ${"2024-02-26T00:00:00Z"}
    ${"days"}         | ${"2024-02-29T00:00:00Z"}
    ${"hours"}        | ${"2024-02-29T13:00:00Z"}
    ${"minutes"}      | ${"2024-02-29T13:45:00Z"}
    ${"seconds"}      | ${"2024-02-29T13:45:30Z"}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123Z"}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456Z"}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789Z"}
  `(
    "returns $expected for plural unit $unit on 2024-02-29T13:45:30.123456789Z",
    ({ unit, expected }) => {
      expect(startOfUtc("2024-02-29T13:45:30.123456789Z", unit)).toBe(expected);
    },
  );

  // weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
  // (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
  it.each`
    unit      | weekStartsOn | label
    ${"week"} | ${"tuesday"} | ${"'tuesday'"}
    ${"week"} | ${"Monday"}  | ${"'Monday'"}
    ${"week"} | ${""}        | ${"''"}
    ${"week"} | ${null}      | ${"null"}
    ${"week"} | ${1}         | ${"1"}
    ${"week"} | ${true}      | ${"true"}
    ${"day"}  | ${"tuesday"} | ${"'tuesday'"}
    ${"day"}  | ${"Monday"}  | ${"'Monday'"}
    ${"day"}  | ${""}        | ${"''"}
    ${"day"}  | ${null}      | ${"null"}
    ${"day"}  | ${1}         | ${"1"}
    ${"day"}  | ${true}      | ${"true"}
  `(
    "returns an empty string for unit $unit with invalid weekStartsOn $label",
    ({ unit, weekStartsOn }) => {
      expect(
        startOfUtc("2024-02-29T13:45:30.123456789Z", unit, { weekStartsOn }),
      ).toBe("");
    },
  );
});
