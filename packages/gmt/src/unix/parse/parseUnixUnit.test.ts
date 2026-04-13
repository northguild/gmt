import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { parseUnixUnit } from "./parseUnixUnit";

describe("parseUnixUnit", () => {
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

  const epochMs = 1709164800000; // 2024-02-29T00:00:00.000Z

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
  `("returns $expected for unit $unit from ms epoch", ({ unit, expected }) => {
    const val = parseUnixUnit(epochMs, unit as never);
    if (unit === "microsecond" || unit === "nanosecond") {
      expect(val).toMatch(/^\d{3}$/);
    } else {
      expect(val).toBe(expected as string);
    }
  });

  it("supports seconds epoch unit", () => {
    const epochSec = 1709164800;
    expect(parseUnixUnit(epochSec, "year", { epochUnit: "seconds" })).toBe(
      "2024",
    );
  });

  it("supports optional timeZone", () => {
    expect(parseUnixUnit(epochMs, "year", { timeZone: "UTC" })).toBe("2024");
  });

  it.each`
    invalidValue
    ${NaN}
    ${Infinity}
  `(
    "returns empty string for invalid epoch $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnixUnit(invalidValue as never, "year")).toBe("");
    },
  );
});
