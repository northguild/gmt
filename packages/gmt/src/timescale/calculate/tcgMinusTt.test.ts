import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { tcgMinusTt } from "./tcgMinusTt";

describe("tcgMinusTt", () => {
  // Each expected value is floor((TT − T₀) × L_G / (1 − L_G)) in whole nanoseconds, worked out
  // with exact integer arithmetic outside the library (IERS TN 36 eq. 10.1, L_G from IAU 2000 B1.9).
  it.each`
    isoString                           | expected          | note
    ${"2026-01-01T00:00:00Z"}           | ${1.077661917}    | ${"TT − T₀ = 1 546 300 837 s"}
    ${"2027-01-01T00:00:00Z"}           | ${1.09964027}     | ${"TT − T₀ = 1 577 836 837 s"}
    ${"2000-01-01T12:00:00Z"}           | ${0.50583333}     | ${"TT − T₀ = 725 803 232 s"}
    ${"2000-01-01T11:58:55.816Z"}       | ${0.505833286}    | ${"J2000.0 itself, 12:00:00 TT"}
    ${"1976-12-31T23:59:45Z"}           | ${0}              | ${"the epoch T₀"}
    ${"1972-01-01T00:00:00Z"}           | ${-0.11001219}    | ${"floor of −0.110012189 27…, not truncation"}
    ${"2016-12-31T23:59:59Z"}           | ${0.879736306}    | ${"last ordinary second of 2016"}
    ${"2016-12-31T23:59:60Z"}           | ${0.879736307}    | ${"the inserted second, one TT second later"}
    ${"2026-01-01T01:00:00+01:00"}      | ${1.077661917}    | ${"offset read"}
    ${"2017-01-01T00:00:00Z"}           | ${0.879736307}    | ${"TT − T₀ = 1 262 304 037 s"}
    ${"9999-12-31T23:59:59Z"}           | ${176.449446734}  | ${"no upper bound: TT − T₀ = 253 181 376 036 s, though toTT is empty here"}
    ${"+275760-09-13T00:00:00Z"}        | ${6021.312711095} | ${"Temporal's last instant; offset 6 021 312 711 095 ns, below 2^53"}
    ${"1976-12-31T23:59:44.999999999Z"} | ${-1e-9}          | ${"1 ns before T₀: floor gives −1 ns, truncation would give 0"}
    ${"1976-12-31T23:59:44Z"}           | ${-1e-9}          | ${"1 s before T₀: −0.697 ns floors to −1 ns"}
    ${"1976-12-31T23:59:45.000000001Z"} | ${0}              | ${"1 ns after T₀: 0.697e-9 floors to 0"}
    ${"1976-12-31T23:59:46Z"}           | ${0}              | ${"1 s after T₀: 0.697 ns floors to 0"}
    ${"1976-12-31T23:59:46.434866363Z"} | ${0}              | ${"TT − T₀ = 1 434 866 363 ns, 1 ns below the first whole-ns step"}
    ${"1976-12-31T23:59:46.434866364Z"} | ${1e-9}           | ${"TT − T₀ = 1 434 866 364 ns, first offset of +1 ns"}
    ${"1976-12-31T23:59:43.565133637Z"} | ${-1e-9}          | ${"TT − T₀ = −1 434 866 363 ns"}
    ${"1976-12-31T23:59:43.565133636Z"} | ${-2e-9}          | ${"TT − T₀ = −1 434 866 364 ns, first offset of −2 ns"}
    ${"1976-12-31T23:59:59Z"}           | ${9e-9}           | ${"TT − T₀ = 14 s"}
    ${"1977-01-01T00:00:00Z"}           | ${1.1e-8}         | ${"TT − T₀ = 16 s"}
    ${"1972-06-30T23:59:59Z"}           | ${-0.099053121}   | ${"before the 1972-06-30 insertion"}
    ${"1972-06-30T23:59:60Z"}           | ${-0.09905312}    | ${"the 1972-06-30 inserted second, negative era"}
    ${"1972-07-01T00:00:00Z"}           | ${-0.09905312}    | ${"next midnight, 11 s row"}
  `("returns $expected for $isoString ($note)", ({ isoString, expected }) => {
    expect(tcgMinusTt(isoString)).toBe(expected);
  });

  it("grows by L_G × 365 × 86400 across 2026 to within 1 ns", () => {
    const diff =
      (tcgMinusTt("2027-01-01T00:00:00Z") as number) -
      (tcgMinusTt("2026-01-01T00:00:00Z") as number);
    expect(Math.abs(diff - 6.969290134e-10 * 365 * 86400)).toBeLessThan(1e-9);
  });

  it("matches L_G / (1 − L_G) × 725 803 232 s at J2000 to within 1 ns", () => {
    // 8400.5 d from 1977-01-01T00:00 TT to J2000.0, plus 64.184 s (TT − UTC in 2000), minus
    // 32.184 s (the epoch's TT offset): 725 803 232 s.
    const expected = (6.969290134e-10 / (1 - 6.969290134e-10)) * 725_803_232;
    expect(
      Math.abs((tcgMinusTt("2000-01-01T12:00:00Z") as number) - expected),
    ).toBeLessThan(1e-9);
  });

  it.each`
    isoString                           | why
    ${"1971-12-31T23:59:59Z"}           | ${"before 1972"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"1 ns before 1972"}
    ${"2017-12-31T23:59:60Z"}           | ${"second 60 on a day with no insertion"}
    ${"2016-12-31T12:34:60Z"}           | ${"second 60 mid-day"}
  `("returns null for $isoString ($why)", ({ isoString }) => {
    expect(tcgMinusTt(isoString)).toBeNull();
  });

  it.each`
    isoString
    ${null}
    ${undefined}
    ${123}
  `("returns null for the non-string $isoString", ({ isoString }) => {
    expect(tcgMinusTt(isoString)).toBeNull();
  });

  it.each`
    isoString
    ${""}
    ${"x"}
    ${"2026-01-01"}
    ${"2026-01-01T00:00:00"}
    ${"2026-01-01T00:00:00[UTC]"}
  `("returns null for the non-instant string '$isoString'", ({ isoString }) => {
    expect(tcgMinusTt(isoString)).toBeNull();
  });

  it.each(sameInstantBattleCases)(
    "returns 1.037197661 for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      // floor((TT − T₀) × L_G / (1 − L_G)) with TT − T₀ = 1 488 240 037 s, in exact integers.
      expect(tcgMinusTt(value)).toBe(1.037197661);
    },
  );

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(tcgMinusTt("2016-12-31T23:59:60Z")).toBeNull();
  });
});
