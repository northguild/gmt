import type { Temporal } from "@js-temporal/polyfill";

// RFC 5322 §3.3 (which obsoletes RFC 2822) and RFC 9110 §5.6.7 (which obsoletes
// RFC 7231) mandate English weekday/month
// abbreviations regardless of the caller's locale — these are fixed,
// non-locale-adaptive grammars, not a display format, so hardcoding the
// English names here is not the i18n bug it would be in a formatter (see
// roadmap Decision 1 / J13's "Why this survives Decision 1").

// Index 0 = Monday, aligned with Temporal's 1-7 `dayOfWeek` via `[dayOfWeek - 1]`.
export const ENGLISH_WEEKDAY_NAMES = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

// Index 0 = January, aligned with Temporal's 1-12 `month` via `[month - 1]`.
export const ENGLISH_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * The `Mon, 15 Jul 2024 12:00:00` stem RFC 5322 date-time and RFC 9110 IMF-fixdate share: English
 * day and month names, zero-padded fields, read from the date-time's own wall clock.
 *
 * @param zdt the date-time; the caller has already rejected a year outside 0-9999
 * @returns the stem, without a zone or `GMT` suffix
 * @example englishDateTimeStem(Temporal.ZonedDateTime.from("2024-07-15T12:00:05+00:00[UTC]")) // "Mon, 15 Jul 2024 12:00:05"
 * @example englishDateTimeStem(Temporal.ZonedDateTime.from("0099-01-03T04:05:06+00:00[UTC]")) // "Sat, 03 Jan 0099 04:05:06"
 */
export function englishDateTimeStem(zdt: Temporal.ZonedDateTime): string {
  const weekday = ENGLISH_WEEKDAY_NAMES[zdt.dayOfWeek - 1];
  const day = String(zdt.day).padStart(2, "0");
  const month = ENGLISH_MONTH_NAMES[zdt.month - 1];
  const year = String(zdt.year).padStart(4, "0");
  const hour = String(zdt.hour).padStart(2, "0");
  const minute = String(zdt.minute).padStart(2, "0");
  const second = String(zdt.second).padStart(2, "0");
  return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second}`;
}
