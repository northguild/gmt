import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
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
      expect(val).toMatch(/^\d+$/);
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
    "returns $expected for $value in milliseconds and seconds",
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

describe("parseUnitFromUnix with a blank epoch string", () => {
  // Number("") and Number("   ") are 0 (ECMA-262 StringToNumber), a coercion artefact: a blank
  // string holds no epoch value (POSIX XBD 4.19 defines an integer), so every unit returns "".
  it.each`
    unit             | value
    ${"year"}        | ${""}
    ${"year"}        | ${" \n\t "}
    ${"month"}       | ${""}
    ${"month"}       | ${" \n\t "}
    ${"week"}        | ${""}
    ${"week"}        | ${" \n\t "}
    ${"day"}         | ${""}
    ${"day"}         | ${" \n\t "}
    ${"dayOfWeek"}   | ${""}
    ${"dayOfWeek"}   | ${" \n\t "}
    ${"hour"}        | ${""}
    ${"hour"}        | ${" \n\t "}
    ${"minute"}      | ${""}
    ${"minute"}      | ${" \n\t "}
    ${"second"}      | ${""}
    ${"second"}      | ${" \n\t "}
    ${"millisecond"} | ${""}
    ${"millisecond"} | ${" \n\t "}
    ${"microsecond"} | ${""}
    ${"microsecond"} | ${" \n\t "}
    ${"nanosecond"}  | ${""}
    ${"nanosecond"}  | ${" \n\t "}
  `('returns "" for $unit from blank string $value', ({ unit, value }) => {
    expect(parseUnitFromUnix(value, unit, { timeZone: "UTC" })).toBe("");
  });
});

describe("parseUnitFromUnix invalid-input @example", () => {
  it('returns "" for parseUnitFromUnix("", "year")', () => {
    expect(parseUnitFromUnix("", "year")).toBe("");
  });
});

// ISO 8601 week of an expanded or negative year. The Gregorian calendar repeats every 400 years:
// +010000-01-01 falls on the weekday of 2000-01-01 (Saturday), so it is in week 52 of 9999
// (like 1999-W52); -000001-01-01 falls on the weekday of 1999-01-01 (Friday), so it is in week 53
// of -2 (like 1998-W53).
describe("parseUnitFromUnix week with a year outside 0000-9999", () => {
  it.each`
    value              | iso                          | expected
    ${253402300800000} | ${"+010000-01-01T00:00:00Z"} | ${"52"}
    ${-62198755200000} | ${"-000001-01-01T00:00:00Z"} | ${"53"}
  `(
    "returns ISO week $expected for $value ms ($iso) in UTC",
    ({ value, expected }) => {
      expect(parseUnitFromUnix(value, "week", { timeZone: "UTC" })).toBe(
        expected,
      );
    },
  );
});
