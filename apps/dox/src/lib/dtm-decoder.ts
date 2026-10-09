/**
 * Pure helpers for the DTM Decoder (INT-15): a pasted UN/EDIFACT `DTM` segment,
 * or a value and its data element 2379 format code.
 *
 * The code is data, so the tool classifies it first (`classifyEdifactDtmFormat`)
 * and then calls the parser of the kind the classifier named
 * (`parseEdifactDate`, `parseEdifactTime`, `parseEdifactDateTime`,
 * `parseEdifactOffsetDateTime`, `parseEdifactDatePeriod` or
 * `parseEdifactDateTimePeriod`). A code the classifier does not know is the
 * sentinel, with a sentence saying why.
 *
 * The tool never interprets the function qualifier (data element 2005): it is
 * shown as sent. Every call printed, and every result beside it, is a real
 * `EdiLib` call; the site-side code splits the pasted segment (`splitDtm`) and
 * picks the function a kind names.
 *
 * No DOM and no gmt import: the library comes in from the mount.
 *
 * Naming rule: strings here name codes and standards as data (UN/EDIFACT 2379
 * and 2380, the UN/EDIFACT syntax rules, UN/ECE Recommendation 7) and nothing
 * else: no law, no rule-making body, no carrier or partner. Nothing maps a
 * place or an abbreviation to a zone.
 */

import {
  EDIFACT_FUNCTIONS,
  KIND_WORDS,
  LONGEST_ZONE,
  formatClassified,
  houseEnds,
  isInterval,
  isSentinel,
  parseClassified,
  resolveInZone,
  runCall,
  unreadCodeText,
  type EdiCall,
  type EdiHouse,
  type EdiLib,
  type EdifactClass,
} from "./edi-widgets";
import {
  figureAria,
  picHalves,
  plainHalves,
  probeFamily,
  cutValue,
  shapeOf,
  type PicHalf,
  type PicPart,
} from "./edi-picture";

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State, args and the segment splitter
// ---------------------------------------------------------------------------

/** What a chat call or a permalink hands over. An old link may still carry a
 *  `yearWindow`; it is ignored. */
export interface DtmDecoderArgs {
  input?: string;
  format?: string;
  zone1?: string;
  zone2?: string;
  zone3?: string;
  zone4?: string;
}

/** What the DOM holds: all strings. */
export interface DtmState {
  input: string;
  format: string;
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
    extra: composite.length > 3 || elements.length > 2 || rest.trim() !== "",
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
  zones: [string, string, string, string];
}

const NO_ZONES: [string, string, string, string] = ["", "", "", ""];

/** The four zones the examples that state no offset read their value in. They are
 *  the example's picks, never derived from a value or a code. */
const EXAMPLE_ZONES: [string, string, string, string] = [
  "America/New_York",
  "Europe/Berlin",
  "Asia/Shanghai",
  "America/Los_Angeles",
];

/** Labels name what the format code shows. None implies a meaning for the
 *  function qualifier, which the tool never interprets. Every preset returns a
 *  value except the last two, which show the two things a reader tries: a
 *  zone abbreviation under a signed-hour code, and a two-digit-year code. */
