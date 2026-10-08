/**
 * Pure helpers for the X12 Time Reader (INT-15).
 *
 * The main section reads the three elements a freight segment carries side by
 * side: a date (element 373), a time (element 337) and a time code (element
 * 623), as `AT7` in a 214, `G62` in a 204 and `DTM-02`/`03`/`04` carry them.
 * One call reads all three: `parseX12DateTime(date, time, timeCode)`. X12 is a
 * United States standard.
 *
 * A second, smaller section reads a data element 1251 value against its 1250
 * qualifier with `parseX12DateTimePeriod`. A qualifier has no time code, and no
 * instant.
 *
 * Every parsed member, time-code verdict, instant, offset in force and
 * written-back value is a real `EdiLib` call. The site-side code only builds the
 * argument list of the call it prints (`parseArgs`), builds the string a
 * formatter takes from the members a parser returned (`isoOf`), and formats a
 * returned duration as "15 h". Nothing here derives a zone from a time code, a
 * zone name, a place or a partner. A preset is an example and states its own
 * zones, written by hand beside its description; every other zone is the
 * reader's pick.
 *
 * No DOM and no gmt import: the library comes in from the mount.
 *
 * Naming rule: strings here name codes and standards as data (ANSI X12 data
 * elements 373, 337, 623, 1250 and 1251) and nothing else: no law, no
 * rule-making body, no carrier, partner or business event. The only segments
 * named are `AT7`, `G62` and `DTM`, as carriers of the date, the time and the
 * time code.
 */

import {
  figureTail,
  isoNote,
  LONGEST_ZONE,
  isoOf,
  needsYearWindow,
  resolveInZone,
  yearWindowNote,
  yearWindowOptions,
  type EdiLib,
  type EdiResult,
} from "./edi-widgets";
import {
  figureAria,
  picHalves,
  plainHalves,
  type PicField,
  type PicHalf,
  type PicPart,
} from "./edi-picture";
import { cutValue, shapeOf } from "./edi-shape";

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State and args
// ---------------------------------------------------------------------------

/** What a chat call or a permalink hands over. */
export interface X12TimeReaderArgs {
  /** Element 373, as sent. */
  date?: string;
  /** Element 337, as sent. */
  time?: string;
  /** Element 623, as sent. */
  timeCode?: string;
  /** The first zone the reader picked. */
  zone?: string;
  zone2?: string;
  zone3?: string;
  zone4?: string;
  /** The 1250 qualifier of the `DTP` section. */
  format?: string;
  /** The element 1251 value of the `DTP` section. */
  value?: string;
  yearWindow?: string | number;
}

/** What the main section's DOM holds: all strings. */
export interface X12State {
  date: string;
  time: string;
  timeCode: string;
  zones: [string, string, string, string];
}

/** What the `DTP` section's DOM holds: all strings. */
export interface DtpState {
  format: string;
  value: string;
  yearWindow: string;
}

// ---------------------------------------------------------------------------
// The call that is printed
// ---------------------------------------------------------------------------

/**
 * The arguments of the one `parseX12DateTime` call, exactly as the library is
 * called and exactly as the call line prints them. A blank optional element is
 * left out of the call; a blank element before a sent one is the empty string,
 * which the library reads as "not sent".
 */
export function parseArgs(state: X12State): string[] {
  const args = [state.date.trim(), state.time.trim(), state.timeCode.trim()];
  while (args.length > 0 && args[args.length - 1] === "") args.pop();
  return args;
}

/** Whether nothing was typed into any of the three elements. */
export function mainBlank(state: X12State): boolean {
  return parseArgs(state).length === 0;
}

// ---------------------------------------------------------------------------
// Presets: the main section
// ---------------------------------------------------------------------------

export interface X12Preset {
  id: string;
  label: string;
  description: string;
  date: string;
  time: string;
  timeCode: string;
  /**
   * The example's own zones, literal and hand-written. Blank where the strip
   * does not apply (an offset code, a date or a time alone, a refused value).
   * Nothing derives them from `timeCode`.
   */
  zones: [string, string, string, string];
}

/**
 * A preset is an example, and an example may state its place: each preset that
 * states no offset carries the zones that make it most informative, and says in
 * its description that the zone is the example's pick. Typing a time code never
 * fills a zone.
 */
