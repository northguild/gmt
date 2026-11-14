/*
 * One gate for the type of an option or record member. The types declare most members as strings,
 * a few as booleans or numbers. ECMA-402 GetOption and Temporal GetOption convert whatever they
 * are given (ToString, ToBoolean, ToNumber), so a boxed `String`, an object with a `toString`, a
 * one-element array, `hour12: "yes"` or `roundingIncrement: "5"` would be read as if it had the
 * declared type. A function accepts exactly the kinds its types name, so every such value is
 * refused here and the function returns its sentinel.
 */

/** Intl options typed `boolean` (ECMA-402 GetOption type "boolean"). */
const BOOLEAN_INTL_OPTIONS: ReadonlySet<string> = new Set(["hour12"]);

/** Intl options typed `number` (ECMA-402 GetNumberOption). */
const NUMBER_INTL_OPTIONS: ReadonlySet<string> = new Set([
  "fractionalSecondDigits",
  "minimumIntegerDigits",
  "minimumFractionDigits",
  "maximumFractionDigits",
  "minimumSignificantDigits",
  "maximumSignificantDigits",
  "roundingIncrement",
]);

/** Intl options typed `boolean | string` (`NumberFormat` `useGrouping`). */
const BOOLEAN_OR_STRING_INTL_OPTIONS: ReadonlySet<string> = new Set([
  "useGrouping",
]);

/**
 * Whether `value` has the type an `Intl` formatter option of this name is declared with: `boolean`
 * for `hour12`, `number` for the digit counts and `roundingIncrement`, `boolean | string` for
 * `useGrouping`, and `string` for every other option. `undefined` is an absent option.
 *
 * @param name the option's name
 * @param value the caller's value
 * @returns whether `Intl` would read `value` without converting it
 *
 * @example isIntlOptionValue("dateStyle", "long") // true
 * @example isIntlOptionValue("dateStyle", new String("long")) // false
 * @example isIntlOptionValue("hour12", "yes") // false
 * @example isIntlOptionValue("fractionalSecondDigits", 3) // true
 */
export function isIntlOptionValue(name: string, value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (BOOLEAN_INTL_OPTIONS.has(name)) {
    return typeof value === "boolean";
  }
  if (NUMBER_INTL_OPTIONS.has(name)) {
    return typeof value === "number";
  }
  if (BOOLEAN_OR_STRING_INTL_OPTIONS.has(name)) {
    return typeof value === "boolean" || typeof value === "string";
  }
  return typeof value === "string";
}

/** Temporal option names typed `string` (a unit, a mode, an overflow, a disambiguation, an offset). */
const STRING_TEMPORAL_OPTIONS = [
  "overflow",
  "disambiguation",
  "offset",
  "roundingMode",
  "largestUnit",
  "smallestUnit",
] as const;

/**
 * The data value of a property, found without running caller code: own or inherited, read from its
 * descriptor. `ACCESSOR` marks a getter or a Proxy, which this gate leaves to the function that
 * reads the member once (a second read here would give a getter two chances to answer).
 */
const ACCESSOR = Symbol("accessor");

function dataValue(options: object, name: string): unknown {
  let holder: object | null = options;
  while (holder !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(holder, name);
    if (descriptor !== undefined) {
      return "value" in descriptor ? descriptor.value : ACCESSOR;
    }
    holder = Object.getPrototypeOf(holder) as object | null;
  }
  return undefined;
}

/**
 * Whether the Temporal options in a bag have their declared types: `overflow`, `disambiguation`,
 * `offset`, `roundingMode`, `largestUnit` and `smallestUnit` are strings, `roundingIncrement` is a
 * number, and each may be `undefined`. Other members are not read. Members are inspected through
 * their property descriptors, so a getter is never run by this check; a getter's one answer is
 * left to the resolvers that read it once (`resolveOverflow`, `optionOrDefault`).
 *
 * @param options the caller's options object
 * @returns `false` when one of those members holds a value of another type; `true` when none does
 * or when the object cannot be inspected without running caller code that throws
 *
 * @example hasTypedTemporalOptions({ overflow: "reject" }) // true
 * @example hasTypedTemporalOptions({ overflow: new String("reject") }) // false
 * @example hasTypedTemporalOptions({ roundingIncrement: "5" }) // false
 */
export function hasTypedTemporalOptions(options: object): boolean {
  try {
    for (const name of STRING_TEMPORAL_OPTIONS) {
      const value = dataValue(options, name);
      if (
        value !== undefined &&
        value !== ACCESSOR &&
        typeof value !== "string"
      ) {
        return false;
      }
    }
    const increment = dataValue(options, "roundingIncrement");
    return (
      increment === undefined ||
      increment === ACCESSOR ||
      typeof increment === "number"
    );
  } catch {
    // A Proxy whose descriptor trap throws (or a revoked one) cannot be inspected here. It is left
    // to the function, which reads it inside its own try and returns its sentinel, and which never
    // reads it at all when the call does not need the options (a pattern with no `yy`).
    return true;
  }
}

/**
 * A boolean option as the caller wrote it: `fallback` when it is `undefined`, the value when it is
 * a boolean, and a `TypeError` for anything else. A flag is read by what it is, never by whether
 * it is truthy (`"false"`, `1` and `{}` would all switch it on), so a function returns its
 * sentinel for a value the type `boolean` does not name.
 *
 * @param value the option as read from the caller's object
 * @param fallback the documented default
 * @returns the flag
 * @throws TypeError for a value that is neither `undefined` nor a boolean
 *
 * @example booleanOption(undefined, true) // true
 * @example booleanOption(false, true) // false
 * @example booleanOption("false", true) // throws TypeError
 */
export function booleanOption(value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new TypeError("a flag must be a boolean");
  }
  return value;
}
