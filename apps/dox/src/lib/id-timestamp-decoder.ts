/**
 * Pure logic for the ID Timestamp Decoder (CORE-56).
 *
 * The reader pastes one identifier. Every reading calls all five decoders on it
 * as typed, in a fixed order, and the library says which one reads it. The site
 * never inspects the text to choose a decoder, and it holds no epoch, unit
 * factor or ID grammar: a widget draws the library's results and computes none
 * of them. The only conversion made here is a Snowflake layout field's text into
 * the number the library takes.
 *
 * No DOM, no library import (the library arrives as an `IdentifierLib`), so the
 * module is unit-testable and cheap to import.
 */
import { runCall, type EdiCall } from "./edi-widgets";
import type { IdentifierLib, SnowflakeLayout } from "./identifier-lib";

export const CUSTOM_PRESET_ID = "custom";

/** The longest identifier the input takes. */
export const ID_MAX_CHARS = 96;

/**
 * The widest instant any decoder can return, 28 characters. It sizes a value
 * cell and the hero, so a different instant never moves a box.
 */
export const WIDEST_INSTANT = "5236-03-31T21:21:00.6846975Z";

/** The longest Snowflake layout the call column prints, to size its cell. */
export const WIDEST_LAYOUT = {
  epochMs: -999999999999999,
  shift: 63,
  timestampBits: 63,
} as const;

export const EMPTY_ID_TEXT = "Paste an identifier.";
export const NONE_READ_TEXT =
  "None of the five decoders reads this text. Each returned its sentinel.";
export const MANY_READ_TEXT =
  "More than one decoder read this text. Each row that read is marked.";
export const NO_LAYOUT_TEXT =
  "Give an epoch and a shift: a Snowflake has no default layout.";
export const BAD_LAYOUT_TEXT = "The layout fields take whole numbers.";
export const NOT_CALLED_TEXT = "Not called";

/** The five formats, in the order the decoders are called. */
export const FORMATS = [
  { format: "UUID", fn: "fromUuidTimestamp" },
  { format: "ULID", fn: "fromUlid" },
  { format: "ObjectId", fn: "fromObjectId" },
  { format: "KSUID", fn: "fromKsuid" },
  { format: "Snowflake", fn: "fromSnowflake" },
] as const;

export type FormatWord = (typeof FORMATS)[number]["format"];

/** The text of the five controls. All strings, as they are typed. */
export interface IdDecoderState {
  id: string;
  epochMs: string;
  shift: string;
  timestampBits: string;
}

export interface IdTimestampDecoderArgs {
  preset?: string;
  id?: string;
  epochMs?: string;
  shift?: string;
  timestampBits?: string;
}

export type RowResult =
  | { kind: "read"; instant: string; version?: 1 | 6 | 7 }
  | { kind: "sentinel"; literal: "null" | '""' }
  | { kind: "not-called"; why: string };

