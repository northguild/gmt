import { Temporal } from "@js-temporal/polyfill";
import { calendarFieldsOf, hasReadCorrection } from "./calendarFields";
import { isDefectPresent } from "./capabilities";
import { type FieldKey, isoForFields } from "./fieldSearch";

export type CalendarDateFields =
  | FieldKey
  | { era: string; eraYear: number; month: number; day: number };

interface EdgeYears {
  min: number | undefined;
  max: number | undefined;
}

/** Era codes polyfill 0.5.1 accepts that the Intl era/monthCode proposal does not (D8). */
const PRE_PROPOSAL_ERAS: ReadonlySet<string> = new Set(["japanese-inverse"]);

const edgeYearsCache = new Map<string, EdgeYears>();

function readYear(iso: string, calendarId: string): number | undefined {
  try {
    return calendarFieldsOf(Temporal.PlainDate.from(iso), calendarId).year;
  } catch {
    return undefined;
  }
}

/** The calendar years of the TC39 PlainDate limits in `calendarId`. */
function edgeYears(calendarId: string): EdgeYears {
  let years = edgeYearsCache.get(calendarId);
  if (years === undefined) {
    years = {
      min: readYear("-271821-04-19", calendarId),
      max: readYear("+275760-09-13", calendarId),
    };
    edgeYearsCache.set(calendarId, years);
  }
  return years;
}

/**
 * D1 per-call guard: the polyfill's fields → ISO bisection overshoots only within about a year of
 * a range limit (at most 357 days in the scans), so only years next to an edge year need the search.
 */
function isNearEdgeYear(calendarId: string, year: number): boolean {
  const { min, max } = edgeYears(calendarId);
  return (
    (min !== undefined && year <= min + 1) ||
    (max !== undefined && year >= max - 1)
  );
}

function needsFieldSearch(calendarId: string, year: number): boolean {
  return (
    hasReadCorrection(calendarId, year) ||
    (isDefectPresent("D1", calendarId) && isNearEdgeYear(calendarId, year)) ||
    isDefectPresent("D10", calendarId)
  );
}

/**
 * True when the polyfill failed with anything but the `RangeError` Temporal specifies for fields
 * that name no date: an internal assertion (tc39/proposal-temporal#3329, a port of #3292 without
 * its fix) or a `TypeError` from a broken read. The field search then answers, as the spec would,
 * rather than the public wrapper turning the throw into its sentinel.
 */
function isPolyfillDefectError(error: unknown): boolean {
  return error !== undefined && !(error instanceof RangeError);
}

function readBackMatches(
  date: Temporal.PlainDate,
  calendarId: string,
  fields: CalendarDateFields,
): boolean {
  if ("era" in fields) {
    // An era year outside its era's span resolves arithmetically (e.g. heisei 40 is 2028), so
    // it legitimately reads back under another era. With overflow "reject", month and day are
    // already validated by the polyfill.
    return true;
  }
  const read = calendarFieldsOf(date, calendarId);
  return (
    read.year === fields.year &&
    read.month === fields.month &&
    read.day === fields.day
  );
}

function rejectPreProposalEra(
  calendarId: string,
  fields: CalendarDateFields,
): void {
  if (
    "era" in fields &&
    PRE_PROPOSAL_ERAS.has(fields.era) &&
    isDefectPresent("D8", calendarId)
  ) {
    throw new RangeError(`Unknown ${calendarId} era: ${fields.era}`);
  }
}

/**
 * `Temporal.PlainDate.from({ ...fields, calendar: calendarId }, { overflow: "reject" })`, made
 * correct where `@js-temporal/polyfill` is not.
 *
 * The polyfill answers first, and its result is kept whenever its fields read back unchanged
 * through `calendarFieldsOf`. Only when it throws or reads back differently, for a defect the
 * installed runtime has (probed once per calendar) and inside that defect's range, does the
 * read-only field search answer instead:
 *
 * - **D1:** the polyfill's `calendarToIsoDate` probes outside the legacy `Date` range within about
 *   a year of both limits and throws `Invalid ISO date` (hebrew, buddhist, islamic-*, persian,
 *   indian). Retired by a js-temporal release porting proposal-temporal `a41eb67` + `af0cb4b`.
 * - **D2, D3, D4, D5:** the runtime's own reads are wrong (buddhist before 1582-10-15, Hebrew years
 *   <= 0, Indian before ISO year 1), so its fields → ISO is too; the search runs over the
 *   corrected reads. Retired with the read corrections in `calendarFields.ts`.
 * - **D8:** era codes that only the pre-proposal polyfill accepts (`japanese-inverse`) are
 *   rejected, as a fixed runtime rejects them.
 * - **D10:** a polyfill porting proposal-temporal #3292 without the tc39/proposal-temporal#3329 fix
 *   skips a 5- or 6-day month 13 (ethioaa, and so coptic and ethiopic) in far years. While its
 *   probe fails, every year searches. Any throw other than a `RangeError` also searches, whatever
 *   the probes say.
 *
 * Era input is never searched: only "japanese" uses eras here, and it has no D1 window.
 *
 * @returns a PlainDate calendared as `calendarId`; throws RangeError for fields that do not name
 *   an in-range date
 */
export function calendarDateFromFields(
  calendarId: string,
  fields: CalendarDateFields,
  overflow: "reject",
): Temporal.PlainDate {
  rejectPreProposalEra(calendarId, fields);

  let polyfillError: unknown;
  try {
    const result = Temporal.PlainDate.from(
      { ...fields, calendar: calendarId },
      { overflow },
    );
    if (readBackMatches(result, calendarId, fields)) {
      return result;
    }
  } catch (error) {
    polyfillError = error;
  }

  if (
    "era" in fields ||
    !(
      isPolyfillDefectError(polyfillError) ||
      needsFieldSearch(calendarId, fields.year)
    )
  ) {
    throw (
      polyfillError ??
      new RangeError(`${calendarId} fields do not read back unchanged`)
    );
  }

  const iso = isoForFields(calendarId, fields);
  if (iso === null) {
    throw new RangeError(
      `No in-range ${calendarId} date ${fields.year}-${fields.month}-${fields.day}`,
    );
  }
  return iso.withCalendar(calendarId);
}
