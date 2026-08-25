import { Temporal } from "@js-temporal/polyfill";

export type EthiopicFamilyCalendar =
  | "ethiopic"
  | "ethiopic-amete-alem"
  | "coptic";

export function isEthiopicFamilyCalendar(
  value: string,
): value is EthiopicFamilyCalendar {
  return (
    value === "ethiopic" ||
    value === "ethiopic-amete-alem" ||
    value === "coptic"
  );
}

// @js-temporal/polyfill@0.5.1's "ethiopic" and "coptic" calendar ids resolve year/era by
// formatting the date through Intl.DateTimeFormat and matching the resulting era part
// against a hardcoded era-name table (its HelperBase.isoToCalendarDate — used because,
// unlike "ethioaa", these two calendars aren't a fixed year-offset from ISO, so the
// polyfill can't compute them with pure arithmetic the way it does for "ethioaa"). CLDR's
// era abbreviation for both calendars changed at the ICU 78 boundary, not at any particular
// Node major version: ICU < 78 emits an era string the polyfill's table matches; ICU >= 78
// emits "am", which isn't in that table. This is a real trap for "which Node am I on" bug
// hunting — ICU 78 ships in *both* Node 22 and Node 24 (confirmed directly against a Node 20 /
// ICU 78.2 environment during E5, issue #78, where the bug reproduces despite being on Node
// 20 — an earlier draft of this comment wrongly pinned the boundary to "Node 24"). The result
// is that *every* read or write of Temporal's "ethiopic"/"coptic" calendar ids throws a
// RangeError under ICU >= 78 (verified directly — this isn't a hypothetical). "ethioaa" (Ethiopic Amete Alem)
// has no era at all — a single continuous count from a fixed epoch — so the polyfill
// resolves it with pure arithmetic and never touches Intl, making it stable across Node
// versions. This module uses "ethioaa" as a computation carrier for the whole Ethiopic
// family: month/day are identical across all three (they share one annual 13-month cycle),
// so only the displayed year (+ era, for "ethiopic") needs converting, which this module
// does with GMT-owned arithmetic instead of ever constructing or reading a Temporal
// PlainDate calendared as "ethiopic" or "coptic".
//
// The two constants below are ported from the same source file
// (@js-temporal/polyfill/lib/calendar.ts)'s EthiopicHelper/CopticHelper definitions, not
// independently derived: the Amete Mihret ("ethiopic") era begins at ethioaa proleptic year
// 5501 (EthiopicHelper's `anchorEpoch: { year: 5501 }`), and Coptic's own epoch
// (0284-08-29) falls 5776 ethioaa years after ethioaa's epoch (-005492-07-17) — both
// verified against the polyfill's own output across a spread of dates spanning multiple
// centuries and both 13th-month lengths before being hardcoded here.
const ETHIOPIC_ERA_ANCHOR_ETHIOAA_YEAR = 5501;
const COPTIC_ETHIOAA_YEAR_OFFSET = 5776;

export interface EthiopicFamilyFields {
  year: number;
  era?: "ethioaa" | "ethiopic";
  eraYear?: number;
  month: number;
  day: number;
}

/**
 * Derive an Ethiopic-family calendar's native year/month/day (+ era, for "ethiopic") from a
 * Temporal.PlainDate, via Temporal's ICU-independent "ethioaa" calendar rather than the
 * target's own native calendar id. See the module comment above for why.
 */
export function ethiopicFamilyFieldsFromDate(
  date: Temporal.PlainDate,
  calendar: EthiopicFamilyCalendar,
): EthiopicFamilyFields {
  const { year: ethioaaYear, month, day } = date.withCalendar("ethioaa");

  if (calendar === "ethiopic-amete-alem") {
    return { year: ethioaaYear, month, day };
  }
  if (calendar === "coptic") {
    return { year: ethioaaYear - COPTIC_ETHIOAA_YEAR_OFFSET, month, day };
  }
  if (ethioaaYear >= ETHIOPIC_ERA_ANCHOR_ETHIOAA_YEAR) {
    return {
      year: ethioaaYear,
      era: "ethiopic",
      eraYear: ethioaaYear - (ETHIOPIC_ERA_ANCHOR_ETHIOAA_YEAR - 1),
      month,
      day,
    };
  }
  return {
    year: ethioaaYear,
    era: "ethioaa",
    eraYear: ethioaaYear,
    month,
    day,
  };
}

