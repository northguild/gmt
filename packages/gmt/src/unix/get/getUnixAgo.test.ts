import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { subtractUnix } from "../calculate/subtractUnix";
import { getUnixAgo } from "./getUnixAgo";
import { getUnixNow } from "./getUnixNow";

// The fake clock is 2027-06-15T12:00:00Z, which is 1813060800 s.
const NOW = "2027-06-15T12:00:00Z";

describe("getUnixAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    units               | options                     | expected
    ${{ days: 90 }}     | ${{ epochUnit: "seconds" }} | ${1805284800}
    ${{ days: 1 }}      | ${{ epochUnit: "seconds" }} | ${1812974400}
    ${{ seconds: 300 }} | ${{ epochUnit: "seconds" }} | ${1813060500}
    ${{ days: 90 }}     | ${undefined}                | ${1805284800000}
    ${{ days: 90 }}     | ${{ epochUnit: "second" }}  | ${1805284800}
    ${{ days: 0 }}      | ${{ epochUnit: "seconds" }} | ${1813060800}
    ${{ days: -0 }}     | ${{ epochUnit: "seconds" }} | ${1813060800}
  `(
    "returns $expected for $units with options $options",
    ({ units, options, expected }) => {
      expect(getUnixAgo(units, options)).toBe(expected);
    },
  );

  // 2027-03-31 minus a month has no 02-31: it clamps to 2027-02-28T00:00:00Z (TC39 constrain).
  it("clamps a missing day to the end of the month", () => {
    setFakeSystemTime("2027-03-31T00:00:00Z");
    expect(getUnixAgo({ months: 1 }, { epochUnit: "seconds" })).toBe(
      1803772800,
    );
  });

  // The month goes first and clamps to 2027-02-28; the day then counts back from there: 02-27.
  it("subtracts months, clamps, then days", () => {
    setFakeSystemTime("2027-03-31T00:00:00Z");
    expect(getUnixAgo({ months: 1, days: 1 }, { epochUnit: "seconds" })).toBe(
      1803686400,
    );
  });

  it.each`
    units
    ${{ months: 1 }}
    ${{ months: 1, days: 1 }}
    ${{ years: 1, months: 1 }}
  `("matches subtractUnix on a day that clamps for $units", ({ units }) => {
    setFakeSystemTime("2028-03-31T00:00:00Z");
    expect(getUnixAgo(units)).toBe(subtractUnix(getUnixNow() as number, units));
  });

  // 1969-12-31T23:59:59.500Z: an epoch before 1970 floors toward the past, so -1, not 0.
  it("floors a second before 1970 toward the past", () => {
    setFakeSystemTime("1969-12-31T23:59:59.500Z");
    expect(getUnixAgo({ seconds: 0 }, { epochUnit: "seconds" })).toBe(-1);
  });

  it.each`
    units
    ${{}}
    ${{ fortnights: 1 }}
    ${"P1M"}
    ${null}
    ${undefined}
    ${{ days: 1.5 }}
    ${{ days: -1 }}
    ${{ years: 1, days: -1 }}
    ${{ years: 300000 }}
  `("returns null for units $units", ({ units }) => {
    expect(getUnixAgo(units)).toBeNull();
  });

  it.each`
    options
    ${{ epochUnit: "minutes" }}
    ${"seconds"}
  `("returns null for options $options", ({ options }) => {
    expect(getUnixAgo({ days: 1 }, options)).toBeNull();
  });

  // The clock is read once, after the arguments are checked.
  it.each`
    args                                       | label
    ${[{}]}                                    | ${"units {}"}
    ${[{ days: -1 }]}                          | ${"units { days: -1 }"}
    ${["P1M"]}                                 | ${"units 'P1M'"}
    ${[{ days: 1 }, { epochUnit: "minutes" }]} | ${"options { epochUnit: 'minutes' }"}
  `("does not read the clock for $label", ({ args }) => {
    const clock = vi.spyOn(Temporal.Now, "instant");
    expect(getUnixAgo(...(args as Parameters<typeof getUnixAgo>))).toBeNull();
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "instant");
    expect(getUnixAgo({ days: 1 })).not.toBeNull();
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns null for units that throw on any trap", () => {
    expect(getUnixAgo(hostileProxy() as never)).toBeNull();
  });

  it.each`
    units
    ${{ days: 90 }}
    ${{ years: 1 }}
    ${{ months: 1, days: 3 }}
    ${{ seconds: 3600 }}
  `("matches subtractUnix(getUnixNow(), $units)", ({ units }) => {
    expect(getUnixAgo(units)).toBe(subtractUnix(getUnixNow() as number, units));
  });

  it("is getUnixNow() for a zero length", () => {
    expect(getUnixAgo({ seconds: 0 })).toBe(getUnixNow());
  });
});
