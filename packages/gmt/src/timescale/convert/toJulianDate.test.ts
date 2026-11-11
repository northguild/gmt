import { Temporal } from "../../internal/temporal";
import {
  edgeSweepFailures,
  PARTS_INSTANTS,
  partsOfLabel,
} from "../../test/julianDateFixtures";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { JulianDateParts, TimeScale } from "../../types/time-scale";
import { toJulianDate } from "./toJulianDate";
import { toJulianDateParts } from "./toJulianDateParts";
import { fromJulianDate } from "./fromJulianDate";
import { toTAI } from "./toTAI";
import { toTCG } from "./toTCG";
import { toTT } from "./toTT";

// Expected values come from the rule: JD days begin at noon (IAU 1997 B1 App. 2), the result is
// the one IEEE 754 addition jd1 + jd2, and a double near JD 2.46e6 is spaced 2^-31 day apart.
describe("toJulianDate", () => {
  it.each`
    isoString                       | scale        | expected                      | why
    ${"2000-01-01T12:00:00Z"}       | ${undefined} | ${2451545}                    | ${"J2000 day, noon"}
    ${"2000-01-01T12:00:00Z"}       | ${"UTC"}     | ${2451545}                    | ${"explicit UTC is the default"}
    ${"2000-01-01T00:00:00Z"}       | ${undefined} | ${2451544.5}                  | ${"midnight is .5"}
    ${"2000-01-01T11:58:55.816Z"}   | ${"TT"}      | ${2451545}                    | ${"J2000.0 itself"}
    ${"2026-01-01T12:00:00.00002Z"} | ${undefined} | ${2461042}                    | ${"the 20 µs are lost: 20 µs < half ulp = 20.1 µs"}
    ${"2026-01-01T12:00:00.00003Z"} | ${undefined} | ${2461042 + 2 ** -31}         | ${"rounds up to the next double"}
    ${"2016-12-31T23:59:60Z"}       | ${undefined} | ${2457754 + 86_399 / 172_802} | ${"quasi-JD: 86400 s into an 86401 s day"}
    ${"2016-12-31T23:59:60.5Z"}     | ${undefined} | ${2457754 + 86_400 / 172_802} | ${"quasi-JD: 86400.5 s into an 86401 s day"}
    ${"2016-12-31T23:59:60.5Z"}     | ${"UTC"}     | ${2457754 + 86_400 / 172_802} | ${"explicit UTC reads the same leap-second reading"}
    ${"1972-01-01T00:00:00Z"}       | ${undefined} | ${2441317.5}                  | ${"the floor"}
    ${"2026-01-01T01:00:00+01:00"}  | ${undefined} | ${2461041.5}                  | ${"an offset is read as its instant"}
  `(
    "returns $expected for $isoString on scale $scale ($why)",
    ({ isoString, scale, expected }) => {
      expect(toJulianDate(isoString, scale)).toBe(expected);
    },
  );

  it.each`
    isoString                           | scale    | label
    ${"1971-12-31T23:59:59.999999999Z"} | ${"UTC"} | ${"'UTC'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TAI"} | ${"'TAI'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TT"}  | ${"'TT'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TCG"} | ${"'TCG'"}
    ${"+010000-01-01T00:00:00Z"}        | ${"UTC"} | ${"'UTC'"}
    ${"+010000-01-01T00:00:00Z"}        | ${"TAI"} | ${"'TAI'"}
    ${"+010000-01-01T00:00:00Z"}        | ${"TT"}  | ${"'TT'"}
    ${"+010000-01-01T00:00:00Z"}        | ${"TCG"} | ${"'TCG'"}
    ${"2017-12-31T23:59:60Z"}           | ${"UTC"} | ${"'UTC'"}
    ${""}                               | ${"UTC"} | ${"'UTC'"}
    ${"not a date"}                     | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01"}                     | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01T00:00:00Z"}           | ${"TDB"} | ${"'TDB'"}
    ${"2026-01-01T00:00:00Z"}           | ${"tt"}  | ${"'tt'"}
    ${"2026-01-01T00:00:00Z"}           | ${null}  | ${"null"}
    ${"2026-01-01T00:00:00Z"}           | ${5}     | ${"5"}
  `("returns null for '$isoString' on scale $label", ({ isoString, scale }) => {
    expect(toJulianDate(isoString, scale)).toBeNull();
  });

  it("returns null for an empty-string scale", () => {
    expect(toJulianDate("2026-01-01T00:00:00Z", "" as TimeScale)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(toJulianDate(undefined as unknown as string)).toBeNull();
    expect(toJulianDate(5 as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toJulianDate("2016-12-31T23:59:60Z")).toBeNull();
  });

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "equals jd1 + jd2 of toJulianDateParts for each of 41 instants on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const bad = PARTS_INSTANTS.filter((x) => {
        const parts = toJulianDateParts(x, scale) as JulianDateParts;
        const sum = parts.jd1 + parts.jd2;
        // The sum, or null where the nearest double lies outside the domain.
        const expected = fromJulianDate(sum, scale) === "" ? null : sum;
        return toJulianDate(x, scale) !== expected;
      });
      expect(bad).toEqual([]);
    },
  );

  // The label is the one SPA-47 writes; the JD is counted from it by a bigint helper.
  it.each`
    scale    | label
    ${"TAI"} | ${toTAI}
    ${"TT"}  | ${toTT}
    ${"TCG"} | ${toTCG}
  `(
    "equals the sum of the SPA-47 label's parts on $scale",
    ({ scale, label }: { scale: TimeScale; label: (x: string) => string }) => {
      // The label is "" where it passes year 9999 (the UTC ceiling on TT and TCG).
      const labelled = PARTS_INSTANTS.filter((x) => label(x) !== "");
      expect(labelled.length).toBeGreaterThanOrEqual(PARTS_INSTANTS.length - 1);
      const bad = labelled.filter((x) => {
        const parts = partsOfLabel(label(x));
        const sum = parts.jd1 + parts.jd2;
        const expected = fromJulianDate(sum, scale) === "" ? null : sum;
        return toJulianDate(x, scale) !== expected;
      });
      expect(bad).toEqual([]);
    },
  );
});

