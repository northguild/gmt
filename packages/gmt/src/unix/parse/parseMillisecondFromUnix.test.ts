import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseMillisecondFromUnix } from "./parseMillisecondFromUnix";

describe("parseMillisecondFromUnix", () => {
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
    ${battleTestLeapYearUnix} | ${"000"}
    ${1704067200000}          | ${"000"}
    ${0}                      | ${"000"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMillisecondFromUnix(value)).toBe(expected);
  });

  it.each`
    value            | epochUnit         | expected
    ${-86400}        | ${"seconds"}      | ${"000"}
    ${-31536000}     | ${"seconds"}      | ${"000"}
    ${1709164800}    | ${"seconds"}      | ${"000"}
    ${1704067200000} | ${"milliseconds"} | ${"000"}
  `(
    "returns $expected for $value with epochUnit $epochUnit",
    ({ value, epochUnit, expected }) => {
      expect(
        parseMillisecondFromUnix(value as never, {
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
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseMillisecondFromUnix(value as never)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseMillisecondFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});
