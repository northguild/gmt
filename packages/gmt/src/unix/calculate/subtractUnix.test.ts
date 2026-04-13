import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { subtractUnix } from "./subtractUnix";

describe("subtractUnix", () => {
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
    ${1709251200000} | ${{ days: 1 }} | ${undefined}                     | ${1709164800000}
    ${1709251200000} | ${{ days: 1 }} | ${{ epochUnit: "milliseconds" }} | ${1709164800000}
    ${1709251200}    | ${{ days: 1 }} | ${{ epochUnit: "seconds" }}      | ${1709164800}
    ${86400}         | ${{ days: 1 }} | ${{ epochUnit: "seconds" }}      | ${0}
  `(
    "returns $expected for $value with $units",
    ({ value, units, options, expected }) => {
      expect(subtractUnix(value, units, options)).toBe(expected);
    },
  );

  it.each`
    value            | units                 | options
    ${"invalid"}     | ${{ days: 1 }}        | ${undefined}
    ${-1}            | ${{ days: 1 }}        | ${undefined}
    ${1.5}           | ${{ days: 1 }}        | ${undefined}
    ${null}          | ${{ days: 1 }}        | ${undefined}
    ${1709164800000} | ${{ invalidUnit: 1 }} | ${undefined}
    ${1709164800000} | ${{ days: "1" }}      | ${undefined}
  `("returns null for invalid input", ({ value, units, options }) => {
    expect(subtractUnix(value as never, units as never, options)).toBe(null);
  });
});
