import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { taiMinusUtc } from "./taiMinusUtc";

describe("taiMinusUtc", () => {
  // Each value is the IERS Leap_Second.dat row in force at that instant (Bulletin C 72).
  it.each`
    isoString                           | expected | row
    ${"2024-01-01T00:00:00Z"}           | ${37}    | ${"2017-01-01"}
    ${"2016-01-01T00:00:00Z"}           | ${36}    | ${"2015-07-01"}
    ${"2017-01-01T00:00:00Z"}           | ${37}    | ${"2017-01-01, first instant"}
    ${"2013-06-01T00:00:00Z"}           | ${35}    | ${"2012-07-01"}
    ${"1972-01-01T00:00:00Z"}           | ${10}    | ${"1972-01-01, first instant of the table"}
    ${"1980-01-06T00:00:00Z"}           | ${19}    | ${"1980-01-01 (the GPS epoch)"}
    ${"1999-08-22T00:00:00Z"}           | ${32}    | ${"1999-01-01"}
    ${"2006-01-01T00:00:00Z"}           | ${33}    | ${"2006-01-01 (the BeiDou epoch)"}
    ${"2027-06-28T00:00:00Z"}           | ${37}    | ${"2017-01-01: the table is closed (CGPM 2026 Resolution 5)"}
    ${"2100-01-01T00:00:00Z"}           | ${37}    | ${"2017-01-01: the table is closed (CGPM 2026 Resolution 5)"}
    ${"2016-12-31T23:59:59.999999999Z"} | ${36}    | ${"2015-07-01: 1 ns before the 2017-01-01 row"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${37}    | ${"2017-01-01: no upper bound of its own"}
    ${"+275760-09-13T00:00:00Z"}        | ${37}    | ${"2017-01-01: Temporal's last instant"}
  `(
    "returns $expected for $isoString (row $row)",
    ({ isoString, expected }) => {
      expect(taiMinusUtc(isoString)).toBe(expected);
    },
  );

  // TAI − UTC changes at 00:00:00 UTC (Bulletin C 72), so the inserted second keeps the old value.
  it.each`
    isoString                           | expected
    ${"2016-12-31T23:59:60Z"}           | ${36}
    ${"2016-12-31T23:59:60.999999999Z"} | ${36}
    ${"2017-01-01T08:59:60+09:00"}      | ${36}
    ${"1972-06-30T23:59:60Z"}           | ${10}
  `(
    "returns $expected inside the inserted second $isoString",
    ({ isoString, expected }) => {
      expect(taiMinusUtc(isoString)).toBe(expected);
    },
  );

  it.each`
    isoString                           | why
    ${"1971-12-31T23:59:59.999999999Z"} | ${"1 ns before 1972: TAI − UTC was fractional (BIPM vol. 15 Table 2)"}
    ${"1971-01-01T00:00:00Z"}           | ${"before 1972"}
    ${"2017-12-31T23:59:60Z"}           | ${"second 60 on a day with no insertion"}
    ${"2016-12-31T12:34:60Z"}           | ${"second 60 mid-day"}
    ${"-271821-04-20T00:00:00Z"}        | ${"Temporal's first instant, before 1972"}
  `("returns null for $isoString ($why)", ({ isoString }) => {
    expect(taiMinusUtc(isoString)).toBeNull();
  });

  it.each`
    isoString
    ${null}
    ${undefined}
    ${123}
  `("returns null for the non-string $isoString", ({ isoString }) => {
    expect(taiMinusUtc(isoString)).toBeNull();
  });

  it.each`
    isoString
    ${""}
    ${"x"}
    ${"2024-01-01"}
    ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00[UTC]"}
    ${"20240101T000000Z"}
  `("returns null for the non-instant string '$isoString'", ({ isoString }) => {
    expect(taiMinusUtc(isoString)).toBeNull();
  });

  it.each(sameInstantBattleCases)(
    "returns 37 for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(taiMinusUtc(value)).toBe(37);
    },
  );

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(taiMinusUtc("2016-12-31T23:59:60Z")).toBeNull();
  });
});
