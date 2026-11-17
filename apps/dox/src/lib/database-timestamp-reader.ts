/**
 * Pure logic for the Database Timestamp Reader.
 *
 * A database hands back a date or time in a form its driver defines. The reader takes a form and
 * the text of its one to three fields, makes the one library call the form's template names, and
 * returns what came back with the call printed. For the SQL offset forms it also asks
 * `toOffsetInstant` and `parseRfc3339` about the same text and shows what each really returns.
 *
 * The site computes nothing: a database's own arithmetic lives in the printed templates of
 * `database-timestamp-forms.ts`, and a test holds each printed call to the call made here. The only
 * conversion this module makes is a field's text into the literal the call takes.
 *
 * No DOM, no library import (the library arrives as a `DatabaseLib`), so the module is cheap to
 * import and unit-testable.
 */
import type { DatabaseLib } from "./database-lib";
import {
  callOf,
  DB_PRESETS,
  formOf,
  type DbField,
  type DbPreset,
  type DbForm,
  type ResultShape,
} from "./database-timestamp-forms";

export const NOT_A_NUMBER_TEXT = "Not a number";
export const GIVE_ZONE_TEXT = "Give the session time zone to get an instant.";

/** The sentence for a typed zone this browser does not know. */
export function unknownZoneText(zone: string): string {
  return `${zone} is not a time zone this browser knows.`;
}

/** One printed call and the literal it returned (`null`, `""`, `true` or a quoted value). */
export interface DbCall {
  code: string;
  returned: string;
}

export interface DbReading {
  form: DbForm;
  /** The shape the reading has: a zone form with a blank zone reads as `plain`. */
  shape: ResultShape;
  /** The call's own return as a string: `""` when it returned `""`, the instant for a pair. */
  value: string;
  /** False when the call returned its sentinel: `""`, `false` or `null`. */
  ok: boolean;
  /** For shape `valid`: the boolean the validator returned. */
  valid?: boolean;
  /** For shapes `offset` and `pair`: the instant and offset `toOffsetInstant` returned. */
  instant?: string;
  offset?: string;
  timeZone?: string;
  /** A sentence that explains an empty reading or a missing zone. */
  note?: string;
  /** The printed calls, each the call made, in the order made. */
  calls: readonly DbCall[];
  /** Kind `new` only: `toOffsetInstant` and `parseRfc3339` on the same text, each its real return. */
  iso?: readonly DbCall[];
}

type Args = Record<string, string | number | bigint>;

/** The call each form makes, written as its template says. Keys equal the `DB_FORMS` ids. */
export const READERS: Record<
  string,
  (lib: DatabaseLib, a: Args, zone: string) => unknown
