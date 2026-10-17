/**
 * The pure helpers the three GNSS tools share: the GNSS Week Decoder, the
 * Satellite Clock Converter and the GNSS Rollover Checker.
 *
 * No gmt import: every function that reads the library takes a `GnssLib`
 * (`gnss-lib.ts`) as its first argument, loaded by the mount from the real
 * package. That keeps this module free of gmt imports and lets the tests
 * inject the real library by module path.
 *
 * The site holds no table of the library's rules. A counter's width, a
 * system's first instant and an era's start are asked of the library with the
 * calls below; the only thing written here is how a counter's name splits
 * (the token before the `-`) and the wording of the shared sentences.
 */

import {
  GNSS_WEEK_COUNTERS,
  type CounterSystem,
  type GnssWeekCounter,
  type RinexWeekSystem,
} from "./gnss-names";
import type { GnssLib } from "./gnss-lib";

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** A counter's system: the token before the `-` (`"QZS-CNAV"` gives `"QZS"`,
 *  `"GAL"` gives `"GAL"`). That is the library's naming rule applied to a
 *  name, not a table. */
export function counterSystem<C extends GnssWeekCounter>(
  counter: C,
): CounterSystem<C> {
  return counter.split("-")[0] as CounterSystem<C>;
}

/** A scale string split at its one space. */
export interface LabelParts {
  /** `YYYY-MM-DDTHH:MM:SS[.f]`, as the library wrote it. */
  dateTime: string;
  /** The scale's token: `GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN` or `TAI`. */
  token: string;
}

/** Split a scale string such as `"2024-01-01T00:00:04 BDT"` at its one space.
 *  `null` for anything without exactly one space, with either side empty. */
export function labelParts(label: string): LabelParts | null {
  const parts = label.split(" ");
  if (parts.length !== 2) return null;
  const [dateTime, token] = parts;
  if (!dateTime || !token) return null;
  return { dateTime, token };
}

// ---------------------------------------------------------------------------
// Instants with an offset
// ---------------------------------------------------------------------------

/**
 * An instant written with `Z`. `diffUtcAsDuration`, `areUtcEqual` and the
 * week converters read `Z` only, so a value written with an offset
 * (`2024-01-01T00:00:00+01:00`) goes through the library's `toOffsetInstant`
 * once, where it is read. A value that already ends in `Z`, and anything the
 * library cannot read, comes back as typed, so the caller's own checks still
 * see it.
 */
export function asZ(lib: GnssLib, value: string): string {
  if (value.endsWith("Z")) return value;
  return lib.toOffsetInstant(value)?.instant ?? value;
}

// ---------------------------------------------------------------------------
// A scale's lead over UTC
// ---------------------------------------------------------------------------

/** What `leadOverUtc` found, one shape for every outcome. */
export type Lead =
  | {
      kind: "lead";
      /** The library's duration for `utc` to the label, `"PT18S"`. */
      duration: string;
    }
  /** Either reading holds second 60, which `diffUtcAsDuration` cannot read. */
  | { kind: "inside-inserted-second" }
  /** No label to compare, or the library read nothing. */
  | { kind: "none" };

/**
 * How far a scale's label is ahead of the UTC instant it was made from:
 * `diffUtcAsDuration(utc, <the label's date-time>Z, "seconds")`.
 *
 * The label's date-time is read as if it were a `Z` instant, which is the
 * scale's own wall clock against UTC's. When the instant or the label holds
 * second 60 (`hasSecond60`, the library's own test), `diffUtcAsDuration`
 * cannot read it, so the answer is "inside an inserted second".
 */
export function leadOverUtc(lib: GnssLib, utc: string, label: string): Lead {
  const parts = labelParts(label);
  if (parts === null) return { kind: "none" };
  utc = asZ(lib, utc);
  if (lib.hasSecond60(utc) || lib.hasSecond60(parts.dateTime)) {
    return { kind: "inside-inserted-second" };
  }
  const duration = lib.diffUtcAsDuration(utc, `${parts.dateTime}Z`, "seconds");
  return duration === "" ? { kind: "none" } : { kind: "lead", duration };
}

