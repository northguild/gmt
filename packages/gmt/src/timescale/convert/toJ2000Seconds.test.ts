import { Temporal } from "../../internal/temporal";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import {
  edgeSweepFailures,
  LEAP_SECOND_DAYS,
  nearestDoubleOf,
  PARTS_INSTANTS,
} from "../../test/julianDateFixtures";
import type { TimeScale } from "../../types/time-scale";
import { fromJ2000Seconds } from "./fromJ2000Seconds";
import { toJ2000Seconds } from "./toJ2000Seconds";
import { toTAI } from "./toTAI";
import { toTCG } from "./toTCG";
import { toTT } from "./toTT";

// Expected values come from the rule (J2000.0 is 2000-01-01T12:00:00 on the scale, IAU 1994 C7;
// seconds = (JD - 2451545.0) x 86 400, ERFA_DJ00 / ERFA_DAYSEC) worked out in bigint
// nanoseconds, then rounded once to the nearest double. On a UTC day of 86 401 s the count is the
// exact rational (A x L + n x DAY) / (L x 10^9), A the ns from J2000.0 to the day's start, n the
// ns into it, L the day's length (ERFA dtf2d.c Note 4: the quasi-JD day is one day whatever its
// length); it is never rounded to a nanosecond first.
const DAY = 86_400_000_000_000n;
const SECOND = 1_000_000_000n;

/** Nanoseconds from 2000-01-01T12:00:00 to a `YYYY-MM-DDTHH:MM:SS[.f]` label, in bigint. */
function nanosSinceJ2000OfLabel(label: string): bigint {
  const wall = Temporal.PlainDateTime.from(label.split(" ")[0] as string);
  const days = BigInt(
    Temporal.PlainDate.from("2000-01-01").until(wall.toPlainDate(), {
      largestUnit: "days",
    }).days,
  );
  const nanosOfDay =
    BigInt(wall.hour) * 3_600n * SECOND +
    BigInt(wall.minute) * 60n * SECOND +
    BigInt(wall.second) * SECOND +
    BigInt(wall.millisecond) * 1_000_000n +
    BigInt(wall.microsecond) * 1_000n +
    BigInt(wall.nanosecond);
  return days * DAY + nanosOfDay - DAY / 2n;
}

