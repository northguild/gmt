/**
 * Pure helpers for the Punctuality Board (TRAN-57): `scheduleDeviation`,
 * `classifyPunctuality` and `punctualityRate` judging a set of arrivals against
 * a tolerance the reader drags.
 *
 * Every deviation, class and rate comes from a real `PunctualityLib` call.
 * `@js-temporal/polyfill` is used only through `punctuality-widgets.ts` for
 * drawing (axis lengths, the weekday of a written date). The tool's one naive
 * value is the wall-clock reading: each planned and actual time rewritten as UTC
 * (`wallAsUtc`) and handed to the same three library calls.
 *
 * No DOM and no gmt import: the library comes in from the mount.
 */

import {
  isoToMinutes,
  niceMinutes,
  wallAsUtc,
  writtenLabel,
  writtenParts,
  writtenTime,
  type OnTimeRate,
  type PlannedActual,
  type Punctuality,
  type PunctualityLib,
  type PunctualityTolerance,
} from "./punctuality-widgets";

export const MAX_ROWS = 6;
export const CUSTOM_PRESET_ID = "custom";

/** What a switched-on tolerance starts at when the preset had none. */
export const DEFAULT_EARLY = "PT10M";
export const DEFAULT_COMPARE_LATE = "PT120M";

export interface BoardState {
  /** The id whose rows the state carries, or `"custom"`. */
  preset: string;
  rows: PlannedActual[];
  late: string;
  earlyOn: boolean;
  early: string;
  compareOn: boolean;
  compareLate: string;
}

/** What a chat call or a permalink hands over. Every value is read as a
 *  string; anything else becomes `""`. */
export interface PunctualityBoardArgs {
  pairs?: { planned: string; actual: string }[];
  preset?: string;
  pairCount?: string;
  late?: string;
  early?: string;
  compareLate?: string;
  [key: string]: unknown;
}

export interface BoardPreset {
  id: string;
  label: string;
  description: string;
  rows: readonly PlannedActual[];
  late: string;
  early?: string;
  compareLate?: string;
}

const LON = (t: string) => `2024-06-14T${t}+01:00[Europe/London]`;
const AMS = (t: string) => `2024-06-15T${t}+02:00[Europe/Amsterdam]`;
const SIN = (d: string, t: string) => `2024-06-${d}T${t}+08:00[Asia/Singapore]`;
const EDT = (t: string) => `2024-11-03T${t}-04:00[America/New_York]`;
const EST = (t: string) => `2024-11-03T${t}-05:00[America/New_York]`;

const pair = (planned: string, actual: string): PlannedActual => ({
  planned,
  actual,
});

