import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { startOfQuarterForUnix } from "./startOfQuarterForUnix";

describe("startOfQuarterForUnix", () => {
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
    ${1704067200} | ${1704067200}
    ${1706659200} | ${1704067200}
    ${1711968000} | ${1711929600}
  `("returns $expected for value $value", ({ value, expected }) => {
    expect(startOfQuarterForUnix(value, { epochUnit: "seconds" })).toBe(
      expected,
    );
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${1.5}
    ${null}
    ${undefined}
  `("returns null for invalid value $invalidValue", ({ invalidValue }) => {
    expect(startOfQuarterForUnix(invalidValue as never)).toBeNull();
  });
});
