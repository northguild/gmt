/**
 * Type guard for an ECMAScript Object (ECMA-262 §6.1.7): a non-null object, arrays included, or a
 * function. It is the shape an options bag, a property bag or a props object must have before it
 * is destructured. A default parameter covers only `undefined`, so a `null` or primitive argument
 * reaches the destructure and throws `TypeError` without this check.
 *
 * A function is an Object, so it is accepted wherever Temporal and ECMA-402 accept one:
 * GetOptionsObject returns any Object, and the polyfill reads
 * `Object.assign(() => 0, { largestUnit: "hours" })` as `{ largestUnit: "hours" }`. Checking
 * `typeof value === "object"` alone wrongly refused it.
 *
 * @param value candidate
 * @example isObject({ smallestUnit: "day" }) // true
 * @example isObject(Object.assign(() => 0, { smallestUnit: "day" })) // true
 * @example isObject(null) // false
 * @example isObject("day") // false
 * @returns whether `value` is an Object
 */
export function isObject(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
}

/**
 * Whether an `options` argument is acceptable under Temporal GetOptionsObject: omitted
 * (`undefined`, the defaults) or an Object, a function included. `null`, a string, a number or a boolean is a TypeError
 * there, so a function that takes an options bag returns its sentinel for it rather than silently
 * reading the defaults (e.g. a legacy positional unit string such as `"seconds"`).
 *
 * @param options the caller's options argument
 * @example isOptionsArgument(undefined) // true
 * @example isOptionsArgument({ overflow: "reject" }) // true
 * @example isOptionsArgument(null) // false
 * @example isOptionsArgument("seconds") // false
 * @returns whether `options` is `undefined` or an Object
 */
export function isOptionsArgument(options: unknown): boolean {
  return options === undefined || isObject(options);
}
