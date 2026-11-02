import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { nowInstant } from "../../internal/temporalCompat";
import { getUnixIn } from "../../unix/get/getUnixIn";
import { getUtcIn } from "../../utc/get/getUtcIn";
import { formatHttpDateFromNow } from "../../utc/format/formatHttpDateFromNow";
import { totalUnitsFromNow } from "./totalUnitsFromNow";
import { ttlFromNow } from "./ttlFromNow";

vi.mock("../../internal/temporalCompat", { spy: true });

// The fake clock is 2027-06-15T12:00:00Z (Unix 1813060800) unless a row sets another. The polyfill
// adds a nanosecond tail under it, so a fractional length shows the rounding of each field.
const NOW = "2027-06-15T12:00:00Z";

describe("ttlFromNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(nowInstant).mockClear();
  });

  // Weekdays checked against Date#toUTCString, an oracle outside GMT. 2028 is a leap year, so a
  // year from 2027-06-15 is 366 days = 31622400 s. Unix 1813060800 is 2027-06-15T12:00:00Z.
  it.each`
    units                     | seconds         | milliseconds       | epochSeconds    | httpDate                           | iso
    ${{ years: 1 }}           | ${31622400}     | ${31622400000}     | ${1844683200}   | ${"Thu, 15 Jun 2028 12:00:00 GMT"} | ${"2028-06-15T12:00:00Z"}
    ${{ days: 3 }}            | ${259200}       | ${259200000}       | ${1813320000}   | ${"Fri, 18 Jun 2027 12:00:00 GMT"} | ${"2027-06-18T12:00:00Z"}
    ${{ seconds: 0 }}         | ${0}            | ${0}               | ${1813060800}   | ${"Tue, 15 Jun 2027 12:00:00 GMT"} | ${"2027-06-15T12:00:00Z"}
    ${{ days: -0 }}           | ${0}            | ${0}               | ${1813060800}   | ${"Tue, 15 Jun 2027 12:00:00 GMT"} | ${"2027-06-15T12:00:00Z"}
    ${{ milliseconds: 1500 }} | ${2}            | ${1500}            | ${1813060801}   | ${"Tue, 15 Jun 2027 12:00:01 GMT"} | ${"2027-06-15T12:00:01Z"}
    ${{ microseconds: 1 }}    | ${1}            | ${1}               | ${1813060800}   | ${"Tue, 15 Jun 2027 12:00:00 GMT"} | ${"2027-06-15T12:00:00Z"}
    ${{ nanoseconds: 1 }}     | ${1}            | ${1}               | ${1813060800}   | ${"Tue, 15 Jun 2027 12:00:00 GMT"} | ${"2027-06-15T12:00:00Z"}
    ${{ years: 7972 }}        | ${251572003200} | ${251572003200000} | ${253385064000} | ${"Tue, 15 Jun 9999 12:00:00 GMT"} | ${"9999-06-15T12:00:00Z"}
  `(
    "returns every form of $units",
    ({ units, seconds, milliseconds, epochSeconds, httpDate, iso }) => {
      expect(ttlFromNow(units)).toEqual({
        seconds,
        milliseconds,
        epochSeconds,
        httpDate,
        iso,
      });
    },
  );

  // 2027-01-31 plus a month has no 02-31: it clamps to 02-28 (TC39 constrain), 28 days.
  it("clamps a missing day to the end of the month", () => {
    setFakeSystemTime("2027-01-31T12:00:00Z");
    expect(ttlFromNow({ months: 1 })).toMatchObject({
      seconds: 2419200,
      httpDate: "Sun, 28 Feb 2027 12:00:00 GMT",
      iso: "2027-02-28T12:00:00Z",
    });
  });

  // Year 10027 has no four-digit form (RFC 9110 section 5.6.7 year = 4DIGIT): the whole result is
  // null so a non-null result is usable in full.
  it("returns null for a year past 9999", () => {
    expect(ttlFromNow({ years: 8000 })).toBeNull();
  });

  // 2027 + 7973 is year 10000, one year past the last four-digit year.
  it.each`
    units
    ${{ years: 7973 }}
    ${{ months: 95676 }}
    ${{ days: 3000000 }}
  `("returns null for $units, which ends past year 9999", ({ units }) => {
    expect(ttlFromNow(units)).toBeNull();
  });

  it("reads the clock once even when the result is null for a year past 9999", () => {
    expect(ttlFromNow({ years: 8000 })).toBeNull();
    expect(nowInstant).toHaveBeenCalledTimes(1);
  });

  it.each`
    units                     | label
    ${{}}                     | ${"{}"}
    ${{ fortnights: 1 }}      | ${"{ fortnights: 1 }"}
    ${"P1Y"}                  | ${"'P1Y'"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${{ days: 1.5 }}          | ${"{ days: 1.5 }"}
    ${{ days: -1 }}           | ${"{ days: -1 }"}
    ${{ years: 1, days: -1 }} | ${"{ years: 1, days: -1 }"}
    ${{ years: 300000 }}      | ${"{ years: 300000 }"}
  `("returns null for units $label", ({ units }) => {
    expect(ttlFromNow(units)).toBeNull();
  });

  it.each`
    name               | make
    ${"hostile units"} | ${hostileProxy}
    ${"revoked units"} | ${revokedProxy}
  `("returns null for $name", ({ make }) => {
    expect(ttlFromNow(make() as never)).toBeNull();
  });

  it("reads the clock once", () => {
    expect(ttlFromNow({ days: 1 })).not.toBeNull();
    expect(nowInstant).toHaveBeenCalledTimes(1);
  });

  it("reads the clock not at all for invalid units", () => {
    expect(ttlFromNow({ days: -1 })).toBeNull();
    expect(nowInstant).not.toHaveBeenCalled();
  });

  // For a whole-second length, seconds is exactly the length and epochSeconds floors start + length,
  // so epochSeconds - seconds is the floored start, 12:00:00 despite the polyfill's tail.
  it.each`
    units
    ${{ days: 90 }}
    ${{ hours: 5, minutes: 7 }}
    ${{ seconds: 30 }}
  `(
    "keeps epochSeconds - seconds at the floored start for $units",
    ({ units }) => {
      const ttl = ttlFromNow(units);
      expect(ttl).not.toBeNull();
      expect(ttl!.epochSeconds - ttl!.seconds).toBe(1813060800);
    },
  );

  // Each field equals its single-form function under one fake time, for a whole-second length.
  it.each`
    units
    ${{ days: 90 }}
    ${{ years: 1 }}
    ${{ months: 1, days: 3 }}
    ${{ seconds: 3600 }}
  `("matches each single-form function for $units", ({ units }) => {
    expect(ttlFromNow(units)).toEqual({
      seconds: totalUnitsFromNow(units, "seconds"),
      milliseconds: totalUnitsFromNow(units, "milliseconds"),
      epochSeconds: getUnixIn(units, { epochUnit: "seconds" }),
      httpDate: formatHttpDateFromNow(units),
      iso: getUtcIn(units),
    });
  });
});
