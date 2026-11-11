/**
 * Pure helpers for the Double Precision Meter.
 *
 * One instant is written as a single Julian Date, a Modified Julian Date, seconds since J2000.0
 * and a two-part Julian Date, on the scale the reader picks. Each is read back to UTC and the
 * gap to the instant is the drift: what the number could not keep. The reader drags a year, and
 * lanes plot the drift measured at sample years across the whole range.
 *
 * Every drift is a library round trip, so nothing here is a formula for IEEE 754 spacing.
 * No DOM and no gmt import. Every function that calls the library takes a `DayCountLib`
 * (`timescale-lib.ts`).
 */
import { NO_RESULT_TEXT } from "./satellite-clock-converter";
import type { EdiCall } from "./edi-widgets";
import {
  FROM_FN,
  SCALES,
  TO_FN,
  microsText,
  numberText,
  partsText,
  spell,
  type Form,
  type Scale,
  type Spelling,
} from "./day-count-widgets";
import type { DayCountLib } from "./timescale-lib";
import { INTEGER_UTC_FROM, lacksOffset } from "./timescale-widgets";

export { NO_RESULT_TEXT };

export const CUSTOM_PRESET_ID = "custom";
export const MAX_VALUE_LENGTH = 64;

/** The slider's whole years: the first year the library counts to the last. */
export const SLIDER_MIN = Number(INTEGER_UTC_FROM.slice(0, 4));
export const SLIDER_MAX = 9999;

const isScale = (v: unknown): v is Scale => SCALES.some((s) => s === v);

/** The forms the plates show, in order. The two-part form is the zero baseline. */
export const METER_FORMS = [
  "jd",
  "mjd",
  "j2000",
  "parts",
] as const satisfies readonly Form[];
export type MeterForm = (typeof METER_FORMS)[number];

export const METER_NAMES: Record<MeterForm, string> = {
  jd: "Single JD",
  mjd: "MJD",
  j2000: "J2000 seconds",
  parts: "Two-part JD",
};

/** The series each form is drawn as: its plate's bar, its lane's line. */
export const METER_SERIES: Record<MeterForm, 1 | 2 | 3 | 4> = {
  jd: 1,
  mjd: 2,
  j2000: 3,
  parts: 4,
};

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

export const EMPTY_TEXT =
  "Type an instant, or pick a preset, to see how far each number drifts from it.";

/** The sentence for a date the calendar has no day for, in `year`. */
export const missingDate = (year: number): string =>
  `This date does not exist in ${year}.`;

export const SENTENCES = {
  missingOffset:
    "That time has no offset: end it with Z, as in 2026-01-01T12:00:00Z.",
  notAnInstant:
    "That is not a UTC instant: write it like 2026-01-01T12:00:00Z.",
  range: "The library counts days only from 1972-01-01 to the end of 9999.",
} as const;

/** The footnote when a single double cannot hold the instant. */
export const EDGE_NOTE = `${NO_RESULT_TEXT}: a single number cannot hold an instant this close to an end of the range. The two-part form can.`;

export const FOOTNOTES = [EDGE_NOTE] as const;

// ---------------------------------------------------------------------------
// Years
// ---------------------------------------------------------------------------

const YEAR_HEAD = /^\d{4}(?=-)/;

const DEFAULT_INSTANT = "2026-06-15T13:47:12.345678912Z";

/** The year of a UTC label, or `NaN` when it does not begin with one. */
export function yearOf(utc: string): number {
  const text = utc.trim();
  return YEAR_HEAD.test(text) ? Number(text.slice(0, 4)) : NaN;
}

/**
 * `instant` with its year replaced: a label edit, not a calculation. A label with no leading
 * year starts from the default instant, so the slider always has something to move. The library
 * decides whether the result exists (29 February in a common year does not).
 */
export function yearAt(instant: string, year: number): string {
  const head = String(year).padStart(4, "0");
  const text = instant.trim();
  return YEAR_HEAD.test(text)
    ? `${head}${text.slice(4)}`
    : `${head}${DEFAULT_INSTANT.slice(4)}`;
}

// ---------------------------------------------------------------------------
// State, presets, permalink
// ---------------------------------------------------------------------------

export interface MeterState {
  value: string;
  scale: Scale;
}

/** Seed arguments: the permalink's flat string keys, or a chat call's `value` and `scale`. */
export type DoublePrecisionMeterArgs = Record<string, unknown>;

