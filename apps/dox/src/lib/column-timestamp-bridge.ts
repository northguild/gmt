/**
 * Pure logic for the Column Timestamp Bridge (CORE-56).
 *
 * One instant is stored three ways in data files: a Parquet INT96, an Arrow
 * `Timestamp` int64 and a protobuf `Timestamp`, with a protobuf `Duration`
 * beside them. In "encode" mode the reader gives an instant and the library's
 * converters write each form and read it back. In "decode" mode the reader types
 * stored values and the library reads them.
 *
 * The site holds no day number, unit factor or epoch: it draws what the library
 * returns and computes none of it. The only conversion made here is a field's
 * text into the argument type the library takes (a strict grammar; the library
 * judges every range). Whether a value suits a column is the library's
 * validators' to say, and the widget prints the validator call it made.
 *
 * No DOM, no library import (the library arrives as a `ColumnBridgeLib`), so the
 * module is unit-testable and cheap to import.
 */
import { runCall, type EdiCall } from "./edi-widgets";
import type {
  ColumnBridgeLib,
  ParquetInt96,
  ProtoDuration,
  ProtoTimestamp,
} from "./column-bridge-lib";
import { BRIDGE_PRESETS, stateOf } from "./column-timestamp-bridge-presets";

export const CUSTOM_PRESET_ID = "custom";

export const UNITS = [
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
] as const;
type Unit = (typeof UNITS)[number];
type Mode = "encode" | "decode";
type Int96Form = "record" | "bytes";

/** The text of the controls, all strings as typed (the mode and the unit are words). */
export interface BridgeState {
  mode: Mode;
  value: string;
  unit: Unit;
  zone: string;
  duration: string;
  int96Form: Int96Form;
  julianDay: string;
  nanosOfDay: string;
  bytes: string;
  int64: string;
  seconds: string;
  nanos: string;
  durSeconds: string;
  durNanos: string;
}

/** What a permalink or a chat call can carry: every key a string, all optional. */
export interface ColumnTimestampBridgeArgs {
  preset?: string;
  mode?: string;
  value?: string;
  unit?: string;
  zone?: string;
  duration?: string;
  int96Form?: string;
  julianDay?: string;
  nanosOfDay?: string;
  bytes?: string;
  int64?: string;
  seconds?: string;
  nanos?: string;
  durSeconds?: string;
  durNanos?: string;
}

export const NO_VALUE_TEXT = "Give an instant or a wall time.";
export const NO_DURATION_TEXT = "Give an ISO duration.";
export const NO_DECODE_TEXT = "Give a value to decode.";
export const BAD_NUMBER_TEXT = "Type a whole number";
export const BAD_HEX_TEXT = "Type 24 hex digits";
export const NOT_INSTANT_TEXT = "Not an instant, so there is no exact value.";
export const REASON_ZONELESS =
  "A zoneless column takes a wall time with no offset.";
export const REASON_ZONED = "A column with a zone takes an instant.";
export const REASON_INT64 =
  "An int64 of nanoseconds cannot hold this value, so the converter returned 0n, which is also the epoch.";
export const ZONELESS_CHIP = "zoneless: a wall time, not an instant";

/** The widest read-back any card can show, 33 characters. It sizes every value cell. */
export const WIDEST_READBACK = "-271821-04-20T00:00:00.000000001Z";
/** The widest stored lines, as the cards print them. */
export const WIDEST_STORED = [
  "julianDay: -97559412",
  "nanosOfDay: 86399999999999n",
  "-9223372036854775808n",
  "seconds: -9223372036854775808n",
  "nanos: -2147483648",
  "bytes: 00000000000000008c3d2500",
] as const;
/** The longest value the text field takes (a zoned value can run to about 70). */
export const VALUE_MAX_CHARS = 96;

/** The sentence for a typed zone this browser does not know. */
export function unknownZoneText(zone: string): string {
  return `${zone} is not a time zone this browser knows.`;
}

export type CardId = "int96" | "arrow" | "timestamp" | "duration";

export const CARDS: readonly { id: CardId; title: string }[] = [
  { id: "int96", title: "Parquet INT96" },
  { id: "arrow", title: "Arrow Timestamp" },
  { id: "timestamp", title: "protobuf Timestamp" },
  { id: "duration", title: "protobuf Duration" },
];

interface ReadBack {
  /** `local` is a zoneless Arrow read: a wall time, not an instant. */
  kind: "text" | "local";
  text: string;
}

