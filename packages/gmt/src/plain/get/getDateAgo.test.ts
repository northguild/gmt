import type { MockedFunction } from "vitest";
import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { subtractDate } from "../calculate/subtractDate";
import { getDateAgo } from "./getDateAgo";
import { getToday } from "./getToday";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

// The fake clock is 2027-06-15T12:00:00Z and the system zone is UTC unless a row says otherwise.
const NOW = "2027-06-15T12:00:00Z";

describe("getDateAgo", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it.each`
    units           | expected
    ${{ days: 0 }}  | ${"2027-06-15"}
    ${{ days: -0 }} | ${"2027-06-15"}
    ${{ days: 90 }} | ${"2027-03-17"}
    ${{ weeks: 1 }} | ${"2027-06-08"}
  `("returns $expected for $units", ({ units, expected }) => {
    expect(getDateAgo(units)).toBe(expected);
  });

  // Months and years go first and clamp; days then count back from the clamped date.
  it.each`
    now                       | units                      | expected
    ${"2027-03-31T12:00:00Z"} | ${{ months: 1 }}           | ${"2027-02-28"}
    ${"2027-03-31T12:00:00Z"} | ${{ months: 1, days: 1 }}  | ${"2027-02-27"}
    ${"2028-02-29T12:00:00Z"} | ${{ years: 1 }}            | ${"2027-02-28"}
    ${"2028-03-31T12:00:00Z"} | ${{ years: 1, months: 1 }} | ${"2027-02-28"}
  `("clamps a missing day for $units from $now", ({ now, units, expected }) => {
    setFakeSystemTime(now);
    expect(getDateAgo(units)).toBe(expected);
  });

  // 23:30Z is already 16 June in Tokyo (UTC+9) and still 15 June in New York (UTC-4).
  it.each`
    timeZone              | expected
    ${"Asia/Tokyo"}       | ${"2027-06-15"}
    ${"America/New_York"} | ${"2027-06-14"}
  `("starts from today in system zone $timeZone", ({ timeZone, expected }) => {
    setFakeSystemTime("2027-06-15T23:30:00Z");
    timeZoneSpy.mockReturnValue(timeZone);
    expect(getDateAgo({ days: 1 })).toBe(expected);
  });

  it.each`
    units                     | label
    ${{}}                     | ${"{}"}
    ${{ hours: 36 }}          | ${"{ hours: 36 }"}
    ${{ days: 1, hours: 0 }}  | ${"{ days: 1, hours: 0 }"}
    ${{ fortnights: 1 }}      | ${"{ fortnights: 1 }"}
    ${"P1D"}                  | ${"'P1D'"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${{ days: 1.5 }}          | ${"{ days: 1.5 }"}
    ${{ days: -1 }}           | ${"{ days: -1 }"}
    ${{ years: 1, days: -1 }} | ${"{ years: 1, days: -1 }"}
    ${{ years: 300000 }}      | ${"{ years: 300000 }"}
  `("returns '' for units $label", ({ units }) => {
    expect(getDateAgo(units)).toBe("");
  });

  // The clock is read once, after the arguments are checked.
  it.each`
    args              | label
    ${[{}]}           | ${"units {}"}
    ${[{ hours: 1 }]} | ${"units { hours: 1 }"}
    ${[{ days: -1 }]} | ${"units { days: -1 }"}
    ${["P1D"]}        | ${"units 'P1D'"}
  `("does not read the clock for $label", ({ args }) => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getDateAgo(...(args as Parameters<typeof getDateAgo>))).toBe("");
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getDateAgo({ days: 1 })).not.toBe("");
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns '' for units that throw on any trap", () => {
    expect(getDateAgo(hostileProxy() as never)).toBe("");
  });

  it("returns '' when the system zone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getDateAgo({ days: 1 })).toBe("");
  });

  it("returns '' when Temporal.Now throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(getDateAgo({ days: 1 })).toBe("");
  });

  it.each`
    units
    ${{ days: 0 }}
    ${{ days: 90 }}
    ${{ weeks: 3 }}
    ${{ months: 1, days: 3 }}
    ${{ years: 1, months: 2 }}
  `("matches subtractDate(getToday(), $units)", ({ units }) => {
    expect(getDateAgo(units)).toBe(subtractDate(getToday(), units));
  });

  it.each`
    units
    ${{ months: 1 }}
    ${{ months: 1, days: 1 }}
    ${{ years: 1, months: 1 }}
  `(
    "matches subtractDate(getToday(), $units) on a day that clamps",
    ({ units }) => {
      setFakeSystemTime("2028-03-31T12:00:00Z");
      expect(getDateAgo(units)).toBe(subtractDate(getToday(), units));
    },
  );

  it("equals getToday() for a zero length", () => {
    expect(getDateAgo({ days: 0 })).toBe(getToday());
  });
});

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("getSystemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(getSystemTimeZone).mockReset();
  });

  it("returns the host's own zone again after a reset", () => {
    expect(getSystemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