> = {
  "postgresql-timestamp-text": (lib, a) => lib.parseSqlDateTime(a.v as string),
  "postgresql-timestamptz": (lib, a) =>
    lib.parseSqlOffsetDateTime(a.v as string),
  "postgresql-binary-microseconds": (lib, a) =>
    lib.fromPgMicroseconds(a.v as bigint),
  "postgresql-interval": (lib, a) => lib.parseDuration(a.v as string),
  "postgresql-extract-epoch": (lib, a) =>
    lib.convertUnixToUtc(Math.round((a.s as number) * 1000)),
  "mysql-datetime": (lib, a) => lib.parseSqlDateTime(a.v as string),
  "mysql-timestamp": (lib, a, zone) =>
    zone === ""
      ? lib.parseSqlDateTime(a.v as string)
      : lib.resolveLocal(lib.parseSqlDateTime(a.v as string), zone),
  "mysql-time": (lib, a) =>
    lib.durationFromUnits({
      hours: a.hours as number,
      minutes: a.minutes as number,
      seconds: a.seconds as number,
    }),
  "sqlserver-datetime-text": (lib, a) => lib.parseSqlDateTime(a.v as string),
  "sqlserver-datetimeoffset": (lib, a) =>
    lib.parseSqlOffsetDateTime(a.v as string),
  "oracle-timestamp": (lib, a) => lib.parseSqlDateTime(a.v as string),
  "oracle-timestamptz": (lib, a) => lib.parseSqlOffsetDateTime(a.v as string),
  "sqlite-datetime": (lib, a) =>
    lib.resolveLocal(lib.parseSqlDateTime(a.v as string), "UTC"),
  "sqlite-unixepoch": (lib, a) =>
    lib.convertUnixToUtc(a.v as number, { epochUnit: "seconds" }),
  "sqlite-julianday": (lib, a) =>
    lib.convertUnixToUtc(Math.round(((a.jd as number) - 2440587.5) * 86400000)),
  "mongodb-bson-date": (lib, a) => lib.convertUnixToUtc(a.v as number),
  "mongodb-extended-json": (lib, a) => lib.isValidUtc(a.v as string),
  "mongodb-timestamp": (lib, a) =>
    lib.convertUnixToUtc(a.t as number, { epochUnit: "seconds" }),
  "dynamodb-ttl": (lib, a) =>
    lib.convertUnixToUtc(a.v as number, { epochUnit: "seconds" }),
  "redis-time": (lib, a) =>
    lib.fromArrowTimestamp(
      BigInt(a.s as string) * 1_000_000n + BigInt(a.us as string),
      "microsecond",
    ),
  "redis-expireat": (lib, a) =>
    lib.convertUnixToUtc(a.v as number, { epochUnit: "seconds" }),
  "redis-pexpireat": (lib, a) => lib.convertUnixToUtc(a.v as number),
  "redis-stream-id": (lib, a) =>
    lib.convertUnixToUtc(Number((a.id as string).split("-")[0])),
  "couchbase-epoch-ms": (lib, a) => lib.convertUnixToUtc(a.v as number),
  "couchbase-iso": (lib, a) => lib.toOffsetInstant(a.v as string),
  "cql-timestamp": (lib, a) => lib.convertUnixToUtc(a.v as number),
  "cql-date": (lib, a) =>
    lib.addDate("1970-01-01", { days: (a.raw as number) - 2 ** 31 }),
  "cql-time": (lib, a) =>
    lib.convertUtcToPlainTime(lib.fromNanoseconds(BigInt(a.ns as number))),
  "cql-duration": (lib, a) =>
    lib.durationFromUnits({
      months: a.months as number,
      days: a.days as number,
      nanoseconds: a.nanoseconds as number,
    }),
  "neo4j-datetime": (lib, a) => lib.isValidDateTime(a.v as string),
  "neo4j-zoned-datetime": (lib, a) => lib.toOffsetInstant(a.v as string),
  "neo4j-duration": (lib, a) => lib.parseDuration(a.v as string),
};

const INTEGER = /^[-+]?\d+$/;

/** A field's text as the argument the call takes and the literal that prints it, or null. */
function literalOf(
  field: DbField,
  raw: string,
): { arg: string | number | bigint; literal: string } | null {
  const type = field.type ?? "text";
  if (type === "text") return { arg: raw, literal: JSON.stringify(raw) };
  const trimmed = raw.trim();
  if (type === "number") {
    const n = trimmed === "" ? NaN : Number(trimmed);
    return Number.isFinite(n) ? { arg: n, literal: String(n) } : null;
  }
  if (!INTEGER.test(trimmed)) return null;
  if (type === "integer-text") {
    return { arg: trimmed, literal: JSON.stringify(trimmed) };
  }
  const n = BigInt(trimmed);
  return { arg: n, literal: `${n}n` };
}

/** What a call returned, as the literal the guide prints after `//`. */
function returnedOf(result: unknown): string {
  return JSON.stringify(result);
}

function isOffsetInstant(
  result: unknown,
): result is { instant: string; offset: string; timeZone?: string } {
  return typeof result === "object" && result !== null && "instant" in result;
}

