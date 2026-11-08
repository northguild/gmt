/**
 * Pure helpers for the TAI64N Log Reader widget.
 *
 * The reader pastes log lines that start with a TAI64N label (daemontools, multilog, s6). Each
 * line shows the UTC instant `fromTai64n` reads from its label, the TAI reading, and TAI minus
 * UTC at that instant. The selected line is drawn large, and a second box writes a label from
 * an instant.
 *
 * No DOM. Every function that reads the library takes a `Tai64nLib` (`tai64n-lib.ts`), loaded
 * by the mount. The widget draws the library's results and computes none: it holds no digit
 * table, no epoch constant and no leap-second figure. The one piece of text handling is
 * `splitLog`, which cuts a line at its first space or tab. The token is passed to `fromTai64n`
 * whole: the site never tests it for an `@`, a length or a digit.
 *
 * Nothing sums, averages or compares the rows. A log spans many leap seconds, so no one figure
 * covers it.
 */

import { runCall, type EdiCall } from "./edi-widgets";
import { AUDIT_MAX_CHARS, AUDIT_MAX_LINES } from "./stored-time-audit";
import { TAI64N_PRESETS, type Tai64nPreset } from "./tai64n-presets";
import type { Tai64nLib } from "./tai64n-lib";
import { encodeWidgetPermalink } from "./widget-permalink";

export { TAI64N_PRESETS, type Tai64nPreset };

export const CUSTOM_PRESET_ID = "custom";

/** The most lines the tool reads, and the most characters it reads of each. */
export const LOG_MAX_LINES = AUDIT_MAX_LINES;
export const LOG_MAX_CHARS = AUDIT_MAX_CHARS;

/** The writer's box takes this many characters. */
export const INSTANT_MAX_CHARS = 64;

/** What a value cell shows when the library returned its sentinel. */
export const NO_SIGNAL = "⟨ NO SIGNAL ⟩";

export const NO_LABEL_BADGE = "no label";
export const INSERTED_BADGE = "inside an inserted second";

export const EMPTY_TEXT =
  "Paste log lines that start with a TAI64N label, or pick a preset.";

export const DROPPED_HINT = `The first ${LOG_MAX_LINES} lines are read.`;

/** Shown in place of the selected line when no line has a label. */
export const ALL_REFUSED_TEXT =
  "No line starts with a label fromTai64n reads: 16, 24 or 32 hex digits, @ optional, for an instant from 1972 to 9999.";

/** Shown under the plates when the selected line has no label. */
export const NO_LABEL_SENTENCE =
  "This line starts with no label fromTai64n reads.";

/** Shown under the plates when there is no line. */
export const NO_LINE_SENTENCE = "Give a log line to read its label.";

/** The widest texts the three plates can show, so a new row never resizes one. */
export const UTC_WIDEST = "9999-12-31T23:59:59.999999999Z";
export const TAI_WIDEST = "9999-12-31T23:59:59.999999999 TAI";
export const OFFSET_WIDEST = "99 s";

/** The writer's start: the instant the first preset's first line names. */
export const DEFAULT_INSTANT = "2024-01-01T00:00:00Z";

// ---------------------------------------------------------------------------
// State, seeds and lines
// ---------------------------------------------------------------------------

/** The widget's controls, as strings, which is what the DOM holds. */
export interface LogState {
  /** The textarea's text. */
  values: string;
  /** The selected line number, 1-based, or `null` for the default. */
  line: number | null;
  /** The writer's text. */
  instant: string;
}

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface Tai64nLogReaderArgs {
  values?: string;
  line?: string;
  instant?: string;
}

const isBlank = (s: string | undefined): boolean =>
  s === undefined || s.trim() === "";

/** Whether the args name anything, so the widget opens on them and not on a preset. */
export function isSeeded(args: Tai64nLogReaderArgs): boolean {
  return !isBlank(args.values) || !isBlank(args.instant);
}

/** The state of a preset. */
export function presetState(preset: Tai64nPreset): LogState {
  return {
    values: preset.lines.join("\n"),
    line: preset.selected,
    instant: DEFAULT_INSTANT,
  };
}

/** The seed as control values. Text the args leave out comes from the first preset. */
export function readArgs(args: Tai64nLogReaderArgs): LogState {
  const first = presetState(TAI64N_PRESETS[0]!);
  const line = Number(args.line);
  return {
    values: isBlank(args.values) ? first.values : (args.values ?? ""),
    line:
      args.line !== undefined &&
      Number.isInteger(line) &&
      line >= 1 &&
      line <= LOG_MAX_LINES
        ? line
        : null,
    instant: typeof args.instant === "string" ? args.instant : DEFAULT_INSTANT,
  };
}

export interface LogLine {
  /** The line as kept, cut to the character cap. */
  raw: string;
  /** Everything before the first space or tab, or the whole line. May be empty. */
  token: string;
  /** Everything after that one space or tab. */
  message: string;
}

export interface SplitLog {
  lines: LogLine[];
  /** How many lines were left out past the line cap. */
  dropped: number;
}

/**
 * Splits the text into log lines.
 *
 * Splits on newlines and removes one trailing carriage return from each line. Skips a line
 * that is empty or holds only whitespace. Keeps the first `LOG_MAX_LINES` and cuts each to
 * `LOG_MAX_CHARS`. The token is what comes before the first space or tab: no trimming, no case
 * folding, no test of what it holds. A line that starts with a space has an empty token.
 */
