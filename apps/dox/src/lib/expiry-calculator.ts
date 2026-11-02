/**
 * Pure helpers for the Expiry Calculator tool (CORE-104).
 *
 * The reader gives a length (an amount and one unit) and a start: a date they type or drag, or
 * Now. Four plates show that one length in the four forms a receiver wants: a cookie
 * `Max-Age`, an `Expires` header, a JWT `exp` and a signed-URL time. A table sets the next
 * twelve monthly starts beside a hand-written number. Every date and length on screen is a
 * library result (`durationFromUnits`, `totalDuration`, `ttlFromNow`, `addUnix`, `addUtc`,
 * `convertUtcToUnix`, `convertUtcToZoned`, `formatHttpDate`, `getUtcIn`, `isValidUtc`); this
 * module holds the state, the presets, the arguments a link or the chat can seed, the rows,
 * the verdict words and the printed calls. The one number it computes itself is the
 * hand-written one, because that is the mistake the tool exists to show.
 *
 * No DOM and no clock. Anything that reads the library takes an `ExpiryLib` as its first
 * argument, and `ttlFromNow` (the only call that reads the clock) is made by the mount, which
 * passes its result in.
 */
import type { ExpiryLib, ExpiryTtl, ExpiryUnits } from "./expiry-lib";
import { literal } from "./holiday-rule-builder";

export type ExpiryUnit =
  | "years"
  | "months"
  | "weeks"
  | "days"
  | "hours"
  | "minutes";

export const EXPIRY_UNITS: readonly ExpiryUnit[] = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
];

/** How many starts the table draws. */
export const ROW_COUNT = 12;

/** The slider's reach in whole days, either side of its anchor. */
export const SLIDER_DAYS = 730;

/** What a cell or plate reads when the library placed nothing. */
export const NO_RESULT_TEXT = "no result";

/** The widest start the Start date field takes, in characters. */
export const START_MAX_LENGTH = 32;
/** The most characters the Amount field takes. */
export const AMOUNT_MAX_LENGTH = 12;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface ExpiryPreset {
  id: string;
  label: string;
  description: string;
  amount: string;
  unit: ExpiryUnit;
  start: string;
}

export const EXPIRY_PRESETS: readonly ExpiryPreset[] = [
  {
    id: "year-across-leap",
    label: "One year across 29 February",
    description:
      "From 15 June 2027 a year ends in 2028, a leap year, so it is 366 days long.",
    amount: "1",
    unit: "years",
    start: "2027-06-15T12:00:00Z",
  },
  {
    id: "year-common",
    label: "One year, the same call a year earlier",
    description:
      "From 15 June 2026 a year spans no 29 February, so it is 365 days.",
    amount: "1",
    unit: "years",
    start: "2026-06-15T12:00:00Z",
  },
  {
    id: "year-from-leap-day",
    label: "One year from 29 February",
    description: "One year from 29 February 2028 ends on 28 February 2029.",
    amount: "1",
    unit: "years",
    start: "2028-02-29T12:00:00Z",
  },
  {
    id: "month-february",
    label: "One month in February",
    description: "A month that starts in February is only 28 days.",
    amount: "1",
    unit: "months",
    start: "2027-02-10T12:00:00Z",
  },
  {
    id: "month-end",
    label: "One month from 31 January",
    description:
      "February has no 31st, so the end clamps to the last day of the month.",
    amount: "1",
    unit: "months",
    start: "2027-01-31T12:00:00Z",
  },
  {
    id: "signed-url-90",
    label: "A 90-day signed URL",
    description:
      "A length in days is the same from any start, so the table below is flat.",
    amount: "90",
    unit: "days",
    start: "2027-06-15T12:00:00Z",
  },
  {
    id: "delete-cookie",
    label: "A cookie that is already gone",
    description:
      "A past Expires or a Max-Age of zero or less deletes a cookie. Now refuses a negative length.",
    amount: "-1",
    unit: "days",
    start: "2027-06-15T12:00:00Z",
  },
];

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State and arguments
// ---------------------------------------------------------------------------

export type ExpiryMode = "date" | "now";

