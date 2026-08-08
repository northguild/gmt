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
