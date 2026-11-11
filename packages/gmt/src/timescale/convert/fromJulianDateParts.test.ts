import {
  canonicalInstant,
  PARTS_INSTANTS,
} from "../../test/julianDateFixtures";
import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import type { JulianDateParts, TimeScale } from "../../types/time-scale";
import { fromJulianDateParts } from "./fromJulianDateParts";
import { fromTCG } from "./fromTCG";
import { toJulianDateParts } from "./toJulianDateParts";
import { toTCG } from "./toTCG";

// Expected values come from the rule: the parts are summed exactly and rounded once to the
// nearest nanosecond, a half up (Temporal halfExpand); ERFA jd2cal.c Note 2: any split works.
describe("fromJulianDateParts", () => {
  it.each`
    jd1          | jd2                                        | scale        | expected                            | why
    ${2451545}   | ${0}                                       | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"J2000.0 day, noon"}
    ${2451545}   | ${0}                                       | ${"UTC"}     | ${"2000-01-01T12:00:00Z"}           | ${"explicit UTC is the default"}
    ${2451545}   | ${0}                                       | ${"TT"}      | ${"2000-01-01T11:58:55.816Z"}       | ${"TT - UTC = 64.184 s, so J2000.0 TT is 11:58:55.816 UTC"}
    ${2400000.5} | ${51544.5}                                 | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"MJD split"}
    ${2451545.5} | ${-0.5}                                    | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"negative jd2"}
    ${0}         | ${2451545}                                 | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"all in jd2"}
    ${2457754}   | ${86_399 / 172_802}                        | ${undefined} | ${"2016-12-31T23:59:60Z"}           | ${"the inserted second"}
    ${2457754}   | ${86_400 / 172_802}                        | ${undefined} | ${"2016-12-31T23:59:60.5Z"}         | ${"half way into it"}
    ${2441317}   | ${0.5}                                     | ${undefined} | ${"1972-01-01T00:00:00Z"}           | ${"the floor"}
    ${2441317}   | ${0.4999999}                               | ${undefined} | ${""}                               | ${"before 1972"}
    ${2441317}   | ${0.5}                                     | ${"TAI"}     | ${""}                               | ${"the first TAI label is 00:00:10"}
    ${2441317}   | ${(43_200 + 10) / 86_400}                  | ${"TAI"}     | ${"1972-01-01T00:00:00Z"}           | ${"TAI - UTC = 10 s"}
    ${5373484}   | ${0.5}                                     | ${undefined} | ${""}                               | ${"10000-01-01"}
    ${5373484}   | ${43_199_999_999_999 / 86_400_000_000_000} | ${undefined} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the ceiling"}
    ${2451545}   | ${2 ** -40}                                | ${undefined} | ${"2000-01-01T12:00:00.000000079Z"} | ${"2^-40 day is 78.58 ns, rounds to 79"}
    ${2451545}   | ${2 ** -41}                                | ${undefined} | ${"2000-01-01T12:00:00.000000039Z"} | ${"2^-41 day is 39.29 ns, rounds down to 39"}
    ${2451544.5} | ${0.5}                                     | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"both parts fractional"}
    ${2451546}   | ${-1}                                      | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"jd2 of minus one day"}
    ${2457754}   | ${(43_200 + 36) / 86_400}                  | ${"TAI"}     | ${"2016-12-31T23:59:60Z"}           | ${"TAI label 2017-01-01T00:00:36 is the inserted second"}
    ${2457754}   | ${(43_200 + 6) / 86_400}                   | ${"TAI"}     | ${"2016-12-31T23:59:30Z"}           | ${"TAI label 00:00:06 of the next day is 23:59:30 UTC"}
    ${2451545}   | ${2 ** -17}                                | ${undefined} | ${"2000-01-01T12:00:00.659179688Z"} | ${"a tie: 2^-17 day is 659179687.5 ns, a half rounds up"}
    ${2451545}   | ${-(2 ** -17)}                             | ${undefined} | ${"2000-01-01T11:59:59.340820313Z"} | ${"a tie below noon: 340820312.5 ns of the second, a half rounds up"}
    ${2451545}   | ${2 ** -17}                                | ${"TT"}      | ${"2000-01-01T11:58:56.475179688Z"} | ${"a tie on TT: 475179687.5 ns, a half rounds up"}
    ${2451545}   | ${0.5 - 2 ** -50}                          | ${undefined} | ${"2000-01-02T00:00:00Z"}           | ${"0.077 ns short of midnight rounds up into the next day"}
    ${2457754}   | ${0.5 - 2 ** -50}                          | ${undefined} | ${"2017-01-01T00:00:00Z"}           | ${"0.077 ns short of the end of the leap-second day carries into 2017"}
    ${2461041}   | ${0.25}                                    | ${"TCG"}     | ${"2025-12-31T17:58:49.738353186Z"} | ${"TCG label rounded to the ns, then mapped as fromTCG does: 1 ns later than the exact inverse (...185.133)"}
  `(
    "returns '$expected' for jd1 $jd1 jd2 $jd2 on scale $scale ($why)",
    ({ jd1, jd2, scale, expected }) => {
      expect(fromJulianDateParts({ jd1, jd2 }, scale)).toBe(expected);
    },
  );

  it("rounds 2^-40 day to 79 ns because 86400e9 / 2^40 is 78.58", () => {
    expect(Math.round((86_400e9 / 2 ** 40) * 100) / 100).toBe(78.58);
  });

  it.each`
    parts                                                | scale        | why
    ${null}                                              | ${undefined} | ${"null"}
    ${"2451545"}                                         | ${undefined} | ${"a string"}
    ${[2451545, 0]}                                      | ${undefined} | ${"an array has no jd1"}
    ${{ jd1: 2451545 }}                                  | ${undefined} | ${"no jd2"}
    ${{ jd2: 0 }}                                        | ${undefined} | ${"no jd1"}
    ${{ jd1: NaN, jd2: 0 }}                              | ${undefined} | ${"NaN"}
    ${{ jd1: 2451545, jd2: NaN }}                        | ${undefined} | ${"NaN jd2"}
    ${{ jd1: Infinity, jd2: 0 }}                         | ${undefined} | ${"Infinity"}
    ${{ jd1: 2451545, jd2: -Infinity }}                  | ${undefined} | ${"-Infinity jd2"}
    ${{ jd1: 2451545n, jd2: 0 }}                         | ${undefined} | ${"a bigint"}
    ${{ jd1: "2451545", jd2: 0 }}                        | ${undefined} | ${"a numeric string"}
    ${{ jd1: 1e300, jd2: 0 }}                            | ${undefined} | ${"far outside the domain"}
    ${{ jd1: Number.MAX_VALUE, jd2: -Number.MAX_VALUE }} | ${undefined} | ${"sum 0, before 1972"}
    ${{ jd1: 2451545, jd2: 0 }}                          | ${"TDB"}     | ${"TDB"}
    ${{ jd1: 2451545, jd2: 0 }}                          | ${"tt"}      | ${"lower case"}
    ${{ jd1: 2451545, jd2: 0 }}                          | ${null}      | ${"null scale"}
    ${{ jd1: 2451545, jd2: 0 }}                          | ${5}         | ${"number scale"}
  `("returns '' for $why", ({ parts, scale }) => {
    expect(fromJulianDateParts(parts, scale)).toBe("");
  });

  it("reads an object carried by a function like any other", () => {
    const carrier = Object.assign(() => 0, { jd1: 2451545, jd2: 0 });
    expect(fromJulianDateParts(carrier as unknown as JulianDateParts)).toBe(
      "2000-01-01T12:00:00Z",
    );
  });

  it("reads each member once with an ordinary property get", () => {
    const reads: string[] = [];
    const parts = {
      get jd1() {
        reads.push("jd1");
        return 2451545;
      },
      get jd2() {
        reads.push("jd2");
        return 0;
      },
    };
    expect(fromJulianDateParts(parts)).toBe("2000-01-01T12:00:00Z");
    expect(reads).toEqual(["jd1", "jd2"]);
  });

  it("returns '' when a member getter throws", () => {
    const parts = {
      get jd1(): number {
        throw new Error("boom");
      },
      jd2: 0,
    };
    expect(fromJulianDateParts(parts)).toBe("");
  });

  // The ceiling: a day position can land in the slack day 10000-01-01, which formatUtcReading
  // rejects; the bottom edge is 1972-01-01 on every scale.
  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "returns '' for a label 1e-6 day (0.0864 s) before the 1972-01-01 label on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const floor = toJulianDateParts("1972-01-01T00:00:00Z", scale) as {
        jd1: number;
        jd2: number;
      };
      expect(
        fromJulianDateParts({ jd1: floor.jd1, jd2: floor.jd2 - 1e-6 }, scale),
      ).toBe("");
      expect(fromJulianDateParts(floor, scale)).toBe("1972-01-01T00:00:00Z");
    },
  );

  // The floor label on each scale, then 1 ns before it (no instant) and 0.4 ns before it (rounds
  // to the floor): a subtraction of 1/86400e9 day is exact to 0.01 ns at these magnitudes.
  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "returns '' 1 ns before the 1972-01-01 label and the floor 0.4 ns before it on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const floor = toJulianDateParts("1972-01-01T00:00:00Z", scale) as {
        jd1: number;
        jd2: number;
      };
      expect(
        fromJulianDateParts(
          { jd1: floor.jd1, jd2: floor.jd2 - 1 / 86_400e9 },
          scale,
        ),
      ).toBe("");
      expect(
        fromJulianDateParts(
          { jd1: floor.jd1, jd2: floor.jd2 - 0.4 / 86_400e9 },
          scale,
        ),
      ).toBe("1972-01-01T00:00:00Z");
    },
  );

  it("returns '' for the UTC day 10000-01-01 and for a day far past it", () => {
    expect(fromJulianDateParts({ jd1: 5373484, jd2: 0.75 })).toBe("");
    expect(fromJulianDateParts({ jd1: 5373485, jd2: 0 })).toBe("");
  });

  it("returns '' for the slack day 1971-12-31", () => {
    expect(fromJulianDateParts({ jd1: 2441316, jd2: 0.75 })).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(fromJulianDateParts({ jd1: 2451545, jd2: 0 })).toBe("");
  });

  describe("round trips", () => {
    it.each`
      scale
      ${"UTC"}
      ${"TAI"}
      ${"TT"}
      ${"TCG"}
    `(
      "gives each of 41 instants back in canonical form on $scale",
      ({ scale }: { scale: TimeScale }) => {
        const bad = PARTS_INSTANTS.filter(
          (x) =>
            fromJulianDateParts(
              toJulianDateParts(x, scale) as JulianDateParts,
              scale,
            ) !== canonicalInstant(x),
        );
        expect(bad).toEqual([]);
      },
    );

    // toTCG writes "" where the TCG label passes year 9999 (the UTC ceiling is one such instant),
    // so fromTCG(toTCG(x)) can only be compared where toTCG has an answer.
    it("agrees with fromTCG(toTCG(x)) on TCG wherever toTCG has a label", () => {
      const labelled = PARTS_INSTANTS.filter((x) => toTCG(x) !== "");
      expect(labelled).toHaveLength(PARTS_INSTANTS.length - 1);
      const bad = labelled.filter(
        (x) =>
          fromJulianDateParts(
            toJulianDateParts(x, "TCG") as JulianDateParts,
            "TCG",
          ) !== fromTCG(toTCG(x)),
      );
      expect(bad).toEqual([]);
    });

    it("still round-trips the UTC ceiling on TCG, where toTCG has no label", () => {
      const ceiling = "9999-12-31T23:59:59.999999999Z";
      expect(toTCG(ceiling)).toBe("");
      expect(
        fromJulianDateParts(
          toJulianDateParts(ceiling, "TCG") as JulianDateParts,
          "TCG",
        ),
      ).toBe(ceiling);
    });
  });
});