export interface IdRow {
  format: FormatWord;
  fn: string;
  /** The call made, or `null` when the row was not called. */
  call: EdiCall | null;
  result: RowResult;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface IdPreset {
  id: string;
  label: string;
  description: string;
  state: IdDecoderState;
}

const noLayout = { epochMs: "", shift: "", timestampBits: "" } as const;

/**
 * Each preset's input is a vector the library spec gives, and its row result is
 * asserted against a real run in the mount test. A Snowflake preset is labelled
 * by its literal values.
 */
export const ID_PRESETS: readonly IdPreset[] = [
  {
    id: "uuid-v7",
    label: "UUID version 7",
    description: "A version 7 UUID, written in capitals.",
    state: { id: "017F22E2-79B0-7CC3-98C4-DC0C0C07398F", ...noLayout },
  },
  {
    id: "uuid-v1",
    label: "UUID version 1",
    description:
      "A version 1 UUID made at the same moment as the version 6 one.",
    state: { id: "C232AB00-9414-11EC-B3C8-9F6BDECED846", ...noLayout },
  },
  {
    id: "uuid-v6",
    label: "UUID version 6",
    description:
      "A version 6 UUID made at the same moment as the version 1 one.",
    state: { id: "1EC9414C-232A-6B00-B3C8-9F6BDECED846", ...noLayout },
  },
  {
    id: "uuid-v4",
    label: "UUID version 4",
    description: "A random UUID. It carries no time.",
    state: { id: "919108f7-52d1-4320-9bac-f847db4148a8", ...noLayout },
  },
  {
    id: "uuid-urn",
    label: "UUID with a urn:uuid: prefix",
    description: "The UUID of the version 1 preset, with a prefix in front.",
    state: {
      id: "urn:uuid:c232ab00-9414-11ec-b3c8-9f6bdeced846",
      ...noLayout,
    },
  },
  {
    id: "ulid",
    label: "ULID",
    description: "A ULID in its usual capitals.",
    state: { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", ...noLayout },
  },
  {
    id: "ulid-letter-i",
    label: "ULID ending in the letter I",
    description: "A ULID whose last character is the letter I.",
    state: { id: "01HK153X00000000000000000I", ...noLayout },
  },
  {
    id: "objectid",
    label: "ObjectId",
    description: "A 24-character ObjectId.",
    state: { id: "65a0f4d0c3b1a2e4f5d6c7b8", ...noLayout },
  },
  {
    id: "objectid-2038",
    label: "ObjectId starting with 8",
    description: "An ObjectId whose first byte has its top bit set.",
    state: { id: "800000000000000000000000", ...noLayout },
  },
  {
    id: "ksuid",
    label: "KSUID",
    description: "A 27-character KSUID in mixed case.",
    state: { id: "0ujtsYcgvSTl8PAuAdqWYSMnLOv", ...noLayout },
  },
  {
    id: "ksuid-lower",
    label: "The same KSUID, lower-cased",
    description:
      "The KSUID of the previous preset, with every letter lower-cased.",
    state: { id: "0ujtsycgvstl8pauadqwysmnlov", ...noLayout },
  },
  {
    id: "sf-1420070400000-22",
    label: "Snowflake · epoch 1420070400000 ms · shift 22",
    description: "A decimal ID read under an epoch and a shift you supply.",
    state: {
      id: "175928847299117063",
      epochMs: "1420070400000",
      shift: "22",
      timestampBits: "",
    },
  },
  {
    id: "sf-1288834974657-22-41",
    label: "Snowflake · epoch 1288834974657 ms · shift 22 · 41 bits",
    description:
      "A decimal ID read under an epoch, a shift and a timestamp width.",
    state: {
      id: "1050118621198921728",
      epochMs: "1288834974657",
      shift: "22",
      timestampBits: "41",
    },
  },
  {
    id: "sf-other-epoch",
    label: "The same digits under epoch 1420070400000 ms",
    description: "The ID of the previous preset, read under a different epoch.",
    state: {
      id: "1050118621198921728",
      epochMs: "1420070400000",
      shift: "22",
      timestampBits: "",
    },
  },
];

export const DEFAULT_PRESET = ID_PRESETS[0]!;

export function presetState(preset: IdPreset): IdDecoderState {
  return { ...preset.state };
}

/** The preset whose controls match `state` exactly, or `custom`. */
export function matchPreset(state: IdDecoderState): string {
  return (
    ID_PRESETS.find(
      (p) =>
        p.state.id === state.id &&
        p.state.epochMs === state.epochMs &&
        p.state.shift === state.shift &&
        p.state.timestampBits === state.timestampBits,
    )?.id ?? CUSTOM_PRESET_ID
  );
}

// ---------------------------------------------------------------------------
// Seeds and permalinks
// ---------------------------------------------------------------------------

const KEYS = ["preset", "id", "epochMs", "shift", "timestampBits"] as const;

/** Whether `args` names anything, so the widget opens on it and not on the default. */
export function isSeeded(args: IdTimestampDecoderArgs | undefined): boolean {
  return (
    args !== undefined &&
    // A blank `id` is a seed: a link made from a cleared field opens blank.
    (typeof args.id === "string" ||
      KEYS.some((k) => typeof args[k] === "string" && args[k] !== ""))
  );
}

/**
 * The state a seed describes: a preset (`preset`), then any key the seed also
 * names. With no preset the base is the default preset, whose layout is blank.
 */
export function readArgs(args: IdTimestampDecoderArgs): IdDecoderState {
  const named = ID_PRESETS.find((p) => p.id === args.preset);
  const state = presetState(named ?? DEFAULT_PRESET);
  for (const key of ["id", "epochMs", "shift", "timestampBits"] as const) {
    const v = args[key];
    // `id` may be blank: a cleared field must come back blank from its link.
    if (typeof v === "string" && (v !== "" || key === "id")) state[key] = v;
  }
  return state;
}

/**
 * The permalink keys for `state`: `preset` alone when it is exactly a preset,
 * else `id` (even blank) and the layout keys that hold text. Every value is a string.
 */
export function permalinkOf(state: IdDecoderState): Record<string, string> {
  const preset = matchPreset(state);
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  // `id` is always written, even blank, so the link does not fall back to the default.
  const out: Record<string, string> = { id: state.id };
  for (const key of ["epochMs", "shift", "timestampBits"] as const) {
    if (state[key] !== "") out[key] = state[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// From text to argument
// ---------------------------------------------------------------------------

const WHOLE_NUMBER = /^-?\d{1,16}$/;

export type LayoutRead =
  | { kind: "layout"; layout: SnowflakeLayout }
  | { kind: "none"; why: string };

/**
 * The Snowflake layout the three fields give, or the reason no call is made.
 * This is the only conversion the site makes: text that is a whole number
 * becomes `Number(text)`. The library judges every range itself.
 */
export function layoutOf(state: IdDecoderState): LayoutRead {
  const fields = [state.epochMs, state.shift, state.timestampBits];
  if (fields.some((f) => f !== "" && !WHOLE_NUMBER.test(f))) {
    return { kind: "none", why: BAD_LAYOUT_TEXT };
  }
  if (state.epochMs === "" || state.shift === "") {
    return { kind: "none", why: NO_LAYOUT_TEXT };
  }
  const layout: SnowflakeLayout = {
    epochMs: Number(state.epochMs),
    shift: Number(state.shift),
  };
  if (state.timestampBits !== "") {
    layout.timestampBits = Number(state.timestampBits);
  }
  return { kind: "layout", layout };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function resultOf(value: unknown): RowResult {
  if (value === null || value === undefined) {
    return { kind: "sentinel", literal: "null" };
  }
  if (typeof value === "string") {
    return value === ""
      ? { kind: "sentinel", literal: '""' }
      : { kind: "read", instant: value };
  }
  return { kind: "sentinel", literal: "null" };
}

/**
 * Calls all five decoders on `state.id` exactly as typed: no trim, no case
 * change. Trimming would hide the library's strict-form rule, and lower-casing
 * would turn one KSUID into another. The Snowflake decoder is called only when
 * the layout fields give a layout.
 */
export function readIds(lib: IdentifierLib, state: IdDecoderState): IdRow[] {
  const layout = layoutOf(state);
  const rows: IdRow[] = [];
  for (const { format, fn } of FORMATS) {
    if (fn === "fromSnowflake") {
      if (layout.kind === "none") {
        rows.push({
          format,
          fn,
          call: null,
          result: { kind: "not-called", why: layout.why },
        });
        continue;
      }
      const call = runCall(lib, "fromSnowflake", state.id, layout.layout);
      rows.push({ format, fn, call, result: resultOf(call.result) });
      continue;
    }
    const call = runCall(lib, fn, state.id);
    const result = resultOf(call.result);
    // The UUID decoder returns the instant alone; the version is `uuid.charAt(14)`.
    rows.push({
      format,
      fn,
      call,
      result:
        fn === "fromUuidTimestamp" && result.kind === "read"
          ? { ...result, version: Number(state.id.charAt(14)) as 1 | 6 | 7 }
          : result,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The hero
// ---------------------------------------------------------------------------

export type Hero =
  | { kind: "empty"; reason: string }
  | { kind: "one"; format: FormatWord; instant: string; version?: 1 | 6 | 7 }
  | { kind: "many"; count: number; reason: string }
  | { kind: "none"; reason: string };

export function heroOf(rows: readonly IdRow[], state: IdDecoderState): Hero {
  if (state.id === "") return { kind: "empty", reason: EMPTY_ID_TEXT };
  const read = rows.filter((r) => r.result.kind === "read");
  if (read.length === 0) return { kind: "none", reason: NONE_READ_TEXT };
  if (read.length > 1) {
    return { kind: "many", count: read.length, reason: MANY_READ_TEXT };
  }
  const only = read[0]!;
  const result = only.result as Extract<RowResult, { kind: "read" }>;
  return {
    kind: "one",
    format: only.format,
    instant: result.instant,
    ...(result.version === undefined ? {} : { version: result.version }),
  };
}

/** The version chip's text, `v1`, `v6` or `v7`, from the returned `version`. */
export function versionChip(version: number): string {
  return `v${version}`;
}
