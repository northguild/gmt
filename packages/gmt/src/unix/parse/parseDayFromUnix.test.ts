import {
  battleTestLeapYearUnix,
  battleTestLeapYearUnixSeconds,
} from "../../test";
import { mockTemporalInstantFromEpochMillisecondsThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { parseDayFromUnix } from "./parseDayFromUnix";

describe("parseDayFromUnix", () => {
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
    value                     | expected
    ${battleTestLeapYearUnix} | ${"29"}
    ${1704067200000}          | ${"01"}
    ${0}                      | ${"01"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayFromUnix(value)).toBe(expected);
  });

  it.each`
    value                            | epochUnit         | expected
    ${-86400}                        | ${"seconds"}      | ${"31"}
    ${-31536000}                     | ${"seconds"}      | ${"01"}
    ${battleTestLeapYearUnixSeconds} | ${"seconds"}      | ${"29"}
    ${1704067200000}                 | ${"milliseconds"} | ${"01"}
  `(
    "returns $expected for $value in milliseconds and seconds",
    ({ value, epochUnit, expected }) => {
      expect(
        parseDayFromUnix(value as never, { epochUnit: epochUnit as never }),
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
    expect(parseDayFromUnix(value as never)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromEpochMillisecondsThrow();
    const result = parseDayFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});

describe("parseDayFromUnix with a blank epoch string", () => {
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
      expect(parseDayFromUnix(value, { timeZone: "UTC" })).toBe("");
      expect(
        parseDayFromUnix(value, { epochUnit: "seconds", timeZone: "UTC" }),
      ).toBe("");
    },
  );
});

describe("parseDayFromUnix invalid-input @example", () => {
  it('returns "" for parseDayFromUnix("")', () => {
    expect(parseDayFromUnix("")).toBe("");
  });
});
