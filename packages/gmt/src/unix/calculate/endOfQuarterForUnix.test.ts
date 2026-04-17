import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { endOfQuarterForUnix } from "./endOfQuarterForUnix";

describe("endOfQuarterForUnix", () => {
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
    value         | expected
    ${1704067200} | ${1711929599}
    ${1706659200} | ${1711929599}
    ${1709251200} | ${1711929599}
  `("returns $expected for value $value", ({ value, expected }) => {
    const result = endOfQuarterForUnix(value, {
      epochUnit: "seconds",
    });
    expect(result).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${1.5}
    ${null}
    ${undefined}
  `("returns null for invalid value $invalidValue", ({ invalidValue }) => {
    expect(endOfQuarterForUnix(invalidValue as never)).toBeNull();
  });
});
