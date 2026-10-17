import { Temporal } from "@js-temporal/polyfill";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { toTAI } from "../../timescale/convert/toTAI";
import { utcToGnss } from "./utcToGnss";

/** The date-time part of a time-scale string, before the space and token. */
function wallClock(scaleString: string): Temporal.PlainDateTime {
  return Temporal.PlainDateTime.from(scaleString.split(" ")[0]);
}

describe("utcToGnss", () => {
  // Scale − UTC = (TAI − UTC) − (TAI − scale): BIPM utc-gnss "(19-xx) s" for GPS. The GPS rows
  // carry MAR-16's checks: 0 s at the 1980 epoch, 17 s before the 2016 insertion, 18 s in 2024.
  it.each`
    system   | utcString                           | expected                               | why
    ${"GPS"} | ${"1980-01-06T00:00:00Z"}           | ${"1980-01-06T00:00:00 GPS"}           | ${"the GPS epoch: 19 − 19"}
    ${"GPS"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:18 GPS"}           | ${"37 − 19"}
    ${"GPS"} | ${"2016-12-31T23:59:60Z"}           | ${"2017-01-01T00:00:17 GPS"}           | ${"the inserted second: 36 + 1 − 19"}
    ${"GPS"} | ${"2016-12-31T23:59:60.25Z"}        | ${"2017-01-01T00:00:17.25 GPS"}        | ${"the inserted second, fraction kept"}
    ${"GPS"} | ${"2017-01-01T08:59:60+09:00"}      | ${"2017-01-01T00:00:17 GPS"}           | ${"the inserted second in another offset"}
    ${"GPS"} | ${"2016-06-01T00:00:00Z"}           | ${"2016-06-01T00:00:17 GPS"}           | ${"17 s before the 2016 insertion: 36 − 19"}
    ${"GPS"} | ${"2027-06-28T00:00:00Z"}           | ${"2027-06-28T00:00:18 GPS"}           | ${"18 s: the table is closed"}
    ${"GPS"} | ${"1999-08-21T23:59:47Z"}           | ${"1999-08-22T00:00:00 GPS"}           | ${"13 s: the first LNAV rollover"}
    ${"GPS"} | ${"2024-01-01T00:00:00.5Z"}         | ${"2024-01-01T00:00:18.5 GPS"}         | ${"18 s, fraction kept"}
    ${"GAL"} | ${"1999-08-22T00:00:00Z"}           | ${"1999-08-22T00:00:13 GAL"}           | ${"the ICD's 13 s: 32 − 19"}
    ${"GAL"} | ${"1999-08-21T23:59:47Z"}           | ${"1999-08-22T00:00:00 GAL"}           | ${"the Galileo epoch"}
    ${"GAL"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:18 GAL"}           | ${"37 − 19"}
    ${"BDT"} | ${"2006-01-01T00:00:00Z"}           | ${"2006-01-01T00:00:00 BDT"}           | ${"the BeiDou epoch: equals UTC, 33 − 33"}
    ${"BDT"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:04 BDT"}           | ${"37 − 33"}
    ${"QZS"} | ${"1980-01-06T00:00:00Z"}           | ${"1980-01-06T00:00:00 QZS"}           | ${"the QZSS week epoch: 19 − 19"}
    ${"QZS"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:18 QZS"}           | ${"37 − 19"}
    ${"IRN"} | ${"1999-08-21T23:59:47Z"}           | ${"1999-08-22T00:00:00 IRN"}           | ${"the NavIC epoch, ICD SPS 1.1 §5.7"}
    ${"IRN"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:18 IRN"}           | ${"37 − 19, derived"}
    ${"IRN"} | ${"2016-12-31T23:59:60Z"}           | ${"2017-01-01T00:00:17 IRN"}           | ${"the inserted second: 36 + 1 − 19"}
    ${"GLO"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:00 GLO"}           | ${"UTC's own wall clock, not UTC + 3 h"}
    ${"GLO"} | ${"2016-12-31T23:59:60Z"}           | ${"2016-12-31T23:59:60 GLO"}           | ${"GLO keeps UTC's leap seconds"}
    ${"GLO"} | ${"2016-12-31T23:59:60.25Z"}        | ${"2016-12-31T23:59:60.25 GLO"}        | ${"GLO keeps UTC's leap seconds, fraction kept"}
    ${"GLO"} | ${"2017-01-01T08:59:60+09:00"}      | ${"2016-12-31T23:59:60 GLO"}           | ${"the inserted second in another offset"}
    ${"GLO"} | ${"1972-01-01T00:00:00Z"}           | ${"1972-01-01T00:00:00 GLO"}           | ${"the first GLO label"}
    ${"GPS"} | ${"2016-12-31T23:59:59.999999999Z"} | ${"2017-01-01T00:00:16.999999999 GPS"} | ${"1 ns before the inserted second: 36 − 19"}
    ${"GPS"} | ${"2016-12-31T23:59:60.999999999Z"} | ${"2017-01-01T00:00:17.999999999 GPS"} | ${"the last nanosecond of the inserted second"}
    ${"GPS"} | ${"9999-12-31T23:59:41.999999999Z"} | ${"9999-12-31T23:59:59.999999999 GPS"} | ${"the last four-digit GPS label: 37 − 19"}
    ${"BDT"} | ${"9999-12-31T23:59:55.999999999Z"} | ${"9999-12-31T23:59:59.999999999 BDT"} | ${"the last four-digit BDT label: 37 − 33"}
    ${"GLO"} | ${"9999-12-31T23:59:59.999999999Z"} | ${"9999-12-31T23:59:59.999999999 GLO"} | ${"the last four-digit GLO label"}
  `(
    "returns $expected for $system $utcString ($why)",
    ({ system, utcString, expected }) => {
      expect(utcToGnss(system, utcString)).toBe(expected);
    },
  );

  it.each`
    system   | utcString                           | why
    ${"GPS"} | ${"1980-01-05T23:59:59Z"}           | ${"before the GPS epoch"}
    ${"GPS"} | ${"1980-01-05T23:59:59.999999999Z"} | ${"one nanosecond before the GPS epoch"}
    ${"GPS"} | ${"2017-12-31T23:59:60Z"}           | ${"second 60 with no insertion that day"}
    ${"GAL"} | ${"1999-08-21T23:59:46Z"}           | ${"before the Galileo epoch"}
    ${"BDT"} | ${"2005-12-31T23:59:59Z"}           | ${"before the BeiDou epoch"}
    ${"BDT"} | ${"2005-12-31T23:59:60Z"}           | ${"the inserted second before the BeiDou epoch"}
    ${"IRN"} | ${"1999-08-21T23:59:46Z"}           | ${"before the NavIC epoch"}
    ${"IRN"} | ${"1999-08-21T23:59:46.999999999Z"} | ${"one nanosecond before the NavIC epoch"}
    ${"GLO"} | ${"2017-12-31T23:59:60Z"}           | ${"second 60 with no insertion that day"}
    ${"GLO"} | ${"1971-12-31T23:59:59Z"}           | ${"before 1972"}
    ${"GAL"} | ${"1999-08-21T23:59:46.999999999Z"} | ${"one nanosecond before the Galileo epoch"}
    ${"BDT"} | ${"2005-12-31T23:59:59.999999999Z"} | ${"one nanosecond before the BeiDou epoch"}
    ${"QZS"} | ${"1980-01-05T23:59:59.999999999Z"} | ${"one nanosecond before the QZSS week epoch"}
    ${"GLO"} | ${"1971-12-31T23:59:59.999999999Z"} | ${"one nanosecond before 1972"}
    ${"GPS"} | ${"9999-12-31T23:59:42Z"}           | ${"the GPS label is in year 10000"}
    ${"BDT"} | ${"9999-12-31T23:59:56Z"}           | ${"the BDT label is in year 10000"}
    ${"GLO"} | ${"+010000-01-01T00:00:00Z"}        | ${"the GLO label is in year 10000"}
    ${"GPS"} | ${"+275760-09-13T00:00:00Z"}        | ${"Temporal's last instant: its GPS label is past Temporal's range"}
  `("returns '' for $system $utcString ($why)", ({ system, utcString }) => {
    expect(utcToGnss(system, utcString)).toBe("");
  });

  // The MAR-16 epoch check: 1999-01-01 is after the GPS and QZSS epochs, before the Galileo,
  // BeiDou and NavIC ones.
  it.each`
    system   | expected
    ${"GPS"} | ${"1999-01-01T00:00:13 GPS"}
    ${"QZS"} | ${"1999-01-01T00:00:13 QZS"}
    ${"GLO"} | ${"1999-01-01T00:00:00 GLO"}
    ${"GAL"} | ${""}
    ${"BDT"} | ${""}
    ${"IRN"} | ${""}
  `(
    "returns $expected for $system at 1999-01-01T00:00:00Z",
    ({ system, expected }) => {
      expect(utcToGnss(system, "1999-01-01T00:00:00Z")).toBe(expected);
    },
  );

  it.each`
    utcString
    ${null}
    ${undefined}
    ${123}
    ${""}
    ${"x"}
    ${"2024-01-01"}
    ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00[UTC]"}
    ${"20240101T000000Z"}
  `("returns '' for the invalid instant $utcString", ({ utcString }) => {
    expect(utcToGnss("GPS", utcString)).toBe("");
  });

  it.each`
    system       | why
    ${"gps"}     | ${"lower case"}
    ${"BDS"}     | ${"the constellation, not a RINEX time token"}
    ${"GLONASS"} | ${"not a RINEX token"}
    ${"NAVIC"}   | ${"not a RINEX token"}
    ${"TAI"}     | ${"not a satellite system"}
    ${""}        | ${"empty"}
    ${null}      | ${"null"}
  `("returns '' for the system $system ($why)", ({ system }) => {
    expect(utcToGnss(system, "2024-01-01T00:00:00Z")).toBe("");
  });

  it.each(sameInstantBattleCases)(
    "returns 2024-02-29T00:00:18 GPS for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(utcToGnss("GPS", value)).toBe("2024-02-29T00:00:18 GPS");
    },
  );

  it("returns '' when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(utcToGnss("GPS", "2016-12-31T23:59:60Z")).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(utcToGnss("GPS", "2024-01-01T00:00:00Z")).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws while writing a GLO second 60", () => {
    mockTemporalPlainTimeFromThrow();
    expect(utcToGnss("GLO", "2016-12-31T23:59:60Z")).toBe("");
  });
});

