import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { parseDayOfWeekFromUnix } from "./parseDayOfWeekFromUnix";

describe("parseDayOfWeekFromUnix", () => {
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
    ${battleTestLeapYearUnix} | ${4}
    ${1704067200000}          | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayOfWeekFromUnix(value)).toBe(expected);
  });

  it.each`
    value            | epochUnit         | expected
    ${-86400}        | ${"seconds"}      | ${3}
    ${-31536000}     | ${"seconds"}      | ${3}
    ${1709164800}    | ${"seconds"}      | ${4}
    ${1704067200000} | ${"milliseconds"} | ${1}
  `(
    "returns $expected for $value in milliseconds and seconds",
    ({ value, epochUnit, expected }) => {
      expect(
        parseDayOfWeekFromUnix(value as never, {
          epochUnit: epochUnit as never,
        }),
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
    expect(parseDayOfWeekFromUnix(value as never)).toBe(null);
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseDayOfWeekFromUnix(battleTestLeapYearUnix);
    expect(result).toBeNull();
  });
});

describe("parseDayOfWeekFromUnix with a blank epoch string", () => {
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
      expect(parseDayOfWeekFromUnix(value, { timeZone: "UTC" })).toBe(null);
      expect(
        parseDayOfWeekFromUnix(value, {
          epochUnit: "seconds",
          timeZone: "UTC",
        }),
      ).toBe(null);
    },
  );
});

describe("parseDayOfWeekFromUnix invalid-input @example", () => {
  it('returns null for parseDayOfWeekFromUnix("")', () => {
    expect(parseDayOfWeekFromUnix("")).toBe(null);
  });
});