export interface CardRead {
  id: CardId;
  /** `idle`: no call made. `read`: the library gave a value. `sentinel`: it gave its sentinel. */
  status: "idle" | "read" | "sentinel";
  /** The words an idle card shows. */
  idle: string;
  /** The stored fields, one per line. */
  stored: string[];
  readBack: ReadBack | null;
  /** Arrow with a zone: the same int64 read under a zoneless schema. */
  zonelessRead: string | null;
  /** The sentinel the card returned: `null`, `""` or `0n`. */
  literal: string;
  /** The validator call to print, when it returned false. */
  validator: EdiCall | null;
  reason: string;
  calls: EdiCall[];
}

export type Hero =
  | { kind: "empty"; reason: string }
  | { kind: "instant"; exact: string; call: EdiCall }
  | { kind: "not-instant"; call: EdiCall; reason: string; signal: boolean };

export interface LadderRow {
  label: string;
  text: string;
}

export interface Reading {
  mode: Mode;
  hero: Hero | null;
  cards: CardRead[];
  ladder: LadderRow[] | null;
  /** Every call made, in the order made, each once. */
  calls: EdiCall[];
  /** Whether the results pane marks refusals as NO SIGNAL. */
  failed: boolean;
}

// ---------------------------------------------------------------------------
// Presets, seeds and permalinks
// ---------------------------------------------------------------------------

export function presetState(preset: { state: BridgeState }): BridgeState {
  return { ...preset.state };
}

const STATE_KEYS = [
  "mode",
  "value",
  "unit",
  "zone",
  "duration",
  "int96Form",
  "julianDay",
  "nanosOfDay",
  "bytes",
  "int64",
  "seconds",
  "nanos",
  "durSeconds",
  "durNanos",
] as const satisfies readonly (keyof BridgeState)[];

const BLANK = stateOf({});

/** The keys only decode mode reads. */
const STORED_KEYS = [
  "julianDay",
  "nanosOfDay",
  "bytes",
  "int64",
  "seconds",
  "nanos",
  "durSeconds",
  "durNanos",
] as const satisfies readonly (keyof BridgeState)[];

/** The preset whose controls match `state` exactly, or `custom`. */
export function matchPreset(state: BridgeState): string {
  return (
    BRIDGE_PRESETS.find((p) => STATE_KEYS.every((k) => p.state[k] === state[k]))
      ?.id ?? CUSTOM_PRESET_ID
  );
}

/** Whether `args` names anything, so the widget opens on it and not on the default. */
export function isSeeded(args: ColumnTimestampBridgeArgs | undefined): boolean {
  return (
    args !== undefined &&
    (["preset", ...STATE_KEYS] as const).some(
      (k) => typeof args[k] === "string" && args[k] !== "",
    )
  );
}

/**
 * The state a seed describes: a preset, if one is named, then every key the
 * seed also names. With no preset the base is blank, not the default preset, so
 * a chat call never inherits a preset's duration.
 */
export function readArgs(args: ColumnTimestampBridgeArgs): BridgeState {
  const named = BRIDGE_PRESETS.find((p) => p.id === args.preset);
  const state: BridgeState = named ? presetState(named) : { ...BLANK };
  const typed = (key: keyof BridgeState) =>
    typeof args[key] === "string" && args[key] !== "";
  for (const key of STATE_KEYS) {
    const v = args[key];
    if (typeof v !== "string" || v === "") continue;
    if (key === "mode") {
      if (v === "encode" || v === "decode") state.mode = v;
    } else if (key === "unit") {
      if ((UNITS as readonly string[]).includes(v)) state.unit = v as Unit;
    } else if (key === "int96Form") {
      if (v === "record" || v === "bytes") state.int96Form = v;
    } else {
      state[key] = v;
    }
  }
  // A call that leaves out `mode` or `int96Form` still says which it means: a
  // stored value (with no `value`) opens decode, and typed `bytes` selects the bytes form. A
  // `mode` or `int96Form` that is named wins, so a contradiction is the
  // caller's to make (the chat schema refuses it).
  if (!typed("mode") && !named && !typed("value") && STORED_KEYS.some(typed)) {
    state.mode = "decode";
  }
  if (!typed("int96Form") && !named && typed("bytes")) {
    state.int96Form = "bytes";
  }
  return state;
}

/**
 * The permalink keys for `state`: `preset` alone when it is exactly a preset,
 * else every key that differs from the blank state. Every value is a string.
 */