/** A reading with no value and no library call, for input the call cannot take. */
function refused(
  form: DbForm,
  note: string,
  calls: readonly DbCall[] = [],
): DbReading {
  return { form, shape: form.shape, value: "", ok: false, note, calls };
}

export function readDb(
  lib: DatabaseLib,
  formId: string,
  values: readonly string[],
  zone?: string,
): DbReading {
  const form = formOf(formId);
  if (!form) throw new Error(`No database form ${formId}.`);
  const named = form.zone ? (zone ?? "").trim() : "";

  const args: Args = {};
  const declarations: string[] = [];
  for (const [index, field] of form.fields.entries()) {
    const parsed = literalOf(field, values[index] ?? "");
    if (!parsed) return refused(form, NOT_A_NUMBER_TEXT);
    args[field.name] = parsed.arg;
    declarations.push(`const ${field.name} = ${parsed.literal};`);
  }

  if (named !== "" && !lib.isValidTimeZone(named)) {
    return refused(form, unknownZoneText(named), [
      {
        code: `isValidTimeZone(${JSON.stringify(named)})`,
        returned: returnedOf(false),
      },
    ]);
  }

  let result: unknown;
  try {
    result = READERS[form.id](lib, args, named);
  } catch {
    // `BigInt` throws on a number that is not a whole number; the library never throws.
    return refused(form, NOT_A_NUMBER_TEXT);
  }

  const shape: ResultShape = form.zone && named === "" ? "plain" : form.shape;
  const calls: DbCall[] = [
    {
      code: [...declarations, callOf(form, named)].join("\n"),
      returned: returnedOf(result),
    },
  ];
  const reading: DbReading = { form, shape, value: "", ok: false, calls };

  if (shape === "valid") {
    reading.valid = result === true;
    reading.value = String(result);
    reading.ok = result === true;
  } else if (shape === "pair") {
    if (isOffsetInstant(result)) {
      reading.value = result.instant;
      reading.instant = result.instant;
      reading.offset = result.offset;
      if (result.timeZone !== undefined) reading.timeZone = result.timeZone;
      reading.ok = true;
    }
  } else {
    reading.value = typeof result === "string" ? result : "";
    reading.ok = reading.value !== "";
    if (shape === "offset" && reading.ok) {
      const split = lib.toOffsetInstant(reading.value);
      calls.push({
        code: `toOffsetInstant(${JSON.stringify(reading.value)})`,
        returned: returnedOf(split),
      });
      if (split) {
        reading.instant = split.instant;
        reading.offset = split.offset;
      }
    }
  }

  if (form.zone && named === "") reading.note = GIVE_ZONE_TEXT;

  if (form.kind === "new") {
    const declaration = declarations[0];
    const name = form.fields[0].name;
    const text = values[0] ?? "";
    reading.iso = [
      {
        code: `${declaration}\ntoOffsetInstant(${name})`,
        returned: returnedOf(lib.toOffsetInstant(text)),
      },
      {
        code: `${declaration}\nparseRfc3339(${name})`,
        returned: returnedOf(lib.parseRfc3339(text)),
      },
    ];
  }
  return reading;
}

// ---------------------------------------------------------------------------
// The widget's state, seeds and permalinks, and the sentences a reading speaks
// ---------------------------------------------------------------------------

/** What a seed names: a preset, or a form with its fields and zone. All strings. */
export interface DatabaseTimestampReaderArgs {
  preset?: string;
  form?: string;
  value?: string;
  value2?: string;
  value3?: string;
  zone?: string;
}

export const CUSTOM_PRESET_ID = "custom";

/** The permalink key and the field id of each of the three value slots, in order. */
export const VALUE_KEYS = ["value", "value2", "value3"] as const;

export const LOST_TEXT =
  "The call returned its empty sentinel for this text, so there is no value.";

