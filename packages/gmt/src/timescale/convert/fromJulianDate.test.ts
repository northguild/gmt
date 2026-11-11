import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import type { TimeScale } from "../../types/time-scale";
import { fromJulianDate } from "./fromJulianDate";
import { fromJulianDateParts } from "./fromJulianDateParts";
import { toJulianDateParts } from "./toJulianDateParts";

// Expected values come from the rule: the double is read exactly (jd - 2440587.5 days since
// 1970-01-01) and rounded once to the nearest nanosecond, a half up (Temporal halfExpand).
describe("fromJulianDate", () => {
  it.each`
    jd                            | scale        | expected                            | why
    ${2451545}                    | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"J2000 day, noon"}
    ${2451545}                    | ${"UTC"}     | ${"2000-01-01T12:00:00Z"}           | ${"explicit UTC is the default"}
    ${2451545}                    | ${"TT"}      | ${"2000-01-01T11:58:55.816Z"}       | ${"J2000.0 TT, 64.184 s before UTC noon"}
    ${2451544.5}                  | ${undefined} | ${"2000-01-01T00:00:00Z"}           | ${"midnight is .5"}
    ${2461042}                    | ${undefined} | ${"2026-01-01T12:00:00Z"}           | ${"noon"}
    ${2461042 + 2 ** -31}         | ${undefined} | ${"2026-01-01T12:00:00.000040233Z"} | ${"2^-31 day is 40233.135 ns, rounds to 40233"}
    ${2441317.5}                  | ${undefined} | ${"1972-01-01T00:00:00Z"}           | ${"the floor"}
    ${2457754 + 86_400 / 172_802} | ${"UTC"}     | ${"2016-12-31T23:59:60.500017042Z"} | ${"86400.500017042 s into an 86401 s day: a second-60 reading"}
    ${2451545 + 2 ** -17}         | ${undefined} | ${"2000-01-01T12:00:00.659179688Z"} | ${"2^-17 day is 659179687.5 ns, a tie that rounds up"}
    ${5373484.5 - 2 ** -30}       | ${undefined} | ${"9999-12-31T23:59:59.999919534Z"} | ${"the last double under the ceiling, 80466.27 ns short of it"}
    ${2441317.4}                  | ${undefined} | ${""}                               | ${"before 1972"}
    ${5373484.5}                  | ${undefined} | ${""}                               | ${"year 10000"}
  `(
    "returns '$expected' for jd $jd on scale $scale ($why)",
    ({ jd, scale, expected }) => {
      expect(fromJulianDate(jd, scale)).toBe(expected);
    },
  );

  it("rounds 2^-31 day to 40233 ns because 86400e9 / 2^31 is 40233.135", () => {
    expect(Math.round(86_400e9 / 2 ** 31)).toBe(40_233);
  });

  it.each`
    jd           | scale        | why
    ${NaN}       | ${undefined} | ${"NaN"}
    ${Infinity}  | ${undefined} | ${"Infinity"}
    ${-Infinity} | ${undefined} | ${"-Infinity"}
    ${"2451545"} | ${undefined} | ${"a numeric string"}
    ${2451545n}  | ${undefined} | ${"a bigint"}
    ${null}      | ${undefined} | ${"null"}
    ${undefined} | ${undefined} | ${"undefined"}
    ${1e300}     | ${undefined} | ${"far outside the domain"}
    ${-1e300}    | ${undefined} | ${"far before the domain"}
    ${0}         | ${undefined} | ${"JD 0 is before 1972"}
    ${-0}        | ${undefined} | ${"negative zero is JD 0, before 1972"}
    ${2451545}   | ${"TDB"}     | ${"TDB"}
    ${2451545}   | ${"tt"}      | ${"lower case"}
    ${2451545}   | ${null}      | ${"null scale"}
    ${2451545}   | ${5}         | ${"number scale"}
    ${2451545}   | ${""}        | ${"empty scale"}
  `("returns '' for $why", ({ jd, scale }) => {
    expect(fromJulianDate(jd, scale)).toBe("");
  });

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "returns '' a tenth of a second before the 1972-01-01 label and reads a value just after it on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const floor = toJulianDateParts("1972-01-01T00:00:00Z", scale) as {
        jd1: number;
        jd2: number;
      };
      const jd = floor.jd1 + floor.jd2;
      expect(fromJulianDate(jd - 1e-6, scale)).toBe("");
      // One double is spaced 2^-28 day (0.3 ms) apart here, so the label itself may round to
      // either side; 2^-26 day (1.3 ms) above it is always inside the domain.
      expect(fromJulianDate(jd + 2 ** -26, scale)).toMatch(
        /^1972-01-01T00:00:00\.00[0-2]/,
      );
    },
  );

  it("reads UTC 2441317.5 as the floor itself, and TAI 2441317.5 as before it", () => {
    expect(fromJulianDate(2441317.5)).toBe("1972-01-01T00:00:00Z");
    expect(fromJulianDate(2441317.5, "TAI")).toBe("");
  });

  it("returns '' for the UTC day 10000-01-01 and for a day far past it", () => {
    expect(fromJulianDate(5373484.75)).toBe("");
    expect(fromJulianDate(5373485)).toBe("");
  });

  it("agrees with fromJulianDateParts({ jd1: jd, jd2: 0 }) on 41 values", () => {
    const jds = Array.from({ length: 41 }, (_, i) => 2441317.5 + i * 1234.567);
    const bad = jds.filter(
      (jd) => fromJulianDate(jd) !== fromJulianDateParts({ jd1: jd, jd2: 0 }),
    );
    expect(bad).toEqual([]);
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(fromJulianDate(2451545)).toBe("");
  });
});
