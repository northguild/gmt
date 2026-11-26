import { Temporal } from "../internal/temporal";
import { toTAI } from "../timescale/convert/toTAI";
import { toTCG } from "../timescale/convert/toTCG";
import { toTT } from "../timescale/convert/toTT";
import type { TimeScale } from "../types/time-scale";

/** The 27 inserted leap seconds (IERS Leap_Second.dat through Bulletin C 72), as UTC dates. */
export const LEAP_SECOND_DAYS = [
  "1972-06-30",
  "1972-12-31",
  "1973-12-31",
  "1974-12-31",
  "1975-12-31",
  "1976-12-31",
  "1977-12-31",
  "1978-12-31",
  "1979-12-31",
  "1981-06-30",
  "1982-06-30",
  "1983-06-30",
  "1985-06-30",
  "1987-12-31",
  "1989-12-31",
  "1990-12-31",
  "1992-06-30",
  "1993-06-30",
  "1994-06-30",
  "1995-12-31",
  "1997-06-30",
  "1998-12-31",
  "2005-12-31",
  "2008-12-31",
  "2012-06-30",
  "2015-06-30",
  "2016-12-31",
];

/** Instants of the parts tests: the table rows of the spec, then each leap second at `:60.5`. */
export const PARTS_INSTANTS: string[] = [
  "2000-01-01T12:00:00Z",
  "2000-01-01T00:00:00Z",
  "2000-01-01T11:58:55.816Z",
  "2016-12-31T23:59:60Z",
  "2016-12-31T12:00:00Z",
  "2016-12-31T23:59:60.5Z",
  "2017-01-01T00:00:00Z",
  "2026-01-01T00:00:00Z",
  "2026-01-01T00:00:00.000000001Z",
  "2026-01-01T01:00:00+01:00",
  "1972-01-01T00:00:00Z",
  "9999-12-31T23:59:59.999999999Z",
  "2026-03-10T14:30:00.123456789Z",
  "2016-12-31T23:59:60.999999999Z",
  ...LEAP_SECOND_DAYS.map((day) => `${day}T23:59:60.5Z`),
];

const DAY = 86_400_000_000_000n;
const SECOND = 1_000_000_000n;

/**
 * The day and the nanoseconds into it that a time-scale label names, computed from the label
 * string alone: parse with Temporal.PlainDateTime, count nanoseconds in bigint. A label past 9999
 * (`+010000-01-01T00:00:36.9999`) is fine.
 *
 * @param label `YYYY-MM-DDTHH:MM:SS[.fraction]`, optionally followed by ` SCALE`
 * @returns days since 1970-01-01 and nanoseconds into that day
 */
export function dayPositionOfLabel(label: string): {
  epochDay: bigint;
  nanosOfDay: bigint;
} {
  const wall = Temporal.PlainDateTime.from(label.split(" ")[0] as string);
  const epochDay = BigInt(
    Temporal.PlainDate.from("1970-01-01").until(wall.toPlainDate(), {
      largestUnit: "days",
    }).days,
  );
  const nanosOfDay =
    BigInt(wall.hour) * 3_600_000_000_000n +
    BigInt(wall.minute) * 60_000_000_000n +
    BigInt(wall.second) * 1_000_000_000n +
    BigInt(wall.millisecond) * 1_000_000n +
    BigInt(wall.microsecond) * 1_000n +
    BigInt(wall.nanosecond);
  return { epochDay, nanosOfDay };
}

/**
 * The Julian Date a time-scale label names, as the two parts `toJulianDateParts` writes.
 * `jd2` is one division of two integers below 2⁵³ (IEEE 754-2019 §4.3).
 *
 * @param label `YYYY-MM-DDTHH:MM:SS[.fraction] SCALE`
 * @returns jd1 and jd2 of the label
 */
