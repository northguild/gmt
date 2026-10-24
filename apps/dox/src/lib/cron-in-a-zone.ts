/**
 * The Cron in a Zone tool's pure logic (CORE-84): the presets, the seed and
 * permalink, the call list, the parsed-field display, and the two views the
 * widget draws, the night of a clock change and the next runs.
 *
 * **A widget draws the library's results and computes none of them.** `cronView`
 * only calls `lib` and arranges what comes back: every run, classification and
 * transition on the page is a return value. What is written here is copy, the
 * presets, the grouping of runs that share an instant, the join of the two next-run
 * lists, and tick and mark positions, which are drawing and use the polyfill.
 */
import { Temporal } from "@js-temporal/polyfill";
import type {
  CronLib,
  CronLibExpression,
  CronLibPolicy,
  CronLibRun,
  CronLibTransition,
} from "./cron-lib";
import type { EdiCall } from "./edi-widgets";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The permalink's cap on a string value (`widget-permalink.ts`). */
export const CRON_MAX_TEXT = 64;
/** Hours either side of the clock change that the night window covers. */
export const NIGHT_HALF_HOURS = 3;
export const NIGHT_HOURS = NIGHT_HALF_HOURS * 2;
/** Rows each touched-runs table reserves before it says "and N more". */
export const TOUCHED_ROWS = 8;
/** Runs each next-runs list asks for, and the rows it reserves. */
export const LIST_ROWS = 12;
export const POLICIES = ["crontabMatch", "daemonCatchUp"] as const;
export const PARSE_PAGE = "/reference/recurrence/parse/parseCronExpression/";

export const POLICY_LINE: Record<CronLibPolicy, string> = {
  crontabMatch:
    "Matches wall times: a skipped time never runs, a repeated time runs twice.",
  daemonCatchUp:
    "What the daemons do for fixed-time jobs: a skipped time runs at the change, a repeated time runs once.",
};

export const KIND_WORD: Record<CronLibRun["classification"], string> = {
  unique: "ordinary time",
  nonexistent: "skipped time",
  ambiguous: "repeated time",
};

export const NO_RUNS_TEXT = "No runs";
export const NO_TOUCHED_TEXT =
  "No run on this night falls in a skipped or repeated time";
export const WEEKDAY_NOTE = "ISO weekday numbers: 1 Monday, 7 Sunday";
export const NO_SIGNAL_TEXT = "⟨ NO SIGNAL — invalid input ⟩";
export const NO_SIGNAL_NOTE =
  "That text is outside the grammar documented on the parseCronExpression page.";

export const FIELD_LABELS = [
  ["minute", "Minute"],
  ["hour", "Hour"],
  ["dayOfMonth", "Day of month"],
  ["month", "Month"],
  ["dayOfWeek", "Day of week"],
] as const;

// ---------------------------------------------------------------------------
// Presets, seed and permalink
// ---------------------------------------------------------------------------

export interface CronPreset {
  id: string;
  label: string;
  line: string;
  zone: string;
  year: number;
  /** The 1-based ordinal of the year's clock change, as a digit string. */
  change: string;
  after?: string;
}

