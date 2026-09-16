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

  // The deprecated `disambiguation`/`offset` are accepted and ignored: an ordinary quarter start
  // is unchanged by any value, "reject" included.
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
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

// The quarter starts at the real local
// bucket of its first month with every sub-second field reset. Expected values verified
// against `bucketRange` month buckets on @js-temporal/polyfill@0.5.1.
// 1715776496789 is 2024-05-15T12:34:56.789Z; 1711929600000 is 2024-04-01T00:00:00Z
// 1285882200000 is 2010-09-30T23:30:00+02:00[Africa/Cairo]; 1277931600000 is 2010-07-01T00:00:00+03:00
describe("startOfQuarterForUnix with default options", () => {
  it.each`
    value            | timeZone          | expected
    ${1715776496789} | ${"UTC"}          | ${1711929600000}
    ${1285882200000} | ${"Africa/Cairo"} | ${1277931600000}
  `(
    "returns $expected for $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(startOfQuarterForUnix(value, { timeZone })).toBe(expected);
    },
  );
});

// Explicit (ignored) options still reset the milliseconds.
// 1715776496789 is 2024-05-15T12:34:56.789Z; 1711929600000 is 2024-04-01T00:00:00Z
describe("startOfQuarterForUnix sub-second reset with explicit options", () => {
  it.each`
    value            | options                                              | expected
    ${1715776496789} | ${{ timeZone: "UTC", disambiguation: "compatible" }} | ${1711929600000}
    ${1715776496789} | ${{ timeZone: "UTC", offset: "prefer" }}             | ${1711929600000}
  `(
    "returns $expected for $value with $options",
    ({ value, options, expected }) => {
      expect(startOfQuarterForUnix(value, options)).toBe(expected);
    },
  );
});

// Tunis repeated Q4's first local hour on 1978-10-01. The quarter starts at its first real
// instant whatever the deprecated `disambiguation`/`offset` say — "later" used to return the
// second pass (276044400000, 1978-10-01T00:00:00+01:00). Verified on @js-temporal/polyfill@0.5.1.
// 276046200000 is 1978-10-01T00:30:00+01:00[Africa/Tunis]
// 276040800000 is 1978-10-01T00:00:00+02:00[Africa/Tunis]
describe("startOfQuarterForUnix at a zone transition", () => {
  it.each`
    options                                                                     | expected
    ${{ timeZone: "Africa/Tunis" }}                                             | ${276040800000}
    ${{ timeZone: "Africa/Tunis", disambiguation: "later" }}                    | ${276040800000}
    ${{ timeZone: "Africa/Tunis", disambiguation: "reject", offset: "reject" }} | ${276040800000}
  `(
    "returns $expected for 276046200000 with $options",
    ({ options, expected }) => {
      expect(startOfQuarterForUnix(276046200000, options)).toBe(expected);
    },
  );

  // 1730608200000 / 1730611800000 are both passes of 2024-11-03T00:30[America/Havana];
  // 1727755200000 is 2024-10-01T00:00:00-04:00[America/Havana]
  it.each`
    value            | expected
    ${1730608200000} | ${1727755200000}
    ${1730611800000} | ${1727755200000}
  `(
    "returns $expected for $value in Havana's repeated midnight",
    ({ value, expected }) => {
      expect(startOfQuarterForUnix(value, { timeZone: "America/Havana" })).toBe(
        expected,
      );
    },
  );
});

describe("startOfQuarterForUnix invalid-input @example", () => {
  it("returns null for startOfQuarterForUnix(NaN)", () => {
    expect(startOfQuarterForUnix(NaN)).toBe(null);
  });
});
