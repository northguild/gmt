/**
 * Pure helpers for the X12 Time Reader (INT-15).
 *
 * The main section reads the three elements a freight segment carries side by
 * side: a date (element 373), a time (element 337) and a time code (element 623),
 * as `AT7` in a 214, `G62` in a 204 and `DTM-02`/`03`/`04` carry them. Three
 * small calls read them: `parseX12DateAndTime(date, time)` (or `parseX12Date` or
 * `parseX12Time` when only one element is filled), `classifyX12TimeCode(code)`,
 * and then `x12TimeCodeOffset(code)` for a code that states an offset or
 * `x12TimeCodeZone(code)` for a code that names a zone. When the code states an
 * offset, `resolveLocal(local, offset)` gives the instant. X12 is a United States
 * standard.
 *
 * A second, smaller section reads a data element 1251 value against its 1250
 * qualifier: it classifies the qualifier (`classifyX12DateTimePeriodFormat`) and
 * calls the parser of the kind that came back. A qualifier has no time code, and
 * no instant.
 *
 * Every printed call, and every result beside it, is a real `EdiLib` call. The
 * site-side code builds nothing of its own: it picks the function a kind names.
 * Nothing here derives a zone from a time code, a zone name, a place or a
 * partner. A preset is an example and states its own zones, written by hand beside
 * its description; every other zone is the reader's pick.
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
  KIND_WORDS,
  LONGEST_ZONE,
  X12_FUNCTIONS,
  formatClassified,
  isInterval,
  isSentinel,
  parseClassified,
  resolveInZone,
  runCall,
  unreadCodeText,
  type EdiCall,
  type EdiHouse,
  type EdiLib,
  type X12Class,
  type X12TimeCodeClass,
  type X12Zone,
} from "./edi-widgets";
import {
  cutValue,
  figureAria,
  picHalves,
  plainHalves,
  probeFamily,
  shapeOf,
  type PicField,
  type PicHalf,
  type PicPart,
} from "./edi-picture";

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State and args
// ---------------------------------------------------------------------------

/** What a chat call or a permalink hands over. An old link may still carry a
 *  `yearWindow`; it is ignored. */
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
}

/** Whether nothing was typed into any of the three elements. */
export function mainBlank(state: X12State): boolean {
  return (
    state.date.trim() === "" &&
    state.time.trim() === "" &&
    state.timeCode.trim() === ""
  );
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
   * does not apply (an offset code, a date or a time alone). Nothing derives
   * them from `timeCode`.
   */
  zones: [string, string, string, string];
}

/**
 * A preset is an example, and an example may state its place: each preset that
 * states no offset carries the zones that make it most informative, and says in
 * its description that the zone is the example's pick. Typing a time code never
 * fills a zone. Every preset returns a value.
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
      "Element 337 can carry tenths or hundredths of a second. The library reads them, and formatX12TimeElement writes them back in the form they were sent (HHMMSSDD here). The four zones are this example's picks, so the strip shows the instants: change them to the places your message means.",
    date: "20240615",
    time: "14300012",
    timeCode: "",
    // Two US offices, a European port and an Asian origin of one shipment: the four zones the DTM Decoder's 203 example reads.
    zones: [
      "America/New_York",
      "Europe/Berlin",
      "Asia/Shanghai",
      "America/Los_Angeles",
    ],
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
    zones: [
      "America/New_York",
      "Europe/Berlin",
      "Asia/Shanghai",
      "America/Los_Angeles",
    ],
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
    zones: [
      "America/New_York",
      "Europe/Berlin",
      "Asia/Shanghai",
      "America/Los_Angeles",
    ],
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
}

/** Every preset returns a value except the last, which shows a two-digit-year
 *  qualifier, the one a reader will try. */