export function partsOfLabel(label: string): { jd1: number; jd2: number } {
  const { epochDay, nanosOfDay } = dayPositionOfLabel(label);
  // JD × DAY = nanoseconds since 1970-01-01T00:00 + 2440587.5 days.
  const total = epochDay * DAY + nanosOfDay + 2_440_587n * DAY + DAY / 2n;
  const jd1 = total / DAY;
  return { jd1: Number(jd1), jd2: Number(total - jd1 * DAY) / Number(DAY) };
}

/**
 * Days since 1970-01-01T00:00 on a scale, as an exact fraction. On `"UTC"` a day counts as one
 * whatever its length, so a reading on a leap-second day is its nanoseconds into that day over
 * 86 401 s (ERFA `dtf2d.c` Note 4); on `"TAI"`, `"TT"` and `"TCG"` it is the label `toTAI`,
 * `toTT` or `toTCG` writes, over 86 400 s. The Julian Date is this plus 2 440 587.5 and the MJD
 * this plus 40 587, so `nearestDoubleOf` on either gives the one correctly rounded double.
 *
 * @param x a UTC instant in `Z` form, or a `…T23:59:60[.fraction]Z` reading
 * @param scale the time scale to count on
 * @returns the exact day count, or null where the scale has no label
 */
export function exactEpochDaysOf(
  x: string,
  scale: TimeScale,
): { numerator: bigint; denominator: bigint } | null {
  if (scale !== "UTC") {
    const label = { TAI: toTAI, TT: toTT, TCG: toTCG }[scale](x);
    if (label === "") {
      return null;
    }
    const { epochDay, nanosOfDay } = dayPositionOfLabel(label);
    return { numerator: epochDay * DAY + nanosOfDay, denominator: DAY };
  }
  const reading = canonicalInstant(x);
  const leap = /^(\d{4}-\d{2}-\d{2})T23:59:60(?:\.(\d{1,9}))?Z$/.exec(reading);
  const date = reading.slice(0, 10);
  const { epochDay, nanosOfDay } =
    leap === null
      ? dayPositionOfLabel(reading.slice(0, -1))
      : {
          epochDay: dayPositionOfLabel(`${date}T00:00:00`).epochDay,
          nanosOfDay: 86_400n * SECOND + BigInt((leap[2] ?? "").padEnd(9, "0")),
        };
  const dayLength = LEAP_SECOND_DAYS.includes(date) ? DAY + SECOND : DAY;
  return {
    numerator: epochDay * dayLength + nanosOfDay,
    denominator: dayLength,
  };
}

/** `x` in `Z` form with Temporal's shortest fraction; a `:60` reading is already canonical. */
export function canonicalInstant(x: string): string {
  return x.includes(":60") ? x : Temporal.Instant.from(x).toString();
}

/** 1972-01-01T00:00:00Z in epoch nanoseconds (63 072 000 s: 730 days x 86 400 s). */
const FLOOR_NANOSECONDS = 63_072_000_000_000_000n;
/** 9999-12-31T23:59:59.999999999Z in epoch nanoseconds. */
const CEILING_NANOSECONDS = 253_402_300_799_999_999_999n;

/**
 * Instants within 100 µs of each end of the domain, every 2 µs, each at three nanosecond offsets
 * (0, 500 and 999 ns), the floor side first and walking inward, then the ceiling side walking
 * inward. A double near either end is 15 to 40 µs wide, so the band where `to*` must refuse lies
 * well inside this sweep.
 */
const DOMAIN_EDGE_SWEEP: { floor: string[]; ceiling: string[] } = (() => {
  const floor: string[] = [];
  const ceiling: string[] = [];
  for (let microseconds = 0n; microseconds <= 100n; microseconds += 2n) {
    for (const nanoseconds of [0n, 500n, 999n]) {
      const offset = microseconds * 1_000n + nanoseconds;
      floor.push(
        Temporal.Instant.fromEpochNanoseconds(
          FLOOR_NANOSECONDS + offset,
        ).toString(),
      );
      ceiling.push(
        Temporal.Instant.fromEpochNanoseconds(
          CEILING_NANOSECONDS - offset,
        ).toString(),
      );
    }
  }
  return { floor, ceiling };
})();

