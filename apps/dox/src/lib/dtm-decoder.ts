/**
 * Pure helpers for the DTM Decoder (INT-15): a pasted UN/EDIFACT `DTM` segment,
 * or a value and its data element 2379 format code, read by `parseEdifactDtm`.
 *
 * The tool never interprets the function qualifier (data element 2005): it is
 * shown as sent. Every decoded member, instant, offset in force, written-back
 * value and gap duration is a real `EdiLib` call; the site-side code splits the
 * pasted segment (`splitDtm`), builds the string a formatter takes from the
 * members a parser returned (`isoOf`), and formats a returned duration.
 *
 * No DOM and no gmt import: the library comes in from the mount.
 *
 * Naming rule: strings here name codes and standards as data (UN/EDIFACT 2379
 * and 2380, the UN/EDIFACT syntax rules, UN/ECE Recommendation 7) and nothing
 * else: no law, no rule-making body, no carrier or partner. Nothing maps a
 * place or an abbreviation to a zone.
 */

import {
  figureTail,
  isoNote,
  LONGEST_ZONE,
  isoOf,
  needsYearWindow,
  resolveInZone,
  yearWindowOptions,
  yearWindowNote,
  type EdiLib,
  type EdiResult,
} from "./edi-widgets";
import {
  figureAria,
  picHalves,
  plainHalves,
  type PicHalf,
  type PicPart,
} from "./edi-picture";
import { cutValue, shapeOf } from "./edi-shape";

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State, args and the segment splitter
// ---------------------------------------------------------------------------

/** What a chat call or a permalink hands over. */
export interface DtmDecoderArgs {
  input?: string;
  format?: string;
  yearWindow?: string | number;
  zone1?: string;
  zone2?: string;
  zone3?: string;
  zone4?: string;
}

/** What the DOM holds: all strings. `yearWindow` is `""`, `"rolling"` or a
 *  year as text. */
export interface DtmState {
  input: string;
  format: string;
  yearWindow: string;
  zones: [string, string, string, string];
}

export type DtmSplit =
  | {
      kind: "segment";
      qualifier: string;
      value: string;
      format: string;
      extra: boolean;
    }
  | { kind: "value"; value: string };

/**
 * The site-side segment splitter. It applies the UN/EDIFACT default service
 * characters `:+.? '` (the UN/EDIFACT syntax rules, UNTDID Part 4, Chapter
 * 2.2): component separator `:`, data element separator `+`, decimal mark `.`,
 * release character `?`, a reserved space and segment terminator `'`. A custom `UNA` service string is not read.
 *
 * Only a string that starts with `DTM+` (exact case) is a segment. Anything else
 * is a bare value and is passed on unchanged: a `?` left in it is the caller's
 * mistake, for the library to refuse.
 */
export function splitDtm(raw: string): DtmSplit {
  const input = raw.trim();
  if (!input.startsWith("DTM+")) return { kind: "value", value: input };

  const elements: string[][] = [[]];
  let buffer = "";
  let rest = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === "?") {
      // Release: the next character is a literal. A `?` at the very end stays.
      if (i + 1 < input.length) {
        buffer += input[i + 1];
        i++;
      } else {
        buffer += "?";
      }
    } else if (c === "'") {
      rest = input.slice(i + 1);
      break;
    } else if (c === "+") {
      elements[elements.length - 1]!.push(buffer);
      elements.push([]);
      buffer = "";
    } else if (c === ":") {
      elements[elements.length - 1]!.push(buffer);
      buffer = "";
    } else {
      buffer += c;
    }
  }
  elements[elements.length - 1]!.push(buffer);

  const composite = elements[1] ?? [];
  return {
    kind: "segment",
    qualifier: composite[0] ?? "",
    value: composite[1] ?? "",
    format: composite[2] ?? "",
    extra:
      composite.length > 3 || elements.length > 2 || rest.trim() !== "",
  };
}

/**
 * Whether nothing was typed into the segment-or-value field or the format code,
 * so no call is made and the widget shows its empty state. Anything typed in
 * either is partial input, and the library answers it: a value with no format
 * code, or a format code with no value, is the library's sentinel with its
 * reason (`no-format`, `blank-value`). The same rule as the X12 Time Reader's
 * `mainBlank` and `dtpBlank`: only an untouched form is "nothing to read".
 */
