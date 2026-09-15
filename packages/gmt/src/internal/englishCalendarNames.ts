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
