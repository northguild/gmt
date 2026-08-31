import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { resolveRelativeRounding } from "../../internal/resolveRelativeRounding";
import type { RelativeRoundingMethod } from "../../types";
import { isValidUtc } from "../../utc/validate";

// Intl.RelativeTimeFormatUnit includes "quarter" which Temporal doesn't support.
type RelativeUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";

export interface FormatRelativeUnixOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  roundingMethod?: RelativeRoundingMethod;
  epochUnit?: "milliseconds" | "seconds";
  reference?: string | number;
  timeZone?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: 86_400 },
  { unit: "day", maxSeconds: Infinity },
];

function toInstant(
  raw: string | number,
  epochUnit: "milliseconds" | "seconds",
): Temporal.Instant | null {
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Mirror formatUnix.parseEpochMs: only accept integer-looking strings,
    // so "" / "not-a-date" / "12.5" don't silently coerce to 0/12.
    if (!/^-?\d+$/.test(trimmed)) return null;
    n = Number(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  try {
    const ms = epochUnit === "seconds" ? n * 1000 : n;
    return Temporal.Instant.fromEpochMilliseconds(ms);
  } catch {
    return null;
  }
}

/**
 * Format the relative time between a unix epoch value and a reference instant.
 *
 * - Auto-picks the display unit (second through year) based on the distance, unless
 *   `largestUnit` forces one.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 *
 * @param value unix epoch (string or number, per `epochUnit`) to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { style, numeric, largestUnit, roundingMethod, epochUnit, reference, timeZone }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds" }) // "3 years ago"
 * @example formatRelativeUnix(value, "en-US", { roundingMethod: "floor" }) // rounds toward the earlier boundary
 * @example formatRelativeUnix("not-a-number") // ""
 */
export function formatRelativeUnix(
  value: string | number,
  locale?: string,
  options: FormatRelativeUnixOptions = {},
): string {
  const epochUnit = options.epochUnit ?? "milliseconds";

  const target = toInstant(value, epochUnit);
  if (target === null) return "";

  let reference: Temporal.Instant;
  if (options.reference === undefined) {
    try {
      reference = Temporal.Now.instant();
    } catch {
      return "";
    }
  } else if (typeof options.reference === "string") {
    // String references can be a numeric unix epoch ("1709164800000") OR a
    // UTC ISO string ("2024-02-29T00:00:00Z"). Try the numeric path first to
    // match formatUnix's symmetry, then fall back to UTC.
    const numericRef = toInstant(options.reference, epochUnit);
    if (numericRef !== null) {
      reference = numericRef;
    } else if (isValidUtc(options.reference)) {
      try {
        reference = Temporal.Instant.from(options.reference);
      } catch {
        return "";
      }
    } else {
      return "";
    }
  } else {
    const ref = toInstant(options.reference, epochUnit);
    if (ref === null) return "";
    reference = ref;
  }

  try {
    const diff = target.since(reference);
    const absSeconds = Math.abs(diff.total("second"));

    const unit =
      options.largestUnit ??
      AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ??
      "day";

    let amount: number;
    try {
      amount = resolveRelativeRounding(
        diff.total(unit),
        options.roundingMethod,
      );
    } catch {
      // month/year are calendrical and need a relativeTo anchor.
      // Defer timezone normalization until we know we need it.
      const tz = normalizeTimeZone(options.timeZone);
      amount = resolveRelativeRounding(
        diff.total({ unit, relativeTo: reference.toZonedDateTimeISO(tz) }),
        options.roundingMethod,
      );
    }

    return normalizeDateTime(
      new Intl.RelativeTimeFormat(locale, {
        numeric: options.numeric ?? "auto",
        style: options.style ?? "long",
      }).format(amount, unit),
    );
  } catch {
    return "";
  }
}
