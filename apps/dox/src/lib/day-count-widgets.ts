/**
 * Pure helpers the day-count tools share: the Julian Day Counter and the Double Precision Meter.
 *
 * One instant is written four ways on a scale: a two-part Julian Date, a single Julian Date, a
 * Modified Julian Date and seconds since J2000.0. Each way is spelled back to UTC, and the gap
 * between the instant and its spelling is measured in whole nanoseconds on TAI, so a shift is
 * the library's own span and never a subtraction of doubles.
 *
 * No DOM and no gmt import. Every function that calls the library takes a `DayCountLib`
 * (`timescale-lib.ts`). No epoch offset and no day length is written in this file: every number
 * a reading shows comes from a library call.
 */
import { runCall, type EdiCall } from "./edi-widgets";
import type { DayCountLib } from "./timescale-lib";
import { asUtc } from "./timescale-widgets";

/** The four scales the library counts days on. TDB is not one of them. */
export const SCALES = ["UTC", "TAI", "TT", "TCG"] as const;
export type Scale = (typeof SCALES)[number];

/** The four forms of one instant. */
export const FORMS = ["parts", "jd", "mjd", "j2000"] as const;
export type Form = (typeof FORMS)[number];

export interface JdParts {
  jd1: number;
  jd2: number;
}

/** What a form holds: a pair for `parts`, one double for the others. */
export type Reading = number | JdParts;

/** The function that writes each form, and the one that reads it back. */
export const TO_FN = {
  parts: "toJulianDateParts",
  jd: "toJulianDate",
  mjd: "toModifiedJulianDate",
  j2000: "toJ2000Seconds",
} as const satisfies Record<Form, keyof DayCountLib>;

export const FROM_FN = {
  parts: "fromJulianDateParts",
  jd: "fromJulianDate",
  mjd: "fromModifiedJulianDate",
  j2000: "fromJ2000Seconds",
} as const satisfies Record<Form, keyof DayCountLib>;

/** The last instant the library counts, from its JSDoc: the end of 9999 to the nanosecond. */
export const LAST_INSTANT = "9999-12-31T23:59:59.999999999Z";

/** A number as a reader would type it: the shortest text that reads back to the same double. */
export function numberText(n: number): string {
  return String(n);
}

/** Minus sign (U+2212), as the site writes a negative figure. */
const MINUS = "−";

/**
 * A span of nanoseconds in microseconds, three decimals, exact (a microsecond is a thousand
 * nanoseconds, so nothing rounds). The sign is always written; zero is `0 µs`.
 */
export function microsText(ns: bigint): string {
  if (ns === 0n) return "0 µs";
  const abs = ns < 0n ? -ns : ns;
  const whole = abs / 1000n;
  const frac = String(abs % 1000n).padStart(3, "0");
  return `${ns < 0n ? MINUS : "+"}${whole}.${frac} µs`;
}

/**
 * `back` minus `utc`, in nanoseconds, leap seconds counted. Both ends go through TAI, where
 * every day has the same length. Near the end of the range TAI runs past 9999 and the library
 * writes no label for it; the span of the two UTC labels plus the leap seconds between them is
 * the same figure (the `spanNs` JSDoc gives that recipe), so it stands in there.
 * `null` when the library can measure neither way.
 */
export function shiftNs(
  lib: Pick<DayCountLib, "toTAI" | "spanNs" | "leapSecondsBetween">,
  utc: string,
  back: string,
): bigint | null {
  const a = lib.toTAI(utc);
  const b = lib.toTAI(back);
  if (a !== "" && b !== "") return lib.spanNs(asUtc(a), asUtc(b));
  const span = lib.spanNs(utc, back);
  const leaps = lib.leapSecondsBetween(utc, back);
  if (span === null || leaps === null) return null;
  return span + BigInt(leaps) * 1_000_000_000n;
}

/** The result of writing a reading back to UTC. */
export interface RoundTrip {
  /** The `from` call, or `null` when there was nothing to read. */
  call: EdiCall | null;
  /** The UTC instant it gave, or `""`. */
  back: string;
  /** `back` minus the instant, or `null` where either end cannot be measured. */
  shift: bigint | null;
}

/** Reads `value` back with the form's `from` function, and measures it against `utc`. */
export function roundTrip(
  lib: DayCountLib,
  utc: string,
  form: Form,
  value: Reading | null,
  scale: Scale,
): RoundTrip {
  if (value === null) return { call: null, back: "", shift: null };
  const call = runCall(lib, FROM_FN[form], value, scale);
  const back = typeof call.result === "string" ? call.result : "";
  return {
    call,
    back,
    shift: back === "" ? null : shiftNs(lib, utc, back),
  };
}

/** One instant in one form: the call that wrote it, the value, and the way back. */
export interface Spelling extends RoundTrip {
  form: Form;
  /** The `to` call. */
  to: EdiCall;
  value: Reading | null;
}

/** Writes `utc` in `form` on `scale`, then reads it back. */
export function spell(
  lib: DayCountLib,
  utc: string,
  form: Form,
  scale: Scale,
): Spelling {
  const to = runCall(lib, TO_FN[form], utc, scale);
  const value = (to.result ?? null) as Reading | null;
  return { form, to, value, ...roundTrip(lib, utc, form, value, scale) };
}

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
const UNSIGNED = String.raw`(?:\d+\.?\d*|\.\d+)`;
const ONE = new RegExp(`^${NUMBER}$`);
const TWO = new RegExp(`^(${NUMBER})\\s*\\+\\s*(${UNSIGNED})$`);

/** One plain decimal, or `null`. `Number` reads a trimmed token that matches the pattern. */
export function parseNumber(text: string): number | null {
  const token = text.trim();
  if (!ONE.test(token)) return null;
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

/** `a + b` as two parts, or `null`. */
export function parseParts(text: string): JdParts | null {
  const hit = TWO.exec(text.trim());
  if (hit === null) return null;
  const jd1 = Number(hit[1]);
  const jd2 = Number(hit[2]);
  return Number.isFinite(jd1) && Number.isFinite(jd2) ? { jd1, jd2 } : null;
}

/** The two parts of a pair as the page writes them: `jd1 + jd2`. */
export function partsText(p: JdParts): string {
  return `${numberText(p.jd1)} + ${numberText(p.jd2)}`;
}
