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

  // The deprecated `disambiguation`/`offset` are accepted and ignored: an ordinary quarter end is
  // unchanged by any value, "reject" included.
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
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

// The quarter ends just before the next
// quarter's first local month bucket, never before the input. Expected values verified against
// `bucketRange` month buckets on @js-temporal/polyfill@0.5.1.
// 1285882200000 is 2010-09-30T23:30:00+02:00[Africa/Cairo] (second pass of the repeated hour)
// 1285878600000 is 2010-09-30T23:30:00+03:00[Africa/Cairo] (first pass)
// 1285883999999 is 2010-09-30T23:59:59.999+02:00[Africa/Cairo]
describe("endOfQuarterForUnix with default options", () => {
  it.each`
    value            | timeZone            | expected
    ${1285882200000} | ${"Africa/Cairo"}   | ${1285883999999}
    ${1285878600000} | ${"Africa/Cairo"}   | ${1285883999999}
    ${1730608200000} | ${"America/Havana"} | ${1735707599999}
  `(
    "returns $expected for $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(endOfQuarterForUnix(value, { timeZone })).toBe(expected);
    },
  );
});

// Cairo repeated Q3's last local hour. The quarter ends on the second pass whatever the
// deprecated `disambiguation`/`offset` say — "compatible" used to end it on the first pass
// (1285880399999, 23:59:59.999+03:00), before the input. Verified on @js-temporal/polyfill@0.5.1.
// 1285883999999 is 2010-09-30T23:59:59.999+02:00[Africa/Cairo]
describe("endOfQuarterForUnix at a zone transition with ignored explicit options", () => {
  it.each`
    value            | options                                                                     | expected
    ${1285882200000} | ${{ timeZone: "Africa/Cairo", disambiguation: "compatible" }}               | ${1285883999999}
    ${1285882200000} | ${{ timeZone: "Africa/Cairo", disambiguation: "reject", offset: "reject" }} | ${1285883999999}
  `(
    "returns $expected for $value with $options",
    ({ value, options, expected }) => {
      expect(endOfQuarterForUnix(value, options)).toBe(expected);
    },
  );
});
