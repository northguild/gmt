import type { MockedFunction } from "vitest";
import { mockTemporalInstantFromEpochMillisecondsThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { parseWeekFromUnix } from "./parseWeekFromUnix";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("parseWeekFromUnix", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
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
    value            | weekStartsOn | expected
    ${epochMs}       | ${"monday"}  | ${9}
    ${epochMs}       | ${"sunday"}  | ${9}
    ${1735646400000} | ${"monday"}  | ${1}
    ${1735646400000} | ${"sunday"}  | ${1}
    ${978264000000}  | ${"sunday"}  | ${1}
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
    mockTemporalInstantFromEpochMillisecondsThrow();
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

// weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
// (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
// 1710504000000 is 2024-03-15T12:00:00Z.
describe("parseWeekFromUnix with an invalid weekStartsOn", () => {
  it.each`
    weekStartsOn | label
    ${"tuesday"} | ${"'tuesday'"}
    ${"Monday"}  | ${"'Monday'"}
    ${""}        | ${"''"}
    ${null}      | ${"null"}
    ${1}         | ${"1"}
    ${true}      | ${"true"}
  `(
    "returns null for 1710504000000 with invalid weekStartsOn $label",
    ({ weekStartsOn }) => {
      expect(
        parseWeekFromUnix(1710504000000, { timeZone: "UTC", weekStartsOn }),
      ).toBeNull();
    },
  );
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
