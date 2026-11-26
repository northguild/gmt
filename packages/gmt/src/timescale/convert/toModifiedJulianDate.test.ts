import { Temporal } from "../../internal/temporal";
import {
  canonicalInstant,
  dayPositionOfLabel,
  edgeSweepFailures,
  exactEpochDaysOf,
  nearestDoubleOf,
  PARTS_INSTANTS,
} from "../../test/julianDateFixtures";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { TimeScale } from "../../types/time-scale";
import { fromModifiedJulianDate } from "./fromModifiedJulianDate";
import { toJulianDateParts } from "./toJulianDateParts";
import { toModifiedJulianDate } from "./toModifiedJulianDate";

// Expected values come from the rule (ITU-R TF.457-2 Rec. 2: MJD = JD - 2400000.5, counted from
// midnight; ERFA_DJM00 = 51544.5 is J2000.0) worked out by hand: the exact MJD, day number plus
// fraction of the day, rounded once to the nearest double. Never JD - 2400000.5 in doubles.
describe("toModifiedJulianDate", () => {
  it.each`
    isoString                      | scale        | expected                                       | why
    ${"2000-01-01T00:00:00Z"}      | ${undefined} | ${51544}                                       | ${"midnight is a whole MJD (Correction 2)"}
    ${"2000-01-01T00:00:00Z"}      | ${"UTC"}     | ${51544}                                       | ${"explicit UTC is the default"}
    ${"2000-01-01T12:00:00Z"}      | ${undefined} | ${51544.5}                                     | ${"ERFA_DJM00, J2000.0's day"}
    ${"2000-01-01T11:58:55.816Z"}  | ${"TT"}      | ${51544.5}                                     | ${"J2000.0 on TT"}
    ${"1972-01-01T00:00:00Z"}      | ${undefined} | ${41317}                                       | ${"the floor"}
    ${"2016-12-31T12:00:00Z"}      | ${undefined} | ${57753 + 43_200 / 86_401}                     | ${"quasi-MJD on an 86401 s day"}
    ${"2016-12-31T23:59:60Z"}      | ${undefined} | ${57753 + 86_400 / 86_401}                     | ${"the inserted second"}
    ${"2016-12-31T23:59:60.5Z"}    | ${undefined} | ${57753 + 172_801 / 172_802}                   | ${"86400.5 s into an 86401 s day"}
    ${"2016-12-31T23:59:60.5Z"}    | ${"UTC"}     | ${57753 + 172_801 / 172_802}                   | ${"explicit UTC reads the same leap-second reading"}
    ${"2026-01-01T00:00:00Z"}      | ${undefined} | ${61041}                                       | ${"a whole MJD"}
    ${"2026-01-01T00:00:00Z"}      | ${"TAI"}     | ${61041 + 37 / 86_400}                         | ${"TAI - UTC = 37 s"}
    ${"2026-01-01T00:00:00Z"}      | ${"TCG"}     | ${61041 + 70_261_661_917 / 86_400_000_000_000} | ${"label 00:01:10.261661917 TCG"}
    ${"2026-01-01T01:00:00+01:00"} | ${undefined} | ${61041}                                       | ${"an offset is read as its instant"}
  `(
    "returns $expected for $isoString on scale $scale ($why)",
    ({ isoString, scale, expected }) => {
      expect(toModifiedJulianDate(isoString, scale)).toBe(expected);
    },
  );

  it("counts 40587 days from 1858-11-17 to 1970-01-01 and 51544 to 2000-01-01", () => {
    expect(
      Temporal.PlainDate.from("1858-11-17").until("1970-01-01", {
        largestUnit: "days",
      }).days,
    ).toBe(40587);
    expect(
      Temporal.PlainDate.from("1858-11-17").until("2000-01-01", {
        largestUnit: "days",
      }).days,
    ).toBe(51544);
  });

  it("returns null at the ceiling: 2973483 plus its fraction rounds to 2973484, which is 10000-01-01", () => {
    expect(toModifiedJulianDate("9999-12-31T23:59:59.999999999Z")).toBeNull();
  });

  it.each`
    isoString                           | scale
    ${"1972-01-01T00:00:00Z"}           | ${"TAI"}
    ${"1972-01-01T00:00:00Z"}           | ${"TT"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${"TAI"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${"TT"}
  `(
    "returns null at '$isoString' on $scale: the nearest double lies outside the domain",
    ({ isoString, scale }: { isoString: string; scale: TimeScale }) => {
      expect(toModifiedJulianDate(isoString, scale)).toBeNull();
    },
  );

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "never returns a number that fromModifiedJulianDate rejects within 100 µs of either end on $scale",
    ({ scale }: { scale: TimeScale }) => {
      expect(
        edgeSweepFailures(toModifiedJulianDate, fromModifiedJulianDate, scale),
      ).toEqual({ unreadable: [], gapped: [] });
    },
  );

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "never returns a number that fromModifiedJulianDate rejects for any of the fixture instants on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const bad = PARTS_INSTANTS.filter((x) => {
        const mjd = toModifiedJulianDate(x, scale);
        return mjd !== null && fromModifiedJulianDate(mjd, scale) === "";
      });
      expect(bad).toEqual([]);
    },
  );

  // The edge band is null just outside (pinned above) and a number just inside. 100 µs is past the
  // widest band (a double is 40 µs wide); the expected number is the label's whole MJD plus its
  // fraction of the day, one division of two exact integers.
  it.each`
    isoString                      | scale    | label
    ${"1972-01-01T00:00:00Z"}      | ${"UTC"} | ${"1972-01-01T00:00:00"}
    ${"1972-01-01T00:00:00.0001Z"} | ${"UTC"} | ${"1972-01-01T00:00:00.0001"}
    ${"1972-01-01T00:00:00.0001Z"} | ${"TAI"} | ${"1972-01-01T00:00:10.0001"}
    ${"1972-01-01T00:00:00.0001Z"} | ${"TT"}  | ${"1972-01-01T00:00:42.1841"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"UTC"} | ${"9999-12-31T23:59:59.9999"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"TAI"} | ${"+010000-01-01T00:00:36.9999"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"TT"}  | ${"+010000-01-01T00:01:09.1839"}
  `(
    "returns the nearest double of the label $label on $scale at the domain edge",
    ({
      isoString,
      scale,
      label,
    }: {
      isoString: string;
      scale: TimeScale;
      label: string;
    }) => {
      const { epochDay, nanosOfDay } = dayPositionOfLabel(label);
      expect(toModifiedJulianDate(isoString, scale)).toBe(
        Number(epochDay + 40_587n) + Number(nanosOfDay) / 86_400_000_000_000,
      );
    },
  );

  it.each`
    isoString                           | scale
    ${"1972-01-01T00:00:00Z"}           | ${"TCG"}
    ${"1972-01-01T00:00:00.0001Z"}      | ${"TCG"}
    ${"9999-12-31T23:59:59.9999Z"}      | ${"TCG"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${"TCG"}
  `(
    "returns a number that reads back inside the domain for '$isoString' on $scale",
    ({ isoString, scale }: { isoString: string; scale: TimeScale }) => {
      const mjd = toModifiedJulianDate(isoString, scale);
      expect(mjd).not.toBeNull();
      expect(fromModifiedJulianDate(mjd as number, scale)).not.toBe("");
    },
  );

  it.each`
    isoString                           | scale    | label
    ${"1971-12-31T23:59:59.999999999Z"} | ${"UTC"} | ${"'UTC'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TAI"} | ${"'TAI'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TT"}  | ${"'TT'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TCG"} | ${"'TCG'"}
    ${"2017-12-31T23:59:60Z"}           | ${"UTC"} | ${"'UTC'"}
    ${""}                               | ${"UTC"} | ${"'UTC'"}
    ${"not a date"}                     | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01"}                     | ${"UTC"} | ${"'UTC'"}
    ${"+010000-01-01T00:00:00Z"}        | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01T00:00:00Z"}           | ${"TDB"} | ${"'TDB'"}
    ${"2026-01-01T00:00:00Z"}           | ${"tt"}  | ${"'tt'"}
    ${"2026-01-01T00:00:00Z"}           | ${null}  | ${"null"}
    ${"2026-01-01T00:00:00Z"}           | ${5}     | ${"5"}
  `("returns null for '$isoString' on scale $label", ({ isoString, scale }) => {
    expect(toModifiedJulianDate(isoString, scale)).toBeNull();
  });

  it("returns null for an empty-string scale", () => {
    expect(
      toModifiedJulianDate("2026-01-01T00:00:00Z", "" as TimeScale),
    ).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(toModifiedJulianDate(undefined as unknown as string)).toBeNull();
    expect(toModifiedJulianDate(5 as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toModifiedJulianDate("2016-12-31T23:59:60Z")).toBeNull();
  });

  describe("precision", () => {
    // ulp of a positive double: 2^(floor(log2 x) - 52) (IEEE 754-2019 §3.4).
    const ulp = (x: number): number =>
      x === 0 ? 0 : 2 ** (Math.floor(Math.log2(x)) - 52);
    // Half an ulp of the result, in days: the exact MJD is rounded once.
    const bound = (value: number): number => ulp(value) / 2;
    const DAY = 86_400_000_000_000;
    // Nanoseconds since 1970-01-01 on TAI (a uniform count), from the slice-2 parts.
    const taiNanos = (x: string): bigint => {
      const parts = toJulianDateParts(x, "TAI") as { jd1: number; jd2: number };
      return (
        BigInt(parts.jd1) * BigInt(DAY) + BigInt(Math.round(parts.jd2 * DAY))
      );
    };

    it.each`
      scale
      ${"UTC"}
      ${"TAI"}
      ${"TT"}
      ${"TCG"}
    `(
      "round-trips 41 instants within the half-ulp bound on $scale",
      ({ scale }: { scale: TimeScale }) => {
        // At the two edges one double can round the instant just outside the domain; there
        // `toModifiedJulianDate` returns null (pinned above), so those are not round-tripped.
        const inside = PARTS_INSTANTS.filter(
          (x) => toModifiedJulianDate(x, scale) !== null,
        );
        expect(inside.length).toBeGreaterThanOrEqual(PARTS_INSTANTS.length - 2);
        const bad = inside.filter((x) => {
          const mjd = toModifiedJulianDate(x, scale) as number;
          const back = fromModifiedJulianDate(mjd, scale);
          if (back === "") {
            return true;
          }
          // A leap-second day is 86 401 s long on UTC, so a day's fraction scales by 86 401 / 86 400.
          const allowed = bound(mjd) * 86_401e9 + 1;
          const error = taiNanos(back) - taiNanos(canonicalInstant(x));
          return Math.abs(Number(error)) > allowed;
        });
        expect(bad).toEqual([]);
      },
    );

    it.each`
      scale
      ${"UTC"}
      ${"TAI"}
      ${"TT"}
      ${"TCG"}
    `(
      "is the double nearest the exact MJD for each instant with a label on $scale",
      ({ scale }: { scale: TimeScale }) => {
        // The label writers stop at 9999, so the last nanosecond of 9999 has no TAI, TT or TCG
        // label to count from; the edge sweep covers it.
        const counted = PARTS_INSTANTS.filter(
          (x) => exactEpochDaysOf(x, scale) !== null,
        );
        expect(counted.length).toBeGreaterThanOrEqual(
          PARTS_INSTANTS.length - 1,
        );
        const bad = counted.filter((x) => {
          const nearest = nearestModifiedJulianDate(x, scale);
          const expected =
            fromModifiedJulianDate(nearest, scale) === "" ? null : nearest;
          return !Object.is(toModifiedJulianDate(x, scale), expected);
        });
        expect(bad).toEqual([]);
      },
    );

    // Within picoseconds of a tie between two doubles: rounding the day's fraction first and then
    // adding the day number lands on the tie, and ties to even picks the double one ulp away.
    it("returns 60000.750000002234 for 2023-02-25T18:00:00.000192679Z, one rounding next to a tie", () => {
      const x = "2023-02-25T18:00:00.000192679Z";
      expect(nearestModifiedJulianDate(x, "UTC")).toBe(60_000.750_000_002_234);
      expect(toModifiedJulianDate(x)).toBe(60_000.750_000_002_234);
    });

    // ulp(61041) = 2^-37 day = 628.8 ns, so half an ulp is 314.4 ns: 300 ns rounds down, 400 ns up.
    it.each`
      isoString                         | expected
      ${"2026-01-01T00:00:00.0000003Z"} | ${61041}
      ${"2026-01-01T00:00:00.0000004Z"} | ${61041 + 2 ** -37}
    `(
      "rounds $isoString to $expected, the nearer double (half ulp is 314.4 ns)",
      ({ isoString, expected }) => {
        expect(toModifiedJulianDate(isoString)).toBe(expected);
      },
    );

    it("keeps within 0.32 µs at 2026-01-01T12:00:00.00002Z where a single JD loses 20 µs", () => {
      const x = "2026-01-01T12:00:00.00002Z";
      const jd = toJulianDateParts(x) as { jd1: number; jd2: number };
      const jdBack = Temporal.Instant.from(
        "2026-01-01T12:00:00Z",
      ).epochNanoseconds;
      // One double for the whole JD rounds 20 µs to the nearest 2^-31 day (40.2 µs): back to noon.
      expect(jd.jd1 + jd.jd2).toBe(2461042);
      expect(jdBack - Temporal.Instant.from(x).epochNanoseconds).toBe(-20_000n);
      const back = fromModifiedJulianDate(toModifiedJulianDate(x) as number);
      const error =
        Temporal.Instant.from(back).epochNanoseconds -
        Temporal.Instant.from(x).epochNanoseconds;
      expect(error >= -320n && error <= 320n).toBe(true);
    });

    it("has a bound at least 32 times below the single-JD bound for instants before 2038", () => {
      const early = PARTS_INSTANTS.filter((x) => x < "2038-04-23");
      expect(early.length).toBeGreaterThan(15);
      const bad = early.filter((x) => {
        const mjd = toModifiedJulianDate(x) as number;
        const parts = toJulianDateParts(x) as { jd1: number; jd2: number };
        return 32 * bound(mjd) > bound(parts.jd1 + parts.jd2);
      });
      expect(bad).toEqual([]);
    });
  });
});

/** The exact MJD of `x` on `scale` (days since 1970-01-01T00:00 + 40 587), rounded once. */
function nearestModifiedJulianDate(x: string, scale: TimeScale): number {
  const days = exactEpochDaysOf(x, scale) as {
    numerator: bigint;
    denominator: bigint;
  };
  return nearestDoubleOf(
    days.numerator + 40_587n * days.denominator,
    days.denominator,
  );
}