export const CRON_PRESETS: readonly CronPreset[] = [
  {
    id: "london-spring",
    label: "Daily 01:30, London, March 2024",
    line: "30 1 * * *",
    zone: "Europe/London",
    year: 2024,
    change: "1",
  },
  {
    id: "london-autumn",
    label: "Daily 01:30, London, October 2024",
    line: "30 1 * * *",
    zone: "Europe/London",
    year: 2024,
    change: "2",
  },
  {
    id: "sydney-every-five",
    label: "Every 5 minutes, Sydney, October 2024",
    line: "*/5 * * * *",
    zone: "Australia/Sydney",
    year: 2024,
    change: "2",
  },
  {
    id: "sydney-half-two",
    label: "Daily 02:30, Sydney, October 2024",
    line: "30 2 * * *",
    zone: "Australia/Sydney",
    year: 2024,
    change: "2",
  },
  {
    id: "midnight-job",
    label: "Daily midnight, São Paulo, November 2018",
    line: "0 0 * * *",
    zone: "America/Sao_Paulo",
    year: 2018,
    change: "2",
  },
  {
    id: "three-hours",
    label: "Daily 01:30, Casey, October 2020 (a 3 h gap)",
    line: "30 1 * * *",
    zone: "Antarctica/Casey",
    year: 2020,
    change: "2",
  },
  {
    id: "three-hours-back",
    label: "Daily 22:30, Casey, March 2021 (a 3 h overlap)",
    line: "30 22 * * *",
    zone: "Antarctica/Casey",
    year: 2021,
    change: "1",
  },
  {
    id: "day-rule",
    label: "1st, 15th and Mondays, London",
    line: "0 0 1,15 * 1",
    zone: "Europe/London",
    year: 2024,
    change: "1",
    after: "2023-12-31T23:00:00Z",
  },
  {
    id: "never",
    label: "30 February, Tokyo",
    line: "0 0 30 2 *",
    zone: "Asia/Tokyo",
    year: 2024,
    change: "1",
  },
];

export const DEFAULT_PRESET = CRON_PRESETS[0]!;
export const CUSTOM_PRESET_ID = "custom";
export const CUSTOM_PRESET_LABEL = "Your values";

/** Seed arguments: the chat tool's input and a permalink's values. */
export interface CronInAZoneArgs {
  line?: string;
  zone?: string;
  year?: number;
  change?: string;
  after?: string;
}

/** The widget's controls, as strings, which is what the DOM holds. */
export interface CronState {
  line: string;
  zone: string;
  year: string;
  change: string;
  after: string;
}

/** The seed as control values. The line is never trimmed. */
export function readArgs(args: CronInAZoneArgs): CronState {
  const line =
    typeof args.line === "string" && args.line !== ""
      ? args.line.slice(0, CRON_MAX_TEXT)
      : DEFAULT_PRESET.line;
  const zone =
    typeof args.zone === "string" && args.zone.trim() !== ""
      ? args.zone.trim()
      : DEFAULT_PRESET.zone;
  const year =
    typeof args.year === "number" && Number.isInteger(args.year)
      ? String(args.year)
      : String(DEFAULT_PRESET.year);
  const change =
    typeof args.change === "string" && /^[1-9]\d{0,1}$/.test(args.change)
      ? args.change
      : "1";
  const after =
    typeof args.after === "string" && args.after.trim() !== ""
      ? args.after.trim().slice(0, CRON_MAX_TEXT)
      : "";
  return { line, zone, year, change, after };
}

export function stateOfPreset(preset: CronPreset): CronState {
  return {
    line: preset.line,
    zone: preset.zone,
    year: String(preset.year),
    change: preset.change,
    after: preset.after ?? "",
  };
}

