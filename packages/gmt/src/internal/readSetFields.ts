import { Temporal } from "@js-temporal/polyfill";
import { isObject } from "./isObject";

/** The date fields `setDate` takes. */
export const DATE_FIELDS = ["year", "month", "monthCode", "day"] as const;

/** The time fields `setTime` takes. */
export const TIME_FIELDS = [
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
] as const;

/** The fields `setDateTime`, `setUtc`, `setUnix` and `setZoned` take. */
export const DATE_TIME_FIELDS = [...DATE_FIELDS, ...TIME_FIELDS] as const;

/**
 * Every property TC39 Temporal's `with` methods read from their argument, in the order they read
 * them: `calendar` and `timeZone` first, which IsPartialTemporalObject (13.24) refuses, then the
 * date and time fields and the `offset` that `ZonedDateTime.prototype.with` reads, in code-unit
 * order. PrepareCalendarFields (12.3.3) sorts them so for every `with` that takes a date, and
 * ToTemporalTimeRecord (4.5.12), which `PlainTime.prototype.with` uses, reads its six fields in
 * the same order. The list adds the era fields,
 * which `with` never reads for the ISO 8601 calendar (CalendarExtraFields returns none) and which
 * GMT reads only to refuse them.
 */
const WITH_PROPERTY_NAMES = [
  "calendar",
  "timeZone",
  "day",
  "era",
  "eraYear",
  "hour",
  "microsecond",
  "millisecond",
  "minute",
  "month",
  "monthCode",
  "nanosecond",
  "offset",
  "second",
  "year",
] as const;

/** The one field whose value is a string; every other field a `set*` function takes is a number. */
const STRING_FIELD = "monthCode";

/** A field a `set*` function may take. */
type SetField = (typeof DATE_TIME_FIELDS)[number];

/** The checked values of the fields in `Field`: `monthCode` a string, every other an integer. */
export type SetFields<Field extends SetField> = {
  [Name in Field]?: Name extends typeof STRING_FIELD ? string : number;
};

/**
 * For each Temporal class whose objects hold a date or a time (the internal slots TC39
 * IsPartialTemporalObject tests), a getter that throws for any receiver without that slot.
 */
const BRANDED_GETTERS = [
  ["PlainDate", "calendarId"],
  ["PlainDateTime", "calendarId"],
  ["PlainMonthDay", "calendarId"],
  ["PlainYearMonth", "calendarId"],
  ["ZonedDateTime", "calendarId"],
  ["PlainTime", "hour"],
] as const;

type TemporalNamespace = Partial<
  Record<string, { prototype?: object } | undefined>
>;

