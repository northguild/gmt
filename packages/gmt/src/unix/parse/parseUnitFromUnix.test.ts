import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseUnitFromUnix } from "./parseUnitFromUnix";

describe("parseUnitFromUnix", () => {
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
    const val = parseUnitFromUnix(epochMs, unit as never);
    if (unit === "microsecond" || unit === "nanosecond") {
      expect(val).toMatch(/^\d{3}$/);
    } else {
      expect(val).toBe(expected as string);
    }
  });

  it.each`
    value            | epochUnit         | expected
    ${-86400}        | ${"seconds"}      | ${"1969"}
    ${-31536000}     | ${"seconds"}      | ${"1969"}
    ${1709164800}    | ${"seconds"}      | ${"2024"}
    ${1704067200000} | ${"milliseconds"} | ${"2024"}
  `(
    "returns $expected for $value with epochUnit $epochUnit",
    ({ value, epochUnit, expected }) => {
      expect(
        parseUnitFromUnix(value as never, "year", {
          epochUnit: epochUnit as never,
        }),
      ).toBe(expected);
    },
  );

  it("supports optional timeZone", () => {
    expect(parseUnitFromUnix(epochMs, "year", { timeZone: "UTC" })).toBe(
      "2024",
    );
  });

  it.each`
    invalidValue
    ${NaN}
    ${Infinity}
    ${1.5}
    ${-1.5}
  `(
    "returns empty string for invalid epoch $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromUnix(invalidValue as never, "year")).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseUnitFromUnix(battleTestLeapYearUnix, "year");
    expect(result).toBe("");
  });
});
