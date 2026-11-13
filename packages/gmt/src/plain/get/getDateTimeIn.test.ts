import type { MockedFunction } from "vitest";
import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { systemTimeZone } from "../../internal/resolveLocale";
import { addDateTime } from "../calculate/addDateTime";
import { getDateTimeIn } from "./getDateTimeIn";
import { getNow } from "./getNow";

vi.mock("../../internal/resolveLocale", { spy: true });

// The fake clock is 2027-06-15T12:00:00Z and the system zone is UTC unless a row says otherwise.
const NOW = "2027-06-15T12:00:00Z";

describe("getDateTimeIn", () => {
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

  it.each`
    units                     | expected
    ${{ days: 0 }}            | ${"2027-06-15T12:00:00"}
    ${{ days: -0 }}           | ${"2027-06-15T12:00:00"}
    ${{ days: 90 }}           | ${"2027-09-13T12:00:00"}
    ${{ hours: 36 }}          | ${"2027-06-17T00:00:00"}
    ${{ milliseconds: 1500 }} | ${"2027-06-15T12:00:01"}
    ${{ years: 8000 }}        | ${"+010027-06-15T12:00:00"}
  `("returns $expected for $units", ({ units, expected }) => {
    expect(getDateTimeIn(units)).toBe(expected);
  });

  // 31 January plus a month has no 31 February: it clamps to 28 February (Temporal
  // RegulateISODate), and the time of day is kept.
  it("clamps a missing day for { months: 1 }", () => {
    setFakeSystemTime("2027-01-31T12:00:00Z");
    expect(getDateTimeIn({ months: 1 })).toBe("2027-02-28T12:00:00");
  });

  // Wall-clock arithmetic: 02:30 on 10 March 2024 does not exist in New York (clocks jump
  // 02:00 to 03:00), and a plain datetime has no gap, so the result names it anyway.
  it("names a wall time that does not exist in the system zone", () => {
    setFakeSystemTime("2024-03-09T07:30:00Z"); // 02:30 EST on 9 March
    timeZoneSpy.mockReturnValue("America/New_York");
    expect(getDateTimeIn({ days: 1 })).toBe("2024-03-10T02:30:00");
  });

  // 23:30Z is already 16 June in Tokyo (UTC+9, 08:30) and still 15 June in New York (UTC-4, 19:30).
  it.each`
    timeZone              | expected
    ${"Asia/Tokyo"}       | ${"2027-06-16T08:30:00"}
    ${"America/New_York"} | ${"2027-06-15T19:30:00"}
  `(
    "starts from the wall clock of system zone $timeZone",
    ({ timeZone, expected }) => {
      setFakeSystemTime("2027-06-15T23:30:00Z");
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getDateTimeIn({ days: 0 })).toBe(expected);
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
    expect(getDateTimeIn(units)).toBe("");
  });

  // The clock is read once, after the arguments are checked.
  it.each`
    args              | label
    ${[{}]}           | ${"units {}"}
    ${[{ days: -1 }]} | ${"units { days: -1 }"}
    ${["P1M"]}        | ${"units 'P1M'"}
  `("does not read the clock for $label", ({ args }) => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getDateTimeIn(...(args as Parameters<typeof getDateTimeIn>))).toBe(
      "",
    );
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getDateTimeIn({ days: 1 })).not.toBe("");
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("returns '' for units that throw on any trap", () => {
    expect(getDateTimeIn(hostileProxy() as never)).toBe("");
  });

  it("returns '' when the system zone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getDateTimeIn({ days: 1 })).toBe("");
  });

  it("returns '' when Temporal.Now throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(getDateTimeIn({ days: 1 })).toBe("");
  });

  it.each`
    units
    ${{ days: 0 }}
    ${{ days: 90 }}
    ${{ hours: 36 }}
    ${{ months: 1, days: 3, minutes: 5 }}
    ${{ years: 1, months: 2, seconds: 59 }}
  `("matches addDateTime(getNow(), $units) to the second", ({ units }) => {
    expect(getDateTimeIn(units)).toBe(
      addDateTime(getNow(), units).slice(0, 19),
    );
  });

  it("equals getNow() to the second for a zero length", () => {
    expect(getDateTimeIn({ days: 0 })).toBe(getNow().slice(0, 19));
  });
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
