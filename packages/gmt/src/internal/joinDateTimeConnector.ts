// `Intl.DateTimeFormat`'s part types that belong to the *date* half of a
// combined `dateStyle` + `timeStyle` format. Everything else (`hour`,
// `minute`, `second`, `fractionalSecond`, `dayPeriod`, `timeZoneName`, and
// `literal`) belongs to the time half or is punctuation between fields.
const DATE_PART_TYPES = new Set<string>([
  "era",
  "year",
  "relatedYear",
  "yearName",
  "month",
  "day",
  "weekday",
]);

/**
 * Join a relative day label (e.g. "Tomorrow") with the localized time-of-day
 * for the same instant, using the locale's *own* connector word/punctuation
 * instead of a hardcoded one (e.g. English "at").
 *
 * - Formats `epochMilliseconds` with `dateStyle: "full"` + `timeStyle` to get
 *   CLDR's locale-correct date/time part sequence and its connector, then
 *   discards every date-labeled part (weekday/era/year/month/day) in favor of
 *   `dayLabel` — keeping only the connector and the time-side parts.
 * - The connector is whatever literal part immediately follows the last
 *   date-labeled part — a space for locales with none (e.g. tr-TR), a word
 *   for others (" at " / " um " / " à " / "في " / …). This works for every
 *   locale because it reads CLDR's own combined-pattern output rather than
 *   assuming a fixed word or position.
 * - This is why the day/time split cannot be done by formatting the date and
 *   time halves separately and concatenating with a hardcoded joiner: the
 *   joiner itself, and even the ordering of the day-period relative to the
 *   hour (see ko-KR/zh-TW, where "PM" precedes the hour), are locale-specific
 *   and only `Intl` knows them.
 * - One further wrinkle: some locales' date pattern has its own trailing
 *   literal glued onto the last date field, unrelated to the date/time
 *   connector — ru-RU renders a bare date as "15 марта 2024 г." (a genitive
 *   "year" marker suffixed to the year number with no separating space), so
 *   the combined format's literal after "2024" is " г. в " (suffix + real
 *   connector, fused into one part). A second `dateStyle`-only format call
 *   below detects and strips that date-side suffix before treating the rest
 *   of the literal as the connector — otherwise "г." would leak into
 *   "tomorrow г. at 2:30", nonsensical since it isn't attached to a year here.
 *
 * @param epochMilliseconds instant to format, in milliseconds since the Unix epoch
 * @param timeZone IANA timezone identifier (or "UTC" for plain values with no real zone)
 * @param locale optional BCP 47 locale tag
 * @param dayLabel the word/phrase replacing the date half (e.g. "Tomorrow", "Friday")
 * @param timeStyle Intl.DateTimeFormatOptions `timeStyle` for the time half
 * @returns `dayLabel` joined to the localized time with the locale's own connector
 */
export function joinDateTimeConnector(
  epochMilliseconds: number,
  timeZone: string,
  locale: string | undefined,
  dayLabel: string,
  timeStyle: "short" | "medium" | "full",
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle,
    timeZone,
  }).formatToParts(epochMilliseconds);

  let lastDateIdx = -1;
  parts.forEach((part, i) => {
    if (DATE_PART_TYPES.has(part.type)) lastDateIdx = i;
  });

  // Detect a date-side trailing literal (e.g. ru-RU's " г.") that a
  // dateStyle-only format would still produce with no time present — it
  // belongs to the date field, not the connector, even though the combined
  // format fuses it into the same literal token as the real connector.
  const dateOnlyParts = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone,
  }).formatToParts(epochMilliseconds);
  const dateOnlyLast = dateOnlyParts[dateOnlyParts.length - 1];
  const dateSuffix = dateOnlyLast?.type === "literal" ? dateOnlyLast.value : "";

  let cursor = lastDateIdx + 1;
  let connector = " ";
  if (parts[cursor]?.type === "literal") {
    connector = parts[cursor].value;
    if (dateSuffix.length > 0 && connector.startsWith(dateSuffix)) {
      connector = connector.slice(dateSuffix.length);
    }
    cursor += 1;
  }

  const timePortion = parts
    .slice(cursor)
    .map((part) => part.value)
    .join("");

  return `${dayLabel}${connector}${timePortion}`;
}