export function dtmBlank(state: DtmState): boolean {
  return state.input.trim() === "" && state.format.trim() === "";
}

/** The value and format the library is called with. In segment form both come
 *  from the segment and `state.format` is ignored. */
export function effective(state: DtmState): {
  value: string;
  format: string;
  split: DtmSplit;
} {
  const split = splitDtm(state.input);
  if (split.kind === "segment") {
    return { value: split.value, format: split.format, split };
  }
  return { value: split.value, format: state.format.trim(), split };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface DtmPreset {
  id: string;
  label: string;
  description: string;
  input: string;
  format: string;
  yearWindow: string;
  zones: [string, string, string, string];
}

const NO_ZONES: [string, string, string, string] = ["", "", "", ""];

/** Labels name what the format code shows. None implies a meaning for the
 *  function qualifier, which the tool never interprets. */
export const DTM_PRESETS: readonly DtmPreset[] = [
  {
    id: "local-203",
    label: "203: local time, no offset",
    description:
      "A local time at a place the value does not name. The strip reads it in four example zones; none is the answer until you know where the sender's clock was. Change them.",
    input: "DTM+137:202406151430:203'",
    format: "",
    yearWindow: "",
    zones: [
      "America/New_York",
      "Europe/Berlin",
      "Asia/Shanghai",
      "America/Los_Angeles",
    ],
  },
  {
    id: "released-303",
    label: "303 with ?+00: offset stated",
    description:
      "The release character ? guards the +, so the element value is 202406151430+00. A signed hour is an offset, and the value names one instant.",
    input: "DTM+137:202406151430?+00:303'",
    format: "",
    yearWindow: "",
    zones: NO_ZONES,
  },
  {
    id: "utc-303",
    label: "303 with UTC: offset stated",
    description:
      "The three characters UTC are read as an offset of +00:00, so the value names one instant. The formatter writes that offset as +00 and never as UTC. Any other three upper-case letters, such as CET, are zone text.",
    input: "DTM+137:202406151430UTC:303'",
    format: "",
    yearWindow: "",
    zones: NO_ZONES,
  },
  {
    id: "gmt-303",
    label: "303 with GMT: offset stated",
    description:
      "GMT is read as an offset of +00:00, like UTC: UN/ECE Recommendation 7 calls UTC formerly known as Greenwich Mean Time. The value names one instant. The formatter writes +00 and never GMT.",
    input: "DTM+137:202406151430GMT:303'",
    format: "",
    yearWindow: "",
    zones: NO_ZONES,
  },
  {
    id: "cet-303",
    label: "303 with CET: zone text",
    description:
      "No UN/EDIFACT text defines CET as a zone, so the library returns it unread, with no offset. The four zones below are this example's picks, not a reading of CET: choosing the zone is your decision, not the value's. Change them.",
    input: "DTM+137:202406151430CET:303'",
    format: "",
    yearWindow: "",
    // The same four zones as the 203 example; none is derived from CET.
    zones: [
      "America/New_York",
      "Europe/Berlin",
      "Asia/Shanghai",
      "America/Los_Angeles",
    ],
  },
  {
    id: "offset-205",
    label: "205: a signed HHMM offset",
    description:
      "Code 205 ends in a signed HHMM offset from UTC, so the value names one instant and states the offset in force.",
    input: "DTM+137:202406151430?+0200:205'",
    format: "",
    yearWindow: "",
    zones: NO_ZONES,
  },
  {
    id: "offset-208",
    label: "208: seconds and an offset",
    description:
      "Code 208 ends in seconds and a signed HHMM offset from UTC. Use it to send seconds with an offset: the value names one instant and states the offset in force.",
    input: "DTM+137:20240615143045?+0200:208'",
    format: "",
    yearWindow: "",
    zones: NO_ZONES,
  },
  {
    id: "period-718",
    label: "718: a period, no hyphen",
    description:
      "A period is sent as two dates, one straight after the other, with no hyphen between them. The result holds the start and the end.",
    input: "2024061520240620",
    format: "718",
    yearWindow: "",
    zones: NO_ZONES,
  },
  {
    id: "two-digit-no-window",
    label: "101: two-digit year, no window",
    description:
      "Code 101 has a two-digit year, and no standard says which century it belongs to. With no window the library returns the sentinel. A two-digit year is a legacy form.",
    input: "240615",
    format: "101",
    yearWindow: "",
    zones: NO_ZONES,
  },
  {
    id: "two-digit-window",
    label: "101: two-digit year, window from 2000",
    description:
      "The same value with a window that starts in 2000, so 24 is read as 2024. A fixed window gives the same answer in any year.",
    input: "240615",
    format: "101",
    yearWindow: "2000",
    zones: NO_ZONES,
  },
];

const trimmed = (state: DtmState): DtmState => ({
  input: state.input.trim(),
  format: state.format.trim(),
  yearWindow: state.yearWindow.trim(),
  zones: state.zones.map((z) => z.trim()) as DtmState["zones"],
});

export function presetState(preset: DtmPreset): DtmState {
  return {
    input: preset.input,
    format: preset.format,
    yearWindow: preset.yearWindow,
    zones: [...preset.zones],
  };
}

/** The preset whose every field equals the state's (trimmed), else custom. */
export function matchPreset(state: DtmState): string {
  const s = trimmed(state);
  const hit = DTM_PRESETS.find((p) => {
    const t = trimmed(presetState(p));
    return (
      t.input === s.input &&
      t.format === s.format &&
      t.yearWindow === s.yearWindow &&
      t.zones.every((z, i) => z === s.zones[i])
    );
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The state a chat call or a permalink seeds: seeded when `args.input` is
 * defined. A string is kept as typed; a numeric `yearWindow` becomes its text;
 * an absent key is blank. Nothing falls back to a preset.
 */
export function readArgs(args: DtmDecoderArgs): DtmState {
  const text = (v: unknown): string =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  return {
    input: text(args.input),
    format: text(args.format),
    yearWindow: text(args.yearWindow),
    zones: [
      text(args.zone1),
      text(args.zone2),
      text(args.zone3),
      text(args.zone4),
    ],
  };
}

/** Strings only, and only non-blank fields. `format` is carried in value form
 *  only: a segment holds its own. */
export function permalinkOf(state: DtmState): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, value: string): void => {
    const v = value.trim();
    if (v !== "") out[key] = v;
  };
  put("input", state.input);
  if (splitDtm(state.input).kind === "value") put("format", state.format);
  put("yearWindow", state.yearWindow);
  state.zones.forEach((z, i) => put(`zone${i + 1}`, z));
  return out;
}

// ---------------------------------------------------------------------------
// What the value states
// ---------------------------------------------------------------------------

export type OffsetVerdict = "stated" | "zone-text" | "not-stated";

export function offsetVerdict(result: EdiResult): OffsetVerdict {
  if (result.offset !== undefined) return "stated";
  if (result.zone !== undefined) return "zone-text";
  return "not-stated";
}

/** The verdict plate's words. */
export function verdictText(result: EdiResult): string {
  switch (offsetVerdict(result)) {
    case "stated":
      return `Offset: stated (${result.offset})`;
    case "zone-text":
      return `Offset: not stated. "${result.zone}" is zone text, not an offset.`;
    default:
      return "Offset: not stated";
  }
}

/** One line under the verdict, by what the result holds. */
export function detailText(result: EdiResult): string {
  if (result.zone !== undefined) {
    return "No UN/EDIFACT text defines these three characters, so the library returns them unread.";
  }
  if (result.periodEnd !== undefined) {
    return "A period: a start and an end. The code states no offset, so neither end names an instant.";
  }
  if (result.instant !== undefined && result.offset !== undefined) {
    return "The value names one instant.";
  }
  if (result.time !== undefined && result.offset !== undefined) {
    return "A time and an offset, but no date, so no instant.";
  }
  if (result.offset !== undefined) {
    return "The value is an offset and nothing else.";
  }
  if (result.local !== undefined) {
    return "A local time at a place the value does not name. It is not UTC.";
  }
  if (result.date !== undefined) {
    return "A date. A date alone names no instant in any zone.";
  }
  if (result.time !== undefined) {
    return "A time of day with no date and no offset.";
  }
  return "";
}

export type MemberKey =
  | "date"
  | "time"
  | "local"
  | "instant"
  | "offset"
  | "zone"
  | "periodEnd";

export const MEMBER_ROWS: readonly {
  key: MemberKey;
  role: string;
  label: string;
}[] = [
  { key: "date", role: "member-date", label: "Date" },
  { key: "time", role: "member-time", label: "Time" },
  { key: "local", role: "member-local", label: "Local date-time" },
  { key: "instant", role: "member-instant", label: "Instant" },
  { key: "offset", role: "member-offset", label: "Offset" },
  { key: "zone", role: "member-zone", label: "Zone text" },
  { key: "periodEnd", role: "member-period-end", label: "Period end" },
];

/** The member's text, or `null` when the result does not hold it. A period end
 *  shows its `local`, else its `date`, else its `time`. */
export function memberText(result: EdiResult, key: MemberKey): string | null {
  if (key === "periodEnd") {
    const end = result.periodEnd;
    if (end === undefined) return null;
    return end.local ?? end.date ?? end.time ?? null;
  }
  const v = result[key];
  return v === undefined ? null : String(v);
}

// ---------------------------------------------------------------------------
// The strip: an offsetless value read in the zones the reader chose
// ---------------------------------------------------------------------------

/** The strip applies to a local time with no instant and no period. */
export function stripApplies(result: EdiResult | null): boolean {
  return (
    result !== null &&
    result.local !== undefined &&
    result.instant === undefined &&
    result.periodEnd === undefined
  );
}

const STRIP_NOTE_APPLIES =
  'The value states no offset. Each zone below is a pick, from the example or from you, and not something the value says: the same digits, read there. Every row uses resolveLocal with disambiguation: "reject", so a time the clock shows twice or never is not resolved.';
const STRIP_NOTE_STATED =
  "The value states its offset, so there is nothing to choose.";
const STRIP_NOTE_ALONE =
  "A date or a time alone names no instant in any zone.";
const STRIP_NOTE_OFFSET =
  "An offset alone names no instant: it needs a date and a time.";
const STRIP_NOTE_PERIOD =
  "A period: each end is a local time. Resolve each with resolveLocal.";
const STRIP_NOTE_NONE = "No value.";

export function stripNote(result: EdiResult | null): string {
  if (result === null) return STRIP_NOTE_NONE;
  if (stripApplies(result)) return STRIP_NOTE_APPLIES;
  if (result.instant !== undefined) return STRIP_NOTE_STATED;
  if (result.periodEnd !== undefined && result.local !== undefined) {
    return STRIP_NOTE_PERIOD;
  }
  if (
    result.offset !== undefined &&
    result.date === undefined &&
    result.time === undefined
  ) {
    return STRIP_NOTE_OFFSET;
  }
  return STRIP_NOTE_ALONE;
}

/** The words the timeline shows when there is no instant to place: shorter than
 *  the note above it, and never an amber sentinel. */
export function timelineEmptyText(result: EdiResult | null): string {
  if (result === null) return "No value, so no instant to place.";
  if (result.periodEnd !== undefined) {
    return "A period is two local times, not one instant: nothing to place.";
  }
  if (
    result.offset !== undefined &&
    result.date === undefined &&
    result.time === undefined
  ) {
    return "An offset alone names no instant: nothing to place.";
  }
  return "A date or a time alone names no instant: nothing to place.";
}

export interface GapRow {
  zone: string;
  instant: string;
  offset: string;
  as205: string;
  /** Why `resolveLocal` returned `""`, else `""`. */
  reason: string;
}

/**
 * One row per zone slot. Each resolved row is `resolveLocal(local, zone,
 * { disambiguation: "reject" })`, then `toOffsetInstant(instant, zone).offset`,
 * then `formatEdifactDtm(fromOffsetInstant({ instant, offset }), "205")`. A blank
 * slot is `{ zone: "" }`; a refused time carries its reason.
 */
export function gapRows(
  local: string,
  zones: readonly string[],
  lib: EdiLib,
): GapRow[] {
  return zones.map((raw) => {
    const row = { ...resolveInZone(local, raw, lib), as205: "" };
    if (row.offset !== "") {
      row.as205 = lib.formatEdifactDtm(
        lib.fromOffsetInstant({ instant: row.instant, offset: row.offset }),
        "205",
      );
    }
    return row;
  });
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type DtmNullReason =
  | "blank-value"
  | "no-format"
  | "unsupported-format"
  | "needs-year-window"
  | "bad-year-window"
  | "released-character"
  | "bad-value";

export interface NullContext {
  format: string;
  form: "segment" | "value";
}

export const NULL_REASON_TEXT: Record<
  DtmNullReason,
  (context: NullContext) => string
> = {
  "blank-value": () => "Paste a DTM segment or a value.",
  "no-format": ({ form }) =>
    form === "segment"
      ? "A value means nothing without its 2379 format code. The segment carries none."
      : "A value means nothing without its 2379 format code. Type the code.",
  "unsupported-format": ({ format }) =>
    `${format} is not a format code the library reads. A partial value, a weekday period or a quantity is not a date, time or period, and an unsupported code is never guessed.`,
  "needs-year-window": ({ format }) =>
    `Code ${format} has a two-digit year. No standard says which century it belongs to, so choose a window: rolling, or a start year. A two-digit year is a legacy form: where a partner can send a four-digit code, ask for it.`,
  "bad-year-window": () =>
    "The window is rolling or a whole year from 0 to 9900.",
  "released-character": () =>
    "The value still carries the release character ?. +02 is transmitted as ?+02: paste the whole segment, or remove the ?.",
  "bad-value": () =>
    "The value does not fit this code, names a date or time that does not exist, is a period written with a hyphen (UN/EDIFACT sends none), or is a period whose end is before its start.",
};

export function nullReasonText(
  reason: DtmNullReason,
  state: DtmState,
): string {
  const { format, split } = effective(state);
  return NULL_REASON_TEXT[reason]({ format, form: split.kind });
}

/**
 * Why `parseEdifactDtm` returned `null` for this state, decided by probing the
 * library in a fixed order, never by a list of codes held here.
 */
export function explainNull(state: DtmState, lib: EdiLib): DtmNullReason {
  const { value, format, split } = effective(state);
  if (value === "") return "blank-value";
  if (format === "") return "no-format";
  if (!lib.isValidEdifactDtmFormat(format)) return "unsupported-format";
  if (needsYearWindow(lib.formatEdifactDtm, format)) {
    if (yearWindowOptions(state.yearWindow) === undefined) {
      return "needs-year-window";
    }
    if (lib.isValidEdifactDtm(value, format, { yearWindow: 2000 })) {
      return "bad-year-window";
    }
  }
  if (split.kind === "value" && value.includes("?")) {
    return "released-character";
  }
  return "bad-value";
}

/** Whether the effective format has a two-digit year, by probing the formatter. */
export function windowApplies(state: DtmState, lib: EdiLib): boolean {
  const { format } = effective(state);
  return format !== "" && needsYearWindow(lib.formatEdifactDtm, format);
}

/** The line under the split line when the year controls are off. */
export function windowOffNote(state: DtmState, lib: EdiLib): string {
  const { format } = effective(state);
  if (format === "" || windowApplies(state, lib)) return "";
  return lib.isValidEdifactDtmFormat(format)
    ? `Code ${format} carries a four-digit year. The window is not read.`
    : "";
}

/** The split line in section 1. */
export function splitText(state: DtmState): string {
  const { split } = effective(state);
  if (split.kind === "value") return "Read as a bare value.";
  const base = `Read as a segment: function qualifier ${split.qualifier === "" ? "(none)" : split.qualifier}, shown as sent and not interpreted; value ${split.value === "" ? "(none)" : split.value}; format code ${split.format === "" ? "(none)" : split.format}.`;
  return split.extra ? `${base} Text after the first composite is not read.` : base;
}

// ---------------------------------------------------------------------------
// Writing back
// ---------------------------------------------------------------------------

export interface WriteBack {
  /** The string handed to the formatter. */
  iso: string;
  /** The formatter's arguments. */
  args: unknown[];
  output: string;
  note: string;
}

/**
 * `formatEdifactDtm` of what the parser returned, with the same format and, for
 * a code that reads one, the same window. `null` when there is no value to
 * write: a null result, or nothing the formatter can take.
 */
export function writeBack(
  state: DtmState,
  result: EdiResult | null,
  lib: EdiLib,
): WriteBack | null {
  if (result === null) return null;
  const iso = isoOf(result, lib);
  if (iso === null) return null;
  const { value, format } = effective(state);
  const options = windowApplies(state, lib)
    ? yearWindowOptions(state.yearWindow)
    : undefined;
  const args: unknown[] =
    options === undefined ? [iso, format] : [iso, format, options];
  const output = lib.formatEdifactDtm(iso, format, options);

  const notes: string[] = [];
  const built = isoNote(result);
  if (built !== "") notes.push(built);
  if (output === "") {
    notes.push(
      result.zone !== undefined
        ? "A zone text has no offset to write. Resolve the local time in a zone first, then write it with its offset."
        : "formatEdifactDtm returned the sentinel for this value and code.",
    );
  } else {
    if (value.endsWith("UTC") || value.endsWith("GMT")) {
      notes.push(
        "formatEdifactDtm writes a zone as ±HH and never as UTC or GMT.",
      );
    }
    if (result.periodEnd !== undefined) {
      notes.push("A period is written without a hyphen.");
    }
    if (output.includes("+")) {
      notes.push(
        "This is the element value. In an interchange, + is sent as ?+.",
      );
    }
  }
  return { iso, args, output, note: notes.join(" ") };
}

// ---------------------------------------------------------------------------
// The picture: the segment's parts, and the value taken apart
// ---------------------------------------------------------------------------

/** A segment's three components as sent: the text between the service
 *  characters, with a release character still in it. */
export interface SegmentSpans {
  qualifier: string;
  value: string;
  format: string;
  /** Whether the segment ended with its terminator `'`. */
  closed: boolean;
}

/**
 * The raw text of each component of a pasted segment, before the release
 * character is taken out, so the picture shows what was sent. Splits on the same
 * service characters as `splitDtm`; `null` for anything that is not a `DTM+`
 * segment.
 */
export function segmentSpans(raw: string): SegmentSpans | null {
  const input = raw.trim();
  if (!input.startsWith("DTM+")) return null;
  const parts: string[] = [""];
  let closed = false;
  for (let i = 4; i < input.length; i++) {
    const c = input[i]!;
    if (c === "?" && i + 1 < input.length) {
      parts[parts.length - 1] += c + input[i + 1];
      i++;
    } else if (c === "'") {
      closed = true;
      break;
    } else if (c === ":") {
      parts.push("");
    } else if (c === "+") {
      // A second data element: the splitter reads only the first composite.
      break;
    } else {
      parts[parts.length - 1] += c;
    }
  }
  return {
    qualifier: parts[0] ?? "",
    value: parts[1] ?? "",
    format: parts[2] ?? "",
    closed,
  };
}

/** The parts row: the segment's tag, qualifier, value and code with the service
 *  characters as sent, or a bare value and its typed code. */
export function dtmParts(state: DtmState): PicPart[] {
  const spans = segmentSpans(state.input);
  if (spans !== null) {
    return [
      { text: "DTM", caption: "tag", after: "+", kind: "tag" },
      { text: spans.qualifier, caption: "qualifier", after: ":", kind: "plain" },
      { text: spans.value, caption: "value", after: ":", kind: "value" },
      {
        text: spans.format,
        caption: "format",
        after: spans.closed ? "'" : "",
        kind: "code",
      },
    ];
  }
  return [
    { text: state.input.trim(), caption: "value", after: ":", kind: "value" },
    { text: state.format.trim(), caption: "format", after: "", kind: "code" },
  ];
}

export interface DtmFigure {
  halves: PicHalf[];
  separator: string;
  /** `no offset` when the code carries none, else `""`. */
  closing: string;
  /** The picture's spoken line. */
  aria: string;
  /** Words under the picture: the window that read a two-digit year. */
  note: string;
}

/**
 * The value taken apart, from the shape the formatter's own output gives the
 * format code (`shapeOf`). A value the parser read is cut along the shape in the
 * groups' marks; a refused one, in neutral boxes. With no shape, or a value that
 * is not the shape's length, the characters sit in one neutral box.
 */
export function dtmFigure(
  state: DtmState,
  result: EdiResult | null,
  lib: EdiLib,
): DtmFigure {
  const { value, format, split } = effective(state);
  const shape = format === "" ? null : shapeOf(lib.formatEdifactDtm, format);
  const cut = shape === null ? null : cutValue(value, shape);
  const refused = result === null;
  const halves =
    cut === null || shape === null
      ? plainHalves(value)
      : picHalves(cut, refused);
  const hasOffset = shape?.start.some((f) => f.group === "offset") ?? true;
  const closing = !refused && cut !== null && !hasOffset ? "no offset" : "";
  const window = shape?.window === true && cut !== null;
  const read = result === null ? undefined : (result.date ?? result.local);
  const note = window
    ? yearWindowNote(state.yearWindow, read)
    : "";
  const tail = figureTail(closing, note);
  const lead =
    split.kind === "segment"
      ? `Segment with function qualifier ${split.qualifier}, shown as sent. `
      : "";
  return {
    halves,
    separator: shape?.separator ?? "",
    closing,
    aria: lead + figureAria(value, format, halves, tail),
    note,
  };
}

// ---------------------------------------------------------------------------
// Every text a region can show, for the height it reserves (`holdHtml`)
// ---------------------------------------------------------------------------

/** Results shaped like each kind `parseEdifactDtm` returns, to run the pure
 *  text functions over. They are never shown; only their texts are measured. */
const SHAPES: readonly EdiResult[] = [
  { local: "2024-06-15T14:30:00" },
  { local: "2024-06-15T14:30:00", zone: "CET" },
  { local: "2024-06-15T14:30:00", instant: "2024-06-15T12:30:00Z", offset: "+02:00" },
  { time: "14:30:00", offset: "+02:00" },
  { offset: "+02:00" },
  { date: "2024-06-15" },
  { time: "14:30:00" },
  {
    local: "2024-06-15T14:30:00",
    periodEnd: { local: "2024-06-20T16:00:00" },
  },
];

/** The longest segment sentence the split line can say, with a 64-character value. */
const LONGEST_SPLIT = splitText({
  input: `DTM+137:${"2".repeat(64)}:719' tail`,
  format: "",
  yearWindow: "",
  zones: ["", "", "", ""],
});

/** The texts each DTM Decoder region can show. */
export function dtmTexts() {
  return {
    descriptions: DTM_PRESETS.map((p) => p.description),
    split: [LONGEST_SPLIT, "Code 719 carries a four-digit year. The window is not read."],
    stripNotes: [
      STRIP_NOTE_APPLIES,
      STRIP_NOTE_STATED,
      STRIP_NOTE_ALONE,
      STRIP_NOTE_OFFSET,
      STRIP_NOTE_PERIOD,
      STRIP_NOTE_NONE,
    ],
    details: SHAPES.map(detailText),
    verdicts: SHAPES.map(verdictText),
    gaps: [
      `Widest gap: 26 h, between ${LONGEST_ZONE} and ${LONGEST_ZONE}`,
    ],
    yearNotes: [
      yearWindowNote("", undefined),
      yearWindowNote("rolling", "2024-06-15"),
      yearWindowNote("2000", "2024-06-15"),
    ],
    reasons: Object.values(NULL_REASON_TEXT).map((f) =>
      f({ format: "719", form: "value" }),
    ),
    writeNotes: [
      `${isoNote(SHAPES[7]!)} A period is written without a hyphen.`,
      `${isoNote(SHAPES[2]!)} formatEdifactDtm writes a zone as ±HH and never as UTC or GMT. This is the element value. In an interchange, + is sent as ?+.`,
      "A zone text has no offset to write. Resolve the local time in a zone first, then write it with its offset.",
    ],
    parseCall:
      'parseEdifactDtm("202406151430202406201600", "719", { yearWindow: "rolling" })',
    parseOutput:
      '{ local: "2024-06-15T14:30:45", instant: "2024-06-15T12:30:45Z", offset: "+02:00" }',
    resolveCall:
      `resolveLocal("2024-06-15T14:30:00", "${LONGEST_ZONE}", { disambiguation: "reject" })`,
    formatCall:
      'formatEdifactDtm("2024-06-15T14:30:00/2024-06-20T16:00:00", "719", { yearWindow: "rolling" })',
    formatOutput: '"198703141526199105220811"',
  };
}
