/**
 * Pure helpers for the FHIR Date Checker (HLTH-94): one value, read as a FHIR R4 `date`,
 * `dateTime` and `instant` by `parseFHIR`, `isValidFHIR` and FHIR's own published patterns, and
 * written back at each precision with `formatFHIR`.
 *
 * Every sentence that says why a type refuses a value comes from a library result or a library
 * probe. Which precisions a type allows is found by calling `isValidFHIR` on five fixed samples,
 * and the site holds no table of FHIR's rules.
 *
 * Every printed call, and every result beside it, is a real `FhirLib` call. A blank form makes
 * none. No DOM and no gmt import: the library comes in from the mount.
 *
 * Naming rule: strings here name FHIR R4 (the `date`, `dateTime` and `instant` primitive types)
 * as data and nothing else: no law, no rule-making body, no vendor.
 */
import type {
  FhirDateTime,
  FhirDateType,
  FhirPrecision,
} from "@northguild/gmt/types";
import { Temporal } from "@js-temporal/polyfill";
import type { TimelineSpec } from "~/widgets/families/edi/edi-timeline";
import { callResultsText } from "./edi-render";
import {
  NO_RESULT_TEXT,
  readoutOf,
  runCall,
  type EdiCall,
} from "./edi-widgets";
import type { FhirLib } from "./fhir-lib";
import { callArgs } from "./punctuality-widgets";

export const CUSTOM_PRESET_ID = "custom";

/** The three FHIR types, in the order every table lists them. */
export const FHIR_TYPES: readonly FhirDateType[] = [
  "date",
  "dateTime",
  "instant",
];

/** The five precisions FHIR has, coarsest first. */
export const FHIR_PRECISIONS: readonly FhirPrecision[] = [
  "year",
  "month",
  "day",
  "second",
  "fraction",
];

/** One value at each precision, to find by probing which precisions a type allows. */
const SAMPLE: Record<FhirPrecision, string> = {
  year: "2024",
  month: "2024-06",
  day: "2024-06-15",
  second: "2024-06-15T10:30:00Z",
  fraction: "2024-06-15T10:30:00.5Z",
};

/** The library pattern each type is checked against. */
const PATTERN_NAME = {
  date: "fhirDate",
  dateTime: "fhirDateTime",
  instant: "fhirInstant",
} as const satisfies Record<FhirDateType, keyof FhirLib>;

// ---------------------------------------------------------------------------
// State and args
// ---------------------------------------------------------------------------

/** What a chat call or a permalink hands over. `preset` is a permalink's alone. */
export interface FhirArgs {
  value?: string;
  preset?: string;
}