/** Every preset's rows and results are appendix Z rows (PB1 to PB4). */
export const PUNCTUALITY_PRESETS: readonly BoardPreset[] = [
  {
    id: "fifteen-minute",
    label: "15-minute tolerance: six arrivals at a London station",
    description:
      "Six trains due at a London station on Friday 14 June 2024, against a 15-minute late tolerance. The 09:00 arrived at 09:15 exactly, on the late edge, which is late. With no early tolerance the two early arrivals are on time.",
    rows: [
      pair(LON("08:00:00"), LON("08:05:00")),
      pair(LON("08:30:00"), LON("08:44:59")),
      pair(LON("09:00:00"), LON("09:15:00")),
      pair(LON("09:30:00"), LON("09:47:00")),
      pair(LON("10:00:00"), LON("09:57:00")),
      pair(LON("10:30:00"), LON("10:18:00")),
    ],
    late: "PT15M",
  },
  {
    id: "sixty-and-120",
    label: "60/120-minute: the same six arrivals, two tolerances",
    description:
      "Six arrivals in Amsterdam on Saturday 15 June 2024, against a 60-minute and a 120-minute late tolerance at once. The same arrivals are 2 of 6 on time under one and 4 of 6 under the other, so a rate means nothing without its tolerance.",
    rows: [
      pair(AMS("07:00:00"), AMS("07:30:00")),
      pair(AMS("08:00:00"), AMS("08:59:00")),
      pair(AMS("09:00:00"), AMS("10:00:00")),
      pair(AMS("10:00:00"), AMS("11:35:00")),
      pair(AMS("11:00:00"), AMS("13:00:00")),
      pair(AMS("12:00:00"), AMS("14:30:00")),
    ],
    late: "PT60M",
    compareLate: "PT120M",
  },
  {
    id: "day-based",
    label: "Day-based: a day either side, both edges outside",
    description:
      "Six vessel calls at Singapore in June 2024, one day either side. Exactly 24 hours early is early and exactly 24 hours late is late: both edges belong to the outside.",
    rows: [
      pair(SIN("10", "06:00:00"), SIN("08", "18:00:00")),
      pair(SIN("12", "06:00:00"), SIN("11", "06:00:00")),
      pair(SIN("14", "06:00:00"), SIN("14", "00:00:00")),
      pair(SIN("16", "06:00:00"), SIN("17", "02:00:00")),
      pair(SIN("18", "06:00:00"), SIN("19", "06:00:00")),
      pair(SIN("20", "06:00:00"), SIN("23", "06:00:00")),
    ],
    late: "P1D",
    early: "P1D",
  },
  {
    id: "fall-back",
    label: "A delay across New York's fall-back",
    description:
      "Four arrivals on Sunday 3 November 2024, when New York's clocks went back from 02:00 to 01:00. The 01:30 arrived at the second 01:30, an hour late, and the station clock shows no delay. The wall-clock column is the naive reading.",
    rows: [
      pair(EDT("01:30:00"), EST("01:30:00")),
      pair(EDT("01:50:00"), EST("01:05:00")),
      pair(EDT("00:45:00"), EDT("01:10:00")),
      pair(EST("01:40:00"), EST("01:50:00")),
    ],
    late: "PT15M",
  },
];

const presetById = (id: string): BoardPreset | undefined =>
  PUNCTUALITY_PRESETS.find((p) => p.id === id);

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function presetState(preset: BoardPreset): BoardState {
  return {
    preset: preset.id,
    rows: preset.rows.map((r) => ({ ...r })),
    late: preset.late,
    earlyOn: preset.early !== undefined,
    early: preset.early ?? DEFAULT_EARLY,
    compareOn: preset.compareLate !== undefined,
    compareLate: preset.compareLate ?? DEFAULT_COMPARE_LATE,
  };
}

function flatRows(args: PunctualityBoardArgs): PlannedActual[] {
  const declared = Number.parseInt(str(args.pairCount), 10);
  let count = Number.isInteger(declared) ? declared : 0;
  if (count < 1) {
    while (count < MAX_ROWS && args[`planned${count + 1}`] !== undefined) {
      count++;
    }
  }
  count = Math.min(MAX_ROWS, Math.max(1, count));
  return Array.from({ length: count }, (_, i) =>
    pair(str(args[`planned${i + 1}`]), str(args[`actual${i + 1}`])),
  );
}

/**
 * The state a chat call or a permalink names. A `pairs` array (the chat) or
 * flat `planned1…` keys replace the rows and carry no preset, so the tolerance
 * is exactly what the call gives. Otherwise the preset named by `args.preset`
 * (else the first) is the base. Then each scalar present overrides its field:
 * `late`; `early` (`"none"` switches it off); `compareLate` (`"none"` the same).
 */
export function readArgs(args: PunctualityBoardArgs): BoardState {
  const hasRows = Array.isArray(args.pairs) || args.planned1 !== undefined;
  let state: BoardState;
  if (hasRows) {
    const rows = Array.isArray(args.pairs)
      ? args.pairs
          .slice(0, MAX_ROWS)
          .map((p) =>
            pair(
              str((p as Partial<PlannedActual> | null)?.planned),
              str((p as Partial<PlannedActual> | null)?.actual),
            ),
          )
      : flatRows(args);
    state = {
      preset: CUSTOM_PRESET_ID,
      rows,
      late: "",
      earlyOn: false,
      early: DEFAULT_EARLY,
      compareOn: false,
      compareLate: DEFAULT_COMPARE_LATE,
    };
  } else {
    const named =
      typeof args.preset === "string" ? presetById(args.preset) : undefined;
    state = presetState(named ?? PUNCTUALITY_PRESETS[0]!);
  }
  if (args.late !== undefined) state.late = str(args.late);
  if (args.early !== undefined) {
    const early = str(args.early);
    state.earlyOn = early !== "none";
    if (early !== "none") state.early = early;
  }
  if (args.compareLate !== undefined) {
    const compare = str(args.compareLate);
    state.compareOn = compare !== "none";
    if (compare !== "none") state.compareLate = compare;
  }
  return state;
}

