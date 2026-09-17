import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { addUnix } from "./addUnix";

describe("addUnix", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    value            | units          | options                          | expected
    ${1709164800000} | ${{ days: 1 }} | ${undefined}                     | ${1709251200000}
    ${1709164800000} | ${{ days: 1 }} | ${{ epochUnit: "milliseconds" }} | ${1709251200000}
    ${1709164800}    | ${{ days: 1 }} | ${{ epochUnit: "seconds" }}      | ${1709251200}
    ${0}             | ${{ days: 1 }} | ${{ epochUnit: "seconds" }}      | ${86400}
  `(
    "returns $expected for $value with $units",
    ({ value, units, options, expected }) => {
      expect(addUnix(value, units, options)).toBe(expected);
    },
  );

  it.each`
    value            | units                 | options
    ${"invalid"}     | ${{ days: 1 }}        | ${undefined}
    ${1.5}           | ${{ days: 1 }}        | ${undefined}
    ${null}          | ${{ days: 1 }}        | ${undefined}
    ${1709164800000} | ${{ invalidUnit: 1 }} | ${undefined}
    ${1709164800000} | ${{ days: "1" }}      | ${undefined}
  `("returns null for invalid input", ({ value, units, options }) => {
    expect(addUnix(value as never, units as never, options)).toBeNull();
  });

  it.each`
    value            | units             | options                                                    | expected
    ${1706702400000} | ${{ months: 1 }}  | ${undefined}                                               | ${1709208000000}
    ${1706702400000} | ${{ months: 1 }}  | ${{ overflow: "constrain" }}                               | ${1709208000000}
    ${1706702400000} | ${{ months: 1 }}  | ${{ overflow: "reject" }}                                  | ${null}
    ${1706702400000} | ${{ months: 1 }}  | ${{ overflow: "constrain", timeZone: "America/New_York" }} | ${1709208000000}
    ${1706702400000} | ${{ months: 1 }}  | ${{ overflow: "reject", timeZone: "America/New_York" }}    | ${null}
    ${1706702400}    | ${{ months: 1 }}  | ${{ overflow: "constrain", epochUnit: "seconds" }}         | ${1709208000}
    ${1706702400}    | ${{ months: 1 }}  | ${{ overflow: "reject", epochUnit: "seconds" }}            | ${null}
    ${1706702400000} | ${{ days: 1 }}    | ${{ overflow: "reject" }}                                  | ${1706788800000}
    ${1711886400000} | ${{ months: -1 }} | ${undefined}                                               | ${1709208000000}
    ${1711886400000} | ${{ months: -1 }} | ${{ overflow: "constrain" }}                               | ${1709208000000}
    ${1711886400000} | ${{ months: -1 }} | ${{ overflow: "reject" }}                                  | ${null}
  `(
    "returns $expected for $value + $units with options $options",
    ({ value, units, options, expected }) => {
      expect(addUnix(value, units, options)).toBe(expected);
    },
  );
});

describe("addUnix at the maximum instant", () => {
  // 8_640_000_000_000_000 ms is +275760-09-13T00:00:00Z = 10:00 in Sydney; one day earlier is 8_639_999_913_600_000.
  it.each`
    value                    | units          | timeZone                | expected
    ${8_639_999_913_600_000} | ${{ days: 1 }} | ${"Australia/Sydney"}   | ${8_640_000_000_000_000}
    ${8_639_999_913_600_000} | ${{ days: 1 }} | ${"Pacific/Kiritimati"} | ${8_640_000_000_000_000}
  `(
    "adds $units to $value in $timeZone giving $expected",
    ({ value, units, timeZone, expected }) => {
      expect(addUnix(value, units, { timeZone })).toBe(expected);
    },
  );
});

describe("addUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `("returns null for epochUnit $epochUnit", ({ epochUnit }) => {
    expect(
      addUnix(
        1_706_659_200,
        { days: 1 },
        { epochUnit: epochUnit as never, timeZone: "UTC" },
      ),
    ).toBe(null);
  });
});

describe("addUnix invalid-input @example", () => {
  it("returns null for addUnix(1.5, { days: 1 })", () => {
    expect(addUnix(1.5, { days: 1 })).toBe(null);
  });
});