export const INVALID_TEXT =
  "The validator returned false: the text is not a valid value.";

export const DEFAULT_PRESET: DbPreset = DB_PRESETS[0]!;

export interface DatabaseReaderState {
  formId: string;
  values: readonly string[];
  zone: string;
}

export function presetState(p: DbPreset): DatabaseReaderState {
  return { formId: p.form, values: [...p.values], zone: p.zone ?? "" };
}

export function fieldValues(
  state: DatabaseReaderState,
  form: DbForm,
): string[] {
  return form.fields.map((_, i) => state.values[i] ?? "");
}

/** The preset the state equals, or the custom id. */
export function matchPreset(state: DatabaseReaderState): string {
  const form = formOf(state.formId);
  if (!form) return CUSTOM_PRESET_ID;
  const typed = fieldValues(state, form);
  const found = DB_PRESETS.find(
    (p) =>
      p.form === state.formId &&
      (p.zone ?? "") === (form.zone ? state.zone : "") &&
      p.values.length === typed.length &&
      p.values.every((v, i) => v === typed[i]),
  );
  return found?.id ?? CUSTOM_PRESET_ID;
}

/** True when the args name anything to seed the widget from. */
export function isSeeded(
  args: DatabaseTimestampReaderArgs | undefined,
): boolean {
  return (
    args !== undefined &&
    (typeof args.preset === "string" ||
      (typeof args.form === "string" && formOf(args.form) !== undefined))
  );
}

/**
 * The state a seed describes: a preset, or a form with the fields the seed also names. A form
 * with no values starts from its first preset, so no field opens blank unless the link says so.
 * Once the seed names a value, a zone form's session zone is the seed's alone, blank when it
 * names none: a preset's zone is never lent to a value it was not paired with.
 */
export function readArgs(
  args: DatabaseTimestampReaderArgs,
): DatabaseReaderState {
  const named = DB_PRESETS.find((p) => p.id === args.preset);
  if (named) return presetState(named);
  const form = typeof args.form === "string" ? formOf(args.form) : undefined;
  if (!form) return presetState(DEFAULT_PRESET);
  const first = DB_PRESETS.find((p) => p.form === form.id);
  const state = first
    ? presetState(first)
    : { formId: form.id, values: form.fields.map(() => ""), zone: "" };
  VALUE_KEYS.forEach((key, i) => {
    const v = args[key];
    if (typeof v === "string" && i < form.fields.length) {
      state.values = state.values.map((old, j) => (j === i ? v : old));
    }
  });
  const ownValues = VALUE_KEYS.some((key) => typeof args[key] === "string");
  if (form.zone && typeof args.zone === "string") state.zone = args.zone;
  else if (form.zone && ownValues) state.zone = "";
  return state;
}

/**
 * The permalink keys for `state`: `preset` alone when it is exactly a preset, else the form, every
 * field it has (even blank, so a cleared field comes back blank) and the zone of a zone form.
 */
export function permalinkOf(
  state: DatabaseReaderState,
): Record<string, string> {
  const preset = matchPreset(state);
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  const form = formOf(state.formId);
  if (!form) return {};
  const out: Record<string, string> = { form: form.id };
  fieldValues(state, form).forEach((v, i) => {
    out[VALUE_KEYS[i]!] = v;
  });
  if (form.zone) out["zone"] = state.zone;
  return out;
}

/** True when the form's own call returned its sentinel (not a refusal, not a validator's `false`). */
export function isLost(reading: DbReading): boolean {
  if (reading.ok || reading.shape === "valid") return false;
  return reading.note === undefined || reading.note === GIVE_ZONE_TEXT;
}

export function reasonOf(reading: DbReading): string {
  if (isLost(reading)) return reading.note ?? LOST_TEXT;
  if (reading.note !== undefined) return reading.note;
  if (reading.shape === "valid" && !reading.valid) return INVALID_TEXT;
  return "";
}
