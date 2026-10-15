import { Temporal } from "@js-temporal/polyfill";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalNowInstantThrow,
} from "../../test/mocks";
import { gnssWeekToUtc } from "./gnssWeekToUtc";
import { utcToGnss } from "./utcToGnss";

describe("gnssWeekToUtc", () => {
  // label = epoch + (era × modulus + week) weeks + time of week, then label → UTC through TAI.
  it.each`
    counter       | week    | tow                 | era   | expected                            | why
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${0}  | ${"1981-12-05T23:59:59Z"}           | ${"GPS − UTC 1 s in 1981"}
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${1}  | ${"2001-07-21T23:59:47Z"}           | ${"one LNAV period later"}
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${2}  | ${"2021-03-06T23:59:42Z"}           | ${"two LNAV periods later"}
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${3}  | ${"2040-10-20T23:59:42Z"}           | ${"three LNAV periods later"}
    ${"GAL"}      | ${100}  | ${0}                | ${0}  | ${"2001-07-21T23:59:47Z"}           | ${"Galileo week 0 is GPS week 1024"}
    ${"GAL"}      | ${100}  | ${0}                | ${1}  | ${"2080-01-20T23:59:42Z"}           | ${"one 4096-week period later"}
    ${"BDT"}      | ${100}  | ${0}                | ${0}  | ${"2007-12-02T00:00:00Z"}           | ${"BDT − UTC 0 s in 2007"}
    ${"BDT"}      | ${100}  | ${0}                | ${1}  | ${"2164-12-01T23:59:56Z"}           | ${"one 8192-week period later"}
    ${"QZS-LNAV"} | ${100}  | ${0}                | ${0}  | ${"1981-12-05T23:59:59Z"}           | ${"QZSS weeks are GPS weeks"}
    ${"GPS-CNAV"} | ${100}  | ${0}                | ${0}  | ${"1981-12-05T23:59:59Z"}           | ${"CNAV era 0"}
    ${"GPS-CNAV"} | ${100}  | ${0}                | ${1}  | ${"2138-12-06T23:59:42Z"}           | ${"one 8192-week period later"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${0}  | ${"1980-01-06T00:00:00Z"}           | ${"the GPS epoch"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${1}  | ${"1999-08-21T23:59:47Z"}           | ${"the first LNAV rollover"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${2}  | ${"2019-04-06T23:59:42Z"}           | ${"the second LNAV rollover"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${3}  | ${"2038-11-20T23:59:42Z"}           | ${"the third LNAV rollover"}
    ${"GPS-CNAV"} | ${0}    | ${0}                | ${1}  | ${"2137-01-05T23:59:42Z"}           | ${"the first CNAV rollover"}
    ${"GAL"}      | ${0}    | ${0}                | ${1}  | ${"2078-02-19T23:59:42Z"}           | ${"the first Galileo rollover"}
    ${"BDT"}      | ${0}    | ${0}                | ${1}  | ${"2163-01-01T23:59:56Z"}           | ${"the first BeiDou rollover"}
    ${"GAL"}      | ${0}    | ${0}                | ${0}  | ${"1999-08-21T23:59:47Z"}           | ${"the Galileo epoch"}
    ${"BDT"}      | ${0}    | ${0}                | ${0}  | ${"2006-01-01T00:00:00Z"}           | ${"the BeiDou epoch"}
    ${"GPS-LNAV"} | ${247}  | ${86418}            | ${2}  | ${"2024-01-01T00:00:00Z"}           | ${"LNAV in 2024"}
    ${"QZS-LNAV"} | ${247}  | ${86418}            | ${2}  | ${"2024-01-01T00:00:00Z"}           | ${"QZSS LNAV in 2024"}
    ${"GPS-CNAV"} | ${2295} | ${86418}            | ${0}  | ${"2024-01-01T00:00:00Z"}           | ${"CNAV in 2024"}
    ${"QZS-CNAV"} | ${2295} | ${86418}            | ${0}  | ${"2024-01-01T00:00:00Z"}           | ${"QZSS CNAV in 2024"}
    ${"GAL"}      | ${1271} | ${86418}            | ${0}  | ${"2024-01-01T00:00:00Z"}           | ${"Galileo in 2024"}
    ${"BDT"}      | ${939}  | ${86404}            | ${0}  | ${"2024-01-01T00:00:00Z"}           | ${"BeiDou in 2024"}
    ${"GPS-LNAV"} | ${906}  | ${16}               | ${1}  | ${"2016-12-31T23:59:59Z"}           | ${"the second before the insertion"}
    ${"GPS-LNAV"} | ${906}  | ${18}               | ${1}  | ${"2017-01-01T00:00:00Z"}           | ${"the second after the insertion"}
    ${"GPS-LNAV"} | ${0}    | ${0.1}              | ${2}  | ${"2019-04-06T23:59:42.1Z"}         | ${"a fractional time of week"}
    ${"GPS-LNAV"} | ${392}  | ${345618}           | ${2}  | ${"2026-10-15T00:00:00Z"}           | ${"LNAV in 2026"}
    ${"GPS-LNAV"} | ${1023} | ${604799}           | ${2}  | ${"2038-11-20T23:59:41Z"}           | ${"the last LNAV second of era 2"}
    ${"GPS-CNAV"} | ${8191} | ${0}                | ${0}  | ${"2136-12-29T23:59:42Z"}           | ${"the last CNAV week of era 0"}
    ${"GPS-LNAV"} | ${0}    | ${604799.999999999} | ${1}  | ${"1999-08-28T23:59:46.999999999Z"} | ${"the last nanosecond of a week"}
    ${"IRN-LNAV"} | ${0}    | ${0}                | ${0}  | ${"1999-08-21T23:59:47Z"}           | ${"the NavIC epoch"}
    ${"IRN-LNAV"} | ${0}    | ${0}                | ${1}  | ${"2019-04-06T23:59:42Z"}           | ${"the first NavIC 10-bit rollover"}
    ${"IRN-LNAV"} | ${0}    | ${0}                | ${2}  | ${"2038-11-20T23:59:42Z"}           | ${"the second NavIC 10-bit rollover"}
    ${"IRN-L1NV"} | ${0}    | ${0}                | ${1}  | ${"2156-08-21T23:59:42Z"}           | ${"the first NavIC 13-bit rollover"}
    ${"IRN-LNAV"} | ${247}  | ${86418}            | ${1}  | ${"2024-01-01T00:00:00Z"}           | ${"NavIC LNAV in 2024"}
    ${"IRN-L1NV"} | ${1271} | ${86418}            | ${0}  | ${"2024-01-01T00:00:00Z"}           | ${"NavIC L1NV in 2024"}
    ${"GPS-CNAV"} | ${670}  | ${518417.999999999} | ${51} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit UTC instant"}
    ${"GPS-CNAV"} | ${1024} | ${0}                | ${0}  | ${"1999-08-21T23:59:47Z"}           | ${"a CNAV week runs on past 1023"}
  `(
    "returns $expected for $counter week $week, $tow s, era $era ($why)",
    ({ counter, week, tow, era, expected }) => {
      expect(gnssWeekToUtc(counter, week, tow, era)).toBe(expected);
    },
  );

  // A week time inside an inserted second reads 23:59:60 (ITU-R TF.460-6 Annex 3).
  it.each`
    counter       | week    | tow     | era  | expected
    ${"GPS-LNAV"} | ${906}  | ${17}   | ${1} | ${"2016-12-31T23:59:60Z"}
    ${"GPS-CNAV"} | ${1930} | ${17}   | ${0} | ${"2016-12-31T23:59:60Z"}
    ${"GPS-LNAV"} | ${906}  | ${17.5} | ${1} | ${"2016-12-31T23:59:60.5Z"}
  `(
    "returns the inserted second $expected for $counter week $week, $tow s, era $era",
    ({ counter, week, tow, era, expected }) => {
      expect(gnssWeekToUtc(counter, week, tow, era)).toBe(expected);
    },
  );

  it.each`
    counter       | week                       | why
    ${"GPS-LNAV"} | ${1024}                    | ${"an LNAV week stops at 1023"}
    ${"QZS-LNAV"} | ${1024}                    | ${"a QZSS LNAV week stops at 1023"}
    ${"IRN-LNAV"} | ${1024}                    | ${"a NavIC LNAV week stops at 1023"}
    ${"GAL"}      | ${4096}                    | ${"a Galileo week stops at 4095"}
    ${"GPS-CNAV"} | ${8192}                    | ${"a CNAV week stops at 8191"}
    ${"BDT"}      | ${8192}                    | ${"a BeiDou week stops at 8191"}
    ${"IRN-L1NV"} | ${8192}                    | ${"a NavIC L1NV week stops at 8191"}
    ${"GPS-LNAV"} | ${-1}                      | ${"negative"}
    ${"GPS-LNAV"} | ${1.5}                     | ${"not an integer"}
    ${"GPS-LNAV"} | ${Number.NaN}              | ${"NaN"}
    ${"GPS-LNAV"} | ${"1"}                     | ${"a numeric string"}
    ${"GPS-CNAV"} | ${Number.MAX_SAFE_INTEGER} | ${"far past the modulus"}
  `("returns '' for $counter week $week ($why)", ({ counter, week }) => {
    expect(gnssWeekToUtc(counter, week, 0, 0)).toBe("");
  });

  it.each`
    tow                         | why
    ${604800}                   | ${"a whole week"}
    ${-0.5}                     | ${"negative"}
    ${Number.NaN}               | ${"NaN"}
    ${Number.POSITIVE_INFINITY} | ${"Infinity"}
    ${"0"}                      | ${"a numeric string"}
    ${604799.9999999999}        | ${"rounds to a whole week"}
  `("returns '' for the time of week $tow ($why)", ({ tow }) => {
    expect(gnssWeekToUtc("GPS-LNAV", 0, tow, 1)).toBe("");
  });

  it.each`
    era                        | why
    ${-1}                      | ${"negative"}
    ${1.5}                     | ${"not an integer"}
    ${"1"}                     | ${"a numeric string"}
    ${"current"}               | ${"not the name rolling"}
    ${null}                    | ${"null"}
    ${Number.MAX_SAFE_INTEGER} | ${"past Temporal's range"}
  `("returns '' for the era $era ($why)", ({ era }) => {
    expect(gnssWeekToUtc("GPS-LNAV", 100, 0, era)).toBe("");
  });

  it.each`
    counter       | week    | tow       | era
    ${"GPS-LNAV"} | ${0}    | ${604800} | ${2}
    ${"GPS-LNAV"} | ${1024} | ${0}      | ${2}
  `(
    "returns '' for $counter week $week, $tow s, era $era (out of range)",
    ({ counter, week, tow, era }) => {
      expect(gnssWeekToUtc(counter, week, tow, era)).toBe("");
    },
  );

  it("returns '' for a result in year 10000", () => {
    expect(gnssWeekToUtc("GPS-CNAV", 670, 518418, 51)).toBe("");
  });

  it.each`
    counter   | why
    ${"GPS"}  | ${"a system: GPS has two counters"}
    ${"BDS"}  | ${"the constellation name"}
    ${"QZS"}  | ${"a system: QZSS has two counters"}
    ${"IRN"}  | ${"a system: NavIC has two counters"}
    ${"LNAV"} | ${"a message without its system"}
    ${null}   | ${"null"}
  `("returns '' for the counter $counter ($why)", ({ counter }) => {
    expect(gnssWeekToUtc(counter, 100, 0, 0)).toBe("");
  });

  it("returns '' for GLO, which has no week counter", () => {
    // @ts-expect-error GLONASS broadcasts no week number, so GLO is not a GnssWeekCounter
    expect(gnssWeekToUtc("GLO", 100, 0, 0)).toBe("");
  });

  // Era spacing: eras 0 and 1 of week 100 are one counter period apart on the system's own
  // scale. The UTC strings differ by that many weeks less the leap seconds between them.
  it.each`
    counter       | system   | era0                         | era1
    ${"GPS-LNAV"} | ${"GPS"} | ${"1981-12-06T00:00:00 GPS"} | ${"2001-07-22T00:00:00 GPS"}
    ${"GAL"}      | ${"GAL"} | ${"2001-07-22T00:00:00 GAL"} | ${"2080-01-21T00:00:00 GAL"}
    ${"BDT"}      | ${"BDT"} | ${"2007-12-02T00:00:00 BDT"} | ${"2164-12-02T00:00:00 BDT"}
  `(
    "places $counter week 100 eras 0 and 1 at $era0 and $era1",
    ({ counter, system, era0, era1 }) => {
      expect(utcToGnss(system, gnssWeekToUtc(counter, 100, 0, 0))).toBe(era0);
      expect(utcToGnss(system, gnssWeekToUtc(counter, 100, 0, 1))).toBe(era1);
    },
  );

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(gnssWeekToUtc("GPS-LNAV", 247, 86418, 2)).toBe("");
  });
});

