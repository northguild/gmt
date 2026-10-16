/**
 * The pure helpers the leap-second tools share: the Leap Second Timeline and
 * Elapsed vs. Clock Difference, and the Satellite Clock Converter's slider.
 *
 * No gmt import: every function that reads the library takes a `TimescaleLib`
 * (`timescale-lib.ts`) as its first argument, loaded by the mount from the
 * real package. That keeps this module free of gmt imports and lets the tests
 * inject the real library by module path.
 *
 * Every inserted second, every step of TAI - UTC and every count shown by a
 * tool comes from a library call. The two constants below are the only dates
 * the site holds, each with its source, because the library exports neither.
 */

import type { TimescaleLib } from "./timescale-lib";

/**
 * UTC has differed from TAI by whole seconds since this instant (BIPM Annual
 * Report on Time Activities, Table 2; ITU-R TF.460-6; IERS `Leap_Second.dat`).
 * The library exports no constant for it; `taiMinusUtc` reads `10` here and
 * `null` one second before, and the tests say so.
 */
export const INTEGER_UTC_FROM = "1972-01-01T00:00:00Z";

/**
 * Continuous UTC becomes effective on this date: CGPM 2026 Resolution 5
 * ("continuous UTC will become effective on 20 May 2027"). A date with no time
 * of day, because the resolution states none. No library function returns it;
 * it is drawn as the end of insertions and never used in a calculation.
 */
export const CONTINUOUS_UTC_FROM = "2027-05-20";

/**
 * Every inserted second, in order, as its `…T23:59:60Z` label: the walk of
 * `nextLeapSecond` from `INTEGER_UTC_FROM` until it returns `""`. The walk
 * also stops if a step does not move forward, so a library fault cannot loop.
 */
export function insertions(lib: TimescaleLib): string[] {
  const found: string[] = [];
  let current = INTEGER_UTC_FROM;
  for (;;) {
    const next = lib.nextLeapSecond(current);
    if (next === "" || next === current) return found;
    found.push(next);
    current = next;
  }
}

/**
 * The first instant on the new offset after an insertion:
 * `addUtc(<the insertion with second 59>, { seconds: 1 })`. Rewriting `60` as
 * `59` is reading the label, not arithmetic; the library does the adding.
 * `""` when the label does not end in second 60 or the library refuses it.
 */
export function secondAfter(lib: TimescaleLib, insertion: string): string {
  const match = /^(.*T\d{2}:\d{2}:)60(Z)$/.exec(insertion);
  if (match === null) return "";
  return lib.addUtc(`${match[1]}59${match[2]}`, { seconds: 1 });
}

/**
 * The `|count|` insertions that `leapSecondsBetween(start, end)` counted,
 * named. The count is half-open, `[start, end)`, so the list starts at the
 * earlier endpoint: that endpoint itself when it is a listed insertion (read
 * back through TAI, which spells it as `…T23:59:60Z`; one that starts after
 * `:60.000` is not counted and is not listed), then `nextLeapSecond` until
 * the list holds `|count|`. A count of 0 gives an empty list.
 *
 * `count` is the library's own answer for the same `start` and `end`. The walk
 * stops early if `nextLeapSecond` runs out.
 */
export function insertionsBetween(
  lib: TimescaleLib,
  start: string,
  end: string,
  count: number,
): string[] {
  const wanted = Math.abs(count);
  const list: string[] = [];
  if (wanted === 0) return list;
  const earlier = count > 0 ? start : end;
  if (lib.isLeapSecond(earlier)) {
    const label = lib.fromTAI(lib.toTAI(earlier));
    if (insertions(lib).includes(label)) list.push(label);
  }
  let current = earlier;
  while (list.length < wanted) {
    const next = lib.nextLeapSecond(current);
    if (next === "" || next === current) break;
    list.push(next);
    current = next;
  }
  return list;
}

/**
 * Exact nanoseconds as seconds: `86401n * 10n ** 9n` reads `"86401 s"`, and a
 * fraction is written to nine digits with its trailing zeros dropped
 * (`1500000000n` reads `"1.5 s"`). A negative span keeps its sign.
 * Formatting only.
 */
export function secondsText(ns: bigint): string {
  const sign = ns < 0n ? "-" : "";
  const magnitude = ns < 0n ? -ns : ns;
  const whole = magnitude / 1_000_000_000n;
  const fraction = (magnitude % 1_000_000_000n)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${fraction === "" ? "" : `.${fraction}`} s`;
}
