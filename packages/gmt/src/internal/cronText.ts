import type { CronExpression, CronField } from "../types/cron";

type FieldName = keyof CronExpression;

type FieldSpec = {
  /** Lowest stored value. */
  min: number;
  /** Highest stored value. */
  max: number;
};

/**
 * Stored ranges. Day of week is stored as an `IsoWeekday` 1–7 (a GMT rule); the written range is
 * 0–7 (POSIX.1-2024 `crontab`: 0–6 with 0 Sunday; cronie crontab(5): "0 or 7 is Sunday").
 */
const SPECS: Readonly<Record<FieldName, FieldSpec>> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 1, max: 7 },
};

const FIELD_NAMES: readonly FieldName[] = [
  "minute",
  "hour",
  "dayOfMonth",
  "month",
  "dayOfWeek",
];

/**
 * A number is any run of ASCII digits, range-checked after reading: POSIX.1-2024 `crontab` says
 * "a number" with no width, and cronie `entry.c` `get_number` reads every alphanumeric character
 * and runs `strtol`, so `000` is 0 and `*\/100` is a legal step.
 */
const NUMBER_TOKEN = /^[0-9]+$/y;
const NAME_TOKEN = /^[A-Za-z]{3}$/y;

/** cronie crontab(5): "Names can also be used for the 'month' and 'day of week' fields." */
const MONTH_NAMES: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Written numbering: POSIX.1-2024 `crontab` has 0 for Sunday through 6 for Saturday. */
const WEEKDAY_NAMES: Readonly<Record<string, number>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** The numbers a field is written with, and the names it accepts. */
type Written = {
  min: number;
  max: number;
  names: Readonly<Record<string, number>> | null;
};

function writtenOf(name: FieldName): Written {
  const { min, max } = SPECS[name];
  if (name === "month") return { min, max, names: MONTH_NAMES };
  // Day of week is written 0–7, with 0 and 7 both Sunday (crontab(5)).
  if (name === "dayOfWeek") return { min: 0, max: 7, names: WEEKDAY_NAMES };
  return { min, max, names: null };
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
}

function freezeField(values: readonly number[], star: boolean): CronField {
  return Object.freeze({ values: Object.freeze([...values]), star });
}

function isDigits(token: string): boolean {
  NUMBER_TOKEN.lastIndex = 0;
  return NUMBER_TOKEN.test(token);
}

/** A value is a digit run in the field's range, or a three-letter name where the field has names. */
function readValue(token: string, written: Written): number | null {
  if (isDigits(token)) {
    const value = Number(token);
    return value >= written.min && value <= written.max ? value : null;
  }
  if (written.names === null) return null;
  NAME_TOKEN.lastIndex = 0;
  if (!NAME_TOKEN.test(token)) return null;
  const key = token.toLowerCase();
  return Object.hasOwn(written.names, key)
    ? (written.names[key] as number)
    : null;
}

/** A step is a digit run of at least 1; cronie `entry.c` rejects 0. */
function readStep(token: string): number | null {
  if (!isDigits(token)) return null;
  const step = Number(token);
  return step >= 1 ? step : null;
}

/** Cron numbering to the stored numbering: 0 and 7 are Sunday, stored 7. */
function toStored(name: FieldName, value: number): number {
  return name === "dayOfWeek" && value === 0 ? 7 : value;
}

/** Both ends of `a-b`; a day-of-week range ending in 0 means "...-7" (cronie `entry.c` `get_range`). */
function readEnds(
  ends: readonly string[],
  written: Written,
): [number, number] | null {
  const low = readValue(ends[0] as string, written);
  let high = readValue(ends[1] as string, written);
  if (low === null || high === null) return null;
  if (written.max === 7 && low > high && high === 0) high = 7;
  return low > high ? null : [low, high];
}

/** `a-b` with an optional `/step`. */
function readRangeItem(
  ends: readonly string[],
  stepText: string | undefined,
  written: Written,
): number[] | null {
  const bounds = readEnds(ends, written);
  const step = stepText === undefined ? 1 : readStep(stepText);
  if (bounds === null || step === null) return null;
  return range(bounds[0], bounds[1], step);
}

function readItem(item: string, written: Written): number[] | null {
  const [rangeText = "", stepText, ...extraStep] = item.split("/");
  const ends = rangeText.split("-");
  if (extraStep.length > 0 || ends.length > 2) return null;
  if (ends.length === 2) return readRangeItem(ends, stepText, written);
  // A single value takes no step: "5/10" is outside the grammar.
  const only = readValue(rangeText, written);
  return only === null || stepText !== undefined ? null : [only];
}

