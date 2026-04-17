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
});
