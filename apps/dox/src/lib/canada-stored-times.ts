/**
 * The stored-times check of the Canada 2026 clock-change checker (CORE-88): the caps on what the
 * Dox Worker reads, and how a line gets its zone. Pure, and imports only constants, so the Worker and the
 * page share it. The Worker classifies; nothing here knows a zone's rules.
 *
 * Completing a zone uses only what the reader typed or picked: the site guesses none.
 */
import {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  cityOf,
  signedOffset,
} from "./canada-clock-change";

export interface StoredInputLine {
  /** 1-based line number in the input, blank lines counted. */
  line: number;
  /** The line as posted. */
  text: string;
}

export interface CappedInput {
  lines: StoredInputLine[];
  /** True when the byte cut or the line cut dropped anything. */
  truncated: boolean;
}

const LINE_BREAK = /\r\n|\r/g;

/** UTF-8 length of one code point. A lone surrogate encodes as U+FFFD: three bytes. */
function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * The text up to the last line break that sits at or before byte `maxBytes`. A character that
 * straddles the cut is always after that break, so it is dropped whole. No break in range:
 * nothing is kept.
 */
function cutAtBytes(text: string, maxBytes: number): string {
  let bytes = 0;
  let lastBreak = -1;
  for (let i = 0; i < text.length;) {
    const codePoint = text.codePointAt(i)!;
    if (codePoint === 10 && bytes <= maxBytes) {
      lastBreak = i;
    }
    bytes += utf8Length(codePoint);
    if (bytes > maxBytes) break;
    i += codePoint > 0xffff ? 2 : 1;
  }
  return lastBreak < 0 ? "" : text.slice(0, lastBreak);
}

/**
 * Caps the posted text. Line breaks are first made `\n` (`\r\n` and `\r` each count once): a
 * `FormData` body sends every line break as CR LF (WHATWG HTML 4.10.22.8), so the bytes that
 * arrive are not the bytes the reader typed. Over `STORED_MAX_BYTES` of UTF-8 the text is cut at
 * the last line break at or before that byte; then it is split on `\n`, blank lines are skipped
 * (their numbers still count) and the first `STORED_MAX_LINES` non-blank lines are kept.
 * `truncated` is true only when a dropped part holds a non-blank character.
 */
export function capStoredInput(text: string): CappedInput {
  let truncated = false;
  let body = text.replace(LINE_BREAK, "\n");
  if (new TextEncoder().encode(body).length > STORED_MAX_BYTES) {
    const kept = cutAtBytes(body, STORED_MAX_BYTES);
    if (/\S/.test(body.slice(kept.length))) truncated = true;
    body = kept;
  }
  const lines: StoredInputLine[] = [];
  const parts = body.split("\n");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.trim() === "") continue;
    if (lines.length === STORED_MAX_LINES) {
      truncated = true;
      break;
    }
    lines.push({ line: i + 1, text: part });
  }
  return { lines, truncated };
}

/**
 * A zone name as RFC 9557 4.1 writes it: each part starts with ALPHA, `.` or `_`, and no part is
 * `.` or `..`.
 */
const ZONE_TOKEN =
  /^(?!\.\.?(?:\/|$))[A-Za-z._][A-Za-z0-9._+-]*(?:\/(?!\.\.?(?:\/|$))[A-Za-z._][A-Za-z0-9._+-]*)*$/;

/**
 * The string to classify, or `null` when the line is not in a form this check completes:
 * - a `[` anywhere: the line as written;
 * - two tokens, the second shaped like a zone name (RFC 9557 4.1: it starts with a letter, `.`
 *   or `_`) and without `[`: `<time> <Zone>` becomes `<time>[<Zone>]`;
 * - one token: `<time>[<picked zone>]`;
 * - anything else: `null`.
 */
export function completeStoredLine(line: string, zone: string): string | null {
  const trimmed = line.trim();
  if (trimmed.includes("[")) return trimmed;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 2 && ZONE_TOKEN.test(tokens[1]!)) {
    return `${tokens[0]}[${tokens[1]}]`;
  }
  if (tokens.length === 1 && tokens[0] !== "") return `${tokens[0]}[${zone}]`;
  return null;
}

/**
 * The example lines. The first five are Toronto lines that give one of each kind on any tz
 * data; the last three are Canadian lines whose kind changed in 2026. The labels here never
 * claim a kind: the Worker's answer is what shows.
 */
export const STORED_PRESET: string = [
  "2026-07-01T12:00:00-04:00[America/Toronto]",
  "2026-11-01T01:30:00-04:00[America/Toronto]",
  "2026-07-01T12:00:00-05:00[America/Toronto]",
  "2026-11-01T01:30:00-06:00[America/Toronto]",
  "2027-03-14T02:30:00-05:00[America/Toronto]",
  "2026-11-15T09:00:00-08:00[America/Vancouver]",
  "2027-03-14T02:30:00-07:00[America/Edmonton]",
  "2026-11-01T01:30:00-05:00[America/Winnipeg]",
].join("\n");