export const X12_PRESETS: readonly X12Preset[] = [
  {
    id: "status-et",
    label: "A time with time code ET",
    description:
      "ET names a zone and says neither standard nor daylight. X12 states no offset for it, so the instant needs an IANA zone. This example reads it in two places on Eastern time: America/New_York, which is on daylight time on this June date, and America/Atikokan in Ontario, which keeps standard time all year. They are an hour apart, so the name alone does not fix the offset. Both zones are the example's picks, not something X12 or the code says: pick the zone your message means.",
    date: "20240615",
    time: "1430",
    timeCode: "ET",
    // Two places a reader might mean by Eastern: New York changes clocks in summer, Atikokan does not,
    // so the same wall clock is two instants. The code does not choose either.
    zones: ["America/New_York", "America/Atikokan", "", ""],
  },
  {
    id: "status-ed",
    label: "The same time with ED",
    description:
      "ED names the same zone as ET and adds that it is daylight time. It still states no offset. This example reads it in America/New_York, which is on daylight time on this June date, so the flag and the zone agree. The zone is the example's pick: change it to the zone your message means.",
    date: "20240615",
    time: "1430",
    timeCode: "ED",
    // A summer date, so the zone is on daylight time as the flag says.
    zones: ["America/New_York", "", "", ""],
  },
  {
    id: "status-es",
    label: "ES: standard time, in January",
    description:
      "ES names the same zone as ET and adds that it is standard time. It states no offset. This example uses a January date and reads it in America/New_York, which is on standard time then, so the flag and the zone agree. The zone is the example's pick: change it to the zone your message means.",
    date: "20240115",
    time: "1430",
    timeCode: "ES",
    // A winter date, so the zone is on standard time as the flag says.
    zones: ["America/New_York", "", "", ""],
  },
  {
    id: "status-ut",
    label: "The same time with UT",
    description:
      "UT states an offset of +00:00, so the date and the time name one instant with no zone to pick.",
    date: "20240615",
    time: "1430",
    timeCode: "UT",
    zones: ["", "", "", ""],
  },
  {
    id: "code-13",
    label: "Code 13: the run counts down",
    description:
      "Codes 13 to 24 run downward from UTC-12 to UTC-1. Code 13 is UTC-12, not UTC-1, so the instant falls on the next UTC day.",
    date: "20240615",
    time: "1430",
    timeCode: "13",
    zones: ["", "", "", ""],
  },
  {
    id: "code-24",
    label: "Code 24: the other end of the run",
    description:
      "Code 24 is UTC-1, the last of the downward run that starts at 13. The date and the time are the same as for code 13.",
    date: "20240615",
    time: "1430",
    timeCode: "24",
    zones: ["", "", "", ""],
  },
  {
    id: "hundredths",
    label: "A time with hundredths",
    description:
      "Element 337 can carry tenths or hundredths of a second. The library reads them and does not write them back, so the written-back time shows NO SIGNAL. The four zones are this example's picks, so the strip shows the instants: change them to the places your message means.",
    date: "20240615",
    time: "14300012",
    timeCode: "",
    // Two US offices, a European port and an Asian origin of one shipment: the four zones the DTM Decoder's 203 example reads.
    zones: ["America/New_York", "Europe/Berlin", "Asia/Shanghai", "America/Los_Angeles"],
  },
  {
    id: "no-code",
    label: "A time and no time code",
    description:
      "With no time code the time is local to the event, and the place is elsewhere in the message. The library returns the local date-time and never reads it as UTC. The four zones are this example's picks, not something the message says: change them to the places your message means.",
    date: "20240615",
    time: "1430",
    timeCode: "",
    // Two US offices, a European port and an Asian origin of one shipment: the four zones the DTM Decoder's 203 example reads.
    zones: ["America/New_York", "Europe/Berlin", "Asia/Shanghai", "America/Los_Angeles"],
  },
  {
    id: "local-lt",
    label: "Time code LT: local to the event",
    description:
      "LT says the time is local to the event, whose place is elsewhere in the message. The zone is yours to supply. The four here are this example's picks, not something LT says: change them to the places your message means.",
    date: "20240615",
    time: "1430",
    timeCode: "LT",
    // Two US offices, a European port and an Asian origin of one shipment: the four zones the DTM Decoder's 203 example reads.
    zones: ["America/New_York", "Europe/Berlin", "Asia/Shanghai", "America/Los_Angeles"],
  },
  {
    id: "date-only",
    label: "A date only",
    description:
      "A segment may carry a date and no time. A date alone names no instant in any zone.",
    date: "20240615",
    time: "",
    timeCode: "",
    zones: ["", "", "", ""],
  },
  {
    id: "time-only",
    label: "A time only",
    description:
      "A segment may carry a time and no date. A time alone names no instant: it is on no day.",
    date: "",
    time: "1430",
    timeCode: "",
    zones: ["", "", "", ""],
  },
  {
    id: "code-no-time",
    label: "A time code with no time",
    description:
      "A time code qualifies a time, so X12 requires the time whenever the code is sent. A date and a code with no time return NO SIGNAL.",
    date: "20240615",
    time: "",
    timeCode: "ET",
    zones: ["", "", "", ""],
  },
];

export function presetState(preset: X12Preset): X12State {
  return {
    date: preset.date,
    time: preset.time,
    timeCode: preset.timeCode,
    zones: [...preset.zones],
  };
}

const trimmed = (s: X12State): X12State => ({
  date: s.date.trim(),
  time: s.time.trim(),
  timeCode: s.timeCode.trim(),
  zones: s.zones.map((z) => z.trim()) as X12State["zones"],
});

