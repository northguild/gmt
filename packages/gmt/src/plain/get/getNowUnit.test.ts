import type { MockedFunction } from "vitest";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { getNowUnit } from "./getNowUnit";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("getNowUnit", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it.each`
    unit             | expected
    ${"year"}        | ${"2024"}
    ${"month"}       | ${"02"}
    ${"week"}        | ${"9"}
    ${"day"}         | ${"29"}
    ${"dayOfWeek"}   | ${"4"}
    ${"hour"}        | ${"00"}
    ${"minute"}      | ${"00"}
    ${"second"}      | ${"00"}
    ${"millisecond"} | ${"000"}
    ${"microsecond"} | ${"000"}
    ${"nanosecond"}  | ${"000"}
  `("returns $expected for unit $unit", ({ unit, expected }) => {
    const val = getNowUnit(unit as never);
    if (unit === "microsecond" || unit === "nanosecond") {
      // these units may be too fine-grained; assert shape only (3 digits)
      expect(val).toMatch(/^\d{3}$/);
    } else {
      expect(val).toBe(expected);
    }
  });

  it.each`
    invalidUnit  | label
    ${""}        | ${"''"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${"invalid"} | ${"'invalid'"}
  `("returns empty string for invalid unit $label", ({ invalidUnit }) => {
    expect(getNowUnit(invalidUnit as never)).toBe("");
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getNowUnit("year")).toBe("");
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
    expect(getNowUnit(unit)).toBe(expected);
  });

  // Sub-millisecond digits come from the host's high-resolution clock, not the faked one, so only
  // their three-digit shape is fixed.
  it.each`
    unit
    ${"microseconds"}
    ${"nanoseconds"}
  `("returns three digits for plural unit $unit", ({ unit }) => {
    expect(getNowUnit(unit)).toMatch(/^\d{3}$/);
  });
});

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("getSystemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(getSystemTimeZone).mockReset();
  });

  it("returns the mocked zone while a row replaces it", () => {
    vi.mocked(getSystemTimeZone).mockReturnValue("Pacific/Kiritimati");
    expect(getSystemTimeZone()).toBe("Pacific/Kiritimati");
  });

  it("returns the host's own zone again in the next row", () => {
    expect(getSystemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
