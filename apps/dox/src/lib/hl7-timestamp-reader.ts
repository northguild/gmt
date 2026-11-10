/**
 * Pure helpers for the HL7 Timestamp Reader (HLTH-93): one HL7 v2 date-time, a `DTM` or a `TS`
 * with its degree of precision after `^`, read by `parseHL7`.
 *
 * `parseHL7` answers with one of four kinds: `instant` (an offset and a minute or finer),
 * `local` (no offset: the sender's local time), `partial` (a year, month, day or hour: a span)
 * and `null` (the HL7 null value `""`), or with the sentinel for anything it does not read. A
 * `local` value is read in the zones the reader picks with `resolveLocal` and
 * `disambiguation: "reject"`, beside the instant a parser that assumes UTC gets
 * (`resolveLocal(local, "UTC")`, a library call and never `local + "Z"`). `formatHL7` writes
 * the value back at each precision.
 *
 * Every printed call, and every result beside it, is a real `Hl7Lib` call. The picture's group
 * widths are read off `formatHL7`'s own output, and the site holds no table of the `DTM`
 * picture.
 *
 * No DOM and no gmt import: the library comes in from the mount.
 *
 * Naming rule: strings here name the HL7 v2 standard as data (chapter 2, section 2.A.22, the
 * `DTM` and `TS` data types, table 0529) and nothing else: no law, no rule-making body, no
 * facility or vendor. Nothing maps a place or a facility to a zone.
 */
import type { Hl7DateTime, Hl7Precision } from "@northguild/gmt/types";
import {
  figureAria,
  plainHalves,
  type PicField,
  type PicHalf,
} from "./edi-picture";
import { callResultsText } from "./edi-render";
import { callArgs } from "./punctuality-widgets";
import {
  LONGEST_ZONE,
  NO_RESULT_TEXT,
  REJECT,
  durationText,
  readoutOf,
  resolveInZone,
  resolveReason,
  runCall,
  widestGap,
  type EdiCall,
  type WidestGap,
} from "./edi-widgets";
import type { Hl7Lib } from "./hl7-lib";

export const CUSTOM_PRESET_ID = "custom";

/** The strip's third column, and the timeline's reference label. */
export const READ_AS_UTC = "Read as UTC";

// ---------------------------------------------------------------------------
// State and args
// ---------------------------------------------------------------------------

/** What a chat call or a permalink hands over. `preset` is a permalink's alone. */
export interface Hl7Args {
  value?: string;
  preset?: string;
  zone1?: string;
  zone2?: string;
  zone3?: string;
  zone4?: string;
}

