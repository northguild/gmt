/**
 * Type guard for a non-null object (arrays included), the shape an options bag or a props
 * object must have before it is destructured. A default parameter covers only `undefined`, so a
 * `null` or primitive argument reaches the destructure and throws `TypeError` without this check.
 *
 * @param value candidate
 * @example isObject({ smallestUnit: "day" }) // true
 * @example isObject(null) // false
 * @example isObject("day") // false
 * @returns whether `value` is a non-null object
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * Whether an `options` argument is acceptable under Temporal GetOptionsObject: omitted
 * (`undefined`, the defaults) or an object. `null`, a string, a number or a boolean is a TypeError
 * there, so a function that takes an options bag returns its sentinel for it rather than silently
 * reading the defaults (e.g. a legacy positional unit string such as `"seconds"`).
 *
 * @param options the caller's options argument
 * @example isOptionsArgument(undefined) // true
 * @example isOptionsArgument({ overflow: "reject" }) // true
 * @example isOptionsArgument(null) // false
 * @example isOptionsArgument("seconds") // false
 * @returns whether `options` is `undefined` or a non-null object
 */
export function isOptionsArgument(options: unknown): boolean {
  return options === undefined || isObject(options);
}
