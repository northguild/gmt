import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { getUnixAgo } from "../../unix/get/getUnixAgo";
import { subtractUtc } from "../calculate/subtractUtc";
import { formatHttpDate } from "../format/formatHttpDate";
import { getUtcAgo } from "./getUtcAgo";
import { getUtcNow } from "./getUtcNow";

// The fake clock is 2027-06-15T12:00:00Z. The polyfill adds a nanosecond tail under it, so
// every string below holds only because the result is floored to whole seconds.
const NOW = "2027-06-15T12:00:00Z";

describe("getUtcAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    units                | expected
    ${{ days: 90 }}      | ${"2027-03-17T12:00:00Z"}
    ${{ years: 1 }}      | ${"2026-06-15T12:00:00Z"}
    ${{ days: 1 }}       | ${"2027-06-14T12:00:00Z"}
    ${{ days: 0 }}       | ${"2027-06-15T12:00:00Z"}
    ${{ days: -0 }}      | ${"2027-06-15T12:00:00Z"}
    ${{ seconds: 3600 }} | ${"2027-06-15T11:00:00Z"}
    ${{ years: 2028 }}   | ${"-000001-06-15T12:00:00Z"}
  `("returns $expected for $units", ({ units, expected }) => {
    expect(getUtcAgo(units)).toBe(expected);
  });

  // Months first (03-31 to 02-28, clamped), then days (02-27), then hours (02-26T23:00).
  it("subtracts months, clamps, then days and hours", () => {
    setFakeSystemTime("2027-03-31T12:00:00Z");
    expect(getUtcAgo({ months: 1, days: 1, hours: 13 })).toBe(
      "2027-02-26T23:00:00Z",
    );
  });

  // The month goes first and clamps to 02-28; the day then counts back from there: 02-27.
  it("subtracts months, clamps, then days", () => {
    setFakeSystemTime("2027-03-31T12:00:00Z");
    expect(getUtcAgo({ months: 1, days: 1 })).toBe("2027-02-27T12:00:00Z");
  });

  it.each`
    units
    ${{ months: 1 }}
    ${{ months: 1, days: 1 }}
    ${{ years: 1, months: 1 }}
  `(
    "matches subtractUtc(getUtcNow(), $units) on a day that clamps",
    ({ units }) => {
      setFakeSystemTime("2028-03-31T12:00:00Z");
      expect(getUtcAgo(units)).toBe(
        subtractUtc(getUtcNow(), units).replace(/\.\d+Z$/, "Z"),
      );
    },
  );

  // An instant before 1970 floors toward the past: 23:59:59.500 names the second 23:59:59.
  it("floors a second before 1970 toward the past", () => {
    setFakeSystemTime("1969-12-31T23:59:59.500Z");
    expect(getUtcAgo({ seconds: 0 })).toBe("1969-12-31T23:59:59Z");
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
    expect(getUtcAgo(units)).toBe("");
  });

  // The clock is read once, after the arguments are checked.
  it.each`
    args              | label
    ${[{}]}           | ${"units {}"}
    ${[{ days: -1 }]} | ${"units { days: -1 }"}
    ${["P1M"]}        | ${"units 'P1M'"}
  `("does not read the clock for $label", ({ args }) => {
    const clock = vi.spyOn(Temporal.Now, "instant");
    expect(getUtcAgo(...(args as Parameters<typeof getUtcAgo>))).toBe("");
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "instant");
    expect(getUtcAgo({ days: 1 })).not.toBe("");
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns '' for units that throw on any trap", () => {
    expect(getUtcAgo(hostileProxy() as never)).toBe("");
  });

  it.each`
    units
    ${{ days: 90 }}
    ${{ years: 1 }}
    ${{ months: 1, days: 3 }}
    ${{ seconds: 3600 }}
  `("names the same second as getUnixAgo for $units", ({ units }) => {
    expect(
      Temporal.Instant.from(getUtcAgo(units)).epochMilliseconds / 1000,
    ).toBe(getUnixAgo(units, { epochUnit: "seconds" }));
  });

  it.each`
    units
    ${{ days: 90 }}
    ${{ months: 1 }}
  `("matches subtractUtc(getUtcNow(), $units) to the second", ({ units }) => {
    expect(getUtcAgo(units)).toBe(
      subtractUtc(getUtcNow(), units).replace(/\.\d+Z$/, "Z"),
    );
  });

  // RFC 6265 §4.1.2.1: a past Expires deletes the cookie.
  it("feeds formatHttpDate for a cookie delete", () => {
    expect(formatHttpDate(getUtcAgo({ days: 1 }))).toBe(
      "Mon, 14 Jun 2027 12:00:00 GMT",
    );
  });
});
