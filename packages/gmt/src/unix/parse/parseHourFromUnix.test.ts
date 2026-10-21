import type { MockedFunction } from "vitest";
import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalInstantFromEpochMillisecondsThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { parseHourFromUnix } from "./parseHourFromUnix";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("parseHourFromUnix", () => {
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
    value                     | expected
    ${battleTestLeapYearUnix} | ${"00"}
    ${1704067200000}          | ${"00"}
    ${0}                      | ${"00"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseHourFromUnix(value)).toBe(expected);
  });

  it.each`
    value            | epochUnit         | expected
    ${-86400}        | ${"seconds"}      | ${"00"}
    ${-31536000}     | ${"seconds"}      | ${"00"}
    ${1710685800}    | ${"seconds"}      | ${"14"}
    ${1710685800000} | ${"milliseconds"} | ${"14"}
  `(
    "returns $expected for $value in milliseconds and seconds",
    ({ value, epochUnit, expected }) => {
      expect(
        parseHourFromUnix(value as never, { epochUnit: epochUnit as never }),
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
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseHourFromUnix(value as never)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromEpochMillisecondsThrow();
    const result = parseHourFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});

describe("parseHourFromUnix with a blank epoch string", () => {
  // Number("") and Number("   ") are 0 (ECMA-262 StringToNumber), a coercion artefact: a blank
  // string holds no epoch value (POSIX XBD 4.19 defines an integer), so it is invalid input.
  it.each`
    label                | value
    ${"empty"}           | ${""}
    ${"spaces"}          | ${"   "}
    ${"newline and tab"} | ${"\n\t"}
    ${"no-break space"}  | ${"\u00a0"}
  `(
    'returns "" for a $label string in milliseconds and seconds',
    ({ value }) => {
      expect(parseHourFromUnix(value, { timeZone: "UTC" })).toBe("");
      expect(
        parseHourFromUnix(value, { epochUnit: "seconds", timeZone: "UTC" }),
      ).toBe("");
    },
  );
});

describe("parseHourFromUnix invalid-input @example", () => {
  it('returns "" for parseHourFromUnix("")', () => {
    expect(parseHourFromUnix("")).toBe("");
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
