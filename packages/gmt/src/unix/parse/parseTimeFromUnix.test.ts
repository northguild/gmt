import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { battleTestLeapYearUnix, MustTestDstTimeZones } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseTimeFromUnix } from "./parseTimeFromUnix";

describe("parseTimeFromUnix", () => {
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
    value            | options                          | expected
    ${1710685800000} | ${undefined}                     | ${"14:30:00"}
    ${1710685800000} | ${{ epochUnit: "milliseconds" }} | ${"14:30:00"}
    ${1710685800}    | ${{ epochUnit: "seconds" }}      | ${"14:30:00"}
    ${0}             | ${{ epochUnit: "seconds" }}      | ${"00:00:00"}
    ${1704067200000} | ${undefined}                     | ${"00:00:00"}
    ${1710693000000} | ${undefined}                     | ${"16:30:00"}
  `(
    "returns $expected for $value and options $options",
    ({ value, options, expected }) => {
      expect(parseTimeFromUnix(value, options)).toBe(expected);
    },
  );

  it.each`
    value                     | timeZone                                       | expected
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones.UTC}                    | ${"00:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones.GMT}                    | ${"00:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Etc/GMT"]}             | ${"00:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Lisbon"]}       | ${"00:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Dublin"]}       | ${"00:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Berlin"]}       | ${"01:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Australia/Lord_Howe"]} | ${"11:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Pacific/Apia"]}        | ${"13:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Pacific/Niue"]}        | ${"13:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["America/New_York"]}    | ${"19:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["America/Chicago"]}     | ${"18:00:00"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["America/Phoenix"]}     | ${"17:00:00"}
  `(
    "returns $expected for $value with timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(parseTimeFromUnix(value, { timeZone })).toBe(expected);
    },
  );

  it.each`
    value            | epochUnit         | expected
    ${-86400}        | ${"seconds"}      | ${"00:00:00"}
    ${-31536000}     | ${"seconds"}      | ${"00:00:00"}
    ${1710685800}    | ${"seconds"}      | ${"14:30:00"}
    ${1710685800000} | ${"milliseconds"} | ${"14:30:00"}
  `(
    "returns $expected for $value with epochUnit $epochUnit",
    ({ value, epochUnit, expected }) => {
      expect(parseTimeFromUnix(value, { epochUnit: epochUnit as never })).toBe(
        expected,
      );
    },
  );

  it.each`
    invalidValue
    ${null}
    ${undefined}
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${1.5}
    ${-1.5}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(parseTimeFromUnix(invalidValue as unknown as number)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseTimeFromUnix(battleTestLeapYearUnix);
    expect(result).toBe("");
  });
});