/** One checked line in plain words: still correct, or moved and by how much. */
export interface StoredVerdict {
  ok: boolean;
  /** "Still correct", or "Moved: ..." with the plain reason. */
  words: string;
}

/** `HH:MM` and the day shift of a UTC instant (`...THH:mm...Z`) read at a `±hh:mm` offset. */
function localOf(instant: string, offset: string): { hm: string; days: number } | null {
  const hours = Number(instant.slice(11, 13));
  const minutes = Number(instant.slice(14, 16));
  const offHours = Number(offset.slice(1, 3));
  const offMinutes = Number(offset.slice(4, 6));
  if (![hours, minutes, offHours, offMinutes].every(Number.isFinite)) return null;
  const sign = offset.startsWith("-") ? -1 : 1;
  const total = hours * 60 + minutes + sign * (offHours * 60 + offMinutes);
  const days = Math.floor(total / 1440);
  const inDay = total - days * 1440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { hm: `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`, days };
}

/**
 * What the server's classification means for a reader: a time that still names the moment it was
 * saved for is "Still correct"; a stored offset the zone no longer has is read at the zone's own
 * offset, which is the local time it now means. Pure.
 */
export function storedVerdict(result: {
  kind: string;
  zoneOffset?: string;
  atStoredOffset?: string;
}): StoredVerdict {
  switch (result.kind) {
    case "valid":
    case "validInOverlap":
      return { ok: true, words: "Still correct" };
    case "offsetMismatch": {
      const local =
        result.atStoredOffset !== undefined && result.zoneOffset !== undefined
          ? localOf(result.atStoredOffset, result.zoneOffset)
          : null;
      if (local === null) return { ok: false, words: "Moved: the saved offset is no longer the zone's" };
      const day = local.days === 0 ? "" : local.days > 0 ? " the next day" : " the day before";
      return { ok: false, words: `Moved: shows ${local.hm} local${day}` };
    }
    case "ambiguous":
      return { ok: false, words: "Moved: this time happens twice" };
    default:
      return { ok: false, words: "Moved: this time no longer exists" };
  }
}

/** One checked line for the "Check saved times" table: the Result and the What to do cells. */
export interface StoredAdvice {
  /** True when nothing needs fixing. */
  ok: boolean;
  /** The Result cell's words, without the mark. */
  label: string;
  /** The What to do cell: a sentence or two, with the readings the check returned. */
  todo: string;
  /** City and local time the sentences name, or `null` when the value has no readable local time. */
  city: string | null;
}

/** The `{ hm, city }` a saved string names: `2026-11-15T09:00:00-08:00[America/Vancouver]`. */
function savedPlace(value: string | null): { time: string; city: string } | null {
  if (value === null) return null;
  const match = /T(\d{2}):(\d{2})[^[]*\[([^\]]+)\]/.exec(value);
  if (match === null) return null;
  return {
    time: `${Number(match[1])}:${match[2]}`,
    city: cityOf(match[3]!),
  };
}

type AdviceResult = {
  kind: string;
  instant?: string;
  earlier?: string;
  later?: string;
  storedOffset?: string;
  zoneOffset?: string;
  atStoredOffset?: string;
  atZoneOffset?: string;
};

/**
 * What a reader does about one classified saved time, in plain words, from the readings
 * `classifyStoredZoned` returned. `value` is the saved string as checked. Pure.
 */
