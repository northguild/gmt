/**
 * Pure helpers for the Timetable Reader widget (TRAN-9): what a printed,
 * zoneless departure time means, through `scheduleDelivery`'s `startTimeZone`.
 *
 * A timetable prints wall times with no offset. `startTimeZone` is what makes
 * one exact: a repeated hour (a fall-back night) resolves to the earlier
 * instant, a skipped one (a spring-forward night) to the later instant, and
 * writing the offset picks the other pass of a repeated hour — but names no
 * instant in a skipped one, because none exists. Every classification, instant,
 * arrival, band edge and offset shown comes from a library call
 * (`classifyLocal`, `getDstTransitions`, `etaAtZone`, `resolveLocal`,
 * `transitTime`, `scheduleDelivery`); this widget computes none of them.
 *
 * No DOM and no gmt import: `TimetableLib` comes in from the mount. The
 * helpers after "What the tool draws" (positions, snapping, tick steps, the
 * chart window and the hidden sizers) are drawing, not results; they use
 * `@js-temporal/polyfill` only to read instants the library returned, as
 * `transport-widgets.ts` does.
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  diagnose,
  formatSchedule,
  scheduleNullText,
  type DeliverySchedule,
  type ScheduleLeg,
  type ScheduleOptions,
  type TransportLib,
} from "./transport-widgets";

export interface DstTransition {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

/** `TransportLib` plus the two calls this widget draws its day with. */
export interface TimetableLib extends TransportLib {
  getDstTransitions(timeZone: string, year: number): DstTransition[];
  classifyLocal(
    localDateTime: string,
    timeZone: string,
  ): "unique" | "ambiguous" | "nonexistent" | null;
}

export const MAX_ROWS = 4;

/** One row of the printed timetable, as the DOM holds it: a printed wall
 *  time, and an optional offset that picks a pass of a repeated hour. A row
 *  with a blank `departure` is skipped everywhere. */
export interface TimetableRow {
  departure: string;
  offset: string;
}

export interface TimetableState {
  startTimeZone: string;
  duration: string;
  timeZone: string;
  rows: [TimetableRow, TimetableRow, TimetableRow, TimetableRow];
}

/** Seed arguments: the chat sends `departures` (and optionally `offsets`) as
 *  arrays; the permalink flattens them to `departure1`…`offset4`, because
 *  `seedFromLocation` keeps only top-level strings. */
export interface TimetableReaderArgs {
  startTimeZone?: string;
  duration?: string;
  timeZone?: string;
  departures?: string[];
  offsets?: string[];
  departure1?: string;
  offset1?: string;
  departure2?: string;
  offset2?: string;
  departure3?: string;
  offset3?: string;
  departure4?: string;
  offset4?: string;
}

export const CUSTOM_PRESET_ID = "custom";

const BLANK_ROW: TimetableRow = { departure: "", offset: "" };

function padRows(
  rows: readonly TimetableRow[],
): [TimetableRow, TimetableRow, TimetableRow, TimetableRow] {
  const out: TimetableRow[] = [];
  for (let i = 0; i < MAX_ROWS; i++) out.push(rows[i] ?? { ...BLANK_ROW });
  return out as [TimetableRow, TimetableRow, TimetableRow, TimetableRow];
}

export interface TimetablePreset {
  id: string;
  label: string;
  description: string;
  startTimeZone: string;
  duration: string;
  timeZone: string;
  rows: readonly TimetableRow[];
}

const NY = "America/New_York";

/** Every preset is a section 9 row, so every result the widget shows is a
 *  verified value. */
