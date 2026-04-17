import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseHourFromUnix } from "./parseHourFromUnix";

describe("parseHourFromUnix", () => {
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
    "returns $expected for $value with epochUnit $epochUnit",
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
    mockTemporalZonedDateTimeFromThrow();
    const result = parseHourFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});
