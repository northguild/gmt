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

  // `disambiguation` and `offset` were removed in 1.16.0: a boundary is always a real instant, as
  // TC39's `startOfDay()` takes neither. Passing one is a type error and changes nothing at runtime.
  it("treats the removed disambiguation option as a type error and ignores it at runtime", () => {
    expect(
      endOfQuarterForUnix(1704067200, {
        epochUnit: "seconds",
        timeZone: "UTC",
        // @ts-expect-error -- `disambiguation` was removed in 1.16.0
        disambiguation: "reject",
      }),
    ).toBe(1711929599);
  });
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      endOfQuarterForUnix(1704067200, {
        epochUnit: "seconds",
        timeZone: "UTC",
        // @ts-expect-error -- `offset` was removed in 1.16.0
        offset: "prefer",
      }),
    ).toBe(1711929599);
  });

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

// Cairo repeated Q3's last local hour. The quarter ends on the second pass — the removed
// `disambiguation: "compatible"` used to end it on the first pass
// (1285880399999, 23:59:59.999+03:00), before the input. Verified on @js-temporal/polyfill@0.5.1.
// 1285883999999 is 2010-09-30T23:59:59.999+02:00[Africa/Cairo]
describe("endOfQuarterForUnix at a zone transition", () => {
  it.each`
    value            | options                         | expected
    ${1285882200000} | ${{ timeZone: "Africa/Cairo" }} | ${1285883999999}
  `(
    "returns $expected for $value with $options",
    ({ value, options, expected }) => {
      expect(endOfQuarterForUnix(value, options)).toBe(expected);
    },
  );
});

// -8639999956800000 ms is -271821-04-20T12:00:00Z, in the first representable instant's quarter,
// which began on 1 April, before the range. Its end, -271821-06-30T23:59:59.999999999Z, is
// representable: floor(ns / 1e6) = -8639993779200001 ms.
describe("endOfQuarterForUnix at the first representable instant", () => {
  it.each`
    value                | timeZone | expected
    ${-8639999956800000} | ${"UTC"} | ${-8639993779200001}
  `(
    "returns $expected as the quarter end of $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(endOfQuarterForUnix(value, { timeZone })).toBe(expected);
    },
  );
});

describe("endOfQuarterForUnix invalid-input @example", () => {
  it("returns null for endOfQuarterForUnix(NaN)", () => {
    expect(endOfQuarterForUnix(NaN)).toBe(null);
  });
});