export interface ExpiryState {
  /** The text typed. The library judges it. */
  amount: string;
  unit: ExpiryUnit;
  /** The text typed: an ISO UTC time. Kept while Now is chosen, so `A date` restores it. */
  start: string;
  mode: ExpiryMode;
  /**
   * The moment the table counts its starts from while Now is chosen: `getUtcIn({ seconds: 0 })`
   * taken when Now was chosen or the length changed. Blank until then.
   */
  snapshot: string;
}

export function presetState(preset: ExpiryPreset): ExpiryState {
  return {
    amount: preset.amount,
    unit: preset.unit,
    start: preset.start,
    mode: "date",
    snapshot: "",
  };
}

export interface ExpiryArgs {
  /** A preset id, from a permalink. */
  preset?: string;
  amount?: number | string;
  unit?: string;
  /** Absent means Now. An empty string is a date field the reader cleared. */
  start?: string;
}

/** Whether the args seed anything. */
export function isSeeded(args: ExpiryArgs): boolean {
  return (
    args.preset !== undefined ||
    args.amount !== undefined ||
    args.unit !== undefined ||
    args.start !== undefined
  );
}

function unitOf(value: unknown): ExpiryUnit | null {
  return EXPIRY_UNITS.find((u) => u === value) ?? null;
}

/**
 * Seed arguments as controls. A named preset wins. Otherwise `amount` and `unit` seed the
 * length (the first preset's where missing or unusable) and `start` seeds the date; a seed
 * with no `start` means Now, which is how the chat asks for it.
 */
export function readArgs(args: ExpiryArgs): ExpiryState {
  const named = EXPIRY_PRESETS.find((p) => p.id === args.preset);
  if (named) return presetState(named);
  const base = presetState(EXPIRY_PRESETS[0]!);
  if (typeof args.amount === "number" && Number.isFinite(args.amount)) {
    base.amount = String(args.amount);
  } else if (typeof args.amount === "string") {
    base.amount = args.amount;
  }
  base.unit = unitOf(args.unit) ?? base.unit;
  if (typeof args.start === "string") base.start = args.start;
  else if (args.amount !== undefined || args.unit !== undefined) {
    base.mode = "now";
  }
  return base;
}

