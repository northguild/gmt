/**
 * Pure helpers for the Cut-off Stack widget (TRAN-10): a sailing's whole
 * stack of deadlines, computed by `cutoffSchedule` against one departure,
 * earliest first, with weekend and holiday cut-offs rolled the way the
 * reader says — and no default.
 *
 * Every position drawn — where a cut-off closes, where it would have closed
 * with no calendar, which days are closed — comes from `cutoffAt`,
 * `cutoffSchedule`, `timeToCutoff`, `isPastCutoff` and `rollDate` alone.
 * `@js-temporal/polyfill` is used only to enumerate the local dates a
 * timeline needs to draw, never to move a cut-off.
 *
 * No DOM and no gmt import: `CutoffLib` comes in from the mount.
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  isZoneless,
  localParts,
  type CutoffAtOptions,
  type CutoffCalendar,
  type CutoffEntry,
  type CutoffLib,
  type CutoffScheduleOptions,
  type CutoffTime,
} from "./cutoff-widgets";

export const MAX_CUTOFFS = 4;

export const CUSTOM_PRESET_ID = "custom";

/** One cut-off row's controls, as the DOM holds them: every value a string,
 *  blank meaning "not set". */
export interface CutoffFields {
  name: string;
  offset: string;
  atLocalTime: string;
}

const BLANK_CUTOFF: CutoffFields = { name: "", offset: "", atLocalTime: "" };

export interface StackState {
  anchor: string;
  timeZone: string;
  /** How many of the four fieldsets are in use. */
  cutoffCount: string;
  cutoffs: [CutoffFields, CutoffFields, CutoffFields, CutoffFields];
  calendar: boolean;
  weekend: number[];
  /** Comma-separated text, as the reader typed it. */
  holidays: string;
  /** `""` when not given — never defaulted. */
  roll: string;
}

/** Seed arguments: the chat's `cutoffs` array (with `weekend`/`holidays` as
 *  arrays) wins over the flat permalink keys (`weekend`/`holidays` as
 *  comma text, `calendar: "on"`). */
export interface CutoffStackArgs {
  anchor?: string;
  timeZone?: string;
  cutoffs?: readonly {
    name?: string;
    offset?: string;
    atLocalTime?: string;
  }[];
  weekend?: readonly number[] | string;
  holidays?: readonly string[] | string;
  roll?: string;
  cutoffCount?: string;
  calendar?: string;
  name1?: string;
  offset1?: string;
  atLocalTime1?: string;
  name2?: string;
  offset2?: string;
  atLocalTime2?: string;
  name3?: string;
  offset3?: string;
  atLocalTime3?: string;
  name4?: string;
  offset4?: string;
  atLocalTime4?: string;
}

export interface StackPreset {
  id: string;
  label: string;
  description: string;
  anchor: string;
  timeZone: string;
  cutoffs: readonly CutoffFields[];
  calendar: boolean;
  weekend: readonly number[];
  holidays: string;
  roll: string;
}

const AMS = "Europe/Amsterdam";
const NY = "America/New_York";

const GATE: CutoffFields = {
  name: "gate-in",
  offset: "P2D",
  atLocalTime: "17:00",
};
const DOCS: CutoffFields = {
  name: "documents",
  offset: "P3D",
  atLocalTime: "12:00",
};
const VGM: CutoffFields = { name: "VGM", offset: "P1D", atLocalTime: "10:00" };
const SAIL = "2024-06-17T18:00:00+02:00[Europe/Amsterdam]";

/** Every preset is a section 9 row (appendix Z), so every result the widget
 *  shows is a verified value. */
