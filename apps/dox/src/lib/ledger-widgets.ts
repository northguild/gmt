/**
 * Pure helpers shared by the tools that draw time on local days: the Free Time
 * Ledger, the Dwell Ledger, the B/L Date Stamp, the Journey Split and the
 * Demurrage Clock.
 *
 * `dwell-ledger.ts` owns the grid (the canvas and `dayCells`). This module
 * holds what the five tools share beyond the grid: the markup of a row of day
 * columns, and four small texts.
 *
 * No DOM and no gmt import. `@js-temporal/polyfill` is imported for drawing
 * only: the weekday on a column's label, a date or a clock time as words. Every
 * date, duration and verdict a tool shows is a library call that the tool's own
 * mount makes, and these functions only set it in type.
 *
 * GMT tracks no law, and the UI names no body: no string here names a statute,
 * an agency, a carrier or a court.
 */

import { Temporal } from "@js-temporal/polyfill";
import { formatDayLabel, toEpochMs } from "./dwell-ledger";
import { FIXED_OFFSET_ZONES, TRANSPORT_ZONES } from "./transport-widgets";

// ---------------------------------------------------------------------------
// Day columns
// ---------------------------------------------------------------------------

/** How a column is drawn: lit glass, the family hatch, the closed hatch, or bare. */
type DayState = "lit" | "hatched" | "closed" | "plain";

/** One of the site's four series colours. */
export type SeriesNumber = 1 | 2 | 3 | 4;

export interface DayMark {
  state: DayState;
  /** The word on the column's chip ("charged", "closed"). Left out: no chip. */
  chip?: string;
  /** What the column's `aria-label` says after its date. Defaults to `chip`. */
  aria?: string;
  /** The column's series colour. */
  series?: SeriesNumber;
  /** A tariff's tier, 1 or more. It sets the hatch density and a "tier n" chip. */
  tier?: number;
  /** What the tool means by this state, for a test or a script to read. */
  kind?: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** `{ date: "15 Jun", weekday: "Sat" }` for a `YYYY-MM-DD` date. */
export function dayLabelParts(date: string): { date: string; weekday: string } {
  try {
    const d = Temporal.PlainDate.from(date);
    return { date: formatDayLabel(date), weekday: WEEKDAYS[d.dayOfWeek - 1]! };
  } catch {
    return { date, weekday: "" };
  }
}

// ---------------------------------------------------------------------------
// Result plates
// ---------------------------------------------------------------------------

/** What a plate reads when the library returned nothing for it. */
export const NO_RESULT = "no result";

export interface PlateSpec {
  /** The plate's `data-role`, which the stillness gate and the tests read. */
  role: string;
  caption: string;
  /** The library's answer in words, or `null` for no result. */
  value: string | null;
  /** Sub lines, one `<span>` each. A plate keeps these lines when it is empty. */
  lines: readonly string[];
  series?: SeriesNumber;
  /** A secondary result beside the main ones: the value at the smaller size of
   *  `.gmt-punct-hero--quiet`, so the row holds all of a tool's plates. */
  quiet?: boolean;
  /** Every caption this plate can show, when the caption changes with a choice
   *  (an event picks its own). The caption sits in a hold sized by the longest,
   *  so a long caption that wraps on a narrow plate wraps for every preset and
   *  never makes the plate taller or wider than the others. */
  captions?: readonly string[];
}

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

const DURATION = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/;

/**
 * An exact duration the library returned, shown in days, hours and minutes with
 * a day as 24 hours: `"PT400H"` is "16 d 16 h", `"PT139H30M"` is
 * "5 d 19 h 30 min", `"PT0S"` is "0 h". A part that is zero is left out.
 *
 * It returns `""` for a string that is not such a duration: a sign, a date
 * part, or seconds that are not zero, which these units cannot show exactly.
 */
export function hourDurationText(iso: string): string {
  const m = DURATION.exec(iso);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) {
    return "";
  }
  if (m[3] !== undefined && Number(m[3]) !== 0) return "";
  const hours = Number(m[1] ?? 0);
  const minutes = Number(m[2] ?? 0);
  if (!Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes)) return "";
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const out: string[] = [];
  if (days > 0) out.push(`${days} d`);
  if (rest > 0) out.push(`${rest} h`);
  if (minutes > 0) out.push(`${minutes} min`);
  return out.length === 0 ? "0 h" : out.join(" ");
}

const MONTHS = [
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
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `"2024-06-15"` as "Sat 15 Jun 2024"; `""` when it is not a `YYYY-MM-DD` date. */
export function dateText(date: string): string {
  if (!ISO_DATE.test(date)) return "";
  try {
    const d = Temporal.PlainDate.from(date);
    return `${WEEKDAYS[d.dayOfWeek - 1]} ${d.day} ${MONTHS[d.month - 1]} ${d.year}`;
  } catch {
    return "";
  }
}

/**
 * An instant on a zone's clock, as "Fri 14 Jun 15:00". `zone` is an IANA name
 * or a UTC offset. It returns `""` when the zone or the instant cannot be read.
 */
export function localText(instant: string, zone: string): string {
  const ms = toEpochMs(instant);
  if (Number.isNaN(ms)) return "";
  try {
    const z =
      Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone);
    const hh = String(z.hour).padStart(2, "0");
    const mm = String(z.minute).padStart(2, "0");
    return `${WEEKDAYS[z.dayOfWeek - 1]} ${z.day} ${MONTHS[z.month - 1]} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

/**
 * The zone list for a control that also takes offsets: the transport zones,
 * then `+08:00`, then the fixed offsets the Crossing Clock teaches, with no
 * entry twice.
 */
export const zoneWithOffsets: readonly string[] = [
  ...new Set([...TRANSPORT_ZONES, "+08:00", ...FIXED_OFFSET_ZONES]),
];
