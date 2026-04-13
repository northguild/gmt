import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import {
  battleTestLeapYearUnix,
  battleTestLeapYearUnixSeconds,
  MustTestDstTimeZones,
} from "../../test";

import { parseUnixDate } from "./parseUnixDate";

describe("parseUnixDate", () => {
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
    value                            | options                          | expected
    ${battleTestLeapYearUnix}        | ${undefined}                     | ${"2024-02-29"}
    ${battleTestLeapYearUnix}        | ${{ epochUnit: "milliseconds" }} | ${"2024-02-29"}
    ${battleTestLeapYearUnixSeconds} | ${{ epochUnit: "seconds" }}      | ${"2024-02-29"}
    ${0}                             | ${{ epochUnit: "seconds" }}      | ${"1970-01-01"}
    ${1704067200000}                 | ${undefined}                     | ${"2024-01-01"}
    ${1735689600000}                 | ${undefined}                     | ${"2025-01-01"}
  `(
    "returns $expected for $value and options $options",
    ({ value, options, expected }) => {
      expect(parseUnixDate(value, options)).toBe(expected);
    },
  );

  it.each`
    value                     | timeZone                                       | expected
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones.UTC}                    | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones.GMT}                    | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Etc/GMT"]}             | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Lisbon"]}       | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Dublin"]}       | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Berlin"]}       | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Helsinki"]}     | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Europe/Istanbul"]}     | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Asia/Kolkata"]}        | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Asia/Kathmandu"]}      | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Asia/Shanghai"]}       | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Australia/Lord_Howe"]} | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Pacific/Chatham"]}     | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Pacific/Apia"]}        | ${"2024-02-29"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["Pacific/Niue"]}        | ${"2024-02-28"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["America/New_York"]}    | ${"2024-02-28"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["America/Chicago"]}     | ${"2024-02-28"}
    ${battleTestLeapYearUnix} | ${MustTestDstTimeZones["America/Phoenix"]}     | ${"2024-02-28"}
  `(
    "returns $expected for $value with timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(parseUnixDate(value, { timeZone })).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${null}
    ${undefined}
    ${NaN}
    ${Infinity}
    ${-Infinity}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnixDate(invalidValue as unknown as number)).toBe("");
    },
  );
});