/**
 * Construct a Temporal.PlainDate from an Ethiopic-family calendar's native fields, backed
 * by Temporal's "ethioaa" calendar rather than the target's own native calendar id. Throws
 * on an unrecognized era or a missing required field — callers wrap this in try-catch per
 * GMT's sentinel-return contract. See the module comment above for why.
 */
export function dateFromEthiopicFamilyFields(
  calendar: EthiopicFamilyCalendar,
  fields: {
    year?: number;
    era?: string;
    eraYear?: number;
    month: number;
    day: number;
  },
): Temporal.PlainDate {
  let ethioaaYear: number;
  if (calendar === "ethiopic-amete-alem" || calendar === "coptic") {
    if (fields.year === undefined) {
      throw new RangeError(`${calendar} requires a year`);
    }
    ethioaaYear =
      calendar === "coptic"
        ? fields.year + COPTIC_ETHIOAA_YEAR_OFFSET
        : fields.year;
  } else if (fields.era === "ethioaa" || fields.era === "ethiopic") {
    if (fields.eraYear === undefined) {
      throw new RangeError("ethiopic requires an eraYear");
    }
    ethioaaYear =
      fields.era === "ethioaa"
        ? fields.eraYear
        : fields.eraYear + (ETHIOPIC_ERA_ANCHOR_ETHIOAA_YEAR - 1);
  } else {
    throw new RangeError(`Unknown ethiopic era: ${fields.era}`);
  }

  return Temporal.PlainDate.from(
    {
      year: ethioaaYear,
      month: fields.month,
      day: fields.day,
      calendar: "ethioaa",
    },
    { overflow: "reject" },
  );
}

/**
 * Split a Temporal.PlainDate into GMT's calendar-annotated string halves for an Ethiopic-family
 * calendar, mirroring `calendarDateParts`' shape for the rest of the calendar systems but
 * routed entirely through `ethiopicFamilyFieldsFromDate` — see the module comment above.
 *
 * Returned as `{ date, annotation }` rather than one string so the zoned grammar can splice its
 * time/offset between the two halves — see `calendarDateParts`' doc comment for why.
 */
export function ethiopicFamilyDateParts(
  date: Temporal.PlainDate,
  calendar: EthiopicFamilyCalendar,
): { date: string; annotation: string } {
  const fields = ethiopicFamilyFieldsFromDate(date, calendar);
  const month = String(fields.month).padStart(2, "0");
  const day = String(fields.day).padStart(2, "0");

  if (calendar === "ethiopic") {
    const eraYear = String(fields.eraYear).padStart(4, "0");
    return {
      date: `${eraYear}-${month}-${day}`,
      annotation: `[u-ca=ethiopic;era=${fields.era}]`,
    };
  }

  const year = String(fields.year).padStart(4, "0");
  return {
    date: `${year}-${month}-${day}`,
    annotation: `[u-ca=${calendar}]`,
  };
}

/**
 * Format a Temporal.PlainDate as GMT's calendar-annotated string for an Ethiopic-family
 * calendar, mirroring `formatCalendarDate`'s shape for the rest of the calendar systems but
 * routed entirely through `ethiopicFamilyFieldsFromDate` — see the module comment above.
 */
export function formatEthiopicFamilyDate(
  date: Temporal.PlainDate,
  calendar: EthiopicFamilyCalendar,
): string {
  const { date: datePart, annotation } = ethiopicFamilyDateParts(
    date,
    calendar,
  );
  return `${datePart}${annotation}`;
}
