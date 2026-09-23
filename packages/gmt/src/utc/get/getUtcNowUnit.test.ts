import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcNowUnit } from "./getUtcNowUnit";

describe("getUtcNowUnit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    unit             | expected
    ${"year"}        | ${"2024"}
    ${"month"}       | ${"02"}
    ${"day"}         | ${"29"}
    ${"dayOfWeek"}   | ${"4"}
    ${"week"}        | ${"9"}
    ${"hour"}        | ${"00"}
    ${"minute"}      | ${"00"}
    ${"second"}      | ${"00"}
    ${"millisecond"} | ${"000"}
    ${"microsecond"} | ${"000"}
    ${"nanosecond"}  | ${"000"}
  `("returns $expected for unit $unit", ({ unit, expected }) => {
    const val = getUtcNowUnit(unit as never);
    if (unit === "microsecond" || unit === "nanosecond") {
      expect(val).toMatch(/^\d{3}$/);
    } else {
      expect(val).toBe(expected);
    }
  });

  it.each`
    invalidUnit
    ${""}
    ${null}
    ${undefined}
    ${"invalid"}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(getUtcNowUnit(invalidUnit as never)).toBe("");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcNowUnit("year");
    expect(result).toBe("");
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  // The clock is 2024-02-29T00:00:00Z, a Thursday in ISO week 9.
  it.each`
    unit              | expected
    ${"years"}        | ${"2024"}
    ${"months"}       | ${"02"}
    ${"weeks"}        | ${"9"}
    ${"days"}         | ${"29"}
    ${"hours"}        | ${"00"}
    ${"minutes"}      | ${"00"}
    ${"seconds"}      | ${"00"}
    ${"milliseconds"} | ${"000"}
  `("returns $expected for plural unit $unit", ({ unit, expected }) => {
    expect(getUtcNowUnit(unit)).toBe(expected);
  });

  // Sub-millisecond digits come from the host's high-resolution clock, not the faked one, so only
  // their three-digit shape is fixed.
  it.each`
    unit
    ${"microseconds"}
    ${"nanoseconds"}
  `("returns three digits for plural unit $unit", ({ unit }) => {
    expect(getUtcNowUnit(unit)).toMatch(/^\d{3}$/);
  });
});
