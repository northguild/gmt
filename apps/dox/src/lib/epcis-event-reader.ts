/**
 * Pure helpers for the EPCIS Event Reader (INT-14): the two required time
 * fields of a GS1 EPCIS 2.0 event, `eventTime` and `eventTimeZoneOffset`.
 *
 * The tool calls `parseEpcisEvent` with the two fields as the reader typed them.
 * A result is an instant, the offset in force where the event happened and the
 * local clock there. The tool then compares the UTC date with the local date
 * (`convertUtcToPlainDate`, `chopTime`, `areDatesEqual`, `isAfterDate`) and
 * writes the result back with `formatEpcisEvent`. Every call printed, and every
 * result beside it, is a real `EpcisLib` call. The site-side code only builds
 * the event object, places the marks of the two day rails and words the verdicts.
 *
 * No DOM and no gmt import: the library comes in from the mount. The polyfill is
 * imported for drawing only (where the day rails put a midnight).
 *
 * Why `NO SIGNAL` is decided by the library, not by this file: whether a field
 * is readable comes from `isValidEpcisTimeZoneOffset` and `isValidEpcisEventTime`.
 * This file holds no pattern of its own.
 *
 * Naming rule: strings here name the standard as data (GS1 EPCIS 2.0,
 * ISO/IEC 19987, the DCSA field `shippedOnBoardDate`) and nothing else: no law,
 * no rule-making body, no carrier. Nothing maps a place or an offset to a zone.
 */
import { Temporal } from "@js-temporal/polyfill";
import type { PicField, PicHalf } from "./edi-picture";
import { callArgs, formatValue, runCall, type EdiCall } from "./edi-widgets";
import type { EpcisLib } from "./edi-lib";

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State and seeds
// ---------------------------------------------------------------------------

/** The longest `eventTime` and `eventTimeZoneOffset` a control takes. */
export const EVENT_TIME_MAX = 64;
export const OFFSET_MAX = 16;

/** What a chat call or a permalink hands over: both values as the reader gave them. */
export interface EpcisEventReaderArgs {
  eventTime?: string;
  eventTimeZoneOffset?: string;
}

/** What the DOM holds: two strings. */
export interface EpcisState {
  eventTime: string;
  eventTimeZoneOffset: string;
}

/** The event object the library is called with. A blank offset leaves the member out. */
interface EpcisEvent {
  eventTime: string;
  eventTimeZoneOffset?: string;
}

/** Whether the args name anything, so the widget opens on them and not on a preset. */
export function isSeeded(args: EpcisEventReaderArgs): boolean {
  return args.eventTime !== undefined || args.eventTimeZoneOffset !== undefined;
}

/**
 * Seed arguments as control values. A string is kept as given; anything else is
 * blank, and an absent key stays blank: the offset is never filled in, and
 * nothing falls back to a preset.
 */
export function readArgs(args: EpcisEventReaderArgs): EpcisState {
  const text = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    eventTime: text(args.eventTime),
    eventTimeZoneOffset: text(args.eventTimeZoneOffset),
  };
}

/** Strings only, and only the non-blank fields: a blank offset has no key. */
export function permalinkOf(state: EpcisState): Record<string, string> {
  const out: Record<string, string> = {};
  const time = state.eventTime.trim();
  const offset = state.eventTimeZoneOffset.trim();
  if (time !== "") out["eventTime"] = time;
  if (offset !== "") out["eventTimeZoneOffset"] = offset;
  return out;
}

/**
 * Whether nothing was typed into either field, so no call is made and the
 * widget shows its empty state. Anything typed in either field is partial input,
 * and the library answers it with its sentinel: a time with no offset, or an
 * offset with no time, is `NO SIGNAL` with its reason.
 */
export function epcisBlank(state: EpcisState): boolean {
  return (
    state.eventTime.trim() === "" && state.eventTimeZoneOffset.trim() === ""
  );
}

/** The object `parseEpcisEvent` is called with: the trimmed fields, and a blank
 *  offset left out. */
