/**
 * The list on /migrate/temporal/: a Temporal call, the GMT function that matches it, and the
 * clause of the proposal it follows.
 *
 * `gmt` holds function names only; the page looks each one up in the reference corpus for its
 * module, link and first example, and fails the build when a name is not exactly one function.
 * `gmtCode` replaces that example for a call the corpus has no page for.
 */
import type { Clause } from "./behaviour-matrix";

export interface TemporalRow {
  task: string;
  /** The Temporal code, one call per line. A line starting `//` is a comment. */
  temporal: string;
  /** GMT function names. */
  gmt: readonly string[];
  /** Code for the GMT side, when the function has no reference page to take an example from. */
  gmtCode?: string;
  /** Text with `backtick` spans under the pair: how the GMT side differs from the Temporal call. */
  note?: string;
  clauses: readonly Clause[];
}

const spec = (label: string, id: string): Clause => ({
  label,
  url: `https://tc39.es/proposal-temporal/#${id}`,
});

export const temporalMap: readonly TemporalRow[] = [
  {
    task: "Today in a zone",
    temporal: "Temporal.Now.plainDateISO(z).toString()",
    gmt: ["getZonedToday"],
    clauses: [spec("2.2.5", "sec-temporal.now.plaindateiso")],
  },
  {
    task: "Now in a zone",
    temporal: "Temporal.Now.zonedDateTimeISO(z).toString()",
    gmt: ["getZonedNow"],
    clauses: [spec("2.2.4", "sec-temporal.now.zoneddatetimeiso")],
  },
  {
    task: "Now as UTC",
    temporal: "Temporal.Now.instant().toString()",
    gmt: ["getUtcNow"],
    clauses: [spec("2.2.2", "sec-temporal.now.instant")],
  },
  {
    task: "Add a month",
    temporal: "PlainDate.from(s).add({ months: 1 }).toString()",
    gmt: ["addDate"],
    clauses: [
      spec("3.3.21", "sec-temporal.plaindate.prototype.add"),
      spec("3.5.7", "sec-temporal-regulateisodate"),
    ],
  },
  {
    task: "Add a calendar day in a zone",
    temporal: "ZonedDateTime.from(s).add({ days: 1 })",
    gmt: ["addZoned"],
    clauses: [
      spec("6.3.35", "sec-temporal.zoneddatetime.prototype.add"),
      spec("6.5.5", "sec-temporal-addzoneddatetime"),
    ],
  },
  {
    task: "Difference",
    temporal: 'a.until(b, { largestUnit: "months" })',
    gmt: ["diffDate"],
    clauses: [
      spec("3.3.25", "sec-temporal.plaindate.prototype.until"),
      spec("12.3.9", "sec-temporal-calendardateuntil"),
    ],
  },
  {
    task: "Start of day",
    temporal: "zdt.startOfDay()",
    gmt: ["startOfZoned"],
    clauses: [
      spec("6.3.45", "sec-temporal.zoneddatetime.prototype.startofday"),
      spec("11.1.14", "sec-temporal-getstartofday"),
    ],
  },
  {
    task: "Hours in a day",
    temporal: "zdt.hoursInDay",
    gmt: ["getHoursInZonedDay"],
    clauses: [
      spec("6.3.23", "sec-get-temporal.zoneddatetime.prototype.hoursinday"),
    ],
  },
  {
    task: "Change zone",
    temporal: "zdt.withTimeZone(z)",
    gmt: ["convertZonedToZoned"],
    clauses: [
      spec("6.3.33", "sec-temporal.zoneddatetime.prototype.withtimezone"),
    ],
  },
  {
    task: "UTC to zone",
    temporal: "Instant.from(u).toZonedDateTimeISO(z)",
    gmt: ["convertUtcToZoned"],
    clauses: [
      spec("8.3.15", "sec-temporal.instant.prototype.tozoneddatetimeiso"),
    ],
  },
  {
    task: "Wall time to zone",
    temporal: "PlainDateTime.from(l).toZonedDateTime(z, { disambiguation })",
    gmt: ["convertPlainDateTimeToZoned"],
    clauses: [
      spec("5.3.38", "sec-temporal.plaindatetime.prototype.tozoneddatetime"),
      spec("11.1.11", "sec-temporal-getepochnanosecondsfor"),
    ],
  },
  {
    task: "Does the wall time exist",
    temporal:
      "// No public method. The specification counts the\n// candidate instants.",
    gmt: ["classifyLocal"],
    clauses: [spec("11.1.13", "sec-temporal-getpossibleepochnanoseconds")],
  },
  {
    task: "Next transition",
    temporal: 'zdt.getTimeZoneTransition("next")',
    gmt: ["getDstTransitions"],
    note: "Temporal returns the one transition after `zdt`. `getDstTransitions` returns every offset change in a year, as an array, so take the first one after your instant, and look in the next year when none is left.",
    clauses: [
      spec(
        "6.3.46",
        "sec-temporal.zoneddatetime.prototype.gettimezonetransition",
      ),
    ],
  },
  {
    task: "Round",
    temporal: 'zdt.round({ smallestUnit: "hour" })',
    gmt: ["roundZoned"],
    clauses: [spec("6.3.39", "sec-temporal.zoneddatetime.prototype.round")],
  },
  {
    task: "Equal values",
    temporal: "a.equals(b)",
    gmt: ["areZonedEqual"],
    clauses: [spec("6.3.40", "sec-temporal.zoneddatetime.prototype.equals")],
  },
  {
    task: "ISO week",
    temporal: "d.yearOfWeek\nd.weekOfYear\nd.dayOfWeek",
    gmt: ["getIsoWeekDate"],
    clauses: [
      spec("3.3.12", "sec-get-temporal.plaindate.prototype.weekofyear"),
      spec("3.3.13", "sec-get-temporal.plaindate.prototype.yearofweek"),
      spec("12.3.18", "sec-temporal-isoweekofyear"),
    ],
  },
  {
    task: "Change calendar",
    temporal: 'd.withCalendar("japanese")',
    gmt: ["convertDateToCalendar"],
    clauses: [spec("3.3.24", "sec-temporal.plaindate.prototype.withcalendar")],
  },
  {
    task: "A year and a month",
    temporal: "PlainYearMonth.from(s).toString()",
    gmt: ["parseYearMonth", "isValidYearMonth"],
    note: 'Temporal also reads a full date such as `2026-10-01` and keeps its year and month. `parseYearMonth` takes a year and month only and returns `""` for a full date.',
    clauses: [spec("9.2.2", "sec-temporal.plainyearmonth.from")],
  },
  {
    task: "A month and a day",
    temporal: "PlainMonthDay.from(s).toString()",
    gmt: ["parseMonthDay", "isValidMonthDay"],
    note: '`parseMonthDay` writes the ISO 8601 form `--12-25`, where Temporal writes `12-25`. Temporal also reads a full date such as `2026-12-25` and keeps its month and day; `parseMonthDay` returns `""` for one.',
    clauses: [spec("10.2.2", "sec-temporal.plainmonthday.from")],
  },
  {
    task: "A month-day in a year",
    temporal: "md.toPlainDate({ year })",
    gmt: ["monthDayToDate"],
    clauses: [
      spec("10.3.12", "sec-temporal.plainmonthday.prototype.toplaindate"),
    ],
  },
  {
    task: "Duration total",
    temporal: "Duration.from(s).total({ unit, relativeTo })",
    gmt: ["totalDuration"],
    clauses: [spec("7.3.21", "sec-temporal.duration.prototype.total")],
  },
  {
    task: "A `Date` object",
    temporal: "date.toTemporalInstant()",
    gmt: [],
    gmtCode: [
      'import { toTemporalInstant } from "@northguild/gmt";',
      "",
      "// date: a Date set to the epoch",
      "toTemporalInstant.call(date).toString();",
      '// → "1970-01-01T00:00:00Z"',
    ].join("\n"),
    clauses: [spec("14.9.1", "sec-date.prototype.totemporalinstant")],
  },
];
