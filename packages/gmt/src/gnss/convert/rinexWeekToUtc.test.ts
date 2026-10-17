import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { gnssWeekToUtc } from "./gnssWeekToUtc";
import { rinexWeekToUtc } from "./rinexWeekToUtc";
import { utcToGnss } from "./utcToGnss";

describe("rinexWeekToUtc", () => {
  // label = RINEX epoch + week × 604 800 s + time of week, on the record's own scale.
  it.each`
    system   | week      | tow                 | expected                            | why
    ${"GPS"} | ${0}      | ${0}                | ${"1980-01-06T00:00:00Z"}           | ${"the GPS epoch"}
    ${"GPS"} | ${2295}   | ${86418}            | ${"2024-01-01T00:00:00Z"}           | ${"Table 3: continuous from 1980"}
    ${"QZS"} | ${2295}   | ${86418}            | ${"2024-01-01T00:00:00Z"}           | ${"Table 3: continuous from 1980"}
    ${"IRN"} | ${2295}   | ${86418}            | ${"2024-01-01T00:00:00Z"}           | ${"Table A30: continuous from 1980, same as GPS"}
    ${"GAL"} | ${2295}   | ${86418}            | ${"2024-01-01T00:00:00Z"}           | ${"Table 3: continuous from 1980"}
    ${"GPS"} | ${3072}   | ${0}                | ${"2038-11-20T23:59:42Z"}           | ${"never wraps: the third LNAV rollover"}
    ${"BDT"} | ${939}    | ${86404}            | ${"2024-01-01T00:00:00Z"}           | ${"BDT weeks from 2006"}
    ${"GAL"} | ${1024}   | ${0}                | ${"1999-08-21T23:59:47Z"}           | ${"the Galileo epoch"}
    ${"IRN"} | ${1024}   | ${0}                | ${"1999-08-21T23:59:47Z"}           | ${"the NavIC epoch"}
    ${"GPS"} | ${418462} | ${518417.999999999} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit UTC instant"}
    ${"QZS"} | ${0}      | ${0}                | ${"1980-01-06T00:00:00Z"}           | ${"Table 3: QZSS weeks from the GPS epoch"}
    ${"BDT"} | ${0}      | ${0}                | ${"2006-01-01T00:00:00Z"}           | ${"the BeiDou epoch: BDT − UTC 0 s"}
    ${"BDT"} | ${0}      | ${604799.999999999} | ${"2006-01-07T23:59:59.999999999Z"} | ${"the last nanosecond of BDT week 0"}
  `(
    "returns $expected for $system week $week, $tow s ($why)",
    ({ system, week, tow, expected }) => {
      expect(rinexWeekToUtc(system, week, tow)).toBe(expected);
    },
  );

  it("returns the inserted second 2016-12-31T23:59:60Z for GPS week 1930, 17 s", () => {
    expect(rinexWeekToUtc("GPS", 1930, 17)).toBe("2016-12-31T23:59:60Z");
  });

  // RINEX 4.02 Table A27: BeiDou C05, Toe 165600 s of BDT week 809 is 2021-07-05 22:00 BDT.
  it("reads RINEX Table A27's C05 record, BDT week 809 Toe 165600, as 2021-07-05 22:00 BDT", () => {
    const utc = rinexWeekToUtc("BDT", 809, 165600);
    expect(utc).toBe("2021-07-05T21:59:56Z");
    expect(utcToGnss("BDT", utc)).toBe("2021-07-05T22:00:00 BDT");
  });

  // D12: a RINEX NavIC week counts from 1980; a NavIC broadcast week counts from 1999. The same
  // number through the broadcast counter lands 1024 weeks later.
  it("reads RINEX NavIC week 2295 as 2024-01-01, where the L1NV broadcast counter reads 2043-08-17", () => {
    expect(rinexWeekToUtc("IRN", 2295, 86418)).toBe("2024-01-01T00:00:00Z");
    expect(gnssWeekToUtc("IRN-L1NV", 2295, 86418, 0)).toBe(
      "2043-08-17T00:00:00Z",
    );
  });

  it("returns '' for RINEX week 2295 on the 10-bit NavIC LNAV counter, which stops at 1023", () => {
    expect(gnssWeekToUtc("IRN-LNAV", 2295, 86418, 1)).toBe("");
  });

  it.each`
    system   | week                       | tow                  | why
    ${"GPS"} | ${-1}                      | ${0}                 | ${"a negative week"}
    ${"GPS"} | ${1.5}                     | ${0}                 | ${"a non-integer week"}
    ${"GPS"} | ${Number.NaN}              | ${0}                 | ${"a NaN week"}
    ${"GPS"} | ${"2295"}                  | ${0}                 | ${"a numeric-string week"}
    ${"GPS"} | ${2295}                    | ${604800}            | ${"a whole week"}
    ${"GPS"} | ${2295}                    | ${-1}                | ${"a negative time of week"}
    ${"GPS"} | ${2295}                    | ${Number.NaN}        | ${"a NaN time of week"}
    ${"GAL"} | ${1023}                    | ${0}                 | ${"before the Galileo epoch"}
    ${"IRN"} | ${1023}                    | ${604799}            | ${"before the NavIC epoch"}
    ${"GAL"} | ${1023}                    | ${604799.999999999}  | ${"one nanosecond before the Galileo epoch"}
    ${"BDT"} | ${0}                       | ${604799.9999999999} | ${"a time of week that rounds to a whole week"}
    ${"GPS"} | ${2295}                    | ${604799.9999999997} | ${"a time of week that rounds to 604 800 s at nanosecond resolution"}
    ${"GPS"} | ${2295}                    | ${"0"}               | ${"a numeric-string time of week"}
    ${"GPS"} | ${2295}                    | ${undefined}         | ${"an omitted time of week"}
    ${"GPS"} | ${undefined}               | ${0}                 | ${"an omitted week"}
    ${"GPS"} | ${2295n}                   | ${0}                 | ${"a bigint week"}
    ${"GPS"} | ${418462}                  | ${518418}            | ${"a result in year 10000"}
    ${"GPS"} | ${Number.MAX_SAFE_INTEGER} | ${0}                 | ${"past Temporal's range"}
  `(
    "returns '' for $system week $week, $tow s ($why)",
    ({ system, week, tow }) => {
      expect(rinexWeekToUtc(system, week, tow)).toBe("");
    },
  );

  it.each`
    system        | why
    ${"GPS-LNAV"} | ${"a broadcast counter"}
    ${"BDS"}      | ${"the constellation name"}
    ${null}       | ${"null"}
  `("returns '' for the system $system ($why)", ({ system }) => {
    expect(rinexWeekToUtc(system, 2295, 0)).toBe("");
  });

  it("returns '' for GLO, whose RINEX records carry no week", () => {
    // @ts-expect-error RINEX GLONASS records carry no week number, so GLO is not a RinexWeekSystem
    expect(rinexWeekToUtc("GLO", 2295, 0)).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(rinexWeekToUtc("GPS", 2295, 86418)).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws while writing the inserted second", () => {
    mockTemporalPlainTimeFromThrow();
    expect(rinexWeekToUtc("GPS", 1930, 17)).toBe("");
  });
});
