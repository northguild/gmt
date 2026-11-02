import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { addUnix } from "../calculate/addUnix";
import { getUnixIn } from "./getUnixIn";
import { getUnixNow } from "./getUnixNow";

// The fake clock is 2027-06-15T12:00:00Z, which is 1813060800 s.
const NOW = "2027-06-15T12:00:00Z";

describe("getUnixIn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    units                    | options                          | expected
    ${{ days: 90 }}          | ${{ epochUnit: "seconds" }}      | ${1820836800}
    ${{ years: 1 }}          | ${{ epochUnit: "seconds" }}      | ${1844683200}
    ${{ days: 90 }}          | ${undefined}                     | ${1820836800000}
    ${{ days: 90 }}          | ${{ epochUnit: "second" }}       | ${1820836800}
    ${{ seconds: 3600 }}     | ${{ epochUnit: "seconds" }}      | ${1813064400}
    ${{ days: 0 }}           | ${{ epochUnit: "seconds" }}      | ${1813060800}
    ${{ days: -0 }}          | ${{ epochUnit: "seconds" }}      | ${1813060800}
    ${{ hours: 1, days: 1 }} | ${{ epochUnit: "seconds" }}      | ${1813150800}
    ${{ seconds: 90 }}       | ${{ epochUnit: "milliseconds" }} | ${1813060890000}
  `(
    "returns $expected for $units with options $options",
    ({ units, options, expected }) => {
      expect(getUnixIn(units, options)).toBe(expected);
    },
  );

  // 2027-02-10T00:00:00Z plus a month is 2027-03-10T00:00:00Z.
  it("adds a month on the calendar from 2027-02-10", () => {
    setFakeSystemTime("2027-02-10T00:00:00Z");
    expect(getUnixIn({ months: 1 }, { epochUnit: "seconds" })).toBe(1804636800);
  });

  // 2027-01-31 plus a month has no 02-31: it clamps to 2027-02-28T00:00:00Z (TC39 constrain).
  it("clamps a missing day to the end of the month", () => {
    setFakeSystemTime("2027-01-31T00:00:00Z");
    expect(getUnixIn({ months: 1 }, { epochUnit: "seconds" })).toBe(1803772800);
  });

  // The month goes first and clamps to 2027-02-28; the day then counts from there: 2027-03-01.
  it("adds months, clamps, then days", () => {
    setFakeSystemTime("2027-01-31T00:00:00Z");
    expect(getUnixIn({ months: 1, days: 1 }, { epochUnit: "seconds" })).toBe(
      1803859200,
    );
  });

  // 1969-12-31T23:59:59.500Z: an epoch before 1970 floors toward the past, so -1, not 0.
  it("floors a second before 1970 toward the past", () => {
    setFakeSystemTime("1969-12-31T23:59:59.500Z");
    expect(getUnixIn({ seconds: 0 }, { epochUnit: "seconds" })).toBe(-1);
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
    expect(getUnixIn(units)).toBeNull();
  });

  it.each`
    options
    ${{ epochUnit: "minutes" }}
    ${"seconds"}
  `("returns null for options $options", ({ options }) => {
    expect(getUnixIn({ days: 1 }, options)).toBeNull();
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
    expect(getUnixIn(...(args as Parameters<typeof getUnixIn>))).toBeNull();
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "instant");
    expect(getUnixIn({ days: 1 })).not.toBeNull();
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns null for units that throw on any trap", () => {
    expect(getUnixIn(hostileProxy() as never)).toBeNull();
  });

  // Whole-second lengths agree with the pure route, under one fake time.
  it.each`
    units
    ${{ days: 90 }}
    ${{ years: 1 }}
    ${{ months: 1, days: 3 }}
    ${{ seconds: 3600 }}
  `("matches addUnix(getUnixNow(), $units)", ({ units }) => {
    expect(getUnixIn(units)).toBe(addUnix(getUnixNow() as number, units));
  });

  it("is getUnixNow() for a zero length", () => {
    expect(getUnixIn({ seconds: 0 })).toBe(getUnixNow());
  });
});
