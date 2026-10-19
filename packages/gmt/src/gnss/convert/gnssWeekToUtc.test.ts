import { Temporal } from "../../internal/temporal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
  mockTemporalNowInstantThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { gnssWeekToUtc } from "./gnssWeekToUtc";
import { utcToGnss } from "./utcToGnss";
import { utcToGnssWeek } from "./utcToGnssWeek";

/** Nanoseconds in a week (IS-GPS-200N §3.3.4: 604 800 s). */
const NANOSECONDS_PER_WEEK = 604_800_000_000_000n;

/**
 * A time-scale string's wall clock, read as if UTC, in epoch nanoseconds: its label.
 *
 * @param scaleString a string such as "2019-03-10T00:00:00 GPS"
 * @returns the label nanoseconds
 */
function scaleLabel(scaleString: string): bigint {
  return Temporal.PlainDateTime.from(
    scaleString.slice(0, scaleString.indexOf(" ")),
  ).toZonedDateTime("UTC").epochNanoseconds;
}

describe("gnssWeekToUtc", () => {
  // label = epoch + (era × modulus + week) weeks + time of week, then label → UTC through TAI.
  it.each`
    counter       | week    | tow                 | era    | expected                            | why
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${0}   | ${"1981-12-05T23:59:59Z"}           | ${"GPS − UTC 1 s in 1981"}
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${1}   | ${"2001-07-21T23:59:47Z"}           | ${"one LNAV period later"}
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${2}   | ${"2021-03-06T23:59:42Z"}           | ${"two LNAV periods later"}
    ${"GPS-LNAV"} | ${100}  | ${0}                | ${3}   | ${"2040-10-20T23:59:42Z"}           | ${"three LNAV periods later"}
    ${"GAL"}      | ${100}  | ${0}                | ${0}   | ${"2001-07-21T23:59:47Z"}           | ${"Galileo week 0 is GPS week 1024"}
    ${"GAL"}      | ${100}  | ${0}                | ${1}   | ${"2080-01-20T23:59:42Z"}           | ${"one 4096-week period later"}
    ${"BDT"}      | ${100}  | ${0}                | ${0}   | ${"2007-12-02T00:00:00Z"}           | ${"BDT − UTC 0 s in 2007"}
    ${"BDT"}      | ${100}  | ${0}                | ${1}   | ${"2164-12-01T23:59:56Z"}           | ${"one 8192-week period later"}
    ${"QZS-LNAV"} | ${100}  | ${0}                | ${0}   | ${"1981-12-05T23:59:59Z"}           | ${"QZSS weeks are GPS weeks"}
    ${"GPS-CNAV"} | ${100}  | ${0}                | ${0}   | ${"1981-12-05T23:59:59Z"}           | ${"CNAV era 0"}
    ${"GPS-CNAV"} | ${100}  | ${0}                | ${1}   | ${"2138-12-06T23:59:42Z"}           | ${"one 8192-week period later"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${0}   | ${"1980-01-06T00:00:00Z"}           | ${"the GPS epoch"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${1}   | ${"1999-08-21T23:59:47Z"}           | ${"the first LNAV rollover"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${2}   | ${"2019-04-06T23:59:42Z"}           | ${"the second LNAV rollover"}
    ${"GPS-LNAV"} | ${0}    | ${0}                | ${3}   | ${"2038-11-20T23:59:42Z"}           | ${"the third LNAV rollover"}
    ${"GPS-CNAV"} | ${0}    | ${0}                | ${1}   | ${"2137-01-05T23:59:42Z"}           | ${"the first CNAV rollover"}
    ${"GAL"}      | ${0}    | ${0}                | ${1}   | ${"2078-02-19T23:59:42Z"}           | ${"the first Galileo rollover"}
    ${"BDT"}      | ${0}    | ${0}                | ${1}   | ${"2163-01-01T23:59:56Z"}           | ${"the first BeiDou rollover"}
    ${"GAL"}      | ${0}    | ${0}                | ${0}   | ${"1999-08-21T23:59:47Z"}           | ${"the Galileo epoch"}
    ${"BDT"}      | ${0}    | ${0}                | ${0}   | ${"2006-01-01T00:00:00Z"}           | ${"the BeiDou epoch"}
    ${"GPS-LNAV"} | ${247}  | ${86418}            | ${2}   | ${"2024-01-01T00:00:00Z"}           | ${"LNAV in 2024"}
    ${"QZS-LNAV"} | ${247}  | ${86418}            | ${2}   | ${"2024-01-01T00:00:00Z"}           | ${"QZSS LNAV in 2024"}
    ${"GPS-CNAV"} | ${2295} | ${86418}            | ${0}   | ${"2024-01-01T00:00:00Z"}           | ${"CNAV in 2024"}
    ${"QZS-CNAV"} | ${2295} | ${86418}            | ${0}   | ${"2024-01-01T00:00:00Z"}           | ${"QZSS CNAV in 2024"}
    ${"GAL"}      | ${1271} | ${86418}            | ${0}   | ${"2024-01-01T00:00:00Z"}           | ${"Galileo in 2024"}
    ${"BDT"}      | ${939}  | ${86404}            | ${0}   | ${"2024-01-01T00:00:00Z"}           | ${"BeiDou in 2024"}
    ${"GPS-LNAV"} | ${906}  | ${16}               | ${1}   | ${"2016-12-31T23:59:59Z"}           | ${"the second before the insertion"}
    ${"GPS-LNAV"} | ${906}  | ${18}               | ${1}   | ${"2017-01-01T00:00:00Z"}           | ${"the second after the insertion"}
    ${"GPS-LNAV"} | ${0}    | ${0.1}              | ${2}   | ${"2019-04-06T23:59:42.1Z"}         | ${"a fractional time of week"}
    ${"GPS-LNAV"} | ${392}  | ${345618}           | ${2}   | ${"2026-10-15T00:00:00Z"}           | ${"LNAV in 2026"}
    ${"GPS-LNAV"} | ${1023} | ${604799}           | ${2}   | ${"2038-11-20T23:59:41Z"}           | ${"the last LNAV second of era 2"}
    ${"GPS-CNAV"} | ${8191} | ${0}                | ${0}   | ${"2136-12-29T23:59:42Z"}           | ${"the last CNAV week of era 0"}
    ${"GPS-LNAV"} | ${0}    | ${604799.999999999} | ${1}   | ${"1999-08-28T23:59:46.999999999Z"} | ${"the last nanosecond of a week"}
    ${"IRN-LNAV"} | ${0}    | ${0}                | ${0}   | ${"1999-08-21T23:59:47Z"}           | ${"the NavIC epoch"}
    ${"IRN-LNAV"} | ${0}    | ${0}                | ${1}   | ${"2019-04-06T23:59:42Z"}           | ${"the first NavIC 10-bit rollover"}
    ${"IRN-LNAV"} | ${0}    | ${0}                | ${2}   | ${"2038-11-20T23:59:42Z"}           | ${"the second NavIC 10-bit rollover"}
    ${"IRN-L1NV"} | ${0}    | ${0}                | ${1}   | ${"2156-08-21T23:59:42Z"}           | ${"the first NavIC 13-bit rollover"}
    ${"IRN-LNAV"} | ${247}  | ${86418}            | ${1}   | ${"2024-01-01T00:00:00Z"}           | ${"NavIC LNAV in 2024"}
    ${"IRN-L1NV"} | ${1271} | ${86418}            | ${0}   | ${"2024-01-01T00:00:00Z"}           | ${"NavIC L1NV in 2024"}
    ${"GPS-CNAV"} | ${670}  | ${518417.999999999} | ${51}  | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit UTC instant"}
    ${"GPS-CNAV"} | ${1024} | ${0}                | ${0}   | ${"1999-08-21T23:59:47Z"}           | ${"a CNAV week runs on past 1023"}
    ${"GPS-LNAV"} | ${670}  | ${518417.999999999} | ${408} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit UTC instant: full week 418462 = 408 × 1024 + 670"}
    ${"GAL"}      | ${3742} | ${518417.999999999} | ${101} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit UTC instant: Galileo full week 417438 = 101 × 4096 + 3742"}
    ${"BDT"}      | ${7506} | ${518403.999999999} | ${50}  | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit UTC instant: BeiDou full week 417106 = 50 × 8192 + 7506"}
    ${"GPS-LNAV"} | ${0}    | ${0.0000000006}     | ${2}   | ${"2019-04-06T23:59:42.000000001Z"} | ${"0.6 ns rounds up to the nearest nanosecond"}
    ${"GPS-LNAV"} | ${0}    | ${0.0000000004}     | ${2}   | ${"2019-04-06T23:59:42Z"}           | ${"0.4 ns rounds down to the nearest nanosecond"}
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
    ${"GPS-LNAV"} | ${100n}                    | ${"a bigint"}
    ${"GPS-LNAV"} | ${undefined}               | ${"omitted"}
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
    ${604799.9999999997}        | ${"rounds to 604 800 s at nanosecond resolution"}
    ${-0.0000000001}            | ${"negative, though it rounds to 0"}
    ${0n}                       | ${"a bigint"}
    ${null}                     | ${"null"}
    ${undefined}                | ${"omitted"}
  `("returns '' for the time of week $tow ($why)", ({ tow }) => {
    expect(gnssWeekToUtc("GPS-LNAV", 0, tow, 1)).toBe("");
  });

  it.each`
    era                         | why
    ${-1}                       | ${"negative"}
    ${1.5}                      | ${"not an integer"}
    ${"1"}                      | ${"a numeric string"}
    ${"current"}                | ${"not the name rolling"}
    ${null}                     | ${"null"}
    ${Number.MAX_SAFE_INTEGER}  | ${"past Temporal's range"}
    ${undefined}                | ${"omitted: the era is required"}
    ${1n}                       | ${"a bigint"}
    ${true}                     | ${"a boolean"}
    ${Number.NaN}               | ${"NaN"}
    ${Number.POSITIVE_INFINITY} | ${"Infinity"}
  `("returns '' for the era $era ($why)", ({ era }) => {
    expect(gnssWeekToUtc("GPS-LNAV", 100, 0, era)).toBe("");
  });

  // One nanosecond past each counter's last four-digit UTC instant (a GMT rule: four-digit years).
  it.each`
    counter       | week    | tow       | era
    ${"GPS-CNAV"} | ${670}  | ${518418} | ${51}
    ${"GPS-LNAV"} | ${670}  | ${518418} | ${408}
    ${"GAL"}      | ${3742} | ${518418} | ${101}
    ${"BDT"}      | ${7506} | ${518404} | ${50}
  `(
    "returns '' for $counter week $week, $tow s, era $era: a result in year 10000",
    ({ counter, week, tow, era }) => {
      expect(gnssWeekToUtc(counter, week, tow, era)).toBe("");
    },
  );

  it.each`
    counter   | why
    ${"GPS"}  | ${"a system: GPS has two counters"}
    ${"BDS"}  | ${"the constellation name"}
    ${"QZS"}  | ${"a system: QZSS has two counters"}
    ${"IRN"}  | ${"a system: NavIC has two counters"}
    ${"LNAV"} | ${"a message without its system"}
    ${"CNAV"} | ${"a message without its system"}
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

  it("returns '' when Temporal.PlainTime.from throws while writing the inserted second", () => {
    mockTemporalPlainTimeFromThrow();
    expect(gnssWeekToUtc("GPS-LNAV", 906, 17, 1)).toBe("");
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

describe("gnssWeekToUtc: notBefore pivot", () => {
  // The week resolves to the earliest occurrence of that week and time of week at or after the
  // pivot: era = ceil((pivot label − era-0 label) / period), never below 0. Labels are compared
  // on the counter's scale, so a pivot exactly at the decoded instant counts.
  it.each`
    counter       | week    | tow       | notBefore                           | expected                  | why
    ${"GPS-LNAV"} | ${1020} | ${0}      | ${"2019-01-01T00:00:00Z"}           | ${"2019-03-09T23:59:42Z"} | ${"era 1: pivot before the 2019 rollover"}
    ${"GPS-LNAV"} | ${1020} | ${0}      | ${"2019-04-07T00:00:00Z"}           | ${"2038-10-23T23:59:42Z"} | ${"era 2: pivot after the 2019 rollover"}
    ${"GPS-LNAV"} | ${100}  | ${0}      | ${"2010-01-01T00:00:00Z"}           | ${"2021-03-06T23:59:42Z"} | ${"era 2"}
    ${"GPS-LNAV"} | ${0}    | ${0}      | ${"2019-04-06T23:59:42Z"}           | ${"2019-04-06T23:59:42Z"} | ${"exactly equal: counts"}
    ${"GPS-LNAV"} | ${0}    | ${0}      | ${"2019-04-06T23:59:42.000000001Z"} | ${"2038-11-20T23:59:42Z"} | ${"1 ns after: the next era"}
    ${"GPS-LNAV"} | ${0}    | ${0}      | ${"2019-04-06T23:59:41.999999999Z"} | ${"2019-04-06T23:59:42Z"} | ${"1 ns before: this era"}
    ${"GPS-LNAV"} | ${0}    | ${0}      | ${"2019-04-07T05:29:42+05:30"}      | ${"2019-04-06T23:59:42Z"} | ${"an offset names the same instant: equal counts"}
    ${"GPS-LNAV"} | ${392}  | ${345618} | ${"2026-10-15T00:00:00Z"}           | ${"2026-10-15T00:00:00Z"} | ${"equal counts in 2026"}
    ${"GPS-LNAV"} | ${392}  | ${345617} | ${"2026-10-15T00:00:00Z"}           | ${"2046-05-30T23:59:59Z"} | ${"1 s before the pivot: the next era"}
    ${"QZS-LNAV"} | ${1020} | ${0}      | ${"2019-01-01T00:00:00Z"}           | ${"2019-03-09T23:59:42Z"} | ${"QZSS weeks are GPS weeks"}
    ${"GPS-CNAV"} | ${100}  | ${0}      | ${"2000-01-01T00:00:00Z"}           | ${"2138-12-06T23:59:42Z"} | ${"13-bit: era 1"}
    ${"GPS-CNAV"} | ${2295} | ${86418}  | ${"2020-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:00Z"} | ${"era 0"}
    ${"GPS-CNAV"} | ${8191} | ${0}      | ${"2026-10-15T00:00:00Z"}           | ${"2136-12-29T23:59:42Z"} | ${"the last CNAV week of era 0"}
    ${"QZS-CNAV"} | ${2295} | ${86418}  | ${"2020-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:00Z"} | ${"QZSS CNAV era 0"}
    ${"BDT"}      | ${939}  | ${86404}  | ${"2020-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:00Z"} | ${"BDT − UTC 4 s in 2024"}
    ${"BDT"}      | ${0}    | ${0}      | ${"2006-01-01T00:00:00Z"}           | ${"2006-01-01T00:00:00Z"} | ${"pivot at the BeiDou epoch"}
    ${"GAL"}      | ${1271} | ${86418}  | ${"2020-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:00Z"} | ${"Galileo era 0"}
    ${"GAL"}      | ${0}    | ${0}      | ${"1999-08-21T23:59:47Z"}           | ${"1999-08-21T23:59:47Z"} | ${"pivot at the Galileo epoch"}
    ${"IRN-LNAV"} | ${247}  | ${86418}  | ${"2020-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:00Z"} | ${"NavIC 10-bit: era 1"}
    ${"IRN-L1NV"} | ${1271} | ${86418}  | ${"2020-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:00Z"} | ${"NavIC 13-bit: era 0"}
    ${"GPS-LNAV"} | ${100}  | ${0}      | ${"1980-01-06T00:00:00Z"}           | ${"1981-12-05T23:59:59Z"} | ${"pivot at the GPS epoch: era 0"}
    ${"GPS-LNAV"} | ${0}    | ${0}      | ${"1980-01-06T00:00:00Z"}           | ${"1980-01-06T00:00:00Z"} | ${"the GPS epoch itself"}
    ${"GAL"}      | ${100}  | ${0}      | ${"1999-01-01T00:00:00Z"}           | ${"2001-07-21T23:59:47Z"} | ${"a pivot before Galileo's epoch: era 0"}
    ${"GAL"}      | ${0}    | ${0}      | ${"1999-08-21T23:59:46Z"}           | ${"1999-08-21T23:59:47Z"} | ${"1 s before Galileo's epoch: the epoch itself"}
    ${"IRN-L1NV"} | ${0}    | ${0}      | ${"1999-08-21T23:59:46Z"}           | ${"1999-08-21T23:59:47Z"} | ${"1 s before NavIC's epoch: the epoch itself"}
    ${"BDT"}      | ${0}    | ${0}      | ${"2005-12-31T23:59:60Z"}           | ${"2006-01-01T00:00:00Z"} | ${"a listed second 60 before BeiDou's epoch"}
    ${"GPS-LNAV"} | ${100}  | ${0}      | ${"1979-12-31T00:00:00Z"}           | ${"1981-12-05T23:59:59Z"} | ${"a pivot before the GPS epoch: era 0"}
    ${"GPS-LNAV"} | ${100}  | ${0}      | ${"1970-01-01T00:00:00Z"}           | ${"1981-12-05T23:59:59Z"} | ${"a pivot before 1972, as a receiver's zeroed build date: era 0"}
  `(
    "returns $expected for $counter week $week, $tow s, notBefore $notBefore ($why)",
    ({ counter, week, tow, notBefore, expected }) => {
      expect(gnssWeekToUtc(counter, week, tow, { notBefore })).toBe(expected);
    },
  );

  // A pivot inside a listed inserted second is placed on the scale like any other instant: the
  // GPS label of 2016-12-31T23:59:60Z is week 906 + 17 s of era 1 (ITU-R TF.460-6 Annex 1 §2.2).
  it.each`
    week   | tow     | notBefore                      | expected                    | why
    ${906} | ${17}   | ${"2016-01-01T00:00:00Z"}      | ${"2016-12-31T23:59:60Z"}   | ${"the result is an inserted second"}
    ${906} | ${17}   | ${"2016-12-31T23:59:60Z"}      | ${"2016-12-31T23:59:60Z"}   | ${"a listed second-60 pivot: equal counts"}
    ${906} | ${18}   | ${"2016-12-31T23:59:60Z"}      | ${"2017-01-01T00:00:00Z"}   | ${"the second after the pivot: this era"}
    ${906} | ${16}   | ${"2016-12-31T23:59:60Z"}      | ${"2036-08-16T23:59:58Z"}   | ${"the second before the pivot: the next era"}
    ${906} | ${17}   | ${"2016-12-31T23:59:60.5Z"}    | ${"2036-08-16T23:59:59Z"}   | ${"half a second into the pivot: the next era"}
    ${906} | ${17.5} | ${"2016-12-31T23:59:60.5Z"}    | ${"2016-12-31T23:59:60.5Z"} | ${"a fractional second-60 pivot: equal counts"}
    ${906} | ${17}   | ${"2017-01-01T08:59:60+09:00"} | ${"2016-12-31T23:59:60Z"}   | ${"the second-60 pivot written at +09:00: equal counts"}
  `(
    "returns $expected for GPS-LNAV week $week, $tow s, notBefore $notBefore ($why)",
    ({ week, tow, notBefore, expected }) => {
      expect(gnssWeekToUtc("GPS-LNAV", week, tow, { notBefore })).toBe(
        expected,
      );
    },
  );

  it.each`
    counter       | week   | notBefore                    | why
    ${"GPS-LNAV"} | ${0}   | ${"+275760-09-01T00:00:00Z"} | ${"the result is past Temporal's instant range"}
    ${"GPS-LNAV"} | ${100} | ${"9999-12-31T00:00:00Z"}    | ${"the result is past year 9999"}
    ${"GPS-LNAV"} | ${100} | ${"1971-12-31T23:59:60Z"}    | ${"a second 60 the table does not list"}
  `(
    "returns '' for $counter week $week, notBefore $notBefore ($why)",
    ({ counter, week, notBefore }) => {
      expect(gnssWeekToUtc(counter, week, 0, { notBefore })).toBe("");
    },
  );

  it.each`
    notBefore                                        | why
    ${"2019-04-07"}                                  | ${"a date only"}
    ${"2019-04-07T00:00:00"}                         | ${"no offset"}
    ${"2017-12-31T23:59:60Z"}                        | ${"a second 60 the table does not list"}
    ${"2019-04-07 00:00:00Z"}                        | ${"a space separator"}
    ${""}                                            | ${"empty"}
    ${123}                                           | ${"a number"}
    ${Temporal.Instant.from("2019-01-01T00:00:00Z")} | ${"an Instant, not a string"}
    ${null}                                          | ${"null"}
    ${undefined}                                     | ${"undefined"}
  `("returns '' for notBefore $notBefore ($why)", ({ notBefore }) => {
    expect(gnssWeekToUtc("GPS-LNAV", 100, 0, { notBefore })).toBe("");
  });

  it.each`
    rolloverEra                              | why
    ${{}}                                    | ${"no notBefore"}
    ${[]}                                    | ${"an empty array"}
    ${["2019-01-01T00:00:00Z"]}              | ${"an array holding the instant"}
    ${{ notbefore: "2019-01-01T00:00:00Z" }} | ${"wrong case: the key is exact"}
  `("returns '' for the era $rolloverEra ($why)", ({ rolloverEra }) => {
    expect(gnssWeekToUtc("GPS-LNAV", 100, 0, rolloverEra)).toBe("");
  });

  it("ignores keys other than notBefore", () => {
    const notBefore = "2019-01-01T00:00:00Z";
    expect(
      gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore, extra: 1 } as never),
    ).toBe(gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore }));
    expect(gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore })).toBe(
      "2019-03-09T23:59:42Z",
    );
  });

  it("reads notBefore once", () => {
    const read = vi.fn(() => "2019-01-01T00:00:00Z");
    const rolloverEra = {
      get notBefore() {
        return read();
      },
    };
    expect(gnssWeekToUtc("GPS-LNAV", 1020, 0, rolloverEra)).toBe(
      "2019-03-09T23:59:42Z",
    );
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("never reads the clock", () => {
    const now = vi.spyOn(Temporal.Now, "instant");
    expect(
      gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" }),
    ).toBe("2038-10-23T23:59:42Z");
    expect(now).not.toHaveBeenCalled();
  });

  it("returns '' when Temporal.Instant.from throws while reading the pivot", () => {
    mockTemporalInstantFromThrow();
    expect(
      gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-01-01T00:00:00Z" }),
    ).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(
      gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-01-01T00:00:00Z" }),
    ).toBe("");
  });

  // The result r is the earliest occurrence at or after the pivot: on the counter's scale,
  // label(r) ≥ label(pivot) and label(r) − one counter period < label(pivot). Reading r back gives
  // the same week and time of week.
  it.each`
    counter       | system   | weeks   | week    | tow      | notBefore
    ${"GPS-LNAV"} | ${"GPS"} | ${1024} | ${1020} | ${0}     | ${"2019-01-01T00:00:00Z"}
    ${"GPS-LNAV"} | ${"GPS"} | ${1024} | ${1020} | ${0}     | ${"2019-04-07T00:00:00Z"}
    ${"GPS-LNAV"} | ${"GPS"} | ${1024} | ${0}    | ${0}     | ${"2019-04-06T23:59:42Z"}
    ${"GPS-LNAV"} | ${"GPS"} | ${1024} | ${906}  | ${17}    | ${"2016-01-01T00:00:00Z"}
    ${"GPS-LNAV"} | ${"GPS"} | ${1024} | ${906}  | ${16}    | ${"2016-12-31T23:59:60Z"}
    ${"QZS-LNAV"} | ${"QZS"} | ${1024} | ${1020} | ${0}     | ${"2019-01-01T00:00:00Z"}
    ${"GPS-CNAV"} | ${"GPS"} | ${8192} | ${100}  | ${0}     | ${"2000-01-01T00:00:00Z"}
    ${"QZS-CNAV"} | ${"QZS"} | ${8192} | ${2295} | ${86418} | ${"2020-01-01T00:00:00Z"}
    ${"GAL"}      | ${"GAL"} | ${4096} | ${1271} | ${86418} | ${"2020-01-01T00:00:00Z"}
    ${"BDT"}      | ${"BDT"} | ${8192} | ${939}  | ${86404} | ${"2020-01-01T00:00:00Z"}
    ${"IRN-LNAV"} | ${"IRN"} | ${1024} | ${247}  | ${86418} | ${"2020-01-01T00:00:00Z"}
    ${"IRN-L1NV"} | ${"IRN"} | ${8192} | ${1271} | ${86418} | ${"2020-01-01T00:00:00Z"}
  `(
    "places $counter week $week, $tow s within one period at or after $notBefore",
    ({ counter, system, weeks, week, tow, notBefore }) => {
      const result = gnssWeekToUtc(counter, week, tow, { notBefore });
      const label = scaleLabel(utcToGnss(system, result));
      const pivot = scaleLabel(utcToGnss(system, notBefore));
      expect(label >= pivot).toBe(true);
      expect(label - BigInt(weeks) * NANOSECONDS_PER_WEEK < pivot).toBe(true);
      expect(utcToGnssWeek(counter, result)).toMatchObject({
        week,
        timeOfWeekSeconds: tow,
      });
    },
  );
});

// NavIC SPS ICD 1.1 §5.7: "TOWC … indicates the number of 12 second counts at which the next
// subframe will begin … ranges from 1 to 50400"; L1 ICD 1.0 §6.2.1: ITOW 0 to 83, TOI 1 to 400.
// So the last subframe of a week gives 50400 × 12 = 604 800 s, the start of the next week.
describe("gnssWeekToUtc: the NavIC broadcast-count recipe at the end of a week", () => {
  it.each`
    counter       | week    | era  | broadcast                                   | tow       | direct   | nextWeek | nextEra | expected                  | why
    ${"IRN-LNAV"} | ${247}  | ${1} | ${"TOWC 50399"}                             | ${604788} | ${true}  | ${247}   | ${1}    | ${"2024-01-06T23:59:30Z"} | ${"TOWC 50399 × 12 = 604 788 s is inside the week"}
    ${"IRN-LNAV"} | ${247}  | ${1} | ${"TOWC 50400"}                             | ${604800} | ${false} | ${248}   | ${1}    | ${"2024-01-06T23:59:42Z"} | ${"TOWC 50400 × 12 = 604 800 s is TOW 0 of the next week"}
    ${"IRN-LNAV"} | ${1023} | ${1} | ${"TOWC 50400"}                             | ${604800} | ${false} | ${0}     | ${2}    | ${"2038-11-20T23:59:42Z"} | ${"the 10-bit week 1023 wraps to 0 and the era advances"}
    ${"IRN-L1NV"} | ${1271} | ${0} | ${"ITOW 83, TOI 400: 83 × 7200 + 400 × 18"} | ${604800} | ${false} | ${1272}  | ${0}    | ${"2024-01-06T23:59:42Z"} | ${"L1: the last interval of the week is TOW 0 of the next"}
    ${"IRN-L1NV"} | ${8191} | ${0} | ${"ITOW 83, TOI 400: 83 × 7200 + 400 × 18"} | ${604800} | ${false} | ${0}     | ${1}    | ${"2156-08-21T23:59:42Z"} | ${"the 13-bit week 8191 wraps to 0 and the era advances"}
  `(
    "$broadcast at $counter week $week era $era is $tow s: $why",
    ({ counter, week, era, tow, direct, nextWeek, nextEra, expected }) => {
      expect(gnssWeekToUtc(counter, week, tow, era)).toBe(
        direct ? expected : "",
      );
      expect(gnssWeekToUtc(counter, nextWeek, direct ? tow : 0, nextEra)).toBe(
        expected,
      );
    },
  );
});
