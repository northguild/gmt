import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { endOfUnix } from "./endOfUnix";

// Epoch values used below, in ISO 8601 UTC:
// 1706659200    is 2024-01-31T00:00:00Z
// 1706659259    is 2024-01-31T00:00:59Z
// 1706662799    is 2024-01-31T00:59:59Z
// 1706745599    is 2024-01-31T23:59:59Z
// 1707004799    is 2024-02-03T23:59:59Z
// 1707091199    is 2024-02-04T23:59:59Z
// 1735689599    is 2024-12-31T23:59:59Z
// 1730613599999 is 2024-11-03T05:59:59.999Z
// 1730616300000 is 2024-11-03T06:45:00.000Z
// 1730617199999 is 2024-11-03T06:59:59.999Z

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

  // disambiguation: fall-back overlap — source sits in the second, repeated 1:45am
  it.each`
    disambiguation  | expected
    ${undefined}    | ${1730613599999}
    ${"compatible"} | ${1730613599999}
    ${"earlier"}    | ${1730613599999}
    ${"later"}      | ${1730617199999}
    ${"reject"}     | ${null}
  `(
    "with disambiguation $disambiguation on a fall-back overlap, returns $expected",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined
          ? { timeZone: "America/New_York" }
          : { timeZone: "America/New_York", disambiguation };
      expect(endOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  // offset controls whether disambiguation takes effect at all
  it.each`
    offset       | expected
    ${undefined} | ${null}
    ${"ignore"}  | ${null}
    ${"prefer"}  | ${1730617199999}
  `(
    "with disambiguation reject and offset $offset, returns $expected",
    ({ offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { timeZone: "America/New_York", disambiguation: "reject" as const }
          : {
              timeZone: "America/New_York",
              disambiguation: "reject" as const,
              offset,
            };
      expect(endOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );
});
