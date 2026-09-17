import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalInstantFromEpochMillisecondsThrow } from "../../test/mocks";
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
    // Temporal's microsecond and nanosecond fields are each 0-999, so both pad to 3 digits.
    expect(parseUnitFromUnix(epochMs, unit as never)).toBe(expected);
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
    mockTemporalInstantFromEpochMillisecondsThrow();
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

describe("parseUnitFromUnix unit names", () => {
  // 1709217045123 is 2024-02-29T14:30:45.123Z. Temporal §13.17: plural names are the same unit.
  it.each`
    unit              | expected
    ${"years"}        | ${"2024"}
    ${"months"}       | ${"02"}
    ${"weeks"}        | ${"9"}
    ${"days"}         | ${"29"}
    ${"hours"}        | ${"14"}
    ${"minutes"}      | ${"30"}
    ${"seconds"}      | ${"45"}
    ${"milliseconds"} | ${"123"}
    ${"microseconds"} | ${"000"}
    ${"nanoseconds"}  | ${"000"}
    ${"dayOfWeeks"}   | ${""}
    ${"quarters"}     | ${""}
  `("returns $expected for unit $unit", ({ unit, expected }) => {
    expect(
      parseUnitFromUnix(1709217045123, unit as never, { timeZone: "UTC" }),
    ).toBe(expected);
  });
});

// weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
// (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
// 1710504000000 is 2024-03-15T12:00:00Z.
describe("parseUnitFromUnix with an invalid weekStartsOn", () => {
  it.each`
    unit      | weekStartsOn
    ${"week"} | ${"tuesday"}
    ${"week"} | ${"Monday"}
    ${"week"} | ${""}
    ${"week"} | ${null}
    ${"week"} | ${1}
    ${"week"} | ${true}
    ${"hour"} | ${"tuesday"}
    ${"hour"} | ${"Monday"}
    ${"hour"} | ${""}
    ${"hour"} | ${null}
    ${"hour"} | ${1}
    ${"hour"} | ${true}
  `(
    "returns an empty string for unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        parseUnitFromUnix(1710504000000, unit, {
          timeZone: "UTC",
          weekStartsOn,
        }),
      ).toBe("");
    },
  );
});

// Every family with a time reads the three sub-second Temporal fields, zero-padded to 3 digits. An
// epoch in milliseconds has no sub-millisecond part: 1709217045123 is 2024-02-29T14:30:45.123Z.
describe("parseUnitFromUnix sub-second units", () => {
  it.each`
    unit              | expected
    ${"millisecond"}  | ${"123"}
    ${"milliseconds"} | ${"123"}
    ${"microsecond"}  | ${"000"}
    ${"microseconds"} | ${"000"}
    ${"nanosecond"}   | ${"000"}
    ${"nanoseconds"}  | ${"000"}
  `(
    "returns $expected for unit $unit of 1709217045123",
    ({ unit, expected }) => {
      expect(parseUnitFromUnix(1709217045123, unit)).toBe(expected);
    },
  );
});