/** What the DOM holds: all strings. The value is never trimmed. */
export interface Hl7State {
  value: string;
  zones: [string, string, string, string];
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface Hl7Preset {
  id: string;
  label: string;
  description: string;
  value: string;
  zones: [string, string, string, string];
}

const NO_ZONES: [string, string, string, string] = ["", "", "", ""];
const zones = (...picked: string[]): [string, string, string, string] => [
  picked[0] ?? "",
  picked[1] ?? "",
  picked[2] ?? "",
  picked[3] ?? "",
];

const ZONE_NOTE =
  "The zones are the example's picks, never something the value says: change them.";

/** The examples. Zones are literal fields, hand-written beside a description that says so. */
export const HL7_PRESETS: readonly Hl7Preset[] = [
  {
    id: "no-offset",
    label: "No offset: the sender's local time",
    description: `A DTM with no offset. HL7 says it is the sender's local time, so it names no instant until you know the sender's zone. ${ZONE_NOTE}`,
    value: "20240615103000",
    zones: zones("Asia/Kolkata", "Europe/London"),
  },
  {
    id: "offset",
    label: "An offset sent: +0200",
    description:
      "The same digits with +0200 after them. The value names one instant, and the offset it sent is the offset in force.",
    value: "20240615103000+0200",
    zones: NO_ZONES,
  },
  {
    id: "minus-zero",
    label: "-0000: an offset of zero",
    description:
      "-0000 and +0000 both read as an offset of +00:00, so both name the same instant.",
    value: "20240615103000-0000",
    zones: NO_ZONES,
  },
  {
    id: "fraction",
    label: "Four fraction digits",
    description:
      "A fraction of up to four digits after the seconds. The ladder below cuts the value to a coarser precision and never rounds it.",
    value: "20240615103045.1234+0000",
    zones: NO_ZONES,
  },
  {
    id: "fall-back",
    label: "Clocks go back: a time that happens twice",
    description: `01:30 on 27 October 2024 happens twice on a London clock, so resolveLocal with disambiguation: "reject" does not pick one. Tokyo has no such hour. ${ZONE_NOTE}`,
    value: "20241027013000",
    zones: zones("Europe/London", "Asia/Tokyo"),
  },
  {
    id: "spring-forward",
    label: "Clocks go forward: a time that never happens",
    description: `02:30 on 6 October 2024 never happens on a Sydney clock: the clock skips it. resolveLocal with disambiguation: "reject" does not pick another time. ${ZONE_NOTE}`,
    value: "20241006023000",
    zones: zones("Australia/Sydney", "Africa/Johannesburg"),
  },
  {
    id: "midnight",
    label: "A value to the minute",
    description: `The value of the chapter 2 example of a local time, 1988-07-05 at midnight, sent to the minute with no offset. ${ZONE_NOTE}`,
    value: "198807050000",
    zones: zones("Africa/Johannesburg"),
  },
  {
    id: "ts-month",
    label: "TS with ^L: a month",
    description:
      "A TS carries a degree of precision after ^. L lowers the value to a month, so the digits after the month are cut by the degree and not read.",
    value: "199904011200^L",
    zones: NO_ZONES,
  },
  {
    id: "ts-day",
    label: "TS with ^D: a day",
    description:
      "D lowers the value to a day. A day is a span, so it has no instant.",
    value: "20240615103000^D",
    zones: NO_ZONES,
  },
  {
    id: "ts-finer",
    label: "TS with ^S, finer than the digits: not read",
    description:
      "The degree S is finer than the digits sent. A degree can only lower the precision of the digits, so the library does not read the value.",
    value: "20240615^S",
    zones: NO_ZONES,
  },
  {
    id: "birth-year",
    label: "A year alone",
    description:
      "A date of birth in PID-7 sent as a year. It names a span of a year, not a moment.",
    value: "1965",
    zones: NO_ZONES,
  },
  {
    id: "null-value",
    label: 'The null value ""',
    description:
      "Two double quote marks are the HL7 null value. It deletes what was stored, which is not the same as an empty field. The value here is those two characters, not an empty box.",
    value: '""',
    zones: NO_ZONES,
  },
  {
    id: "five-digits",
    label: "Five fraction digits: not read",
    description:
      "A fraction has one to four digits. A fifth is not a precision the standard allows, so the library does not read the value.",
    value: "20240615103000.12345",
    zones: NO_ZONES,
  },
];

const trimmedZones = (state: Hl7State): string[] =>
  state.zones.map((z) => z.trim());

export function presetState(preset: Hl7Preset): Hl7State {
  return { value: preset.value, zones: [...preset.zones] };
}

/** The preset whose value equals the state's, as typed, and whose zones equal its zones (trimmed). */
export function matchPreset(state: Hl7State): string {
  const picked = trimmedZones(state);
  const hit = HL7_PRESETS.find(
    (p) => p.value === state.value && p.zones.every((z, i) => z === picked[i]),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** Whether a call or a link seeds the widget: a value, or a preset it names. */
export function isSeeded(args: Hl7Args): boolean {
  return (
    args.value !== undefined || HL7_PRESETS.some((p) => p.id === args.preset)
  );
}

/**
 * The state a chat call or a permalink seeds. A known `preset` is that preset. Otherwise a string
 * is kept as typed, an absent key is blank, and nothing falls back to a preset.
 */
export function readArgs(args: Hl7Args): Hl7State {
  const named = HL7_PRESETS.find((p) => p.id === args.preset);
  if (named !== undefined) return presetState(named);
  const text = (v: unknown): string =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  return {
    value: text(args.value),
    zones: [
      text(args.zone1),
      text(args.zone2),
      text(args.zone3),
      text(args.zone4),
    ],
  };
}

/**
 * Strings only. The link names `preset` alone while the state matches one; otherwise the
 * non-empty fields. The value is never trimmed, so only an empty value is dropped.
 */
export function permalinkOf(state: Hl7State): Record<string, string> {
  const id = matchPreset(state);
  if (id !== CUSTOM_PRESET_ID) return { preset: id };
  const out: Record<string, string> = {};
  if (state.value !== "") out["value"] = state.value;
  state.zones.forEach((z, i) => {
    const v = z.trim();
    if (v !== "") out[`zone${i + 1}`] = v;
  });
  return out;
}

/**
 * Whether nothing was typed, so no call is made and the widget says "nothing to read". Two
 * double quote marks are a value (the null value); only an untouched field is blank.
 */
export function hl7Blank(state: Hl7State): boolean {
  return state.value === "";
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** What reading a state made. */
export interface Hl7Read {
  value: string;
  /** `parseHL7`'s call; `null` for a blank field, which makes none. */
  parse: EdiCall | null;
  /** What it returned; `null` for the sentinel or no call. */
  parsed: Hl7DateTime | null;
}

export function readHl7(state: Hl7State, lib: Hl7Lib): Hl7Read {
  if (hl7Blank(state)) return { value: "", parse: null, parsed: null };
  const parse = runCall(lib, "parseHL7", state.value);
  return {
    value: state.value,
    parse,
    parsed: parse.result as Hl7DateTime | null,
  };
}

// ---------------------------------------------------------------------------
// What the value states
// ---------------------------------------------------------------------------

const PRECISION_WORDS: Record<string, string> = {
  year: "year",
  month: "month",
  day: "day",
  hour: "hour",
};

const DETAIL_INSTANT =
  "The value names one instant: the offset it sent is the offset in force.";
const DETAIL_LOCAL =
  'HL7 v2.5.1 2.A.22: "if the time zone is not included, the time zone defaults to that of the local time zone of the sender". It is not UTC. Ask for the sending facility\'s zone.';
const DETAIL_NULL =
  'The two characters "" delete the value stored. That is not the same as an empty field, which leaves it as it was.';
const detailPartial = (precision: string): string =>
  `A ${PRECISION_WORDS[precision] ?? precision} names a span of time, not a moment, so it has no instant in any zone.`;

const VERDICT_INSTANT = "Offset stated";
const VERDICT_LOCAL = "No offset: the sender's local time";
const VERDICT_PARTIAL = "A span, not a moment";
const VERDICT_NULL = "The HL7 null value";

/** The verdict plate's words; `""` when the value has none (blank, or the sentinel). */
export function verdictText(read: Hl7Read): string {
  switch (read.parsed?.kind) {
    case "instant":
      return VERDICT_INSTANT;
    case "local":
      return VERDICT_LOCAL;
    case "partial":
      return VERDICT_PARTIAL;
    case "null":
      return VERDICT_NULL;
    default:
      return "";
  }
}

/** One line under the verdict, by the kind `parseHL7` returned. */
export function detailText(read: Hl7Read): string {
  const parsed = read.parsed;
  switch (parsed?.kind) {
    case "instant":
      return DETAIL_INSTANT;
    case "local":
      return DETAIL_LOCAL;
    case "partial":
      return detailPartial(parsed.precision);
    case "null":
      return DETAIL_NULL;
    default:
      return "";
  }
}

type MemberKey = "kind" | "instant" | "offset" | "local" | "precision";

export const MEMBER_ROWS: readonly {
  key: MemberKey;
  label: string;
}[] = [
  { key: "kind", label: "Kind" },
  { key: "instant", label: "Instant" },
  { key: "offset", label: "Offset" },
  { key: "local", label: "Local" },
  { key: "precision", label: "Precision" },
];

const NO_INSTANT_SPAN = "none (a span)";
const OFFSET_NOT_SENT = "not sent";

/**
 * One member's text and state. The sentinel and a blank field give every row `no result`; the
 * null value gives its kind and `no result` for the rest. A member the value does not state is
 * `not stated`, `none (a span)` or `not sent`, in words.
 */
export function memberReadout(
  read: Hl7Read,
  key: MemberKey,
): { text: string; state: "value" | "absent" | "none" } {
  const parsed = read.parsed;
  if (parsed === null) return readoutOf(null, false);
  if (key === "kind") return readoutOf(parsed.kind, true);
  if (parsed.kind === "null") return readoutOf(null, false);
  switch (key) {
    case "instant":
      if (parsed.kind === "instant") return readoutOf(parsed.instant, true);
      return parsed.kind === "partial"
        ? { text: NO_INSTANT_SPAN, state: "absent" }
        : readoutOf(null, true);
    case "offset": {
      const offset = parsed.kind === "local" ? "" : parsed.offset;
      return offset === ""
        ? { text: OFFSET_NOT_SENT, state: "absent" }
        : readoutOf(offset, true);
    }
    case "local":
      return readoutOf(parsed.local, true);
    case "precision":
      return readoutOf(parsed.precision, true);
  }
}

// ---------------------------------------------------------------------------
// The strip: a value with no offset read in the zones the reader chose
// ---------------------------------------------------------------------------

/** The strip applies to a value with no offset and the minute or finer: `"local"` only. */
export function stripApplies(read: Hl7Read | null): boolean {
  return read !== null && read.parsed?.kind === "local";
}

const STRIP_NOTE_LOCAL =
  'The value states no offset. Each zone below is a pick, from the example or from you, and not something the value says: the same digits, read there. Every row uses resolveLocal with disambiguation: "reject", so a time the clock shows twice or never is not resolved. Read as UTC is what a parser that assumes UTC gets.';
const STRIP_NOTE_STATED =
  "The value states its offset, so there is nothing to choose.";
const STRIP_NOTE_PARTIAL =
  "A span has no instant, so no zone is applied to it.";
const STRIP_NOTE_NONE = "No value to place.";

export function stripNote(read: Hl7Read | null): string {
  switch (read?.parsed?.kind) {
    case "local":
      return STRIP_NOTE_LOCAL;
    case "instant":
      return STRIP_NOTE_STATED;
    case "partial":
      return STRIP_NOTE_PARTIAL;
    default:
      return STRIP_NOTE_NONE;
  }
}

/** The words the timeline shows when it has no marks to place; never amber. */
export function timelineEmptyText(read: Hl7Read | null): string {
  return read?.parsed?.kind === "partial"
    ? "A span has no instant: nothing to place."
    : "No value, so no instant to place.";
}

/** One strip row: the shared `StripRow` fields, with `third` as `Read as UTC` words. */
interface Hl7StripRow {
  zone: string;
  instant: string;
  offset: string;
  third: string;
  reason: string;
}

/** The strip's rows, the UTC reading, the widest gap and every call made, in order. */
interface Hl7Strip {
  rows: Hl7StripRow[];
  /** `resolveLocal(local, "UTC")`, `""` when the library gave none. */
  utcReading: string;
  gap: WidestGap | null;
  calls: EdiCall[];
}

/** "5 h 30 min later", "4 h earlier", "the same time": how far the UTC reading is from the instant. */
export function laterText(iso: string): string {
  if (iso.startsWith("-")) return `${durationText(iso.slice(1))} earlier`;
  const text = durationText(iso);
  return text === "0 h" ? "the same time" : `${text} later`;
}

/**
 * One row per zone slot: `resolveLocal(local, zone, { disambiguation: "reject" })`, the zone's
 * offset, and `diffUtcAsDuration(instant, utcReading, "hours")` through `durationText`. A blank
 * slot is `{ zone: "" }`; a refused time carries its `classifyLocal` reason.
 */
export function stripOf(
  local: string,
  zoneSlots: readonly string[],
  lib: Hl7Lib,
): Hl7Strip {
  const calls: EdiCall[] = [];
  const utc = runCall(lib, "resolveLocal", local, "UTC", REJECT);
  const utcReading = utc.result as string;
  const rows: Hl7StripRow[] = zoneSlots.map((raw) => {
    const resolved = resolveInZone(local, raw, lib);
    const row: Hl7StripRow = { ...resolved, third: "" };
    if (resolved.zone !== "") {
      calls.push({
        fn: "resolveLocal",
        args: [local, resolved.zone, REJECT],
        result: resolved.instant,
      });
    }
    return row;
  });
  calls.push(utc);
  if (utcReading !== "") {
    for (const row of rows) {
      if (row.instant === "") continue;
      const diff = runCall(
        lib,
        "diffUtcAsDuration",
        row.instant,
        utcReading,
        "hours",
      );
      calls.push(diff);
      row.third = laterText(diff.result as string);
    }
  }
  const gap = widestGap(rows, lib);
  const instants = rows.filter((r) => r.instant !== "").map((r) => r.instant);
  if (gap !== null) {
    const min = runCall(lib, "minUtc", instants);
    const max = runCall(lib, "maxUtc", instants);
    calls.push(
      min,
      max,
      runCall(lib, "diffUtcAsDuration", min.result, max.result, "hours"),
    );
  }
  return { rows, utcReading, gap, calls };
}

// ---------------------------------------------------------------------------
// Why the sentinel
// ---------------------------------------------------------------------------

export const REASON_DEGREE =
  "The degree of precision after ^ is not one of Y L D H M S, or it is finer than the digits sent.";
export const REASON_PICTURE =
  "HL7 v2.5.1 2.A.22 reads one field, YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ], and for a TS a degree of precision after ^. A field that does not exist, an hour of 24, a second of 60, more than four fraction digits, a third component or a separator other than ^ is not read.";

/** The one sentence under NO SIGNAL, decided from a library probe, never guessed. */
export function sentinelText(read: Hl7Read, lib: Hl7Lib): string {
  const caret = read.value.indexOf("^");
  if (caret >= 0 && lib.parseHL7(read.value.slice(0, caret)) !== null) {
    return REASON_DEGREE;
  }
  return REASON_PICTURE;
}

// ---------------------------------------------------------------------------
// The picture: the value as sent, group by group
// ---------------------------------------------------------------------------

const PRECISIONS: readonly Hl7Precision[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "fraction",
];

const RUNGS: Record<
  Hl7Precision,
  { mask: string; word: string; group: "date" | "time" }
> = {
  year: { mask: "YYYY", word: "year", group: "date" },
  month: { mask: "MM", word: "month", group: "date" },
  day: { mask: "DD", word: "day", group: "date" },
  hour: { mask: "HH", word: "hour", group: "time" },
  minute: { mask: "MM", word: "minute", group: "time" },
  second: { mask: "SS", word: "second", group: "time" },
  fraction: { mask: ".S", word: "fraction", group: "time" },
};

interface Hl7Figure {
  halves: PicHalf[];
  separator: string;
  /** `no offset` when the value sent none, else `""`. */
  closing: string;
  aria: string;
}

/**
 * The value taken apart. The width of the group for precision p is the characters
 * `formatHL7(local, { precision: p })` adds to the rung before it, for each p up to the result's
 * precision. Digits sent past that precision (before any sign or `^`) are one dashed box, cut by
 * the degree and not read. The offset and the `^degree` are their own boxes. The null value and
 * the sentinel are one neutral box of the raw text.
 */
export function hl7Figure(read: Hl7Read, lib: Hl7Lib): Hl7Figure {
  const raw = read.value;
  const parsed = read.parsed;
  const plain = (): Hl7Figure => ({
    halves: plainHalves(raw),
    separator: "",
    closing: "",
    aria: figureAria(raw, "", plainHalves(raw), ""),
  });
  if (parsed === null || parsed.kind === "null") return plain();

  const caret = raw.indexOf("^");
  const body = caret < 0 ? raw : raw.slice(0, caret);
  const degree = caret < 0 ? "" : raw.slice(caret);
  const signAt = body.search(/[+-]/);
  const digits = signAt < 0 ? body : body.slice(0, signAt);
  const offsetText = signAt < 0 ? "" : body.slice(signAt);

  const fields: PicField[] = [];
  let written = "";
  for (const p of PRECISIONS) {
    const next = lib.formatHL7(parsed.local, { precision: p });
    if (next === "" || !next.startsWith(written)) return plain();
    if (
      p === parsed.precision ||
      PRECISIONS.indexOf(p) <= PRECISIONS.indexOf(parsed.precision)
    ) {
      const text = next.slice(written.length);
      const rung = RUNGS[p];
      fields.push({
        text,
        mask:
          p === "fraction"
            ? `.${"S".repeat(Math.max(text.length - 1, 1))}`
            : rung.mask,
        group: rung.group,
        word: rung.word,
      });
      written = next;
    }
    if (p === parsed.precision) break;
  }
  if (!digits.startsWith(written)) return plain();
  const cut = digits.slice(written.length);
  if (cut !== "") {
    fields.push({
      text: cut,
      mask: "",
      group: "none",
      word: "digits cut by the degree, not read",
      bracket: "cut by the degree, not read",
    });
  }
  if (offsetText !== "") {
    fields.push({
      text: offsetText,
      mask: offsetText.length <= 3 ? "±HH" : "±HHMM",
      group: "offset",
      word: "offset",
    });
  }
  if (degree !== "") {
    fields.push({
      text: degree,
      mask: "^D",
      group: "neutral",
      word: "degree of precision",
      bracket: "degree",
    });
  }
  const halves: PicHalf[] = [{ label: "", fields }];
  const closing = offsetText === "" ? "no offset" : "";
  return {
    halves,
    separator: "",
    closing,
    aria: figureAria(raw, "", halves, closing),
  };
}

// ---------------------------------------------------------------------------
// The writer ladder
// ---------------------------------------------------------------------------

/** What a ladder cell is: a library result, `no result`, a hint, or nothing. */
export interface LadderCell {
  text: string;
  state: "value" | "none" | "hint" | "empty";
}

const EMPTY_CELL: LadderCell = { text: "", state: "empty" };

interface Ladder {
  /** The third column's name. */
  third: string;
  rows: { precision: Hl7Precision; sent: LadderCell; offset: LadderCell }[];
  /** The calls printed once, as sentences; `""` when the ladder makes none. */
  note: string;
}

export const LADDER_HEAD_OFFSET = "With offset";
export const LADDER_HEAD_UTC = "In UTC (+0000)";

const LADDER_NOTE_NONE = "Nothing to write: there is no value.";
const LADDER_NOTE_PARTIAL_OFFSET =
  "A year, month, day or hour that carries an offset has no ISO 8601 form for formatHL7 to take, so this ladder makes no call.";
const LADDER_ONLY_LOWERS =
  "formatHL7 only lowers the precision, and a finer one returns no result.";

const writeCell = (text: string): LadderCell =>
  text === ""
    ? { text: NO_RESULT_TEXT, state: "none" }
    : { text, state: "value" };

/** The call a ladder prints, with its source text. */
const ladderCall = (source: string): string =>
  `formatHL7(${JSON.stringify(source)}, { precision })`;

/**
 * Seven rows, `year` to `fraction`, every cell a real `formatHL7` call. The source is the value's
 * own form: `fromOffsetInstant({ instant, offset })` for an instant, `local` for a value with no
 * offset. The second column writes it with an offset: zone 1's for a local value, `+00:00` for an
 * instant.
 */
export function ladderOf(
  read: Hl7Read,
  strip: Hl7Strip | null,
  lib: Hl7Lib,
): Ladder {
  const parsed = read.parsed;
  const emptyRows = (): Ladder["rows"] =>
    PRECISIONS.map((precision) => ({
      precision,
      sent: EMPTY_CELL,
      offset: EMPTY_CELL,
    }));
  if (parsed === null || parsed.kind === "null") {
    return {
      third: LADDER_HEAD_OFFSET,
      rows: emptyRows(),
      note: LADDER_NOTE_NONE,
    };
  }
  if (parsed.kind === "partial" && parsed.offset !== "") {
    return {
      third: LADDER_HEAD_OFFSET,
      rows: emptyRows(),
      note: LADDER_NOTE_PARTIAL_OFFSET,
    };
  }
  const write = (source: string, precision: Hl7Precision): LadderCell =>
    writeCell(lib.formatHL7(source, { precision }));

  if (parsed.kind === "instant") {
    const asSent = lib.fromOffsetInstant({
      instant: parsed.instant,
      offset: parsed.offset,
    });
    const inUtc = lib.fromOffsetInstant({
      instant: parsed.instant,
      offset: "+00:00",
    });
    return {
      third: LADDER_HEAD_UTC,
      rows: PRECISIONS.map((precision) => ({
        precision,
        sent: write(asSent, precision),
        offset: write(inUtc, precision),
      })),
      note: `As sent: ${ladderCall(asSent)}. In UTC: ${ladderCall(inUtc)}. ${LADDER_ONLY_LOWERS}`,
    };
  }

  const local = parsed.local;
  if (parsed.kind === "partial") {
    return {
      third: LADDER_HEAD_OFFSET,
      rows: PRECISIONS.map((precision) => ({
        precision,
        sent: write(local, precision),
        offset: EMPTY_CELL,
      })),
      note: `As sent: ${ladderCall(local)}. ${LADDER_ONLY_LOWERS}`,
    };
  }

  // A local value: the second column writes it with zone 1's offset.
  const first = strip?.rows[0];
  const withOffset =
    first !== undefined && first.instant !== "" && first.offset !== ""
      ? lib.fromOffsetInstant({ instant: first.instant, offset: first.offset })
      : "";
  const hint: LadderCell = {
    text:
      first === undefined || first.zone === ""
        ? "choose zone 1"
        : "zone 1 not resolved",
    state: "hint",
  };
  return {
    third: LADDER_HEAD_OFFSET,
    rows: PRECISIONS.map((precision) => ({
      precision,
      sent: write(local, precision),
      offset: withOffset === "" ? hint : write(withOffset, precision),
    })),
    note: `As sent: ${ladderCall(local)}.${withOffset === "" ? "" : ` With an offset: ${ladderCall(withOffset)}.`} ${LADDER_ONLY_LOWERS}`,
  };
}

// ---------------------------------------------------------------------------
// Every text a region can show, for the height it reserves (`families/edi/edi-hold.ts`)
// ---------------------------------------------------------------------------

/** The `classifyLocal` answers, to run `resolveReason` over every refusal it words. */
const refusal = (answer: "ambiguous" | "nonexistent" | null) =>
  `${LONGEST_ZONE}: ${resolveReason("2024-10-27T01:30:00", LONGEST_ZONE, {
    classifyLocal: () => answer,
  })}`;

/** The calls of the tallest reading: a local value in four zones with a widest gap. */
function tallestCalls(): EdiCall[] {
  const local = "2024-06-15T10:30:45.1234";
  const reading = "2024-06-15T10:30:45.1234Z";
  const at = "2024-06-15T05:00:45.1234Z";
  const instants = [at, at, at, at];
  return [
    ...[0, 1, 2, 3].map(() => ({
      fn: "resolveLocal",
      args: [local, LONGEST_ZONE, REJECT],
      result: at,
    })),
    { fn: "resolveLocal", args: [local, "UTC", REJECT], result: reading },
    ...[0, 1, 2, 3].map(() => ({
      fn: "diffUtcAsDuration",
      args: [at, reading, "hours"],
      result: "PT5H30M",
    })),
    { fn: "minUtc", args: [instants], result: at },
    { fn: "maxUtc", args: [instants], result: at },
    { fn: "diffUtcAsDuration", args: [at, at, "hours"], result: "PT0S" },
  ];
}

/** The texts each Reader region can show. */
export function hl7Texts() {
  const longestSource = "2024-06-15T10:30:45.1234+05:30";
  const calls = tallestCalls();
  const parse: EdiCall = {
    fn: "parseHL7",
    args: ["20240615103045.1234+0000^".padEnd(64, "0")],
    result: {
      kind: "instant",
      instant: "2024-06-15T10:30:45.1234Z",
      offset: "+00:00",
      local: "2024-06-15T10:30:45.1234",
      precision: "fraction",
    },
  };
  const callText = (list: readonly EdiCall[]): string =>
    list.map((c) => `${c.fn}(${callArgs(c.args)[1]})`).join("\n");
  return {
    descriptions: HL7_PRESETS.map((p) => p.description),
    stripNotes: [
      STRIP_NOTE_LOCAL,
      STRIP_NOTE_STATED,
      STRIP_NOTE_PARTIAL,
      STRIP_NOTE_NONE,
    ],
    details: [
      DETAIL_INSTANT,
      DETAIL_LOCAL,
      DETAIL_NULL,
      ...["year", "month", "day", "hour"].map(detailPartial),
    ],
    verdicts: [VERDICT_INSTANT, VERDICT_LOCAL, VERDICT_PARTIAL, VERDICT_NULL],
    gaps: [`Widest gap: 26 h, between ${LONGEST_ZONE} and ${LONGEST_ZONE}`],
    reasons: [REASON_DEGREE, REASON_PICTURE],
    refusals: [refusal("ambiguous"), refusal("nonexistent"), refusal(null)],
    ladderNotes: [
      LADDER_NOTE_NONE,
      LADDER_NOTE_PARTIAL_OFFSET,
      `As sent: ${ladderCall(longestSource)}. With an offset: ${ladderCall(longestSource)}. ${LADDER_ONLY_LOWERS}`,
    ],
    parseCall: callText([parse]),
    parseOutput: callResultsText([parse]),
    stripCall: callText(calls),
    stripOutput: callResultsText(calls),
    ladderWidest: "20240615103045.1234+0530",
  };
}