/** Whether `value` holds the internal slot of one class of `namespace`. */
function isObjectOf(namespace: TemporalNamespace, value: object): boolean {
  return BRANDED_GETTERS.some(([name, key]) => {
    const prototype: unknown = namespace[name]?.prototype;
    const getter: unknown = isObject(prototype)
      ? Object.getOwnPropertyDescriptor(prototype, key)?.get
      : undefined;
    if (typeof getter !== "function") {
      return false;
    }
    try {
      getter.call(value);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Whether `value` is an object of the Temporal the host provides on `globalThis`, if any. A
 * malformed host Temporal recognises nothing, so it never changes the result for a field object.
 */
function isHostTemporalObject(value: object): boolean {
  try {
    const host: unknown = (globalThis as { Temporal?: unknown }).Temporal;
    return (
      isObject(host) &&
      host !== (Temporal as unknown) &&
      isObjectOf(host as TemporalNamespace, value)
    );
  } catch {
    return false;
  }
}

/**
 * Whether `value` is a Temporal object that holds a date or a time, from the polyfill GMT uses or
 * from a Temporal the host provides. The test is the one a class's own getter makes: it reads the
 * internal slot, so neither the prototype chain nor any property of `value` decides it.
 *
 * The check calls up to six getters, twelve with a host Temporal, and a throwing getter is slow, so
 * it is skipped when the prototype is `Object.prototype`, `null` or `Function.prototype`: a plain
 * object, an `Object.create(null)` object or a function, which no Temporal class makes.
 *
 * Limits:
 * - An object from a second copy of the polyfill that is not on `globalThis` is not detected and
 *   is read as a field bag, which is also what TC39 IsPartialTemporalObject (13.24) does with an
 *   object that lacks this polyfill's internal slots.
 * - A Temporal object whose prototype was swapped to one of the three above is not detected
 *   either. Its getters are then out of reach, so it reads as setting nothing and the function
 *   returns its value unchanged (accepted by owner decision for the speed of the plain case).
 */
function isTemporalDateOrTimeObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  if (
    prototype === Object.prototype ||
    prototype === null ||
    prototype === Function.prototype
  ) {
    return false;
  }
  return (
    isObjectOf(Temporal as unknown as TemporalNamespace, value) ||
    isHostTemporalObject(value)
  );
}

/** Whether `value` is one Temporal reads for `name` without converting it. */
function isFieldValue(name: string, value: unknown): boolean {
  return name === STRING_FIELD
    ? typeof value === "string"
    : typeof value === "number" && Number.isInteger(value);
}

/**
 * Read the `fields` argument of a `set*` function the way Temporal's `with` reads it, and return
 * the values as a fresh plain object that holds only the fields the function takes.
 *
 * The check and the read are one pass, so nothing reaches Temporal that was not checked:
 *
 * - `fields` must be an Object (`isObject`), a function included, and not a Temporal object that
 *   holds a date or a time (TC39 IsPartialTemporalObject).
 * - An own enumerable string key outside `allowedFields` returns `null`, whatever its value: the guard
 *   against a misspelt key. A symbol key is ignored.
 * - Each property `with` reads is read once with an ordinary property get, in the order `with`
 *   reads them, so an inherited, non-enumerable or getter field applies. `undefined` means absent.
 *   A defined property outside `allowedFields` (another type's field, an era, an offset, a
 *   `calendar` or a `timeZone`) returns `null`.
 * - A value is not converted: `monthCode` must be a string, and every other field a number that is
 *   an integer. `null`, a numeric string, a boolean and a fraction return `null`, where Temporal
 *   would convert or truncate them. A bigint, `NaN` and an infinity return `null` too; Temporal
 *   throws for them (ToIntegerWithTruncation).
 *
 * Range and overflow are left to Temporal. An empty result means nothing is set: the function
 * returns its value unchanged, where Temporal's `with` would throw. A getter that throws is not
 * caught here, nor is a Proxy's `getPrototypeOf` trap that throws; the calling function's own catch
 * returns its sentinel.
 *
 * @param fields the caller's `fields` argument
 * @param allowedFields the fields the calling function takes
 * @returns a new plain object of the fields set, empty when none is, or null on invalid input
 *
 * @example readSetFields({ year: 2025 }, DATE_FIELDS) // { year: 2025 }
 * @example readSetFields({}, DATE_FIELDS) // {} (nothing set)
 * @example readSetFields({ year: "2025" }, DATE_FIELDS) // null (not converted)
 * @example readSetFields({ year: 2025, yaer: 1 }, DATE_FIELDS) // null (misspelt key)
 * @example readSetFields({ year: 2025, hour: 5 }, DATE_FIELDS) // null (a field setDate does not take)
 */
export function readSetFields<Field extends SetField>(
  fields: unknown,
  allowedFields: readonly Field[],
): SetFields<Field> | null {
  const allowed: readonly string[] = allowedFields;

  if (!isObject(fields) || isTemporalDateOrTimeObject(fields)) {
    return null;
  }

  if (!Object.keys(fields).every((key) => allowed.includes(key))) {
    return null;
  }

  const record = fields as Record<string, unknown>;
  const read: Record<string, number | string> = {};

  for (const name of WITH_PROPERTY_NAMES) {
    const value = record[name];

    if (value === undefined) {
      continue;
    }

    if (!allowed.includes(name) || !isFieldValue(name, value)) {
      return null;
    }

    read[name] = value as number | string;
  }

  return read as SetFields<Field>;
}