export const TIMETABLE_PRESETS: readonly TimetablePreset[] = [
  {
    id: "fall-back",
    label: "New York's fall-back night: 00:30, 01:30, 02:30",
    description:
      "New York's fall-back night, printed as three timetable rows. 00:30 and 02:30 each happen once; 01:30 happens twice, and the clock alone cannot say which pass a printed 01:30 means.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: NY,
    rows: [
      { departure: "2024-11-03T00:30:00", offset: "" },
      { departure: "2024-11-03T01:30:00", offset: "" },
      { departure: "2024-11-03T02:30:00", offset: "" },
    ],
  },
  {
    id: "offset-picks",
    label: "01:30 twice: with no offset, then with −05:00",
    description:
      "01:30 happens twice on New York's fall-back night. Left with no offset it resolves to the earlier pass; written with −05:00 it resolves to the later one.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: NY,
    rows: [
      { departure: "2024-11-03T01:30:00", offset: "" },
      { departure: "2024-11-03T01:30:00", offset: "-05:00" },
    ],
  },
  {
    id: "spring-forward",
    label: "New York's spring-forward night: 01:30, 02:30, 03:30",
    description:
      "02:30 never shows on a New York clock that night, so it resolves to 03:30, the same instant as the row printed 03:30. Two timetable rows, one departure.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: NY,
    rows: [
      { departure: "2024-03-10T01:30:00", offset: "" },
      { departure: "2024-03-10T02:30:00", offset: "" },
      { departure: "2024-03-10T03:30:00", offset: "" },
    ],
  },
  {
    id: "published-local",
    label: "A published 10:00, read in New York",
    description:
      "The library's own documented case: a published 10:00 with no offset, read in New York, arriving in UTC.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: "UTC",
    rows: [{ departure: "2024-06-15T10:00:00", offset: "" }],
  },
  {
    id: "berlin-fall-back",
    label: "Berlin's fall-back night: 02:30",
    description:
      "Berlin's fall-back night: a timetable printing 02:30, read for a run onward to Amsterdam.",
    startTimeZone: "Europe/Berlin",
    duration: "PT1H",
    timeZone: "Europe/Amsterdam",
    rows: [{ departure: "2024-10-27T02:30:00", offset: "" }],
  },
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** `departures`/`offsets` arrays (the chat tool) win over the flat permalink
 *  keys. Anything that is not a string becomes `""`. */
export function readArgs(args: TimetableReaderArgs): TimetableState {
  let rows: TimetableRow[];
  if (Array.isArray(args.departures)) {
    rows = args.departures.slice(0, MAX_ROWS).map((d, i) => ({
      departure: str(d),
      offset: str(args.offsets?.[i]),
    }));
  } else {
    const rec = args as unknown as Record<string, unknown>;
    rows = [1, 2, 3, 4].map((n) => ({
      departure: str(rec[`departure${n}`]),
      offset: str(rec[`offset${n}`]),
    }));
  }
  return {
    startTimeZone: str(args.startTimeZone),
    duration: str(args.duration),
    timeZone: str(args.timeZone),
    rows: padRows(rows),
  };
}

/** The preset whose `startTimeZone`, `duration`, `timeZone` and every row
 *  match `state`, trimmed, or `custom`. */
export function matchPreset(state: TimetableState): string {
  const t = (s: string) => s.trim();
  const hit = TIMETABLE_PRESETS.find((p) => {
    if (t(p.startTimeZone) !== t(state.startTimeZone)) return false;
    if (t(p.duration) !== t(state.duration)) return false;
    if (t(p.timeZone) !== t(state.timeZone)) return false;
    for (let i = 0; i < MAX_ROWS; i++) {
      const a = p.rows[i] ?? BLANK_ROW;
      const b = state.rows[i]!;
      if (t(a.departure) !== t(b.departure) || t(a.offset) !== t(b.offset)) {
        return false;
      }
    }
    return true;
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The text passed as a leg's `departure`: the printed time when the row has
 * no offset, else the printed time with the offset appended and `zone`
 * bracketed — the same shape a timetable's own footnote would write.
 */
export function rowDeparture(row: TimetableRow, zone: string): string {
  const printed = row.departure.trim();
  const offset = row.offset.trim();
  if (offset === "") return printed;
  return `${printed}${offset}[${zone}]`;
}

/** The leg row `i` names, read in `state.startTimeZone` — every row is its
 *  own single-leg call. `null` when the row is blank. */
export function rowLeg(state: TimetableState, i: number): ScheduleLeg | null {
  const row = state.rows[i]!;
  if (row.departure.trim() === "") return null;
  return {
    departure: rowDeparture(row, state.startTimeZone.trim()),
    duration: state.duration.trim(),
    timeZone: state.timeZone.trim(),
  };
}

export function optionsOf(state: TimetableState): ScheduleOptions | undefined {
  const zone = state.startTimeZone.trim();
  return zone === "" ? undefined : { startTimeZone: zone };
}

/** `startTimeZone`, `duration`, `timeZone`, and every non-blank row under its
 *  flat key. Strings only. */
export function permalinkOf(state: TimetableState): Record<string, string> {
  const out: Record<string, string> = {};
  const zone = state.startTimeZone.trim();
  const duration = state.duration.trim();
  const timeZone = state.timeZone.trim();
  if (zone !== "") out.startTimeZone = zone;
  if (duration !== "") out.duration = duration;
  if (timeZone !== "") out.timeZone = timeZone;
  for (let i = 0; i < MAX_ROWS; i++) {
    const row = state.rows[i]!;
    const idx = i + 1;
    if (row.departure.trim() !== "")
      out[`departure${idx}`] = row.departure.trim();
    if (row.offset.trim() !== "") out[`offset${idx}`] = row.offset.trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// What a printed time means — one classifyLocal call, then the two resolutions
// ---------------------------------------------------------------------------

export type RowClass = "once" | "twice" | "skipped" | "invalid";

/**
 * Whether `printed` (a bare wall time, `zone`'s own printed departure with no
 * offset) names one instant, an ambiguous one, or none at all — one
 * `classifyLocal` call. `once`: `unique`. `twice`: `ambiguous`, an hour the
 * clock ran through twice. `skipped`: `nonexistent`, an hour the clock never
 * showed, resolved forward to the next one. `invalid`: the library said `null`
 * (not a time, or not a zone).
 *
 * Comparing `HH:MM` cannot do this: on a date a zone skipped whole
 * (`Pacific/Apia`, 2011-12-30) the earlier resolution reads the same `HH:MM`
 * on the day before, which looks exactly like a repeated hour.
 */
export function classify(
  printed: string,
  zone: string,
  lib: TimetableLib,
): RowClass {
  switch (lib.classifyLocal(printed, zone)) {
    case "unique":
      return "once";
    case "ambiguous":
      return "twice";
    case "nonexistent":
      return "skipped";
    default:
      return "invalid";
  }
}

/** The written offset in a zoned instant string (`-05:00`), or `""`. */
function offsetOf(text: string): string {
  const m = /([+-]\d{2}:\d{2})(?:\[|$)/.exec(text);
  return m ? m[1]! : "";
}

/**
 * The longest an Offset option label may be, in characters.
 *
 * The select's text is cut off when it is wider than its text area, and the
 * narrowest four-in-a-row frame is the tightest place (the compact band, a
 * 45.5rem = 728px section): the frame is 176px, its fieldset padding takes 16
 * and the fieldset border 2, so the select is 158px; its own padding (8 left,
 * 28 right for the arrow) and 1px borders leave 120px of text. The control is
 * 12px there, and a monospace advance is 0.6em = 7.2px, so 120 / 7.2 = 16.7:
 * 16 characters. Measured in Chromium at 1440 (select 165.5px at a 758px
 * section): "-04:00 (earlier)" is 115px. Wider frames use the 13.6px size, where
 * 16 characters need 131px and the select is never under 176px (the field
 * grid's own 11rem column floor).
 */
export const OFFSET_LABEL_MAX = 16;

/** One choice for a row's Offset field: the value written into the departure,
 *  and what it means in words. */
export interface OffsetChoice {
  value: string;
  label: string;
}

/**
 * What a row's Offset field can usefully hold, for the time it currently
 * prints.
 *
 * The offset is only ever a way to name a pass of an hour the clock did not
 * run through once, so the choices are not a list of every offset that exists
 * — they are the two the zone actually runs at across this row's transition,
 * read back from `resolveLocal`'s two resolutions through `etaAtZone`, plus
 * leaving it blank.
 *
 * A `once` row has one instant, so writing an offset could only agree with it
 * or contradict it, and the only honest choice is to write nothing. Both
 * `twice` and `skipped` rows get the two offsets: on a `twice` row they pick
 * the pass, which is the point of the field, and on a `skipped` row they name
 * an hour the clock never showed and the call returns no instant at all —
 * a case this widget exists to teach, so the field has to be able to express
 * it.
 *
 * Nothing here computes an offset. `classify` (one `classifyLocal` call) says
 * which kind of row this is; both offsets then come from the library, through
 * `resolveLocal` and `etaAtZone`.
 */
export function offsetChoices(
  printed: string,
  zone: string,
  lib: TimetableLib,
): OffsetChoice[] {
  const none: OffsetChoice = { value: "", label: "None" };
  if (printed === "" || zone === "" || !lib.isValidDateTime(printed)) {
    return [none];
  }
  const kind = classify(printed, zone, lib);
  if (kind === "once" || kind === "invalid") return [none];

  const passOffset = (disambiguation: "earlier" | "later"): string =>
    offsetOf(
      lib.etaAtZone(lib.resolveLocal(printed, zone, { disambiguation }), zone),
    );
  const earlier = passOffset("earlier");
  const later = passOffset("later");

  /* On a repeated hour the offset says which pass, so it is named that way. On
     a skipped one neither offset names an instant, so neither is dressed as a
     choice between passes. */
  const out: OffsetChoice[] =
    kind === "twice" ? [{ value: "", label: "None (earlier)" }] : [none];
  const suffix = (which: "earlier" | "later"): string =>
    kind === "twice" ? ` (${which})` : " (skipped)";
  if (earlier !== "")
    out.push({ value: earlier, label: `${earlier}${suffix("earlier")}` });
  if (later !== "" && later !== earlier)
    out.push({ value: later, label: `${later}${suffix("later")}` });
  return out;
}

/**
 * The words beside a row's Offset select that say why it is, or is not,
 * available: a disabled control's reason is stated next to it. Keyed by the
 * same `classify` the select's choices come from. A `once` row that already
 * holds an offset keeps its select enabled so the reader can clear it, and the
 * line says so. An empty row, a row that is not a time and a blank zone all
 * need the same first step, so they share one line.
 */
export function offsetReason(
  printed: string,
  zone: string,
  offset: string,
  lib: TimetableLib,
): string {
  if (printed.trim() === "" || zone.trim() === "") return REASON_EMPTY;
  switch (classify(printed, zone, lib)) {
    case "once":
      return offset === "" ? REASON_ONCE : REASON_ONCE_WRITTEN;
    case "twice":
      return REASON_TWICE;
    case "skipped":
      return REASON_SKIPPED;
    default:
      return REASON_EMPTY;
  }
}

const REASON_EMPTY = "Type a printed time first.";
const REASON_ONCE = "Happens once: nothing to choose.";
const REASON_ONCE_WRITTEN = "Happens once: choose None to clear the offset.";
const REASON_TWICE = "Happens twice: the offset picks the pass.";
const REASON_SKIPPED = "Never shows: no offset makes it valid.";

/** The longest reason, for the hidden sizer that reserves its slot. */
export const LONGEST_REASON: string = [
  REASON_EMPTY,
  REASON_ONCE,
  REASON_ONCE_WRITTEN,
  REASON_TWICE,
  REASON_SKIPPED,
].reduce((a, b) => (b.length > a.length ? b : a));

/** The badge text for a classified row, or `null` for `once`, which shows no
 *  badge. A `twice` row with an offset written shows that the offset is what
 *  picked the pass, rather than repeating the generic "occurs twice" text. */
export function rowBadge(kind: RowClass, hasOffset: boolean): string | null {
  switch (kind) {
    case "once":
    case "invalid":
      return null;
    case "twice":
      return hasOffset
        ? "Offset written: this pass"
        : "Occurs twice: the earlier instant";
    case "skipped":
      return "Never shows on the clock: the later instant";
  }
}

/** The reason text an offset written into a `skipped` row's `NO SIGNAL`
 *  deserves — a reading no offset can name, distinct from every reason
 *  `scheduleNullText` covers. */
export const SKIPPED_OFFSET_TEXT =
  "This clock skipped that time, so no offset can make it valid. Leave the offset off and it resolves to the later instant.";

/**
 * The exact instant row `i`'s printed departure names, rendered back in
 * `startTimeZone` — a zero-length leg whose `timeZone` is `startTimeZone`
 * itself, so the "Leaves (exact)" column comes from the library's own
 * resolution of the printed time, never from arithmetic. `null` when the row
 * is blank or does not resolve.
 */
export function leavesAt(
  state: TimetableState,
  i: number,
  lib: TransportLib,
): string | null {
  const row = state.rows[i]!;
  if (row.departure.trim() === "") return null;
  const zone = state.startTimeZone.trim();
  const departure = rowDeparture(row, zone);
  const result = lib.scheduleDelivery(
    [{ departure, duration: "PT0S", timeZone: zone }],
    { startTimeZone: zone },
  );
  return result?.legTimes[0]?.localArrival ?? null;
}

/**
 * Row `i`'s real call result and, when it is `null`, the reason to show —
 * `SKIPPED_OFFSET_TEXT` when an offset was written into a row whose printed
 * time the clock skipped, else `scheduleNullText` for whatever `diagnose`
 * finds. `null` reason alongside a `null` result means the row is blank.
 */
export function rowResult(
  state: TimetableState,
  i: number,
  lib: TimetableLib,
): { result: DeliverySchedule | null; reason: string | null } {
  const leg = rowLeg(state, i);
  if (leg === null) return { result: null, reason: null };
  const options = optionsOf(state);
  const result = lib.scheduleDelivery([leg], options);
  if (result !== null) return { result, reason: null };

  const row = state.rows[i]!;
  const zone = state.startTimeZone.trim();
  if (
    row.offset.trim() !== "" &&
    zone !== "" &&
    classify(row.departure.trim(), zone, lib) === "skipped"
  ) {
    return { result: null, reason: SKIPPED_OFFSET_TEXT };
  }
  const diag = diagnose([leg], options, lib);
  return {
    result: null,
    reason: diag ? scheduleNullText(diag.reason, 1) : null,
  };
}

// ---------------------------------------------------------------------------
// What the tool draws: the day track, its handles and the two-clocks chart
//
// Positions, snapping, tick steps and the chart window are drawing. Every
// instant, arrival, classification and band edge they place is a library call.
// ---------------------------------------------------------------------------

export const STEP_MINUTES = 5;
export const BIG_STEP_MINUTES = 60;
export const MAX_MINUTE = 1435;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** `HH:MM` of a minute after 00:00. */
export function hhmmOfMinute(minute: number): string {
  return `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`;
}

function plainOf(text: string): Temporal.PlainDateTime | null {
  try {
    return Temporal.PlainDateTime.from(text);
  } catch {
    return null;
  }
}

/** The ISO date of the first row, in row order, whose trimmed `departure`
 *  passes `lib.isValidDateTime`; `null` when no row has one. The status line
 *  names this date, so the reader can tell which day the track shows. */
export function trackDate(
  state: TimetableState,
  lib: TimetableLib,
): string | null {
  for (const row of state.rows) {
    const text = row.departure.trim();
    if (text === "" || !lib.isValidDateTime(text)) continue;
    const plain = plainOf(text);
    if (plain) return plain.toPlainDate().toString();
  }
  return null;
}

/** Minutes after 00:00 of a printed time, seconds dropped; `null` when it does
 *  not parse. */
export function rowMinute(printed: string): number | null {
  const plain = plainOf(printed.trim());
  return plain ? plain.hour * 60 + plain.minute : null;
}

/** The printed time at `minute` on `date`, in the form the presets use, so a
 *  handle dragged back to a preset's time matches the preset again. */
export function withMinute(date: string, minute: number): string {
  return `${date}T${hhmmOfMinute(minute)}:00`;
}

export type LaneState =
  | { state: "blank" }
  | { state: "invalid" }
  | { state: "off"; date: string }
  | { state: "on"; minute: number; kind: RowClass };

/** What row `i` shows on the track. `off` is a valid time on another date. */
export function laneState(
  state: TimetableState,
  i: number,
  date: string,
  lib: TimetableLib,
): LaneState {
  const text = state.rows[i]!.departure.trim();
  if (text === "") return { state: "blank" };
  if (!lib.isValidDateTime(text)) return { state: "invalid" };
  const plain = plainOf(text);
  if (!plain) return { state: "invalid" };
  const rowDate = plain.toPlainDate().toString();
  if (rowDate !== date) return { state: "off", date: rowDate };
  return {
    state: "on",
    minute: plain.hour * 60 + plain.minute,
    kind: classify(text, state.startTimeZone.trim(), lib),
  };
}

export interface DayBand {
  kind: "twice" | "skipped";
  /** 0 to 1440, start inclusive, end exclusive, clipped to the date. */
  startMinute: number;
  endMinute: number;
  /** `HH:MM` of the two unclipped readings. */
  from: string;
  to: string;
  startWall: string;
  endWall: string;
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

/**
 * The repeated or skipped stretches of `zone`'s clock on `date`. The two wall
 * readings at each change come from `etaAtZone` at the transition's two
 * offsets, so a 30-minute shift, a change at midnight and a skipped date all
 * read right. A change is listed under the year of its later wall reading, so
 * 31 December also asks for the next year and 1 January for the previous.
 * `[]` for an invalid zone, date or year.
 */
export function dayBands(
  zone: string,
  date: string,
  lib: TimetableLib,
): DayBand[] {
  const zoneName = zone.trim();
  if (zoneName === "" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const year = Number(date.slice(0, 4));
  if (year < 1 || year > 9999) return [];
  let dayEnd: string;
  try {
    const next = Temporal.PlainDate.from(date, { overflow: "reject" }).add({
      days: 1,
    });
    dayEnd = `${next.toString()}T00:00:00`;
  } catch {
    return [];
  }
  const dayStart = `${date}T00:00:00`;
  const years = [year];
  if (date.endsWith("-12-31")) years.push(year + 1);
  if (date.endsWith("-01-01")) years.unshift(year - 1);
  const minuteOf = (wall: string): number =>
    wall === dayEnd
      ? 1440
      : Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
  const out: DayBand[] = [];
  for (const y of years) {
    if (y < 1 || y > 9999) continue;
    let transitions: DstTransition[];
    try {
      transitions = lib.getDstTransitions(zoneName, y);
    } catch {
      return [];
    }
    for (const t of transitions) {
      const before = lib.etaAtZone(t.instant, t.offsetBefore).slice(0, 19);
      const after = lib.etaAtZone(t.instant, t.offsetAfter).slice(0, 19);
      if (before.length < 19 || after.length < 19 || before === after) continue;
      const twice = after < before;
      const start = twice ? after : before;
      const end = twice ? before : after;
      if (end <= dayStart || start >= dayEnd) continue;
      const clippedStart = start < dayStart ? dayStart : start;
      const clippedEnd = end > dayEnd ? dayEnd : end;
      out.push({
        kind: twice ? "twice" : "skipped",
        startMinute: minuteOf(clippedStart),
        endMinute: minuteOf(clippedEnd),
        from: start.slice(11, 16),
        to: end.slice(11, 16),
        startWall: start,
        endWall: end,
        instant: t.instant,
        offsetBefore: t.offsetBefore,
        offsetAfter: t.offsetAfter,
      });
    }
  }
  return out;
}

/** The band `minute` falls in, or `null`. */
export function bandAt(
  minute: number,
  bands: readonly DayBand[],
): DayBand | null {
  return (
    bands.find((b) => minute >= b.startMinute && minute < b.endMinute) ?? null
  );
}

/** The words for a day's bands, used by the track's chip and the chart's. */
export function bandChipText(bands: readonly DayBand[]): string {
  if (bands.length === 0) return "No clock change this day";
  return bands
    .map((b) => {
      if (b.kind === "skipped" && b.startMinute === 0 && b.endMinute === 1440) {
        return "This date never shows on the clock";
      }
      return `${b.from}–${b.to} ${b.kind === "twice" ? "happens twice" : "never shows"}`;
    })
    .join("; ");
}

/** The smallest of 5, 10, 15 and 30 minutes whose width on the track is at
 *  least 2.5px, else 30, so a short track is still aimable. Every preset time
 *  is a multiple of 30. */
export function pointerStep(trackPx: number): 5 | 10 | 15 | 30 {
  for (const step of [5, 10, 15] as const) {
    if ((trackPx * step) / 1440 >= 2.5) return step;
  }
  return 30;
}

const clampMinute = (m: number): number => Math.min(MAX_MINUTE, Math.max(0, m));

/** The pointer's minute, rounded to `step`, clamped to 0 and `MAX_MINUTE`. */
export function minuteAtPointer(
  clientX: number,
  left: number,
  width: number,
  step: number,
): number {
  if (!(width > 0)) return 0;
  const raw = ((clientX - left) / width) * 1440;
  return clampMinute(Math.round(raw / step) * step);
}

/** The next multiple of 5 minutes in `direction`, clamped. From 01:32, later
 *  gives 01:35 and earlier gives 01:30. */
export function stepMinute(minute: number, direction: 1 | -1): number {
  const next =
    direction > 0
      ? Math.floor(minute / STEP_MINUTES) * STEP_MINUTES + STEP_MINUTES
      : Math.ceil(minute / STEP_MINUTES) * STEP_MINUTES - STEP_MINUTES;
  return clampMinute(next);
}

/** An hour later or earlier, keeping the minutes, clamped. */
export function jumpMinute(minute: number, direction: 1 | -1): number {
  return clampMinute(minute + direction * BIG_STEP_MINUTES);
}

/** The smallest hour step whose pitch is at least `labelPx`, else 12. */
export function tickStepHours(
  pxPerHour: number,
  labelPx: number,
): 1 | 2 | 3 | 6 | 12 {
  for (const step of [1, 2, 3, 6] as const) {
    if (pxPerHour * step >= labelPx) return step;
  }
  return 12;
}

/** A handle's `aria-valuetext`: the printed time and what it means. `leaves`
 *  is the `HH:MM` the row leaves at, when the row names an instant. */
export function handleValueText(
  hhmm: string,
  kind: RowClass,
  offset: string,
  leaves: string | null,
): string {
  if (kind === "twice") {
    return offset === ""
      ? `${hhmm}, happens twice, read as the earlier pass`
      : `${hhmm}, happens twice, offset ${offset} written`;
  }
  if (kind === "skipped") {
    if (offset !== "") return `${hhmm}, never shows on the clock, no instant`;
    return leaves
      ? `${hhmm}, never shows on the clock, read as ${leaves}`
      : `${hhmm}, never shows on the clock`;
  }
  return hhmm;
}

/** The chip that rides a handle: `1 · 00:30`, `2 · 01:30 twice`. */
export function tagText(n: number, hhmm: string, kind: RowClass): string {
  const word =
    kind === "twice" ? " twice" : kind === "skipped" ? " skipped" : "";
  return `${n} · ${hhmm}${word}`;
}

/** `HH:MM ±hh:mm` of a zoned instant string, with ` MM-DD` added when its date
 *  is not `date`. The arrival chip's text. */
export function arrivalChipText(iso: string, date: string): string {
  const m =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)/.exec(
      iso,
    );
  if (!m) return iso;
  const short = `${m[2]} ${m[3] === "Z" ? "Z" : m[3]}`;
  return m[1] === date ? short : `${short} ${m[1]!.slice(5)}`;
}

// ---------------------------------------------------------------------------
// The two-clocks chart
// ---------------------------------------------------------------------------

export interface ChartRow {
  /** 1 to 4. */
  n: number;
  printedMinute: number;
  kind: RowClass;
  offset: string;
  leaves: string | null;
  localArrival: string | null;
  instantMinute: number | null;
  arrivalMinute: number | null;
  /** The arrival is past the domain. */
  open: boolean;
  /** A skipped time with no offset: read forward, drawn dashed. */
  dashed: boolean;
}

export interface ChartFan {
  kind: "twice" | "skipped";
  wallStart: number;
  wallEnd: number;
  /** Twice: the earlier pass's start, the change, the later pass's end.
   *  Skipped: the change. */
  exact: number[];
}

export interface OffsetSegment {
  from: number;
  to: number;
  offset: string;
}

export interface ChartLayout {
  date: string;
  /** The exact instant the local day starts, as the library returned it. */
  dayStart: string;
  startTimeZone: string;
  timeZone: string;
  dayMinutes: number;
  tail: number;
  domainMinutes: number;
  rows: ChartRow[];
  /** Valid rows on another date, which are not drawn. */
  others: { n: number; date: string }[];
  bands: DayBand[];
  fans: ChartFan[];
  segments: OffsetSegment[];
}

/** What one row's two library calls returned, computed once per render. */
export interface RowFacts {
  leaves: string | null;
  result: DeliverySchedule | null;
}

export function rowFacts(
  state: TimetableState,
  i: number,
  lib: TimetableLib,
): RowFacts {
  return {
    leaves: leavesAt(state, i, lib),
    result: rowResult(state, i, lib).result,
  };
}

/** Values that depend only on the zone and date (or the run time), kept by the
 *  mount so a moving handle never recomputes them. */
export interface ChartMemo {
  bands: Map<string, DayBand[]>;
  day: Map<string, { start: string; minutes: number } | null>;
  tail: Map<string, number>;
}

export function newChartMemo(): ChartMemo {
  return { bands: new Map(), day: new Map(), tail: new Map() };
}

/** The bands for `zone|date`, memoised. */
export function bandsFor(
  zone: string,
  date: string,
  lib: TimetableLib,
  memo: ChartMemo,
): DayBand[] {
  const key = `${zone}|${date}`;
  let hit = memo.bands.get(key);
  if (!hit) {
    hit = dayBands(zone, date, lib);
    memo.bands.set(key, hit);
  }
  return hit;
}

const instantMs = (iso: string): number =>
  Temporal.Instant.from(iso.replace(/\[.*\]$/, "")).epochMilliseconds;

const offsetIn = (text: string): string => {
  const m = /([+-]\d{2}:\d{2})(?:\[|$)/.exec(text);
  return m ? m[1]! : "";
};

/**
 * The numbers behind the chart. Both axes measure minutes from the start of the
 * local day, at one scale, so an hour of wall clock and an hour of exact time
 * are the same width and a connector is vertical until the clock changes.
 * `null` when no row names a valid date, or the zone cannot start a day.
 */
export function chartLayout(
  state: TimetableState,
  lib: TimetableLib,
  facts?: readonly RowFacts[],
  memo: ChartMemo = newChartMemo(),
): ChartLayout | null {
  const date = trackDate(state, lib);
  if (date === null) return null;
  const zone = state.startTimeZone.trim();
  const dayKey = `${zone}|${date}`;
  let day = memo.day.get(dayKey);
  if (day === undefined) {
    day = null;
    try {
      const start = lib.resolveLocal(`${date}T00:00:00`, zone);
      const nextDate = Temporal.PlainDate.from(date)
        .add({ days: 1 })
        .toString();
      const end = lib.resolveLocal(`${nextDate}T00:00:00`, zone);
      if (start !== "" && end !== "") {
        day = { start, minutes: (instantMs(end) - instantMs(start)) / 60000 };
      }
    } catch {
      day = null;
    }
    memo.day.set(dayKey, day);
  }
  if (day === null) return null;
  const t0 = instantMs(day.start);
  const minuteOfInstant = (iso: string): number =>
    (instantMs(iso) - t0) / 60000;

  const duration = state.duration.trim();
  const tailKey = `${dayKey}|${duration}`;
  let tail = memo.tail.get(tailKey);
  if (tail === undefined) {
    const runEnd = lib.transitTime(day.start, duration);
    const run = runEnd === "" ? 60 : minuteOfInstant(runEnd);
    tail = Math.min(360, Math.max(60, Math.ceil(run / 60) * 60));
    memo.tail.set(tailKey, tail);
  }
  const domainMinutes = Math.max(1440, day.minutes) + tail;

  const bands = bandsFor(zone, date, lib, memo);
  const rows: ChartRow[] = [];
  const others: { n: number; date: string }[] = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const lane = laneState(state, i, date, lib);
    if (lane.state === "off") others.push({ n: i + 1, date: lane.date });
    if (lane.state !== "on") continue;
    const f = facts?.[i] ?? rowFacts(state, i, lib);
    const offset = state.rows[i]!.offset.trim();
    const arrival = f.result?.legTimes[0]?.arrival ?? null;
    const arrivalMinute = arrival ? minuteOfInstant(arrival) : null;
    rows.push({
      n: i + 1,
      printedMinute: lane.minute,
      kind: lane.kind,
      offset,
      leaves: f.leaves,
      localArrival: f.result?.legTimes[0]?.localArrival ?? null,
      instantMinute: f.leaves ? minuteOfInstant(f.leaves) : null,
      arrivalMinute,
      open: arrivalMinute !== null && arrivalMinute > domainMinutes,
      dashed: lane.kind === "skipped" && offset === "",
    });
  }

  const fans: ChartFan[] = bands.map((b) =>
    b.kind === "twice"
      ? {
          kind: "twice",
          wallStart: b.startMinute,
          wallEnd: b.endMinute,
          exact: [
            minuteOfInstant(
              lib.resolveLocal(b.startWall, zone, {
                disambiguation: "earlier",
              }),
            ),
            minuteOfInstant(b.instant),
            minuteOfInstant(lib.resolveLocal(b.endWall, zone)),
          ],
        }
      : {
          kind: "skipped",
          wallStart: b.startMinute,
          wallEnd: b.endMinute,
          exact: [minuteOfInstant(b.instant)],
        },
  );

  const segments: OffsetSegment[] = [];
  if (bands.length === 0) {
    const offset = offsetIn(lib.etaAtZone(day.start, zone));
    if (offset !== "") segments.push({ from: 0, to: domainMinutes, offset });
  } else {
    const ordered = [...bands].sort(
      (a, b) => instantMs(a.instant) - instantMs(b.instant),
    );
    let from = 0;
    let offset = ordered[0]!.offsetBefore;
    for (const b of ordered) {
      const at = minuteOfInstant(b.instant);
      segments.push({ from, to: at, offset });
      from = at;
      offset = b.offsetAfter;
    }
    segments.push({ from, to: domainMinutes, offset });
  }

  return {
    date,
    dayStart: day.start,
    startTimeZone: zone,
    timeZone: state.timeZone.trim(),
    dayMinutes: day.minutes,
    tail,
    domainMinutes,
    rows,
    others,
    bands,
    fans,
    segments,
  };
}

export interface ChartWindow {
  start: number;
  end: number;
}

/** Half an hour of room on each side of the marks, before the snap to whole hours. */
const WINDOW_MARGIN = 30;
/** The narrowest window: four hours. A lone journey still gets a scale to read,
 *  and the axis keeps at least four hour labels: the label on the window's last
 *  hour sits on the plot's edge and is hidden, so three hours would show three. */
const WINDOW_MIN_SPAN = 240;

/**
 * The stretch of the domain the chart shows: the marks the rows draw (each
 * row's printed time, exact departure and arrival), and every band those marks
 * reach, with half an hour of margin, snapped outward to whole hours and never
 * under four hours wide. A band the marks do not reach is left out, so a
 * clock change early in the day does not stretch the window for a journey at
 * noon; a band that does reach them is taken in whole, so its fan is not cut.
 */
export function chartWindow(layout: ChartLayout): ChartWindow {
  const marks: number[] = [];
  for (const r of layout.rows) {
    marks.push(r.printedMinute);
    if (r.instantMinute !== null) marks.push(r.instantMinute);
    if (r.arrivalMinute !== null) {
      marks.push(Math.min(r.arrivalMinute, layout.domainMinutes));
    }
  }
  if (marks.length === 0) return { start: 0, end: 360 };
  let lo = Math.min(...marks);
  let hi = Math.max(...marks);
  const rowsLo = lo;
  const rowsHi = hi;
  for (const f of layout.fans) {
    const span = [f.wallStart, f.wallEnd, ...f.exact];
    const from = Math.min(...span);
    const to = Math.max(...span);
    if (from <= rowsHi && to >= rowsLo) {
      lo = Math.min(lo, from);
      hi = Math.max(hi, to);
    }
  }
  let start = Math.max(0, Math.floor((lo - WINDOW_MARGIN) / 60) * 60);
  let end = Math.min(
    layout.domainMinutes,
    Math.ceil((hi + WINDOW_MARGIN) / 60) * 60,
  );
  if (end - start < WINDOW_MIN_SPAN) {
    end = Math.min(layout.domainMinutes, start + WINDOW_MIN_SPAN);
    start = Math.max(0, end - WINDOW_MIN_SPAN);
  }
  return { start, end };
}

/** The label on the exact axis at `minute`: the instant there in UTC. */
export function exactTickLabel(layout: ChartLayout, minute: number): string {
  const ms = instantMs(layout.dayStart) + minute * 60000;
  return `${Temporal.Instant.fromEpochMilliseconds(ms).toString().slice(11, 16)}Z`;
}

/** A minute's x in the window, as a percentage. */
export function windowPct(minute: number, win: ChartWindow): number {
  return ((minute - win.start) / (win.end - win.start)) * 100;
}

/** The chart's text alternative; the table below it is the data equivalent. */
export function chartSummary(layout: ChartLayout): string {
  const parts: string[] = [
    `Two clocks for ${layout.date} in ${layout.startTimeZone}.`,
  ];
  if (layout.bands.length === 0) parts.push("No clock change that day.");
  for (const b of layout.bands) {
    if (b.kind === "skipped" && b.startMinute === 0 && b.endMinute === 1440) {
      parts.push("This date never shows on the clock.");
    } else {
      parts.push(
        `${b.from} to ${b.to} ${b.kind === "twice" ? "happens twice" : "never shows on the clock"}.`,
      );
    }
  }
  const sentences: { n: number; text: string }[] = [];
  for (const o of layout.others) {
    sentences.push({
      n: o.n,
      text: `Row ${o.n} is on ${o.date} and is not drawn.`,
    });
  }
  for (const r of layout.rows) {
    const printed = hhmmOfMinute(r.printedMinute);
    let text: string;
    if (r.leaves === null) {
      text =
        r.offset === ""
          ? `Row ${r.n} prints ${printed} and names no instant.`
          : `Row ${r.n} prints ${printed} with offset ${r.offset} and names no instant.`;
    } else {
      const arriving = r.localArrival
        ? `, arriving ${r.localArrival}`
        : "; the run time gives no arrival";
      if (r.offset !== "") {
        text = `Row ${r.n} prints ${printed} with offset ${r.offset} and leaves at ${r.leaves}${arriving}.`;
      } else if (r.kind === "twice") {
        text = `Row ${r.n} prints ${printed}, which happens twice; it is read as the earlier pass and leaves at ${r.leaves}${arriving}.`;
      } else if (r.kind === "skipped") {
        text = `Row ${r.n} prints ${printed}, which never shows on the clock; it is read as the later instant and leaves at ${r.leaves}${arriving}.`;
      } else {
        text = `Row ${r.n} prints ${printed} and leaves at ${r.leaves}${arriving}.`;
      }
    }
    sentences.push({ n: r.n, text });
  }
  sentences.sort((a, b) => a.n - b.n);
  return [...parts, ...sentences.map((s) => s.text)].join(" ");
}

// ---------------------------------------------------------------------------
// Holding still: the shapes of the hidden sizers
// ---------------------------------------------------------------------------

/** The longest note a row can hold, computed so it cannot drift from
 *  `rowBadge`. */
export const LONGEST_BADGE: string = [
  rowBadge("twice", false),
  rowBadge("twice", true),
  rowBadge("skipped", false),
].reduce<string>((a, b) => (b !== null && b.length > a.length ? b : a), "");

/**
 * Where a journey row's arrival chip goes: right of the bar's end (`start`),
 * left of the bar's start (`end`), or, when neither side is wholly inside the
 * track, flush with the track's far edge (`clamp`) so it never reaches the row
 * number in the gutter. Each side is checked against the edge it is drawn from:
 * the left side is measured from the bar's START, not its end. Drawing only.
 */
export function arrivalChipPlacement(o: {
  startPx: number;
  endPx: number;
  labelPx: number;
  trackPx: number;
  offsetPx: number;
}): { side: "start" | "end" | "clamp"; leftPx: number } {
  const right = o.endPx + o.offsetPx;
  if (right + o.labelPx <= o.trackPx + 0.5) {
    return { side: "start", leftPx: o.endPx };
  }
  const leftEdge = o.startPx - o.offsetPx - o.labelPx;
  if (leftEdge >= -0.5) return { side: "end", leftPx: o.startPx };
  return { side: "clamp", leftPx: Math.max(0, o.trackPx - o.labelPx) };
}

/** A zoned string split at its only break points: immediately before the
 *  bracketed zone, and inside the zone id after each `/`. The date, the time and
 *  the written offset are one unbreakable part (a value that breaks as
 *  `2024-11-` / `03T00:30:00` cannot be read). */
export function zonedParts(text: string): string[] {
  const m = /^(.*?)([+-]\d{2}:\d{2})?(\[[^\]]*\])?$/.exec(text);
  if (!m) return [text];
  const [, base, offset, bracket] = m;
  const parts: string[] = [];
  if (base || offset) parts.push(`${base ?? ""}${offset ?? ""}`);
  if (bracket) parts.push(...bracket.split(/(?<=\/)/));
  return parts;
}

/**
 * The shapes a cell can hold, for the hidden sizer that keeps its size. A shape
 * is a placeholder for layout: the same character counts and the same break
 * points as a real value, so it wraps the same way. It assumes a four-digit
 * year. It is never a value, and nothing shows it.
 */
export const shapeOf = {
  /** The note slot: the longest badge. */
  note: (): string => LONGEST_BADGE,
  /** A time cell for `zone`: the short form, and the full value's parts. */
  time: (zone: string): { short: string; parts: string[] } => ({
    short: "00:00 +00:00",
    parts: zonedParts(`0000-00-00T00:00:00+00:00[${zone}]`),
  }),
  /** The `<output>` text for a one-leg result arriving in `timeZone`. */
  output: (timeZone: string): string => {
    const local = `0000-00-00T00:00:00+00:00[${timeZone}]`;
    return formatSchedule({
      eta: local,
      legTimes: [
        {
          arrival: "0000-00-00T00:00:00Z",
          localArrival: local,
          dwellAfter: "PT0S",
        },
      ],
    } as DeliverySchedule);
  },
};
