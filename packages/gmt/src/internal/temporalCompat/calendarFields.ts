import type { Temporal } from "@js-temporal/polyfill";
import { isDefectPresent } from "./capabilities";
import { fixedFromIso } from "./fixedDay";
import { hebrewFieldsFromFixed, hebrewNewYear } from "./hebrewArithmetic";
import { indianFieldsFromIso, SAKA_YEAR_OFFSET } from "./indianArithmetic";

/** A date's fields in one calendar. `month` is ordinal (Hebrew leap year: `M05L` is 6). */
export interface CalendarFields {
  year: number;
  month: number;
  monthCode: string;
  day: number;
  /** As the runtime reads it; corrected only for "japanese", the one calendar GMT tags with an era. */
  era: string | undefined;
  eraYear: number | undefined;
}

/**
 * Buddhist year = ISO year + 543 for every date, month and day identical to ISO: the Intl
 * era/monthCode proposal's calendar table (era `be`, epoch year -543), test262
 * extreme-dates.js and add/proleptic-buddhist.js.
 */
const BUDDHIST_YEAR_OFFSET = 543;
/** The first Meiji era year in the proposal's era table; earlier dates are `ce`. */
const FIRST_MEIJI_ERA_YEAR = 6;

function runtimeRead(
  date: Temporal.PlainDate,
  calendarId: string,
): CalendarFields {
  const read = date.withCalendar(calendarId);
  return {
    year: read.year,
    month: read.month,
    monthCode: read.monthCode,
    day: read.day,
    era: read.era,
    eraYear: read.eraYear,
  };
}

function isoFields(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.withCalendar("iso8601");
}

function hebrewCorrectionActive(): boolean {
  return isDefectPresent("D3", "hebrew") || isDefectPresent("D4", "hebrew");
}

/**
 * D2: polyfill 0.5.1 reads buddhist through ICU4C's Julian/Gregorian hybrid, wrong for every
 * date before 1582-10-15. Retired by a js-temporal release containing 2bb6ba1.
 */
function buddhistFields(date: Temporal.PlainDate): CalendarFields {
  if (!isDefectPresent("D2", "buddhist")) {
    return runtimeRead(date, "buddhist");
  }
  const iso = isoFields(date);
  return {
    year: iso.year + BUDDHIST_YEAR_OFFSET,
    month: iso.month,
    monthCode: iso.monthCode,
    day: iso.day,
    era: undefined,
    eraYear: undefined,
  };
}

/** D3 + D4: Hebrew years <= 0 (see hebrewArithmetic.ts). */
function hebrewFields(date: Temporal.PlainDate): CalendarFields {
  const iso = isoFields(date);
  const fixed = fixedFromIso(iso.year, iso.month, iso.day);
  if (fixed >= hebrewNewYear(1) || !hebrewCorrectionActive()) {
    return runtimeRead(date, "hebrew");
  }
  return { ...hebrewFieldsFromFixed(fixed), era: undefined, eraYear: undefined };
}

/** D5: Indian dates before ISO year 1 (see indianArithmetic.ts). */
function indianFields(date: Temporal.PlainDate): CalendarFields {
  const iso = isoFields(date);
  if (iso.year >= 1 || !isDefectPresent("D5", "indian")) {
    return runtimeRead(date, "indian");
  }
  return {
    ...indianFieldsFromIso(iso.year, iso.month, iso.day),
    era: undefined,
    eraYear: undefined,
  };
}

/**
 * D8: polyfill 0.5.1 predates the Intl era/monthCode proposal's era codes. It reads `japanese`
 * where the proposal has `ce`, `japanese-inverse` for `bce`, and starts `meiji` at year 1 in
 * 1868, where the proposal keeps `ce` through 1872-12-31 and starts `meiji` at year 6. Retired by
 * a js-temporal release containing 2bb6ba1.
 */
function japaneseFields(date: Temporal.PlainDate): CalendarFields {
  const read = runtimeRead(date, "japanese");
  if (!isDefectPresent("D8", "japanese")) {
    return read;
  }
  if (read.era === "japanese-inverse") {
    return { ...read, era: "bce", eraYear: 1 - read.year };
  }
  if (
    read.era === "japanese" ||
    (read.era === "meiji" && (read.eraYear ?? 0) < FIRST_MEIJI_ERA_YEAR)
  ) {
    return { ...read, era: "ce", eraYear: read.year };
  }
  return read;
}

/**
 * The fields of `date` in the Temporal calendar `calendarId`. Every calendar-field read in GMT's
 * calendar string formatters and in the field search goes through here, so the runtime's read is
 * corrected in one place, and only where a capability probe shows the runtime is wrong (D2, D3,
 * D4, D5, D8 in README.md). Otherwise this is exactly `date.withCalendar(calendarId)`'s fields.
 */
export function calendarFieldsOf(
  date: Temporal.PlainDate,
  calendarId: string,
): CalendarFields {
  switch (calendarId) {
    case "buddhist":
      return buddhistFields(date);
    case "hebrew":
      return hebrewFields(date);
    case "indian":
      return indianFields(date);
    case "japanese":
      return japaneseFields(date);
    default:
      return runtimeRead(date, calendarId);
  }
}

/**
 * True when reads of `calendarYear` in `calendarId` are corrected in this runtime, so the
 * polyfill's own fields → ISO conversion for that year cannot be trusted either. The year ranges
 * are supersets of each defect's reach: Hebrew years <= 0 hold every D3/D4 date, and every ISO
 * date before year 1 lies in a Saka year whose Chaitra 1 falls in a Gregorian year <= 0.
 */
export function hasReadCorrection(
  calendarId: string,
  calendarYear: number,
): boolean {
  switch (calendarId) {
    case "buddhist":
      return isDefectPresent("D2", calendarId);
    case "hebrew":
      return calendarYear <= 0 && hebrewCorrectionActive();
    case "indian":
      return (
        calendarYear + SAKA_YEAR_OFFSET <= 0 &&
        isDefectPresent("D5", calendarId)
      );
    default:
      return false;
  }
}