/**
 * The state a widget opens on: the call's when it names rows or a preset (a
 * chat call, a permalink), else the first preset.
 */
export function initialState(args: PunctualityBoardArgs): BoardState {
  const seeded =
    args.pairs !== undefined ||
    args.planned1 !== undefined ||
    args.preset !== undefined;
  return seeded ? readArgs(args) : presetState(PUNCTUALITY_PRESETS[0]!);
}

export function toleranceA(state: BoardState): PunctualityTolerance {
  const early = state.early.trim();
  return {
    late: state.late.trim(),
    ...(state.earlyOn && early !== "" ? { early } : {}),
  };
}

/** The second tolerance; it exists only when `compareOn`. */
export function toleranceB(state: BoardState): PunctualityTolerance {
  const early = state.early.trim();
  return {
    late: state.compareLate.trim(),
    ...(state.earlyOn && early !== "" ? { early } : {}),
  };
}

const t = (s: string) => s.trim();

/** The preset whose rows **and** tolerance equal the state's, else `"custom"`. */
export function matchPreset(state: BoardState): string {
  const hit = PUNCTUALITY_PRESETS.find(
    (p) =>
      p.rows.length === state.rows.length &&
      p.rows.every(
        (r, i) =>
          t(r.planned) === t(state.rows[i]!.planned) &&
          t(r.actual) === t(state.rows[i]!.actual),
      ) &&
      t(p.late) === t(state.late) &&
      (p.early !== undefined) === state.earlyOn &&
      (p.early === undefined || t(p.early) === t(state.early)) &&
      (p.compareLate !== undefined) === state.compareOn &&
      (p.compareLate === undefined ||
        t(p.compareLate) === t(state.compareLate)),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The permalink for the state, strings only, each 1 to 64 characters. When the
 * state carries a preset's rows: `{ preset }` plus each tolerance field that
 * differs from the preset's (`"none"` for one switched off). Otherwise the flat
 * form, which reproduces what the reader sees.
 */
export function permalinkOf(state: BoardState): Record<string, string> {
  const preset = presetById(state.preset);
  if (preset) {
    const out: Record<string, string> = { preset: preset.id };
    if (t(state.late) !== "" && t(state.late) !== t(preset.late)) {
      out.late = t(state.late);
    }
    if (state.earlyOn) {
      if (preset.early === undefined || t(state.early) !== t(preset.early)) {
        if (t(state.early) !== "") out.early = t(state.early);
      }
    } else if (preset.early !== undefined) {
      out.early = "none";
    }
    if (state.compareOn) {
      if (
        preset.compareLate === undefined ||
        t(state.compareLate) !== t(preset.compareLate)
      ) {
        if (t(state.compareLate) !== "") out.compareLate = t(state.compareLate);
      }
    } else if (preset.compareLate !== undefined) {
      out.compareLate = "none";
    }
    return out;
  }
  const out: Record<string, string> = { pairCount: String(state.rows.length) };
  state.rows.forEach((r, i) => {
    if (t(r.planned) !== "") out[`planned${i + 1}`] = t(r.planned);
    if (t(r.actual) !== "") out[`actual${i + 1}`] = t(r.actual);
  });
  if (t(state.late) !== "") out.late = t(state.late);
  if (state.earlyOn && t(state.early) !== "") out.early = t(state.early);
  if (state.compareOn && t(state.compareLate) !== "") {
    out.compareLate = t(state.compareLate);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Facts: every figure is a library call
// ---------------------------------------------------------------------------

export interface RowFacts {
  deviation: string;
  classA: Punctuality | null;
  /** `null` unless the state compares. */
  classB: Punctuality | null;
  naiveDeviation: string;
  naiveClass: Punctuality | null;
}

export interface BoardFacts {
  rows: RowFacts[];
  rateA: OnTimeRate | null;
  rateB: OnTimeRate | null;
  naiveRate: OnTimeRate | null;
  /** Some row's wall-clock deviation differs from its measured one. */
  showNaive: boolean;
}

export function collectBoardFacts(
  state: BoardState,
  lib: PunctualityLib,
): BoardFacts {
  const a = toleranceA(state);
  const b = toleranceB(state);
  const rows = state.rows.map((r): RowFacts => {
    const planned = t(r.planned);
    const actual = t(r.actual);
    const wallP = wallAsUtc(planned);
    const wallA = wallAsUtc(actual);
    return {
      deviation: lib.scheduleDeviation(planned, actual),
      classA: lib.classifyPunctuality(planned, actual, a),
      classB: state.compareOn
        ? lib.classifyPunctuality(planned, actual, b)
        : null,
      naiveDeviation: lib.scheduleDeviation(wallP, wallA),
      naiveClass: lib.classifyPunctuality(wallP, wallA, a),
    };
  });
  const pairs = state.rows.map((r) => pair(t(r.planned), t(r.actual)));
  const wallPairs = pairs.map((r) =>
    pair(wallAsUtc(r.planned), wallAsUtc(r.actual)),
  );
  return {
    rows,
    rateA: lib.punctualityRate(pairs, a),
    rateB: state.compareOn ? lib.punctualityRate(pairs, b) : null,
    naiveRate: lib.punctualityRate(wallPairs, a),
    showNaive: rows.some((r) => r.naiveDeviation !== r.deviation),
  };
}

// ---------------------------------------------------------------------------
// Why NO SIGNAL
// ---------------------------------------------------------------------------

export type BoardNullReasonKind =
  | "invalid-late"
  | "invalid-early"
  | "invalid-compare"
  | "invalid-row";

export interface BoardNullReason {
  kind: BoardNullReasonKind;
  /** 1-based, for `invalid-row`. */
  row?: number;
}

/** A moment every tolerance probe is judged at. */
const REF = "2024-01-01T00:00:00Z";

/**
 * Why a result is NO SIGNAL, found by probing the library, in this order: the
 * late tolerance, the early tolerance, the second late tolerance, then the
 * first row that is not a pair of moments. `null` when every result is real.
 */
export function boardNullReason(
  state: BoardState,
  facts: BoardFacts,
  lib: PunctualityLib,
): BoardNullReason | null {
  if (lib.classifyPunctuality(REF, REF, { late: t(state.late) }) === null) {
    return { kind: "invalid-late" };
  }
  if (
    state.earlyOn &&
    t(state.early) !== "" &&
    lib.classifyPunctuality(REF, REF, {
      late: "PT0S",
      early: t(state.early),
    }) === null
  ) {
    return { kind: "invalid-early" };
  }
  if (
    state.compareOn &&
    lib.classifyPunctuality(REF, REF, { late: t(state.compareLate) }) === null
  ) {
    return { kind: "invalid-compare" };
  }
  const bad = facts.rows.findIndex((r) => r.deviation === "");
  if (bad >= 0) return { kind: "invalid-row", row: bad + 1 };
  return null;
}

const DURATION_ADVICE =
  "Write it as PT15M, PT1H30M or P1D: weeks, months and years have no fixed length, and a negative tolerance is refused, so classifyPunctuality returns null.";

export function boardReasonText(reason: BoardNullReason): string {
  switch (reason.kind) {
    case "invalid-late":
      return `The late tolerance is not an exact duration. ${DURATION_ADVICE}`;
    case "invalid-early":
      return `The early tolerance is not an exact duration. ${DURATION_ADVICE}`;
    case "invalid-compare":
      return `The second late tolerance is not an exact duration. ${DURATION_ADVICE}`;
    case "invalid-row":
      return `Arrival ${reason.row}'s planned or actual time has no offset or zone, so it is not a moment. One invalid pair makes punctualityRate return null, never a rate over the rest.`;
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** A tolerance field as minutes on the axis, or 0 when it is not readable. */
function axisField(text: string): number {
  const m = isoToMinutes(text);
  return m === null ? 0 : Math.abs(m);
}

/**
 * The half-length `R` of the axis, in minutes: the axis runs from `-R` to `+R`,
 * centred on the plan. `niceMinutes(1.2 × the largest of the valid
 * deviations, the tolerances in play and 5)`. Drawing only.
 */
export function axisMinutes(state: BoardState, facts: BoardFacts): number {
  const sizes = [
    5,
    axisField(state.late),
    state.earlyOn ? axisField(state.early) : 0,
    state.compareOn ? axisField(state.compareLate) : 0,
    ...facts.rows.map((r) => {
      const m = r.deviation === "" ? null : isoToMinutes(r.deviation);
      return m === null ? 0 : Math.abs(m);
    }),
  ];
  return niceMinutes(1.2 * Math.max(...sizes));
}

export interface BarSpan {
  from: number;
  to: number;
}

export interface BarLayout {
  /** The part of the bar inside the on-time band. */
  inside: BarSpan | null;
  /** The part outside it, drawn hatched. */
  outside: BarSpan | null;
}

/**
 * Where a deviation's bar lies against band A, in minutes on the axis. A bar
 * that ends exactly on an edge the library calls late or early has no length
 * outside, so it gets a zero-length span that the mount draws as a hatched cap:
 * the library's word is the truth and the picture must agree with it.
 */
export function barLayout(
  deviation: number,
  late: number | null,
  early: number | null,
  punctuality: Punctuality | null,
): BarLayout {
  if (deviation >= 0) {
    const edge = late ?? Number.POSITIVE_INFINITY;
    const inside = { from: 0, to: Math.min(deviation, edge) };
    let outside: BarSpan | null =
      deviation > edge ? { from: edge, to: deviation } : null;
    if (outside === null && punctuality === "late") {
      outside = { from: deviation, to: deviation };
    }
    return { inside: inside.to > 0 ? inside : null, outside };
  }
  if (early === null) {
    return { inside: { from: deviation, to: 0 }, outside: null };
  }
  const edge = -early;
  const inside = { from: Math.max(deviation, edge), to: 0 };
  let outside: BarSpan | null =
    deviation < edge ? { from: deviation, to: edge } : null;
  if (outside === null && punctuality === "early") {
    outside = { from: deviation, to: deviation };
  }
  return { inside: inside.from < 0 ? inside : null, outside };
}

// ---------------------------------------------------------------------------
// Row text
// ---------------------------------------------------------------------------

/** The clock part of text that is not a moment (`"2024-06-14T09:15:00"` is
 *  `"09:15"`), else the text as typed. Display only. */
function rawTime(text: string): string {
  return /T(\d{2}:\d{2})/.exec(text)?.[1] ?? (text.trim() || "none");
}

/**
 * A row's label: `"09:00 → 09:15"`, with the date on each side only when the
 * two dates differ. Text that is not a moment prints as typed.
 */
export function rowLabel(planned: string, actual: string): string {
  const p = writtenParts(planned);
  const a = writtenParts(actual);
  if (p.date === "" || a.date === "") {
    return `${rawTime(planned)} \u2192 ${rawTime(actual)}`;
  }
  return p.date === a.date
    ? `${writtenTime(planned)} \u2192 ${writtenTime(actual)}`
    : `${writtenLabel(planned)} \u2192 ${writtenLabel(actual)}`;
}

/** One time of a row, for a sentence: `"09:15"`; text that is not a moment
 *  prints as typed. */
export function rowTimeText(text: string): string {
  const p = writtenParts(text);
  return p.date === "" ? rawTime(text) : writtenTime(text);
}
