import { formatCalendarInstants } from "../../internal/formatCalendarDays";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { resolveUnixFormatReference } from "../../internal/unixFormatReference";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Options for `formatCalendarUnix`. Like `formatCalendar`, it takes a `reference` and a `timeStyle`
 * (here also `"full"`); it adds `epochUnit` and `timeZone` for the unix domain.
 *
 * @remarks Members:
 *
 * | Member | Type | Default | Description |
 * | --- | --- | --- | --- |
 * | `reference` | `string\|number` | now (UTC) | Anchor epoch/ISO for the "today/tomorrow" comparison. |
 * | `epochUnit` | `"milliseconds"\|"seconds"` | `"milliseconds"` | Interpretation of epoch `value`/`reference`; singular names are accepted. |
 * | `timeZone` | `string` | `"UTC"` | IANA zone for both day-comparison and clock-time rendering; `"local"` is the system zone; an unknown zone returns `""`. |
 * | `timeStyle` | `"short"\|"medium"\|"full"` | `"short"` | `Intl` `timeStyle` for the time-of-day portion. |
 *
 * @example
 * import { FormatCalendarUnixOptions } from "@northguild/gmt/unix";
 * const opts: FormatCalendarUnixOptions = { timeZone: "America/New_York" };
 */
export interface FormatCalendarUnixOptions {
  /** Anchor point for the relative day comparison. Accepts UTC ISO strings or epochs (a safe integer or a digit string). */
  reference?: string | number;
  epochUnit?: UnixUnit;
  /**
   * IANA timezone used for both the calendar-day comparison and the
   * rendered clock time. Omitted is `"UTC"`, `"local"` is the system zone,
   * and an unknown zone makes the result `""` (ECMA-402 throws RangeError).
   */
  timeZone?: string;
  /** `Intl.DateTimeFormatOptions` `timeStyle` for the time-of-day half. */
  timeStyle?: "short" | "medium" | "full";
}

/**
 * Format a unix epoch value as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the unix counterpart of `formatCalendar`. See
 * that function's JSDoc for the day-label/threshold/connector design; this
 * variant compares calendar days and renders the clock time in `timeZone`
 * (default `"UTC"`).
 *
 * - `value` and a numeric `reference` are safe integers or strings of optionally negative ASCII
 *   digits; anything else returns `""`.
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 * - An unknown `timeZone` returns `""`; `"local"` is the system zone.
 *
 * @param value unix epoch (string or number, per `epochUnit`) to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { epochUnit, reference, timeZone, timeStyle }
 * @returns the formatted calendar string, or "" on invalid input
 *
 * @example formatCalendarUnix(1710685845000, "en-US", { epochUnit: "milliseconds", timeZone: "America/New_York" }) // day label + time relative to "now", or the absolute fallback beyond the ±6-day threshold
 * @example formatCalendarUnix(1710772200000, "en-US", { reference: 1710685000000, timeZone: "UTC" }) // "tomorrow at 2:30 PM"
 * @example formatCalendarUnix("1710772200", "en-US", { reference: "1710685000", epochUnit: "second" }) // "tomorrow at 2:30 PM"
 * @example formatCalendarUnix(1710772200000, "en-US", { reference: 1710685000000, timeZone: "America/New_Yrok" }) // "" (unknown zone)
 * @example formatCalendarUnix(1710772200000, "en-US", null as never) // ""
 * @example formatCalendarUnix("not-a-number") // ""
 * @example formatCalendarUnix(1710613800000, ["fr-FR", "en-US"], { reference: 1710507600000 }) // "demain à 18:30"
 */
export function formatCalendarUnix(
  value: string | number,
  locale?: string | string[],
  options: FormatCalendarUnixOptions = {},
): string {
  // Temporal GetOptionsObject: undefined is defaults (the parameter default); anything else that is
  // not an object, including null, is a TypeError.
  if (options === null || typeof options !== "object") return "";
  const epochUnit = resolveUnixEpochUnit(options.epochUnit);
  if (epochUnit === null) return "";
  const timeZone = normalizeTimeZone(options.timeZone);
  if (!timeZone) return "";

  const target = unixEpochToInstant(value, epochUnit);
  if (target === null) return "";

  const reference = resolveUnixFormatReference(options.reference, epochUnit);
  if (reference === null) return "";

  try {
    return formatCalendarInstants(
      target,
      reference,
      timeZone,
      locale,
      options.timeStyle ?? "short",
    );
  } catch {
    return "";
  }
}