/** The preset whose every field equals the state's (trimmed), else custom. */
export function matchPreset(state: X12State): string {
  const s = trimmed(state);
  const hit = X12_PRESETS.find((p) => {
    const t = trimmed(presetState(p));
    return (
      t.date === s.date &&
      t.time === s.time &&
      t.timeCode === s.timeCode &&
      t.zones.every((z, i) => z === s.zones[i])
    );
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// Presets: the DTP section
// ---------------------------------------------------------------------------

export interface DtpPreset {
  id: string;
  label: string;
  description: string;
  format: string;
  value: string;
  yearWindow: string;
}

export const DTP_PRESETS: readonly DtpPreset[] = [
  {
    id: "range-rd8",
    label: "RD8: a range of dates",
    description:
      "A range of dates is sent with a hyphen between its two ends. It names no instant, and a qualifier has no time code.",
    format: "RD8",
    value: "20240615-20240620",
    yearWindow: "",
  },
  {
    id: "ordinal-tc",
    label: "TC: a day of the year with no year",
    description:
      "TC keeps only the day of the year. With no year there is no date, so nothing can be written back.",
    format: "TC",
    value: "166",
    yearWindow: "",
  },
  {
    id: "overnight-rtm",
    label: "RTM: a window that crosses midnight",
    description:
      "A window that crosses midnight is read as written: the start is 22:00 and the end is 06:00. The value does not say which day either time falls on.",
    format: "RTM",
    value: "2200-0600",
    yearWindow: "",
  },
  {
    id: "d6-no-window",
    label: "D6: a two-digit year, no window",
    description:
      "D6 has a two-digit year, and no standard says which century it belongs to. With no window the library returns NO SIGNAL. A two-digit year is a legacy form.",
    format: "D6",
    value: "240615",
    yearWindow: "",
  },
  {
    id: "d6-window",
    label: "D6: a two-digit year, window from 2000",
    description:
      "The same value with a window that starts in 2000, so 24 is read as 2024. A fixed window gives the same answer in any year.",
    format: "D6",
    value: "240615",
    yearWindow: "2000",
  },
];

export function dtpPresetState(preset: DtpPreset): DtpState {
  return {
    format: preset.format,
    value: preset.value,
    yearWindow: preset.yearWindow,
  };
}

/** The `DTP` preset whose every field equals the state's (trimmed), else custom. */
export function matchDtpPreset(state: DtpState): string {
  const hit = DTP_PRESETS.find(
    (p) =>
      p.format === state.format.trim() &&
      p.value === state.value.trim() &&
      p.yearWindow === state.yearWindow.trim(),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// Args and permalinks
// ---------------------------------------------------------------------------

const text = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

/** Whether a chat call or a permalink seeds the widget: any of the three
 *  elements or the `DTP` pair is defined. */
export function isSeeded(args: X12TimeReaderArgs): boolean {
  return (
    args.date !== undefined ||
    args.time !== undefined ||
    args.timeCode !== undefined ||
    args.format !== undefined ||
    args.value !== undefined
  );
}

/** The states a seed names. A string is kept as typed, a numeric `yearWindow`
 *  becomes its text, and an absent key is blank. Nothing falls back to a
 *  preset. */
export function readArgs(args: X12TimeReaderArgs): {
  main: X12State;
  dtp: DtpState;
} {
  return {
    main: {
      date: text(args.date),
      time: text(args.time),
      timeCode: text(args.timeCode),
      zones: [
        text(args.zone),
        text(args.zone2),
        text(args.zone3),
        text(args.zone4),
      ],
    },
    dtp: {
      format: text(args.format),
      value: text(args.value),
      yearWindow: text(args.yearWindow),
    },
  };
}

/** Strings only, and only non-blank fields. `date`, `time` and `timeCode` are
 *  the keys the content pages link with. */
export function permalinkOf(
  main: X12State,
  dtp: DtpState,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, value: string): void => {
    const v = value.trim();
    if (v !== "") out[key] = v;
  };
  put("date", main.date);
  put("time", main.time);
  put("timeCode", main.timeCode);
  put("zone", main.zones[0]);
  put("zone2", main.zones[1]);
  put("zone3", main.zones[2]);
  put("zone4", main.zones[3]);
  put("format", dtp.format);
  put("value", dtp.value);
  put("yearWindow", dtp.yearWindow);
  return out;
}

// ---------------------------------------------------------------------------
// What the parser returned: the members and the verdict
// ---------------------------------------------------------------------------

export type MemberKey =
  | "date"
  | "time"
  | "local"
  | "instant"
  | "offset"
  | "zone"
  | "daylight";

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
  { key: "zone", role: "member-zone", label: "Zone name" },
  { key: "daylight", role: "member-daylight", label: "Daylight" },
];

/** The member's text, or `null` when the result does not hold it. `daylight`
 *  (`true`, `false` or `null`) is shown as `daylight`, `standard` or `not said`. */
export function memberText(result: EdiResult, key: MemberKey): string | null {
  const v = result[key];
  if (v === undefined) return null;
  // The flag is shown as its meaning, as the verdict says it. The call line
  // keeps the literal `true`, `false` or `null` the library returned.
  if (key === "daylight") return v === true ? "daylight" : v === false ? "standard" : "not said";
  return String(v);
}

export interface Verdict {
  verdict: string;
  detail: string;
}

const NO_DAY = " A time alone names no instant: it is on no day.";

/**
 * What the elements state, in words, decided by the result's own members.
 * `null` (the sentinel) has no verdict.
 */
export function verdictOf(result: EdiResult | null): Verdict {
  if (result === null) return { verdict: "", detail: "" };
  const timeAlone = result.date === undefined && result.time !== undefined;
  if (result.offset !== undefined) {
    return {
      verdict: `Offset stated: ${result.offset}`,
      detail:
        result.instant !== undefined
          ? "The time code gives the offset from UTC, so the date and the time name one instant."
          : `The time code gives the offset from UTC.${NO_DAY}`,
    };
  }
  if (result.zone === "Local") {
    return {
      verdict: "Nothing stated: local to the event",
      detail: `The place is elsewhere in the message. You supply its zone.${timeAlone ? NO_DAY : ""}`,
    };
  }
  if (result.zone !== undefined) {
    const daylight =
      result.daylight === true
        ? "daylight"
        : result.daylight === false
          ? "standard"
          : "not said";
    const said =
      result.daylight === true
        ? "The code says daylight time."
        : result.daylight === false
          ? "The code says standard time."
          : "The code says neither standard nor daylight, so the date decides.";
    return {
      verdict: `Zone named, offset not stated: ${result.zone} (${daylight})`,
      detail: `${said} X12 states no offset for a named zone.${timeAlone ? NO_DAY : ""}`,
    };
  }
  if (result.time === undefined) {
    return {
      verdict: "A date only",
      detail: "A date alone names no instant in any zone.",
    };
  }
  if (result.date === undefined) {
    return {
      verdict: "A time only: a time alone names no instant",
      detail:
        "There is no date and no time code, so nothing says which day or where the clock was.",
    };
  }
  return {
    verdict: "Nothing stated: no time code was sent",
    detail:
      "A blank time code means local to the event. The place is elsewhere in the message. You supply its zone.",
  };
}

// ---------------------------------------------------------------------------
// The instant, and the strip
// ---------------------------------------------------------------------------

const REJECT_NOTE =
  'Read with disambiguation: "reject": a time the clock shows twice or never is not resolved.';

/** The strip applies to a local date-time that states no offset. */
export function stripApplies(result: EdiResult | null): boolean {
  return (
    result !== null &&
    result.local !== undefined &&
    result.offset === undefined &&
    result.instant === undefined
  );
}

const STRIP_NOTE_NONE = "No value.";
const STRIP_NOTE_STATED =
  "The time code states the offset, so there is nothing to choose.";
const STRIP_NOTE_ALONE =
  "A date or a time alone names no instant in any zone.";

/** The line above the strip, by what the result holds. */
export function stripNote(result: EdiResult | null): string {
  if (result === null) return STRIP_NOTE_NONE;
  if (stripApplies(result)) {
    return `The elements state no offset. Each zone above is a pick, from the example or from you, and not something the elements say: the same digits, read there. Every row uses resolveLocal with disambiguation: "reject", so a time the clock shows twice or never is not resolved.`;
  }
  if (result.instant !== undefined) return STRIP_NOTE_STATED;
  return STRIP_NOTE_ALONE;
}

export interface XGapRow {
  zone: string;
  instant: string;
  offset: string;
  /** `fromOffsetInstant` of the instant and the offset in force. */
  withOffset: string;
  /** Why `resolveLocal` returned `""`, else `""`. */
  reason: string;
}

/**
 * One row per zone slot. Each resolved row is `resolveLocal(local, zone,
 * { disambiguation: "reject" })`, then `toOffsetInstant(instant, zone).offset`,
 * then `fromOffsetInstant({ instant, offset })`. A blank slot is `{ zone: "" }`;
 * a refused time carries its reason.
 */
export function gapRows(
  local: string,
  zones: readonly string[],
  lib: EdiLib,
): XGapRow[] {
  return zones.map((raw) => {
    const row = { ...resolveInZone(local, raw, lib), withOffset: "" };
    if (row.offset !== "") {
      row.withOffset = lib.fromOffsetInstant({
        instant: row.instant,
        offset: row.offset,
      });
    }
    return row;
  });
}

export interface InstantPlan {
  /** What the output slot shows. */
  kind: "stated" | "resolve" | "none";
  /** The note under it. */
  note: string;
}

/**
 * Which step fixes the instant, or why none does:
 *  - `stated`: the result holds an `instant`, so the library already named it;
 *  - `resolve`: a local date-time and a zone the reader picked, so the first
 *    chosen zone's `resolveLocal` call is shown;
 *  - `none`: no call, and the note says why.
 */
export function instantPlan(
  result: EdiResult | null,
  zones: readonly string[],
): InstantPlan {
  if (result === null) return { kind: "none", note: "No value." };
  if (result.instant !== undefined) {
    return {
      kind: "stated",
      note: "This is the instant member of the call above: the local date-time read at the offset the time code states.",
    };
  }
  if (result.local === undefined) {
    if (result.time !== undefined) {
      return {
        kind: "none",
        note: "A time alone names no instant: there is no date.",
      };
    }
    return { kind: "none", note: "A date alone names no instant." };
  }
  if (zones.some((z) => z.trim() !== "")) {
    return { kind: "resolve", note: REJECT_NOTE };
  }
  if (result.zone !== undefined && result.zone !== "Local") {
    return {
      kind: "none",
      note: `No instant: the code names ${result.zone} time and states no offset. Pick the IANA zone it means for you.`,
    };
  }
  return {
    kind: "none",
    note: "No instant: nothing here states an offset. Pick the zone.",
  };
}

// ---------------------------------------------------------------------------
// Why null: the main section
// ---------------------------------------------------------------------------

export type X12NullReason =
  | "bad-date"
  | "bad-time"
  | "not-a-code"
  | "needs-time"
  | "bad-combination";

export const NULL_REASON_TEXT: Record<
  X12NullReason,
  (context: { timeCode: string }) => string
> = {
  "bad-date": () =>
    "The date is not a CCYYMMDD date: it has a four-digit year and names a day that exists.",
  "bad-time": () =>
    "The time is not one of the four element 337 forms: HHMM, HHMMSS, HHMMSSD or HHMMSSDD, with an hour from 00 to 23 and a minute and second from 00 to 59.",
  "not-a-code": ({ timeCode }) =>
    `${timeCode} is not a 623 time code. A code is two characters, upper case, and an abbreviation is not a code.`,
  "needs-time": () =>
    "A time code qualifies a time, so X12 requires the time whenever the code is sent. Send a time, or leave the time code out.",
  "bad-combination": () => "These elements do not fit together.",
};

export function nullReasonText(
  reason: X12NullReason,
  state: X12State,
): string {
  return NULL_REASON_TEXT[reason]({ timeCode: state.timeCode.trim() });
}

/**
 * Why `parseX12DateTime` returned `null`, decided by probing the library with
 * one element at a time, never by a list of codes held here. Not called for a
 * blank section (`mainBlank`): nothing typed makes no call.
 */
export function explainNull(state: X12State, lib: EdiLib): X12NullReason {
  const date = state.date.trim();
  const time = state.time.trim();
  const code = state.timeCode.trim();
  if (date !== "" && lib.parseX12DateTime(date) === null) return "bad-date";
  if (time !== "" && lib.parseX12DateTime("", time) === null) return "bad-time";
  if (code !== "" && lib.x12TimeCode(code) === null) return "not-a-code";
  if (time === "" && code !== "" && lib.parseX12DateTime(date, "0000", code) !== null) {
    return "needs-time";
  }
  return "bad-combination";
}

// ---------------------------------------------------------------------------
// Writing back: the date and the time, one element each
// ---------------------------------------------------------------------------

export interface ElementWrite {
  /** The string handed to the formatter. */
  iso: string;
  /** The 1250 code that writes the element: `D8`, `TM` or `TS`. */
  code: string;
  output: string;
  note: string;
}

const TIME_FRACTION_NOTE =
  "formatX12DateTimePeriod writes the time as HHMM or HHMMSS. Tenths and hundredths of a second are read and not written, so there is no value to show.";

/** The date, as element 373: `formatX12DateTimePeriod(date, "D8")`. `null` when
 *  the result holds no date. */
export function writeDate(
  result: EdiResult | null,
  lib: EdiLib,
): ElementWrite | null {
  if (result === null || result.date === undefined) return null;
  return {
    iso: result.date,
    code: "D8",
    output: lib.formatX12DateTimePeriod(result.date, "D8"),
    note: "",
  };
}

/**
 * The time, as element 337: `TM` when the time was sent as four digits, `TS`
 * otherwise. The code follows the form the reader typed, so the value comes back
 * in that form. `null` when the result holds no time.
 */
export function writeTime(
  result: EdiResult | null,
  sentTime: string,
  lib: EdiLib,
): ElementWrite | null {
  if (result === null || result.time === undefined) return null;
  const code = sentTime.trim().length === 4 ? "TM" : "TS";
  const output = lib.formatX12DateTimePeriod(result.time, code);
  return {
    iso: result.time,
    code,
    output,
    note: output === "" ? TIME_FRACTION_NOTE : "",
  };
}

// ---------------------------------------------------------------------------
// The DTP section
// ---------------------------------------------------------------------------

export type DtpMemberKey =
  | "date"
  | "time"
  | "local"
  | "dayOfYear"
  | "yearDigit"
  | "periodEnd";

/** No 1250 code carries an offset, so there is no instant, offset or zone row. */
export const DTP_MEMBER_ROWS: readonly {
  key: DtpMemberKey;
  role: string;
  label: string;
}[] = [
  { key: "date", role: "dtp-member-date", label: "Date" },
  { key: "time", role: "dtp-member-time", label: "Time" },
  { key: "local", role: "dtp-member-local", label: "Local date-time" },
  { key: "dayOfYear", role: "dtp-member-day-of-year", label: "Day of year" },
  { key: "yearDigit", role: "dtp-member-year-digit", label: "Year digit" },
  { key: "periodEnd", role: "dtp-member-range-end", label: "Range end" },
];

/** The member's text, or `null` when the result does not hold it. A range end
 *  shows its `local`, else its `date`, else its `time`. */
export function dtpMemberText(
  result: EdiResult,
  key: DtpMemberKey,
): string | null {
  if (key === "periodEnd") {
    const end = result.periodEnd;
    if (end === undefined) return null;
    return end.local ?? end.date ?? end.time ?? null;
  }
  const v = result[key];
  return v === undefined ? null : String(v);
}

/** Whether the `DTP` section has nothing typed, so no call is made. */
export function dtpBlank(state: DtpState): boolean {
  return state.format.trim() === "" && state.value.trim() === "";
}

export type DtpNullReason =
  | "blank-value"
  | "no-format"
  | "unstructured"
  | "unread-format"
  | "needs-year-window"
  | "bad-year-window"
  | "bad-value";

export const DTP_NULL_REASON_TEXT: Record<
  DtpNullReason,
  (context: { format: string }) => string
> = {
  "blank-value": () => "Type an element 1251 value.",
  "no-format": () => "Type the 1250 qualifier the value is read under.",
  unstructured: () =>
    "UN is unstructured: it has no layout, and the library never guesses one.",
  "unread-format": ({ format }) =>
    `${format} is not a qualifier the library reads. A partial value or a month-name form is not a complete date or time, and DTM is a segment name, not a 1250 code.`,
  "needs-year-window": ({ format }) =>
    `Qualifier ${format} has a two-digit year. No standard says which century it belongs to, so choose a window: rolling, or a start year. A two-digit year is a legacy form: where a partner can send a four-digit year, ask for it.`,
  "bad-year-window": () =>
    "The window is rolling or a whole year from 0 to 9900.",
  "bad-value": () =>
    "The value does not fit this qualifier, names a date that does not exist, is a range sent without its hyphen, or is a dated range whose end is before its start.",
};

export function dtpNullReasonText(
  reason: DtpNullReason,
  state: DtpState,
): string {
  return DTP_NULL_REASON_TEXT[reason]({ format: state.format.trim() });
}

/**
 * Why `parseX12DateTimePeriod` returned `null` for this state, decided by
 * probing the library in a fixed order, never by a list of codes held here.
 */
export function explainDtpNull(state: DtpState, lib: EdiLib): DtpNullReason {
  const value = state.value.trim();
  const format = state.format.trim();
  if (value === "") return "blank-value";
  if (format === "") return "no-format";
  if (format === "UN") return "unstructured";
  if (!lib.isValidX12DateTimePeriodFormat(format)) return "unread-format";
  if (needsYearWindow(lib.formatX12DateTimePeriod, format)) {
    if (yearWindowOptions(state.yearWindow) === undefined) {
      return "needs-year-window";
    }
    if (lib.isValidX12DateTimePeriod(value, format, { yearWindow: 2000 })) {
      return "bad-year-window";
    }
  }
  return "bad-value";
}

/** Whether the qualifier has a two-digit year, by probing the formatter. */
export function dtpWindowApplies(state: DtpState, lib: EdiLib): boolean {
  const format = state.format.trim();
  return format !== "" && needsYearWindow(lib.formatX12DateTimePeriod, format);
}

/** The line under the `DTP` fields when the year controls are off. */
export function dtpWindowOffNote(state: DtpState, lib: EdiLib): string {
  const format = state.format.trim();
  if (format === "" || dtpWindowApplies(state, lib)) return "";
  return lib.isValidX12DateTimePeriodFormat(format)
    ? `Qualifier ${format} carries a four-digit year. The window is not read.`
    : "";
}

export interface DtpWriteBack {
  /** The string handed to the formatter. */
  iso: string;
  args: unknown[];
  output: string;
  note: string;
}

/** The note under the output when `isoOf` finds nothing to write. */
export function nothingToWriteNote(result: EdiResult | null): string {
  if (result === null) return "";
  if (result.date === undefined && result.dayOfYear !== undefined) {
    return result.yearDigit === undefined
      ? "TC keeps only the day of the year, so there is no date to write back."
      : "EH keeps only the last digit of the year, so there is no date to write back.";
  }
  return "";
}

/**
 * `formatX12DateTimePeriod` of what the parser returned, with the same
 * qualifier and, for a qualifier that reads one, the same window. `null` when
 * there is nothing to write.
 */
export function dtpWriteBack(
  state: DtpState,
  result: EdiResult | null,
  lib: EdiLib,
): DtpWriteBack | null {
  if (result === null) return null;
  const iso = isoOf(result, lib);
  if (iso === null) return null;
  const format = state.format.trim();
  const options = dtpWindowApplies(state, lib)
    ? yearWindowOptions(state.yearWindow)
    : undefined;
  const args: unknown[] =
    options === undefined ? [iso, format] : [iso, format, options];
  const output = lib.formatX12DateTimePeriod(iso, format, options);
  const notes: string[] = [];
  const built = isoNote(result);
  if (built !== "") notes.push(built);
  if (output === "") {
    notes.push(
      "formatX12DateTimePeriod returned the sentinel for this value and qualifier.",
    );
  }
  return { iso, args, output, note: notes.join(" ") };
}

// ---------------------------------------------------------------------------
// The pictures: the three elements taken apart, and a DTP value taken apart
// ---------------------------------------------------------------------------

const DIGITS = /^\d+$/;

/** What `x12TimeCode` returned, in words. */
export function timeCodeWords(
  meaning: ReturnType<EdiLib["x12TimeCode"]>,
): string {
  if (meaning === null) return "not a 623 time code";
  if ("offset" in meaning) return `offset ${meaning.offset}`;
  if (meaning.zone === "Local") return "local to the event, no zone named";
  const daylight =
    meaning.daylight === true
      ? "daylight time"
      : meaning.daylight === false
        ? "standard time"
        : "daylight not said";
  return `zone ${meaning.zone}, ${daylight}`;
}

export interface ElementFigure {
  halves: PicHalf[];
  aria: string;
  /** Words under the picture: what `x12TimeCode` returned, and what the last
   *  digits of the time are. Empty lines are left out. */
  notes: string[];
}

/** A box for an element that was not sent. */
const NOT_SENT: PicField = {
  text: "not sent",
  mask: "",
  group: "none",
  word: "not sent",
};

/**
 * The date, the time and the time code taken apart. The date is `CCYY MM DD`; the
 * time `HH MM`, then `SS`, then a tenth (`D`) or hundredths (`DD`) by the digits
 * the reader typed, which are the four forms element 337 defines (HHMM, HHMMSS,
 * HHMMSSD, HHMMSSDD); the time code is its own box, with what `x12TimeCode`
 * returned. An element that is not the shape its element defines sits in one
 * neutral box, and a refused read (`result` null) draws every element neutral.
 */
export function elementFigure(
  state: X12State,
  result: EdiResult | null,
  lib: EdiLib,
): ElementFigure {
  const refused = result === null;
  const group = <G extends "date" | "time" | "offset">(g: G): G | "neutral" =>
    refused ? "neutral" : g;
  const date = state.date.trim();
  const time = state.time.trim();
  const code = state.timeCode.trim();

  const dateFields: PicField[] =
    date === ""
      ? [NOT_SENT]
      : DIGITS.test(date) && date.length === 8
        ? [
            { text: date.slice(0, 4), mask: "CCYY", group: group("date"), word: "year", bracket: "date" },
            { text: date.slice(4, 6), mask: "MM", group: group("date"), word: "month" },
            { text: date.slice(6, 8), mask: "DD", group: group("date"), word: "day" },
          ]
        : [{ text: date, mask: "", group: "neutral", word: "text" }];

  const decimals = time.length - 6;
  const timeFields: PicField[] =
    time === ""
      ? [NOT_SENT]
      : DIGITS.test(time) && [4, 6, 7, 8].includes(time.length)
        ? [
            { text: time.slice(0, 2), mask: "HH", group: group("time"), word: "hour", bracket: "time" },
            { text: time.slice(2, 4), mask: "MM", group: group("time"), word: "minute" },
            ...(time.length >= 6
              ? [{ text: time.slice(4, 6), mask: "SS", group: group("time"), word: "second" }]
              : []),
            ...(time.length >= 7
              ? [
                  {
                    text: time.slice(6),
                    mask: decimals === 1 ? "D" : "DD",
                    group: group("time"),
                    word: decimals === 1 ? "tenths of a second" : "hundredths of a second",
                  },
                ]
              : []),
          ]
        : [{ text: time, mask: "", group: "neutral", word: "text" }];

  const meaning = code === "" ? null : lib.x12TimeCode(code);
  const codeFields: PicField[] =
    code === ""
      ? [NOT_SENT]
      : [
          {
            text: code,
            mask: "623",
            group: meaning === null || refused ? "neutral" : "offset",
            word: "time code",
            bracket:
              meaning !== null && !refused && !("offset" in meaning)
                ? "zone"
                : "offset",
          },
        ];

  const halves: PicHalf[] = [
    { label: "373", fields: dateFields },
    { label: "337", fields: timeFields },
    { label: "623", fields: codeFields },
  ];

  const notes: string[] = [];
  if (code !== "") {
    notes.push(`x12TimeCode("${code}") returned ${timeCodeWords(meaning)}.`);
  }
  if (timeFields.some((f) => f.mask === "D" || f.mask === "DD")) {
    notes.push(
      decimals === 1
        ? "The last digit of the time is tenths of a second."
        : "The last two digits of the time are hundredths of a second.",
    );
  }

  const say = (label: string, fields: readonly PicField[]): string =>
    `${label}: ${fields.map((f) => (f.group === "none" ? "not sent" : `${f.word} ${f.text}`)).join(", ")}`;
  const aria = [
    say("Date", dateFields),
    say("Time", timeFields),
    code === ""
      ? "Time code: not sent"
      : `Time code ${code}: ${timeCodeWords(meaning)}`,
  ].join(". ");
  return { halves, aria: `${aria}.`, notes };
}

/** The parts row of a `DTP` value: the element 1251 value and its 1250 qualifier. */
export function dtpParts(state: DtpState): PicPart[] {
  return [
    { text: state.value.trim(), caption: "1251 value", after: "", kind: "value" },
    { text: state.format.trim(), caption: "1250", after: "", kind: "code" },
  ];
}

export interface DtpFigure {
  halves: PicHalf[];
  separator: string;
  closing: string;
  aria: string;
  note: string;
}

/**
 * A `DTP` value taken apart from the shape the formatter's own output gives its
 * 1250 qualifier. The field order is read off where each distinct probe field
 * lands, so `MMDDCCYY`, `DDMMYYHHMM`, `YYDDD` and a range with a hyphen each get
 * their own order. No 1250 code states an offset, so a read value closes with
 * `no offset`.
 */
export function dtpFigure(
  state: DtpState,
  result: EdiResult | null,
  lib: EdiLib,
): DtpFigure {
  const value = state.value.trim();
  const format = state.format.trim();
  const shape = format === "" ? null : shapeOf(lib.formatX12DateTimePeriod, format);
  const cut = shape === null ? null : cutValue(value, shape);
  const refused = result === null;
  const halves =
    cut === null || shape === null ? plainHalves(value) : picHalves(cut, refused);
  const closing = !refused && cut !== null ? "no offset" : "";
  const window = shape?.window === true && cut !== null;
  const read = result === null ? undefined : (result.date ?? result.local);
  const note = window ? yearWindowNote(state.yearWindow, read) : "";
  return {
    halves,
    separator: shape?.separator ?? "",
    closing,
    aria: figureAria(value, format, halves, figureTail(closing, note)),
    note,
  };
}

/** The words the timeline shows when there is no instant to place. */
export function timelineEmptyText(result: EdiResult | null): string {
  if (result === null) return "No value, so no instant to place.";
  if (result.local === undefined && result.time !== undefined) {
    return "A time alone names no instant: nothing to place.";
  }
  return "A date alone names no instant: nothing to place.";
}

// ---------------------------------------------------------------------------
// Every text a region can show, for the height it reserves (`holdHtml`)
// ---------------------------------------------------------------------------

/** Results shaped like each kind `parseX12DateTime` returns, to run the pure text
 *  functions over. Never shown; only their texts are measured. */
const SHAPES: readonly EdiResult[] = [
  { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Eastern", daylight: null },
  { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Eastern", daylight: true },
  { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Eastern", daylight: false },
  { time: "14:30:00", zone: "Eastern", daylight: null },
  { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Local", daylight: null },
  { time: "14:30:00", zone: "Local", daylight: null },
  { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", instant: "2024-06-15T14:30:00Z", offset: "+00:00" },
  { time: "14:30:00", offset: "+00:00" },
  { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00" },
  { date: "2024-06-15" },
  { time: "14:30:00" },
];

/** The texts each X12 Time Reader region can show. */
export function x12Texts() {
  const verdicts = SHAPES.map(verdictOf);
  const plans = SHAPES.map((r) => instantPlan(r, ["a zone", "", "", ""]).note).concat(
    SHAPES.map((r) => instantPlan(r, ["", "", "", ""]).note),
  );
  return {
    descriptions: X12_PRESETS.map((p) => p.description),
    dtpDescriptions: DTP_PRESETS.map((p) => p.description),
    verdicts: verdicts.map((v) => v.verdict),
    details: verdicts.map((v) => v.detail),
    stripNotes: [null, ...SHAPES].map((r) => stripNote(r)),
    instantNotes: plans,
    gaps: [
      `Widest gap: 26 h, between ${LONGEST_ZONE} and ${LONGEST_ZONE}`,
    ],
    reasons: Object.values(NULL_REASON_TEXT).map((f) => f({ timeCode: "XX" })),
    dtpReasons: Object.values(DTP_NULL_REASON_TEXT).map((f) => f({ format: "XX" })),
    yearNotes: [
      yearWindowNote("", undefined),
      yearWindowNote("rolling", "2024-06-15"),
      yearWindowNote("2000", "2024-06-15"),
    ],
    timeNotes: [
      "x12TimeCode(\"ABCDEFGH\") returned local to the event, no zone named.",
      "The last two digits of the time are hundredths of a second.",
    ],
    formatNotes: [TIME_FRACTION_NOTE],
    dtpWindowNote: "Qualifier RD8 carries a four-digit year. The window is not read.",
    dtpFormatNotes: [
      `${isoNote({ date: "2024-06-15", periodEnd: { date: "2024-06-20" } })} formatX12DateTimePeriod returned the sentinel for this value and qualifier.`,
      "EH keeps only the last digit of the year, so there is no date to write back.",
    ],
    parseOutput:
      '{ date: "2024-06-15", time: "14:30:00.12", local: "2024-06-15T14:30:00.12", instant: "2024-06-15T14:30:00.12Z", offset: "+00:00" }',
    dtpParseOutput:
      '{ date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }',
    parseCall: 'parseX12DateTime("20240615", "14300012", "ET")',
    dtpParseCall:
      'parseX12DateTimePeriod("20240615143000-20240620160000", "DTS", { yearWindow: "rolling" })',
    resolveCall:
      `resolveLocal("2024-06-15T14:30:00.12", "${LONGEST_ZONE}", { disambiguation: "reject" })`,
    dtpFormatCall:
      'formatX12DateTimePeriod("2024-06-15T14:30:00/2024-06-20T16:00:00", "DTS", { yearWindow: "rolling" })',
    writeCall: 'formatX12DateTimePeriod("14:30:00.12", "TS")',
  };
}