export const STACK_PRESETS: readonly StackPreset[] = [
  {
    id: "rotterdam-weekend",
    label: "Monday 18:00 sailing: weekend cut-offs back to Friday",
    description:
      "The ship sails from Rotterdam at 18:00 on Monday 17 June 2024. Gate-in two days before lands on Saturday, so the preceding roll moves it back to Friday 17:00. Documents three days before is already Friday.",
    anchor: SAIL,
    timeZone: AMS,
    cutoffs: [GATE, DOCS],
    calendar: true,
    weekend: [6, 7],
    holidays: "",
    roll: "preceding",
  },
  {
    id: "rotterdam-following",
    label: "The same sailing, weekend cut-offs on to Monday",
    description:
      "The same sailing with the following roll. Saturday's gate-in and Sunday's VGM move forward to Monday: gate-in now closes one hour before the ship leaves. cutoffAt does not check that a cut-off comes before the departure.",
    anchor: SAIL,
    timeZone: AMS,
    cutoffs: [GATE, DOCS, VGM],
    calendar: true,
    weekend: [6, 7],
    holidays: "",
    roll: "following",
  },
  {
    id: "holiday",
    label: "A Thursday holiday: documents back to Wednesday",
    description:
      "The ship sails on Friday 10 May 2024, and Thursday the 9th is a holiday. Documents a day before rolls back to Wednesday. Gate-in six hours before is exact time, on an open day, and does not move.",
    anchor: "2024-05-10T18:00:00+02:00[Europe/Amsterdam]",
    timeZone: AMS,
    cutoffs: [
      { name: "gate-in", offset: "PT6H", atLocalTime: "" },
      { name: "documents", offset: "P1D", atLocalTime: "12:00" },
    ],
    calendar: true,
    weekend: [6, 7],
    holidays: "2024-05-09",
    roll: "preceding",
  },
  {
    id: "no-roll",
    label: "A calendar with no roll: there is no default",
    description:
      "A business calendar with no roll convention. Every industry answers the closed-day question differently, so there is no default: cutoffSchedule returns [].",
    anchor: SAIL,
    timeZone: AMS,
    cutoffs: [GATE, DOCS],
    calendar: true,
    weekend: [6, 7],
    holidays: "",
    roll: "",
  },
  {
    id: "no-calendar",
    label: "No calendar: sorted earliest first",
    description:
      "No calendar. The stack comes back sorted by instant, earliest first, whatever order the entries were given in. Gate-in with no local time keeps the departure's 18:00.",
    anchor: "2024-06-14T16:00:00Z",
    timeZone: AMS,
    cutoffs: [
      { name: "gate-in", offset: "P1D", atLocalTime: "" },
      { name: "document", offset: "P2D", atLocalTime: "17:00" },
      { name: "VGM", offset: "P1D", atLocalTime: "10:00" },
    ],
    calendar: false,
    weekend: [],
    holidays: "",
    roll: "",
  },
  {
    id: "skipped-hour",
    label: "02:30 on New York's spring-forward night",
    description:
      "VGM at 02:30 one day before a Monday departure lands on 10 March 2024, when New York's clocks skipped from 02:00 to 03:00. A skipped time is never shifted: one failed entry returns [] for the whole stack.",
    anchor: "2024-03-11T22:00:00Z",
    timeZone: NY,
    cutoffs: [
      { name: "gate-in", offset: "P1D", atLocalTime: "" },
      { name: "VGM", offset: "P1D", atLocalTime: "02:30" },
    ],
    calendar: false,
    weekend: [],
    holidays: "",
    roll: "",
  },
];

function padCutoffs(
  cutoffs: readonly CutoffFields[],
): [CutoffFields, CutoffFields, CutoffFields, CutoffFields] {
  const out: CutoffFields[] = [];
  for (let i = 0; i < MAX_CUTOFFS; i++)
    out.push(cutoffs[i] ?? { ...BLANK_CUTOFF });
  return out as [CutoffFields, CutoffFields, CutoffFields, CutoffFields];
}

function normaliseWeekend(days: readonly number[]): number[] {
  return [
    ...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)),
  ].sort((a, b) => a - b);
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * `cutoffs` (an array, the chat tool) wins over the flat permalink keys.
 * `cutoffCount` comes from `cutoffs.length`, else `cutoffCount` parsed as
 * 1-4, else the highest index with any non-blank field, else 1. `calendar`
 * is on when the chat gives `weekend` or `holidays`, or the permalink gives
 * `calendar: "on"`. A chat call with `holidays` and no `weekend` has
 * `weekend: []` — never guessed as `[6, 7]`. `roll` is never defaulted.
 */
