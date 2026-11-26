import { Temporal } from "./temporal";
import { systemTimeZone } from "./resolveLocale";

/**
 * Today's date in the host's time zone.
 *
 * @returns the date, or `null` when the host reports no time zone or the clock cannot be read
 *
 * @example todayDate()?.toString() // "2024-03-10"
 */
export function todayDate(): Temporal.PlainDate | null {
  const timeZone = systemTimeZone();
  if (timeZone === "") return null;
  try {
    return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
  } catch {
    return null;
  }
}
