import type { EasterComputus } from "../types/holiday-rule";
import { epochDayOf, MAX_EPOCH_DAY, MIN_EPOCH_DAY } from "./epochDay";

const floor = Math.floor;
/** Floor modulo: the remainder takes the divisor's sign, so zero and negative years hold. */
const mod = (a: number, b: number): number => ((a % b) + b) % b;

/** Gregorian computus of Meeus, Astronomical Algorithms 2nd ed., ch. 8: [month, day] of Easter. */
function gregorianMonthDay(year: number): [number, number] {
  const a = mod(year, 19);
  const b = floor(year / 100);
  const c = mod(year, 100);
  const d = floor(b / 4);
  const e = mod(b, 4);
  const f = floor((b + 8) / 25);
  const g = floor((b - f + 1) / 3);
  const h = mod(19 * a + b - d - g + 15, 30);
  const i = floor(c / 4);
  const k = mod(c, 4);
  const l = mod(32 + 2 * e + 2 * i - h - k, 7);
  const m = floor((a + 11 * h + 22 * l) / 451);
  const sum = h + l - 7 * m + 114;

  return [floor(sum / 31), mod(sum, 31) + 1];
}

/** Julian computus of Meeus, Astronomical Algorithms 2nd ed., ch. 8: [month, day] in the Julian calendar. */
function julianMonthDay(year: number): [number, number] {
  const a = mod(year, 4);
  const b = mod(year, 7);
  const c = mod(year, 19);
  const d = mod(19 * c + 15, 30);
  const e = mod(2 * a + 4 * b - d + 34, 7);
  const sum = d + e + 114;

  return [floor(sum / 31), mod(sum, 31) + 1];
}

/**
 * Epoch day of Easter Sunday of `year` under the computus, or `null` outside Temporal's range.
 *
 * The Gregorian method is applied proleptically before 1583 (Temporal dates are proleptic
 * Gregorian). The Julian date is moved to ISO by adding ⌊Y/100⌋ − ⌊Y/400⌋ − 2 days, the
 * Julian-to-Gregorian difference from 1 March onward (Meeus ch. 7, Julian Day with B = 0).
 */
export function easterEpochDay(
  year: number,
  computus: EasterComputus,
): number | null {
  let epoch: number;
  if (computus === "julian") {
    const [month, day] = julianMonthDay(year);
    epoch =
      epochDayOf(year, month, day) +
      (floor(year / 100) - floor(year / 400) - 2);
  } else {
    const [month, day] = gregorianMonthDay(year);
    epoch = epochDayOf(year, month, day);
  }

  return epoch < MIN_EPOCH_DAY || epoch > MAX_EPOCH_DAY ? null : epoch;
}