export function readArgs(args: CutoffStackArgs): StackState {
  const isChat = Array.isArray(args.cutoffs);

  let cutoffs: CutoffFields[];
  let cutoffCountFromArray: number | undefined;
  if (isChat) {
    cutoffs = (
      args.cutoffs as readonly {
        name?: string;
        offset?: string;
        atLocalTime?: string;
      }[]
    )
      .slice(0, MAX_CUTOFFS)
      .map((c) => ({
        name: str(c?.name),
        offset: str(c?.offset),
        atLocalTime: str(c?.atLocalTime),
      }));
    cutoffCountFromArray = Math.max(1, Math.min(MAX_CUTOFFS, cutoffs.length));
  } else {
    const rec = args as unknown as Record<string, unknown>;
    cutoffs = [1, 2, 3, 4].map((n) => ({
      name: str(rec[`name${n}`]),
      offset: str(rec[`offset${n}`]),
      atLocalTime: str(rec[`atLocalTime${n}`]),
    }));
  }

  const cutoffCountArg = (() => {
    const n = Number.parseInt(str(args.cutoffCount), 10);
    return Number.isInteger(n) && n >= 1 && n <= MAX_CUTOFFS ? n : undefined;
  })();

  const highestNonBlank = (() => {
    for (let i = cutoffs.length - 1; i >= 0; i--) {
      const c = cutoffs[i]!;
      if (c.name || c.offset || c.atLocalTime) return i + 1;
    }
    return 1;
  })();

  const cutoffCount = cutoffCountFromArray ?? cutoffCountArg ?? highestNonBlank;

  let calendar: boolean;
  let weekend: number[];
  let holidays: string;
  let roll: string;

  if (isChat) {
    calendar = args.weekend !== undefined || args.holidays !== undefined;
    const weekendArr = Array.isArray(args.weekend) ? args.weekend : [];
    weekend = normaliseWeekend(
      weekendArr.filter((n): n is number => typeof n === "number"),
    );
    const holidaysArr = Array.isArray(args.holidays) ? args.holidays : [];
    holidays = holidaysArr
      .filter((h): h is string => typeof h === "string")
      .join(",");
    roll = str(args.roll);
  } else {
    calendar = args.calendar === "on";
    const weekendStr = str(args.weekend);
    weekend = normaliseWeekend(
      weekendStr === ""
        ? []
        : weekendStr
            .split(",")
            .map((s) => Number.parseInt(s.trim(), 10))
            .filter((n) => Number.isInteger(n)),
    );
    holidays = str(args.holidays);
    roll = str(args.roll);
  }

  return {
    anchor: str(args.anchor),
    timeZone: str(args.timeZone),
    cutoffCount: String(cutoffCount),
    cutoffs: padCutoffs(cutoffs),
    calendar,
    weekend,
    holidays,
    roll,
  };
}

/** `state` as a full preset's own shape, for applying a preset. */
export function presetState(preset: StackPreset): StackState {
  return {
    anchor: preset.anchor,
    timeZone: preset.timeZone,
    cutoffCount: String(preset.cutoffs.length),
    cutoffs: padCutoffs(preset.cutoffs),
    calendar: preset.calendar,
    weekend: [...preset.weekend],
    holidays: preset.holidays,
    roll: preset.roll,
  };
}

/** The preset whose every visible field matches `state`, trimmed, or
 *  `custom`. */
