import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { getUnixIn } from "../../unix/get/getUnixIn";
import { totalUnitsFromNow } from "./totalUnitsFromNow";

// The fake clock is 2027-06-15T12:00:00Z unless a row sets another.
const NOW = "2027-06-15T12:00:00Z";

describe("totalUnitsFromNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Calendar lengths are measured from now (TC39 Duration.prototype.total with a zoned relativeTo).
  // 2027-06-15 to 2028-06-15 spans 29 February 2028: 366 days = 31622400 s.
  it.each`
    now                       | units                     | unit              | options                         | expected       | why
    ${NOW}                    | ${{ years: 1 }}           | ${"seconds"}      | ${undefined}                    | ${31622400}    | ${"366 days: the year holds 29 Feb 2028"}
    ${"2026-06-15T12:00:00Z"} | ${{ years: 1 }}           | ${"seconds"}      | ${undefined}                    | ${31536000}    | ${"365 days"}
    ${"2028-02-29T12:00:00Z"} | ${{ years: 1 }}           | ${"seconds"}      | ${undefined}                    | ${31536000}    | ${"29 Feb 2028 + 1 year clamps to 28 Feb 2029, 365 days"}
    ${"2027-02-10T12:00:00Z"} | ${{ months: 1 }}          | ${"seconds"}      | ${undefined}                    | ${2419200}     | ${"February 2027 has 28 days"}
    ${"2027-03-10T12:00:00Z"} | ${{ months: 1 }}          | ${"seconds"}      | ${undefined}                    | ${2678400}     | ${"31 days"}
    ${"2027-01-31T12:00:00Z"} | ${{ months: 1 }}          | ${"seconds"}      | ${undefined}                    | ${2419200}     | ${"31 Jan + 1 month clamps to 28 Feb: 28 days"}
    ${NOW}                    | ${{ days: 90 }}           | ${"seconds"}      | ${undefined}                    | ${7776000}     | ${"90 x 86400"}
    ${"2026-03-28T11:00:00Z"} | ${{ days: 1 }}            | ${"seconds"}      | ${{ timeZone: "Europe/Paris" }} | ${82800}       | ${"Paris 29 Mar 2026 spring forward: a 23-hour day"}
    ${"2026-03-28T11:00:00Z"} | ${{ days: 1 }}            | ${"seconds"}      | ${undefined}                    | ${86400}       | ${"UTC has no clock change"}
    ${NOW}                    | ${{ days: 1 }}            | ${"second"}       | ${undefined}                    | ${86400}       | ${"singular unit name"}
    ${NOW}                    | ${{ years: 1 }}           | ${"days"}         | ${undefined}                    | ${366}         | ${"leap year ahead"}
    ${NOW}                    | ${{ years: 1 }}           | ${"milliseconds"} | ${undefined}                    | ${31622400000} | ${"366 x 86400000"}
    ${NOW}                    | ${{ milliseconds: 1500 }} | ${"seconds"}      | ${undefined}                    | ${1.5}         | ${"fractional, unrounded"}
    ${NOW}                    | ${{ hours: 36 }}          | ${"days"}         | ${undefined}                    | ${1.5}         | ${"36 h = 1.5 d"}
    ${NOW}                    | ${{ days: 1 }}            | ${"seconds"}      | ${{ timeZone: "+05:30" }}       | ${86400}       | ${"a fixed offset has no clock change"}
    ${NOW}                    | ${{ days: 0 }}            | ${"seconds"}      | ${undefined}                    | ${0}           | ${"a zero length"}
    ${NOW}                    | ${{ days: -0 }}           | ${"seconds"}      | ${undefined}                    | ${0}           | ${"-0 counts as zero"}
  `(
    "returns $expected for $units in $unit with options $options at $now ($why)",
    ({ now, units, unit, options, expected }) => {
      setFakeSystemTime(now);
      expect(totalUnitsFromNow(units, unit, options)).toBe(expected);
    },
  );

  // Every spelling the signature takes, singular and plural, for one day at 2027-06-15T12:00:00Z.
  // Day, hour and finer totals are exact; weeks, months and years divide one day by the 7 days, the
  // 30 days (15 Jun to 15 Jul) and the 366 days (15 Jun 2027 to 15 Jun 2028) they hold.
  it.each`
    unit              | expected
    ${"years"}        | ${1 / 366}
    ${"year"}         | ${1 / 366}
    ${"months"}       | ${1 / 30}
    ${"month"}        | ${1 / 30}
    ${"weeks"}        | ${1 / 7}
    ${"week"}         | ${1 / 7}
    ${"days"}         | ${1}
    ${"day"}          | ${1}
    ${"hours"}        | ${24}
    ${"hour"}         | ${24}
    ${"minutes"}      | ${1440}
    ${"minute"}       | ${1440}
    ${"seconds"}      | ${86400}
    ${"second"}       | ${86400}
    ${"milliseconds"} | ${86400000}
    ${"millisecond"}  | ${86400000}
    ${"microseconds"} | ${86400000000}
    ${"microsecond"}  | ${86400000000}
    ${"nanoseconds"}  | ${86400000000000}
    ${"nanosecond"}   | ${86400000000000}
  `("totals one day in $unit as $expected", ({ unit, expected }) => {
    expect(totalUnitsFromNow({ days: 1 }, unit)).toBeCloseTo(expected, 12);
  });

  // New York leaves daylight time on 2024-11-03 at 06:00Z, so 01:00-02:00 local happens twice.
  // 06:30Z is the second pass (01:30 EST); 05:30Z is the first (01:30 EDT).
  // A day from the second pass is 24 h (01:30 EST next day); from the first pass the same wall
  // time is 25 h on, so 90000 s.
  it.each`
    now                       | units                         | unit         | expected    | why
    ${"2024-11-03T06:30:00Z"} | ${{ days: 1 }}                | ${"seconds"} | ${86400}    | ${"later pass of the repeated hour"}
    ${"2024-11-03T06:30:00Z"} | ${{ days: 1 }}                | ${"days"}    | ${1}        | ${"later pass, in days"}
    ${"2024-11-03T06:30:00Z"} | ${{ days: 1 }}                | ${"hours"}   | ${24}       | ${"later pass, in hours"}
    ${"2024-11-03T06:30:00Z"} | ${{ years: 1 }}               | ${"seconds"} | ${31536000} | ${"later pass, a year of 365 days"}
    ${"2024-11-03T06:30:00Z"} | ${{ hours: 24 }}              | ${"days"}    | ${1}        | ${"later pass, 24 h is one day"}
    ${"2024-11-03T05:30:00Z"} | ${{ days: 1 }}                | ${"seconds"} | ${90000}    | ${"earlier pass: the day holds the extra hour"}
    ${"2024-11-03T05:30:00Z"} | ${{ days: 1 }}                | ${"hours"}   | ${25}       | ${"earlier pass, the day holds 25 hours"}
    ${"2024-11-03T05:30:00Z"} | ${{ days: 1 }}                | ${"days"}    | ${1}        | ${"earlier pass, a day is a day"}
    ${"2024-11-03T05:30:00Z"} | ${{ hours: 24 }}              | ${"days"}    | ${0.96}     | ${"earlier pass: 24 h of a 25-hour day"}
    ${"2024-11-03T06:30:00Z"} | ${{ hours: 12 }}              | ${"days"}    | ${0.5}      | ${"later pass: 12 h of a 24-hour day (the polyfill alone says 0.52)"}
    ${"2024-11-03T05:59:59Z"} | ${{ days: 1 }}                | ${"seconds"} | ${90000}    | ${"last second of the earlier pass"}
    ${"2024-11-03T06:00:00Z"} | ${{ days: 1 }}                | ${"seconds"} | ${86400}    | ${"first second of the later pass"}
    ${"2024-11-02T05:30:00Z"} | ${{ hours: 24, minutes: 30 }} | ${"days"}    | ${null}     | ${"no specified value (tc39/proposal-temporal#3336)"}
    ${"2024-11-02T05:30:00Z"} | ${{ hours: 24, minutes: 30 }} | ${"seconds"} | ${88200}    | ${"exact seconds are defined"}
  `(
    "returns $expected for $units in $unit at $now in New York ($why)",
    ({ now, units, unit, expected }) => {
      setFakeSystemTime(now);
      expect(
        totalUnitsFromNow(units, unit, { timeZone: "America/New_York" }),
      ).toBe(expected);
    },
  );

  it.each`
    units
    ${{}}
    ${{ fortnights: 1 }}
    ${"P1Y"}
    ${null}
    ${undefined}
    ${[]}
    ${{ days: Infinity }}
    ${{ days: 1.5 }}
    ${{ days: -1 }}
    ${{ years: 1, days: -1 }}
    ${{ years: 300000 }}
  `("returns null for units $units", ({ units }) => {
    expect(totalUnitsFromNow(units, "seconds")).toBeNull();
  });

  it.each`
    unit
    ${"fortnights"}
    ${""}
  `("returns null for unit '$unit'", ({ unit }) => {
    expect(totalUnitsFromNow({ days: 1 }, unit)).toBeNull();
  });

  it.each`
    unit
    ${"Seconds"}
    ${"secondss"}
    ${"s"}
    ${" seconds"}
    ${"ms"}
  `("returns null for the misspelt unit '$unit'", ({ unit }) => {
    expect(totalUnitsFromNow({ days: 1 }, unit)).toBeNull();
  });

  it("returns null for a unit that is null", () => {
    expect(totalUnitsFromNow({ days: 1 }, null as never)).toBeNull();
  });

  it("returns null for an unknown time zone", () => {
    expect(
      totalUnitsFromNow({ days: 1 }, "seconds", { timeZone: "Mars/Olympus" }),
    ).toBeNull();
  });

  it("returns null for options that are not an object", () => {
    expect(
      totalUnitsFromNow({ days: 1 }, "seconds", "UTC" as never),
    ).toBeNull();
  });

  it.each`
    name               | make
    ${"hostile units"} | ${hostileProxy}
    ${"revoked units"} | ${revokedProxy}
  `("returns null for $name", ({ make }) => {
    expect(totalUnitsFromNow(make() as never, "seconds")).toBeNull();
  });

  it("returns null for hostile options", () => {
    expect(
      totalUnitsFromNow({ days: 1 }, "seconds", hostileProxy() as never),
    ).toBeNull();
  });

  // A seconds total from now is the gap between two Unix epochs read at one fixed time.
  it.each`
    units
    ${{ years: 1 }}
    ${{ months: 1 }}
    ${{ days: 90 }}
    ${{ months: 1, days: 1, hours: 13 }}
  `(
    "equals the getUnixIn gap in seconds for $units",
    ({ units }: { units: Parameters<typeof getUnixIn>[0] }) => {
      expect(totalUnitsFromNow(units, "seconds")).toBe(
        (getUnixIn(units, { epochUnit: "seconds" }) as number) -
          (getUnixIn({ seconds: 0 }, { epochUnit: "seconds" }) as number),
      );
    },
  );
});
