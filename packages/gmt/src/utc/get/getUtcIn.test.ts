import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { getUnixIn } from "../../unix/get/getUnixIn";
import { addUtc } from "../calculate/addUtc";
import { getUtcIn } from "./getUtcIn";
import { getUtcNow } from "./getUtcNow";

// The fake clock is 2027-06-15T12:00:00Z. The polyfill adds a nanosecond tail under it, so
// every string below holds only because the result is floored to whole seconds.
const NOW = "2027-06-15T12:00:00Z";

describe("getUtcIn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    units                    | expected
    ${{ days: 90 }}          | ${"2027-09-13T12:00:00Z"}
    ${{ years: 1 }}          | ${"2028-06-15T12:00:00Z"}
    ${{ days: 0 }}           | ${"2027-06-15T12:00:00Z"}
    ${{ days: -0 }}          | ${"2027-06-15T12:00:00Z"}
    ${{ seconds: 3600 }}     | ${"2027-06-15T13:00:00Z"}
    ${{ hours: 1, days: 1 }} | ${"2027-06-16T13:00:00Z"}
  `("returns $expected for $units", ({ units, expected }) => {
    expect(getUtcIn(units)).toBe(expected);
  });

  // 2027-01-31 plus a month has no 02-31: it clamps to 02-28 (TC39 constrain).
  it("clamps a missing day to the end of the month", () => {
    setFakeSystemTime("2027-01-31T12:00:00Z");
    expect(getUtcIn({ months: 1 })).toBe("2027-02-28T12:00:00Z");
  });

  // The month goes first and clamps to 02-28; the day then counts from there: 03-01.
  it("adds months, clamps, then days", () => {
    setFakeSystemTime("2027-01-31T12:00:00Z");
    expect(getUtcIn({ months: 1, days: 1 })).toBe("2027-03-01T12:00:00Z");
  });

  // An instant before 1970 floors toward the past: 23:59:59.500 names the second 23:59:59.
  it("floors a second before 1970 toward the past", () => {
    setFakeSystemTime("1969-12-31T23:59:59.500Z");
    expect(getUtcIn({ seconds: 0 })).toBe("1969-12-31T23:59:59Z");
  });

  it.each`
    units                     | label
    ${{}}                     | ${"{}"}
    ${{ fortnights: 1 }}      | ${"{ fortnights: 1 }"}
    ${"P1M"}                  | ${"'P1M'"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${{ days: 1.5 }}          | ${"{ days: 1.5 }"}
    ${{ days: -1 }}           | ${"{ days: -1 }"}
    ${{ years: 1, days: -1 }} | ${"{ years: 1, days: -1 }"}
    ${{ years: 300000 }}      | ${"{ years: 300000 }"}
  `("returns '' for units $label", ({ units }) => {
    expect(getUtcIn(units)).toBe("");
  });

  // The clock is read once, after the arguments are checked.
  it.each`
    args              | label
    ${[{}]}           | ${"units {}"}
    ${[{ days: -1 }]} | ${"units { days: -1 }"}
    ${["P1M"]}        | ${"units 'P1M'"}
  `("does not read the clock for $label", ({ args }) => {
    const clock = vi.spyOn(Temporal.Now, "instant");
    expect(getUtcIn(...(args as Parameters<typeof getUtcIn>))).toBe("");
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "instant");
    expect(getUtcIn({ days: 1 })).not.toBe("");
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns '' for units that throw on any trap", () => {
    expect(getUtcIn(hostileProxy() as never)).toBe("");
  });

  it.each`
    units
    ${{ days: 90 }}
    ${{ years: 1 }}
    ${{ months: 1, days: 3 }}
    ${{ seconds: 3600 }}
  `("names the same second as getUnixIn for $units", ({ units }) => {
    expect(
      Temporal.Instant.from(getUtcIn(units)).epochMilliseconds / 1000,
    ).toBe(getUnixIn(units, { epochUnit: "seconds" }));
  });

  it.each`
    units
    ${{ days: 90 }}
    ${{ months: 1 }}
  `("matches addUtc(getUtcNow(), $units) to the second", ({ units }) => {
    expect(getUtcIn(units)).toBe(
      addUtc(getUtcNow(), units).replace(/\.\d+Z$/, "Z"),
    );
  });
});
