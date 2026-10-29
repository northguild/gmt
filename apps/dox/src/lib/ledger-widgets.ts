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
import {
  formatDayLabel,
  toEpochMs,
  type DayCell,
  type LedgerCanvas,
} from "./dwell-ledger";
import { holdHtml, textSizers } from "./edi-picture";
import { heroLinesHtml } from "./punctuality-widgets";
import { FIXED_OFFSET_ZONES, TRANSPORT_ZONES } from "./transport-widgets";
import { escapeAttr, escapeHtml } from "./widget-ui";

/**
 * A ledger handle moves one snap unit on an arrow key, four with Shift, and
 * this many on PageUp and PageDown. The handle has no far end: the canvas
 * widens when a handle reaches its edge.
 */
export const PAGE_STEP_UNITS = 12;

// ---------------------------------------------------------------------------
// Day columns
// ---------------------------------------------------------------------------

/** How a column is drawn: lit glass, the family hatch, the closed hatch, or bare. */
export type DayState = "lit" | "hatched" | "closed" | "plain";

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

/** A column narrower than this shows no weekday, then no label (px). */
export const DAY_FIT_SHORT_PX = 108;
export const DAY_FIT_NARROW_PX = 62;

/**
 * How much of a column's label fits. `short` drops the weekday, `narrow` drops
 * the whole label and every chip (the `aria-label` still names the day).
 * `widthPx` is the column's measured width; 0 or less means "not measured" and
 * everything is kept.
 */