export function eventOf(state: EpcisState): EpcisEvent {
  const offset = state.eventTimeZoneOffset.trim();
  return offset === ""
    ? { eventTime: state.eventTime.trim() }
    : { eventTime: state.eventTime.trim(), eventTimeZoneOffset: offset };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface EpcisPreset {
  id: string;
  label: string;
  description: string;
  eventTime: string;
  eventTimeZoneOffset: string;
}

/**
 * Eight examples, each from the JSDoc of `parseEpcisEvent` or `formatEpcisEvent`:
 * three that return a result and five the library refuses. A preset is an
 * example; a value is never filled in from one.
 */
export const EPCIS_PRESETS: readonly EpcisPreset[] = [
  {
    id: "next-day",
    label: "Next day on the local clock",
    description:
      "The event happened late in the evening in UTC. At +02:00 it is already the next day, so the local date is one day after the UTC date.",
    eventTime: "2024-06-15T23:30:00Z",
    eventTimeZoneOffset: "+02:00",
  },
  {
    id: "offsets-disagree",
    label: "Two offsets that disagree",
    description:
      "The time carries +02:00 and the offset field says -05:00. They need not agree: the time fixes the instant, and the offset field sets the local clock.",
    eventTime: "2024-06-15T10:00:00+02:00",
    eventTimeZoneOffset: "-05:00",
  },
  {
    id: "minus-zero",
    label: "-00:00 comes back as +00:00",
    description:
      "The pattern accepts -00:00. The library reads it as an offset of zero and writes it as +00:00.",
    eventTime: "2024-06-15T14:30:00Z",
    eventTimeZoneOffset: "-00:00",
  },
  {
    id: "no-offset",
    label: "No offset field",
    description:
      "The offset field is required and the library does not assume UTC. A time with no offset gives no result.",
    eventTime: "2024-06-15T14:30:00Z",
    eventTimeZoneOffset: "",
  },
  {
    id: "z-as-offset",
    label: "Z as the offset",
    description:
      "Z is a designator for UTC in a time. It is not an offset in the offset field, which takes ±HH:MM.",
    eventTime: "2024-06-15T14:30:00Z",
    eventTimeZoneOffset: "Z",
  },
  {
    id: "no-colon",
    label: "Offset without a colon",
    description:
      "+0200 has no colon. The offset field takes ±HH:MM, so the library does not read it.",
    eventTime: "2024-06-15T14:30:00Z",
    eventTimeZoneOffset: "+0200",
  },
  {
    id: "no-seconds",
    label: "Time without seconds",
    description:
      "Seconds are required in an eventTime. 14:30 alone is not read.",
    eventTime: "2024-06-15T14:30Z",
    eventTimeZoneOffset: "+02:00",
  },
  {
    id: "february-30",
    label: "30 February",
    description:
      "Both fields have the right shape, but 30 February is not a date. The library does not read it.",
    eventTime: "2024-02-30T14:30:00Z",
    eventTimeZoneOffset: "+02:00",
  },
];

export function presetState(preset: EpcisPreset): EpcisState {
  return {
    eventTime: preset.eventTime,
    eventTimeZoneOffset: preset.eventTimeZoneOffset,
  };
}

/** The preset whose two fields equal the state's (trimmed), else custom. */
export function matchPreset(state: EpcisState): string {
  const time = state.eventTime.trim();
  const offset = state.eventTimeZoneOffset.trim();
  const hit = EPCIS_PRESETS.find(
    (p) => p.eventTime === time && p.eventTimeZoneOffset === offset,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** What `parseEpcisEvent` returns. */
interface EpcisResult {
  instant: string;
  offset: string;
  local: string;
}

/** What `formatEpcisEvent` returns. */
interface EpcisWritten {
  eventTime: string;
  eventTimeZoneOffset: string;
}

type Sameness = "same" | "next" | "before";

/** The two dates and the words that compare them. */
interface DateRead {
  /** The UTC date, `""` when the library returned none. */
  utcDate: string;
  /** The date on the local clock, `""` when the library returned none. */
  localDate: string;
  /** `null` when either date is missing, so no comparison was made. */
  sameness: Sameness | null;
  /** Every call made: the two dates, then the two comparisons. */
  calls: EdiCall[];
}

export interface EpcisRead {
  blank: boolean;
  /** The object sent to the library, `null` for a blank form. */
  event: EpcisEvent | null;
  /** The `parseEpcisEvent` call, `null` for a blank form. */
  parse: EdiCall | null;
  result: EpcisResult | null;
  /** The dates, `null` when there is no result. */
  dates: DateRead | null;
}

/** The result of a parse call, or `null` when the library returned its sentinel. */
function resultOf(call: EdiCall): EpcisResult | null {
  const r = call.result as EpcisResult | null | undefined;
  return r === null || r === undefined ? null : r;
}

/**
 * Reads the event: `parseEpcisEvent` with the two fields, and with a result the
 * four date calls. `areDatesEqual` and `isAfterDate` are called only when both
 * dates came back. A blank form makes no call.
 */
export function readEpcis(state: EpcisState, lib: EpcisLib): EpcisRead {
  if (epcisBlank(state)) {
    return { blank: true, event: null, parse: null, result: null, dates: null };
  }
  const event = eventOf(state);
  const parse = runCall(lib, "parseEpcisEvent", event);
  const result = resultOf(parse);
  if (result === null) {
    return { blank: false, event, parse, result: null, dates: null };
  }
  const utc = runCall(lib, "convertUtcToPlainDate", result.instant);
  const local = runCall(lib, "chopTime", result.local);
  const utcDate = utc.result as string;
  const localDate = local.result as string;
  const calls: EdiCall[] = [utc, local];
  let sameness: Sameness | null = null;
  if (utcDate !== "" && localDate !== "") {
    const equal = runCall(lib, "areDatesEqual", utcDate, localDate);
    const after = runCall(lib, "isAfterDate", localDate, utcDate);
    calls.push(equal, after);
    sameness =
      equal.result === true
        ? "same"
        : after.result === true
          ? "next"
          : "before";
  }
  return {
    blank: false,
    event,
    parse,
    result,
    dates: { utcDate, localDate, sameness, calls },
  };
}

// ---------------------------------------------------------------------------
// Why NO SIGNAL
// ---------------------------------------------------------------------------

export const NULL_TEXT = {
  noOffset:
    "The offset is missing. An EPCIS event needs eventTimeZoneOffset as well as eventTime, and the library does not assume UTC.",
  badOffset:
    "The library does not read this offset. eventTimeZoneOffset is ±HH:MM from -14:00 to +14:00. Z, +0200 and +02 are not offsets in this field.",
  noTime:
    "The time is missing. An EPCIS event needs eventTime as well as eventTimeZoneOffset.",
  badDate:
    "The library does not read the date in this eventTime. It must be a real date written YYYY-MM-DD, and 30 February is not one.",
  badTime:
    "The library does not read this eventTime. It needs seconds, an optional fraction of up to nine digits, then Z or an offset such as +02:00.",
  other: "Both fields look right, but the library returned no result for them.",
} as const;

/** A time the library reads, used only to probe. */
const PROBE_DATE = "2000-01-01";

/**
 * One sentence for a read the library refused, decided by the library's two
 * validators and never by a pattern here. The offset comes first, as the library
 * requires both. To tell a refused date from a refused time, the validator is
 * asked again about the same text with a date it reads in front of the time.
 */
export function epcisNullText(state: EpcisState, lib: EpcisLib): string {
  const time = state.eventTime.trim();
  const offset = state.eventTimeZoneOffset.trim();
  if (offset === "") return NULL_TEXT.noOffset;
  if (!lib.isValidEpcisTimeZoneOffset(offset)) return NULL_TEXT.badOffset;
  if (time === "") return NULL_TEXT.noTime;
  if (!lib.isValidEpcisEventTime(time)) {
    return lib.isValidEpcisEventTime(PROBE_DATE + time.slice(PROBE_DATE.length))
      ? NULL_TEXT.badDate
      : NULL_TEXT.badTime;
  }
  return NULL_TEXT.other;
}

// ---------------------------------------------------------------------------
// What the event states
// ---------------------------------------------------------------------------

/** The verdict plate: whether the event states an offset. Empty when there is
 *  nothing to say: a blank form, or an offset the library refused. */
export function verdictText(read: EpcisRead, state: EpcisState): string {
  if (read.result !== null) return `Offset: stated (${read.result.offset})`;
  if (read.blank) return "";
  return state.eventTimeZoneOffset.trim() === "" ? "Offset: not stated" : "";
}

const DETAIL_Z =
  "eventTime ends in Z, so it fixes the instant. The local clock comes from eventTimeZoneOffset.";
const DETAIL_OWN =
  "eventTime carries an offset of its own. It fixes the instant only. The local clock comes from eventTimeZoneOffset.";

/** The line under the verdict, for a result. */
export function detailText(read: EpcisRead): string {
  if (read.result === null || read.event === null) return "";
  return read.event.eventTime.endsWith("Z") ? DETAIL_Z : DETAIL_OWN;
}

type MemberKey = "instant" | "offset" | "local";

export const MEMBER_ROWS: readonly {
  key: MemberKey;
  role: string;
  label: string;
}[] = [
  { key: "instant", role: "member-instant", label: "Instant" },
  { key: "offset", role: "member-offset", label: "Offset" },
  { key: "local", role: "member-local", label: "Local" },
];

/** A member of the result, `null` without one. */
export function memberText(read: EpcisRead, key: MemberKey): string | null {
  return read.result === null ? null : read.result[key];
}

export const DATE_ROWS: readonly {
  key: "utc" | "local";
  role: string;
  label: string;
}[] = [
  { key: "utc", role: "date-utc", label: "UTC date" },
  { key: "local", role: "date-local", label: "Local date" },
];

const WORDS: Record<Sameness, string> = {
  same: "The same date on both clocks.",
  next: "The local date is the next day.",
  before: "The local date is the day before.",
};

/** The sentence under the two dates, `""` without a comparison. */
export function datesWords(dates: DateRead | null): string {
  return dates === null || dates.sameness === null ? "" : WORDS[dates.sameness];
}

// ---------------------------------------------------------------------------
// The value taken apart
// ---------------------------------------------------------------------------

/** The most characters a refused field shows in its one box. The whole text is
 *  in the picture's spoken line. */
const REFUSED_BOX_CHARS = 24;

const field = (
  text: string,
  mask: string,
  group: PicField["group"],
  word: string,
): PicField => ({ text, mask, group, word });

/**
 * The fields of an `eventTime` the library's validator accepted, cut at fixed
 * positions: the date, `T` and the time, the fraction when there is one, and the
 * zone (`Z` or ±HH:MM). The cut is for drawing. The library reads the field
 * whole.
 */
export function cutEventTime(time: string): PicField[] {
  const date = time.slice(0, 10);
  const clock = time.slice(10, 19);
  const rest = time.slice(19);
  const zone = rest.endsWith("Z") ? "Z" : rest.slice(-6);
  const fraction = rest.slice(0, rest.length - zone.length);
  return [
    field(date, "YYYY-MM-DD", "date", "date"),
    field(clock, "Thh:mm:ss", "time", "time"),
    ...(fraction === ""
      ? []
      : [field(fraction, "fraction", "time", "fraction")]),
    field(zone, zone === "Z" ? "Z" : "±hh:mm", "offset", "offset"),
  ];
}

const shown = (text: string): string =>
  text.length > REFUSED_BOX_CHARS
    ? `${text.slice(0, REFUSED_BOX_CHARS - 1)}…`
    : text;

interface EpcisFigure {
  halves: PicHalf[];
  /** The picture's spoken line. */
  aria: string;
}

/**
 * Both fields taken apart. A field the validator accepted is cut and bracketed
 * in the date, time and offset groups. A refused field is one neutral box. A
 * field not sent is a ghost box that says so.
 */
export function epcisFigure(state: EpcisState, lib: EpcisLib): EpcisFigure {
  const time = state.eventTime.trim();
  const offset = state.eventTimeZoneOffset.trim();
  const timeFields: PicField[] =
    time === ""
      ? [field("not sent", "", "none", "not sent")]
      : lib.isValidEpcisEventTime(time)
        ? cutEventTime(time)
        : [field(shown(time), "", "neutral", "text the library does not read")];
  const offsetFields: PicField[] =
    offset === ""
      ? [field("not sent", "", "none", "not sent")]
      : lib.isValidEpcisTimeZoneOffset(offset)
        ? [field(offset, "±hh:mm", "offset", "offset")]
        : [
            field(
              shown(offset),
              "",
              "neutral",
              "text the library does not read",
            ),
          ];
  const halves: PicHalf[] = [
    { label: "eventTime", fields: timeFields },
    { label: "eventTimeZoneOffset", fields: offsetFields },
  ];
  const say = (name: string, raw: string, fields: PicField[]): string =>
    raw === ""
      ? `${name} not sent`
      : `${name} ${raw}: ${fields.map((f) => `${f.word} ${f.text}`).join(", ")}`;
  const aria =
    time !== "" && !lib.isValidEpcisEventTime(time)
      ? `eventTime ${time}: text the library does not read`
      : say("eventTime", time, timeFields);
  const ariaOffset =
    offset !== "" && !lib.isValidEpcisTimeZoneOffset(offset)
      ? `eventTimeZoneOffset ${offset}: text the library does not read`
      : say("eventTimeZoneOffset", offset, offsetFields);
  return { halves, aria: `${aria}; ${ariaOffset}` };
}

// ---------------------------------------------------------------------------
// Written back
// ---------------------------------------------------------------------------

interface WriteBack {
  call: EdiCall;
  /** `null` when the library returned its sentinel. */
  written: EpcisWritten | null;
  note: string;
}

const NOTE_OFFSET =
  "The offset came back with a plus sign: the library writes -00:00 as +00:00.";
const NOTE_TIME =
  "eventTime is written again as the instant in UTC, ending in Z, with no trailing zeros in a fraction.";
const NOTE_YEAR =
  "eventTime has a four-digit year, and this instant is outside years 0000 to 9999, so it cannot be written back.";
const NOTE_NONE = "The library returned no result when writing this back.";

/**
 * `formatEpcisEvent` with the result as it came back. `null` when there is no
 * result to write. The note says what changed from what was typed.
 */
export function writeBack(read: EpcisRead, lib: EpcisLib): WriteBack | null {
  if (read.result === null || read.event === null) return null;
  const call = runCall(lib, "formatEpcisEvent", read.result);
  const written = (call.result ?? null) as EpcisWritten | null;
  if (written === null) {
    const edge =
      read.result.instant.startsWith("+") ||
      read.result.instant.startsWith("-");
    return { call, written: null, note: edge ? NOTE_YEAR : NOTE_NONE };
  }
  const notes: string[] = [];
  if (written.eventTimeZoneOffset !== read.event.eventTimeZoneOffset) {
    notes.push(NOTE_OFFSET);
  }
  if (written.eventTime !== read.event.eventTime) notes.push(NOTE_TIME);
  return { call, written, note: notes.join(" ") };
}

// ---------------------------------------------------------------------------
// The hand-off to the B/L Date Stamp
// ---------------------------------------------------------------------------

export const HANDOFF_LABEL =
  "Read this moment as a shipped on board date in the B/L Date Stamp";

/**
 * The B/L Date Stamp's seed for this moment: the instant, the event the link
 * picks, and the offset as its place. `null` without a result.
 */
export function handoffArgs(read: EpcisRead): Record<string, string> | null {
  if (read.result === null) return null;
  return {
    value: read.result.instant,
    event: "shippedOnBoard",
    timeZone: read.result.offset,
  };
}

// ---------------------------------------------------------------------------
// The two day rails: drawing only
// ---------------------------------------------------------------------------

/** The window each rail draws, either side of the instant. */
export const RAIL_HALF_HOURS = 36;

const HOUR_MS = 3_600_000;

/** One day on a rail, as a span of the rail in percent. */
interface RailDay {
  from: number;
  to: number;
  /** Whether the instant falls in this day. */
  lit: boolean;
  /** The day's date, from the drawing. Tests compare it with the library's. */
  date: string;
}

export interface RailLayout {
  days: RailDay[];
  /** Each of the rail's own midnights inside the window, in percent. */
  ticks: number[];
}

interface Rails {
  /** Where the pin sits, in percent: the instant is the window's centre. */
  pin: number;
  utc: RailLayout;
  local: RailLayout;
}

const percent = (value: number, from: number, to: number): number =>
  Math.min(100, Math.max(0, ((value - from) / (to - from)) * 100));

function railOf(instant: Temporal.Instant, zone: string): RailLayout {
  const centre = instant.epochMilliseconds;
  const from = centre - RAIL_HALF_HOURS * HOUR_MS;
  const to = centre + RAIL_HALF_HOURS * HOUR_MS;
  const first = instant.toZonedDateTimeISO(zone).startOfDay();
  const days: RailDay[] = [];
  const ticks: number[] = [];
  for (let k = -2; k <= 3; k++) {
    const start = first.add({ days: k });
    const end = start.add({ days: 1 });
    const s = start.epochMilliseconds;
    const e = end.epochMilliseconds;
    if (e <= from || s >= to) continue;
    days.push({
      from: percent(s, from, to),
      to: percent(e, from, to),
      lit: s <= centre && centre < e,
      date: start.toPlainDate().toString(),
    });
    if (s > from && s < to) ticks.push(percent(s, from, to));
  }
  return { days, ticks };
}

/** The two rails for a result: UTC, and the clock at the result's offset. The
 *  positions are drawing. Every date and word on screen is the library's. */
export function railsOf(result: { instant: string; offset: string }): Rails {
  const instant = Temporal.Instant.from(result.instant);
  return {
    pin: 50,
    utc: railOf(instant, "UTC"),
    local: railOf(instant, result.offset),
  };
}

export type RailRole = "utc" | "local";

/** What a rail says when the library read the event but returned no date. */
const RAIL_NO_DATE = "No date from the library, so there is no day to mark.";

/** The sentence under `NO SIGNAL` when the library returned no date. */
export const DATES_NULL_TEXT = "The library returned no date for this instant.";

/** What a rail says when there is nothing to draw. */
export function railEmptyText(
  role: RailRole,
  read: EpcisRead,
  state: EpcisState,
): string {
  if (read.blank) return "Nothing to place yet.";
  if (role === "local" && state.eventTimeZoneOffset.trim() === "") {
    return "Not stated: the offset is missing, so the local clock is unknown.";
  }
  if (read.result !== null) return RAIL_NO_DATE;
  return role === "utc"
    ? "No instant to place: the library read no result."
    : "No local clock: the library read no result.";
}

/** A rail's name, which is the clock it draws. */
export function railName(role: RailRole, result: EpcisResult | null): string {
  if (role === "utc") return "UTC";
  return result === null ? "Local clock" : `Local clock ${result.offset}`;
}

/** What a rail is for a screen reader. */
export function railAria(
  role: RailRole,
  result: EpcisResult | null,
  date: string,
  emptyText: string,
): string {
  const name = railName(role, result);
  return result === null || date === ""
    ? `${name}: ${emptyText}`
    : `${name}: the event falls on ${date}.`;
}

export interface RailSpec {
  role: RailRole;
  name: string;
  /** The library's date for this clock, or the words for none. */
  date: string;
  layout: RailLayout | null;
  pin: number;
  emptyText: string;
  aria: string;
}

/**
 * Which side of its hairline a midnight's label sits. The label goes on the
 * left past 70 percent, so it stays inside the track, and between 32 and 50
 * percent, so it never runs into the pin at 50. A label is about 16 percent of
 * the narrowest rail (36px of 220px), so from 32 percent it fits on the left.
 */
export function tickLabelEnd(at: number): boolean {
  return at > 70 || (at > 32 && at < 50);
}

// ---------------------------------------------------------------------------
// Every text a region can show, for the height the widget reserves
// ---------------------------------------------------------------------------

/**
 * The widest result the tool can show, built from literal fields and not read
 * from the library: a nine-digit fraction on an instant that sits just past
 * year 9999. `eventTime` `9999-12-31T23:30:00.123456789-05:00` at `+14:00` is
 * this instant, so it is a result the library returns. It is 33 characters
 * wide, three more than the widest 30-character instant of a four-digit year.
 */
export const WIDEST_EVENT: Required<EpcisEvent> = {
  eventTime: "9999-12-31T23:30:00.123456789-05:00",
  eventTimeZoneOffset: "+14:00",
};

export const WIDEST_RESULT: EpcisResult = {
  instant: "+010000-01-01T04:30:00.123456789Z",
  offset: "+14:00",
  local: "+010000-01-01T18:30:00.123456789",
};

const WIDEST_WRITTEN: EpcisWritten = {
  eventTime: "2024-06-15T08:00:00.123456789Z",
  eventTimeZoneOffset: "+14:00",
};

const callText = (fn: string, ...args: unknown[]): string =>
  `${fn}(${callArgs(args)[1]})`;

/** The texts each EPCIS Event Reader region can show. The text functions above
 *  run over a result of each shape; nothing here calls the library. */
export function epcisTexts() {
  const read = (result: EpcisResult | null): EpcisRead => ({
    blank: false,
    event: WIDEST_EVENT,
    parse: null,
    result,
    dates: null,
  });
  const dateCalls = [
    callText("convertUtcToPlainDate", WIDEST_RESULT.instant),
    callText("chopTime", WIDEST_RESULT.local),
    callText("areDatesEqual", "+010000-01-01", "+010000-01-01"),
    callText("isAfterDate", "+010000-01-01", "+010000-01-01"),
  ];
  return {
    descriptions: EPCIS_PRESETS.map((p) => p.description),
    details: [DETAIL_Z, DETAIL_OWN],
    verdicts: [
      "Offset: not stated",
      verdictText(read(WIDEST_RESULT), {
        eventTime: "",
        eventTimeZoneOffset: "",
      }),
    ],
    nulls: Object.values(NULL_TEXT) as string[],
    words: Object.values(WORDS),
    writeNotes: [
      NOTE_OFFSET,
      NOTE_TIME,
      `${NOTE_OFFSET} ${NOTE_TIME}`,
      NOTE_YEAR,
      NOTE_NONE,
    ],
    railEmpty: [
      "Nothing to place yet.",
      "Not stated: the offset is missing, so the local clock is unknown.",
      "No instant to place: the library read no result.",
      "No local clock: the library read no result.",
      RAIL_NO_DATE,
    ],
    datesNull: DATES_NULL_TEXT,
    parseCall: callText("parseEpcisEvent", WIDEST_EVENT),
    parseOutput: formatValue(WIDEST_RESULT),
    dateCalls: dateCalls.join("\n"),
    dateOutput: [
      formatValue("+010000-01-01"),
      formatValue("+010000-01-01"),
      formatValue(false),
      formatValue(false),
    ].join("\n"),
    formatCall: callText("formatEpcisEvent", WIDEST_RESULT),
    formatOutput: formatValue(WIDEST_WRITTEN),
  };
}
