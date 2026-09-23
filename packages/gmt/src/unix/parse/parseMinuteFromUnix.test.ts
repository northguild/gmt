import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalInstantFromEpochMillisecondsThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { parseMinuteFromUnix } from "./parseMinuteFromUnix";

describe("parseMinuteFromUnix", () => {
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
