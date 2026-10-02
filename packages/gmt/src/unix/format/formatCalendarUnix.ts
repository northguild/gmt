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
 * @example
 * import { FormatCalendarUnixOptions } from "@northguild/gmt/unix";
 * const opts: FormatCalendarUnixOptions = { timeZone: "America/New_York" };
 */
export interface FormatCalendarUnixOptions {
  /**
   * The instant the day label is measured from, as a UTC ISO string, or an epoch in `epochUnit`
   * given as a safe integer or a digit string. Any other value returns `""`.
   *
   * @defaultValue The current instant.
   */
  reference?: string | number;
  /**
   * The unit `value` and a numeric `reference` are counted in: `"seconds"` or `"milliseconds"`,
   * singular or plural. Any other value returns `""`.
   *
   * @defaultValue `"milliseconds"`
   */
  epochUnit?: UnixUnit;
  /**
   * The time zone used for both the calendar-day comparison and the rendered clock time: an IANA
   * name, a UTC offset, or `"local"` for the system time zone. An unknown zone returns `""`, as
   * ECMA-402 throws RangeError for it.
   *
   * @defaultValue `"UTC"`
   */
  timeZone?: string;
  /**
   * The length of the time-of-day part, as the `timeStyle` of `Intl.DateTimeFormat`. `"short"`
   * writes hours and minutes, `"medium"` adds seconds and `"full"` adds the time zone name.
   *
   * @defaultValue `"short"`
   */
  timeStyle?: "short" | "medium" | "full";
}

/**
 * Format a unix epoch value as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the unix counterpart of `formatCalendar`. See
 * that function's JSDoc for the day-label/threshold/connector design; this
 * variant compares calendar days and renders the clock time in `timeZone`.
 *
 * - `value` and a numeric `reference` are safe integers or strings of optionally negative ASCII
 *   digits; anything else returns `""`.
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 *
 * @param value unix epoch (string or number, per `epochUnit`) to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: the reference instant, how epochs are read, the zone and the width of the time
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
  try {
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
        options.timeStyle === undefined ? "short" : options.timeStyle,
      );
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
