import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidTime } from "../validate";

// PlainTime has no date component so only sub-day units are meaningful.
type RelativeUnit = "hour" | "minute" | "second";

export interface FormatRelativeTimeOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  reference?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: Infinity },
];

export function formatRelativeTime(
  value: string,
  locale?: string,
  options: FormatRelativeTimeOptions = {},
): string {
  if (!isValidTime(value)) return "";
  if (options.reference !== undefined && !isValidTime(options.reference))
    return "";

  try {
    const target = Temporal.PlainTime.from(value);
    const reference = options.reference
      ? Temporal.PlainTime.from(options.reference)
      : Temporal.Now.plainTimeISO();

    const diff = target.since(reference);
    const absSeconds = Math.abs(diff.total("second"));

    const unit =
      options.largestUnit ??
      AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ??
      "hour";

    const amount = Math.round(diff.total(unit));

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
