import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidDate } from "../validate";

// No "hour"/"minute"/"second" — PlainDate has no time component.
type RelativeUnit = "year" | "month" | "week" | "day";

export interface FormatRelativeDateOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  reference?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxDays: number }> = [
  { unit: "day", maxDays: 7 },
  { unit: "week", maxDays: 28 },
  { unit: "month", maxDays: 365 },
  { unit: "year", maxDays: Infinity },
];

export function formatRelativeDate(
  value: string,
  locale?: string,
  options: FormatRelativeDateOptions = {},
): string {
  if (!isValidDate(value)) return "";
  if (options.reference !== undefined && !isValidDate(options.reference))
    return "";

  try {
    const target = Temporal.PlainDate.from(value);
    const reference = options.reference
      ? Temporal.PlainDate.from(options.reference)
      : Temporal.Now.plainDateISO();

    const diff = target.since(reference);
    const absDays = Math.abs(diff.total("day"));

    const unit =
      options.largestUnit ??
      AUTO_UNITS.find((t) => absDays < t.maxDays)?.unit ??
      "year";

    let amount: number;
    try {
      amount = Math.round(diff.total(unit));
    } catch {
      // month/year are calendrical and need a relativeTo anchor
      amount = Math.round(diff.total({ unit, relativeTo: reference }));
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