export function matchPreset(state: StackState): string {
  const t = (s: string) => s.trim();
  const n = Number.parseInt(state.cutoffCount, 10) || 0;
  const hit = STACK_PRESETS.find((p) => {
    if (p.cutoffs.length !== n) return false;
    if (t(p.anchor) !== t(state.anchor)) return false;
    if (t(p.timeZone) !== t(state.timeZone)) return false;
    if (p.calendar !== state.calendar) return false;
    if (p.weekend.join(",") !== state.weekend.join(",")) return false;
    if (t(p.holidays) !== t(state.holidays)) return false;
    if (t(p.roll) !== t(state.roll)) return false;
    for (let i = 0; i < n; i++) {
      const a = p.cutoffs[i]!;
      const b = state.cutoffs[i]!;
      if (
        t(a.name) !== t(b.name) ||
        t(a.offset) !== t(b.offset) ||
        t(a.atLocalTime) !== t(b.atLocalTime)
      ) {
        return false;
      }
    }
    return true;
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** `{ timeZone }`, plus `calendar: { weekend, holidays, timeZone }` when
 *  `calendar` is on (holidays split on commas and trimmed, blanks dropped;
 *  `calendar.timeZone` is the state's `timeZone` — the library does not
 *  read it), plus `roll` when not blank. The printed call is always the
 *  real call. */
export function optionsOf(state: StackState): CutoffScheduleOptions {
  const timeZone = state.timeZone.trim();
  const out: CutoffScheduleOptions = { timeZone };
  if (state.calendar) {
    const holidays = state.holidays
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    out.calendar = { weekend: [...state.weekend], holidays, timeZone };
  }
  const roll = state.roll.trim();
  if (roll !== "") out.roll = roll;
  return out;
}

/** The visible rows (`0..cutoffCount-1`) with a non-blank offset, as
 *  `{ name, offset, atLocalTime? }`. A blank name stays `""`. */
export function entriesOf(state: StackState): CutoffEntry[] {
  const n = Number.parseInt(state.cutoffCount, 10) || 0;
  const out: CutoffEntry[] = [];
  for (let i = 0; i < n; i++) {
    const c = state.cutoffs[i]!;
    const offset = c.offset.trim();
    if (offset === "") continue;
    const atLocalTime = c.atLocalTime.trim();
    out.push({
      name: c.name,
      offset,
      ...(atLocalTime !== "" ? { atLocalTime } : {}),
    });
  }
  return out;
}

/** `permalinkOf`'s strings only, blanks omitted, `weekend` joined with
 *  commas, `calendar: "on"` only when on. */
export function permalinkOf(state: StackState): Record<string, string> {
  const out: Record<string, string> = { cutoffCount: state.cutoffCount };
  const anchor = state.anchor.trim();
  const timeZone = state.timeZone.trim();
  if (anchor !== "") out.anchor = anchor;
  if (timeZone !== "") out.timeZone = timeZone;
  const n = Number.parseInt(state.cutoffCount, 10) || 0;
  for (let i = 0; i < n; i++) {
    const c = state.cutoffs[i]!;
    const idx = i + 1;
    if (c.name.trim() !== "") out[`name${idx}`] = c.name.trim();
    if (c.offset.trim() !== "") out[`offset${idx}`] = c.offset.trim();
    if (c.atLocalTime.trim() !== "") {
      out[`atLocalTime${idx}`] = c.atLocalTime.trim();
    }
  }
  if (state.calendar) out.calendar = "on";
  if (state.weekend.length > 0) out.weekend = state.weekend.join(",");
  if (state.holidays.trim() !== "") out.holidays = state.holidays.trim();
  if (state.roll.trim() !== "") out.roll = state.roll.trim();
  return out;
}

// ---------------------------------------------------------------------------
// Facts — every value the widget draws, from cutoffSchedule/cutoffAt/
// timeToCutoff/isPastCutoff/rollDate alone
// ---------------------------------------------------------------------------

export interface StackRow {
  name: string;
  at: string;
  /** The entry's own offset and local time, for the table's "Rule" column —
   *  echoed back from the matched entry, never re-derived from `at`. */
  offset: string;
  atLocalTime: string | undefined;
  /** The unrolled position (`cutoffAt` with no calendar), only when both a
   *  calendar and a roll are given. */
  unrolled: string | undefined;
  moved: boolean;
  /** `timeToCutoff(row.at, anchor)`. */
  beforeDeparture: string;
  /** `isPastCutoff(row.at, anchor)` — true when the roll put this cut-off
   *  after the departure (S7); `cutoffAt` does not check order. */
  afterDeparture: boolean;
}

export interface StackFacts {
  result: CutoffTime[];
  rows: StackRow[];
  /** Local date -> closed, for the axis dates spanned by the rows and the
   *  departure. Empty when there is no calendar, or it does not resolve. */
  closedDays: Record<string, boolean>;
  departure: string;
}

function entryOptions(
  entry: CutoffEntry,
  timeZone: string,
  calendar: CutoffCalendar | undefined,
  roll: string | undefined,
): CutoffAtOptions {
  return {
    timeZone,
    ...(entry.atLocalTime !== undefined
      ? { atLocalTime: entry.atLocalTime }
      : {}),
    ...(calendar !== undefined ? { calendar } : {}),
    ...(roll !== undefined ? { roll } : {}),
  };
}

/** Every local date `axis`-worthy: the earliest of every row's rolled and
 *  unrolled position, through the departure's date, inclusive. Date math
 *  only — no cut-off is computed here. */
export function axisDatesOf(
  rows: readonly { at: string; unrolled?: string }[],
  departure: string,
): string[] {
  const dates: string[] = [];
  for (const row of rows) {
    const d = localParts(row.at).date;
    if (d) dates.push(d);
    if (row.unrolled) {
      const du = localParts(row.unrolled).date;
      if (du) dates.push(du);
    }
  }
  const depDate = localParts(departure).date;
  if (depDate) dates.push(depDate);
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const start = Temporal.PlainDate.from(sorted[0]!);
  const end = Temporal.PlainDate.from(sorted[sorted.length - 1]!);
  const out: string[] = [];
  for (
    let cur = start;
    Temporal.PlainDate.compare(cur, end) <= 0;
    cur = cur.add({ days: 1 })
  ) {
    out.push(cur.toString());
  }
  return out;
}

/** `rollDate(date, "following", calendar) !== date`, per axis date — a
 *  library call that never moves a business day. `{}` with no calendar, or
 *  when the calendar does not resolve at all. */
export function closedDaysOf(
  dates: readonly string[],
  calendar: CutoffCalendar | undefined,
  lib: CutoffLib,
): Record<string, boolean> {
  if (!calendar) return {};
  const out: Record<string, boolean> = {};
  for (const date of dates) {
    const rolled = lib.rollDate(date, "following", calendar);
    if (rolled === "") return {};
    out[date] = rolled !== date;
  }
  return out;
}

export function collectStackFacts(
  state: StackState,
  lib: CutoffLib,
): StackFacts {
  const anchor = state.anchor.trim();
  const timeZone = state.timeZone.trim();
  const entries = entriesOf(state);
  const options = optionsOf(state);
  const result = lib.cutoffSchedule(anchor, entries, options);
  const departure = lib.etaAtZone(anchor, timeZone);

  const perEntry = entries.map((entry) => {
    const rolled = lib.cutoffAt(
      anchor,
      entry.offset,
      entryOptions(entry, timeZone, options.calendar, options.roll),
    );
    const unrolled =
      options.calendar !== undefined && options.roll !== undefined
        ? lib.cutoffAt(
            anchor,
            entry.offset,
            entryOptions(entry, timeZone, undefined, undefined),
          )
        : undefined;
    return {
      name: entry.name,
      offset: entry.offset,
      atLocalTime: entry.atLocalTime,
      rolled,
      unrolled,
    };
  });

  const used = new Set<number>();
  const rows: StackRow[] = result.map((r) => {
    const idx = perEntry.findIndex(
      (e, i) => !used.has(i) && e.name === r.name && e.rolled === r.at,
    );
    if (idx >= 0) used.add(idx);
    const match = idx >= 0 ? perEntry[idx] : undefined;
    const unrolled = match?.unrolled;
    const moved = unrolled !== undefined && unrolled !== r.at;
    return {
      name: r.name,
      at: r.at,
      offset: match?.offset ?? "",
      atLocalTime: match?.atLocalTime,
      unrolled,
      moved,
      beforeDeparture: lib.timeToCutoff(r.at, anchor),
      afterDeparture: lib.isPastCutoff(r.at, anchor),
    };
  });

  const dates = axisDatesOf(
    rows.map((r) => ({ at: r.at, unrolled: r.unrolled })),
    departure,
  );
  const closedDays = closedDaysOf(dates, options.calendar, lib);

  return { result, rows, closedDays, departure };
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type StackNullReason =
  | "invalid-zone"
  | "calendar-without-roll"
  | "roll-without-calendar"
  | "invalid-calendar"
  | "zoneless-anchor"
  | "invalid-anchor"
  | "invalid-offset"
  | "invalid-time"
  | "skipped-hour";

const STACK_NULL_TEMPLATE: Record<StackNullReason, string> = {
  "invalid-zone": "The terminal clock is not a time zone this browser knows.",
  "calendar-without-roll":
    "A business calendar needs a roll convention. There is no default, because every industry moves a closed-day cut-off its own way: a calendar with no roll returns [].",
  "roll-without-calendar":
    "A roll convention needs a business calendar to say which days are closed. A roll with no calendar returns [].",
  "invalid-calendar":
    "The calendar is not valid: check the holidays are real ISO dates.",
  "zoneless-anchor":
    "The departure has no offset or zone, so it is not a moment. Write its offset, or its zone in brackets.",
  "invalid-anchor": "The departure is not an instant or a zoned date-time.",
  "invalid-offset":
    "Cut-off {n}'s offset is not an ISO 8601 duration such as P2D or PT48H, or it leaves the range of instants.",
  "invalid-time":
    "Cut-off {n}'s local time is not a time of day such as 17:00.",
  "skipped-hour":
    'Cut-off {n} lands on a local time the clock skipped that day. cutoffAt never shifts a skipped time: it returns "", and one failed entry makes the whole stack [].',
};

export interface StackNull {
  reason: StackNullReason;
  n?: number;
}

/** The reason text for a `StackNull`. The only reason strings a Cut-off
 *  Stack shows. */
export function stackNullText(reason: StackNull): string {
  const template = STACK_NULL_TEMPLATE[reason.reason];
  return reason.n === undefined
    ? template
    : template.replace("{n}", String(reason.n));
}

/**
 * Why `cutoffSchedule` returned `[]` when there were entries to give it,
 * checked in the library's own order — each answer is a library probe, not a
 * client-side re-implementation of `cutoffAt`'s validation. `null` when the
 * result is not empty, or there were no entries at all (a correct empty
 * result, not a reason).
 */
export function stackNullReason(
  state: StackState,
  facts: StackFacts,
  lib: CutoffLib,
): StackNull | null {
  const entries = entriesOf(state);
  if (entries.length === 0) return null;
  if (facts.result.length > 0) return null;

  const anchor = state.anchor.trim();
  const timeZone = state.timeZone.trim();
  const options = optionsOf(state);

  if (!lib.isValidTimeZone(timeZone)) return { reason: "invalid-zone" };
  if (state.calendar && state.roll.trim() === "") {
    return { reason: "calendar-without-roll" };
  }
  if (!state.calendar && state.roll.trim() !== "") {
    return { reason: "roll-without-calendar" };
  }
  if (
    options.calendar !== undefined &&
    options.roll !== undefined &&
    lib.cutoffAt(anchor, "PT0S", {
      timeZone,
      calendar: options.calendar,
      roll: options.roll,
    }) === ""
  ) {
    return { reason: "invalid-calendar" };
  }
  if (lib.cutoffAt(anchor, "PT0S", { timeZone }) === "") {
    return isZoneless(anchor, lib)
      ? { reason: "zoneless-anchor" }
      : { reason: "invalid-anchor" };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const rolled = lib.cutoffAt(
      anchor,
      entry.offset,
      entryOptions(entry, timeZone, options.calendar, options.roll),
    );
    if (rolled !== "") continue;
    const n = i + 1;
    if (lib.cutoffAt(anchor, entry.offset, { timeZone: "UTC" }) === "") {
      return { reason: "invalid-offset", n };
    }
    if (
      entry.atLocalTime !== undefined &&
      lib.cutoffAt(anchor, "PT0S", {
        timeZone: "UTC",
        atLocalTime: entry.atLocalTime,
      }) === ""
    ) {
      return { reason: "invalid-time", n };
    }
    return { reason: "skipped-hour", n };
  }
  return null;
}