export function dayColumnFit(widthPx: number): "full" | "short" | "narrow" {
  if (!(widthPx > 0)) return "full";
  if (widthPx < DAY_FIT_NARROW_PX) return "narrow";
  if (widthPx < DAY_FIT_SHORT_PX) return "short";
  return "full";
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

/** The mark for a date no tool described: a bare column. */
const PLAIN: DayMark = { state: "plain" };

function chipHtml(className: string, text: string, attrs = ""): string {
  return `<span class="gmt-cutoff-chip ${className}"${attrs}>${escapeHtml(text)}</span>`;
}

/**
 * The markup for a row of day columns.
 *
 * `cells` are `dayCells` results. Each column is placed and sized by its day's
 * real bounds on `canvas`, so a 23- or 25-hour day is narrower or wider. A
 * column that falls outside the canvas is left out. `states` maps a date to its
 * mark; a date with no mark is a bare column.
 *
 * Each column is `role="listitem"` and carries `data-date`, `data-hours`,
 * `data-state` and an `aria-label` that says the date, an odd length and the
 * state in words. The visible label and chips are `aria-hidden`: the label says
 * it all.
 */
export function dayColumnsHtml(
  cells: readonly DayCell[],
  canvas: Pick<LedgerCanvas, "toPercent">,
  states: Readonly<Record<string, DayMark | undefined>>,
): string {
  return cells
    .map((cell) => {
      const left = canvas.toPercent(cell.startMs);
      const right = canvas.toPercent(cell.endMs);
      const width = Math.max(0, right - left);
      if (!(width > 0)) return "";
      const mark = states[cell.date] ?? PLAIN;
      const parts = dayLabelParts(cell.date);
      const odd = cell.hours !== 24;
      const word = mark.aria ?? mark.chip ?? "";
      const aria =
        `${parts.date}${parts.weekday === "" ? "" : ` ${parts.weekday}`}` +
        `${odd ? `, ${cell.hours} hours` : ""}` +
        `${mark.tier === undefined ? "" : `, tier ${mark.tier}`}` +
        `${word === "" ? "" : `, ${word}`}`;
      const classes = [
        "gmt-ledger-day",
        mark.state === "hatched" ? "gmt-punct-hatch" : "",
        mark.state === "closed" ? "gmt-cutoff-closed" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const chips = [
        mark.chip === undefined || mark.chip === ""
          ? ""
          : chipHtml("gmt-ledger-chip", mark.chip),
        mark.tier === undefined
          ? ""
          : chipHtml("gmt-ledger-chip", `tier ${mark.tier}`),
        odd
          ? chipHtml(
              "gmt-ledger-odd",
              `${cell.hours} h`,
              ` data-dst="${cell.hours < 24 ? "short" : "long"}"`,
            )
          : "",
      ].join("");
      return (
        `<div class="${classes}" role="listitem"` +
        ` data-date="${escapeAttr(cell.date)}" data-hours="${cell.hours}" data-state="${mark.state}"` +
        (mark.kind === undefined
          ? ""
          : ` data-kind="${escapeAttr(mark.kind)}"`) +
        (mark.tier === undefined ? "" : ` data-tier="${mark.tier}"`) +
        (mark.series === undefined ? "" : ` data-series="${mark.series}"`) +
        ` style="left:${left}%;width:${width}%"` +
        ` aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}">` +
        `<span class="gmt-ledger-day-label" aria-hidden="true">` +
        `<span class="gmt-ledger-day-date">${escapeHtml(parts.date)}</span>` +
        (parts.weekday === ""
          ? ""
          : `<span class="gmt-ledger-day-weekday"> · ${escapeHtml(parts.weekday)}</span>`) +
        `</span>` +
        (chips === ""
          ? ""
          : `<span class="gmt-ledger-day-chips" aria-hidden="true">${chips}</span>`) +
        `</div>`
      );
    })
    .join("");
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

/**
 * One result plate: a caption, a value and fixed sub lines, in the markup of
 * `.gmt-punct-hero` (gmt-punctuality-widgets.css). A plate with no result keeps
 * its box and reads "no result" in the muted ink, with blank lines.
 */
export function plateHtml(p: PlateSpec): string {
  const empty = p.value === null;
  return (
    `<div class="gmt-punct-hero${p.quiet === true ? " gmt-punct-hero--quiet" : ""}" data-gate="hero" data-role="${escapeAttr(p.role)}"` +
    (p.series === undefined ? "" : ` data-series="${p.series}"`) +
    (empty ? " data-empty" : "") +
    `>` +
    captionHtml(p) +
    `<span class="gmt-punct-hero-value">${empty ? `<span class="gmt-punct-hero-none" data-gate="instant">${escapeHtml(NO_RESULT)}</span>` : escapeHtml(p.value!)}</span>` +
    heroLinesHtml(p.lines.map((text) => ({ text: empty ? "" : text }))) +
    `</div>`
  );
}

/** The caption: one `<span>`, or that span in a hold with a hidden sizer for each
 *  caption the plate can show. */
function captionHtml(p: PlateSpec): string {
  const live = `<span class="gmt-punct-hero-cap">${escapeHtml(p.caption)}</span>`;
  if (p.captions === undefined) return live;
  const sizers = [...new Set([p.caption, ...p.captions])].map(
    (text) =>
      `<span class="gmt-punct-hero-cap gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore>${escapeHtml(text)}</span>`,
  );
  return holdHtml(live, sizers, "gmt-ledger-hold");
}

/**
 * A tool's preset description, held to the tallest description it can show at
 * whatever width it is laid out (`holdHtml`), so choosing another preset never
 * moves the controls and plates below it. The live paragraph is the only one a
 * reader reaches; the sizers are hidden.
 */
export function descriptionHoldHtml(
  live: string,
  descriptions: readonly string[],
): string {
  return holdHtml(
    live,
    textSizers("p", "gmt-widget-hint", descriptions),
    "gmt-ledger-hold",
  );
}

/** The pinned row that holds a tool's plates. `aria-hidden`: a visually hidden
 *  sentence says the same numbers. */
export function platesHtml(role: string, plates: readonly PlateSpec[]): string {
  return (
    `<div class="gmt-punct-heroes" data-role="${escapeAttr(role)}" aria-hidden="true">` +
    plates.map(plateHtml).join("") +
    `</div>`
  );
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