describe("toJulianDate precision", () => {
  it("loses 2026-01-01T12:00:00.00002Z: the round trip is not exact", () => {
    const x = "2026-01-01T12:00:00.00002Z";
    expect(fromJulianDate(toJulianDate(x) as number)).toBe(
      "2026-01-01T12:00:00Z",
    );
  });

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "stays within half an ulp of the exact Julian Date on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const numbers = PARTS_INSTANTS.filter(
        (x) => toJulianDate(x, scale) !== null,
      );
      expect(numbers.length).toBeGreaterThanOrEqual(PARTS_INSTANTS.length - 3);
      const bad = numbers.filter((x) => {
        const parts = toJulianDateParts(x, scale) as JulianDateParts;
        const jd = toJulianDate(x, scale) as number;
        // |jd - (jd1 + jd2)| in days, from exact bigint arithmetic on the dyadic value of jd.
        const errorDays = Math.abs(exactDifference(jd, parts.jd1, parts.jd2));
        return errorDays > ulp(jd) / 2 + ulp(parts.jd2) / 2 + 2 ** -60;
      });
      expect(bad).toEqual([]);
    },
  );

  // At the two domain edges the nearest double can lie outside the domain (the ceiling on UTC, TAI
  // and TT lands in year 10000, the floor on TAI and TT a few microseconds before 1972-01-01), and
  // there `toJulianDate` returns null rather than a number `fromJulianDate` rejects.
  const FLOOR = "1972-01-01T00:00:00Z";
  const CEILING = "9999-12-31T23:59:59.999999999Z";

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "round-trips within the ulp bound plus half a nanosecond on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const numbers = PARTS_INSTANTS.filter(
        (x) => toJulianDate(x, scale) !== null,
      );
      expect(numbers.length).toBeGreaterThanOrEqual(PARTS_INSTANTS.length - 3);
      const bad = numbers.filter((x) => {
        const jd = toJulianDate(x, scale) as number;
        const back = fromJulianDate(jd, scale);
        if (back === "") {
          return true;
        }
        const boundDays = (ulp(jd) / 2 + 2 ** -54) * (86_401 / 86_400);
        const boundNanoseconds = boundDays * 86_400e9 + 0.5;
        return (
          Math.abs(Number(nanoseconds(back) - nanoseconds(x))) >
          boundNanoseconds
        );
      });
      expect(bad).toEqual([]);
    },
  );

  it.each`
    isoString  | scale
    ${CEILING} | ${"UTC"}
    ${CEILING} | ${"TAI"}
    ${CEILING} | ${"TT"}
    ${FLOOR}   | ${"TAI"}
    ${FLOOR}   | ${"TT"}
  `(
    "returns null at '$isoString' on $scale: the nearest double lies outside the domain",
    ({ isoString, scale }: { isoString: string; scale: TimeScale }) => {
      expect(toJulianDate(isoString, scale)).toBeNull();
    },
  );

  it.each`
    isoString  | scale
    ${FLOOR}   | ${"UTC"}
    ${FLOOR}   | ${"TCG"}
    ${CEILING} | ${"TCG"}
  `(
    "returns a number at '$isoString' on $scale that reads back inside the domain",
    ({ isoString, scale }: { isoString: string; scale: TimeScale }) => {
      const jd = toJulianDate(isoString, scale);
      expect(jd).not.toBeNull();
      expect(fromJulianDate(jd as number, scale)).not.toBe("");
    },
  );

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "never returns a number that fromJulianDate rejects within 100 µs of either end on $scale",
    ({ scale }: { scale: TimeScale }) => {
      expect(edgeSweepFailures(toJulianDate, fromJulianDate, scale)).toEqual({
        unreadable: [],
        gapped: [],
      });
    },
  );

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "never returns a number that fromJulianDate rejects for any of the fixture instants on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const bad = PARTS_INSTANTS.filter((x) => {
        const jd = toJulianDate(x, scale);
        return jd !== null && fromJulianDate(jd, scale) === "";
      });
      expect(bad).toEqual([]);
    },
  );

  // The edge band is null just outside and a number just inside. 100 µs is past the widest band (a
  // double is 40 µs wide); the expected number is the sum of the label's two exact parts.
  it.each`
    isoString                      | scale    | label
    ${"1972-01-01T00:00:00.0001Z"} | ${"UTC"} | ${"1972-01-01T00:00:00.0001"}
    ${"1972-01-01T00:00:00.0001Z"} | ${"TAI"} | ${"1972-01-01T00:00:10.0001"}
    ${"1972-01-01T00:00:00.0001Z"} | ${"TT"}  | ${"1972-01-01T00:00:42.1841"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"UTC"} | ${"9999-12-31T23:59:59.9999"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"TAI"} | ${"+010000-01-01T00:00:36.9999"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"TT"}  | ${"+010000-01-01T00:01:09.1839"}
  `(
    "returns the nearest double of the label $label on $scale, 100 µs inside the domain edge",
    ({
      isoString,
      scale,
      label,
    }: {
      isoString: string;
      scale: TimeScale;
      label: string;
    }) => {
      const parts = partsOfLabel(label);
      expect(toJulianDate(isoString, scale)).toBe(parts.jd1 + parts.jd2);
    },
  );

  it.each`
    isoString                      | scale
    ${"1972-01-01T00:00:00.0001Z"} | ${"TCG"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"TCG"}
  `(
    "returns a number that reads back inside the domain for '$isoString' on $scale",
    ({ isoString, scale }: { isoString: string; scale: TimeScale }) => {
      const jd = toJulianDate(isoString, scale);
      expect(jd).not.toBeNull();
      expect(fromJulianDate(jd as number, scale)).not.toBe("");
    },
  );

  it.each`
    isoString                           | expectedBound
    ${"2026-03-10T14:30:00.123456789Z"} | ${"20.1 µs"}
    ${"6800-06-01T00:00:00.123456789Z"} | ${"40.2 µs"}
  `(
    "has a half-ulp bound of $expectedBound for $isoString",
    ({ isoString, expectedBound }) => {
      const jd = toJulianDate(isoString) as number;
      const microseconds = (ulp(jd) / 2) * 86_400e6;
      expect(`${microseconds.toFixed(1)} µs`).toBe(expectedBound);
    },
  );

  it("round-trips 6800-06-01T00:00:00.123456789Z within the 2^-30 day spacing bound", () => {
    const x = "6800-06-01T00:00:00.123456789Z";
    const jd = toJulianDate(x) as number;
    const diff = Math.abs(
      Number(nanoseconds(fromJulianDate(jd)) - nanoseconds(x)),
    );
    expect(diff).toBeLessThanOrEqual((ulp(jd) / 2 + 2 ** -54) * 86_400e9 + 0.5);
  });
});

// Helpers. Independent of the function under test: they use bigint and the SPA-47 label parser.

/** ulp(x) = 2^(floor(log2 |x|) - 52); the spacing above an exact power of two is the same. */
function ulp(x: number): number {
  if (x === 0) {
    return Number.MIN_VALUE;
  }
  return 2 ** (Math.floor(Math.log2(Math.abs(x))) - 52);
}

function nanoseconds(x: string): bigint {
  // TAI is a uniform count (SPA-47 writes its label), so differences across a leap second hold.
  const label = toTAI(x);
  if (label !== "") {
    return Temporal.PlainDateTime.from(
      label.split(" ")[0] as string,
    ).toZonedDateTime("UTC").epochNanoseconds;
  }
  // Past year 9999 on TAI there is no label; no leap second is near there.
  return Temporal.Instant.from(x).epochNanoseconds;
}

/** (the double jd) - (jd1 + jd2) in days; jd - jd1 is exact, and Sterbenz keeps the rest exact. */
function exactDifference(jd: number, jd1: number, jd2: number): number {
  return jd - jd1 - jd2;
}
