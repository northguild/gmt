import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { parseWeekFromUnix } from "./parseWeekFromUnix";

describe("parseWeekFromUnix", () => {
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
  });

  const epochMs = 1709164800000; // 2024-02-29T00:00:00.000Z

  it.each`
    value            | expected
    ${epochMs}       | ${9}
    ${1704067200000} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromUnix(value)).toBe(expected);
  });

  it.each`
    value            | epochUnit         | expected
    ${-86400}        | ${"seconds"}      | ${1}
    ${-31536000}     | ${"seconds"}      | ${1}
    ${1709164800}    | ${"seconds"}      | ${9}
    ${1704067200000} | ${"milliseconds"} | ${1}
  `(
    "returns $expected for $value in milliseconds and seconds",
    ({ value, epochUnit, expected }) => {
      expect(
        parseWeekFromUnix(value as never, { epochUnit: epochUnit as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value      | weekStartsOn | expected
    ${epochMs} | ${"monday"}  | ${9}
    ${epochMs} | ${"sunday"}  | ${9}
  `(
    "returns $expected for $value with weekStartsOn $weekStartsOn",
    ({ value, weekStartsOn, expected }) => {
      expect(
        parseWeekFromUnix(value, { weekStartsOn: weekStartsOn as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value
    ${NaN}
    ${Infinity}
    ${"invalid"}
    ${1.5}
    ${-1.5}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseWeekFromUnix(value as never)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseWeekFromUnix(epochMs);
    expect(result).toBeNull();
  });
});

describe("parseWeekFromUnix with a blank epoch string", () => {
  // Number("") and Number("   ") are 0 (ECMA-262 StringToNumber), a coercion artefact: a blank
  // string holds no epoch value (POSIX XBD 4.19 defines an integer), so it is invalid input.
  it.each`
    label                | value
    ${"empty"}           | ${""}
    ${"spaces"}          | ${"   "}
    ${"newline and tab"} | ${"\n\t"}
    ${"no-break space"}  | ${"\u00a0"}
  `(
    "returns null for a $label string in milliseconds and seconds",
    ({ value }) => {
      expect(parseWeekFromUnix(value, { timeZone: "UTC" })).toBe(null);
      expect(
        parseWeekFromUnix(value, { epochUnit: "seconds", timeZone: "UTC" }),
      ).toBe(null);
    },
  );
});

describe("parseWeekFromUnix invalid-input @example", () => {
  it('returns null for parseWeekFromUnix("")', () => {
    expect(parseWeekFromUnix("")).toBe(null);
  });
});

// ISO 8601 week of an expanded or negative year. The Gregorian calendar repeats every 400 years:
// +010000-01-01 falls on the weekday of 2000-01-01 (Saturday), so it is in week 52 of 9999
// (like 1999-W52); -000001-01-01 falls on the weekday of 1999-01-01 (Friday), so it is in week 53
// of -2 (like 1998-W53).
describe("parseWeekFromUnix with a year outside 0000-9999", () => {
  it.each`
    value              | iso                          | expected
    ${253402300800000} | ${"+010000-01-01T00:00:00Z"} | ${52}
    ${-62198755200000} | ${"-000001-01-01T00:00:00Z"} | ${53}
  `(
    "returns ISO week $expected for $value ms ($iso) in UTC",
    ({ value, expected }) => {
      expect(parseWeekFromUnix(value, { timeZone: "UTC" })).toBe(expected);
    },
  );
});
