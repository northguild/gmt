import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseWeekFromUnix } from "./parseWeekFromUnix";

describe("parseWeekFromUnix", () => {
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
    "returns $expected for $value with epochUnit $epochUnit",
    ({ value, epochUnit, expected }) => {
      expect(
        parseWeekFromUnix(value as never, { epochUnit: epochUnit as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value      | weekStartsOn | expected
    ${epochMs} | ${"monday"}  | ${9}
    ${epochMs} | ${"sunday"}  | ${9}
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
    mockTemporalZonedDateTimeFromThrow();
    const result = parseWeekFromUnix(epochMs);
    expect(result).toBeNull();
  });
});
