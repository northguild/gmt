/**
 * The one-line summary of a reference namespace: the line in `llms.txt` and the `description` of
 * the namespace's reference index page.
 *
 * Every namespace has a summary authored here, one sentence that says what its functions do and
 * what kind of string they work on. An industry's namespace has its own line, worded differently
 * from the industry's definition on its page (`src/data/industries.json`), because two pages that
 * share a meta description look like duplicates to a search engine. A namespace without a line has
 * no summary and `namespaceSummary` throws, so the build stops; nothing stands in for it.
 */

/** The `description` of the types section's reference index page (`reference/types/index.mdx`). */
export const TYPES_DESCRIPTION = "The public types of @northguild/gmt.";

/** The authored summary of every namespace. */
export const NAMESPACE_SUMMARIES: Readonly<Record<string, string>> = {
  types: TYPES_DESCRIPTION,
  calendar:
    "Business days, holidays, fiscal periods and opening hours, worked out from ISO 8601 date and instant strings.",
  duration:
    "Add, compare, total, parse and format ISO 8601 duration strings such as P1DT2H, and read human wording like 2h 30m.",
  instant:
    "Instants as ISO 8601 strings with a UTC offset: split and join instant and offset, and resolve local times to instants.",
  interval:
    "Half-open intervals of ISO 8601 instants: merge, clamp, split, subtract, sum and test them for overlap.",
  plain:
    "Dates, times and date-times with no time zone, as ISO 8601 strings: arithmetic, comparison, formatting, parsing and calendars.",
  precision:
    "Nanosecond instants and the timestamps other systems store: NTP, Arrow, Excel and .NET ticks, plus UUID, ULID and KSUID time.",
  recurrence:
    "Recurrence rules and five-field cron schedules, parsed and expanded into their occurrences inside a window, in a time zone.",
  regex:
    "Regular expressions for the string shapes GMT reads: ISO 8601 dates, times and offsets, RFC 3339, RFC 2822 and HTTP dates.",
  span: "The exact or wall-clock distance between two ISO 8601 strings, in milliseconds, nanoseconds or seconds.",
  timescale:
    "Leap seconds and the TAI to UTC offset: convert UTC instant strings to and from TAI and find the next leap second.",
  unix: "Unix timestamps in seconds or milliseconds, as strings: arithmetic, comparison, formatting, parsing and conversion.",
  utc: "UTC date-times and HTTP dates as ISO 8601 strings: arithmetic, comparison, formatting, parsing and conversion.",
  zoned:
    "Date-times in an IANA time zone as ISO 8601 strings: daylight saving, offsets, arithmetic, comparison, formatting and parsing.",
  workforce:
    "Functions that check duty logs against hours-of-work limits: total duty, find rests and the longest run, and report violations.",
  transport:
    "Functions for legs and schedules: dwell and transit time, cut-off times, departures, punctuality and delivery estimates.",
  intermodal:
    "Functions for container free time, demurrage and billing, plus parsers and formatters for EDIFACT, X12 and EPCIS date-times.",
  gnss: "Functions that convert between UTC and the satellite navigation system times, GNSS week numbers and RINEX weeks.",
  finance:
    "Functions that read, write and check the timestamps of financial messages, starting with the FIX UTCTimestamp.",
  healthcare:
    "Functions that read, write and check HL7 version 2 and FHIR R4 date-times, keeping the precision sent.",
  aviation:
    "Functions that read, write and check the dates of aviation messages, starting with the SSIM date DDMMMYY.",
};

/**
 * The one-line summary of a namespace.
 *
 * @throws When the namespace has no line in `NAMESPACE_SUMMARIES`.
 */
export function namespaceSummary(namespace: string): string {
  const summary = NAMESPACE_SUMMARIES[namespace];
  if (summary === undefined) {
    throw new Error(
      `namespace "${namespace}" has no summary: add one to NAMESPACE_SUMMARIES in src/lib/namespace-summary.ts`,
    );
  }
  return summary;
}
