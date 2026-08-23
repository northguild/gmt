// GMT's own calendar-annotated PlainDate string: the calendar-native year/month/day
// (e.g. Hebrew year 5785), tagged with the calendar identifier — not Temporal's own
// `[u-ca=...]` annotation convention, which keeps the ISO/proleptic-Gregorian digits and
// only tags the calendar. See convertDateToCalendar for the rationale.
export const calendarDate: RegExp =
  /^(\d{4,6})-(\d{2})-(\d{2})\[u-ca=([a-z][a-z0-9-]*)\]$/;