/**
 * The edge sweep as the contract of a single-double `to*` / `from*` pair states it: whenever `to`
 * returns a number, `from` reads it back as an instant (not ""), and the refusals are one band at
 * each end, so every instant further inside gives a number.
 *
 * @param to the single-double conversion under test
 * @param from its inverse
 * @param scale the scale to sweep on
 * @returns the instants whose number reads back as "", and those inside a refusal band that give a number
 */
export function edgeSweepFailures(
  to: (x: string, scale: "UTC" | "TAI" | "TT" | "TCG") => number | null,
  from: (n: number, scale: "UTC" | "TAI" | "TT" | "TCG") => string,
  scale: "UTC" | "TAI" | "TT" | "TCG",
): { unreadable: string[]; gapped: string[] } {
  const unreadable: string[] = [];
  const gapped: string[] = [];
  for (const side of [DOMAIN_EDGE_SWEEP.floor, DOMAIN_EDGE_SWEEP.ceiling]) {
    let inside = false;
    for (const x of side) {
      const n = to(x, scale);
      if (n === null) {
        if (inside) {
          gapped.push(x);
        }
        continue;
      }
      inside = true;
      if (from(n, scale) === "") {
        unreadable.push(x);
      }
    }
  }
  return { unreadable, gapped };
}

/**
 * The double nearest the exact rational `numerator / denominator`, ties to the even significand
 * (IEEE 754-2019 §4.3.1 roundTiesToEven), found by exact bigint comparison and independent of GMT
 * code. A float-division guess only seeds the search: the candidates are the guess and its eight
 * neighbours by bit pattern (the guess is under three ulps off, since each of its three roundings
 * is within half an ulp), and the nearest is chosen by comparing `|M × 2^E − numerator / denominator|`
 * scaled to integers, so the guess's own rounding never decides. For finite normal results.
 *
 * @param numerator any bigint
 * @param denominator a positive bigint
 * @returns the correctly rounded double
 */
export function nearestDoubleOf(
  numerator: bigint,
  denominator: bigint,
): number {
  if (numerator === 0n) {
    return 0;
  }
  const view = new DataView(new ArrayBuffer(8));
  /** A finite double as `significand × 2^power`, the significand signed and 53 bits wide. */
  const decompose = (x: number): { significand: bigint; power: bigint } => {
    view.setFloat64(0, x);
    const bits = view.getBigUint64(0);
    const biased = (bits >> 52n) & 0x7ffn;
    const fraction = bits & 0xf_ffff_ffff_ffffn;
    const significand = biased === 0n ? fraction : fraction | (1n << 52n);
    const power = (biased === 0n ? 1n : biased) - 1075n;
    return {
      significand: bits >> 63n === 1n ? -significand : significand,
      power,
    };
  };
  const guess = Number(numerator) / Number(denominator);
  view.setFloat64(0, guess);
  const base = view.getBigUint64(0);
  // Every error is |M × 2^power × denominator − numerator| / denominator; scaling by
  // denominator × 2^1100 keeps it an integer for any power ≥ −1074 and keeps the order.
  const SCALE = 1100n;
  let best = guess;
  let bestError: bigint | null = null;
  let bestEven = false;
  for (let step = -4n; step <= 4n; step += 1n) {
    view.setBigUint64(0, base + step);
    const candidate = view.getFloat64(0);
    const { significand, power } = decompose(candidate);
    const raw =
      ((significand * denominator) << (power + SCALE)) - (numerator << SCALE);
    const error = raw < 0n ? -raw : raw;
    const even = (significand & 1n) === 0n;
    if (
      bestError === null ||
      error < bestError ||
      (error === bestError && even && !bestEven)
    ) {
      best = candidate;
      bestError = error;
      bestEven = even;
    }
  }
  return best;
}