/**
 * The number of seconds in a duration `diffUtcAsDuration` returned in
 * seconds: `"PT18S"` gives `"18"`, `"-PT3S"` gives `"-3"`, `"PT0.5S"` gives
 * `"0.5"`. Formatting only. `null` for any other shape.
 */
export function durationSecondsText(duration: string): string | null {
  const match = /^(-?)PT(\d+(?:\.\d+)?)S$/.exec(duration);
  return match === null ? null : `${match[1]}${match[2]}`;
}

// ---------------------------------------------------------------------------
// Probes of the library
// ---------------------------------------------------------------------------

/** First refused week, per library and counter. Keyed on the library object
 *  so a test's library and the page's never share an answer. */
const FIRST_REFUSED = new WeakMap<GnssLib, Map<GnssWeekCounter, number>>();

/**
 * The smallest week the library refuses on a counter at era 0: found by
 * doubling `w` until `gnssWeekToUtc(counter, w, 0, 0)` is `""`, then
 * bisecting between the last accepted week and that one. The counter shows
 * the weeks below it. Cached per counter.
 *
 * A counter whose week 0 is refused answers 0 (every week is refused). The
 * doubling stops at the largest safe integer, which the library refuses long
 * before.
 */
export function firstRefusedWeek(
  lib: GnssLib,
  counter: GnssWeekCounter,
): number {
  let perLib = FIRST_REFUSED.get(lib);
  if (perLib === undefined) {
    perLib = new Map();
    FIRST_REFUSED.set(lib, perLib);
  }
  const cached = perLib.get(counter);
  if (cached !== undefined) return cached;

  const refused = (week: number) =>
    lib.gnssWeekToUtc(counter, week, 0, 0) === "";
  let answer: number;
  if (refused(0)) {
    answer = 0;
  } else {
    let accepted = 0;
    let step = 1;
    while (step <= Number.MAX_SAFE_INTEGER && !refused(step)) {
      accepted = step;
      step *= 2;
    }
    let refusedAt = Math.min(step, Number.MAX_SAFE_INTEGER);
    while (refusedAt - accepted > 1) {
      const middle = accepted + Math.floor((refusedAt - accepted) / 2);
      if (refused(middle)) refusedAt = middle;
      else accepted = middle;
    }
    answer = refusedAt;
  }
  perLib.set(counter, answer);
  return answer;
}

/** Where an era starts on a counter: `gnssWeekToUtc(counter, 0, 0, era)`.
 *  `""` when the library refuses the era. */
export function eraStart(
  lib: GnssLib,
  counter: GnssWeekCounter,
  era: number,
): string {
  return lib.gnssWeekToUtc(counter, 0, 0, era);
}

/** The era an instant falls in on a counter: the `era` of `utcToGnssWeek`.
 *  `null` before the counter's first week and on invalid input. */
export function eraAt(
  lib: GnssLib,
  counter: GnssWeekCounter,
  instant: string,
): number | null {
  return lib.utcToGnssWeek(counter, instant)?.era ?? null;
}

/**
 * The first instant a system's clock reads, asked of the library: the era 0
 * start of the first counter of that system. A RINEX week cannot be asked
 * (`rinexWeekToUtc(system, 0, 0)` is `""` for `GAL` and `IRN`, whose clocks
 * start in 1999 while a RINEX week counts from 1980). `""` when no counter
 * belongs to the system.
 */
export function systemFirstInstant(
  lib: GnssLib,
  system: RinexWeekSystem,
): string {
  const counter = GNSS_WEEK_COUNTERS.find((c) => counterSystem(c) === system);
  return counter === undefined ? "" : eraStart(lib, counter, 0);
}

// ---------------------------------------------------------------------------
// Shared sentences
// ---------------------------------------------------------------------------

/** What a plate, a lane chip or a cell says when its own call gave nothing. */
export const NO_RESULT_TEXT = "no result";

/** The footnote under a table whose cells include a missing reading. */
export const BEFORE_FIRST_WEEK_NOTE = "before this system's first week";

/** The sentence for a UTC instant before a counter's first week. */
export function beforeFirstWeekText(firstInstant: string): string {
  return `This is before the counter's first week, which starts at ${firstInstant}.`;
}

/** The sentence for a week the counter does not show. */
export function weeksBelowText(firstRefused: number): string {
  return `This counter shows weeks below ${firstRefused}.`;
}
