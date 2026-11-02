import { Temporal } from "../../internal/temporal";
import { hostileProxy } from "../../test/hostileValues";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { addZoned } from "../calculate/addZoned";
import { getZonedIn } from "./getZonedIn";
import { getZonedNow } from "./getZonedNow";

// The fake clock is 2027-06-15T12:00:00Z. The polyfill adds a nanosecond tail under it, so
// every string below holds only because the result is floored to whole seconds.
const NOW = "2027-06-15T12:00:00Z";
const NY = "America/New_York";

describe("getZonedIn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each`
    zone            | units           | expected
    ${"UTC"}        | ${{ days: 0 }}  | ${"2027-06-15T12:00:00+00:00[UTC]"}
    ${"UTC"}        | ${{ days: -0 }} | ${"2027-06-15T12:00:00+00:00[UTC]"}
    ${"Asia/Tokyo"} | ${{ days: 90 }} | ${"2027-09-13T21:00:00+09:00[Asia/Tokyo]"}
    ${"+05:30"}     | ${{ days: 1 }}  | ${"2027-06-16T17:30:00+05:30[+05:30]"}
  `("returns $expected for $zone and $units", ({ zone, units, expected }) => {
    expect(getZonedIn(zone, units)).toBe(expected);
  });

  // Calendar units count on the wall clock of the zone and clamp a missing day (Temporal
  // RegulateISODate), then days count from the clamped date. 12:00Z is 21:00 in Tokyo (UTC+9).
  // The last row is 01:00 on 1 February in Tokyo but still 31 January in UTC: it clamps to
  // 1 March only if the month is added on the zone's own date.
  it.each`
    now                       | units                     | expected
    ${"2027-01-31T12:00:00Z"} | ${{ months: 1 }}          | ${"2027-02-28T21:00:00+09:00[Asia/Tokyo]"}
    ${"2027-01-31T12:00:00Z"} | ${{ months: 1, days: 1 }} | ${"2027-03-01T21:00:00+09:00[Asia/Tokyo]"}
    ${"2027-01-31T16:00:00Z"} | ${{ months: 1 }}          | ${"2027-03-01T01:00:00+09:00[Asia/Tokyo]"}
  `(
    "clamps a missing day in Asia/Tokyo from $now for $units",
    ({ now, units, expected }) => {
      setFakeSystemTime(now);
      expect(getZonedIn("Asia/Tokyo", units)).toBe(expected);
    },
  );

  // The clock is read once, after the arguments are checked.
  it.each`
    zone              | units           | label
    ${"Mars/Olympus"} | ${{ days: 1 }}  | ${"zone 'Mars/Olympus'"}
    ${"UTC"}          | ${{}}           | ${"units {}"}
    ${"UTC"}          | ${{ days: -1 }} | ${"units { days: -1 }"}
    ${"UTC"}          | ${"P1D"}        | ${"units 'P1D'"}
  `("does not read the clock for $label", ({ zone, units }) => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getZonedIn(zone, units)).toBe("");
    expect(clock).not.toHaveBeenCalled();
  });

  it("reads the clock once for a valid length", () => {
    const clock = vi.spyOn(Temporal.Now, "zonedDateTimeISO");
    expect(getZonedIn("UTC", { days: 1 })).not.toBe("");
    expect(clock).toHaveBeenCalledTimes(1);
  });

  // Gap: 2024-03-10 02:30 does not exist in New York, so "compatible" moves it later to 03:30.
  // Repeat: 2024-11-03 01:30 happens twice, and "compatible" takes the earlier, -04:00.
  it.each`
    now                       | units          | expected
    ${"2024-03-09T07:30:00Z"} | ${{ days: 1 }} | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-11-02T05:30:00Z"} | ${{ days: 1 }} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
  `(
    "returns $expected in America/New_York from $now for $units",
    ({ now, units, expected }) => {
      setFakeSystemTime(now);
      expect(getZonedIn(NY, units)).toBe(expected);
    },
  );

  // Now is 01:30 -05:00, the second pass of the repeated hour. A length with no date part counts
  // exact time; a date part resolves the new wall time on its own day.
  it.each`
    now                       | units           | expected
    ${"2024-11-03T06:30:00Z"} | ${{ days: 0 }}  | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-03T06:30:00Z"} | ${{ hours: 1 }} | ${"2024-11-03T02:30:00-05:00[America/New_York]"}
    ${"2024-11-03T06:30:00Z"} | ${{ days: 1 }}  | ${"2024-11-04T01:30:00-05:00[America/New_York]"}
    ${"2024-11-03T05:30:00Z"} | ${{ hours: 1 }} | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
  `(
    "returns $expected from $now for $units inside the repeated hour",
    ({ now, units, expected }) => {
      setFakeSystemTime(now);
      expect(getZonedIn(NY, units)).toBe(expected);
    },
  );

  it.each`
    zone              | label
    ${"Mars/Olympus"} | ${"'Mars/Olympus'"}
    ${"-00:44:30"}    | ${"'-00:44:30'"}
    ${""}             | ${"''"}
    ${null}           | ${"null"}
    ${undefined}      | ${"undefined"}
    ${42}             | ${"42"}
  `("returns '' for zone $label", ({ zone }) => {
    expect(getZonedIn(zone, { days: 1 })).toBe("");
  });

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
    expect(getZonedIn("UTC", units)).toBe("");
  });

  it("returns '' for units that throw on any trap", () => {
    expect(getZonedIn("UTC", hostileProxy() as never)).toBe("");
  });

  it("returns '' when the clock throws", () => {
    mockTemporalNowZonedDateTimeISOThrow();
    expect(getZonedIn(NY, { days: 1 })).toBe("");
  });

  it.each`
    zone              | units
    ${"UTC"}          | ${{ days: 90 }}
    ${"Asia/Tokyo"}   | ${{ months: 1, days: 3 }}
    ${"Pacific/Apia"} | ${{ years: 1 }}
    ${"+05:30"}       | ${{ hours: 36 }}
  `(
    "matches addZoned of the current time for $zone and $units",
    ({ zone, units }) => {
      const now = getZonedNow(zone, { smallestUnit: "second" });
      expect(getZonedIn(zone, units)).toBe(addZoned(now, units));
    },
  );

  it.each`
    zone              | units
    ${"UTC"}          | ${{ months: 1 }}
    ${"Asia/Tokyo"}   | ${{ months: 1, days: 1 }}
    ${"Pacific/Apia"} | ${{ years: 1, months: 1 }}
  `(
    "matches addZoned on a day that clamps for $zone and $units",
    ({ zone, units }) => {
      setFakeSystemTime("2027-01-31T12:00:00Z");
      const now = getZonedNow(zone, { smallestUnit: "second" });
      expect(getZonedIn(zone, units)).toBe(addZoned(now, units));
    },
  );
});
