import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { toInstantFromUtc } from "../../internal/toInstantFromUtc";
import { isValidUtc } from "../validate";

// Intl.RelativeTimeFormatUnit includes "quarter" which Temporal doesn't support.
type RelativeUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";

export interface FormatRelativeUtcOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  reference?: string;
  timeZone?: string;
}

const AUTO_UNITS: Array<{
  unit: RelativeUnit;
  maxSeconds: number;
}> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: 86_400 },
  { unit: "day", maxSeconds: Infinity },
];

export function formatRelativeUtc(
  value: string,
  locale?: string,
  options: FormatRelativeUtcOptions = {},
): string {
  if (!isValidUtc(value)) return "";
  if (options.reference !== undefined && !isValidUtc(options.reference))
    return "";

  const target = toInstantFromUtc(value);
  if (target === null) return "";

  let reference: Temporal.Instant;
  if (options.reference) {
    const ref = toInstantFromUtc(options.reference);
    if (ref === null) return "";
    reference = ref;
  } else {
    try {
      reference = Temporal.Now.instant();
    } catch {
      return "";
    }
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
      amount = Math.round(diff.total(unit));
    } catch {
      // month/year are calendrical and need a relativeTo anchor.
      // Defer timezone normalization until we know we need it.
      const tz = normalizeTimeZone(options.timeZone);
      amount = Math.round(
        diff.total({ unit, relativeTo: reference.toZonedDateTimeISO(tz) }),
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
