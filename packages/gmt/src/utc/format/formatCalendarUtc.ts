// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { formatCalendarInstants } from "../../internal/formatCalendarDays";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  toInstantFromUtc,
  toReferenceInstantFromUtc,
} from "../../internal/toInstantFromUtc";
import type { CalendarOptions } from "../../types";
import { isValidUtc } from "../validate";

export interface FormatCalendarUtcOptions extends CalendarOptions {
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
 * Format a UTC ISO string as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the UTC counterpart of `formatCalendar`. See that
 * function's JSDoc for the day-label/threshold/connector design; this
 * variant compares calendar days and renders the clock time in `timeZone`
 * (default `"UTC"`).
 *
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { reference, timeZone (default "UTC"; "local" is the system zone; an unknown zone returns ""), timeStyle }
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
  // Temporal GetOptionsObject: undefined is defaults (the parameter default); anything else that is
  // not an object, including null, is a TypeError.
  if (options === null || typeof options !== "object") return "";
  if (!isValidUtc(value)) return "";
  // ECMA-402 throws RangeError for an unknown zone: the sentinel, never a silent UTC.
  const timeZone = normalizeTimeZone(options.timeZone);
  if (!timeZone) return "";
  if (options.reference !== undefined && !isValidUtc(options.reference))
    return "";

  const target = toInstantFromUtc(value);
  if (target === null) return "";

  const reference = toReferenceInstantFromUtc(options.reference);
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
