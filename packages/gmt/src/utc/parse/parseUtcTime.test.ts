import { battleTestLeapYearUtc, MustTestDstTimeZones } from "../../test";
import { parseUtcTime } from "./parseUtcTime";

describe("parseUtcTime", () => {
  it.each`
    value                         | expected
    ${"2024-03-17T14:30:45Z"}     | ${"14:30:45"}
    ${"2024-03-17T14:30:45.123Z"} | ${"14:30:45.123"}
    ${"2024-03-17T00:00:00Z"}     | ${"00:00:00"}
    ${"2024-01-01T12:00:00Z"}     | ${"12:00:00"}
    ${"2024-02-29T14:30:00Z"}     | ${"14:30:00"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseUtcTime(value)).toBe(expected);
  });

  it.each`
    value                    | timeZone                                       | expected
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones.UTC}                    | ${"00:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones.GMT}                    | ${"00:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["Etc/GMT"]}             | ${"00:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["Europe/Lisbon"]}       | ${"00:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["Europe/Dublin"]}       | ${"00:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["Europe/Berlin"]}       | ${"01:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["Australia/Lord_Howe"]} | ${"11:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["Pacific/Apia"]}        | ${"13:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["Pacific/Niue"]}        | ${"13:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["America/New_York"]}    | ${"19:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["America/Chicago"]}     | ${"18:00:00"}
    ${battleTestLeapYearUtc} | ${MustTestDstTimeZones["America/Phoenix"]}     | ${"17:00:00"}
  `(
    "returns $expected for $value with timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(parseUtcTime(value, { timeZone })).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"2024-02-29T14:30:45.123-04:00"}
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(parseUtcTime(invalidValue as never)).toBe("");
    },
  );
});
