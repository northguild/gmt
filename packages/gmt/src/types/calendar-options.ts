/**
 * Core fields shared by all calendar-formatting interfaces.
 * Each domain variant (plain, unix, utc, zoned) extends this and may
 * add domain-specific fields like `timeZone` or `epochUnit`.
 */
export interface CalendarOptions {
  /** Anchor point for the relative day comparison. */
  reference?: string;
  /** `Intl.DateTimeFormatOptions` `timeStyle` for the time-of-day half. */
  timeStyle?: "short" | "medium" | "full";
}
