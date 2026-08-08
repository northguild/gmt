import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { endOfQuarterForUnix } from "./endOfQuarterForUnix";

// 1704067200 is 2024-01-01T00:00:00Z
// 1711929599 is 2024-03-31T23:59:59Z

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

  // disambiguation + offset are wired through, though quarter boundaries rarely coincide with a
  // DST transition in common IANA zones — this verifies the parameters are accepted and don't
  // change output for the common case
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"earlier"}    | ${undefined}
    ${"later"}      | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
    ${"reject"}     | ${"ignore"}
  `(
    "accepts disambiguation $disambiguation and offset $offset without changing output for a non-transition quarter end",
    ({ disambiguation, offset }) => {
      const base = { epochUnit: "seconds" as const, timeZone: "UTC" };
      const optionsArg =
        offset === undefined
          ? { ...base, disambiguation }
          : { ...base, disambiguation, offset };
      expect(endOfQuarterForUnix(1704067200, optionsArg)).toBe(1711929599);
    },
  );
});