describe("toJ2000Seconds", () => {
  it.each`
    isoString                      | scale        | expected           | why
    ${"2000-01-01T11:58:55.816Z"}  | ${undefined} | ${0}               | ${"J2000.0 itself; default is TT, TT - UTC = 64.184 s in 2000"}
    ${"2000-01-01T12:00:00Z"}      | ${undefined} | ${64.184}          | ${"default scale is TT"}
    ${"2000-01-01T12:00:00Z"}      | ${"TT"}      | ${64.184}          | ${"explicit TT is the default"}
    ${"2000-01-01T12:00:00Z"}      | ${"UTC"}     | ${0}               | ${"noon UTC on J2000 day"}
    ${"2000-01-01T12:00:00Z"}      | ${"TAI"}     | ${32}              | ${"TAI - UTC = 32 s"}
    ${"2026-01-01T00:00:00Z"}      | ${"UTC"}     | ${820_497_600}     | ${"1767225600 - 946728000"}
    ${"2026-01-01T00:00:00Z"}      | ${undefined} | ${820_497_669.184} | ${"TT - UTC = 69.184 s"}
    ${"2026-01-01T00:00:00Z"}      | ${"TAI"}     | ${820_497_637}     | ${"TAI - UTC = 37 s"}
    ${"2016-12-31T23:59:60Z"}      | ${undefined} | ${536_500_868.184} | ${"TT is continuous through the leap second"}
    ${"2017-01-01T00:00:00Z"}      | ${"UTC"}     | ${536_500_800}     | ${"the day after a leap second is ordinary"}
    ${"1999-12-31T23:59:59Z"}      | ${"UTC"}     | ${-43_201}         | ${"negative before J2000.0"}
    ${"1972-01-01T00:00:00Z"}      | ${"UTC"}     | ${-883_656_000}    | ${"1972 floor: (730 - 10957) x 86400 - 43200"}
    ${"1972-01-01T00:00:00Z"}      | ${"TAI"}     | ${-883_655_990}    | ${"the floor on TAI: label 00:00:10"}
    ${"1999-12-31T12:00:00.5Z"}    | ${"UTC"}     | ${-86_399.5}       | ${"negative with a dyadic fraction"}
    ${"2000-01-01T11:59:59.5Z"}    | ${"UTC"}     | ${-0.5}            | ${"half a second before J2000.0"}
    ${"2026-01-01T01:00:00+01:00"} | ${"UTC"}     | ${820_497_600}     | ${"an offset is read as its instant"}
  `(
    "returns $expected for $isoString on scale $scale ($why)",
    ({ isoString, scale, expected }) => {
      expect(toJ2000Seconds(isoString, scale)).toBe(expected);
    },
  );

  /** Numerator and denominator of the exact J2000 seconds of `n` ns into the 86 401 s day `epochDay`. */
  const leapDaySeconds = (epochDay: bigint, n: bigint): [bigint, bigint] => {
    const length = 86_401n * SECOND;
    const start = (epochDay - 10_957n) * DAY - DAY / 2n;
    return [start * length + n * DAY, length * SECOND];
  };

  it("returns the scaled quasi-day count on a leap-second day on UTC", () => {
    // Day 17 166 is 2016-12-31; the inserted second starts 86 400 s in, 86 400/86 401 of the day.
    const [numerator, denominator] = leapDaySeconds(17_166n, 86_400n * SECOND);
    expect(toJ2000Seconds("2016-12-31T23:59:60Z", "UTC")).toBe(
      nearestDoubleOf(numerator, denominator),
    );
  });

  it.each`
    isoString                           | n                      | expected                | why
    ${"1972-12-31T02:30:00.10147328Z"}  | ${9_000_101_473_280n}  | ${-852_111_000.0026934} | ${"day 1095; a nanosecond-rounded count lands one ulp low"}
    ${"1975-12-31T09:25:41.039980352Z"} | ${33_941_039_980_352n} | ${-757_478_059.3528513} | ${"day 2190; a nanosecond-rounded count lands one ulp low"}
    ${"1975-12-31T17:16:43.181670016Z"} | ${62_203_181_670_016n} | ${-757_449_797.5382658} | ${"day 2190; a nanosecond-rounded count lands one ulp high"}
    ${"2016-12-31T23:59:60Z"}           | ${86_400_000_000_000n} | ${536_500_799.00001156} | ${"day 17166, the inserted second"}
    ${"2016-12-31T23:59:60.5Z"}         | ${86_400_500_000_000n} | ${536_500_799.5000058}  | ${"day 17166, half into the inserted second"}
  `(
    "returns $expected for $isoString on UTC, the double nearest the exact scaled count ($why)",
    ({
      isoString,
      n,
      expected,
    }: {
      isoString: string;
      n: bigint;
      expected: number;
    }) => {
      const epochDay = BigInt(
        Temporal.PlainDate.from("1970-01-01").until(isoString.slice(0, 10), {
          largestUnit: "days",
        }).days,
      );
      expect(nearestDoubleOf(...leapDaySeconds(epochDay, n))).toBe(expected);
      expect(toJ2000Seconds(isoString, "UTC")).toBe(expected);
    },
  );

  it.each`
    isoString                           | scale    | label
    ${"2026-01-01T00:00:00Z"}           | ${"TCG"} | ${toTCG}
    ${"2026-01-01T00:00:00Z"}           | ${"TT"}  | ${toTT}
    ${"2026-01-01T00:00:00Z"}           | ${"TAI"} | ${toTAI}
    ${"2000-01-01T12:00:00Z"}           | ${"TCG"} | ${toTCG}
    ${"1972-01-01T00:00:00Z"}           | ${"TCG"} | ${toTCG}
    ${"1972-01-01T00:00:00Z"}           | ${"TT"}  | ${toTT}
    ${"1972-01-01T00:00:00Z"}           | ${"TAI"} | ${toTAI}
    ${"1999-12-31T12:00:00Z"}           | ${"TT"}  | ${toTT}
    ${"2026-03-10T14:30:00.123456789Z"} | ${"TT"}  | ${toTT}
  `(
    "counts from the label SPA-47 writes for $isoString on $scale",
    ({
      isoString,
      scale,
      label,
    }: {
      isoString: string;
      scale: TimeScale;
      label: (x: string) => string;
    }) => {
      expect(toJ2000Seconds(isoString, scale)).toBe(
        nearestDoubleOf(nanosSinceJ2000OfLabel(label(isoString)), SECOND),
      );
    },
  );

  it("gives the TCG value of the 2026 row, label 00:01:10.261661917 TCG", () => {
    expect(toTCG("2026-01-01T00:00:00Z")).toBe(
      "2026-01-01T00:01:10.261661917 TCG",
    );
    expect(toJ2000Seconds("2026-01-01T00:00:00Z", "TCG")).toBe(
      nearestDoubleOf(820_497_670_261_661_917n, SECOND),
    );
  });

  // ulp(820497600) = 2^-23 s = 119.2 ns, so half an ulp is 59.6 ns: 50 ns rounds down, 70 ns up.
  it.each`
    isoString                          | expected
    ${"2026-01-01T00:00:00.00000005Z"} | ${820_497_600}
    ${"2026-01-01T00:00:00.00000007Z"} | ${820_497_600 + 2 ** -23}
  `(
    "rounds $isoString on UTC to $expected, the nearer double (half ulp is 59.6 ns)",
    ({ isoString, expected }) => {
      expect(toJ2000Seconds(isoString, "UTC")).toBe(expected);
    },
  );

  // The D5 band is null just outside (pinned below) and a number just inside. 100 µs is past the
  // widest band (a double is 30 µs wide at the ceiling); there is no band at the floor.
  it.each`
    isoString                           | scale    | label
    ${"1972-01-01T00:00:00Z"}           | ${"TAI"} | ${"1972-01-01T00:00:10"}
    ${"1972-01-01T00:00:00Z"}           | ${"TT"}  | ${"1972-01-01T00:00:42.184"}
    ${"1972-01-01T00:00:00.0001Z"}      | ${"UTC"} | ${"1972-01-01T00:00:00.0001"}
    ${"1972-01-01T00:00:00.0001Z"}      | ${"TAI"} | ${"1972-01-01T00:00:10.0001"}
    ${"1972-01-01T00:00:00.0001Z"}      | ${"TT"}  | ${"1972-01-01T00:00:42.1841"}
    ${"9999-12-31T23:59:59.9999Z"}      | ${"UTC"} | ${"9999-12-31T23:59:59.9999"}
    ${"9999-12-31T23:59:59.9999Z"}      | ${"TAI"} | ${"+010000-01-01T00:00:36.9999"}
    ${"9999-12-31T23:59:59.9999Z"}      | ${"TT"}  | ${"+010000-01-01T00:01:09.1839"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${"TT"}  | ${"+010000-01-01T00:01:09.183999999"}
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
      expect(toJ2000Seconds(isoString, scale)).toBe(
        nearestDoubleOf(nanosSinceJ2000OfLabel(label), SECOND),
      );
    },
  );

  it.each`
    isoString                      | scale
    ${"1972-01-01T00:00:00.0001Z"} | ${"TCG"}
    ${"9999-12-31T23:59:59.9999Z"} | ${"TCG"}
  `(
    "returns a number that reads back inside the domain for '$isoString' on $scale",
    ({ isoString, scale }: { isoString: string; scale: TimeScale }) => {
      const seconds = toJ2000Seconds(isoString, scale);
      expect(seconds).not.toBeNull();
      expect(fromJ2000Seconds(seconds as number, scale)).not.toBe("");
    },
  );

  // Each expected value is the decimal literal of the double nearest the exact quotient q / 10^9,
  // which the JavaScript parser rounds correctly (one rounding). q is past 2^53 ns on every row but
  // the first two, where a two-step sum (whole seconds, then fraction) rounds twice.
  it.each`
    isoString                           | expected
    ${"2000-01-01T11:59:59.948876883Z"} | ${-0.051123117}
    ${"2000-01-01T12:00:49.513894509Z"} | ${49.513894509}
    ${"2000-01-01T12:00:01.500360276Z"} | ${1.500360276}
    ${"2026-01-01T00:00:00.000000001Z"} | ${820_497_600}
  `(
    "returns the once-rounded double $expected for $isoString on UTC",
    ({ isoString, expected }) => {
      expect(toJ2000Seconds(isoString, "UTC")).toBe(expected);
    },
  );

  it.each`
    scale
    ${"UTC"}
    ${"TT"}
  `(
    "matches the exactly rounded nearest double for 3000 seeded instants within 1000 s of J2000.0 on $scale",
    ({ scale }: { scale: TimeScale }) => {
      // mulberry32, seed fixed: the same instants every run.
      let state = scale === "UTC" ? 0x2f6e2b1 : 0x9e3779b9;
      const next = (): bigint => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return BigInt((t ^ (t >>> 14)) >>> 0);
      };
      const J2000_UTC_EPOCH_NANOSECONDS = 946_728_000n * SECOND;
      // TT - UTC is 64.184 s throughout 2000.
      const shift = scale === "UTC" ? 0n : 64_184_000_000n;
      const bad: string[] = [];
      for (let i = 0; i < 3000; i += 1) {
        const offset =
          (((next() << 32n) | next()) % (2_000n * SECOND)) - 1_000n * SECOND;
        const isoString = Temporal.Instant.fromEpochNanoseconds(
          J2000_UTC_EPOCH_NANOSECONDS + offset,
        ).toString();
        const expected = nearestDoubleOf(offset + shift, SECOND);
        if (!Object.is(toJ2000Seconds(isoString, scale), expected)) {
          bad.push(isoString);
        }
      }
      expect(bad).toEqual([]);
    },
  );

  it("matches the double nearest the exact scaled count for 300 seeded instants on each of the 27 leap-second days on UTC", () => {
    // mulberry32, seed fixed: the same instants every run. Every tenth instant falls in the
    // inserted second, written as second 60.
    let state = 0x1ea95ec0;
    const next = (): bigint => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return BigInt((t ^ (t >>> 14)) >>> 0);
    };
    const bad: string[] = [];
    for (const day of LEAP_SECOND_DAYS) {
      const dayStart = Temporal.Instant.from(
        `${day}T00:00:00Z`,
      ).epochNanoseconds;
      const epochDay = dayStart / DAY;
      for (let i = 0; i < 300; i += 1) {
        const random = (next() << 32n) | next();
        const n =
          i % 10 === 0
            ? 86_400n * SECOND + (random % SECOND)
            : random % (86_400n * SECOND);
        const isoString =
          n >= 86_400n * SECOND
            ? `${day}T23:59:60.${String(n - 86_400n * SECOND).padStart(9, "0")}Z`
            : Temporal.Instant.fromEpochNanoseconds(dayStart + n).toString();
        const expected = nearestDoubleOf(...leapDaySeconds(epochDay, n));
        if (!Object.is(toJ2000Seconds(isoString, "UTC"), expected)) {
          bad.push(isoString);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it.each`
    centre
    ${"2026-01-01T00:00:00Z"}
    ${"2500-06-15T00:00:00Z"}
    ${"9000-01-01T00:00:00Z"}
  `(
    "matches the exactly rounded nearest double for 1000 seeded instants within 1000 s of $centre on UTC, where q passes 2^53 ns",
    ({ centre }: { centre: string }) => {
      let state = 0x51ed270b;
      const next = (): bigint => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return BigInt((t ^ (t >>> 14)) >>> 0);
      };
      const centreNanoseconds = Temporal.Instant.from(centre).epochNanoseconds;
      const bad: string[] = [];
      for (let i = 0; i < 1000; i += 1) {
        const offset =
          (((next() << 32n) | next()) % (2_000n * SECOND)) - 1_000n * SECOND;
        const isoString = Temporal.Instant.fromEpochNanoseconds(
          centreNanoseconds + offset,
        ).toString();
        const q = centreNanoseconds + offset - 946_728_000n * SECOND;
        expect(q > 2n ** 53n).toBe(true);
        if (
          !Object.is(
            toJ2000Seconds(isoString, "UTC"),
            nearestDoubleOf(q, SECOND),
          )
        ) {
          bad.push(isoString);
        }
      }
      expect(bad).toEqual([]);
    },
  );

  it.each`
    isoString                           | scale    | label
    ${"1971-12-31T23:59:59.999999999Z"} | ${"UTC"} | ${"'UTC'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TAI"} | ${"'TAI'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TT"}  | ${"'TT'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TCG"} | ${"'TCG'"}
    ${"+010000-01-01T00:00:00Z"}        | ${"UTC"} | ${"'UTC'"}
    ${"2017-12-31T23:59:60Z"}           | ${"UTC"} | ${"'UTC'"}
    ${""}                               | ${"UTC"} | ${"'UTC'"}
    ${"not a date"}                     | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01"}                     | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01T00:00:00Z"}           | ${"TDB"} | ${"'TDB'"}
    ${"2026-01-01T00:00:00Z"}           | ${"tt"}  | ${"'tt'"}
    ${"2026-01-01T00:00:00Z"}           | ${null}  | ${"null"}
    ${"2026-01-01T00:00:00Z"}           | ${5}     | ${"5"}
  `("returns null for '$isoString' on scale $label", ({ isoString, scale }) => {
    expect(toJ2000Seconds(isoString, scale)).toBeNull();
  });

  it("returns null for an empty-string scale", () => {
    expect(toJ2000Seconds("2026-01-01T00:00:00Z", "" as TimeScale)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(toJ2000Seconds(undefined as unknown as string)).toBeNull();
    expect(toJ2000Seconds(5 as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toJ2000Seconds("2016-12-31T23:59:60Z")).toBeNull();
  });

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TCG"}
  `(
    "returns null at the ceiling on $scale: the nearest double lies past year 9999",
    ({ scale }: { scale: TimeScale }) => {
      expect(
        toJ2000Seconds("9999-12-31T23:59:59.999999999Z", scale),
      ).toBeNull();
    },
  );

  it("returns the nearest double 30 µs inside the ceiling on UTC", () => {
    const q = nanosSinceJ2000OfLabel("9999-12-31T23:59:59.999969999");
    expect(toJ2000Seconds("9999-12-31T23:59:59.999969999Z", "UTC")).toBe(
      nearestDoubleOf(q, SECOND),
    );
  });

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "never returns a number that fromJ2000Seconds rejects within 100 µs of either end on $scale",
    ({ scale }: { scale: TimeScale }) => {
      expect(
        edgeSweepFailures(toJ2000Seconds, fromJ2000Seconds, scale),
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
    "never returns a number that fromJ2000Seconds rejects for any of the fixture instants on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const bad = PARTS_INSTANTS.filter((x) => {
        const seconds = toJ2000Seconds(x, scale);
        return seconds !== null && fromJ2000Seconds(seconds, scale) === "";
      });
      expect(bad).toEqual([]);
    },
  );
});
