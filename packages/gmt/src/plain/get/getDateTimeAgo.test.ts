import type { MockedFunction } from "vitest";
import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { subtractDateTime } from "../calculate/subtractDateTime";
import { getDateTimeAgo } from "./getDateTimeAgo";
import { getNow } from "./getNow";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

// The fake clock is 2027-06-15T12:00:00Z and the system zone is UTC unless a row says otherwise.
const NOW = "2027-06-15T12:00:00Z";

describe("getDateTimeAgo", () => {
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
    units                     | expected
    ${{ days: 0 }}            | ${"2027-06-15T12:00:00"}
    ${{ days: -0 }}           | ${"2027-06-15T12:00:00"}
    ${{ days: 90 }}           | ${"2027-03-17T12:00:00"}
    ${{ hours: 36 }}          | ${"2027-06-14T00:00:00"}
    ${{ milliseconds: 1500 }} | ${"2027-06-15T11:59:58"}
  `("returns $expected for $units", ({ units, expected }) => {
    expect(getDateTimeAgo(units)).toBe(expected);
  });

  // One month before 31 March is 28 February (Temporal RegulateISODate clamp), then 13 hours
  // before 12:00 is 23:00 the day before.
  it("clamps, then subtracts the time, for { months: 1, hours: 13 }", () => {
    setFakeSystemTime("2027-03-31T12:00:00Z");
    expect(getDateTimeAgo({ months: 1, hours: 13 })).toBe(
      "2027-02-27T23:00:00",
    );
  });

  // Wall-clock arithmetic: 02:30 on 10 March 2024 does not exist in New York (clocks jump
  // 02:00 to 03:00), and a plain datetime has no gap, so the result names it anyway.
  it("names a wall time that does not exist in the system zone", () => {
    setFakeSystemTime("2024-03-11T06:30:00Z"); // 02:30 EDT on 11 March
    timeZoneSpy.mockReturnValue("America/New_York");
    expect(getDateTimeAgo({ days: 1 })).toBe("2024-03-10T02:30:00");
  });

  // The clock reads 12:00:00.5; one hour before is 11:00:00.5, written as whole seconds, floored.
  it("floors the sub-second part", () => {
    setFakeSystemTime("2027-06-15T12:00:00.500Z");
    expect(getDateTimeAgo({ hours: 1 })).toBe("2027-06-15T11:00:00");
  });

  // 23:30Z is 08:30 on 16 June in Tokyo (UTC+9) and 19:30 on 15 June in New York (UTC-4).
  it.each`
    timeZone              | expected
    ${"Asia/Tokyo"}       | ${"2027-06-16T07:30:00"}
    ${"America/New_York"} | ${"2027-06-15T18:30:00"}
  `(
    "starts from the wall clock of system zone $timeZone",
    ({ timeZone, expected }) => {
      setFakeSystemTime("2027-06-15T23:30:00Z");
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getDateTimeAgo({ hours: 1 })).toBe(expected);
    },
  );

  it.each`
    units                     | label
    ${{}}                     | ${"{}"}
    ${{ fortnights: 1 }}      | ${"{ fortnights: 1 }"}
    ${"P1D"}                  | ${"'P1D'"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${{ days: 1.5 }}          | ${"{ days: 1.5 }"}
    ${{ days: -1 }}           | ${"{ days: -1 }"}
    ${{ years: 1, days: -1 }} | ${"{ years: 1, days: -1 }"}
    ${{ years: 300000 }}      | ${"{ years: 300000 }"}
  `("returns '' for units $label", ({ units }) => {
    expect(getDateTimeAgo(units)).toBe("");
  });

  // The clock is read once, after the arguments are checked.
  it.each`
    args              | label
    ${[{}]}           | ${"units {}"}
    ${[{ days: -1 }]} | ${"units { days: -1 }"}
    ${["P1M"]}        | ${"units 'P1M'"}
  `("does not read the clock for $label", ({ args }) => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getDateTimeAgo(...(args as Parameters<typeof getDateTimeAgo>))).toBe(
      "",
    );
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getDateTimeAgo({ days: 1 })).not.toBe("");
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns '' for units that throw on any trap", () => {
    expect(getDateTimeAgo(hostileProxy() as never)).toBe("");
  });

  it("returns '' when the system zone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getDateTimeAgo({ days: 1 })).toBe("");
  });

  it("returns '' when Temporal.Now throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(getDateTimeAgo({ days: 1 })).toBe("");
  });

  it.each`
    units
    ${{ months: 1 }}
    ${{ months: 1, hours: 13 }}
    ${{ years: 1, months: 1, days: 1 }}
  `(
    "matches subtractDateTime(getNow(), $units) to the second on a day that clamps",
    ({ units }) => {
      setFakeSystemTime("2028-03-31T12:00:00Z");
      expect(getDateTimeAgo(units)).toBe(
        subtractDateTime(getNow(), units).slice(0, 19),
      );
    },
  );

  it.each`
    units
    ${{ days: 0 }}
    ${{ days: 90 }}
    ${{ hours: 36 }}
    ${{ months: 1, days: 3, minutes: 5 }}
    ${{ years: 1, months: 2, seconds: 59 }}
  `("matches subtractDateTime(getNow(), $units) to the second", ({ units }) => {
    expect(getDateTimeAgo(units)).toBe(
      subtractDateTime(getNow(), units).slice(0, 19),
    );
  });
});
