import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarSystem } from "../types";
import { formatCalendarDate } from "./calendarDateString";
import {
  formatEthiopicFamilyDate,
  isEthiopicFamilyCalendar,
} from "./ethiopicFamilyCalendar";

/**
 * Format a Temporal.PlainDate as a GMT calendar-annotated (or bare ISO) string in a known
 * target CalendarSystem — companion to `calendarSystemOfDateValue`.
 *
 * The calendar must always be known up front and passed in explicitly, never re-derived from
 * `date.calendarId` alone: the Ethiopic family ("ethiopic" / "ethiopic-amete-alem" / "coptic")
 * is backed by Temporal's single, ambiguous "ethioaa" id, which cannot tell the three variants
 * apart from the PlainDate object alone (see `ethiopicFamilyCalendar.ts`).
 *
 * Within a known target calendar, though, the *fields* (year, era, month, day) are always
 * re-derived from the actual resulting `date`, never copied from an input string's tag —
 * `formatCalendarDate`/`formatEthiopicFamilyDate` both already do this per-call, which is
 * required because calendar-unit arithmetic can cross a leap-month or era boundary (Hebrew
 * Adar I -> Adar, Japanese Heisei -> Reiwa): a copied tag would describe a date that no longer
 * exists (E5 decision of record D7).
 *
 * @param date Temporal.PlainDate to format, already calendared as `calendar` expects
 *   (`"ethioaa"` for any Ethiopic-family member, its own Temporal calendar id otherwise)
 * @param calendar the CalendarSystem `date` is known to represent
 * @returns GMT's calendar-annotated (or bare ISO, for "gregorian") PlainDate string
 */
export function formatDateInCalendar(
  date: Temporal.PlainDate,
  calendar: CalendarSystem,
): string {
  if (isEthiopicFamilyCalendar(calendar)) {
    return formatEthiopicFamilyDate(date, calendar);
  }
  return formatCalendarDate(date);
}