export function storedAdvice(
  value: string | null,
  result: AdviceResult | null,
): StoredAdvice {
  const place = savedPlace(value);
  const where = place === null ? "that place" : place.city;
  const at = place === null ? "this time" : `${place.time} in ${where}`;
  if (result === null) {
    return {
      ok: false,
      label: "Not a saved time",
      todo: "Not a saved time with an offset and a place.",
      city: null,
    };
  }
  const city = place?.city ?? null;
  switch (result.kind) {
    case "valid":
      return {
        ok: true,
        label: "Still correct",
        todo: `Nothing: ${at}.`,
        city,
      };
    case "validInOverlap": {
      const which = result.instant === result.earlier ? "first" : "second";
      return {
        ok: true,
        label: "Still correct",
        todo: `Nothing: ${at} happens twice that day, and the saved offset picks the ${which} one.`,
        city,
      };
    }
    case "offsetMismatch": {
      const old =
        result.atStoredOffset !== undefined && result.zoneOffset !== undefined
          ? localOf(result.atStoredOffset, result.zoneOffset)
          : null;
      const day =
        old === null || old.days === 0
          ? ""
          : old.days > 0
            ? " the next day"
            : " the day before";
      return {
        ok: false,
        label: "Offset out of date",
        todo:
          `Saved with ${signedOffset(result.storedOffset ?? "")}, but ${where} is now ${signedOffset(result.zoneOffset ?? "")}. ` +
          `To keep ${place?.time ?? "the local time"} local, store ${result.atZoneOffset} (atZoneOffset). ` +
          `The old UTC time, ${result.atStoredOffset}, is now ${old === null ? "a different time" : old.hm}${day} local.`,
        city,
      };
    }
    case "ambiguous":
      return {
        ok: false,
        label: "Offset fits neither reading",
        todo: `${at} happens twice that day, and the saved offset fits neither. Pick one: ${result.earlier} (first) or ${result.later} (second).`,
        city,
      };
    default:
      return {
        ok: false,
        label: "Time does not exist",
        todo: `${at} is skipped when the clocks go forward. Pick one: ${result.earlier} (before the gap) or ${result.later} (after it).`,
        city,
      };
  }
}

/** The zone a checked value names: `2026-11-15T09:00:00-08:00[America/Vancouver]` gives `America/Vancouver`. */
export function storedZoneOf(value: string | null): string | null {
  if (value === null) return null;
  return /\[([^\]]+)\]\s*$/.exec(value)?.[1] ?? null;
}

/**
 * The line shown for a saved time the check cannot judge: the data doing the check is older than
 * the change for this place, so any verdict it gave would be backwards.
 */
export function staleCheckText(zone: string | null, places?: readonly string[]): string {
  const where =
    places !== undefined && places.length > 1
      ? new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(places)
      : zone === null
        ? "this place"
        : cityOf(zone);
  return `This check\u2019s time zone data is older than the change for ${where}, so it can\u2019t tell. Try again later, or run the command in Test your own servers.`;
}

export type BadgeTone = "ok" | "bad" | "unknown" | "none";

/** The status pill of one row: its tone and its words. Never a verdict for a zone the data is stale for. */
export function storedBadge(
  result: AdviceResult | null,
  stale: boolean,
): { tone: BadgeTone; label: string; mark: string } {
  if (result === null) return { tone: "none", label: "Not a saved time", mark: "" };
  if (stale) return { tone: "unknown", label: "Can\u2019t check yet", mark: "" };
  switch (result.kind) {
    case "valid":
    case "validInOverlap":
      return { tone: "ok", label: "Still right", mark: "\u2713" };
    case "offsetMismatch": {
      const stored = result.storedOffset;
      const zone = result.zoneOffset;
      if (stored === undefined || zone === undefined) {
        return { tone: "bad", label: "Shows the wrong time", mark: "\u2717" };
      }
      const minutes = Math.abs(offsetMinutes(zone) - offsetMinutes(stored));
      const words =
        minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
      return { tone: "bad", label: `Shows ${words} off`, mark: "\u2717" };
    }
    case "ambiguous":
      return { tone: "bad", label: "Happens twice", mark: "\u2717" };
    default:
      return { tone: "bad", label: "Does not exist", mark: "\u2717" };
  }
}

function offsetMinutes(offset: string): number {
  const sign = offset.startsWith("-") ? -1 : 1;
  return sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
}

/**
 * What to store for a moved line: keep the local time and put the place's own offset on it, or
 * keep the old instant, which now reads as `oldLocal`. `null` for any other kind.
 */
export function storedFix(
  value: string | null,
  result: AdviceResult | null,
): { keepLocal: string; localHm: string; oldLocal: string | null } | null {
  if (value === null || result === null || result.kind !== "offsetMismatch") return null;
  if (result.zoneOffset === undefined) return null;
  const keepLocal = value.replace(/[+-]\d{2}:\d{2}(?=\[)/, result.zoneOffset);
  if (keepLocal === value) return null;
  const old =
    result.atStoredOffset === undefined ? null : localOf(result.atStoredOffset, result.zoneOffset);
  const day = old === null || old.days === 0 ? "" : old.days > 0 ? " the next day" : " the day before";
  const place = savedPlace(value);
  return {
    keepLocal,
    localHm: place?.time ?? "the local time",
    oldLocal: old === null ? null : `${Number(old.hm.slice(0, 2))}:${old.hm.slice(3)}${day}`,
  };
}

/** True when some non-blank line has no zone of its own, so the zone picker is needed. */
export function needsZonePicker(text: string): boolean {
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== "")
    .some((line) => {
      const t = line.trim();
      if (t.includes("[")) return false;
      const tokens = t.split(/\s+/);
      return !(tokens.length === 2 && ZONE_TOKEN.test(tokens[1]!));
    });
}