export function permalinkOf(state: BridgeState): Record<string, string> {
  const preset = matchPreset(state);
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  const out: Record<string, string> = {};
  for (const key of STATE_KEYS) {
    if (state[key] !== BLANK[key]) out[key] = state[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// From text to argument
// ---------------------------------------------------------------------------

const SMALL_NUMBER = /^-?\d{1,11}$/;
const BIG_NUMBER = /^-?\d{1,20}$/;
const HEX_24 = /^[0-9a-fA-F]{24}$/;

/** `Number(text)` for a whole number of up to 11 digits, else `null`. */
export function numberOf(text: string): number | null {
  // `+ 0` turns -0 into 0, so "-0" prints as the number it is.
  return SMALL_NUMBER.test(text) ? Number(text) + 0 : null;
}

/** `BigInt(text)` for a whole number of up to 20 digits, else `null`. */
export function bigintOf(text: string): bigint | null {
  return BIG_NUMBER.test(text) ? BigInt(text) : null;
}

/** The 12 bytes 24 hex digits give, in the order typed, else `null`. */
export function bytesOf(text: string): Uint8Array | null {
  if (!HEX_24.test(text)) return null;
  return Uint8Array.from({ length: 12 }, (_, i) =>
    Number.parseInt(text.slice(i * 2, i * 2 + 2), 16),
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function card(id: CardId, over: Partial<CardRead> = {}): CardRead {
  return {
    id,
    status: "idle",
    idle: "",
    stored: [],
    readBack: null,
    zonelessRead: null,
    literal: "",
    validator: null,
    reason: "",
    calls: [],
    ...over,
  };
}

const idle = (id: CardId, why: string) => card(id, { idle: why });

const int96Lines = (p: ParquetInt96) => [
  `julianDay: ${p.julianDay}`,
  `nanosOfDay: ${p.nanosOfDay}n`,
];
const protoLines = (p: ProtoTimestamp | ProtoDuration) => [
  `seconds: ${p.seconds}n`,
  `nanos: ${p.nanos}`,
];

/**
 * The words for a typed zone this browser does not know: the card holds the
 * `isValidTimeZone` call that said so, and no Arrow call is made.
 */
function badZoneCard(lib: ColumnBridgeLib, zone: string, calls: EdiCall[]) {
  const check = runCall(lib, "isValidTimeZone", zone);
  calls.push(check);
  return check.result === true
    ? null
    : card("arrow", {
        status: "sentinel",
        literal: "false",
        validator: check,
        reason: unknownZoneText(zone),
        calls: [check],
      });
}

/** An Arrow read-back string: a value is read, `""` is the sentinel. */
function arrowStringCard(
  stored: string[],
  back: EdiCall,
  calls: EdiCall[],
  local: boolean,
  extra: Partial<CardRead> = {},
): CardRead {
  const text = back.result as string;
  return text === ""
    ? card("arrow", {
        status: "sentinel",
        literal: '""',
        stored,
        calls,
        ...extra,
      })
    : card("arrow", {
        status: "read",
        stored,
        readBack: { kind: local ? "local" : "text", text },
        calls,
        ...extra,
      });
}

/** A card for a read-back string: a value is read, `""` is the sentinel. */
function stringCard(
  id: CardId,
  stored: string[],
  back: EdiCall,
  calls: EdiCall[],
): CardRead {
  const text = back.result as string;
  return text === ""
    ? card(id, { status: "sentinel", literal: '""', stored, calls })
    : card(id, {
        status: "read",
        stored,
        readBack: { kind: "text", text },
        calls,
      });
}

// ---------------------------------------------------------------------------
// Reading: encode
// ---------------------------------------------------------------------------

/**
 * Writes the instant in each form and reads it back. `isValidInstant` runs
 * first: `toNanoseconds` returns `0n` for text it cannot read, which would
 * pass for the epoch, so it is called only on a valid instant.
 */
function readEncode(lib: ColumnBridgeLib, state: BridgeState): Reading {
  const calls: EdiCall[] = [];
  const push = <T extends EdiCall>(call: T): T => {
    calls.push(call);
    return call;
  };
  const value = state.value;
  const has = value !== "";

  // The hero.
  let heroCall: EdiCall | null = null;
  let hero: Hero = { kind: "empty", reason: NO_VALUE_TEXT };
  if (has) {
    heroCall = push(runCall(lib, "isValidInstant", value));
    if (heroCall.result === true) {
      const ns = push(runCall(lib, "toNanoseconds", value));
      const exact = push(runCall(lib, "fromNanoseconds", ns.result));
      hero =
        exact.result === ""
          ? {
              kind: "not-instant",
              call: exact,
              reason: NOT_INSTANT_TEXT,
              signal: false,
            }
          : { kind: "instant", exact: exact.result as string, call: exact };
    } else {
      hero = {
        kind: "not-instant",
        call: heroCall,
        reason: NOT_INSTANT_TEXT,
        signal: false,
      };
    }
  }
  const notInstant =
    heroCall !== null && heroCall.result === false ? heroCall : null;

  // INT96.
  let int96: CardRead;
  if (!has) {
    int96 = idle("int96", NO_VALUE_TEXT);
  } else {
    const own: EdiCall[] = [];
    const p = push(runCall(lib, "toParquetInt96", value));
    own.push(p);
    if (p.result === null) {
      int96 = card("int96", {
        status: "sentinel",
        literal: "null",
        validator: notInstant,
        calls: own,
      });
    } else {
      const back = push(runCall(lib, "fromParquetInt96", p.result));
      own.push(back);
      int96 = stringCard(
        "int96",
        int96Lines(p.result as ParquetInt96),
        back,
        own,
      );
    }
  }

  // Arrow.
  let arrow: CardRead;
  if (!has) {
    arrow = idle("arrow", NO_VALUE_TEXT);
  } else {
    const zoned = state.zone !== "";
    const nano = state.unit === "nanosecond";
    const badZone = zoned ? badZoneCard(lib, state.zone, calls) : null;
    if (badZone !== null) {
      arrow = badZone;
    } else {
      const own: EdiCall[] = [];
      const validator = zoned
        ? heroCall!
        : push(runCall(lib, "isValidDateTime", value));
      own.push(validator);
      // A nanosecond `0n` is also the epoch, so the int64 guard runs first.
      const guard =
        nano && validator.result === true
          ? push(
              runCall(
                lib,
                zoned
                  ? "isValidInt64NanosecondInstant"
                  : "isValidInt64NanosecondDateTime",
                value,
              ),
            )
          : null;
      if (guard !== null) own.push(guard);
      const refused = validator.result === false ? validator : guard;
      const toFn = zoned ? "toArrowTimestamp" : "toArrowLocalTimestamp";
      const v = push(runCall(lib, toFn, value, state.unit));
      own.push(v);
      if (refused !== null && refused.result === false) {
        arrow = card("arrow", {
          status: "sentinel",
          literal: `${v.result as bigint}n`,
          validator: refused,
          reason:
            refused === guard
              ? REASON_INT64
              : zoned
                ? REASON_ZONED
                : REASON_ZONELESS,
          calls: own,
        });
      } else {
        const fromFn = zoned ? "fromArrowTimestamp" : "fromArrowLocalTimestamp";
        const back = push(runCall(lib, fromFn, v.result, state.unit));
        own.push(back);
        let zonelessRead: string | null = null;
        if (zoned) {
          const plain = push(
            runCall(lib, "fromArrowLocalTimestamp", v.result, state.unit),
          );
          own.push(plain);
          zonelessRead = plain.result === "" ? null : (plain.result as string);
        }
        arrow = arrowStringCard([`${v.result as bigint}n`], back, own, !zoned, {
          zonelessRead,
          validator: guard ?? validator,
        });
      }
    }
  }

  // protobuf Timestamp.
  let timestamp: CardRead;
  if (!has) {
    timestamp = idle("timestamp", NO_VALUE_TEXT);
  } else {
    const own: EdiCall[] = [];
    const t = push(runCall(lib, "toProtoTimestamp", value));
    own.push(t);
    if (t.result === null) {
      timestamp = card("timestamp", {
        status: "sentinel",
        literal: "null",
        validator: notInstant,
        calls: own,
      });
    } else {
      const back = push(runCall(lib, "fromProtoTimestamp", t.result));
      own.push(back);
      timestamp = stringCard(
        "timestamp",
        protoLines(t.result as ProtoTimestamp),
        back,
        own,
      );
    }
  }

  // protobuf Duration.
  let duration: CardRead;
  if (state.duration === "") {
    duration = idle("duration", NO_DURATION_TEXT);
  } else {
    const own: EdiCall[] = [];
    const d = push(runCall(lib, "toProtoDuration", state.duration));
    own.push(d);
    if (d.result === null) {
      duration = card("duration", {
        status: "sentinel",
        literal: "null",
        calls: own,
      });
    } else {
      const back = push(runCall(lib, "fromProtoDuration", d.result));
      own.push(back);
      duration = stringCard(
        "duration",
        protoLines(d.result as ProtoDuration),
        back,
        own,
      );
    }
  }

  const cards = [int96, arrow, timestamp, duration];
  // NO SIGNAL on the hero only when nothing at all could be stored.
  if (hero.kind === "not-instant" && cards.every((c) => c.status !== "read")) {
    hero = { ...hero, signal: true };
  }

  const ladder: LadderRow[] = [
    { label: "exact", text: hero.kind === "instant" ? hero.exact : "" },
    { label: "INT96", text: int96.readBack?.text ?? "" },
    { label: "Arrow", text: arrow.readBack?.text ?? "" },
    { label: "Timestamp", text: timestamp.readBack?.text ?? "" },
  ];

  return {
    mode: "encode",
    hero,
    cards,
    ladder,
    calls,
    failed: calls.some((c) => c.result === null || c.result === ""),
  };
}

// ---------------------------------------------------------------------------
// Reading: decode
// ---------------------------------------------------------------------------

/** Each filled fieldset makes one call; a field that fails its grammar makes none. */
function readDecode(lib: ColumnBridgeLib, state: BridgeState): Reading {
  const calls: EdiCall[] = [];
  const push = (call: EdiCall): EdiCall => {
    calls.push(call);
    return call;
  };
  const blank = (...fields: string[]) => fields.every((f) => f === "");

  // INT96.
  let int96: CardRead;
  if (state.int96Form === "bytes") {
    if (blank(state.bytes)) {
      int96 = idle("int96", NO_DECODE_TEXT);
    } else {
      const bytes = bytesOf(state.bytes);
      if (bytes === null) {
        int96 = idle("int96", BAD_HEX_TEXT);
      } else {
        const back = push(runCall(lib, "fromParquetInt96", bytes));
        int96 = stringCard("int96", [`bytes: ${state.bytes}`], back, [back]);
      }
    }
  } else if (blank(state.julianDay, state.nanosOfDay)) {
    int96 = idle("int96", NO_DECODE_TEXT);
  } else {
    const julianDay = numberOf(state.julianDay);
    const nanosOfDay = bigintOf(state.nanosOfDay);
    if (julianDay === null || nanosOfDay === null) {
      int96 = idle("int96", BAD_NUMBER_TEXT);
    } else {
      const record: ParquetInt96 = { julianDay, nanosOfDay };
      const back = push(runCall(lib, "fromParquetInt96", record));
      int96 = stringCard("int96", int96Lines(record), back, [back]);
    }
  }

  // Arrow.
  let arrow: CardRead;
  if (blank(state.int64)) {
    arrow = idle("arrow", NO_DECODE_TEXT);
  } else {
    const int64 = bigintOf(state.int64);
    const zoned = state.zone !== "";
    if (int64 === null) {
      arrow = idle("arrow", BAD_NUMBER_TEXT);
    } else {
      const badZone = zoned ? badZoneCard(lib, state.zone, calls) : null;
      if (badZone !== null) {
        arrow = badZone;
      } else {
        const back = push(
          runCall(
            lib,
            zoned ? "fromArrowTimestamp" : "fromArrowLocalTimestamp",
            int64,
            state.unit,
          ),
        );
        arrow = arrowStringCard([`${int64}n`], back, [back], !zoned);
      }
    }
  }

  const proto = (
    id: "timestamp" | "duration",
    fn: "fromProtoTimestamp" | "fromProtoDuration",
    secondsText: string,
    nanosText: string,
  ): CardRead => {
    if (blank(secondsText, nanosText)) return idle(id, NO_DECODE_TEXT);
    const seconds = bigintOf(secondsText);
    const nanos = numberOf(nanosText);
    if (seconds === null || nanos === null) return idle(id, BAD_NUMBER_TEXT);
    const record = { seconds, nanos };
    const back = push(runCall(lib, fn, record));
    return stringCard(id, protoLines(record), back, [back]);
  };

  const cards = [
    int96,
    arrow,
    proto("timestamp", "fromProtoTimestamp", state.seconds, state.nanos),
    proto("duration", "fromProtoDuration", state.durSeconds, state.durNanos),
  ];

  return {
    mode: "decode",
    hero: null,
    cards,
    ladder: null,
    calls,
    failed: calls.some((c) => c.result === null || c.result === ""),
  };
}

export function readBridge(lib: ColumnBridgeLib, state: BridgeState): Reading {
  return state.mode === "decode"
    ? readDecode(lib, state)
    : readEncode(lib, state);
}
