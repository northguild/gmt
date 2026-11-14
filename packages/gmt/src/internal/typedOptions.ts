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
 * number, `fractionalSecondDigits` is a number or `"auto"`, and each may be `undefined`. Other members are not read. Members are inspected through
 * their property descriptors, so a getter is never run by this check; a getter's one answer is
 * left to the readers that take it once (`resolveOverflow`, `stringOption`, `numberOption`,
 * `fractionalDigitsOption`).
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
    const digits = dataValue(options, "fractionalSecondDigits");
    return (
      (increment === undefined ||
        increment === ACCESSOR ||
        typeof increment === "number") &&
      (digits === undefined ||
        digits === ACCESSOR ||
        typeof digits === "number" ||
        digits === "auto")
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

/**
 * A string option as the caller wrote it, read once: the value when it is `undefined` or a
 * primitive string, a `TypeError` for anything else. Temporal GetOption and ECMA-402 GetOption
 * would run ToString on a boxed `String` or an object with a `toString`, so a value the type
 * `string` does not name is refused here, before Temporal sees it. Pass the property as it was
 * read (`stringOption(options?.roundingMode)`) and hand Temporal the returned local, never the
 * caller's object: a getter then has one chance to answer, and it cannot answer differently to
 * Temporal.
 *
 * @param value the option as read from the caller's object
 * @returns `value`, typed as the string it is, or `undefined` when absent
 * @throws TypeError for a value that is neither `undefined` nor a primitive string
 *
 * @example stringOption(undefined) // undefined
 * @example stringOption("floor") // "floor"
 * @example stringOption(new String("floor")) // throws TypeError
 */
export function stringOption<T extends string>(
  value: T | undefined,
): T | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new TypeError("an option typed as a string must be a string");
  }
  return value;
}

/**
 * {@link stringOption} with the documented default for an absent option.
 *
 * @param value the option as read from the caller's object
 * @param fallback the documented default
 * @returns `fallback` when `value` is `undefined`, otherwise the string
 * @throws TypeError for a value that is neither `undefined` nor a primitive string
 *
 * @example stringOptionOrDefault(undefined, "compatible") // "compatible"
 * @example stringOptionOrDefault("later", "compatible") // "later"
 * @example stringOptionOrDefault(null, "compatible") // throws TypeError
 */
export function stringOptionOrDefault<T extends string>(
  value: T | undefined,
  fallback: T,
): T {
  return stringOption(value) ?? fallback;
}

/**
 * A number option as the caller wrote it, read once: the value when it is `undefined` or a
 * primitive number, a `TypeError` for anything else (`"5"`, a `Number` object and `{ valueOf }`
 * would all be converted by Temporal's ToNumber).
 *
 * @param value the option as read from the caller's object
 * @returns `value`, typed as the number it is, or `undefined` when absent
 * @throws TypeError for a value that is neither `undefined` nor a primitive number
 *
 * @example numberOption(undefined) // undefined
 * @example numberOption(5) // 5
 * @example numberOption("5") // throws TypeError
 */
export function numberOption(value: number | undefined): number | undefined {
  if (value !== undefined && typeof value !== "number") {
    throw new TypeError("an option typed as a number must be a number");
  }
  return value;
}

/**
 * A `fractionalSecondDigits` option as the caller wrote it, read once: `undefined`, a primitive
 * number or the primitive string `"auto"` (the members of `FractionalDigit`), and a `TypeError`
 * for anything else. Temporal GetOption reads a non-number through ToString, so `"auto"` written
 * as a boxed `String` would be accepted and `"3"` would be refused only by luck.
 *
 * @param value the option as read from the caller's object
 * @returns `value`, or `undefined` when absent
 * @throws TypeError for a value that is not `undefined`, a primitive number or `"auto"`
 *
 * @example fractionalDigitsOption(undefined) // undefined
 * @example fractionalDigitsOption(3) // 3
 * @example fractionalDigitsOption("auto") // "auto"
 * @example fractionalDigitsOption(new String("auto")) // throws TypeError
 */
export function fractionalDigitsOption<T extends number | "auto">(
  value: T | undefined,
): T | undefined {
  if (value !== undefined && typeof value !== "number" && value !== "auto") {
    throw new TypeError(
      "fractionalSecondDigits must be a number or the string auto",
    );
  }
  return value;
}

/**
 * {@link fractionalDigitsOption} with the documented default for an absent option.
 *
 * @param value the option as read from the caller's object
 * @param fallback the documented default
 * @returns `fallback` when `value` is `undefined`, otherwise the digits
 * @throws TypeError for a value that is not `undefined`, a primitive number or `"auto"`
 *
 * @example fractionalDigitsOptionOrDefault(undefined, 9) // 9
 * @example fractionalDigitsOptionOrDefault("auto", 9) // "auto"
 * @example fractionalDigitsOptionOrDefault("3", 9) // throws TypeError
 */
export function fractionalDigitsOptionOrDefault<T extends number | "auto">(
  value: T | undefined,
  fallback: T,
): T {
  return fractionalDigitsOption(value) ?? fallback;
}

/**
 * The rounding members of an options object, each read once and typed: `roundingIncrement` is a
 * number and `roundingMode` a string, or `undefined`. Hand Temporal the returned values, never the
 * caller's object.
 *
 * @param options the caller's options object, or `undefined`
 * @returns the two members as primitives
 * @throws TypeError for a member of another type
 *
 * @example roundingMembers({ roundingMode: "floor" }) // { roundingIncrement: undefined, roundingMode: "floor" }
 * @example roundingMembers({ roundingIncrement: "5" }) // throws TypeError
 */
export function roundingMembers<M extends string>(
  options: { roundingIncrement?: number; roundingMode?: M } | undefined,
): { roundingIncrement: number | undefined; roundingMode: M | undefined } {
  return {
    roundingIncrement: numberOption(options?.roundingIncrement),
    roundingMode: stringOption(options?.roundingMode),
  };
}

/**
 * {@link roundingMembers} plus `smallestUnit`, for a difference or a duration rounding.
 *
 * @param options the caller's options object, or `undefined`
 * @returns the three members as primitives
 * @throws TypeError for a member of another type
 *
 * @example roundingOptionsOf({ smallestUnit: "hours" }) // { smallestUnit: "hours", ... }
 * @example roundingOptionsOf({ smallestUnit: new String("hours") }) // throws TypeError
 */
export function roundingOptionsOf<U extends string, M extends string>(
  options:
    | { smallestUnit?: U; roundingIncrement?: number; roundingMode?: M }
    | undefined,
): {
  smallestUnit: U | undefined;
  roundingIncrement: number | undefined;
  roundingMode: M | undefined;
} {
  return {
    smallestUnit: stringOption(options?.smallestUnit),
    ...roundingMembers(options),
  };
}