// TAI − GPS = 19 s at every date (BIPM Annual Report vol. 15 p. 48), so the TAI and GPS labels of
// one instant are always 19 s apart, whatever TAI − UTC is that year.
describe("utcToGnss: TAI − GPS is 19 s in every year", () => {
  const years = Array.from({ length: 2026 - 1980 + 1 }, (_, index) => ({
    utc: `${1980 + index}-03-15T12:00:00Z`,
  }));

  it.each(years)("the TAI and GPS labels of $utc are 19 s apart", ({ utc }) => {
    const tai = wallClock(toTAI(utc));
    const gps = wallClock(utcToGnss("GPS", utc));
    expect(gps.until(tai).total({ unit: "seconds" })).toBe(19);
  });
});

// Galileo time and GPS time are both TAI − 19 s (BIPM), so their labels agree (MAR-16).
describe("utcToGnss: GAL agrees with GPS", () => {
  const years = Array.from({ length: 2026 - 2000 + 1 }, (_, index) => ({
    utc: `${2000 + index}-07-01T00:00:00Z`,
  }));

  it.each(years)("the GAL and GPS labels of $utc are equal", ({ utc }) => {
    const gal = utcToGnss("GAL", utc);
    expect(gal).not.toBe("");
    expect(gal.split(" ")[0]).toBe(utcToGnss("GPS", utc).split(" ")[0]);
  });
});

// GLO is GLONASS time in UTC hours (RINEX 4.02 §4.1.2; BIPM vol. 15 p. 49): UTC's label, token GLO.
describe("utcToGnss: GLO is UTC's wall clock", () => {
  const years = Array.from({ length: 2026 - 1972 + 1 }, (_, index) => ({
    utc: `${1972 + index}-07-01T00:00:00Z`,
  }));

  it.each(years)("the GLO label of $utc is its UTC label", ({ utc }) => {
    expect(utcToGnss("GLO", utc)).toBe(`${utc.slice(0, -1)} GLO`);
  });
});
