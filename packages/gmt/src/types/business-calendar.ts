/**
 * A jurisdiction's working week: which weekdays are weekend, which dates are holidays, and
 * which locality the answer is for.
 *
 * GMT bundles no holiday table — holiday data is jurisdictional, changes annually and sometimes
 * with days of notice, so the caller supplies it. No exchange or currency calendar ships either;
 * an opt-in data subpath for them is planned, not published.
 *
 * Narrow a candidate with `isValidBusinessCalendar`. Compose two jurisdictions' calendars with
 * `mergeCalendars`.
 */
export type BusinessCalendar = {
  /**
   * The ISO weekday numbers closed every week, 1 (Monday) through 7 (Sunday). It is explicit
   * because Saturday–Sunday is not universal: much of the Middle East is Friday–Saturday
   * (`[5, 6]`), and some markets keep a one-day weekend (`[7]`). `[]` means no weekly closure,
   * duplicates are ignored, and all seven days leave no business day and are invalid.
   */
  weekend: number[];
  /**
   * The dates closed in addition to the weekend, as ISO PlainDate strings (`"2024-07-04"`), never
   * datetimes. Order does not matter and duplicates are ignored.
   */
  holidays: string[];
  /**
   * The time zone recording which locality the calendar describes, an IANA name or a UTC offset. It
   * must be a valid zone, but the business-day functions never use it: they take and return local
   * dates, so the answer is the same whatever it says. A caller holding an instant uses it to
   * reduce that instant to a local date first, with `floorToZone` or `getZonedDateTimeFields`.
   */
  timeZone: string;
};