describe("gnssWeekToUtc: rolling era", () => {
  // At 2026-10-15T00:00:00Z GPS is LNAV week 392, era 2 (full week 2440), TOW 345618. The rolling
  // era puts the full week within half a counter period of that week.
  function setNow(): ReturnType<typeof vi.spyOn> {
    return vi
      .spyOn(Temporal.Now, "instant")
      .mockReturnValue(Temporal.Instant.from("2026-10-15T00:00:00Z"));
  }

  it.each`
    counter       | week    | expected                  | why
    ${"GPS-LNAV"} | ${100}  | ${"2021-03-06T23:59:42Z"} | ${"era 2"}
    ${"GPS-LNAV"} | ${1023} | ${"2019-03-30T23:59:42Z"} | ${"era 1"}
    ${"GPS-LNAV"} | ${904}  | ${"2036-08-02T23:59:42Z"} | ${"era 2, full week 2952: half a period ahead"}
    ${"GPS-LNAV"} | ${905}  | ${"2016-12-24T23:59:43Z"} | ${"era 1, full week 1929: 2953 would be past half a period"}
    ${"QZS-LNAV"} | ${100}  | ${"2021-03-06T23:59:42Z"} | ${"era 2"}
    ${"GPS-CNAV"} | ${100}  | ${"1981-12-05T23:59:59Z"} | ${"era 0"}
    ${"GPS-CNAV"} | ${8191} | ${"2136-12-29T23:59:42Z"} | ${"clamped at era 0"}
    ${"GAL"}      | ${100}  | ${"2001-07-21T23:59:47Z"} | ${"era 0"}
    ${"BDT"}      | ${100}  | ${"2007-12-02T00:00:00Z"} | ${"era 0"}
    ${"IRN-LNAV"} | ${100}  | ${"2021-03-06T23:59:42Z"} | ${"NavIC full week 1416 now; era 1"}
  `(
    "returns $expected for $counter week $week, rolling ($why)",
    ({ counter, week, expected }) => {
      const now = setNow();
      expect(gnssWeekToUtc(counter, week, 0, "rolling")).toBe(expected);
      expect(now).toHaveBeenCalledTimes(1);
    },
  );

  it.each`
    era
    ${0}
    ${2}
  `("never reads the clock for the numeric era $era", ({ era }) => {
    const now = setNow();
    gnssWeekToUtc("GPS-LNAV", 100, 0, era);
    expect(now).not.toHaveBeenCalled();
  });

  it("never reads the clock when an earlier argument is invalid", () => {
    const now = setNow();
    expect(gnssWeekToUtc("GPS-LNAV", 1024, 0, "rolling")).toBe("");
    expect(now).not.toHaveBeenCalled();
  });

  it("returns '' when the clock reads before the counter's epoch", () => {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from("1990-01-01T00:00:00Z"),
    );
    expect(gnssWeekToUtc("GAL", 100, 0, "rolling")).toBe("");
  });

  it("returns '' when Temporal.Now.instant throws", () => {
    mockTemporalNowInstantThrow();
    expect(gnssWeekToUtc("GPS-LNAV", 100, 0, "rolling")).toBe("");
  });
});