export function splitLog(text: string): SplitLog {
  const all = text
    .split("\n")
    .map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l))
    .filter((l) => l.trim() !== "");
  const kept = all.slice(0, LOG_MAX_LINES);
  const lines = kept.map((full): LogLine => {
    const raw = full.slice(0, LOG_MAX_CHARS);
    const cut = raw.search(/[ \t]/);
    return cut === -1
      ? { raw, token: raw, message: "" }
      : { raw, token: raw.slice(0, cut), message: raw.slice(cut + 1) };
  });
  return { lines, dropped: all.length - kept.length };
}

/** The permalink's strings: the lines as read, the selected line and the writer's text. */
export function permalinkOf(state: LogState): Record<string, string> {
  const { lines } = splitLog(state.values);
  const out: Record<string, string> = {};
  if (lines.length > 0) out["values"] = lines.map((l) => l.raw).join("\n");
  if (state.line !== null && lines.length > 0) out["line"] = String(state.line);
  if (state.instant !== "") out["instant"] = state.instant;
  return out;
}

/** The preset whose lines the text holds, or `custom`. */
export function matchPreset(text: string): string {
  const key = splitLog(text)
    .lines.map((l) => l.raw)
    .join("\n");
  return (
    TAI64N_PRESETS.find((p) => p.lines.join("\n") === key)?.id ??
    CUSTOM_PRESET_ID
  );
}

// ---------------------------------------------------------------------------
// Reading a line
// ---------------------------------------------------------------------------

export interface ReadLine {
  n: number;
  token: string;
  message: string;
  /** Whether `fromTai64n` read the token. */
  read: boolean;
  /** The UTC instant `fromTai64n` returned, or `""`. */
  utc: string;
  /** The TAI reading `toTAI` returned, or `""`. */
  tai: string;
  /** TAI minus UTC in seconds, as `taiMinusUtc` returned it, or `null`. */
  seconds: number | null;
  /** Whether `isLeapSecond` accepted the instant. */
  inserted: boolean;
  /** The calls made, in order. Those printed are those run. */
  calls: EdiCall[];
}

/** One line, read. Every field is the library's own, drawn as returned. */
export function readLogLine(
  line: LogLine,
  n: number,
  lib: Tai64nLib,
): ReadLine {
  const decoded = runCall(lib, "fromTai64n", line.token);
  const utc = decoded.result as string;
  const base = { n, token: line.token, message: line.message };
  if (utc === "") {
    return {
      ...base,
      read: false,
      utc: "",
      tai: "",
      seconds: null,
      inserted: false,
      calls: [decoded],
    };
  }
  const tai = runCall(lib, "toTAI", utc);
  const offset = runCall(lib, "taiMinusUtc", utc);
  const leap = runCall(lib, "isLeapSecond", utc);
  return {
    ...base,
    read: true,
    utc,
    tai: tai.result as string,
    seconds: offset.result as number | null,
    inserted: leap.result === true,
    calls: [decoded, tai, offset, leap],
  };
}

/** Every line, read. */
export function readLog(lines: readonly LogLine[], lib: Tai64nLib): ReadLine[] {
  return lines.map((l, i) => readLogLine(l, i + 1, lib));
}

/** The default selected line (1-based): the first with a label, else the first line. */
export function defaultLine(
  rows: readonly ReadLine[],
  preset: number | null = null,
): number | null {
  if (rows.length === 0) return null;
  if (preset !== null && preset >= 1 && preset <= rows.length) return preset;
  const first = rows.findIndex((r) => r.read);
  return first === -1 ? 1 : first + 1;
}

/** TAI minus UTC as the table and the plate print it. */
export function secondsText(seconds: number | null): string {
  return seconds === null ? "" : `${seconds} s`;
}

/** The sentence under the plates for a line the library read. */
export function lateSentence(seconds: number | null): string {
  return `A decoder that reads this label as Unix seconds prints the TAI reading as if it were UTC: ${seconds ?? ""} s late.`;
}

/** The longest sentence, held under the plates. */
export const LATE_SENTENCE_WIDEST = lateSentence(99);

/** The link to the Leap Second Timeline at the row's instant, or `null` with no instant. */
export function timelineLink(row: ReadLine | null): string | null {
  if (row === null || !row.read) return null;
  return encodeWidgetPermalink("leapline", { date: row.utc });
}

export const TIMELINE_LINK_TEXT = "TAI − UTC on this date";

// ---------------------------------------------------------------------------
// Writing a label
// ---------------------------------------------------------------------------

export interface Written {
  /** `toTai64n`'s label, or `""`. */
  label: string;
  /** `fromTai64n` of that label, or `""`. */
  back: string;
  calls: EdiCall[];
}

/** The writer's two results: the label, and the instant read back from it. */
export function writeLabel(instant: string, lib: Tai64nLib): Written {
  const wrote = runCall(lib, "toTai64n", instant);
  const label = wrote.result as string;
  if (label === "") {
    return { label: "", back: "", calls: [wrote] };
  }
  const back = runCall(lib, "fromTai64n", label);
  return {
    label,
    back: back.result as string,
    calls: [wrote, back],
  };
}
