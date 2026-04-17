import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseNanosecondFromUnix } from "./parseNanosecondFromUnix";

describe("parseNanosecondFromUnix", () => {
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
    ${battleTestLeapYearUnix} | ${"000000000"}
    ${1704067200000}          | ${"000000000"}
    ${0}                      | ${"000000000"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseNanosecondFromUnix(value)).toBe(expected);
  });

  it.each`
    value            | epochUnit         | expected
    ${-86400}        | ${"seconds"}      | ${"000000000"}
    ${-31536000}     | ${"seconds"}      | ${"000000000"}
    ${1709164800}    | ${"seconds"}      | ${"000000000"}
    ${1704067200000} | ${"milliseconds"} | ${"000000000"}
  `(
    "returns $expected for $value with epochUnit $epochUnit",
    ({ value, epochUnit, expected }) => {
      expect(
        parseNanosecondFromUnix(value as never, {
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
    expect(parseNanosecondFromUnix(value as never)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseNanosecondFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});
