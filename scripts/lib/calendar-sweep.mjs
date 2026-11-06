/**
 * The calendar sweep (CORE-110): for every calendar both implementations support, and every
 * calendar year that overlaps ISO years -3000 to 5000, compare a candidate Temporal implementation
 * with a reference one on three facts. Those are the ISO date of the year's first day, the months in
 * the year and the days in the year.
 *
 * Pure functions, no I/O, no imports, never `Date`. The caller supplies both Temporal namespaces and
 * the calendar names, so this module never loads a polyfill. The span is fixed. It does not depend
 * on the run date, so two runs on different days read the same years.
 */

/** First day of the span, as an ISO 8601 extended-year date. */
export const SPAN_FROM = "-003000-01-01";
/** Last day of the span, as an ISO 8601 extended-year date. */
export const SPAN_THROUGH = "+005000-12-31";
/** Calendars listed in a result; `differingCalendars` still counts them all. */
const MAX_CALENDARS_LISTED = 50;

/**
 * @typedef {{ year: number, toString(): string }} SweepDate
 * @typedef {{ PlainDate: {
 *   from(item: string | { calendar: string, year: number, monthCode: string, day: number }): {
 *     year: number, monthsInYear: number, daysInYear: number,
 *     withCalendar(calendar: string): SweepDate } } }} TemporalLike  the part of a `Temporal`
 *   namespace the sweep reads
 * @typedef {{ calendar: string, years: number, first: number | null, example: string }} DifferingCalendar
 */

/**
 * The calendar years that overlap the span, read from the reference.
 *
 * @param {TemporalLike} reference
 * @param {string} calendar
 * @returns {{ first: number, last: number }}
 */
function yearRange(reference, calendar) {
  const start = reference.PlainDate.from(SPAN_FROM).withCalendar(calendar);
  const end = reference.PlainDate.from(SPAN_THROUGH).withCalendar(calendar);
  return {
    first: Math.min(start.year, end.year),
    last: Math.max(start.year, end.year),
  };
}

/**
 * What one implementation says about one calendar year: three facts as one line, or the error
 * class when it throws. Two lines are equal only when all three facts agree.
 *
 * @param {TemporalLike} temporal
 * @param {string} calendar
 * @param {number} year
 * @returns {{ ok: true, text: string } | { ok: false, text: string }}
 */
function readYear(temporal, calendar, year) {
  try {
    const first = temporal.PlainDate.from({
      calendar,
      year,
      monthCode: "M01",
      day: 1,
    });
    const iso = first.withCalendar("iso8601").toString();
    return {
      ok: true,
      text: `${iso}, ${first.monthsInYear} months, ${first.daysInYear} days`,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    return { ok: false, text: `throws ${name}` };
  }
}

/**
 * Whether the implementation builds a date in the calendar at all.
 *
 * @param {TemporalLike} temporal
 * @param {string} calendar
 */
function accepts(temporal, calendar) {
  try {
    temporal.PlainDate.from({ calendar, year: 2000, monthCode: "M01", day: 1 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compare the candidate with the reference, per calendar and year.
 *
 * A year where one side throws and the other does not is a difference. A year where both throw is
 * skipped. A calendar only one side accepts is a difference too, with `years: 0` and no first year.
 *
 * @param {{ candidate: TemporalLike, reference: TemporalLike, calendars: string[] }} input
 * @returns {{ status: "ran", from: string, through: string, calendars: number, years: number,
 *   differingCalendars: number, differing: DifferingCalendar[], differingTruncated: boolean }}
 */
export function sweepCalendars({ candidate, reference, calendars }) {
  if (calendars.length === 0)
    throw new Error('Intl.supportedValuesOf("calendar") returned no calendars');

  /** @type {DifferingCalendar[]} */
  const differing = [];
  let differingCalendars = 0;
  let compared = 0;
  let years = 0;

  for (const calendar of calendars) {
    const onCandidate = accepts(candidate, calendar);
    const onReference = accepts(reference, calendar);
    if (!onCandidate || !onReference) {
      if (onCandidate !== onReference) {
        differingCalendars++;
        if (differing.length < MAX_CALENDARS_LISTED) {
          differing.push({
            calendar,
            years: 0,
            first: null,
            example: onCandidate
              ? "only the candidate accepts this calendar"
              : "only the reference accepts this calendar",
          });
        }
      }
      continue;
    }

    compared++;
    const range = yearRange(reference, calendar);
    let count = 0;
    /** @type {DifferingCalendar | null} */
    let found = null;
    for (let year = range.first; year <= range.last; year++) {
      const c = readYear(candidate, calendar, year);
      const r = readYear(reference, calendar, year);
      if (!c.ok && !r.ok) continue;
      years++;
      if (c.text === r.text) continue;
      count++;
      found ??= {
        calendar,
        years: 0,
        first: year,
        example: `year ${year}: candidate ${c.text}; reference ${r.text}`,
      };
    }
    if (found) {
      differingCalendars++;
      if (differing.length < MAX_CALENDARS_LISTED) {
        differing.push({ ...found, years: count });
      }
    }
  }

  return {
    status: "ran",
    from: SPAN_FROM,
    through: SPAN_THROUGH,
    calendars: compared,
    years,
    differingCalendars,
    differing,
    differingTruncated: differingCalendars > MAX_CALENDARS_LISTED,
  };
}
