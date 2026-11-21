/** The resolved options that make a formatter print a date field. */
const DATE_FIELDS = ["dateStyle", "era", "year", "month", "day"] as const;

/**
 * The part types of a date field. A chinese or dangi `year` prints `relatedYear` and `yearName`,
 * and V8 leaves `year` out of `resolvedOptions` for it, so the parts are read too.
 */
const DATE_PART_TYPES: ReadonlySet<string> = new Set([
  "era",
  "year",
  "relatedYear",
  "yearName",
  "month",
  "day",
]);

/** Whether the formatter's parts for one instant hold a year, month, day or era. */
function printsDatePart(formatter: Intl.DateTimeFormat): boolean {
  try {
    return formatter
      .formatToParts(0)
      .some(({ type }) => DATE_PART_TYPES.has(type));
  } catch {
    // A formatter that cannot format adds no new failure path.
    return false;
  }
}

/**
 * Whether a formatter prints a year, month, day or era: its resolved options carry `dateStyle`,
 * `era`, `year`, `month` or `day`, or its parts for one instant hold one of them (`relatedYear`
 * and `yearName` count as a year). A time-only or weekday-only formatter prints none: the time of
 * day and the seven-day week do not depend on the calendar (ECMA-402 ToLocalTime).
 *
 * @param formatter the formatter
 * @param resolved its `resolvedOptions()`
 * @returns `true` when it prints a date field
 *
 * @example printsDateField(new Intl.DateTimeFormat("en"), new Intl.DateTimeFormat("en").resolvedOptions()) // true
 * @example printsDateField(new Intl.DateTimeFormat("en", { weekday: "long" }), new Intl.DateTimeFormat("en", { weekday: "long" }).resolvedOptions()) // false
 */
export function printsDateField(
  formatter: Intl.DateTimeFormat,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): boolean {
  return (
    DATE_FIELDS.some((name) => resolved[name] !== undefined) ||
    printsDatePart(formatter)
  );
}
