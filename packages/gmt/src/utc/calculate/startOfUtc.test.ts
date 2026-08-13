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
    invalidValue
    ${"invalid"}
    ${"2024-02-29T12:34:56"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(startOfUtc(invalidValue as never, "day" as never)).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfUtc("2024-02-29T12:34:56Z", invalidUnit as never)).toBe("");
  });

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(startOfUtc(leapDayInput, "day")).toBe("");
  });
});