export const DTP_PRESETS: readonly DtpPreset[] = [
  {
    id: "range-rd8",
    label: "RD8: a range of dates",
    description:
      "A range of dates is sent with a hyphen between its two ends. It names no instant, and a qualifier has no time code.",
    format: "RD8",
    value: "20240615-20240620",
  },
  {
    id: "range-dts",
    label: "DTS: a range of date-times",
    description:
      "A range of date-times, each end with seconds, joined by a hyphen. The qualifier states no offset, so neither end names an instant.",
    format: "DTS",
    value: "20240615143000-20240620160000",
  },
  {
    id: "date-db",
    label: "DB: month, day, then year",
    description:
      "The same date as D8 with the fields in another order: DB is MMDDCCYY. The library reads the order the qualifier states.",
    format: "DB",
    value: "06152024",
  },
  {
    id: "d6-two-digit",
    label: "D6: a two-digit year, not read",
    description:
      "D6 has a two-digit year, and no standard says which century it belongs to. The EDI functions do not read it, so the library returns the sentinel. The pattern parsers read the same digits with a yearWindow that states the century.",
    format: "D6",
    value: "240615",
  },
];

export function dtpPresetState(preset: DtpPreset): DtpState {
  return { format: preset.format, value: preset.value };
}

/** The `DTP` preset whose every field equals the state's (trimmed), else custom. */
export function matchDtpPreset(state: DtpState): string {
  const hit = DTP_PRESETS.find(
    (p) => p.format === state.format.trim() && p.value === state.value.trim(),
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

/** The states a seed names. A string is kept as typed and an absent key is blank.
 *  Nothing falls back to a preset. A `yearWindow` an old link carries is not read. */
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
  return out;
}

// ---------------------------------------------------------------------------
// Reading the three elements
// ---------------------------------------------------------------------------

/** The element parse the main section made. */
export type MainKind = "dateAndTime" | "date" | "time";

export interface X12Read {
  date: string;
  time: string;
  code: string;
  /** The date-and-time, date or time parse; `null` when no element was typed. */
  main: EdiCall | null;
  mainKind: MainKind | null;
  /** What the parse returned; `null` for the sentinel or no call. */
  house: string | null;
  /** `classifyX12TimeCode`'s call; `null` when no code was typed. */
  classify: EdiCall | null;
  codeClass: X12TimeCodeClass | null;
  /** `x12TimeCodeOffset` or `x12TimeCodeZone`, by the class. */
  codeCall: EdiCall | null;
  /** The offset an offset code states, else `""`. */
  offset: string;
  /** The zone a zone code names, else `null`. */
  zone: X12Zone | null;
  /** `resolveLocal(local, offset)` for a local date-time and an offset code. */
  resolve: EdiCall | null;
  /** The instant a stated offset fixes, else `""`. */
  instant: string;
  /** The calls for the call frame, in order. */
  calls: EdiCall[];
  /** The date element read alone (for the written-back date), else `null`. */
  dateCall: EdiCall | null;
  /** The time element read alone (for the written-back time), else `null`. */
  timeCall: EdiCall | null;
}

/**
 * Read the three elements: the element parse, the code's classifier and its
 * offset or zone, and `resolveLocal(local, offset)` when an offset code and a
 * local date-time give an instant. The element parse is chosen by what is typed:
 * both date and time, one alone, or (when a code is sent without a time) the
 * two-element parse, which returns the sentinel because a time code qualifies a
 * time.
 */
export function readX12(state: X12State, lib: EdiLib): X12Read {
  const date = state.date.trim();
  const time = state.time.trim();
  const code = state.timeCode.trim();
  const read: X12Read = {
    date,
    time,
    code,
    main: null,
    mainKind: null,
    house: null,
    classify: null,
    codeClass: null,
    codeCall: null,
    offset: "",
    zone: null,
    resolve: null,
    instant: "",
    calls: [],
    dateCall: null,
    timeCall: null,
  };

  if (date !== "" && time !== "") {
    read.mainKind = "dateAndTime";
    read.main = runCall(lib, "parseX12DateAndTime", date, time);
  } else if (time !== "") {
    read.mainKind = "time";
    read.main = runCall(lib, "parseX12Time", time);
  } else if (date !== "" && code === "") {
    read.mainKind = "date";
    read.main = runCall(lib, "parseX12Date", date, "D8");
  } else if (date !== "" || code !== "") {
    // A code is sent with no time: the two-element parse needs both.
    read.mainKind = "dateAndTime";
    read.main = runCall(lib, "parseX12DateAndTime", date, time);
  }
  if (read.main !== null) {
    read.calls.push(read.main);
    if (!isSentinel(read.main.result)) read.house = read.main.result as string;
  }

  if (code !== "") {
    read.classify = runCall(lib, "classifyX12TimeCode", code);
    read.calls.push(read.classify);
    read.codeClass = read.classify.result as X12TimeCodeClass | null;
    if (read.codeClass !== null) {
      if (read.codeClass.kind === "offset") {
        read.codeCall = runCall(
          lib,
          "x12TimeCodeOffset",
          read.codeClass.timeCode,
        );
        read.offset = read.codeCall.result as string;
      } else {
        read.codeCall = runCall(
          lib,
          "x12TimeCodeZone",
          read.codeClass.timeCode,
        );
        read.zone = read.codeCall.result as X12Zone | null;
      }
      read.calls.push(read.codeCall);
    }
  }

  // The element parses behind the written-back lines, when both elements were sent.
  if (read.mainKind === "dateAndTime" && date !== "" && time !== "") {
    read.dateCall = runCall(lib, "parseX12Date", date, "D8");
    read.timeCall = runCall(lib, "parseX12Time", time);
  } else if (read.mainKind === "date") {
    read.dateCall = read.main;
  } else if (read.mainKind === "time") {
    read.timeCall = read.main;
  }

  if (
    ok(read) &&
    read.mainKind === "dateAndTime" &&
    read.offset !== "" &&
    read.house !== null
  ) {
    read.resolve = runCall(lib, "resolveLocal", read.house, read.offset);
    read.instant = isSentinel(read.resolve.result)
      ? ""
      : (read.resolve.result as string);
  }
  return read;
}

/** Whether the read holds a value: the element parse returned one, and a code that
 *  was sent is one the classifier knows. */
export function ok(read: X12Read): boolean {
  if (read.house === null) return false;
  return read.code === "" || read.codeClass !== null;
}

// ---------------------------------------------------------------------------
// What the parser returned: the members and the verdict
// ---------------------------------------------------------------------------

export type MemberKey =
  | "kind"
  | "value"
  | "code"
  | "offset"
  | "zone"
  | "daylight"
  | "instant";

export const MEMBER_ROWS: readonly {
  key: MemberKey;
  role: string;
  label: string;
}[] = [
  { key: "kind", role: "member-kind", label: "Kind" },
  { key: "value", role: "member-value", label: "Value" },
  { key: "code", role: "member-code", label: "Time code" },
  { key: "offset", role: "member-offset", label: "Offset" },
  { key: "zone", role: "member-zone", label: "Zone name" },
  { key: "daylight", role: "member-daylight", label: "Daylight" },
  { key: "instant", role: "member-instant", label: "Instant" },
];

const MAIN_KIND_WORDS: Record<MainKind, string> = {
  dateAndTime: KIND_WORDS["dateTime"]!,
  date: KIND_WORDS["date"]!,
  time: KIND_WORDS["time"]!,
};

/** The member's text, or `null` when the read does not hold it. `daylight`
 *  (`true`, `false` or `null`) is shown as `daylight`, `standard` or `not said`,
 *  as its meaning; the call line keeps the literal the library returned. */
export function memberText(read: X12Read, key: MemberKey): string | null {
  if (!ok(read)) return null;
  switch (key) {
    case "kind":
      return read.mainKind === null ? null : MAIN_KIND_WORDS[read.mainKind];
    case "value":
      return read.house;
    case "code":
      return read.codeClass === null
        ? null
        : read.codeClass.kind === "offset"
          ? "states an offset"
          : "names a zone";
    case "offset":
      return read.offset === "" ? null : read.offset;
    case "zone":
      return read.zone === null ? null : read.zone.zone;
    case "daylight":
      return read.zone === null
        ? null
        : read.zone.daylight === true
          ? "daylight"
          : read.zone.daylight === false
            ? "standard"
            : "not said";
    case "instant":
      return read.instant === "" ? null : read.instant;
  }
}

export interface Verdict {
  verdict: string;
  detail: string;
}

const NO_DAY = " A time alone names no instant: it is on no day.";

/**
 * What the elements state, in words, decided by the calls' own results. The
 * verdict has two forms: the offset is stated, or it is not. The detail says
 * which, and what the time code names when it names a zone.
 */
export function verdictOf(read: X12Read): Verdict {
  if (!ok(read)) return { verdict: "", detail: "" };
  const timeAlone = read.mainKind === "time";
  if (read.offset !== "") {
    return {
      verdict: `Offset: stated (${read.offset})`,
      detail:
        read.instant !== ""
          ? "The time code gives the offset from UTC, so the date and the time name one instant."
          : `The time code gives the offset from UTC.${timeAlone ? NO_DAY : ""}`,
    };
  }
  const zone = read.zone;
  if (zone !== null && zone.zone === "Local") {
    return {
      verdict: "Offset: not stated",
      detail: `The time code says local to the event. The place is elsewhere in the message. You supply its zone.${timeAlone ? NO_DAY : ""}`,
    };
  }
  if (zone !== null) {
    const said =
      zone.daylight === true
        ? "The code names the zone and says daylight time."
        : zone.daylight === false
          ? "The code names the zone and says standard time."
          : "The code names the zone and says neither standard nor daylight, so the date decides.";
    return {
      verdict: "Offset: not stated",
      detail: `${said} X12 states no offset for a named zone: ${zone.zone}.${timeAlone ? NO_DAY : ""}`,
    };
  }
  if (read.mainKind === "date") {
    return {
      verdict: "Offset: not stated",
      detail: "A date alone names no instant in any zone.",
    };
  }
  if (read.mainKind === "time") {
    return {
      verdict: "Offset: not stated",
      detail: `There is no date and no time code, so nothing says which day or where the clock was.${NO_DAY}`,
    };
  }
  return {
    verdict: "Offset: not stated",
    detail:
      "A blank time code means local to the event. The place is elsewhere in the message. You supply its zone.",
  };
}

// ---------------------------------------------------------------------------
// The instant, and the strip
// ---------------------------------------------------------------------------

const REJECT_NOTE =
  'Read with disambiguation: "reject": a time the clock shows twice or never is not resolved.';

/** The strip applies to a local date-time whose code states no offset. */
export function stripApplies(read: X12Read | null): boolean {
  return (
    read !== null &&
    ok(read) &&
    read.mainKind === "dateAndTime" &&
    read.offset === ""
  );
}

const STRIP_NOTE_NONE = "No value.";
const STRIP_NOTE_STATED =
  "The time code states the offset, so there is nothing to choose.";
const STRIP_NOTE_ALONE = "A date or a time alone names no instant in any zone.";
const STRIP_NOTE_APPLIES =
  'The elements state no offset. Each zone above is a pick, from the example or from you, and not something the elements say: the same digits, read there. Every row uses resolveLocal with disambiguation: "reject", so a time the clock shows twice or never is not resolved.';

/** The line above the strip, by what the read holds. */
export function stripNote(read: X12Read | null): string {
  if (read === null || !ok(read)) return STRIP_NOTE_NONE;
  if (stripApplies(read)) return STRIP_NOTE_APPLIES;
  if (read.offset !== "" && read.mainKind === "dateAndTime") {
    return STRIP_NOTE_STATED;
  }
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
 *  - `stated`: an offset code and a local date-time, so `resolveLocal(local,
 *    offset)` gave it;
 *  - `resolve`: a local date-time and a zone the reader picked, so the first
 *    chosen zone's `resolveLocal` call is shown;
 *  - `none`: no call, and the note says why.
 */
export function instantPlan(
  read: X12Read | null,
  zones: readonly string[],
): InstantPlan {
  if (read === null || !ok(read)) return { kind: "none", note: "No value." };
  if (read.instant !== "") {
    return {
      kind: "stated",
      note: "The local date-time read at the offset the time code states, with resolveLocal.",
    };
  }
  if (read.mainKind !== "dateAndTime") {
    if (read.mainKind === "time") {
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
  if (read.zone !== null && read.zone.zone !== "Local") {
    return {
      kind: "none",
      note: `No instant: the code names ${read.zone.zone} time and states no offset. Pick the IANA zone it means for you.`,
    };
  }
  return {
    kind: "none",
    note: "No instant: nothing here states an offset. Pick the zone.",
  };
}

// ---------------------------------------------------------------------------
// Why the sentinel: the main section
// ---------------------------------------------------------------------------

export type X12Why =
  | "bad-date"
  | "bad-time"
  | "not-a-code"
  | "needs-time"
  | "bad-combination";

export const REASON_TEXT: Record<
  X12Why,
  (context: { timeCode: string }) => string
> = {
  "bad-date": () =>
    "The date is not a CCYYMMDD date: it has a four-digit year and names a day that exists. A two-digit year is not read.",
  "bad-time": () =>
    "The time is not one of the four element 337 forms: HHMM, HHMMSS, HHMMSSD or HHMMSSDD, with an hour from 00 to 23 and a minute and second from 00 to 59.",
  "not-a-code": ({ timeCode }) =>
    `${timeCode} is not a 623 time code. A code is two characters, upper case, and an abbreviation is not a code.`,
  "needs-time": () =>
    "A time code qualifies a time, so X12 requires the time whenever the code is sent. Send a time, or leave the time code out.",
  "bad-combination": () => "These elements do not fit together.",
};

/**
 * Why the main section is the sentinel, decided by probing the library with one
 * element at a time, never by a list of codes held here. Not called for a blank
 * section (`mainBlank`): nothing typed makes no call.
 */
export function whyNot(read: X12Read, lib: EdiLib): X12Why {
  if (read.code !== "" && read.codeClass === null) return "not-a-code";
  if (read.time === "" && read.code !== "") return "needs-time";
  if (read.date !== "" && isSentinel(lib.parseX12Date(read.date, "D8"))) {
    return "bad-date";
  }
  if (read.time !== "" && isSentinel(lib.parseX12Time(read.time))) {
    return "bad-time";
  }
  return "bad-combination";
}

export function sentinelText(read: X12Read, lib: EdiLib): string {
  return REASON_TEXT[whyNot(read, lib)]({ timeCode: read.code });
}

// ---------------------------------------------------------------------------
// Writing back: the date and the time, one element each
// ---------------------------------------------------------------------------

export interface ElementWrite {
  /** The formatter's call. */
  call: EdiCall;
  output: string;
  note: string;
}

/** The date, as element 373: `formatX12Date(date, "D8")`, from `parseX12Date`'s
 *  result. `null` when the date element was not read. */
export function writeDate(read: X12Read, lib: EdiLib): ElementWrite | null {
  const r = read.dateCall?.result;
  if (!ok(read) || typeof r !== "string" || r === "") return null;
  const call = runCall(lib, "formatX12Date", r, "D8");
  return {
    call,
    output: call.result as string,
    note:
      read.mainKind === "dateAndTime"
        ? "The date is element 373 read alone by parseX12Date."
        : "",
  };
}

/** The element 337 form for the number of digits typed. */
function timeForm(time: string): string {
  switch (time.length) {
    case 4:
      return "HHMM";
    case 7:
      return "HHMMSSD";
    case 8:
      return "HHMMSSDD";
    default:
      return "HHMMSS";
  }
}

/**
 * The time, as element 337, written in the form it was sent: `HHMM`, `HHMMSS`,
 * `HHMMSSD` or `HHMMSSDD` for four, six, seven or eight digits. `null` when the
 * time element was not read.
 */
export function writeTime(read: X12Read, lib: EdiLib): ElementWrite | null {
  const r = read.timeCall?.result;
  if (!ok(read) || typeof r !== "string" || r === "") return null;
  const call = runCall(lib, "formatX12TimeElement", r, timeForm(read.time));
  const notes: string[] = [];
  if (read.mainKind === "dateAndTime") {
    notes.push("The time is element 337 read alone by parseX12Time.");
  }
  return { call, output: call.result as string, note: notes.join(" ") };
}

// ---------------------------------------------------------------------------
// The DTP section
// ---------------------------------------------------------------------------

export interface DtpRead {
  value: string;
  format: string;
  classify: EdiCall | null;
  classified: X12Class | null;
  parse: EdiCall | null;
  house: EdiHouse | null;
  calls: EdiCall[];
}

/** Whether the `DTP` section has nothing typed, so no call is made. */
export function dtpBlank(state: DtpState): boolean {
  return state.format.trim() === "" && state.value.trim() === "";
}

/** Classify the qualifier, then call the parser of the kind that came back. */
export function readDtp(state: DtpState, lib: EdiLib): DtpRead {
  const value = state.value.trim();
  const format = state.format.trim();
  const read: DtpRead = {
    value,
    format,
    classify: null,
    classified: null,
    parse: null,
    house: null,
    calls: [],
  };
  if (format === "") return read;
  read.classify = runCall(lib, "classifyX12DateTimePeriodFormat", format);
  read.calls.push(read.classify);
  read.classified = read.classify.result as X12Class | null;
  if (read.classified === null) return read;
  read.parse = parseClassified(
    lib,
    X12_FUNCTIONS[read.classified.kind],
    value,
    read.classified.format,
  );
  read.calls.push(read.parse);
  if (!isSentinel(read.parse.result))
    read.house = read.parse.result as EdiHouse;
  return read;
}

export type DtpMemberKey = "kind" | "value" | "rangeEnd";

/** No 1250 code carries an offset, so there is no instant, offset or zone row. */
export const DTP_MEMBER_ROWS: readonly {
  key: DtpMemberKey;
  role: string;
  label: string;
}[] = [
  { key: "kind", role: "dtp-member-kind", label: "Kind" },
  { key: "value", role: "dtp-member-value", label: "Value" },
  { key: "rangeEnd", role: "dtp-member-range-end", label: "Range end" },
];

/** The member's text, or `null` when the read does not hold it. */
export function dtpMemberText(read: DtpRead, key: DtpMemberKey): string | null {
  if (read.classified === null || read.house === null) return null;
  switch (key) {
    case "kind":
      return KIND_WORDS[read.classified.kind] ?? read.classified.kind;
    case "value":
      return isInterval(read.house) ? read.house.start : read.house;
    case "rangeEnd":
      return isInterval(read.house) ? read.house.end : null;
  }
}

export type DtpWhy = "blank-value" | "no-format" | "unread-code" | "bad-value";

export const DTP_REASON_TEXT: Record<
  Exclude<DtpWhy, "unread-code">,
  (context: { format: string }) => string
> = {
  "blank-value": () => "Type an element 1251 value.",
  "no-format": () => "Type the 1250 qualifier the value is read under.",
  "bad-value": ({ format }) =>
    `The value does not fit qualifier ${format}, names a date that does not exist, is a range sent without its hyphen, or is a dated range whose end is before its start.`,
};

/** The one sentence under NO SIGNAL for the `DTP` section. */
export function dtpSentinelText(read: DtpRead): string {
  if (read.value === "")
    return DTP_REASON_TEXT["blank-value"]({ format: read.format });
  if (read.format === "")
    return DTP_REASON_TEXT["no-format"]({ format: read.format });
  if (read.classified === null) return unreadCodeText(read.format, "x12");
  return DTP_REASON_TEXT["bad-value"]({ format: read.format });
}

export interface DtpWriteBack {
  call: EdiCall;
  output: string;
  note: string;
}

/** The kind's formatter, called with what the parser returned. `null` when there
 *  is no value to write. */
export function dtpWriteBack(read: DtpRead, lib: EdiLib): DtpWriteBack | null {
  if (read.classified === null || read.house === null) return null;
  const call = formatClassified(
    lib,
    X12_FUNCTIONS[read.classified.kind],
    read.house,
    read.classified.format,
  );
  const output = call.result as string;
  return {
    call,
    output,
    note:
      output === ""
        ? `${call.fn} returned the sentinel for this value and qualifier.`
        : "",
  };
}

// ---------------------------------------------------------------------------
// The pictures: the three elements taken apart, and a DTP value taken apart
// ---------------------------------------------------------------------------

const DIGITS = /^\d+$/;

/** What the code calls returned, in words. */
export function timeCodeWords(read: X12Read): string {
  if (read.code === "") return "";
  if (read.codeClass === null) return "not a 623 time code";
  if (read.codeClass.kind === "offset") return `offset ${read.offset}`;
  if (read.zone === null) return "a zone";
  if (read.zone.zone === "Local") return "local to the event, no zone named";
  const daylight =
    read.zone.daylight === true
      ? "daylight time"
      : read.zone.daylight === false
        ? "standard time"
        : "daylight not said";
  return `zone ${read.zone.zone}, ${daylight}`;
}

export interface ElementFigure {
  halves: PicHalf[];
  aria: string;
  /** Words under the picture: what the code calls returned, and what the last
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
 * HHMMSSD, HHMMSSDD); the time code is its own box, with what the code calls
 * returned. An element that is not the shape its element defines sits in one
 * neutral box, and a refused read (`result` null) draws every element neutral.
 */
export function elementFigure(state: X12State, read: X12Read): ElementFigure {
  const refused = !ok(read);
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
            {
              text: date.slice(0, 4),
              mask: "CCYY",
              group: group("date"),
              word: "year",
              bracket: "date",
            },
            {
              text: date.slice(4, 6),
              mask: "MM",
              group: group("date"),
              word: "month",
            },
            {
              text: date.slice(6, 8),
              mask: "DD",
              group: group("date"),
              word: "day",
            },
          ]
        : [{ text: date, mask: "", group: "neutral", word: "text" }];

  const decimals = time.length - 6;
  const timeFields: PicField[] =
    time === ""
      ? [NOT_SENT]
      : DIGITS.test(time) && [4, 6, 7, 8].includes(time.length)
        ? [
            {
              text: time.slice(0, 2),
              mask: "HH",
              group: group("time"),
              word: "hour",
              bracket: "time",
            },
            {
              text: time.slice(2, 4),
              mask: "MM",
              group: group("time"),
              word: "minute",
            },
            ...(time.length >= 6
              ? [
                  {
                    text: time.slice(4, 6),
                    mask: "SS",
                    group: group("time"),
                    word: "second",
                  },
                ]
              : []),
            ...(time.length >= 7
              ? [
                  {
                    text: time.slice(6),
                    mask: decimals === 1 ? "D" : "DD",
                    group: group("time"),
                    word:
                      decimals === 1
                        ? "tenths of a second"
                        : "hundredths of a second",
                  },
                ]
              : []),
          ]
        : [{ text: time, mask: "", group: "neutral", word: "text" }];

  const meaning = read.codeClass;
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
              meaning !== null && !refused && meaning.kind === "zone"
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
    notes.push(
      read.codeCall === null
        ? `classifyX12TimeCode("${code}") does not know it: ${timeCodeWords(read)}.`
        : `${read.codeCall.fn}("${code}") returned ${timeCodeWords(read)}.`,
    );
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
      : `Time code ${code}: ${timeCodeWords(read)}`,
  ].join(". ");
  return { halves, aria: `${aria}.`, notes };
}

/** The parts row of a `DTP` value: the element 1251 value and its 1250 qualifier. */
export function dtpParts(state: DtpState): PicPart[] {
  return [
    {
      text: state.value.trim(),
      caption: "1251 value",
      after: "",
      kind: "value",
    },
    { text: state.format.trim(), caption: "1250", after: "", kind: "code" },
  ];
}

export interface DtpFigure {
  halves: PicHalf[];
  separator: string;
  closing: string;
  aria: string;
}

/**
 * A `DTP` value taken apart along the layout the kind's formatter writes for the
 * qualifier (`shapeOf`), so `MMDDCCYY` and a range with a hyphen each get their
 * own order. No 1250 code states an offset, so a read value closes with
 * `no offset`.
 */
export function dtpFigure(read: DtpRead, lib: EdiLib): DtpFigure {
  const { value, format, classified } = read;
  let shape = null as ReturnType<typeof shapeOf>;
  if (classified !== null) {
    const fns = X12_FUNCTIONS[classified.kind];
    const write = (a: string, b: string): string => {
      if (fns.format === "formatX12Time")
        return lib.formatX12Time(a, classified.format);
      return fns.period
        ? (lib[fns.format] as (s: string, e: string, f: string) => string)(
            a,
            b,
            classified.format,
          )
        : (lib[fns.format] as (v: string, f: string) => string)(
            a,
            classified.format,
          );
    };
    shape = shapeOf(write, probeFamily(classified.kind));
  }
  const cut = shape === null ? null : cutValue(value, shape);
  const refused = read.house === null;
  const halves = cut === null ? plainHalves(value) : picHalves(cut, refused);
  const closing = !refused && cut !== null ? "no offset" : "";
  return {
    halves,
    separator: shape?.separator ?? "",
    closing,
    aria: figureAria(value, format, halves, closing),
  };
}

/** The words the timeline shows when there is no instant to place. */
export function timelineEmptyText(read: X12Read | null): string {
  if (read === null || !ok(read)) return "No value, so no instant to place.";
  if (read.mainKind === "time") {
    return "A time alone names no instant: nothing to place.";
  }
  return "A date alone names no instant: nothing to place.";
}

// ---------------------------------------------------------------------------
// Every text a region can show, for the height it reserves (`holdHtml`)
// ---------------------------------------------------------------------------

/** The texts each X12 Time Reader region can show. */
export function x12Texts() {
  const verdicts = ["Offset: stated (-12:00)", "Offset: not stated"];
  const details = [
    "The time code gives the offset from UTC, so the date and the time name one instant.",
    `The time code gives the offset from UTC.${NO_DAY}`,
    `The time code says local to the event. The place is elsewhere in the message. You supply its zone.${NO_DAY}`,
    `The code names the zone and says neither standard nor daylight, so the date decides. X12 states no offset for a named zone: Eastern.${NO_DAY}`,
    "A date alone names no instant in any zone.",
    `There is no date and no time code, so nothing says which day or where the clock was.${NO_DAY}`,
    "A blank time code means local to the event. The place is elsewhere in the message. You supply its zone.",
  ];
  const instantNotes = [
    "The local date-time read at the offset the time code states, with resolveLocal.",
    "A time alone names no instant: there is no date.",
    "A date alone names no instant.",
    REJECT_NOTE,
    "No instant: the code names Eastern time and states no offset. Pick the IANA zone it means for you.",
    "No instant: nothing here states an offset. Pick the zone.",
    "No value.",
  ];
  return {
    descriptions: X12_PRESETS.map((p) => p.description),
    dtpDescriptions: DTP_PRESETS.map((p) => p.description),
    verdicts,
    details,
    stripNotes: [
      STRIP_NOTE_NONE,
      STRIP_NOTE_STATED,
      STRIP_NOTE_ALONE,
      STRIP_NOTE_APPLIES,
    ],
    instantNotes,
    gaps: [`Widest gap: 26 h, between ${LONGEST_ZONE} and ${LONGEST_ZONE}`],
    reasons: Object.values(REASON_TEXT).map((f) => f({ timeCode: "XX" })),
    dtpReasons: [
      ...Object.values(DTP_REASON_TEXT).map((f) => f({ format: "XX" })),
      unreadCodeText("D6", "x12"),
      unreadCodeText("TR", "x12"),
      unreadCodeText("RTM", "x12"),
    ],
    timeNotes: [
      'classifyX12TimeCode("ABCDEFGH") does not know it: not a 623 time code.',
      "The last two digits of the time are hundredths of a second.",
    ],
    formatNotes: [
      "The date is element 373 read alone by parseX12Date. The time is element 337 read alone by parseX12Time.",
    ],
    dtpFormatNotes: [
      "formatX12DateRange returned the sentinel for this value and qualifier.",
    ],
    parseOutput:
      '"2024-06-15T14:30:00.12"\n{ kind: "offset", timeCode: "ABCDEFGH" }\n"-05:00"',
    dtpParseOutput:
      '{ kind: "dateTimeRange", format: "DTS" }\n{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }',
    parseCall:
      'parseX12DateAndTime("20240615", "14300012")\nclassifyX12TimeCode("ABCDEFGH")\nx12TimeCodeOffset("ABCDEFGH")',
    dtpParseCall:
      'classifyX12DateTimePeriodFormat("DTS")\nparseX12DateTimeRange("20240615143000-20240620160000", "DTS")',
    resolveCall: `resolveLocal("2024-06-15T14:30:00.12", "${LONGEST_ZONE}", { disambiguation: "reject" })`,
    dtpFormatCall:
      'formatX12DateTimeRange("2024-06-15T14:30:00", "2024-06-20T16:00:00", "DTS")',
    writeCall: 'formatX12TimeElement("14:30:00.12", "HHMMSSDD")',
  };
}
