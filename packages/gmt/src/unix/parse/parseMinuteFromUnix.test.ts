import type { MockedFunction } from "vitest";
import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalInstantFromEpochMillisecondsThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { parseMinuteFromUnix } from "./parseMinuteFromUnix";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("parseMinuteFromUnix", () => {
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

  it.each`
    value                     | expected
    ${battleTestLeapYearUnix} | ${"00"}
    ${1704067200000}          | ${"00"}
    ${0}                      | ${"00"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMinuteFromUnix(value)).toBe(expected);
  });

  it.each`
    value            | options           | expected
    ${1709164800}    | ${"seconds"}      | ${"00"}
    ${1704067200000} | ${"milliseconds"} | ${"00"}
  `(
    "returns $expected for $value with epochUnit $options",
    ({ value, options, expected }) => {
      expect(
        parseMinuteFromUnix(value as never, { epochUnit: options as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value
    ${NaN}
    ${Infinity}
    ${"invalid"}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseMinuteFromUnix(value as never)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromEpochMillisecondsThrow();
    const result = parseMinuteFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});

describe("parseMinuteFromUnix with a blank epoch string", () => {
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
      expect(parseMinuteFromUnix(value, { timeZone: "UTC" })).toBe("");
      expect(
        parseMinuteFromUnix(value, { epochUnit: "seconds", timeZone: "UTC" }),
      ).toBe("");
    },
  );
});

describe("parseMinuteFromUnix invalid-input @example", () => {
  it('returns "" for parseMinuteFromUnix("")', () => {
    expect(parseMinuteFromUnix("")).toBe("");
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
