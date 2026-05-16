import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidDateTime } from "../validate";

// Intl.RelativeTimeFormatUnit includes "quarter" which Temporal doesn't support.
type RelativeUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";

export interface FormatRelativeDateTimeOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  reference?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: 86_400 },
  { unit: "day", maxSeconds: Infinity },
];

export function formatRelativeDateTime(
  value: string,
  locale?: string,
  options: FormatRelativeDateTimeOptions = {},
): string {
  if (!isValidDateTime(value)) return "";
  if (options.reference !== undefined && !isValidDateTime(options.reference))
    return "";

  try {
    const target = Temporal.PlainDateTime.from(value);
    const reference = options.reference
      ? Temporal.PlainDateTime.from(options.reference)
      : Temporal.Now.plainDateTimeISO();

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
      // month/year are calendrical — relativeTo needs a PlainDate
      amount = Math.round(
        diff.total({ unit, relativeTo: reference.toPlainDate() }),
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
