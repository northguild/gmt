import { printsDateField } from "./printsDateField";

/**
 * The calendars whose dates GMT refuses to print (compat D33). Intl era/monthCode §1.1 Table 1
 * bases `chinese` on Purple Mountain Observatory data and `dangi` on KASI data; hosts print
 * different dates for them, and GMT owns no calendar data to settle it.
 */
export const LUNISOLAR_CALENDARS = ["chinese", "dangi"] as const;

/**
 * Refuse a formatter that would print a Chinese or Dangi date (compat D33), on every host and
 * with no probe. Throws RangeError when `resolvedOptions().calendar` is chinese or dangi and the
 * resolved options carry `dateStyle`, `era`, `year`, `month` or `day`, or its parts hold a year
 * (`relatedYear`, `yearName`), month, day or era. A time-only or
 * weekday-only formatter is returned: the seven-day week and the time of day are the same on
 * every host (ECMA-402 ToLocalTime).
 *
 * @param formatter a date formatter built from the caller's locale and options
 * @returns the same formatter, when it prints no Chinese or Dangi date field
 * @throws RangeError when it would print one
 *
 * @example refuseLunisolarDate(new Intl.DateTimeFormat("en-u-ca-chinese")) // throws RangeError
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
  if (
    (LUNISOLAR_CALENDARS as readonly string[]).includes(resolved.calendar) &&
    printsDateField(formatter, resolved)
  ) {
    throw new RangeError(
      `The ${resolved.calendar} calendar prints different dates on different hosts`,
    );
  }
  return formatter;
}