function readField(token: string, name: FieldName): CronField | null {
  const spec = SPECS[name];
  const written = writtenOf(name);
  if (token.startsWith("*")) {
    // "*" is allowed only as a whole field: "*" or "*/s" (a GMT rule; POSIX allows "*" alone).
    if (token === "*") return freezeField(range(spec.min, spec.max, 1), true);
    const [star, stepText, ...extra] = token.split("/");
    const step = stepText === undefined ? null : readStep(stepText);
    if (star !== "*" || extra.length > 0 || step === null) return null;
    return freezeField(
      normalise(range(written.min, written.max, step), name),
      true,
    );
  }
  const values: number[] = [];
  for (const item of token.split(",")) {
    const read = readItem(item, written);
    if (read === null) return null;
    values.push(...read);
  }
  return freezeField(normalise(values, name), false);
}

function normalise(values: readonly number[], name: FieldName): number[] {
  const stored = new Set(values.map((value) => toStored(name, value)));
  return [...stored].sort((a, b) => a - b);
}

type Nickname = {
  /** The five-field line with the same values. */
  line: string;
  /** The fields cronie `entry.c` flags `*_STAR` for this nickname. */
  star: readonly FieldName[];
};

/**
 * cronie crontab(5) EXTENSIONS; flags from `entry.c` lines 173-211. Matched exactly and in lower
 * case, as `entry.c` does with `strcmp`. `@reboot` is absent: it is not a time. cronie has no
 * month flag (month is always ANDed), so `month` follows the expansion's `*`.
 */
const NICKNAMES: Readonly<Record<string, Nickname>> = {
  "@yearly": { line: "0 0 1 1 *", star: ["dayOfWeek"] },
  "@annually": { line: "0 0 1 1 *", star: ["dayOfWeek"] },
  "@monthly": { line: "0 0 1 * *", star: ["month", "dayOfWeek"] },
  "@weekly": { line: "0 0 * * 0", star: ["dayOfMonth", "month"] },
  "@daily": { line: "0 0 * * *", star: ["dayOfMonth", "month", "dayOfWeek"] },
  "@midnight": {
    line: "0 0 * * *",
    star: ["dayOfMonth", "month", "dayOfWeek"],
  },
  "@hourly": {
    line: "0 * * * *",
    star: ["hour", "dayOfMonth", "month", "dayOfWeek"],
  },
};

function readFields(
  text: string,
  starOf: (name: FieldName, written: boolean) => boolean,
): CronExpression | null {
  const tokens = text.split(/[ \t]+/);
  if (tokens.length !== FIELD_NAMES.length) return null;
  const fields: Partial<Record<FieldName, CronField>> = {};
  for (const [index, name] of FIELD_NAMES.entries()) {
    const field = readField(tokens[index] as string, name);
    if (field === null) return null;
    fields[name] = freezeField(field.values, starOf(name, field.star));
  }
  return Object.freeze(fields) as CronExpression;
}

/**
 * Read the text of a crontab schedule: one lower-case nickname, or five fields separated by
 * blanks (minute, hour, day of month, month, day of week). Returns `null` outside the grammar.
 */
export function readCronExpression(text: string): CronExpression | null {
  if (text.startsWith("@")) {
    if (!Object.hasOwn(NICKNAMES, text)) return null;
    const { line, star } = NICKNAMES[text] as Nickname;
    return readFields(line, (name) => star.includes(name));
  }
  return readFields(text, (_name, written) => written);
}

function isInRange(
  entry: unknown,
  min: number,
  max: number,
  previous: number,
): boolean {
  return (
    typeof entry === "number" &&
    Number.isInteger(entry) &&
    entry >= min &&
    entry <= max &&
    entry > previous
  );
}

function isAscendingIn(copy: readonly unknown[], name: FieldName): boolean {
  const { min, max } = SPECS[name];
  let previous = min - 1;
  for (const entry of copy) {
    if (!isInRange(entry, min, max, previous)) return false;
    previous = entry as number;
  }
  return true;
}

function checkField(value: unknown, name: FieldName): CronField | null {
  if (typeof value !== "object" || value === null) return null;
  const { values, star } = value as { values: unknown; star: unknown };
  if (typeof star !== "boolean" || !Array.isArray(values)) return null;
  // Copy once, then check and freeze that copy: a hostile iterable or getter cannot change a
  // value between the check and the use.
  const copy: unknown[] = [...(values as unknown[])];
  if (copy.length === 0 || !isAscendingIn(copy, name)) return null;
  return freezeField(copy as number[], star);
}

/**
 * Check a caller-built expression against the rules the parser guarantees: every field has a
 * non-empty, strictly ascending array of integers inside the field's range, and a boolean
 * `star`. Day of week holds `IsoWeekday` 1–7, so cron's `0` is refused. Returns a fresh frozen
 * record, or `null`.
 */
export function checkCronExpression(value: unknown): CronExpression | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const source = value as Record<string, unknown>;
    const fields: Partial<Record<FieldName, CronField>> = {};
    for (const name of FIELD_NAMES) {
      const field = checkField(source[name], name);
      if (field === null) return null;
      fields[name] = field;
    }
    return Object.freeze(fields) as CronExpression;
  } catch {
    return null;
  }
}
