import type { MockedFunction } from "vitest";
import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { systemTimeZone } from "../../internal/resolveLocale";
import { subtractTime } from "../calculate/subtractTime";
import { getTimeAgo } from "./getTimeAgo";
import { getNow } from "./getNow";

vi.mock("../../internal/resolveLocale", { spy: true });

// The fake clock is 2027-06-15T12:00:00Z and the system zone is UTC unless a row says otherwise.
const NOW = "2027-06-15T12:00:00Z";

describe("getTimeAgo", () => {
  let timeZoneSpy: MockedFunction<typeof systemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
    timeZoneSpy = vi.mocked(systemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  // A plain time wraps at midnight and carries no date (Temporal AddDurationToTime).
  it.each`
    now                       | units                     | expected
    ${"2027-06-15T00:30:00Z"} | ${{ hours: 1 }}           | ${"23:30:00"}
    ${"2027-06-15T12:00:00Z"} | ${{ hours: 36 }}          | ${"00:00:00"}
    ${"2027-06-15T12:00:00Z"} | ${{ seconds: 1 }}         | ${"11:59:59"}
    ${"2027-06-15T12:00:00Z"} | ${{ hours: 0 }}           | ${"12:00:00"}
    ${"2027-06-15T12:00:00Z"} | ${{ milliseconds: 1500 }} | ${"11:59:58"}
  `("returns $expected for $units at $now", ({ now, units, expected }) => {
    setFakeSystemTime(now);
    expect(getTimeAgo(units)).toBe(expected);
  });

  // 23:30Z is 08:30 in Tokyo (UTC+9) and 19:30 in New York (UTC-4): the wall clock of the system zone.
  it.each`
    timeZone              | expected
    ${"Asia/Tokyo"}       | ${"08:30:00"}
    ${"America/New_York"} | ${"19:30:00"}
  `(
    "starts from the wall clock of system zone $timeZone",
    ({ timeZone, expected }) => {
      setFakeSystemTime("2027-06-15T23:30:00Z");
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getTimeAgo({ minutes: 0 })).toBe(expected);
    },
  );

  it.each`
    units                    | label
    ${{}}                    | ${"{}"}
    ${{ days: 1 }}           | ${"{ days: 1 }"}
    ${{ days: 0 }}           | ${"{ days: 0 }"}
    ${{ hours: 1, days: 0 }} | ${"{ hours: 1, days: 0 }"}
    ${{ fortnights: 1 }}     | ${"{ fortnights: 1 }"}
    ${"PT1H"}                | ${"'PT1H'"}
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${{ hours: 1.5 }}        | ${"{ hours: 1.5 }"}
    ${{ hours: -1 }}         | ${"{ hours: -1 }"}
    ${{ hours: 1e15 }}       | ${"{ hours: 1e15 }"}
    ${{ hours: 1e20 }}       | ${"{ hours: 1e20 }"}
  `("returns '' for units $label", ({ units }) => {
    expect(getTimeAgo(units)).toBe("");
  });

  // The clock is read once, after the arguments are checked.
  it.each`
    args               | label
    ${[{}]}            | ${"units {}"}
    ${[{ days: 1 }]}   | ${"units { days: 1 }"}
    ${[{ hours: -1 }]} | ${"units { hours: -1 }"}
    ${["PT1H"]}        | ${"units 'PT1H'"}
  `("does not read the clock for $label", ({ args }) => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getTimeAgo(...(args as Parameters<typeof getTimeAgo>))).toBe("");
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getTimeAgo({ hours: 1 })).not.toBe("");
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns '' for units that throw on any trap", () => {
    expect(getTimeAgo(hostileProxy() as never)).toBe("");
  });

  it("returns '' when the system zone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getTimeAgo({ hours: 1 })).toBe("");
  });

  it("returns '' when Temporal.Now throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(getTimeAgo({ hours: 1 })).toBe("");
  });

  it.each`
    units
    ${{ hours: 0 }}
    ${{ minutes: 15 }}
    ${{ hours: 1, minutes: 30 }}
    ${{ hours: 36 }}
    ${{ seconds: 59, milliseconds: 999 }}
  `(
    "matches subtractTime(getNow().slice(11, 19), $units) to the second",
    ({ units }) => {
      expect(getTimeAgo(units)).toBe(
        subtractTime(getNow().slice(11, 19), units).slice(0, 8),
      );
    },
  );
});

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("systemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(systemTimeZone).mockReset();
  });

  it("returns the host's own zone again after a reset", () => {
    expect(systemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
