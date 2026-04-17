import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { endOfUnix } from "./endOfUnix";

describe("endOfUnix", () => {
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
    value         | unit        | expected
    ${1706659200} | ${"year"}   | ${1735689599}
    ${1706659200} | ${"month"}  | ${1706745599}
    ${1706659200} | ${"day"}    | ${1706745599}
    ${1706659200} | ${"hour"}   | ${1706662799}
    ${1706659200} | ${"minute"} | ${1706659259}
    ${1706659200} | ${"second"} | ${1706659200}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfUnix(value, unit, { epochUnit: "seconds" })).toBe(expected);
    },
  );

  it.each`
    value         | unit      | weekStartsOn | expected
    ${1706659200} | ${"week"} | ${"monday"}  | ${1707091199}
    ${1706659200} | ${"week"} | ${"sunday"}  | ${1707004799}
  `(
    "supports weekStartsOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(
        endOfUnix(value, unit, {
          epochUnit: "seconds",
          weekStartsOn,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${1.5}
    ${null}
    ${undefined}
  `("returns null for invalid value $invalidValue", ({ invalidValue }) => {
    expect(endOfUnix(invalidValue as never, "day" as never)).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfUnix(1706659200, invalidUnit as never)).toBeNull();
  });
});
