/**
 * The anchor a calendar-unit duration operation is measured from, as Temporal's `relativeTo`
 * option takes it (`Duration.prototype.round`, `Duration.prototype.total`, `Duration.compare`).
 *
 * Years, months and weeks have no fixed length, so any operation touching them needs a starting
 * point; an operation on days and time units alone does not. It is an ISO 8601 string: a date or
 * date-time, or a zoned date-time with its time zone annotation. An object or a property bag is not
 * accepted, and the call returns its sentinel: Temporal would clamp the invalid date
 * `{ year: 2024, month: 2, day: 30 }` to 29 February, where the string `"2024-02-30"` is refused.
 *
 * A `Z` string, such as `getUtcNow()` returns, is refused and the call returns `null`. To start from
 * now, pass `getZonedNow("UTC")`.
 */
export type DurationRelativeTo = string;