export const DTM_PRESETS: readonly DtmPreset[] = [
  {
    id: "local-203",
    label: "203: local time, no offset",
    description:
      "A local time at a place the value does not name. The strip reads it in four example zones; none is the answer until you know where the sender's clock was. Change them.",
    input: "DTM+137:202406151430:203'",
    format: "",
    zones: EXAMPLE_ZONES,
  },
  {
    id: "released-303",
    label: "303 with ?+00: offset stated",
    description:
      "The release character ? guards the +, so the element value is 202406151430+00. A signed hour is an offset, and the value names one instant.",
    input: "DTM+137:202406151430?+00:303'",
    format: "",
    zones: NO_ZONES,
  },
  {
    id: "utc-303",
    label: "303 with UTC: offset stated",
    description:
      "The three characters UTC are read as an offset of +00:00, so the value names one instant. The formatter writes that offset as +00 and never as UTC. The field holds a signed hour, UTC or GMT and nothing else.",
    input: "DTM+137:202406151430UTC:303'",
    format: "",
    zones: NO_ZONES,
  },
  {
    id: "gmt-303",
    label: "303 with GMT: offset stated",
    description:
      "GMT is read as an offset of +00:00, like UTC: UN/ECE Recommendation 7 calls UTC formerly known as Greenwich Mean Time. The value names one instant. The formatter writes +00 and never GMT.",
    input: "DTM+137:202406151430GMT:303'",
    format: "",
    zones: NO_ZONES,
  },
  {
    id: "offset-205",
    label: "205: a signed HHMM offset",
    description:
      "Code 205 ends in a signed HHMM offset from UTC, so the value names one instant and states the offset in force.",
    input: "DTM+137:202406151430?+0200:205'",
    format: "",
    zones: NO_ZONES,
  },
  {
    id: "offset-208",
    label: "208: seconds and an offset",
    description:
      "Code 208 ends in seconds and a signed HHMM offset from UTC. Use it to send seconds with an offset: the value names one instant and states the offset in force.",
    input: "DTM+137:20240615143045?+0200:208'",
    format: "",
    zones: NO_ZONES,
  },
  {
    id: "date-102",
    label: "102: a date",
    description:
      "A date alone, in the form CCYYMMDD. It names no instant in any zone.",
    input: "20240615",
    format: "102",
    zones: NO_ZONES,
  },
  {
    id: "time-402",
    label: "402: a time of day",
    description:
      "A time of day with seconds and no date. It names no instant: it is on no day.",
    input: "143045",
    format: "402",
    zones: NO_ZONES,
  },
  {
    id: "period-718",
    label: "718: a period of dates, no hyphen",
    description:
      "A period is sent as two dates, one straight after the other, with no hyphen between them. The result holds the start and the end.",
    input: "2024061520240620",
    format: "718",
    zones: NO_ZONES,
  },
  {
    id: "period-719",
    label: "719: a period of local times",
    description:
      "A period of two local date-times, one straight after the other. The code states no offset, so the strip reads both ends in four example zones. The zones are the example's picks: change them.",
    input: "202406151430202406201600",
    format: "719",
    zones: EXAMPLE_ZONES,
  },
  {
    id: "cet-303",
    label: "303 with CET: not read",
    description:
      "The field of code 303 holds a signed hour, UTC or GMT. CET is a zone abbreviation, and no standard maps an abbreviation to an offset, so the library returns the sentinel.",
    input: "DTM+137:202406151430CET:303'",
    format: "",
    zones: NO_ZONES,
  },
  {
    id: "two-digit-101",
    label: "101: two-digit year, not read",
    description:
      "Code 101 has a two-digit year, and no standard says which century it belongs to. The EDI functions do not read it, so the library returns the sentinel. The pattern parsers read the same digits with a yearWindow that states the century.",
    input: "240615",
    format: "101",
    zones: NO_ZONES,
  },
];

const trimmed = (state: DtmState): DtmState => ({
  input: state.input.trim(),
  format: state.format.trim(),
  zones: state.zones.map((z) => z.trim()) as DtmState["zones"],
});

