/**
 * Core fields shared by all calendar-formatting interfaces.
 * Each domain variant (plain, unix, utc, zoned) extends this and may
 * add domain-specific fields like `timeZone` or `epochUnit`.
 */
export interface CalendarOptions {
  /**
   * The moment the day label is measured from, as an ISO string in the same form as the value
   * being formatted. A value on the same calendar day reads "today", one on the next day
   * "tomorrow".
   *
   * @defaultValue The current date and time.
   */
  reference?: string;
  /**
   * The length of the time-of-day part, as the `timeStyle` of `Intl.DateTimeFormat`. `"short"`
   * writes hours and minutes, `"medium"` adds seconds and `"full"` adds the time zone name.
   *
   * @defaultValue `"short"`
   */
  timeStyle?: "short" | "medium" | "full";
}
