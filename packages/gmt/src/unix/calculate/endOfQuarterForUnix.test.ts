import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { endOfQuarterForUnix } from "./endOfQuarterForUnix";

describe("endOfQuarterForUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each`
    value         | expected
    ${1704067200} | ${1711929599}
    ${1706659200} | ${1711929599}
    ${1711968000} | ${1719791999}
  `("returns $expected for value $value", ({ value, expected }) => {
    const result = endOfQuarterForUnix(value, { epochUnit: "seconds" });
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

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(endOfQuarterForUnix(1704067200)).toBeNull();
  });
});