interface MeterPreset {
  id: string;
  label: string;
  description: string;
  state: MeterState;
}

/**
 * Every preset is a worked case whose drift the library decides; the tests read each one
 * through the library. The descriptions state no figure the tests do not check.
 */
export const METER_PRESETS: readonly MeterPreset[] = [
  {
    id: "mid-2026",
    label: "Mid-2026",
    description:
      "The single JD is off by microseconds; the MJD and the J2000 seconds are far closer.",
    state: { value: DEFAULT_INSTANT, scale: "UTC" },
  },
  {
    id: "lost",
    label: "Twenty microseconds lost",
    description:
      "The single JD cannot keep 20 µs of a day; the two parts keep every one.",
    state: { value: "2026-01-01T12:00:00.00002Z", scale: "UTC" },
  },
  {
    id: "past-6771",
    label: "Past the power-of-two step",
    description:
      "After the JD reaches 2²² days the spacing between doubles doubles, and so does the drift.",
    state: { value: "7000-06-15T13:47:12.345678912Z", scale: "UTC" },
  },
  {
    id: "j2000",
    label: "J2000.0 itself",
    description: "J2000 seconds is exactly 0 here, so nothing drifts.",
    state: { value: "2000-01-01T11:58:55.816Z", scale: "TT" },
  },
  {
    id: "far",
    label: "The far end of the range",
    description: "J2000 seconds has grown large by 9999 and drifts too, on TT.",
    state: { value: "9999-06-15T13:47:12.345678912Z", scale: "TT" },
  },
];

export const DEFAULT_PRESET = METER_PRESETS[0]!;

export function presetState(preset: MeterPreset): MeterState {
  return { ...preset.state };
}

