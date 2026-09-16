/**
 * A jurisdiction's working week: which weekdays are weekend, which dates are holidays, and
 * which locality the answer is for.
 *
 * - `weekend` is ISO weekday numbers, 1 (Monday) through 7 (Sunday). It is explicit because
 *   Saturday–Sunday is not universal: much of the Middle East is Friday–Saturday (`[5, 6]`),
 *   and some markets keep a one-day weekend (`[7]`). `[]` means no weekly closure at all.
 *   Duplicates are ignored; all seven days being weekend leaves no business day and is invalid.
 * - `holidays` is ISO PlainDate strings (`"2024-07-04"`), never datetimes. Order does not
 *   matter and duplicates are ignored. GMT bundles no holiday table — holiday data is
 *   jurisdictional, changes annually and sometimes with days of notice, so the caller supplies
 *   it. Named exchange calendars live behind an opt-in `…/data` subpath.
 * - `timeZone` is an IANA identifier recording which locality the calendar describes. The
 *   business-day functions never read it: they take and return local dates, so the answer is
 *   the same whatever it says. It is what a caller holding an *instant* needs, to reduce that
 *   instant to a local date first — with `floorToZone` or `getZonedDateTimeFields` — before
 *   asking a business-day question.
 *
 * Narrow a candidate with `isValidBusinessCalendar`. Compose two jurisdictions' calendars with
 * `mergeCalendars`.
 */
export type BusinessCalendar = {
  weekend: number[];
  holidays: string[];
  timeZone: string;
};
