/*
 * The options that choose a date formatter's pattern, and the key a per-pattern verdict is kept
 * under (CORE-112, D24 and D29): shared so the two verdicts agree on what one pattern is.
 */

/** The options that make a formatter print time. */
export const TIME_KEYS = [
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dayPeriod",
  "timeZoneName",
  "timeStyle",
] as const;

/** The options that give a formatter a date pattern. */
export const DATE_KEYS = [
  "era",
  "year",
  "month",
  "day",
  "weekday",
  "dateStyle",
] as const;

/**
 * The verdict-cache key: the pattern, never the zone (a zone moves the instant, not the pattern).
 * Only the options that choose the pattern are read; locale, calendar, numbering system and hour
 * cycle come from what the formatter resolved, so a value `Intl` ignores or resolves to the same
 * thing (`calendar: "always"`, `hour12` next to an `hourCycle`) shares one verdict.
 */
export function verdictKey(
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): string {
  return JSON.stringify([
    resolved.locale,
    resolved.calendar,
    resolved.numberingSystem,
    resolved.hourCycle ?? "",
    options.formatMatcher ?? "",
    [...DATE_KEYS, ...TIME_KEYS].map((key) => options[key] ?? ""),
  ]);
}
