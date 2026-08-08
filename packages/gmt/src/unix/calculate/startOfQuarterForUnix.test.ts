import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { startOfQuarterForUnix } from "./startOfQuarterForUnix";

// Epoch values used below, in ISO 8601 UTC:
// 1704067200 is 2024-01-01T00:00:00Z
// 1706659200 is 2024-01-31T00:00:00Z
// 1711929600 is 2024-04-01T00:00:00Z
// 1711968000 is 2024-04-01T10:40:00Z

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

  // disambiguation + offset are wired through, though quarter starts rarely coincide with a DST
  // transition in common IANA zones — this verifies the parameters are accepted and don't change
  // output for the common case
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"earlier"}    | ${undefined}
    ${"later"}      | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
    ${"reject"}     | ${"ignore"}
  `(
    "accepts disambiguation $disambiguation and offset $offset without changing output for a non-transition quarter start",
    ({ disambiguation, offset }) => {
      const base = { epochUnit: "seconds" as const, timeZone: "UTC" };
      const optionsArg =
        offset === undefined
          ? { ...base, disambiguation }
          : { ...base, disambiguation, offset };
      expect(startOfQuarterForUnix(1706659200, optionsArg)).toBe(1704067200);
    },
  );
});