/** The preset whose value and scale match `state`, or `custom`. */
export function matchPreset(state: MeterState): string {
  const hit = METER_PRESETS.find(
    (p) =>
      p.state.value === state.value.trim() && p.state.scale === state.scale,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

const filled = (v: unknown): boolean => typeof v === "string" && v !== "";

/** Whether `args` names anything `readArgs` seeds from. */
export function isSeeded(args: DoublePrecisionMeterArgs | undefined): boolean {
  return (
    args !== undefined &&
    (filled(args["value"]) || filled(args["preset"]) || filled(args["scale"]))
  );
}

/**
 * The state a seed describes. A `value` is taken as written, on UTC unless a scale is named: a
 * scale is never guessed. With no value, a preset by its id (else the default) is the base, and
 * a named scale replaces its own.
 */
export function readArgs(args: DoublePrecisionMeterArgs): MeterState {
  const scale = isScale(args["scale"]) ? args["scale"] : undefined;
  const value = args["value"];
  if (typeof value === "string" && value !== "") {
    return { value: value.slice(0, MAX_VALUE_LENGTH), scale: scale ?? "UTC" };
  }
  const named = METER_PRESETS.find((p) => p.id === args["preset"]);
  return {
    ...presetState(named ?? DEFAULT_PRESET),
    ...(scale === undefined ? {} : { scale }),
  };
}

/** The permalink keys for `state`. The default writes nothing. */
export function permalinkOf(state: MeterState): Record<string, string> {
  const value = state.value.trim().slice(0, MAX_VALUE_LENGTH);
  if (value === "") return {};
  if (matchPreset({ ...state, value }) === DEFAULT_PRESET.id) return {};
  return { value, scale: state.scale };
}

// ---------------------------------------------------------------------------
// The measured samples
// ---------------------------------------------------------------------------

/**
 * Four fixed times of day, nine fractional digits each, on 15 June (a day no inserted second
 * touches). None is a short binary fraction of a day, so a single double cannot hold one
 * exactly.
 */
export const PROBES: readonly string[] = [
  "2026-06-15T05:41:13.274918653Z",
  "2026-06-15T11:02:47.918273645Z",
  "2026-06-15T16:29:31.561729384Z",
  "2026-06-15T22:53:08.837465219Z",
];

/** The JD at which a double's spacing doubles. A power of two, not a date. */
export const STEP_JD = 2 ** 22;

export interface MeterSample {
  year: number;
  /** The largest absolute drift of the probes, in nanoseconds, for each form. */
  ns: Record<MeterForm, bigint>;
}

export interface MeterSamples {
  scale: Scale;
  /** The first year whose JD is at or above `STEP_JD`, or `null` when the range never reaches it. */
  stepYear: number | null;
  samples: MeterSample[];
}

/** The first year, from 1972 to 9999, whose probe JD is at or above `STEP_JD`. */
export function stepYearOf(lib: DayCountLib, scale: Scale): number | null {
  const reaches = (year: number): boolean => {
    const jd = lib.toJulianDate(yearAt(PROBES[0]!, year), scale);
    return jd !== null && jd >= STEP_JD;
  };
  if (!reaches(SLIDER_MAX)) return null;
  let lo = SLIDER_MIN;
  let hi = SLIDER_MAX;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (reaches(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** 1972, every 50th year from 2000, 9999, and the two years either side of the step. */
export function sampleYears(stepYear: number | null): number[] {
  const years = new Set<number>([SLIDER_MIN, SLIDER_MAX]);
  for (let y = 2000; y < SLIDER_MAX; y += 50) years.add(y);
  if (stepYear !== null) {
    years.add(stepYear - 1);
    years.add(stepYear);
  }
  return [...years].sort((a, b) => a - b);
}

/**
 * The drift measured at each sample year on `scale`. For each probe a form is written, read back
 * and the two UTC labels spanned (`spanNs`, exact in nanoseconds; no inserted second falls on
 * 15 June, so no leap-second term is needed). The worst probe stands for the year. A form that
 * gives no reading for a probe leaves that probe out.
 *
 * Pure and synchronous: 4 forms, 4 probes and 3 calls for each of 164 years.
 */
export function meterSamples(lib: DayCountLib, scale: Scale): MeterSamples {
  const stepYear = stepYearOf(lib, scale);
  const samples = sampleYears(stepYear).map((year): MeterSample => {
    const ns: Record<MeterForm, bigint> = {
      jd: 0n,
      mjd: 0n,
      j2000: 0n,
      parts: 0n,
    };
    for (const probe of PROBES) {
      const utc = yearAt(probe, year);
      for (const form of METER_FORMS) {
        const written = lib[TO_FN[form]](utc, scale);
        if (written === null) continue;
        const back = (lib[FROM_FN[form]] as (v: unknown, s: string) => string)(
          written,
          scale,
        );
        if (back === "") continue;
        const shift = lib.spanNs(utc, back);
        if (shift === null) continue;
        const worst = shift < 0n ? -shift : shift;
        if (worst > ns[form]) ns[form] = worst;
      }
    }
    return { year, ns };
  });
  return { scale, stepYear, samples };
}

/** A drift in nanoseconds as a reader would say it: whole nanoseconds, or microseconds. */
export function driftText(ns: bigint): string {
  if (ns === 0n) return "0 ns";
  if (ns < 1000n) return `${ns} ns`;
  return `${ns / 1000n}.${String(ns % 1000n).padStart(3, "0")} µs`;
}

/** The largest drift of `form` over the samples, with the first year it occurs. */
export function worstOf(
  data: MeterSamples,
  form: MeterForm,
): { ns: bigint; year: number } {
  let best = { ns: 0n, year: data.samples[0]?.year ?? SLIDER_MIN };
  for (const s of data.samples) {
    if (s.ns[form] > best.ns) best = { ns: s.ns[form], year: s.year };
  }
  return best;
}

/** The plot's accessible name: the worst measured drift of each form and where it first occurs. */
export function lanesLabel(data: MeterSamples): string {
  const first = data.samples[0]?.year ?? SLIDER_MIN;
  const last = data.samples.at(-1)?.year ?? SLIDER_MAX;
  const forms = METER_FORMS.map((form) => {
    const worst = worstOf(data, form);
    return worst.ns === 0n
      ? `${METER_NAMES[form]}: 0 ns at every sample.`
      : `${METER_NAMES[form]}: up to ${driftText(worst.ns)}, first at ${worst.year}.`;
  });
  return `Measured drift from ${first} to ${last} on ${data.scale}, on a log axis from 1 ns to 100 µs. ${forms.join(" ")}`;
}

/** The samples of each scale, measured once for the life of the cache. */
export function sampleCache(lib: DayCountLib): {
  get(scale: Scale): MeterSamples;
} {
  const held = new Map<Scale, MeterSamples>();
  return {
    get(scale) {
      let data = held.get(scale);
      if (data === undefined) {
        data = meterSamples(lib, scale);
        held.set(scale, data);
      }
      return data;
    },
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface PlateSpec {
  role: string;
  caption: string;
  value: string | null;
  lines: readonly string[];
  series: 1 | 2 | 3 | 4;
}

export interface MeterRead {
  state: MeterState;
  status: "ok" | "empty" | "sentinel";
  failure: string | null;
  emptyText: string | null;
  /** The UTC instant every form is made from. */
  utc: string | null;
  /** The reader's year, or `null` before a reading. */
  year: number | null;
  plates: PlateSpec[];
  footnote: string;
  calls: EdiCall[];
}

const PLATE_ROLES: Record<MeterForm, string> = {
  jd: "hero-jd",
  mjd: "hero-mjd",
  j2000: "hero-j2000",
  parts: "hero-parts",
};

/** The call line a plate states: the function, the instant and the scale. */
export const callLine = (form: MeterForm, scale: Scale): string =>
  `${TO_FN[form]}(instant, "${scale}")`;

function valueText(s: Spelling): string | null {
  if (s.value === null) return null;
  return typeof s.value === "number" ? numberText(s.value) : partsText(s.value);
}

/** The plates of a reading. `null` draws the empty plates. */
function platesOf(
  spellings: readonly Spelling[] | null,
  scale: Scale,
): PlateSpec[] {
  return METER_FORMS.map((form, i): PlateSpec => {
    const s = spellings?.[i] ?? null;
    const text = s === null ? null : valueText(s);
    return {
      role: PLATE_ROLES[form],
      caption: METER_NAMES[form],
      value: s === null || s.shift === null ? null : microsText(s.shift),
      lines:
        s === null || s.shift === null || text === null
          ? []
          : [`value ${text}`, callLine(form, scale)],
      series: METER_SERIES[form],
    };
  });
}

function blank(
  state: MeterState,
  status: "empty" | "sentinel",
  text: string,
): MeterRead {
  return {
    state,
    status,
    failure: status === "sentinel" ? text : null,
    emptyText: status === "empty" ? text : null,
    utc: null,
    year: null,
    plates: platesOf(null, state.scale),
    footnote: "",
    calls: [],
  };
}

/** The reading of an empty widget. */
export function emptyRead(): MeterRead {
  return blank({ value: "", scale: "UTC" }, "empty", EMPTY_TEXT);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

/** Why the library gave no day count for a typed or slider-written instant. */
function whyNotInstant(lib: DayCountLib, value: string): string {
  if (lacksOffset(lib, value)) return SENTENCES.missingOffset;
  const year = yearOf(value);
  if (lib.hasSecond60(value) && Number.isFinite(year)) return missingDate(year);
  if (lib.isValidInstant(value)) return SENTENCES.range;
  if (ISO_DATE.test(value) && Number.isFinite(year)) {
    return year >= SLIDER_MIN && year <= SLIDER_MAX
      ? missingDate(year)
      : SENTENCES.range;
  }
  return SENTENCES.notAnInstant;
}

/**
 * Read the meter's instant with the library: write it as each form, read each back to UTC and
 * measure the gap. A state with no value makes no library call and is `empty`, not a sentinel.
 */
export function readMeter(lib: DayCountLib, state: MeterState): MeterRead {
  const value = state.value.trim();
  if (value === "") return blank(state, "empty", EMPTY_TEXT);
  const parts = spell(lib, value, "parts", state.scale);
  if (parts.value === null) {
    return blank(state, "sentinel", whyNotInstant(lib, value));
  }
  const spellings = METER_FORMS.map((form) =>
    form === "parts" ? parts : spell(lib, value, form, state.scale),
  );
  const calls = spellings.flatMap((s) =>
    s.call === null ? [s.to] : [s.to, s.call],
  );
  return {
    state,
    status: "ok",
    failure: null,
    emptyText: null,
    utc: value,
    year: yearOf(value),
    plates: platesOf(spellings, state.scale),
    footnote: spellings.some((s) => s.value === null) ? EDGE_NOTE : "",
    calls,
  };
}

/** The status line: what changed, in words. */
export function summaryText(read: MeterRead): string {
  if (read.status === "sentinel") return read.failure ?? "";
  if (read.status === "empty") return read.emptyText ?? "";
  return read.plates
    .map((p) => `${p.caption} ${p.value === null ? NO_RESULT_TEXT : p.value}`)
    .join(". ");
}
