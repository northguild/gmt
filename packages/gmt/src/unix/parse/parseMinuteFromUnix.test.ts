import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { battleTestLeapYearUnix } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
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
    mockTemporalZonedDateTimeFromThrow();
    const result = parseMinuteFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});