/** The preset the state matches, or `custom`. Now matches none. */
export function matchPreset(state: ExpiryState): string {
  if (state.mode === "now") return CUSTOM_PRESET_ID;
  const hit = EXPIRY_PRESETS.find(
    (p) =>
      p.amount === state.amount &&
      p.unit === state.unit &&
      p.start === state.start,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The permalink payload: `{ preset }` alone while the state matches one, else `amount`,
 * `unit` and `start` as strings (`seedFromLocation` keeps only strings and years). No `start`
 * means Now.
 */
export function permalinkOf(state: ExpiryState): Record<string, unknown> {
  const preset = matchPreset(state);
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  return state.mode === "now"
    ? { amount: state.amount, unit: state.unit }
    : { amount: state.amount, unit: state.unit, start: state.start };
}

// ---------------------------------------------------------------------------
// The length
// ---------------------------------------------------------------------------

const WHOLE_OR_DECIMAL = /^[+-]?\d+(\.\d+)?$/;

/**
 * The unit object the library is given, or `null` when the amount is empty or not a number.
 * An empty amount is never `0`. A fraction is passed through: the library refuses it.
 */
export function unitsOf(state: ExpiryState): ExpiryUnits | null {
  const text = state.amount.trim();
  if (!WHOLE_OR_DECIMAL.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? { [state.unit]: n } : null;
}

/** Why no length was made, for the printed calls. */
function refusedAmountNote(state: ExpiryState): string {
  return state.amount.trim() === ""
    ? "Amount is empty: no call is made."
    : `${literal(state.amount)} is not a number: no call is made.`;
}

const FIXED_SECONDS: Record<ExpiryUnit, number> = {
  years: 365 * 86400,
  months: 30 * 86400,
  weeks: 604800,
  days: 86400,
  hours: 3600,
  minutes: 60,
};

/** Units that are one length from any start, in UTC. */
export const FIXED_UNITS: readonly ExpiryUnit[] = [
  "weeks",
  "days",
  "hours",
  "minutes",
];

/**
 * The hand-written number a caller types in: the amount times a fixed length for the unit
 * (a year is 365 days, a month 30). The tool's one value of its own, shown only to be compared.
 */
export function handWritten(state: ExpiryState): number | null {
  const units = unitsOf(state);
  if (units === null) return null;
  const n = units[state.unit]!;
  const total = n * FIXED_SECONDS[state.unit];
  return Number.isFinite(total) ? total : null;
}

// ---------------------------------------------------------------------------
// The four plates
// ---------------------------------------------------------------------------

export interface PlateValues {
  /** Cookie `Max-Age`, in seconds. */
  maxAge: number | null;
  /** The `Expires` header. */
  expires: string | null;
  /** A JWT `exp`, in Unix seconds. */
  exp: number | null;
  /** The signed-URL time. */
  signed: string | null;
}

export const NO_PLATES: PlateValues = {
  maxAge: null,
  expires: null,
  exp: null,
  signed: null,
};

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The four forms for one start, by the pure route: no clock, so the same start gives the same
 * answer. `start` must be valid; the caller checks `isValidUtc`.
 */
export function pureValues(
  lib: ExpiryLib,
  units: ExpiryUnits,
  start: string,
): PlateValues {
  const zoned = lib.convertUtcToZoned(start, "UTC");
  return {
    maxAge: numberOrNull(
      lib.totalDuration(lib.durationFromUnits(units), "seconds", {
        relativeTo: zoned,
      }),
    ),
    expires: textOrNull(lib.formatHttpDate(lib.addUtc(start, units))),
    exp: numberOrNull(
      lib.addUnix(
        lib.convertUtcToUnix(start, { epochUnit: "seconds" }) as number,
        units,
        { epochUnit: "seconds" },
      ),
    ),
    signed: textOrNull(lib.addUtc(start, units)),
  };
}

/** The four forms from one `ttlFromNow` result. `null` empties all four. */
export function ttlValues(ttl: ExpiryTtl | null): PlateValues {
  if (ttl === null) return NO_PLATES;
  return {
    maxAge: numberOrNull(ttl.seconds),
    expires: textOrNull(ttl.httpDate),
    exp: numberOrNull(ttl.epochSeconds),
    signed: textOrNull(ttl.iso),
  };
}

/**
 * The plates for a state. In a date it is the pure route; in Now it is the `ttlFromNow`
 * result the mount read, which is `undefined` until the first tick. A refused amount or an
 * invalid start gives no plate.
 */
export function platesOf(
  lib: ExpiryLib,
  state: ExpiryState,
  ttl: ExpiryTtl | null | undefined,
): PlateValues {
  const units = unitsOf(state);
  if (units === null) return NO_PLATES;
  if (state.mode === "now") return ttlValues(ttl ?? null);
  if (!lib.isValidUtc(state.start)) return NO_PLATES;
  return pureValues(lib, units, state.start);
}

/** The one `ttlFromNow` read a tick makes. `null` when the amount is refused. */
export function readTtl(lib: ExpiryLib, state: ExpiryState): ExpiryTtl | null {
  const units = unitsOf(state);
  return units === null ? null : lib.ttlFromNow(units);
}

// ---------------------------------------------------------------------------
// Printed calls
// ---------------------------------------------------------------------------

/** The calls that made the plates, as source with the library's results. */
export function callsOf(
  lib: ExpiryLib,
  state: ExpiryState,
  ttl: ExpiryTtl | null | undefined,
): string[] {
  const units = unitsOf(state);
  if (units === null) return [`// ${refusedAmountNote(state)}`];
  const u = literal(units);
  if (state.mode === "now") {
    if (ttl === undefined) return [`ttlFromNow(${u});`];
    if (ttl === null) return [`ttlFromNow(${u}); // null`];
    return [
      `ttlFromNow(${u});`,
      `// seconds: ${literal(ttl.seconds)}`,
      `// milliseconds: ${literal(ttl.milliseconds)}`,
      `// epochSeconds: ${literal(ttl.epochSeconds)}`,
      `// httpDate: ${literal(ttl.httpDate)}`,
      `// iso: ${literal(ttl.iso)}`,
    ];
  }
  const s = literal(state.start);
  const valid = lib.isValidUtc(state.start);
  if (!valid) return [`isValidUtc(${s}); // false`];
  const v = pureValues(lib, units, state.start);
  const zoned = literal(lib.convertUtcToZoned(state.start, "UTC"));
  return [
    `totalDuration(durationFromUnits(${u}), "seconds", { relativeTo: convertUtcToZoned(${s}, "UTC") }); // ${literal(v.maxAge)}`,
    `formatHttpDate(addUtc(${s}, ${u})); // ${literal(v.expires ?? "")}`,
    `addUnix(convertUtcToUnix(${s}, { epochUnit: "seconds" }), ${u}, { epochUnit: "seconds" }); // ${literal(v.exp)}`,
    `addUtc(${s}, ${u}); // ${literal(v.signed ?? "")}`,
    `// relativeTo is ${zoned}`,
  ];
}

/** The most lines the frame prints: the Now result, one call and its five fields. */
export const CALL_LINES = 6;

/**
 * The widest line either route can print, for the frame's hidden sizer. Built by the same
 * function the mount uses, over a library whose every call returns its widest result.
 */
export function callsSizerLine(): string {
  const wideText = "+275760-09-13T00:00:00Z";
  const wide = {
    durationFromUnits: () => "PT1S",
    totalDuration: () => -8640000000000,
    ttlFromNow: () => null,
    addUnix: () => -8640000000000,
    addUtc: () => wideText,
    convertUtcToUnix: () => -8640000000000,
    convertUtcToZoned: () => `${wideText.slice(0, -1)}+00:00[UTC]`,
    formatHttpDate: () => "Thu, 15 Jun 2028 12:00:00 GMT",
    getUtcIn: () => wideText,
    isValidUtc: () => true,
  } as unknown as ExpiryLib;
  const state: ExpiryState = {
    amount: "-99999999999",
    unit: "minutes",
    start: "+275760-09-13T00:00:00.00000000Z",
    mode: "date",
    snapshot: "",
  };
  const lines = callsOf(wide, state, undefined);
  const now = callsOf(
    wide,
    { ...state, mode: "now" },
    {
      seconds: -8640000000000,
      milliseconds: -8640000000000000,
      epochSeconds: -8640000000000,
      httpDate: "Thu, 15 Jun 2028 12:00:00 GMT",
      iso: wideText,
    },
  );
  return [...lines, ...now].reduce((a, b) => (b.length > a.length ? b : a));
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export type VerdictKind = "same" | "short" | "long" | "none";

export interface Comparison {
  kind: VerdictKind;
  /** The gap in seconds, whole and unsigned; 0 unless short or long. */
  gap: number;
}

/**
 * The hand-written number against the real `Max-Age`. "Short" means the real length is longer
 * than the number. Numbers only.
 */
export function compare(
  seconds: number | null,
  hand: number | null,
): Comparison {
  if (seconds === null || hand === null) return { kind: "none", gap: 0 };
  if (seconds === hand) return { kind: "same", gap: 0 };
  return seconds > hand
    ? { kind: "short", gap: seconds - hand }
    : { kind: "long", gap: hand - seconds };
}

/** A cell in the table's last column. */
export function compareWord(c: Comparison): string {
  switch (c.kind) {
    case "same":
      return "Same";
    case "short":
      return `Short by ${c.gap} s`;
    case "long":
      return `Long by ${c.gap} s`;
    default:
      return NO_RESULT_TEXT;
  }
}

export interface VerdictText {
  tone: "good" | "bad" | "neutral";
  title: string;
  detail: string;
}

/** The sentence under the plates. */
export function verdictText(
  c: Comparison,
  hand: number | null,
  unit: ExpiryUnit,
): VerdictText {
  if (c.kind === "none") {
    return {
      tone: "neutral",
      title: "No result",
      detail: "There is no result to compare.",
    };
  }
  if (c.kind === "same") {
    return {
      tone: "good",
      title: "Same",
      detail: FIXED_UNITS.includes(unit)
        ? `${hand} is right. A week, day, hour or minute is always the same length in UTC.`
        : `${hand} is right from this start. Try a start across 29 February.`,
    };
  }
  return {
    tone: "bad",
    title: compareWord(c),
    detail: `${hand} is ${c.gap} seconds ${c.kind} from this start.`,
  };
}

/** Every verdict the slot can show, at its widest, for the hold. */
export function verdictSamples(): VerdictText[] {
  const big = 8640000000000;
  const wide = (kind: "short" | "long") =>
    verdictText({ kind, gap: big }, big, "years");
  return [
    wide("short"),
    wide("long"),
    verdictText({ kind: "same", gap: 0 }, big, "years"),
    verdictText({ kind: "same", gap: 0 }, big, "days"),
    verdictText({ kind: "none", gap: 0 }, null, "years"),
  ];
}

// ---------------------------------------------------------------------------
// The next twelve starts
// ---------------------------------------------------------------------------

export interface StripRow {
  /** `addUtc(start, { months: i })`, or `null` when there is no start. */
  start: string | null;
  ends: string | null;
  seconds: number | null;
  word: string;
}

/** The moment the table counts from: the typed start, or the snapshot taken for Now. */
export function stripStart(state: ExpiryState): string {
  return state.mode === "now" ? state.snapshot : state.start;
}

/**
 * Twelve starts, always counted from the chosen one (so a 31 January start shows the clamp).
 * Each is judged by the `Max-Age` route. When Now was refused by `ttlFromNow` (`refused`),
 * the Ends, Seconds and verdict read `no result`, so the table never answers a length the
 * plates refused.
 */
export function stripRows(
  lib: ExpiryLib,
  state: ExpiryState,
  refused: boolean,
): StripRow[] {
  const units = unitsOf(state);
  const start = stripStart(state);
  const hand = handWritten(state);
  const usable = units !== null && !refused && lib.isValidUtc(start);
  return Array.from({ length: ROW_COUNT }, (_, i) => {
    if (!lib.isValidUtc(start)) {
      return { start: null, ends: null, seconds: null, word: NO_RESULT_TEXT };
    }
    const rowStart = textOrNull(lib.addUtc(start, { months: i }));
    if (!usable || rowStart === null) {
      return {
        start: rowStart,
        ends: null,
        seconds: null,
        word: NO_RESULT_TEXT,
      };
    }
    const values = pureValues(lib, units, rowStart);
    return {
      start: rowStart,
      ends: values.signed,
      seconds: values.maxAge,
      word: compareWord(compare(values.maxAge, hand)),
    };
  });
}

/** The snapshot for Now: `getUtcIn({ seconds: 0 })`, whole seconds. */
export function takeSnapshot(lib: ExpiryLib): string {
  return lib.getUtcIn({ seconds: 0 });
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

/** `addUtc(anchor, { days: offset })`: the widget does no date sum. */
export function startAt(
  lib: ExpiryLib,
  anchor: string,
  offset: number,
): string {
  return lib.addUtc(anchor, { days: offset });
}

/** The slider's end labels: the dates 730 days either side of the anchor. */
export function sliderEnds(lib: ExpiryLib, anchor: string): [string, string] {
  return [
    lib.addUtc(anchor, { days: -SLIDER_DAYS }),
    lib.addUtc(anchor, { days: SLIDER_DAYS }),
  ];
}

/** The date alone, for an end label or the slider's chip: the first ten characters. */
export function dayOf(text: string): string {
  const at = text.indexOf("T");
  return at === -1 ? text : text.slice(0, at);
}

// ---------------------------------------------------------------------------
// Spoken
// ---------------------------------------------------------------------------

/** What the status says after a settled change. */
export function sentenceOf(
  values: PlateValues,
  c: Comparison,
  hand: number | null,
  unit: ExpiryUnit,
): string {
  const maxAge =
    values.maxAge === null
      ? "Max-Age has no result."
      : `Max-Age is ${values.maxAge} seconds.`;
  const v = verdictText(c, hand, unit);
  return `${maxAge} ${v.title}. ${v.detail}`;
}