/** What the DOM holds. The value is never trimmed. */
export interface FhirState {
  value: string;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface FhirPreset {
  id: string;
  label: string;
  description: string;
  value: string;
}

/** The examples. The first is the starter. */
export const FHIR_PRESETS: readonly FhirPreset[] = [
  {
    id: "month",
    label: "2024-06 is a month, not midnight on the 1st",
    description:
      "A month. FHIR keeps it as a month, and a parser that pads it to the 1st invents a moment the sender never sent.",
    value: "2024-06",
  },
  {
    id: "second-offset",
    label: "A moment with an offset: -05:00",
    description:
      "FHIR's own instant example. It is valid as dateTime and as instant, and not as date.",
    value: "2015-02-07T13:28:17-05:00",
  },
  {
    id: "fraction-z",
    label: "Three fraction digits and Z",
    description:
      "A fraction is part of the value, so .000 is kept as sent. The writer below cuts it to a coarser precision and never rounds.",
    value: "2017-01-01T00:00:00.000Z",
  },
  {
    id: "feb-30",
    label: "2024-02-30: the shape fits, the day does not exist",
    description:
      "FHIR's published patterns accept 30 as a day of February. The library does not, so this is shape only.",
    value: "2024-02-30",
  },
  {
    id: "leap-2016",
    label: "23:59:60 on 2016-12-31: an inserted leap second",
    description:
      "A second of 60 is valid when a leap second was inserted then. It has no instant of its own on a UTC axis, and the writer refuses it.",
    value: "2016-12-31T23:59:60Z",
  },
  {
    id: "leap-2017",
    label: "23:59:60 on 2017-12-31: no leap second",
    description:
      "The same shape one year later. No leap second was inserted at the end of 2017, so the pattern matches and the value is not valid.",
    value: "2017-12-31T23:59:60Z",
  },
  {
    id: "no-zone",
    label: "A time with no zone",
    description:
      "ISO 8601 allows it, and a FHIR dateTime allows it only for a date. FHIR's patterns need a zone once there is a time.",
    value: "2024-06-15T10:30:00",
  },
  {
    id: "minute",
    label: "A time to the minute",
    description:
      "ISO 8601 has minute precision. FHIR has none: a time always carries seconds, so the value is not FHIR.",
    value: "2024-06-15T10:30-05:00",
  },
  {
    id: "wall-date",
    label: "Late evening at -05:00: the date differs from UTC",
    description:
      "23:30 at -05:00 is already the next day in UTC. FHIR keeps the day the sender wrote, and the writer cuts to that day.",
    value: "2024-06-15T23:30:00-05:00",
  },
  {
    id: "bracket-zone",
    label: "A bracketed zone after Z",
    description:
      "An RFC 9557 zone in brackets is ISO-like, not FHIR. The writer turns it into the zone's offset.",
    value: "2024-06-15T10:30:00Z[Europe/Berlin]",
  },
];

export const presetState = (preset: FhirPreset): FhirState => ({
  value: preset.value,
});

/** The preset whose value equals the state's, as typed. */
export function matchPreset(state: FhirState): string {
  const hit = FHIR_PRESETS.find((p) => p.value === state.value);
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** Whether a call or a link seeds the widget: a value, or a preset it names. */
export function isSeeded(args: FhirArgs): boolean {
  return (
    args.value !== undefined || FHIR_PRESETS.some((p) => p.id === args.preset)
  );
}

/**
 * The state a chat call or a permalink seeds. A known `preset` is that preset. Otherwise a string
 * is kept as typed, and an absent key is blank.
 */
export function readArgs(args: FhirArgs): FhirState {
  const named = FHIR_PRESETS.find((p) => p.id === args.preset);
  if (named !== undefined) return presetState(named);
  const v: unknown = args.value;
  return {
    value: typeof v === "string" ? v : typeof v === "number" ? String(v) : "",
  };
}

/**
 * Strings only. The link names `preset` alone while the state matches one; otherwise the value,
 * untrimmed, unless it is empty.
 */
export function permalinkOf(state: FhirState): Record<string, string> {
  const id = matchPreset(state);
  if (id !== CUSTOM_PRESET_ID) return { preset: id };
  return state.value === "" ? {} : { value: state.value };
}

/** Whether nothing was typed, so no call is made and the widget says "nothing to read". */
export const fhirBlank = (state: FhirState): boolean => state.value === "";

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export const REASON_VALID = "Valid.";
export const REASON_SHAPE = "FHIR's pattern does not match this shape.";
export const REASON_NO_DAY = "The shape matches, but that day does not exist.";
export const REASON_FRACTION =
  "The shape matches, but the fraction is longer than nine digits.";
export const REASON_LEAP =
  "The shape matches, but no leap second was inserted then.";
export const REASON_FALLBACK =
  "The shape matches, but the library does not read it.";

/** One FHIR type's verdict on the value. */
export interface FhirRow {
  type: FhirDateType;
  /** `isValidFHIR(value, type)`. */
  valid: boolean;
  /** Whether FHIR's published pattern for the type matches. */
  pattern: boolean;
  /** The pattern matches and the value is not valid: the shape fits, the value does not. */
  shapeOnly: boolean;
  /** One sentence, from a library result or probe. */
  reason: string;
}

export type FhirAllowed = Record<FhirDateType, FhirPrecision[]>;

/** What reading a state made. */
export interface FhirRead {
  value: string;
  blank: boolean;
  /** `parseFHIR`'s call; `null` for a blank field, which makes none. */
  parse: EdiCall | null;
  /** What it returned; `null` for the sentinel or no call. */
  parsed: FhirDateTime | null;
  rows: FhirRow[];
  /** The precisions each type allows, found by probing; empty for a blank field. */
  allowed: FhirAllowed;
  /** Every call made, in the order it is printed. */
  calls: EdiCall[];
}

const NO_ALLOWED = (): FhirAllowed => ({ date: [], dateTime: [], instant: [] });

/** The precisions each type allows, from `isValidFHIR` on the five samples. */
function probeAllowed(lib: FhirLib): FhirAllowed {
  const out = NO_ALLOWED();
  for (const type of FHIR_TYPES) {
    out[type] = FHIR_PRECISIONS.filter((p) => lib.isValidFHIR(SAMPLE[p], type));
  }
  return out;
}

const withArticle = (p: FhirPrecision): string => `a ${p}`;

/** `a year, a month or a day`: a list joined with "or". */
export function precisionList(list: readonly FhirPrecision[]): string {
  const words = list.map(withArticle);
  return words.length <= 1
    ? words.join("")
    : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
}

/** The sentence for a value that parses but whose precision the type does not allow. */
export function precisionReason(
  precision: FhirPrecision,
  type: FhirDateType,
  allowed: readonly FhirPrecision[],
): string {
  return `A ${precision} value. ${type} takes ${precisionList(allowed)}.`;
}

export function readFhir(lib: FhirLib, value: string): FhirRead {
  if (value === "") {
    return {
      value,
      blank: true,
      parse: null,
      parsed: null,
      rows: [],
      allowed: NO_ALLOWED(),
      calls: [],
    };
  }
  const parse = runCall(lib, "parseFHIR", value);
  const parsed = parse.result as FhirDateTime | null;
  const allowed = probeAllowed(lib);

  const valids = FHIR_TYPES.map((t) => runCall(lib, "isValidFHIR", value, t));
  const tests: EdiCall[] = FHIR_TYPES.map((t) => ({
    fn: `${PATTERN_NAME[t]}.test`,
    args: [value],
    result: lib[PATTERN_NAME[t]].test(value),
  }));
  const probes: EdiCall[] = [];
  const probe = (c: EdiCall): unknown => {
    if (!probes.some((p) => p.fn === c.fn && p.args[0] === c.args[0])) {
      probes.push(c);
    }
    return c.result;
  };

  /** Why the shape matches and the value does not: three probes, in order, then a fallback. */
  const shapeReason = (): string => {
    if (!probe(runCall(lib, "isValidFHIR", value.slice(0, 10), "date"))) {
      return REASON_NO_DAY;
    }
    if (/\.\d{10,}/.test(value)) return REASON_FRACTION;
    if (/:60(?:[.Z+-]|$)/.test(value)) {
      if (!probe(runCall(lib, "isLeapSecond", value))) return REASON_LEAP;
    }
    return REASON_FALLBACK;
  };

  const rows = FHIR_TYPES.map((type, i): FhirRow => {
    const valid = valids[i]!.result === true;
    const pattern = tests[i]!.result === true;
    let reason = REASON_VALID;
    if (!valid) {
      if (parsed !== null) {
        reason = precisionReason(parsed.precision, type, allowed[type]);
      } else {
        reason = pattern ? shapeReason() : REASON_SHAPE;
      }
    }
    return { type, valid, pattern, shapeOnly: pattern && !valid, reason };
  });

  return {
    value,
    blank: false,
    parse,
    parsed,
    rows,
    allowed,
    calls: [parse, ...valids, ...tests, ...probes],
  };
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export const VERDICT_NOTHING = "Nothing to read";
export const VERDICT_NOT_FHIR = "Not a FHIR value";
const DETAIL_NOT_FHIR = "None of the three types reads it.";

/** The value's precision as a noun phrase. */
const PRECISION_NOUNS: Record<FhirPrecision, string> = {
  year: "A year",
  month: "A month",
  day: "A day",
  second: "A moment to the second",
  fraction: "A moment to a fraction of a second",
};

export interface FhirVerdict {
  tone: "neutral" | "good" | "bad";
  title: string;
  detail: string;
}

/** `date`, `date and dateTime`, `date, dateTime and instant`. */
function typeList(types: readonly string[]): string {
  return types.length <= 1
    ? types.join("")
    : `${types.slice(0, -1).join(", ")} and ${types.at(-1)}`;
}

/** The verdict: bad when the parser refuses, good with the precision named, neutral when blank. */
export function verdictOf(read: FhirRead): FhirVerdict {
  if (read.blank)
    return { tone: "neutral", title: VERDICT_NOTHING, detail: "" };
  if (read.parsed === null) {
    return { tone: "bad", title: VERDICT_NOT_FHIR, detail: DETAIL_NOT_FHIR };
  }
  const types = read.rows.filter((r) => r.valid).map((r) => r.type);
  return {
    tone: "good",
    title: PRECISION_NOUNS[read.parsed.precision],
    detail: `Valid as ${typeList(types)}.`,
  };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

type MemberKey = "value" | "precision" | "offset";

export const MEMBER_ROWS: readonly { key: MemberKey; label: string }[] = [
  { key: "value", label: "Value" },
  { key: "precision", label: "Precision" },
  { key: "offset", label: "Offset" },
];

export const OFFSET_NONE = "none (a year, month or day has no zone)";
export const OFFSET_ONE = "Z, +00:00 and -00:00 are one offset";

/** One member's text and state. The sentinel and a blank field give every row `no result`. */
export function memberReadout(
  read: FhirRead,
  key: MemberKey,
): { text: string; state: "value" | "absent" | "none" } {
  const parsed = read.parsed;
  if (parsed === null) return readoutOf(null, false);
  switch (key) {
    case "value":
      return readoutOf(parsed.value, true);
    case "precision":
      return readoutOf(parsed.precision, true);
    case "offset":
      if (parsed.offset === "") return { text: OFFSET_NONE, state: "absent" };
      return readoutOf(
        parsed.offset === "+00:00" && /(?:Z|-00:00)$/.test(parsed.value)
          ? `${parsed.offset} (${OFFSET_ONE})`
          : parsed.offset,
        true,
      );
  }
}

// ---------------------------------------------------------------------------
// The strip: what the value names
// ---------------------------------------------------------------------------

export const STRIP_LEAP =
  "A valid inserted leap second; it has no instant of its own on a UTC axis.";
export const STRIP_NOT_FHIR = "Not a FHIR value, so it names no span.";
export const STRIP_NOTHING = "Nothing to read.";
export const NOTE_SPAN = "FHIR keeps the precision. Nothing is padded.";
const NOTE_STATED =
  "The value states a moment and its offset, so it names one instant.";
const NOTE_NONE = "Type a value to see what it names.";

/** The first day a year, month or day value names, with the missing fields padded by `-01`. */
const padded = (value: string): string =>
  `${value}${"-01-01".slice(value.length === 4 ? 0 : value.length === 7 ? 3 : 6)}`;

/** What the timeline draws for a reading. */
export function stripOf(lib: FhirLib, read: FhirRead): TimelineSpec {
  if (read.blank) return { kind: "empty", text: STRIP_NOTHING };
  const parsed = read.parsed;
  if (parsed === null) return { kind: "empty", text: STRIP_NOT_FHIR };
  if (
    parsed.precision === "year" ||
    parsed.precision === "month" ||
    parsed.precision === "day"
  ) {
    const from = padded(parsed.value);
    const unit = parsed.precision;
    const next = Temporal.PlainDate.from(from).add(
      unit === "year"
        ? { years: 1 }
        : unit === "month"
          ? { months: 1 }
          : { days: 1 },
    );
    const last = next.subtract({ days: 1 }).toString();
    return {
      kind: "span",
      from,
      to: next.toString(),
      unit,
      label: unit === "day" ? from : `${from} to ${last}`,
      reference: { label: `Padded to midnight UTC: ${from}T00:00:00Z` },
    };
  }
  const instant = lib.toOffsetInstant(parsed.value);
  return instant === null
    ? { kind: "empty", text: STRIP_LEAP }
    : { kind: "stated", instant: instant.instant };
}

/** The sentence under the strip. */
export function stripNote(read: FhirRead): string {
  if (read.blank) return NOTE_NONE;
  if (read.parsed === null) return STRIP_NOT_FHIR;
  switch (read.parsed.precision) {
    case "year":
    case "month":
    case "day":
      return NOTE_SPAN;
    default:
      return NOTE_STATED;
  }
}

// ---------------------------------------------------------------------------
// The writer
// ---------------------------------------------------------------------------

/** One writer cell. `allowed` is whether the type allows the row's precision. */
export interface WriterCell {
  text: string;
  allowed: boolean;
  state: "value" | "none" | "empty";
}

export interface WriterRow {
  label: string;
  /** `null` for the default row, which passes no options. */
  precision: FhirPrecision | null;
  cells: Record<FhirDateType, WriterCell>;
}

export const DEFAULT_ROW_LABEL = "Default (no precision)";
export const WRITER_HEADS = FHIR_TYPES;

/** The six rows by three types, every cell a `formatFHIR` call. A blank value makes no call. */
export function writerOf(
  lib: FhirLib,
  value: string,
  allowed: FhirAllowed,
): WriterRow[] {
  const rows: (FhirPrecision | null)[] = [null, ...FHIR_PRECISIONS];
  return rows.map((precision) => {
    const cells = Object.fromEntries(
      FHIR_TYPES.map((t) => {
        const ok = precision === null || allowed[t].includes(precision);
        if (value === "") {
          return [t, { text: "", allowed: ok, state: "empty" } as WriterCell];
        }
        const out =
          precision === null
            ? lib.formatFHIR(value, t)
            : lib.formatFHIR(value, t, { precision });
        return [
          t,
          (out === ""
            ? { text: NO_RESULT_TEXT, allowed: ok, state: "none" }
            : { text: out, allowed: ok, state: "value" }) as WriterCell,
        ];
      }),
    ) as Record<FhirDateType, WriterCell>;
    return {
      label: precision === null ? DEFAULT_ROW_LABEL : precision,
      precision,
      cells,
    };
  });
}

/** The writer's caption sentence: the call made, once. */
export function writerCall(value: string): string {
  return `formatFHIR(${JSON.stringify(value)}, type, { precision })`;
}

/** The characters the longest writer cell holds. */
export const WRITER_CELL_WIDTH = 36;

// ---------------------------------------------------------------------------
// Reserved texts
// ---------------------------------------------------------------------------

/** The longest value the field takes. */
const LONGEST_VALUE = "2024-06-15T10:30:00.123456789+05:30".padEnd(64, "0");

/** The texts each region can show, so a hold keeps the size of the largest. */
export function fhirTexts() {
  const parse: EdiCall = {
    fn: "parseFHIR",
    args: [LONGEST_VALUE],
    result: { value: LONGEST_VALUE, precision: "fraction", offset: "+00:00" },
  };
  const calls: EdiCall[] = [
    parse,
    ...FHIR_TYPES.map((t) => ({
      fn: "isValidFHIR",
      args: [LONGEST_VALUE, t],
      result: false,
    })),
    ...FHIR_TYPES.map((t) => ({
      fn: `${PATTERN_NAME[t]}.test`,
      args: [LONGEST_VALUE],
      result: false,
    })),
    {
      fn: "isValidFHIR",
      args: [LONGEST_VALUE.slice(0, 10), "date"],
      result: false,
    },
    { fn: "isLeapSecond", args: [LONGEST_VALUE], result: false },
  ];
  const callText = (list: readonly EdiCall[]): string =>
    list.map((c) => `${c.fn}(${callArgs(c.args)[1]})`).join("\n");
  const longestList = precisionList(FHIR_PRECISIONS);
  return {
    descriptions: FHIR_PRESETS.map((p) => p.description),
    reasons: [
      REASON_VALID,
      REASON_SHAPE,
      REASON_NO_DAY,
      REASON_FRACTION,
      REASON_LEAP,
      REASON_FALLBACK,
      `A fraction value. dateTime takes ${longestList}.`,
    ],
    verdicts: [
      VERDICT_NOTHING,
      VERDICT_NOT_FHIR,
      ...Object.values(PRECISION_NOUNS),
    ],
    details: [DETAIL_NOT_FHIR, "Valid as date, dateTime and instant."],
    offsets: [OFFSET_NONE, `+00:00 (${OFFSET_ONE})`],
    /** Every answer a member row can hold, so its cell reserves the longest. */
    memberSamples: {
      value: FHIR_PRESETS.map((p) => p.value),
      precision: [...FHIR_PRECISIONS],
      offset: [OFFSET_NONE, `+00:00 (${OFFSET_ONE})`, "-05:00"],
    } satisfies Record<MemberKey, readonly string[]>,
    stripNotes: [NOTE_SPAN, NOTE_STATED, NOTE_NONE, STRIP_NOT_FHIR],
    parseCall: callText(calls),
    parseOutput: callResultsText(calls),
    writerValue: LONGEST_VALUE,
  };
}
