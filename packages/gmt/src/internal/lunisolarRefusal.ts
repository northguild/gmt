import { isLunisolarTextCompatNeeded } from "./temporalCompat/capabilities";
import { printsDateField } from "./printsDateField";

/**
 * Refuse a formatter that would print a wrong Chinese or Dangi date (compat D33). Intl
 * era/monthCode section 1.1 Table 1 bases `chinese` on Purple Mountain Observatory data and
 * `dangi` on KASI data; GMT owns no calendar data, so a runtime that prints a different date
 * gets the function's own sentinel. Throws RangeError when all three hold: `resolvedOptions().calendar`
 * is chinese or dangi, the resolved options carry `dateStyle`, `era`, `year`, `month` or `day` (or its
 * parts hold a year, `relatedYear`, `yearName`, month, day or era), and the runtime's probe for that
 * calendar fails (`isLunisolarTextCompatNeeded`). A time-only or weekday-only formatter is returned: the
 * weekday and the time of day carry no calendar-specific date, so the refusal leaves them alone. A
 * runtime that passes the probe keeps its own text.
 *
 * @param formatter a date formatter built from the caller's locale and options
 * @returns the same formatter, when it prints no wrong Chinese or Dangi date
 * @throws RangeError when it would print one
 *
 * @example refuseLunisolarDate(new Intl.DateTimeFormat("en-u-ca-chinese")) // throws RangeError where the probe fails
 * @example refuseLunisolarDate(new Intl.DateTimeFormat("zh-u-ca-chinese", { hour: "numeric" })) // returns it
 */
export function refuseLunisolarDate(
  formatter: Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  let resolved: Intl.ResolvedDateTimeFormatOptions;
  try {
    resolved = formatter.resolvedOptions();
  } catch {
    // A formatter that cannot report its options adds no new failure path.
    return formatter;
  }
  const calendar = resolved.calendar;
  if (
    (calendar === "chinese" || calendar === "dangi") &&
    printsDateField(formatter, resolved) &&
    isLunisolarTextCompatNeeded(calendar)
  ) {
    throw new RangeError(
      `The ${calendar} calendar prints a different date on this runtime than Intl era/monthCode gives`,
    );
  }
  return formatter;
}