/** The preset the state equals, or `"custom"`. */
export function presetIdOf(state: CronState): string {
  const hit = CRON_PRESETS.find((p) => {
    const s = stateOfPreset(p);
    return (
      s.line === state.line &&
      s.zone === state.zone &&
      s.year === state.year &&
      s.change === state.change &&
      s.after === state.after
    );
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** The year a text field holds, or `null`. The permalink keeps 1900 to 2100. */
export function yearOf(text: string): number | null {
  if (!/^\d{4}$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n >= 1900 && n <= 2100 ? n : null;
}

/** The permalink's values: every field, with the year as a number. */
export function permalinkOf(state: CronState): Record<string, string | number> {
  const out: Record<string, string | number> = {
    line: state.line,
    zone: state.zone,
    change: state.change,
  };
  const year = yearOf(state.year);
  if (year !== null) out["year"] = year;
  if (state.after !== "") out["after"] = state.after;
  return out;
}

// ---------------------------------------------------------------------------
// Parsed fields
// ---------------------------------------------------------------------------

/** Values as text; runs of three or more consecutive values are written `a–b`. */
export function valuesText(values: readonly number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < values.length) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === values[j]! + 1) j += 1;
    if (j - i >= 2) parts.push(`${values[i]}–${values[j]}`);
    else for (let k = i; k <= j; k += 1) parts.push(String(values[k]));
    i = j + 1;
  }
  return parts.join(", ");
}

export interface FieldRow {
  key: (typeof FIELD_LABELS)[number][0];
  label: string;
  text: string;
  star: boolean;
}

export function fieldRows(expr: CronLibExpression): FieldRow[] {
  return FIELD_LABELS.map(([key, label]) => ({
    key,
    label,
    text: valuesText(expr[key].values),
    star: expr[key].star,
  }));
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface Tick {
  pct: number;
  utc: string;
  wall: string;
}

export interface Mark {
  pct: number;
  count: number;
  classification: CronLibRun["classification"];
  instant: string;
}

export interface TouchedRow {
  local: string;
  instant: string;
  classification: CronLibRun["classification"];
}

export interface Lane {
  policy: CronLibPolicy;
  runs: CronLibRun[];
  marks: Mark[];
  plate: string;
  touched: TouchedRow[];
  /** Touched runs past the reserved rows. */
  more: number;
}

export interface Night {
  transition: CronLibTransition;
  start: string;
  end: string;
  chip: string;
  ticks: Tick[];
  lanes: [Lane, Lane];
  same: boolean;
  sentence: string;
}

export interface ListRow {
  local: string;
  instant: string;
  classification: CronLibRun["classification"];
  /** The policy the row appears under alone, or `null`. */
  only: CronLibPolicy | null;
}

export interface ChangeOption {
  value: string;
  label: string;
}

export interface CronView {
  /** Set when the zone is not one the browser knows; nothing else was called. */
  zoneError: string | null;
  yearError: string | null;
  afterError: string | null;
  /** `parseCronExpression` was called. */
  parsed: boolean;
  /** `null` when the line was refused or never parsed. */
  expr: CronLibExpression | null;
  fields: FieldRow[] | null;
  changes: ChangeOption[];
  /** 1-based ordinal shown, or 0 when the year has no change. */
  ordinal: number;
  changeNote: string | null;
  night: Night | null;
  noChangeNote: string | null;
  afterUsed: string | null;
  lists: [ListRow[], ListRow[]] | null;
  calls: EdiCall[];
}

export const zoneErrorText = (zone: string): string =>
  `${zone} is not a time zone this browser knows.`;
export const yearErrorText = "Enter a year from 1900 to 2100.";
export const afterErrorText = (after: string): string =>
  `${after} is not an instant. Write one like 2024-03-31T01:00:00Z.`;
export const noChangeText = (year: number): string =>
  `This zone has no clock change in ${year}, so both rules give the same runs.`;
export const noChangeOptionText = (year: number | string): string =>
  `No clock change in ${year}`;
export const plateText = (n: number): string =>
  `${n} ${n === 1 ? "run" : "runs"} in these ${NIGHT_HOURS} hours`;

export function changeLabel(t: CronLibTransition): string {
  return `${t.instant.slice(0, 10)} ${t.instant.slice(11, 16)}Z, ${t.offsetBefore} → ${t.offsetAfter}`;
}

export function chipText(t: CronLibTransition): string {
  return `clock change, ${t.offsetBefore} → ${t.offsetAfter}`;
}

const HOUR_MS = 3_600_000;

const hhmm = (z: { hour: number; minute: number }): string =>
  `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;

function nightTicks(t: CronLibTransition, startMs: number): Tick[] {
  return Array.from({ length: NIGHT_HOURS + 1 }, (_, i) => {
    const ms = startMs + i * HOUR_MS;
    const instant = Temporal.Instant.fromEpochMilliseconds(ms);
    const offset = i < NIGHT_HALF_HOURS ? t.offsetBefore : t.offsetAfter;
    return {
      pct: (i / NIGHT_HOURS) * 100,
      utc: hhmm(instant.toZonedDateTimeISO("UTC")),
      wall: hhmm(instant.toZonedDateTimeISO(offset)),
    };
  });
}

/** Runs that share an instant stack as one mark. */
export function marksOf(runs: readonly CronLibRun[], startMs: number): Mark[] {
  const out: Mark[] = [];
  for (const run of runs) {
    const hit = out.find((m) => m.instant === run.instant);
    if (hit) {
      hit.count += 1;
      continue;
    }
    const ms = Temporal.Instant.from(run.instant).epochMilliseconds;
    out.push({
      pct: ((ms - startMs) / (NIGHT_HOURS * HOUR_MS)) * 100,
      count: 1,
      classification: run.classification,
      instant: run.instant,
    });
  }
  return out;
}

function laneOf(
  policy: CronLibPolicy,
  runs: CronLibRun[],
  startMs: number,
): Lane {
  const touched = runs
    .filter((r) => r.classification !== "unique")
    .map((r) => ({
      local: r.local,
      instant: r.instant,
      classification: r.classification,
    }));
  return {
    policy,
    runs,
    marks: marksOf(runs, startMs),
    plate: plateText(runs.length),
    touched: touched.slice(0, TOUCHED_ROWS),
    more: Math.max(0, touched.length - TOUCHED_ROWS),
  };
}

const sameRuns = (a: readonly CronLibRun[], b: readonly CronLibRun[]) =>
  a.length === b.length &&
  a.every(
    (r, i) =>
      r.instant === b[i]!.instant &&
      r.local === b[i]!.local &&
      r.classification === b[i]!.classification,
  );

export function sentenceOf(
  same: boolean,
  crontab: number,
  daemon: number,
): string {
  return same
    ? "Both rules give the same runs on this night."
    : `The rules differ on this night: ${crontab} ${crontab === 1 ? "run" : "runs"} under crontabMatch, ${daemon} under daemonCatchUp.`;
}

/**
 * Joins the two lists by instant, never by index. A row is `only` under its
 * policy when the other list does not hold its instant, unless the other list
 * stopped (it is full) before that instant, where absence says nothing.
 */
export function joinLists(
  crontab: readonly CronLibRun[],
  daemon: readonly CronLibRun[],
  count: number,
): [ListRow[], ListRow[]] {
  const mark = (
    own: readonly CronLibRun[],
    other: readonly CronLibRun[],
    policy: CronLibPolicy,
  ): ListRow[] => {
    const seen = new Set(other.map((r) => r.instant));
    const lastOther =
      other.length >= count ? other[other.length - 1]!.instant : null;
    return own.map((r) => ({
      local: r.local,
      instant: r.instant,
      classification: r.classification,
      only:
        !seen.has(r.instant) && (lastOther === null || r.instant <= lastOther)
          ? policy
          : null,
    }));
  };
  return [
    mark(crontab, daemon, "crontabMatch"),
    mark(daemon, crontab, "daemonCatchUp"),
  ];
}

function isInstant(text: string): boolean {
  try {
    Temporal.Instant.from(text);
    return true;
  } catch {
    return false;
  }
}

function call(
  lib: object,
  calls: EdiCall[],
  fn: string,
  ...args: unknown[]
): unknown {
  const result = (lib as Record<string, (...a: unknown[]) => unknown>)[fn]!(
    ...args,
  );
  calls.push({ fn, args, result });
  return result;
}

const emptyView = (): CronView => ({
  zoneError: null,
  yearError: null,
  afterError: null,
  parsed: false,
  expr: null,
  fields: null,
  changes: [],
  ordinal: 0,
  changeNote: null,
  night: null,
  noChangeNote: null,
  afterUsed: null,
  lists: null,
  calls: [],
});

/** Every call the tool makes for one state, and what they returned. */
export function cronView(lib: CronLib, state: CronState): CronView {
  const view = emptyView();
  const calls = view.calls;

  if (!call(lib, calls, "isValidTimeZone", state.zone)) {
    view.zoneError = zoneErrorText(state.zone);
    return view;
  }

  const expr = call(
    lib,
    calls,
    "parseCronExpression",
    state.line,
  ) as CronLibExpression | null;
  view.parsed = true;
  view.expr = expr;
  view.fields = expr ? fieldRows(expr) : null;

  const year = yearOf(state.year);
  if (year === null) {
    view.yearError = yearErrorText;
    return view;
  }

  const transitions = call(
    lib,
    calls,
    "getDstTransitions",
    state.zone,
    year,
  ) as CronLibTransition[];
  view.changes = transitions.map((t, i) => ({
    value: String(i + 1),
    label: changeLabel(t),
  }));

  let nightStart: string | null = null;
  if (transitions.length > 0) {
    const asked = Number(state.change);
    const ordinal = asked >= 1 && asked <= transitions.length ? asked : 1;
    view.ordinal = ordinal;
    if (ordinal !== asked) {
      view.changeNote = `This year has ${transitions.length} clock ${transitions.length === 1 ? "change" : "changes"}, so change ${state.change} shows change 1.`;
    }
    const transition = transitions[ordinal - 1]!;
    const instant = Temporal.Instant.from(transition.instant);
    const start = instant.subtract({ hours: NIGHT_HALF_HOURS });
    const end = instant.add({ hours: NIGHT_HALF_HOURS });
    nightStart = start.toString();
    if (expr) {
      const window = { start: nightStart, end: end.toString() };
      const crontab = call(
        lib,
        calls,
        "cronRuns",
        expr,
        state.zone,
        window,
        "crontabMatch",
      ) as CronLibRun[];
      const daemon = call(
        lib,
        calls,
        "cronRuns",
        expr,
        state.zone,
        window,
        "daemonCatchUp",
      ) as CronLibRun[];
      const startMs = start.epochMilliseconds;
      const same = sameRuns(crontab, daemon);
      view.night = {
        transition,
        start: window.start,
        end: window.end,
        chip: chipText(transition),
        ticks: nightTicks(transition, startMs),
        lanes: [
          laneOf("crontabMatch", crontab, startMs),
          laneOf("daemonCatchUp", daemon, startMs),
        ],
        same,
        sentence: sentenceOf(same, crontab.length, daemon.length),
      };
    }
  } else {
    view.noChangeNote = noChangeText(year);
  }

  if (!expr) return view;

  const afterUsed =
    state.after !== ""
      ? state.after
      : (nightStart ?? `${String(year).padStart(4, "0")}-01-01T00:00:00Z`);
  if (state.after !== "" && !isInstant(state.after)) {
    view.afterError = afterErrorText(state.after);
    return view;
  }
  view.afterUsed = afterUsed;
  const window = { after: afterUsed, count: LIST_ROWS };
  const crontab = call(
    lib,
    calls,
    "cronRuns",
    expr,
    state.zone,
    window,
    "crontabMatch",
  ) as CronLibRun[];
  const daemon = call(
    lib,
    calls,
    "cronRuns",
    expr,
    state.zone,
    window,
    "daemonCatchUp",
  ) as CronLibRun[];
  view.lists = joinLists(crontab, daemon, LIST_ROWS);
  return view;
}

/** One result as a line of the output pane. Runs print as their instants. */
export function resultText(
  fn: string,
  result: unknown,
  format: (value: unknown) => string,
): string {
  if (fn === "cronRuns" && Array.isArray(result)) {
    if (result.length === 0) return "[]";
    const runs = result as CronLibRun[];
    const shown = runs
      .slice(0, LIST_ROWS)
      .map((r) => r.instant)
      .join(", ");
    return `[${runs.length} ${runs.length === 1 ? "run" : "runs"}] ${shown}${runs.length > LIST_ROWS ? ", …" : ""}`;
  }
  return format(result);
}
