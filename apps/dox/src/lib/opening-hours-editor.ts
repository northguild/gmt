/**
 * The Opening Hours Board's editor, as pure functions on its fields.
 *
 * `scheduleFromEditor` builds the schedule object the library is asked about, from the fields
 * exactly as typed: no window, date or zone is trimmed or repaired. `editorFromSchedule` goes the
 * other way for a seeded or linked schedule, reading the shape only: it never says whether the
 * schedule is valid, because the library decides that (`isValidOperatingSchedule`). `rowOfPart`
 * turns a path the probe names (`weekly["1"][0]`) into the editor row to mark.
 *
 * No DOM. This is the only place the Board builds a schedule object.
 */

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export interface WindowText {
  from: string;
  to: string;
}

export interface OverrideRow {
  date: string;
  windows: WindowText[];
}

/** The editor's fields. `weekdays[0]` is Monday, ISO weekday 1. */
export interface EditorState {
  timeZone: string;
  weekdays: WindowText[][];
  /** The holidays text area: one date per line. */
  holidays: string;
  overrides: OverrideRow[];
}

/** The weekday key the library reads for row `index`. */
const weekdayKey = (index: number): string => String(index + 1);

/** The lines of the holidays box. Only an empty line is dropped; a line is never trimmed. */
export function holidayLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line !== "");
}

const copyWindows = (windows: readonly WindowText[]): WindowText[] =>
  windows.map(({ from, to }) => ({ from, to }));

/** The schedule the fields spell, as typed. A weekday with no windows, a blank holidays box and no override rows are left out. */
export function scheduleFromEditor(state: EditorState): object {
  const weekly: Record<string, WindowText[]> = {};
  state.weekdays.forEach((windows, i) => {
    if (windows.length > 0) weekly[weekdayKey(i)] = copyWindows(windows);
  });
  const lines = holidayLines(state.holidays);
  return {
    timeZone: state.timeZone,
    weekly,
    ...(lines.length === 0 ? {} : { holidays: lines }),
    ...(state.overrides.length === 0
      ? {}
      : {
          overrides: state.overrides.map((o) => ({
            date: o.date,
            windows: copyWindows(o.windows),
          })),
        }),
  };
}

type EditorReading =
  | { kind: "fits"; state: EditorState }
  | { kind: "does-not-fit" };

const DOES_NOT_FIT: EditorReading = { kind: "does-not-fit" };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `{ from, to }` of two strings and nothing more, or `null`. */
function windowOf(v: unknown): WindowText | null {
  if (!isPlainObject(v)) return null;
  const keys = Object.keys(v);
  const { from, to } = v;
  if (keys.length !== 2 || typeof from !== "string" || typeof to !== "string")
    return null;
  return { from, to };
}

function windowsOf(v: unknown): WindowText[] | null {
  if (!Array.isArray(v)) return null;
  const out: WindowText[] = [];
  for (const entry of v) {
    const w = windowOf(entry);
    if (w === null) return null;
    out.push(w);
  }
  return out;
}

/**
 * The fields for a schedule, when the editor can hold it exactly. It reads the shape: the four
 * fields, a weekday key for each row, strings for every window, date and zone. A shape it cannot
 * hold (a weekday with no row, a list that would not survive the box, any other field) is
 * `does-not-fit`, and the caller keeps the fields it had. Validity is never decided here.
 */
export function editorFromSchedule(value: unknown): EditorReading {
  if (!isPlainObject(value)) return DOES_NOT_FIT;
  const known = new Set(["timeZone", "weekly", "holidays", "overrides"]);
  if (Object.keys(value).some((k) => !known.has(k))) return DOES_NOT_FIT;
  const { timeZone, weekly, holidays, overrides } = value;
  if (typeof timeZone !== "string" || !isPlainObject(weekly))
    return DOES_NOT_FIT;

  const keys = WEEKDAYS.map((_, i) => weekdayKey(i));
  if (Object.keys(weekly).some((k) => !keys.includes(k))) return DOES_NOT_FIT;
  const weekdays: WindowText[][] = [];
  for (const key of keys) {
    if (!(key in weekly)) {
      weekdays.push([]);
      continue;
    }
    const windows = windowsOf(weekly[key]);
    if (windows === null || windows.length === 0) return DOES_NOT_FIT;
    weekdays.push(windows);
  }

  let holidayText = "";
  if (holidays !== undefined) {
    if (!Array.isArray(holidays) || holidays.length === 0) return DOES_NOT_FIT;
    // A line is a date: an empty one or one with a break could not come back out of the box.
    if (
      holidays.some(
        (h) => typeof h !== "string" || h === "" || /[\r\n]/.test(h),
      )
    )
      return DOES_NOT_FIT;
    holidayText = holidays.join("\n");
  }

  const rows: OverrideRow[] = [];
  if (overrides !== undefined) {
    if (!Array.isArray(overrides) || overrides.length === 0)
      return DOES_NOT_FIT;
    for (const entry of overrides) {
      if (!isPlainObject(entry) || Object.keys(entry).length !== 2)
        return DOES_NOT_FIT;
      const windows = windowsOf(entry["windows"]);
      if (typeof entry["date"] !== "string" || windows === null)
        return DOES_NOT_FIT;
      rows.push({ date: entry["date"], windows });
    }
  }

  return {
    kind: "fits",
    state: { timeZone, weekdays, holidays: holidayText, overrides: rows },
  };
}

/** The editor row a refused part sits on. */
type EditorRow =
  | { kind: "weekday"; day: number; window?: number }
  | { kind: "holidays"; line?: number }
  | { kind: "override"; index: number };

const WEEKDAY_PATH = /^weekly\["(.*)"\](?:\[(\d+)\])?$/;
const HOLIDAY_PATH = /^holidays(?:\[(\d+)\])?$/;
const OVERRIDE_PATH = /^overrides\[(\d+)\]$/;

/** The row for a path the probe names, or `null` when the editor has no such row. */
export function rowOfPart(path: string): EditorRow | null {
  const weekday = WEEKDAY_PATH.exec(path);
  if (weekday) {
    const day = weekdayKeyIndex(weekday[1]!);
    if (day === null) return null;
    return weekday[2] === undefined
      ? { kind: "weekday", day }
      : { kind: "weekday", day, window: Number(weekday[2]) };
  }
  const holiday = HOLIDAY_PATH.exec(path);
  if (holiday) {
    return holiday[1] === undefined
      ? { kind: "holidays" }
      : { kind: "holidays", line: Number(holiday[1]) };
  }
  const override = OVERRIDE_PATH.exec(path);
  if (override) return { kind: "override", index: Number(override[1]) };
  return null;
}

function weekdayKeyIndex(key: string): number | null {
  const i = WEEKDAYS.findIndex((_, n) => weekdayKey(n) === key);
  return i === -1 ? null : i;
}
