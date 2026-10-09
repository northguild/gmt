// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { formatCalendarInstants } from "../../internal/formatCalendarDays";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  toInstantFromUtc,
  toReferenceInstantFromUtc,
} from "../../internal/toInstantFromUtc";
import type { CalendarOptions } from "../../types";
import { isValidUtc } from "../validate";
import { optionOrDefault } from "../../internal/optionOrDefault";
import { isObject } from "../../internal/isObject";

/**
 * Options for `formatCalendarUtc`: the instant the day label is measured from, the time zone the
 * days and the clock time are read in, and the width of the time-of-day half.
 */
export interface FormatCalendarUtcOptions extends CalendarOptions {
  /**
   * The time zone used for both the calendar-day comparison and the rendered clock time: an IANA
   * name, a UTC offset to the minute (what `isValidTimeZone` accepts), or `"local"` for the system
   * time zone. An unknown zone returns `""`, as ECMA-402 throws RangeError for it.
   *
   * @defaultValue `"UTC"`
   */
  timeZone?: string;
  /**
   * The length of the time-of-day part, as the `timeStyle` of `Intl.DateTimeFormat`. `"short"`
   * writes hours and minutes, `"medium"` adds seconds, `"long"` adds the short time zone name
   * ("EDT") and `"full"` the long one ("Eastern Daylight Time"). Any other value returns `""`.
   *
   * @defaultValue `"short"`
   */
  timeStyle?: "short" | "medium" | "long" | "full";
}

/**
 * Format a UTC ISO string as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the UTC counterpart of `formatCalendar`. See that
 * function's JSDoc for the day-label/threshold/connector design; this
 * variant compares calendar days and renders the clock time in `timeZone`.
 *
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 * - An offset with seconds (`-00:44:30`) returns `""`. `Intl.DateTimeFormat` takes a time zone
 *   identifier only: constructing one with an offset that has seconds throws (ECMA-402, the
 *   `DateTimeFormat` construction step "If parseResult contains more than one MinuteSecond Parse
 *   Node, throw a RangeError exception"). Pass the IANA name.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options The reference instant, the time zone and the time style
 * @returns the formatted calendar string, or "" on invalid input
 *
 * @example formatCalendarUtc("2026-03-16T18:30:00Z", "en-US", { timeZone: "America/New_York", reference: "2026-03-15T13:00:00Z" }) // "tomorrow at 2:30 PM"
 * @example formatCalendarUtc("2026-03-16T13:30:00Z", "fr-FR", { timeZone: "Europe/Paris", reference: "2026-03-15T12:00:00Z" }) // "demain à 14:30"
 * @example formatCalendarUtc("2026-03-16T18:30:00Z", "en-US", null as never) // ""
 * @example formatCalendarUtc("not-a-date") // ""
 * @example formatCalendarUtc("2024-03-16T18:30:00Z", ["fr-FR", "en-US"], { reference: "2024-03-15T13:00:00Z" }) // "demain à 18:30"
 */
export function formatCalendarUtc(
  value: string,
  locale?: string | string[],
  options: FormatCalendarUtcOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: undefined is defaults (the parameter default); anything else that is
    // not an object, including null, is a TypeError.
    if (!isObject(options)) return "";
    if (!isValidUtc(value)) return "";
    // ECMA-402 throws RangeError for an unknown zone: the sentinel, never a silent UTC.
    const timeZone = normalizeTimeZone(options.timeZone);
    if (!timeZone) return "";
    // Each option is read once (GetOption).
    const referenceOption = options.reference;
    if (referenceOption !== undefined && !isValidUtc(referenceOption))
      return "";

    const target = toInstantFromUtc(value);
    if (target === null) return "";

    const reference = toReferenceInstantFromUtc(referenceOption);
    if (reference === null) return "";

    try {
      return formatCalendarInstants(
        target,
        reference,
        timeZone,
        locale,
        optionOrDefault(options.timeStyle, "short"),
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
