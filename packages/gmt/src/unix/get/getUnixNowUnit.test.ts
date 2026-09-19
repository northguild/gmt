import { getUnixNowUnit } from "./getUnixNowUnit";

describe("getUnixNowUnit", () => {
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
    const val = getUnixNowUnit(unit as never);
    // Temporal.Now reads sub-millisecond host time the fake clock does not fix, so only the
    // 3-digit width of the 0-999 microsecond and nanosecond fields is deterministic.
    if (unit === "microsecond" || unit === "nanosecond") {
      expect(val).toMatch(/^\d{3}$/);
    } else {
      expect(val).toBe(expected);
    }
  });

  // Temporal §13.17: plural unit names are the singular unit; dayOfWeek has no plural.
  it.each`
    unit            | expected
    ${"years"}      | ${"2024"}
    ${"months"}     | ${"02"}
    ${"days"}       | ${"29"}
    ${"weeks"}      | ${"9"}
    ${"hours"}      | ${"00"}
    ${"dayOfWeeks"} | ${""}
  `("returns $expected for plural unit $unit", ({ unit, expected }) => {
    expect(getUnixNowUnit(unit as never)).toBe(expected);
  });

  it("returns a 3-digit field for plural unit nanoseconds", () => {
    expect(getUnixNowUnit("nanoseconds" as never)).toMatch(/^\d{3}$/);
  });

  it.each`
    invalidUnit
    ${""}
    ${null}
    ${undefined}
    ${"invalid"}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(getUnixNowUnit(invalidUnit as never)).toBe("");
  });
});
