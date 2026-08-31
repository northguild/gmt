/**
 * RegExp matching GMT's own calendar-annotated PlainDate string: the calendar-native
 * year/month/day (e.g. Hebrew year 5785), tagged with the calendar identifier — not
 * Temporal's own `[u-ca=...]` annotation convention, which keeps the ISO/proleptic-
 * Gregorian digits and only tags the calendar. See `convertDateToCalendar` for the
 * rationale.
 *
 * The optional trailing `;era=<name>` captures an era identifier (e.g. "reiwa"), needed
 * only for the "japanese" calendar: unlike every other supported calendar, Temporal's
 * `.year` for "japanese" stays proleptic (does not reset at an era change), so the
 * era-relative year (Temporal's `.eraYear`) has to be paired with the era name to be
 * unambiguous. See `formatCalendarDate`/`parseCalendarDateValue` for how it round-trips.
 *
 * Capture groups: 1 year, 2 month, 3 day, 4 calendar id, 5 era (optional).
 *
 * @example calendarDate.test("5785-01-01[u-ca=hebrew]")              // true
 * @example calendarDate.test("5785-01-01[u-ca=japanese;era=reiwa]")  // true
 * @example calendarDate.test("2024-03-15")                           // false (no calendar tag)
 */
export const calendarDate: RegExp =
  /^(\d{4,6})-(\d{2})-(\d{2})\[u-ca=([a-z][a-z0-9-]*)(?:;era=([a-z]+))?\]$/;