export function presetState(preset: DtmPreset): DtmState {
  return {
    input: preset.input,
    format: preset.format,
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
      t.zones.every((z, i) => z === s.zones[i])
    );
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The state a chat call or a permalink seeds: seeded when `args.input` is
 * defined. A string is kept as typed; an absent key is blank; nothing falls back
 * to a preset. A `yearWindow` an old link carries is not read.
 */
export function readArgs(args: DtmDecoderArgs): DtmState {
  const text = (v: unknown): string =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  return {
    input: text(args.input),
    format: text(args.format),
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
  state.zones.forEach((z, i) => put(`zone${i + 1}`, z));
  return out;
}

// ---------------------------------------------------------------------------
// Reading: classify the code, then call the parser of its kind
// ---------------------------------------------------------------------------

export type DtmWhy =
  | "blank-value"
  | "no-format"
  | "unread-code"
  | "released-character"
  | "zone-text"
  | "bad-value";

/** What reading a state made: the calls, in the order made, and what they gave. */
export interface DtmRead {
  /** The value and the code the calls used. */
  value: string;
  format: string;
  /** `classifyEdifactDtmFormat`'s call; `null` when no code was typed. */
  classify: EdiCall | null;
  classified: EdifactClass | null;
  /** The kind's parser; `null` when the classifier returned `null`. */
  parse: EdiCall | null;
  /** What the parser returned; `null` for the sentinel or no call. */
  house: EdiHouse | null;
  /** `toOffsetInstant` of an offset date-time, which gives its instant and offset. */
  pair: EdiCall | null;
  /** Every call, in order, for the call frame and the output. */
  calls: EdiCall[];
}

/**
 * Classify the code, then call the kind's parser. A blank value or code makes no
 * parse call; a code the classifier does not know makes none either.
 */
export function readDtm(state: DtmState, lib: EdiLib): DtmRead {
  const { value, format } = effective(state);
  const read: DtmRead = {
    value,
    format,
    classify: null,
    classified: null,
    parse: null,
    house: null,
    pair: null,
    calls: [],
  };
  if (format === "") return read;
  read.classify = runCall(lib, "classifyEdifactDtmFormat", format);
  read.calls.push(read.classify);
  read.classified = read.classify.result as EdifactClass | null;
  if (read.classified === null) return read;
  const functions = EDIFACT_FUNCTIONS[read.classified.kind];
  read.parse = parseClassified(lib, functions, value, read.classified.format);
  read.calls.push(read.parse);
  if (isSentinel(read.parse.result)) return read;
  read.house = read.parse.result as EdiHouse;
  if (read.classified.kind === "offsetDateTime") {
    read.pair = runCall(lib, "toOffsetInstant", read.house as string);
    read.calls.push(read.pair);
  }
  return read;
}

/** The pair `toOffsetInstant` returned for an offset date-time, else `null`. */
export function pairOf(
  read: DtmRead,
): { instant: string; offset: string } | null {
  const r = read.pair?.result;
  return r === null || r === undefined
    ? null
    : (r as { instant: string; offset: string });
}

// ---------------------------------------------------------------------------
// What the value states
// ---------------------------------------------------------------------------

export type OffsetVerdict = "stated" | "not-stated";

export function offsetVerdict(read: DtmRead): OffsetVerdict {
  return pairOf(read) === null ? "not-stated" : "stated";
}

/** The verdict plate's words. */
export function verdictText(read: DtmRead): string {
  const pair = pairOf(read);
  return pair === null
    ? "Offset: not stated"
    : `Offset: stated (${pair.offset})`;
}

const DETAIL: Record<string, string> = {
  offsetDateTime: "The value names one instant.",
  dateTime: "A local time at a place the value does not name. It is not UTC.",
  date: "A date. A date alone names no instant in any zone.",
  time: "A time of day with no date and no offset: it is on no day.",
  datePeriod:
    "A period of dates: a start and an end. The code states no offset, so neither end names an instant.",
  dateTimePeriod:
    "A period: a start and an end, each a local time. The code states no offset, so neither end names an instant until you choose a zone.",
};

/** One line under the verdict, by the kind the classifier named. */
export function detailText(read: DtmRead): string {
  return read.classified === null || read.house === null
    ? ""
    : (DETAIL[read.classified.kind] ?? "");
}

export type MemberKey = "kind" | "value" | "periodEnd" | "instant" | "offset";

export const MEMBER_ROWS: readonly {
  key: MemberKey;
  role: string;
  label: string;
}[] = [
  { key: "kind", role: "member-kind", label: "Kind" },
  { key: "value", role: "member-value", label: "Value" },
  { key: "periodEnd", role: "member-period-end", label: "Period end" },
  { key: "instant", role: "member-instant", label: "Instant" },
  { key: "offset", role: "member-offset", label: "Offset" },
];

/** The member's text, or `null` when the read does not hold it. */
export function memberText(read: DtmRead, key: MemberKey): string | null {
  if (read.classified === null || read.house === null) return null;
  const pair = pairOf(read);
  switch (key) {
    case "kind":
      return KIND_WORDS[read.classified.kind] ?? read.classified.kind;
    case "value":
      return isInterval(read.house) ? read.house.start : read.house;
    case "periodEnd":
      return isInterval(read.house) ? read.house.end : null;
    case "instant":
      return pair === null ? null : pair.instant;
    case "offset":
      return pair === null ? null : pair.offset;
  }
}

// ---------------------------------------------------------------------------
// The strip: an offsetless value read in the zones the reader chose
// ---------------------------------------------------------------------------

/** The strip applies to a local date-time and to a period of local date-times. */
export function stripApplies(read: DtmRead | null): boolean {
  return (
    read !== null &&
    read.house !== null &&
    (read.classified?.kind === "dateTime" ||
      read.classified?.kind === "dateTimePeriod")
  );
}

const STRIP_NOTE_APPLIES =
  'The value states no offset. Each zone below is a pick, from the example or from you, and not something the value says: the same digits, read there. Every row uses resolveLocal with disambiguation: "reject", so a time the clock shows twice or never is not resolved.';
const STRIP_NOTE_PERIOD =
  'The value states no offset. Each zone below is a pick, from the example or from you. A row reads the start and the end there with resolveLocal and disambiguation: "reject", so a time the clock shows twice or never is not resolved.';
const STRIP_NOTE_STATED =
  "The value states its offset, so there is nothing to choose.";
const STRIP_NOTE_ALONE = "A date or a time alone names no instant in any zone.";
const STRIP_NOTE_DATES =
  "A period of dates names no instant: a date has no time of day to place.";
const STRIP_NOTE_NONE = "No value.";

export function stripNote(read: DtmRead | null): string {
  if (read === null || read.house === null) return STRIP_NOTE_NONE;
  switch (read.classified?.kind) {
    case "dateTime":
      return STRIP_NOTE_APPLIES;
    case "dateTimePeriod":
      return STRIP_NOTE_PERIOD;
    case "offsetDateTime":
      return STRIP_NOTE_STATED;
    case "datePeriod":
      return STRIP_NOTE_DATES;
    default:
      return STRIP_NOTE_ALONE;
  }
}

/** The words the timeline shows when there is no instant to place: shorter than
 *  the note above it, and never an amber sentinel. */
export function timelineEmptyText(read: DtmRead | null): string {
  if (read === null || read.house === null) {
    return "No value, so no instant to place.";
  }
  if (read.classified?.kind === "datePeriod") {
    return "A period of dates names no instant: nothing to place.";
  }
  return "A date or a time alone names no instant: nothing to place.";
}

export interface GapRow {
  zone: string;
  /** The first end resolved in the zone, `""` when it did not resolve. */
  instant: string;
  offset: string;
  /** The value written with its offset (`205`) for a single value, or the end
   *  resolved for a period. */
  third: string;
  /** Why `resolveLocal` returned `""`, else `""`. */
  reason: string;
}

/**
 * One row per zone slot. A single value's row is `resolveLocal(local, zone, {
 * disambiguation: "reject" })`, then `toOffsetInstant(instant, zone).offset`, then
 * `formatEdifactOffsetDateTime(fromOffsetInstant({ instant, offset }), "205")`. A
 * period's row resolves the start and the end the same way. A blank slot is
 * `{ zone: "" }`; a refused time carries its reason.
 */
export function gapRows(
  house: EdiHouse,
  zones: readonly string[],
  lib: EdiLib,
): GapRow[] {
  const ends = houseEnds(house);
  return zones.map((raw) => {
    const first = resolveInZone(ends[0]!, raw, lib);
    const row: GapRow = { ...first, third: "" };
    if (first.zone === "") return row;
    if (ends.length > 1) {
      const last = resolveInZone(ends[1]!, raw, lib);
      row.third = last.instant;
      if (row.reason === "") row.reason = last.reason;
    } else if (first.offset !== "") {
      row.third = lib.formatEdifactOffsetDateTime(
        lib.fromOffsetInstant({ instant: first.instant, offset: first.offset }),
        "205",
      );
    }
    return row;
  });
}

// ---------------------------------------------------------------------------
// Why the sentinel
// ---------------------------------------------------------------------------

export const REASON_TEXT: Record<
  Exclude<DtmWhy, "unread-code" | "zone-text" | "bad-value">,
  (context: { form: "segment" | "value" }) => string
> & {
  "bad-value": (context: { format: string }) => string;
  "zone-text": (context: { format: string; abbreviation: string }) => string;
} = {
  "blank-value": () => "Paste a DTM segment or a value.",
  "no-format": ({ form }) =>
    form === "segment"
      ? "A value means nothing without its 2379 format code. The segment carries none."
      : "A value means nothing without its 2379 format code. Type the code.",
  "released-character": () =>
    "The value still carries the release character ?. +02 is transmitted as ?+02: paste the whole segment, or remove the ?.",
  "zone-text": ({ format, abbreviation }) =>
    `The field of code ${format} holds a signed hour such as +01, UTC or GMT. ${abbreviation} is a zone abbreviation, and no standard maps an abbreviation to an offset, so the library does not read it. A code that holds hours and minutes states the offset itself.`,
  "bad-value": ({ format }) =>
    `The value does not fit code ${format}, names a date or time that does not exist, is a period written with a hyphen (UN/EDIFACT sends none), or is a period whose end is before its start.`,
};

/** Why a state is the sentinel, decided from the calls that were made. */
export function whyNot(state: DtmState, read: DtmRead, lib: EdiLib): DtmWhy {
  const { value, format, split } = effective(state);
  if (value === "") return "blank-value";
  if (format === "") return "no-format";
  if (read.classified === null) return "unread-code";
  if (split.kind === "value" && value.includes("?"))
    return "released-character";
  if (
    read.classified.kind === "offsetDateTime" &&
    abbreviationOf(value, read, lib) !== ""
  ) {
    return "zone-text";
  }
  return "bad-value";
}

/** The trailing letters of an offset date-time value, when its code's layout ends
 *  in the three-character zone field. */
function abbreviationOf(value: string, read: DtmRead, lib: EdiLib): string {
  const tail = /[A-Za-z]{3}$/.exec(value)?.[0] ?? "";
  if (tail === "" || read.classified === null) return "";
  const shape = shapeOf(
    (start) => lib.formatEdifactOffsetDateTime(start, read.classified!.format),
    "offsetDateTime",
  );
  return shape?.start.some((f) => f.part === "ZZZ") ? tail : "";
}

/** The one sentence under NO SIGNAL. */
export function sentinelText(
  state: DtmState,
  read: DtmRead,
  lib: EdiLib,
): string {
  const why = whyNot(state, read, lib);
  const { value, format, split } = effective(state);
  switch (why) {
    case "unread-code":
      return unreadCodeText(format, "edifact");
    case "zone-text":
      return REASON_TEXT["zone-text"]({
        format,
        abbreviation: abbreviationOf(value, read, lib),
      });
    case "bad-value":
      return REASON_TEXT["bad-value"]({ format });
    case "blank-value":
      return REASON_TEXT["blank-value"]({ form: split.kind });
    case "no-format":
      return REASON_TEXT["no-format"]({ form: split.kind });
    default:
      return REASON_TEXT["released-character"]({ form: split.kind });
  }
}

/** The split line in section 1. */
export function splitText(state: DtmState): string {
  const { split } = effective(state);
  if (split.kind === "value") return "Read as a bare value.";
  const base = `Read as a segment: function qualifier ${split.qualifier === "" ? "(none)" : split.qualifier}, shown as sent and not interpreted; value ${split.value === "" ? "(none)" : split.value}; format code ${split.format === "" ? "(none)" : split.format}.`;
  return split.extra
    ? `${base} Text after the first composite is not read.`
    : base;
}

// ---------------------------------------------------------------------------
// Writing back
// ---------------------------------------------------------------------------

export interface WriteBack {
  /** The formatter's call: the kind's formatter, a period's start and end as two arguments. */
  call: EdiCall;
  output: string;
  note: string;
}

/**
 * The kind's formatter, called with what the parser returned and the code the
 * classifier returned. `null` when there is no value to write: no result.
 */
export function writeBack(read: DtmRead, lib: EdiLib): WriteBack | null {
  if (read.classified === null || read.house === null) return null;
  const call = formatClassified(
    lib,
    EDIFACT_FUNCTIONS[read.classified.kind],
    read.house,
    read.classified.format,
  );
  const output = call.result as string;
  const notes: string[] = [];
  if (output === "") {
    notes.push(`${call.fn} returned the sentinel for this value and code.`);
  } else {
    if (read.value.endsWith("UTC") || read.value.endsWith("GMT")) {
      notes.push(`${call.fn} writes a zone as ±HH and never as UTC or GMT.`);
    }
    if (isInterval(read.house)) {
      notes.push("A period is written without a hyphen.");
    }
    if (output.includes("+")) {
      notes.push(
        "This is the element value. In an interchange, + is sent as ?+.",
      );
    }
  }
  return { call, output, note: notes.join(" ") };
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
      {
        text: spans.qualifier,
        caption: "qualifier",
        after: ":",
        kind: "plain",
      },
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
}

/**
 * The value taken apart, along the layout the kind's formatter writes for the
 * code (`shapeOf`). A value the parser read is cut in the groups' marks; a
 * refused one, or one the layout does not fit, sits in one neutral box.
 */
export function dtmFigure(
  state: DtmState,
  read: DtmRead,
  lib: EdiLib,
): DtmFigure {
  const { value, format, split } = effective(state);
  const classified = read.classified;
  let shape = null as ReturnType<typeof shapeOf>;
  if (classified !== null) {
    const fns = EDIFACT_FUNCTIONS[classified.kind];
    const family = probeFamily(classified.kind);
    const write = (a: string, b: string): string =>
      fns.period
        ? (lib[fns.format] as (s: string, e: string, f: string) => string)(
            a,
            b,
            classified.format,
          )
        : (lib[fns.format] as (v: string, f: string) => string)(
            a,
            classified.format,
          );
    shape = shapeOf(write, family);
  }
  const cut = shape === null ? null : cutValue(value, shape);
  const refused = read.house === null;
  const halves = cut === null ? plainHalves(value) : picHalves(cut, refused);
  const hasOffset = shape?.start.some((f) => f.group === "offset") ?? true;
  const closing = !refused && cut !== null && !hasOffset ? "no offset" : "";
  const lead =
    split.kind === "segment"
      ? `Segment with function qualifier ${split.qualifier}, shown as sent. `
      : "";
  return {
    halves,
    separator: shape?.separator ?? "",
    closing,
    aria: lead + figureAria(value, format, halves, closing),
  };
}

// ---------------------------------------------------------------------------
// Every text a region can show, for the height it reserves (`holdHtml`)
// ---------------------------------------------------------------------------

/** The kinds, to run the pure text functions over. Never shown; only measured. */
const KINDS = Object.keys(DETAIL);

/** The longest segment sentence the split line can say, with a 64-character value. */
const LONGEST_SPLIT = splitText({
  input: `DTM+137:${"2".repeat(64)}:719' tail`,
  format: "",
  zones: ["", "", "", ""],
});

/** The texts each DTM Decoder region can show. */
export function dtmTexts() {
  const reasonContext = { form: "value" as const, format: "719" };
  return {
    descriptions: DTM_PRESETS.map((p) => p.description),
    split: [LONGEST_SPLIT],
    stripNotes: [
      STRIP_NOTE_APPLIES,
      STRIP_NOTE_PERIOD,
      STRIP_NOTE_STATED,
      STRIP_NOTE_ALONE,
      STRIP_NOTE_DATES,
      STRIP_NOTE_NONE,
    ],
    details: KINDS.map((k) => DETAIL[k]!),
    verdicts: ["Offset: not stated", "Offset: stated (+02:00)"],
    gaps: [`Widest gap: 26 h, between ${LONGEST_ZONE} and ${LONGEST_ZONE}`],
    reasons: [
      REASON_TEXT["blank-value"](reasonContext),
      REASON_TEXT["no-format"](reasonContext),
      REASON_TEXT["released-character"](reasonContext),
      REASON_TEXT["zone-text"]({ format: "303", abbreviation: "CET" }),
      REASON_TEXT["bad-value"]({ format: "719" }),
      unreadCodeText("101", "edifact"),
      unreadCodeText("201", "edifact"),
      unreadCodeText("206", "edifact"),
      unreadCodeText("602", "edifact"),
    ],
    writeNotes: [
      "A period is written without a hyphen. This is the element value. In an interchange, + is sent as ?+.",
      "formatEdifactOffsetDateTime writes a zone as ±HH and never as UTC or GMT. This is the element value. In an interchange, + is sent as ?+.",
    ],
    parseCall:
      'classifyEdifactDtmFormat("208")\nparseEdifactOffsetDateTime("20240615143045+0200", "208")\ntoOffsetInstant("2024-06-15T14:30:45+02:00")',
    parseOutput:
      '{ kind: "offsetDateTime", format: "208" }\n"2024-06-15T14:30:45+02:00"\n{ instant: "2024-06-15T12:30:45Z", offset: "+02:00" }',
    resolveCall: `resolveLocal("2024-06-15T14:30:00", "${LONGEST_ZONE}", { disambiguation: "reject" })`,
    formatCall:
      'formatEdifactDateTimePeriod("2024-06-15T14:30:00", "2024-06-20T16:00:00", "719")',
    formatOutput: '"202406151430202406201600"',
  };
}
