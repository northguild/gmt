import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { startOfUnix } from "./startOfUnix";

// Epoch values used below, in ISO 8601 UTC:
// 1704067200    is 2024-01-01T00:00:00Z
// 1706400000    is 2024-01-28T00:00:00Z
// 1706486400    is 2024-01-29T00:00:00Z
// 1706659200    is 2024-01-31T00:00:00Z
// 1706745600    is 2024-02-01T00:00:00Z
// 1706778000    is 2024-02-01T09:00:00Z
// 1706780760    is 2024-02-01T09:46:00Z
// 1706780800    is 2024-02-01T09:46:40Z
// 1730610000000 is 2024-11-03T05:00:00.000Z
// 1730613600000 is 2024-11-03T06:00:00.000Z
// 1730616300000 is 2024-11-03T06:45:00.000Z
// 1541300400000 is 2018-11-04T03:00:00.000Z (2018-11-04T01:00:00-02:00[America/Sao_Paulo])
// 1541340000000 is 2018-11-04T14:00:00.000Z (2018-11-04T12:00:00-02:00[America/Sao_Paulo])

describe("startOfUnix", () => {
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
    ${1706659200} | ${"year"}   | ${1704067200}
    ${1706659200} | ${"month"}  | ${1704067200}
    ${1706780800} | ${"day"}    | ${1706745600}
    ${1706780800} | ${"hour"}   | ${1706778000}
    ${1706780800} | ${"minute"} | ${1706780760}
    ${1706659200} | ${"second"} | ${1706659200}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfUnix(value, unit, { epochUnit: "seconds" })).toBe(expected);
    },
  );

  it.each`
    value         | unit      | weekStartsOn | expected
    ${1706659200} | ${"week"} | ${"monday"}  | ${1706486400}
    ${1706659200} | ${"week"} | ${"sunday"}  | ${1706400000}
  `(
    "supports weekStartsOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(
        startOfUnix(value, unit, { epochUnit: "seconds", weekStartsOn }),
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
    expect(startOfUnix(invalidValue as never, "day" as never)).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfUnix(1706659200, invalidUnit as never)).toBeNull();
  });

  // disambiguation: fall-back overlap — source sits in the second, repeated 1:45am
  it.each`
    disambiguation  | expected
    ${undefined}    | ${1730610000000}
    ${"compatible"} | ${1730610000000}
    ${"earlier"}    | ${1730610000000}
    ${"later"}      | ${1730613600000}
    ${"reject"}     | ${null}
  `(
    "with disambiguation $disambiguation on a fall-back overlap, returns $expected",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined
          ? { timeZone: "America/New_York" }
          : { timeZone: "America/New_York", disambiguation };
      expect(startOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  // offset controls whether disambiguation takes effect at all
  it.each`
    offset       | expected
    ${undefined} | ${null}
    ${"ignore"}  | ${null}
    ${"prefer"}  | ${1730613600000}
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
      expect(startOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  // disambiguation: local midnight itself is a DST gap (America/Sao_Paulo jumped 00:00 -> 01:00 on
  // 2018-11-04), so the "day" time-reset must honor disambiguation, not silently advance past the gap
  it.each`
    disambiguation  | expected
    ${undefined}    | ${1541300400000}
    ${"compatible"} | ${1541300400000}
    ${"later"}      | ${1541300400000}
    ${"reject"}     | ${null}
  `(
    "resolves spring-forward gap at local midnight for unit day with disambiguation $disambiguation to $expected",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined
          ? { timeZone: "America/Sao_Paulo" }
          : { timeZone: "America/Sao_Paulo", disambiguation };
      expect(startOfUnix(1541340000000, "day", optionsArg)).toBe(expected);
    },
  );
});
