import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { startOfQuarterForUnix } from "./startOfQuarterForUnix";

describe("startOfQuarterForUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
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

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(startOfQuarterForUnix(1706659200)).toBeNull();
  });
});
