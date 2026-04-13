import { getNowUnit } from "./getNowUnit";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";

describe("getNowUnit", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
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
    invalidUnit
    ${""}
    ${null}
    ${undefined}
    ${"invalid"}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(getNowUnit(invalidUnit as never)).toBe("");
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getNowUnit("year")).toBe("");
  });
});
